# Production Operations Runbook

## Quick Reference

### Production URLs
| Service | URL |
|---------|-----|
| Hub API | https://jd-agent-hub-production.up.railway.app |
| Command Center | https://command-center-plum.vercel.app |
| Tasks | https://tasks-ten-ecru.vercel.app |
| Vault | https://vault-indol.vercel.app |

### Health Check
```bash
# Quick health check
curl https://jd-agent-hub-production.up.railway.app/api/health

# Full health check script
./scripts/monitor-production.sh
```

---

## Common Operations

### Check Production Logs

**Railway (Hub API):**
```bash
# Install Railway CLI if needed
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs -p jd-agent-hub-production -f
```

**Vercel (Frontend Apps):**
```bash
# View deployment logs
npx vercel logs https://command-center-plum.vercel.app
npx vercel logs https://tasks-ten-ecru.vercel.app
npx vercel logs https://vault-indol.vercel.app
```

### Database Access

```bash
# Connect to production database (READ ONLY recommended)
cd hub
ENVIRONMENT=production bun run db:studio

# Run migrations (if needed)
ENVIRONMENT=production bun run db:push
```

**CAUTION:** Be extremely careful with production database operations. Always backup first.

### Restart Services

**Railway Hub:**
```bash
railway restart -p jd-agent-hub-production
```

**Vercel Apps:**
Vercel apps auto-restart. To force redeploy:
```bash
cd apps/command-center && npx vercel --prod
cd apps/tasks && npx vercel --prod
cd apps/vault && npx vercel --prod
```

### Deploy Updates

**From Repository Root:**
```bash
# 1. Build and deploy hub to Railway
cd hub
railway up

# 2. Build and deploy frontend apps
cd /path/to/repo

# For each app, link, pull settings, build, and deploy:
rm -rf .vercel
npx vercel link --yes --project [project-name]
npx vercel pull --yes
npx vercel build --prod
mv .git .git-temp && npx vercel deploy --prebuilt --prod --yes; mv .git-temp .git
```

---

## Troubleshooting

### Issue: Hub API returning 500 errors

**Check:**
1. Railway logs for error messages
2. Database connectivity
3. Environment variables

**Fix:**
```bash
# Check logs
railway logs -p jd-agent-hub-production

# Verify environment variables
railway variables

# If database issue, verify Neon is running
# Go to console.neon.tech and check project status

# If code issue, rollback
railway rollback
```

### Issue: Frontend app not loading

**Check:**
1. Vercel deployment status (vercel.com dashboard)
2. Browser console for errors (F12)
3. Network tab for failed API calls

**Fix:**
```bash
# Check if API is reachable from frontend
curl https://jd-agent-hub-production.up.railway.app/api/health

# Verify VITE_API_URL is set correctly
npx vercel env ls production

# If wrong, update it:
npx vercel env rm VITE_API_URL production
echo "https://jd-agent-hub-production.up.railway.app" | npx vercel env add VITE_API_URL production

# Redeploy
npx vercel --prod
```

### Issue: Database connection failed

**Check:**
1. Neon dashboard for project status
2. Connection string format
3. IP allowlist (if applicable)

**Fix:**
```bash
# Get correct connection string from Neon dashboard
# Update in Railway:
railway variables set DATABASE_URL="postgresql://..."

# Restart the service
railway restart
```

### Issue: Slow response times

**Check:**
1. Railway metrics dashboard
2. Database query performance (Neon dashboard)
3. External API latency

**Fix:**
- Scale Railway service (upgrade plan if needed)
- Add database indexes for slow queries
- Implement caching for frequently accessed data
- Check for N+1 query problems

### Issue: CORS errors in browser

**Check:**
1. Browser console for specific CORS error
2. Hub CORS configuration

**Fix:**
In `hub/src/index.ts`, verify CORS is configured:
```typescript
app.use('*', cors({
  origin: [
    'https://command-center-plum.vercel.app',
    'https://tasks-ten-ecru.vercel.app',
    'https://vault-indol.vercel.app'
  ]
}));
```

---

## Rollback Procedures

### Railway Rollback
```bash
# List recent deployments
railway deployments

# Rollback to specific deployment
railway rollback [deployment-id]

# Or via dashboard:
# railway.app -> project -> Deployments -> click on previous deployment -> Rollback
```

### Vercel Rollback
```bash
# Via CLI
npx vercel rollback [deployment-url]

# Or via dashboard:
# vercel.com -> project -> Deployments -> click ... -> Rollback
```

### Database Rollback
**CAUTION:** Database rollbacks are complex. Always have backups.

```bash
# If using Neon branching:
# Create a branch from a point in time, verify data, then promote

# Manual approach:
# 1. Stop the hub service
# 2. Restore from backup
# 3. Restart hub service
```

---

## Monitoring

### Daily Checks
- [ ] Run `./scripts/monitor-production.sh`
- [ ] Check Railway dashboard for any alerts
- [ ] Check Vercel dashboard for deployment status
- [ ] Review any error notifications

### Weekly Checks
- [ ] Review Railway usage and costs
- [ ] Review Vercel usage and bandwidth
- [ ] Check Neon database size and performance
- [ ] Review application logs for warnings

### Monthly Checks
- [ ] Update dependencies (security patches)
- [ ] Review and rotate any expiring credentials
- [ ] Test backup restoration procedure
- [ ] Review monitoring alerts and thresholds

---

## Emergency Contacts

**Primary On-Call:** [Your Name]
**Email:** [Your Email]

## Escalation Path

1. Check this runbook for solutions
2. Check logs (Railway + Vercel + Browser Console)
3. Attempt documented fixes
4. If critical: Rollback immediately to restore service
5. Investigate root cause after service is restored

---

## Environment Variables Reference

### Railway (Hub)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `APP_ENV` | Environment name (production) |
| `PORT` | Server port (3000) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

### Vercel (Frontend Apps)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |

---

## Useful Commands

```bash
# Quick health check
curl -s https://jd-agent-hub-production.up.railway.app/api/health | jq

# Check all services
./scripts/monitor-production.sh

# View Railway logs
railway logs -p jd-agent-hub-production -f

# View Vercel deployment
npx vercel ls

# Check git status
git log --oneline -5

# Database CLI access
psql $DATABASE_URL
```

---

*Last updated: January 10, 2026*
