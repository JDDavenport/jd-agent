# GitHub Secrets Configuration

## Overview

This guide documents all GitHub secrets and environments needed for CI/CD workflows.

## Required Secrets

### Database Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `STAGING_DATABASE_URL` | Neon staging branch connection string | `postgresql://user:pass@ep-xxx-pooler.neon.tech/neondb?sslmode=require` |
| `PRODUCTION_DATABASE_URL` | Neon production branch connection string | `postgresql://user:pass@ep-yyy-pooler.neon.tech/neondb?sslmode=require` |

### Railway Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| `RAILWAY_TOKEN` | API token for deployments | Railway Dashboard → Settings → Tokens → Create Token |

### Vercel Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| `VERCEL_TOKEN` | API token for deployments | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Organization/Team ID | Vercel Dashboard → Settings → General → Team ID |
| `VERCEL_PROJECT_ID_COMMAND_CENTER` | Project ID for command-center | Project Settings → General → Project ID |
| `VERCEL_PROJECT_ID_TASKS` | Project ID for tasks app | Project Settings → General → Project ID |
| `VERCEL_PROJECT_ID_VAULT` | Project ID for vault app | Project Settings → General → Project ID |

### URL Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `STAGING_API_URL` | Staging API URL | `https://api-staging.jdagent.app` |
| `STAGING_APP_URL` | Staging app URL | `https://staging.jdagent.app` |
| `PRODUCTION_API_URL` | Production API URL | `https://api.jdagent.app` |
| `PRODUCTION_APP_URL` | Production app URL | `https://app.jdagent.app` |

## Setting Secrets via CLI

```bash
# Set database secrets
gh secret set STAGING_DATABASE_URL -b "postgresql://neondb_owner:xxx@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
gh secret set PRODUCTION_DATABASE_URL -b "postgresql://neondb_owner:xxx@ep-yyy-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Set Railway token
gh secret set RAILWAY_TOKEN -b "your-railway-token"

# Set Vercel secrets
gh secret set VERCEL_TOKEN -b "your-vercel-token"
gh secret set VERCEL_ORG_ID -b "your-org-id"
gh secret set VERCEL_PROJECT_ID_COMMAND_CENTER -b "prj_xxx"
gh secret set VERCEL_PROJECT_ID_TASKS -b "prj_yyy"
gh secret set VERCEL_PROJECT_ID_VAULT -b "prj_zzz"

# Set URL secrets
gh secret set STAGING_API_URL -b "https://api-staging.jdagent.app"
gh secret set STAGING_APP_URL -b "https://staging.jdagent.app"
gh secret set PRODUCTION_API_URL -b "https://api.jdagent.app"
gh secret set PRODUCTION_APP_URL -b "https://app.jdagent.app"
```

## Setting Secrets via GitHub UI

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## GitHub Environments

Environments are used to control deployment approvals and isolate secrets.

### Environment Setup

| Environment | Purpose | Protection Rules |
|-------------|---------|------------------|
| `staging` | Staging deployments | None |
| `staging-db` | Staging database migrations | None |
| `production-approval` | Gates production deployments | Required reviewers |
| `production` | Production deployments | Required reviewers |
| `production-db` | Production database migrations | Required reviewers |

### Creating Environments

```bash
# Create environments
gh api -X PUT repos/:owner/:repo/environments/staging
gh api -X PUT repos/:owner/:repo/environments/staging-db
gh api -X PUT repos/:owner/:repo/environments/production-approval
gh api -X PUT repos/:owner/:repo/environments/production
gh api -X PUT repos/:owner/:repo/environments/production-db
```

### Setting Environment Secrets

Some secrets are environment-specific:

```bash
# Staging environment secrets
gh secret set DATABASE_URL --env staging -b "$STAGING_DATABASE_URL"

# Production environment secrets
gh secret set DATABASE_URL --env production -b "$PRODUCTION_DATABASE_URL"
```

### Setting Required Reviewers

**Note:** Required reviewers require GitHub Pro, Team, or Enterprise.

Via GitHub UI:
1. Go to **Settings** → **Environments** → Select environment
2. Check **Required reviewers**
3. Add reviewer (username or team)
4. Click **Save protection rules**

## Verification

### List All Secrets

```bash
gh secret list
```

### Verify Environment Secrets

```bash
gh secret list --env staging
gh secret list --env production
```

### Test CI Workflow

After setting secrets, create a test PR to verify the CI workflow runs correctly:

```bash
git checkout -b test/verify-ci
echo "# Test" >> README.md
git add . && git commit -m "test: verify CI"
git push -u origin test/verify-ci
gh pr create --title "Test CI" --body "Testing CI workflow"
```

## Rotating Secrets

### When to Rotate

- Railway/Vercel tokens: Every 90 days or after team changes
- Database passwords: Every 90 days or after security incidents

### Rotation Procedure

1. Generate new token/secret in the service dashboard
2. Update GitHub secret: `gh secret set SECRET_NAME -b "new-value"`
3. Verify deployment still works
4. Revoke old token in service dashboard

## Troubleshooting

### "Secret not found" Errors

- Check secret name matches exactly (case-sensitive)
- Verify secret is set at correct level (repo vs environment)
- Check workflow has access to environment

### "Authentication failed" Errors

- Token may be expired - regenerate it
- Token may not have required permissions
- Organization settings may block token

### Environment Protection Issues

- Required reviewers need GitHub Pro or higher
- Check reviewer has repository access
- Ensure environment name matches workflow

## Security Best Practices

1. **Principle of Least Privilege**
   - Only grant tokens necessary permissions
   - Use separate tokens for staging/production if possible

2. **Secret Hygiene**
   - Never log secrets in workflows
   - Don't echo secrets, even in debug mode
   - Use `${{ secrets.NAME }}` syntax only

3. **Access Control**
   - Limit who can modify secrets
   - Use environment protection rules
   - Review access periodically

4. **Monitoring**
   - Enable audit logs
   - Review workflow runs for failures
   - Set up notifications for failed deployments
