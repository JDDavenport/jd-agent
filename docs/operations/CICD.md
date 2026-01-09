# CI/CD Pipeline Documentation

## Overview

JD Agent uses GitHub Actions for automated testing and deployment. The pipeline ensures code quality through automated testing before any deployment.

## Workflows

### 1. CI - Test & Validate (`ci.yml`)

**Triggers:**
- Pull requests to `develop` or `main`
- Push to `develop` or `main`

**Jobs:**

| Job | Description | Duration |
|-----|-------------|----------|
| Setup | Install and cache dependencies | ~1 min |
| Type Check | TypeScript validation | ~2 min |
| Unit Tests | Run Vitest unit tests | ~3 min |
| E2E Tests | Run Playwright tests | ~5 min |
| Critical Tests (10x) | Run critical paths 10 times | ~10 min |
| Build | Build all apps | ~3 min |
| Security | Check for leaked secrets | ~1 min |

**Requirements:** All jobs must pass before merge.

### 2. Deploy to Staging (`deploy-staging.yml`)

**Trigger:** Push to `develop`

**Flow:**
1. Run database migrations on staging
2. Deploy hub to Railway (staging)
3. Deploy apps to Vercel (staging)
4. Run smoke tests
5. Notify status

**URL:** https://staging.jdagent.app

### 3. Deploy to Production (`deploy-production.yml`)

**Trigger:** Push to `main`

**Flow:**
1. **Manual approval required**
2. Run critical path tests (10x)
3. Run database migrations on production
4. Deploy hub to Railway (production)
5. Deploy apps to Vercel (production)
6. Run smoke tests
7. Create deployment tag
8. Notify status

**URL:** https://app.jdagent.app

### 4. Rollback (`rollback.yml`)

**Trigger:** Manual workflow dispatch

**Inputs:**
- Environment (staging/production)
- Git tag to rollback to

**Usage:**
1. Go to Actions tab in GitHub
2. Select "Rollback Deployment"
3. Click "Run workflow"
4. Select environment and tag
5. Run

### 5. Database Migrations (`db-migrate.yml`)

**Trigger:** Manual workflow dispatch

**Inputs:**
- Environment (staging/production)
- Dry run option (preview changes)

**Usage:**
1. Go to Actions tab
2. Select "Database Migrations"
3. Choose environment
4. Optionally enable dry run
5. Run

## Deployment Flow

```
Feature Branch
    ↓
Create PR → develop
    ↓
CI tests run automatically
    ↓
All tests pass
    ↓
Merge to develop
    ↓
Auto-deploy to staging
    ↓
Manual testing in staging
    ↓
Create PR → main
    ↓
CI tests run
    ↓
Merge to main
    ↓
Manual approval required
    ↓
Critical tests run (10x)
    ↓
Deploy to production
    ↓
Smoke tests verify deployment
```

## Required Secrets

Configure in GitHub repo → Settings → Secrets and variables → Actions

### Railway (Backend Hosting)
```
RAILWAY_TOKEN          # API token from railway.app
```

### Vercel (Frontend Hosting)
```
VERCEL_TOKEN                      # API token from vercel.com
VERCEL_ORG_ID                     # Organization ID
VERCEL_PROJECT_ID_COMMAND_CENTER  # Project ID for command-center
VERCEL_PROJECT_ID_TASKS           # Project ID for tasks app
VERCEL_PROJECT_ID_VAULT           # Project ID for vault app
```

### Database
```
STAGING_DATABASE_URL    # Neon staging connection string
PRODUCTION_DATABASE_URL # Neon production connection string
```

### URLs (for smoke tests)
```
STAGING_API_URL    # e.g., https://api-staging.jdagent.app
STAGING_APP_URL    # e.g., https://staging.jdagent.app
PRODUCTION_API_URL # e.g., https://api.jdagent.app
PRODUCTION_APP_URL # e.g., https://app.jdagent.app
```

## GitHub Environments

Configure in GitHub repo → Settings → Environments

### 1. staging
- No protection rules
- Deploys automatically on merge to develop

### 2. production-approval
- **Required reviewers:** Add yourself
- Gates production deployments
- Requires manual approval

### 3. production
- **Required reviewers:** Add yourself
- Used for actual production deployment

### 4. staging-db
- Used for database migration workflow
- Add STAGING_DATABASE_URL secret

### 5. production-db
- Used for database migration workflow
- Add PRODUCTION_DATABASE_URL secret
- Consider adding required reviewers

## Local Testing

### Run CI Locally with `act`

```bash
# Install act
brew install act

# Run all CI jobs
act pull_request

# Run specific job
act pull_request -j unit-tests

# Run with secrets
act pull_request --secret-file .secrets
```

### Run Tests Locally

```bash
# Unit tests
cd hub && bun run test:run

# E2E tests
cd apps/command-center && bunx playwright test

# Critical path tests (10x)
cd hub && TEST_RETRIES=10 bun run test:critical
```

## Troubleshooting

### Tests Failing

1. Check GitHub Actions logs for specific error
2. Run tests locally to reproduce
3. Check if database migrations are up to date
4. Verify environment variables are set

### Deployment Failing

1. Check Railway/Vercel dashboards for errors
2. Verify all secrets are set correctly
3. Check if the build succeeds locally
4. Review deployment logs

### Rollback Needed

1. Find the last working deployment tag:
   ```bash
   git tag | grep deploy- | tail -5
   ```
2. Run the rollback workflow with that tag

### Database Migration Issues

1. Use dry run first to preview changes
2. Check migration logs for specific errors
3. Verify DATABASE_URL is correct
4. Consider manual intervention if needed

## Deployment Tags

Every production deployment creates a tag:
```
deploy-YYYYMMDD-HHMMSS
```

Example: `deploy-20260109-143022`

Use these tags for:
- Rollback reference
- Audit trail
- Release notes

## Monitoring

### GitHub Actions
- View workflow runs: Actions tab
- Set up notifications for failures

### Railway (Hub)
- Dashboard: railway.app
- Logs: `railway logs`
- Metrics: Built-in monitoring

### Vercel (Apps)
- Dashboard: vercel.com
- Logs: Real-time function logs
- Analytics: Web vitals

## Best Practices

1. **Always create PRs** - Never push directly to develop/main
2. **Wait for CI** - Don't merge until all checks pass
3. **Test in staging** - Verify changes before production
4. **Use descriptive commits** - Helps with rollback decisions
5. **Monitor after deploy** - Check logs and metrics
6. **Keep secrets rotated** - Update tokens periodically
