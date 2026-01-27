# 🚀 Quick Start: Canvas Reading Detection (Phase 0)

**Status:** ✅ Code Implemented - Needs One-Time Setup

---

## ⏱️ 2-Minute Setup

Phase 0 is implemented and ready to go. You just need to save your Canvas session once.

### Step 1: Save Canvas Session (1 minute)

Run this helper script:

```bash
cd hub
bun run scripts/canvas-login-helper.ts
```

**What happens:**
1. Browser window opens automatically
2. You log in to Canvas (SSO or credentials)
3. Session saved for 7 days
4. Helper verifies it worked
5. ✅ Done!

### Step 2: Verify It Works (Optional - 1 minute)

Run the full test to see reading detection in action:

```bash
cd hub
bun run scripts/test-canvas-integrity-agent.ts
```

**What you'll see:**
- Current Canvas items count
- Agent visits MODULES, FILES, PAGES
- Readings detected and listed
- Tasks created with 📖 prefix
- Before/after comparison

### Step 3: Wait for Tomorrow (or check now)

**Option A: Wait for scheduled run**
- Tomorrow at 7:00 AM, agent runs automatically
- Check task list for 📖 reading tasks
- Check Telegram for notifications

**Option B: Check database now**
```bash
cd hub
bun run scripts/test-canvas-readings.ts
```

---

## 🎯 What You Get

After setup, every day at 7:00 AM:

1. **Automatic Detection** - Agent scans Canvas for readings
2. **Task Creation** - Tasks created with 📖 emoji prefix
3. **Notifications** - Telegram message if new readings found
4. **Zero Effort** - Completely automatic after initial setup

---

## 📋 Quick Reference

| Command | What It Does |
|---------|-------------|
| `bun run scripts/canvas-login-helper.ts` | Save Canvas session (one-time) |
| `bun run scripts/test-canvas-integrity-agent.ts` | Run full test |
| `bun run scripts/test-canvas-readings.ts` | Check database |
| `pm2 logs hub \| grep canvas-integrity` | Check logs |

---

## ✅ Success Checklist

After first run, you should see:

- [ ] Reading tasks in task list with 📖 prefix
- [ ] Canvas items in database (file, page, external_url types)
- [ ] Telegram notification (if new readings found)
- [ ] No errors in logs

---

## 🔧 Troubleshooting

### "Login helper won't open browser"

**Fix:**
```bash
cd hub
bun install
npx playwright install chromium
```

### "No readings detected"

**Possible reasons:**
1. No readings in your Canvas modules (check manually)
2. Reading titles don't match keywords
3. Agent hasn't run yet (wait for 7 AM or run test)

### "Session expired"

**Fix:** Just run the login helper again:
```bash
cd hub
bun run scripts/canvas-login-helper.ts
```

---

## 📖 Full Documentation

- `/PHASE0-COMPLETE.md` - Complete setup guide
- `/docs/plans/canvas-reading-integration-prd.md` - Full product spec
- `/docs/plans/canvas-reading-integration-phase0-summary.md` - Technical details

---

## 🎉 That's It!

Phase 0 is ready. Just run the login helper once and you're done!

```bash
cd hub
bun run scripts/canvas-login-helper.ts
```

After that, reading detection runs automatically every day at 7:00 AM. 🚀
