# Desktop App Test Kit - Whoop Auto-Refresh

**Test Date:** 2026-01-27
**App Version:** 0.0.0
**Testing Focus:** Whoop Fitness Widget Auto-Refresh Functionality

---

## Pre-Test Setup ✅

### Requirements
- [ ] Hub API running on `http://localhost:3000`
- [ ] Whoop integration configured and authorized
- [ ] Desktop app built and ready to launch
- [ ] Console/DevTools accessible (right-click → Inspect)

### Verify Prerequisites
```bash
# 1. Check hub is running
curl http://localhost:3000/api/health

# 2. Check Whoop is connected
curl http://localhost:3000/api/whoop/status | jq '.data.authorized'

# 3. Check Whoop data is available
curl http://localhost:3000/api/dashboard/fitness | jq '.data.todayRecovery'
```

**Expected Results:**
- Hub health: `{"status":"healthy",...}`
- Whoop authorized: `true`
- Recovery score: `44` (or current score)

---

## Test 1: Initial App Launch ✅

### Objective
Verify app loads with fresh Whoop data immediately on startup.

### Steps
1. Launch desktop app: `open "apps/command-center/src-tauri/target/release/bundle/macos/JD Command Center.app"`
2. Navigate to Dashboard page
3. Locate the Fitness widget
4. Open DevTools console (right-click anywhere → Inspect → Console)

### Expected Results
- [ ] Fitness widget displays (not "Connect Whoop" message)
- [ ] Recovery score visible: **44%** in Red zone
- [ ] Recovery progress bar shows red color
- [ ] Console logs show:
  ```
  [API Client] Using API URL: http://localhost:3000/api
  [FitnessWidget] State: {data: {todayRecovery: 44, ...}, isLoading: false, ...}
  [FitnessWidget] Configuration check: {isConfigured: true}
  ```

### Pass/Fail Criteria
✅ **PASS:** All Whoop data displays correctly on launch
❌ **FAIL:** Shows "Connect Whoop" or missing data

---

## Test 2: Window Focus Refresh 🔄

### Objective
Verify data refreshes automatically when switching back to the app.

### Steps
1. With app open, note current data state
2. Look for the pulsing **↻** icon next to "Fitness" heading
3. Minimize the desktop app (Cmd+M or minimize button)
4. Wait 5 seconds
5. Maximize/restore the app window
6. Watch the Fitness widget

### Expected Results
- [ ] Pulsing **↻** icon appears briefly after restoring window
- [ ] Console logs show: `[FitnessWidget] State: {isFetching: true}`
- [ ] Data refreshes within 1-2 seconds
- [ ] Icon disappears after refresh completes

### Pass/Fail Criteria
✅ **PASS:** Data refreshes when window regains focus
❌ **FAIL:** No refresh occurs on window focus

---

## Test 3: Background Polling (10 Minutes) ⏰

### Objective
Verify data refreshes automatically every 10 minutes while app is open.

### Steps
1. Keep app open and visible
2. Note the current time
3. Watch the Fitness widget for 11 minutes
4. Observe console logs every ~10 minutes

### Expected Results
- [ ] At T+10:00, pulsing **↻** icon appears
- [ ] Console shows: `GET http://localhost:3000/api/dashboard/fitness`
- [ ] Data refreshes automatically
- [ ] Process repeats every 10 minutes

### Accelerated Test (Optional)
Temporarily modify refresh interval for faster testing:
```typescript
// In useDashboardEnhanced.ts line 184
refetchInterval: 1 * 60 * 1000, // 1 minute for testing
```

### Pass/Fail Criteria
✅ **PASS:** Auto-refresh occurs every 10 minutes
❌ **FAIL:** No automatic refresh in background

---

## Test 4: Network Reconnect 🌐

### Objective
Verify data refreshes when network connection is restored.

### Steps
1. With app open, turn off WiFi (or disconnect ethernet)
2. Wait 5 seconds
3. Turn WiFi back on
4. Watch the Fitness widget

### Expected Results
- [ ] On reconnect, pulsing **↻** icon appears
- [ ] Console shows network reconnection event
- [ ] Fresh data loads from API
- [ ] Error state (if any) clears automatically

### Pass/Fail Criteria
✅ **PASS:** Data refreshes on network reconnect
❌ **FAIL:** Stays offline or requires manual refresh

---

## Test 5: Manual Refresh Button 🔄

### Objective
Verify manual refresh button works immediately.

### Steps
1. Locate "Refresh" button in top-right of Fitness widget
2. Click the button
3. Watch for visual feedback

### Expected Results
- [ ] Pulsing **↻** icon appears immediately
- [ ] Console shows API call
- [ ] Data refreshes within 1-2 seconds
- [ ] Button remains clickable (not disabled)

### Pass/Fail Criteria
✅ **PASS:** Manual refresh works on demand
❌ **FAIL:** Button doesn't trigger refresh

---

## Test 6: Error Handling & Retry 🚨

### Objective
Verify graceful error handling when API is unavailable.

### Steps
1. Stop the hub API: `cd hub && pkill -f "bun run dev"`
2. Wait for next refresh cycle (or click Refresh button)
3. Observe error state
4. Restart hub: `cd hub && bun run dev`
5. Wait for auto-reconnect or click Retry

### Expected Results
- [ ] Error message displays: "Failed to load fitness data"
- [ ] Retry button appears
- [ ] Console shows retry attempts (up to 5 times)
- [ ] On hub restart, data loads automatically
- [ ] No app crash or blank screen

### Pass/Fail Criteria
✅ **PASS:** Handles errors gracefully with retry
❌ **FAIL:** App crashes or gets stuck in error state

---

## Test 7: Multi-Day Testing (Long-Term) 📅

### Objective
Verify app maintains fresh data over multiple days without manual intervention.

### Steps
1. Leave desktop app running overnight
2. Check app in the morning
3. Verify data is current (today's recovery, not yesterday's)
4. Check if memory usage is stable

### Expected Results
- [ ] Shows current day's recovery score
- [ ] No stale data from previous day
- [ ] Memory usage stable (< 500MB)
- [ ] No performance degradation

### Pass/Fail Criteria
✅ **PASS:** Fresh data after 24+ hours
❌ **FAIL:** Shows stale data or memory leak

---

## Test 8: Visual Indicators ✨

### Objective
Verify all visual feedback is working correctly.

### Steps
1. Trigger various refresh scenarios
2. Watch for visual indicators

### Expected Results
- [ ] **Initial Load:** Gray loading spinner
- [ ] **Background Refresh:** Pulsing ↻ icon (subtle, not intrusive)
- [ ] **Recovery Score:** Correct color (Red: <34%, Yellow: 34-66%, Green: >67%)
- [ ] **Progress Bar:** Matches recovery percentage
- [ ] **Icons:** Proper emojis (💪 🔥 😴 🏋️)

### Pass/Fail Criteria
✅ **PASS:** All visual indicators present and accurate
❌ **FAIL:** Missing or incorrect visual feedback

---

## Performance Benchmarks 📊

### Response Times
- [ ] Initial load: < 2 seconds
- [ ] Focus refresh: < 1 second
- [ ] Background refresh: < 500ms (already cached)

### Network Activity
- [ ] API calls: ~1 per 10 minutes (when idle)
- [ ] Payload size: < 10KB per request
- [ ] No unnecessary duplicate requests

### Memory Usage
- [ ] Baseline: ~150-200MB
- [ ] After 1 hour: < 300MB
- [ ] After 24 hours: < 500MB

---

## Troubleshooting Guide 🔧

### Issue: "Connect Whoop" shows instead of data

**Check:**
1. Console logs - what's the error?
2. API URL - is it correct? (should be `http://localhost:3000/api`)
3. Whoop status: `curl http://localhost:3000/api/whoop/status`
4. Hub running: `curl http://localhost:3000/api/health`

**Fix:**
- Click "Refresh" button in widget
- Check `.env.local` has correct `VITE_API_URL`
- Restart hub and app

### Issue: Data doesn't refresh on window focus

**Check:**
1. Console logs for React Query activity
2. DevTools Network tab - is API being called?
3. `refetchOnWindowFocus: true` in code

**Fix:**
- Rebuild app with latest code
- Clear React Query cache (refresh app)

### Issue: Pulsing icon doesn't appear

**Check:**
1. `isFetching` state in console logs
2. CSS animations working
3. Icon rendering correctly

**Fix:**
- Hard refresh (Cmd+Shift+R)
- Check for CSS conflicts

### Issue: High memory usage

**Check:**
1. React Query cache size
2. Number of queries running
3. Memory leaks in DevTools

**Fix:**
- Reduce `gcTime` if needed
- Restart app periodically
- Check for unmounted component leaks

---

## Test Results Template 📝

### Test Session Summary

**Date:** _________
**Tester:** _________
**Build:** _________

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Initial Launch | ⬜ Pass / ⬜ Fail | |
| 2 | Window Focus | ⬜ Pass / ⬜ Fail | |
| 3 | Background Polling | ⬜ Pass / ⬜ Fail | |
| 4 | Network Reconnect | ⬜ Pass / ⬜ Fail | |
| 5 | Manual Refresh | ⬜ Pass / ⬜ Fail | |
| 6 | Error Handling | ⬜ Pass / ⬜ Fail | |
| 7 | Multi-Day | ⬜ Pass / ⬜ Fail | |
| 8 | Visual Indicators | ⬜ Pass / ⬜ Fail | |

### Overall Assessment
⬜ **ALL TESTS PASSED** - Ready for production
⬜ **SOME TESTS FAILED** - Review failed tests
⬜ **CRITICAL FAILURES** - Do not deploy

### Notes
_____________________________________________
_____________________________________________
_____________________________________________

---

## Quick Test Commands 🚀

```bash
# Start hub
cd hub && bun run dev

# Check Whoop connection
curl http://localhost:3000/api/whoop/status | jq

# Get current recovery data
curl http://localhost:3000/api/dashboard/fitness | jq '.data'

# Launch desktop app
open "apps/command-center/src-tauri/target/release/bundle/macos/JD Command Center.app"

# Or run in dev mode
cd apps/command-center && bun run tauri:dev

# Tail hub logs
tail -f hub/logs/app.log

# Monitor network calls
# Open DevTools → Network tab → filter by "fitness"
```

---

## Success Criteria Summary ✅

For the desktop app to pass all tests:

1. ✅ Loads with Whoop data on startup
2. ✅ Refreshes when window regains focus
3. ✅ Auto-refreshes every 10 minutes in background
4. ✅ Refreshes on network reconnect
5. ✅ Manual refresh button works
6. ✅ Handles API errors gracefully
7. ✅ Maintains fresh data over 24+ hours
8. ✅ All visual indicators work correctly

**If all 8 tests pass → Desktop app is production-ready! 🎉**
