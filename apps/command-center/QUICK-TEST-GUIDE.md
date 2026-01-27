# Quick Test Guide - Whoop Auto-Refresh

## 🚀 Quick Start (5 Minutes)

### 1. Run Automated Pre-Test Check
```bash
cd apps/command-center
./test-desktop-app.sh
```

This will:
- ✅ Check hub is running
- ✅ Verify Whoop is connected
- ✅ Confirm data is available
- ✅ Launch the desktop app

### 2. Manual Verification (2 minutes)

**Open the app and check:**

1. **Fitness Widget Shows Data** ✅
   - Look for recovery score (should show 44%)
   - Color-coded progress bar
   - NOT showing "Connect Whoop"

2. **Test Window Focus Refresh** ✅
   - Minimize app (Cmd+M)
   - Wait 5 seconds
   - Restore window
   - Watch for pulsing ↻ icon

3. **Test Manual Refresh** ✅
   - Click "Refresh" button in widget
   - Data updates immediately

**Expected: All 3 tests pass ✓**

---

## 🔍 Troubleshooting (If Data Doesn't Show)

### Quick Fixes:

```bash
# 1. Restart Hub
cd ../../hub && bun run dev

# 2. Check Whoop Status
curl http://localhost:3000/api/whoop/status | jq

# 3. Get Recovery Data
curl http://localhost:3000/api/dashboard/fitness | jq '.data.todayRecovery'

# 4. Clear App Cache
# In app: Cmd+Option+I → Application → Clear Site Data
```

### Still Not Working?

1. Check console logs (Cmd+Option+I)
2. Look for errors with "FitnessWidget" or "API Client"
3. Verify API URL in logs: should be `http://localhost:3000/api`

---

## 📊 What to Expect

### Auto-Refresh Behavior:

| Trigger | When | Visual Indicator |
|---------|------|------------------|
| **App Launch** | Every time you open app | Gray spinner → Data |
| **Window Focus** | When you switch back | Pulsing ↻ icon |
| **Every 10 Min** | While app is open | Pulsing ↻ icon |
| **Network Reconnect** | When WiFi reconnects | Pulsing ↻ icon |
| **Manual** | Click Refresh button | Pulsing ↻ icon |

### Your Current Whoop Data:
- **Recovery:** 44% (Red zone)
- **Resting HR:** 63 bpm
- **HRV:** 54.4 ms

---

## 📱 App Locations

**Desktop App:**
```
apps/command-center/src-tauri/target/release/bundle/macos/JD Command Center.app
```

**DMG Installer:**
```
apps/command-center/src-tauri/target/release/bundle/dmg/JD Command Center_0.0.0_aarch64.dmg
```

**Launch Commands:**
```bash
# Production build
open "src-tauri/target/release/bundle/macos/JD Command Center.app"

# Dev mode (with hot reload)
bun run tauri:dev
```

---

## ✅ Success Checklist

- [ ] App shows Whoop data on launch
- [ ] Pulsing ↻ icon appears when refreshing
- [ ] Data updates when minimizing/restoring window
- [ ] Manual refresh button works
- [ ] Console shows no errors

**All checked? You're all set! 🎉**

---

## 📖 Need More Detail?

See full test kit: `DESKTOP-APP-TEST-KIT.md`

Includes:
- 8 comprehensive test scenarios
- Performance benchmarks
- Long-term testing guide
- Troubleshooting section
