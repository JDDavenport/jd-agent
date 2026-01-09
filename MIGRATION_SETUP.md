# Migration Setup & Usage Guide

Complete guide to running the data migration system and consolidating all your data into the vault.

## 🚀 Quick Start (5 Minutes)

### 1. Apply Database Migrations

First, update your database with the new schema:

```bash
# Push schema changes to database
bun run db:push
```

### 2. Set Up Environment Variables

Add these to your `.env` file (only add the ones for sources you want to migrate):

```bash
# === REQUIRED FOR ALL ===
ANTHROPIC_API_KEY=sk-ant-xxx  # For AI classification
DATABASE_URL=postgresql://user:pass@localhost:5432/jd_agent

# === OPTIONAL SOURCES ===

# Notion
NOTION_API_KEY=secret_xxx

# Todoist
TODOIST_API_KEY=xxx

# Google Drive/Docs
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx

# Apple Notes (no API key needed, but requires macOS)
# Will be automatically detected if running on macOS
```

### 3. Run Test Migration

```bash
bun run migrate:test
```

This will:
- Extract a small sample from each configured source (5 items each)
- Classify them with AI
- Import to the vault
- Show detailed results including resume detection

## 📋 Getting API Keys

### Notion

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Give it a name (e.g., "JD Agent Migration")
4. Copy the "Internal Integration Token"
5. **Important:** Share your Notion pages with the integration:
   - Open the page you want to migrate
   - Click "Share" → "Invite"
   - Select your integration

### Todoist

1. Go to https://todoist.com/app/settings/integrations/developer
2. Scroll to "API token"
3. Copy your token

### Google Drive/Docs

This is more complex. You need OAuth2 credentials:

1. Go to https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable Google Drive API and Google Docs API
4. Create OAuth 2.0 credentials
5. Get your refresh token (you may need to use a tool like `google-auth-library`)

**Alternative:** For testing, you can skip Google Drive initially.

### Apple Notes

No API key needed! Just:
- Must be running on macOS
- Grant Terminal/iTerm access to Notes in System Preferences > Privacy & Security > Automation

## 🎯 What Gets Migrated

### From Each Source

**Notion:**
- All pages you've shared with the integration
- Database entries
- Content converted to Markdown
- Folder hierarchy preserved

**Todoist:**
- All active tasks (grouped by project)
- Task metadata (priority, due dates, labels)
- Formatted as task lists in Markdown

**Google Drive/Docs:**
- Google Docs → Markdown
- Google Sheets → Reference link
- PDFs → Text extraction + attachment
- Other files → Reference link

**Apple Notes:**
- All notes (or selected folders)
- HTML content → Markdown
- Folder structure preserved

### Special Handling

**Resumes are automatically detected** based on:
- Title contains "resume", "cv"
- Path contains "resume", "career", "job"
- Content has "Experience", "Education", "Skills"

When detected, resumes are:
- Tagged as `contentType: 'resume'`
- Categorized as `category: 'resume'`
- Tagged with `resume` and `career`
- Always kept (never suggested for deletion)

## 🔧 Advanced Usage

### Migrate Specific Sources Only

Edit `src/migration/test-migration.ts` to enable/disable sources, or set only specific API keys.

### Dry Run (Test Without Importing)

Edit `src/migration/test-migration.ts` and change:

```typescript
options: {
  dryRun: true,  // Change to true
  checkDuplicates: true,
}
```

### Extract More Items

The test script limits to 5 items per source. To change:

```typescript
// In src/migration/test-migration.ts
config.sources.notion = {
  apiKey: process.env.NOTION_API_KEY,
  limit: 50, // Change to extract more
};
```

### Skip AI Classification (Faster, Less Accurate)

```typescript
options: {
  skipClassification: true,  // Will use simple rule-based classification
}
```

## 📊 View Results

### Check Import Statistics

After migration, you can see stats:

```bash
bun run db:studio
```

Then browse the `vault_entries` table.

### Find Your Resumes

All resumes are automatically tagged. To find them:

```typescript
// In any script or API
import { db } from './src/db/client';
import { vaultEntries } from './src/db/schema';
import { eq } from 'drizzle-orm';

const resumes = await db
  .select()
  .from(vaultEntries)
  .where(eq(vaultEntries.contentType, 'resume'));

console.log(`Found ${resumes.length} resumes!`);
```

### Review Flagged Entries

Some entries may be flagged for human review:

```typescript
import { importService } from './src/services/import-service';

const needsReview = await importService.getEntriesNeedingReview();
console.log(`${needsReview.length} entries need review`);
```

## 🐛 Troubleshooting

### Error: "No access to Apple Notes"

1. Open **System Preferences** → **Privacy & Security** → **Automation**
2. Find your terminal app (Terminal, iTerm2, etc.)
3. Grant access to **Notes.app**

### Error: "Notion API - object_not_found"

Your integration doesn't have access to that page:
1. Open the page in Notion
2. Click "Share"
3. Invite your integration

### Error: "Database connection failed"

Check your `DATABASE_URL`:
- Make sure PostgreSQL is running
- Verify the connection string is correct
- Run `bun run db:push` to apply migrations

### Classification is slow

This is normal! Claude classification takes ~1-2 seconds per entry due to API rate limits. For faster (but less accurate) classification, use `skipClassification: true`.

## 📈 Full Migration (Production)

Once you've tested with the sample migration, you can run a full migration:

1. **Back up your database first!**
   ```bash
   pg_dump jd_agent > backup.sql
   ```

2. Edit `src/migration/test-migration.ts` and remove the limits:
   ```typescript
   config.sources.notion = {
     apiKey: process.env.NOTION_API_KEY,
     // limit: 5,  // Comment out or remove
   };
   ```

3. Run the migration:
   ```bash
   bun run migrate
   ```

4. Be patient! A full migration of thousands of items can take:
   - Extraction: 5-30 minutes (depending on source)
   - Classification: ~1-2 seconds per item (e.g., 1000 items = 16-33 minutes)
   - Import: Very fast (seconds)

## 🎉 What's Next

After migration, your data is in the vault! You can:

1. **Search your data** - Use the existing search service
2. **Build the Job Application Agent** - All your resumes are tagged and ready
3. **Set up ongoing sync** - Keep your vault updated weekly
4. **Build Vault Explorer UI** - Browse and manage your consolidated data

## 📁 Data Structure

All imported data goes into the `vault_entries` table with:

```sql
SELECT
  title,
  content_type,
  category,
  tags,
  source,
  source_path,
  is_processed,
  needs_review,
  imported_at
FROM vault_entries
ORDER BY imported_at DESC;
```

**Resume Query:**
```sql
SELECT * FROM vault_entries WHERE content_type = 'resume';
```

## ⚙️ Architecture

```
Your Data Sources
      ↓
[Extractors] → RawEntry objects
      ↓
[Content Parser] → Clean Markdown
      ↓
[AI Classification] → Categorize & Tag (+ Resume Detection)
      ↓
[Import Service] → vault_entries table
      ↓
Your Unified Vault
```

## 🆘 Need Help?

Check these files for more details:
- `MIGRATION_PROGRESS.md` - Technical details and component docs
- `src/migration/runner.ts` - Migration orchestration code
- `src/services/classification-service.ts` - Resume detection logic
- `src/integrations/` - Individual extractor implementations

---

**Ready to migrate? Run `bun run migrate:test` to get started!**
