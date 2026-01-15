#!/bin/bash
# JD Agent - Database Backup Script
#
# This script creates backups of the PostgreSQL database.
# Supports local backups and optional R2 cloud upload.
#
# Usage:
#   ./scripts/backup-database.sh              # Full backup
#   ./scripts/backup-database.sh --quick      # Quick backup (no upload)
#   ./scripts/backup-database.sh --restore    # Restore from latest
#   ./scripts/backup-database.sh --list       # List available backups

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
DOCKER_COMPOSE="${PROJECT_DIR}/docker-compose.yml"

# Database settings (match docker-compose.yml)
DB_CONTAINER="jd-agent-postgres"
DB_USER="${POSTGRES_USER:-jdagent}"
DB_NAME="${POSTGRES_DB:-jd_agent}"

# Retention
KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=3

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Timestamp format
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_DAILY=$(date +"%Y%m%d")
DATE_WEEKLY=$(date +"%Y_W%V")
DATE_MONTHLY=$(date +"%Y%m")

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       JD Agent - Database Backup Manager                   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_docker() {
    if ! docker ps | grep -q "$DB_CONTAINER"; then
        echo -e "${RED}❌ PostgreSQL container is not running${NC}"
        echo "Start it with: docker compose up -d postgres"
        exit 1
    fi
}

create_backup() {
    local backup_type="${1:-full}"
    local upload="${2:-true}"

    print_header
    check_docker

    # Create backup directory structure
    mkdir -p "${BACKUP_DIR}/daily"
    mkdir -p "${BACKUP_DIR}/weekly"
    mkdir -p "${BACKUP_DIR}/monthly"

    echo -e "${YELLOW}Creating database backup...${NC}"
    echo ""

    # Generate backup filename
    local backup_file="${BACKUP_DIR}/daily/jd_agent_${TIMESTAMP}.sql.gz"

    # Create backup using pg_dump inside container
    echo "Dumping database..."
    docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        | gzip > "$backup_file"

    # Get file size
    local size=$(ls -lh "$backup_file" | awk '{print $5}')
    echo -e "${GREEN}✓ Backup created: ${backup_file} (${size})${NC}"

    # Create weekly backup (on Sundays or first of week)
    local day_of_week=$(date +%u)
    if [ "$day_of_week" -eq 7 ]; then
        local weekly_file="${BACKUP_DIR}/weekly/jd_agent_${DATE_WEEKLY}.sql.gz"
        cp "$backup_file" "$weekly_file"
        echo -e "${GREEN}✓ Weekly backup: ${weekly_file}${NC}"
    fi

    # Create monthly backup (on 1st of month)
    local day_of_month=$(date +%d)
    if [ "$day_of_month" -eq "01" ]; then
        local monthly_file="${BACKUP_DIR}/monthly/jd_agent_${DATE_MONTHLY}.sql.gz"
        cp "$backup_file" "$monthly_file"
        echo -e "${GREEN}✓ Monthly backup: ${monthly_file}${NC}"
    fi

    # Cleanup old backups
    cleanup_old_backups

    # Upload to R2 (if configured and requested)
    if [ "$upload" = "true" ] && [ -n "${CLOUDFLARE_R2_BUCKET_NAME:-}" ]; then
        upload_to_r2 "$backup_file"
    fi

    echo ""
    echo -e "${GREEN}Backup complete!${NC}"
    echo ""
    list_backups
}

cleanup_old_backups() {
    echo ""
    echo -e "${YELLOW}Cleaning up old backups...${NC}"

    # Keep only last N daily backups
    local daily_count=$(ls -1 "${BACKUP_DIR}/daily"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    if [ "$daily_count" -gt "$KEEP_DAILY" ]; then
        ls -1t "${BACKUP_DIR}/daily"/*.sql.gz | tail -n +$((KEEP_DAILY + 1)) | xargs rm -f
        echo "  Cleaned daily backups (keeping last $KEEP_DAILY)"
    fi

    # Keep only last N weekly backups
    local weekly_count=$(ls -1 "${BACKUP_DIR}/weekly"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    if [ "$weekly_count" -gt "$KEEP_WEEKLY" ]; then
        ls -1t "${BACKUP_DIR}/weekly"/*.sql.gz | tail -n +$((KEEP_WEEKLY + 1)) | xargs rm -f
        echo "  Cleaned weekly backups (keeping last $KEEP_WEEKLY)"
    fi

    # Keep only last N monthly backups
    local monthly_count=$(ls -1 "${BACKUP_DIR}/monthly"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    if [ "$monthly_count" -gt "$KEEP_MONTHLY" ]; then
        ls -1t "${BACKUP_DIR}/monthly"/*.sql.gz | tail -n +$((KEEP_MONTHLY + 1)) | xargs rm -f
        echo "  Cleaned monthly backups (keeping last $KEEP_MONTHLY)"
    fi
}

upload_to_r2() {
    local file="$1"
    local filename=$(basename "$file")

    echo ""
    echo -e "${YELLOW}Uploading to Cloudflare R2...${NC}"

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}⚠ wrangler not installed, skipping R2 upload${NC}"
        return
    fi

    # Upload using wrangler
    wrangler r2 object put "${CLOUDFLARE_R2_BUCKET_NAME}/backups/${filename}" \
        --file "$file" \
        --content-type "application/gzip" \
        2>/dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Uploaded to R2: backups/${filename}${NC}"
    else
        echo -e "${YELLOW}⚠ R2 upload failed (backup still saved locally)${NC}"
    fi
}

restore_backup() {
    local backup_file="$1"

    print_header
    check_docker

    # If no file specified, use latest
    if [ -z "$backup_file" ]; then
        backup_file=$(ls -1t "${BACKUP_DIR}/daily"/*.sql.gz 2>/dev/null | head -1)
        if [ -z "$backup_file" ]; then
            echo -e "${RED}❌ No backup files found${NC}"
            exit 1
        fi
    fi

    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not found: ${backup_file}${NC}"
        exit 1
    fi

    echo -e "${YELLOW}⚠ WARNING: This will overwrite the current database!${NC}"
    echo ""
    echo "Backup file: $backup_file"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi

    echo ""
    echo -e "${YELLOW}Restoring database...${NC}"

    # Create a new backup before restoring (safety)
    echo "Creating safety backup first..."
    docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-acl | gzip > "${BACKUP_DIR}/pre_restore_${TIMESTAMP}.sql.gz"
    echo -e "${GREEN}✓ Safety backup created${NC}"

    # Restore the backup
    echo "Restoring from backup..."
    gunzip -c "$backup_file" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

    echo ""
    echo -e "${GREEN}✓ Database restored successfully!${NC}"
    echo ""
    echo "Safety backup saved to: ${BACKUP_DIR}/pre_restore_${TIMESTAMP}.sql.gz"
}

list_backups() {
    echo -e "${BLUE}Available Backups:${NC}"
    echo ""

    echo "Daily (last $KEEP_DAILY):"
    if ls "${BACKUP_DIR}/daily"/*.sql.gz 1> /dev/null 2>&1; then
        ls -lh "${BACKUP_DIR}/daily"/*.sql.gz | awk '{print "  " $9 " (" $5 ")"}'
    else
        echo "  (none)"
    fi

    echo ""
    echo "Weekly (last $KEEP_WEEKLY):"
    if ls "${BACKUP_DIR}/weekly"/*.sql.gz 1> /dev/null 2>&1; then
        ls -lh "${BACKUP_DIR}/weekly"/*.sql.gz | awk '{print "  " $9 " (" $5 ")"}'
    else
        echo "  (none)"
    fi

    echo ""
    echo "Monthly (last $KEEP_MONTHLY):"
    if ls "${BACKUP_DIR}/monthly"/*.sql.gz 1> /dev/null 2>&1; then
        ls -lh "${BACKUP_DIR}/monthly"/*.sql.gz | awk '{print "  " $9 " (" $5 ")"}'
    else
        echo "  (none)"
    fi

    # Calculate total size
    echo ""
    local total_size=$(du -sh "${BACKUP_DIR}" 2>/dev/null | awk '{print $1}')
    echo "Total backup size: ${total_size:-0B}"
}

export_production() {
    print_header

    echo -e "${YELLOW}Exporting from production database...${NC}"
    echo ""
    echo "This will export your Neon production database for local import."
    echo ""

    # Check for DATABASE_URL in environment
    if [ -z "${PRODUCTION_DATABASE_URL:-}" ]; then
        echo "Enter your production DATABASE_URL:"
        read -s PRODUCTION_DATABASE_URL
    fi

    local export_file="${BACKUP_DIR}/production_export_${TIMESTAMP}.sql.gz"
    mkdir -p "${BACKUP_DIR}"

    echo ""
    echo "Exporting database..."

    # Use pg_dump with the connection URL
    pg_dump "$PRODUCTION_DATABASE_URL" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        | gzip > "$export_file"

    if [ $? -eq 0 ]; then
        local size=$(ls -lh "$export_file" | awk '{print $5}')
        echo -e "${GREEN}✓ Export complete: ${export_file} (${size})${NC}"
        echo ""
        echo "To import into local Docker:"
        echo "  ./scripts/backup-database.sh --restore $export_file"
    else
        echo -e "${RED}❌ Export failed${NC}"
        rm -f "$export_file"
        exit 1
    fi
}

# Main
case "${1:-}" in
    --quick|-q)
        create_backup "full" "false"
        ;;
    --restore|-r)
        restore_backup "$2"
        ;;
    --list|-l)
        print_header
        list_backups
        ;;
    --export-production)
        export_production
        ;;
    --help|-h)
        echo "JD Agent - Database Backup Manager"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  (none)              Full backup with optional R2 upload"
        echo "  --quick, -q         Quick backup (no R2 upload)"
        echo "  --restore, -r [file] Restore from backup (latest if no file)"
        echo "  --list, -l          List available backups"
        echo "  --export-production Export from production database"
        echo "  --help, -h          Show this help"
        echo ""
        echo "Environment variables:"
        echo "  POSTGRES_USER       Database user (default: jdagent)"
        echo "  POSTGRES_DB         Database name (default: jd_agent)"
        echo "  CLOUDFLARE_R2_BUCKET_NAME  R2 bucket for cloud backup"
        echo "  PRODUCTION_DATABASE_URL    Production DB URL for export"
        ;;
    *)
        create_backup "full" "true"
        ;;
esac
