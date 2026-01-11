# Production Deployment Checklist

**Complete this checklist before and after deploying to production.**

## Pre-Deployment Verification

### Code Quality
- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] No console.log statements left in code
- [ ] TypeScript builds without errors
- [ ] Linting passes

### Infrastructure
- [ ] Railway production project exists
- [ ] Vercel production projects exist
- [ ] Production database is accessible
- [ ] All environment variables configured
- [ ] SSL certificates valid

### Security
- [ ] Production API keys are different from development
- [ ] Secrets not committed to Git
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (if applicable)

### Communication
- [ ] Team notified of deployment window
- [ ] Rollback plan documented
- [ ] Monitoring in place

---

## Deployment Steps

### 1. Pre-Flight Checks
```bash
# Verify current branch
git status

# Run tests
cd hub && bun test
cd apps/command-center && bun test

# Build locally to catch errors
cd hub && bun run build
cd apps/command-center && bun run build
```

### 2. Deploy Hub to Railway
```bash
cd hub
railway up

# Monitor logs
railway logs -f
```

### 3. Deploy Frontend Apps to Vercel
```bash
# For each app (command-center, tasks, vault):
cd apps/[app-name]
npx vercel link --yes --project [project-name]
npx vercel pull --yes
npx vercel build --prod

# Deploy (hide .git to bypass author check)
cd ../..
mv .git .git-temp
npx vercel deploy --prebuilt --prod --yes
mv .git-temp .git
```

### 4. Verify Deployment
```bash
# Run health checks
./scripts/monitor-production.sh

# Manual verification in browser
# - Open each app URL
# - Check browser console for errors
# - Test basic functionality
```

---

## Post-Deployment Verification

### Health Checks
- [ ] Hub health endpoint returns 200
- [ ] Command Center loads
- [ ] Tasks app loads
- [ ] Vault app loads

### Functionality Tests
- [ ] Can create a task
- [ ] Can view/edit vault documents
- [ ] Can view goals and habits
- [ ] Navigation works correctly
- [ ] No JavaScript errors in console

### Performance
- [ ] Page load times acceptable (< 3s)
- [ ] API response times acceptable (< 500ms)
- [ ] No timeout errors

---

## Rollback Procedure

If critical issues are found after deployment:

### 1. Immediate Rollback (< 5 minutes)
```bash
# Railway rollback
railway rollback

# Vercel rollback
npx vercel rollback [deployment-url]
```

### 2. Verify Rollback
```bash
./scripts/monitor-production.sh
```

### 3. Investigate
- Check logs for error messages
- Review recent code changes
- Fix issues in development first

---

## Production URLs

| Service | URL |
|---------|-----|
| Hub API | https://jd-agent-hub-production.up.railway.app |
| Command Center | https://command-center-plum.vercel.app |
| Tasks | https://tasks-ten-ecru.vercel.app |
| Vault | https://vault-indol.vercel.app |

---

*Last updated: January 10, 2026*
