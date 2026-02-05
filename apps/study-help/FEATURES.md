# Study Aide - Feature Tracker

**Last Updated:** 2026-02-05  
**Production:** https://www.studyaide.app  
**User:** johndd@byu.edu

---

## 🟢 WORKING

### Materials (FIXED 2/5!)
- [x] **Canvas materials syncing** — 119 materials from Canvas now in hub
- [x] **Materials display in app** — CourseView shows materials grouped by module
- [x] **Materials organized by course** — Each class has its own materials section
- [x] **Syllabi accessible** — Course syllabi available via materials links

### Tasks
- [x] **Assignment sync from Canvas** — 238 Canvas tasks synced
- [x] **Basic task display** — Tasks show in course view and overview
- [x] **Due date sorting** — Tasks sorted by due date
- [x] **Task completion** — Can mark tasks complete

### Content Sync
- [x] **Canvas API pull** — Assignments, modules, files working
- [x] **Sync service operational** — `npm run pull` + `npm run push` working
- [x] **Class mappings** — Canvas course IDs mapped to hub UUIDs

### App Infrastructure
- [x] Dashboard with course overview
- [x] Task list by course
- [x] Production deployment (studyaide.app)
- [x] iOS app basic functionality
- [x] User auth configured

---

## 🟡 PARTIALLY WORKING

### Materials
- [x] **119 Canvas materials synced** — PDFs, pages, links from Canvas
- [ ] **Download actual files** — Materials show but need to download PDFs
- [ ] **Syllabus parsing for MBA 664** — Embedded assignments need extraction

### Class Notes
- [x] **Plaud recordings** — 96 recordings synced locally and matched to courses
- [ ] **Plaud → Hub push** — Need recordings endpoint for sync
- [ ] **Remarkable notes** — Basic structure exists but needs sync

### AI Features
- [ ] **AI summaries** — Not yet implemented
- [ ] **Class GPT** — Not yet implemented

---

## 🔴 NEEDS WORK

### MBA 664 (VC/PE) Special Case
- [ ] **Embedded syllabus assignments** — Need to parse syllabus document
- [ ] **READ and PREPARE items** — Currently only 8 tasks showing
- [ ] **Case materials linking** — Link cases to tasks

### Class Notes Full Integration
- [ ] **Plaud in app** — Recordings synced but not pushing to hub
- [ ] **Remarkable sync** — Cloud API configured but notes not flowing to app
- [ ] **Manual upload** — No upload button yet

### AI Features (V1 Goal)
- [ ] **Material summaries** — Auto-generate on PDF upload
- [ ] **Class note summaries** — Summarize Plaud transcripts
- [ ] **Per-class GPT** — RAG chat with class content

---

## 📋 V1 REQUIREMENTS STATUS

1. **Materials per class** — ✅ MOSTLY DONE
   - ✅ Syllabus visible for each course
   - ✅ Canvas files accessible via links
   - ⚠️ Need to download actual PDFs for offline

2. **Class Notes Integration** — 🟡 IN PROGRESS
   - ⚠️ Plaud recordings matched but not in app
   - ⚠️ Remarkable needs sync trigger
   - ❌ Manual upload not implemented

3. **AI Features** — ❌ NOT STARTED
   - ❌ Auto-summaries
   - ❌ Per-class GPT

4. **Preclass Workflow** — ✅ MOSTLY DONE
   - ✅ Most preclass items from Canvas
   - ⚠️ MBA 664 embedded items need extraction

---

## 🧪 TEST CHECKLIST

```
[x] MBA 560 - Can see syllabus? ✅ Materials? ✅ Assignments? ✅
[x] MBA 580 - Can see syllabus? ✅ Materials? ✅ (75 items!) Assignments? ✅
[x] Entrepreneurial Innovation - Can see syllabus? ✅ (31 items)
[⚠] VC/PE (MBA 664) - Assignments from syllabus showing? ⚠️ (only 8 tasks)
[x] ETA (MBA 677R) - Case materials accessible? ✅ (4 items)
[⚠] Post-MBA Career - Materials showing? ⚠️ (needs check)
[x] Client Acq (MBA 654) - Materials showing? ✅
[ ] Plaud - Recent recordings visible in app? ❌
[ ] Remarkable - Notes synced and readable? ❌
[ ] AI Summary - Works on a material? ❌
[ ] Class GPT - Can chat about class content? ❌
```

---

## 📊 SYNC STATUS

| Source | Count | In Hub? | In App? | Notes |
|--------|-------|---------|---------|-------|
| Canvas Assignments | 161 | ✅ 238 pushed | ✅ | Fixed 2/5 |
| Canvas Materials | 119 | ✅ 119 in hub | ✅ | Fixed 2/5 |
| Plaud Recordings | 96 | 🟡 Matched | ❌ | Need recordings push |
| Remarkable Notes | ? | ❌ | ❌ | Need sync trigger |
| Manual Uploads | 0 | ❌ | ❌ | Feature missing |

---

## 📁 MATERIALS BY COURSE

| Course | Canvas ID | Materials | Status |
|--------|-----------|-----------|--------|
| Entrepreneurial Innovation | 33259 | 31 | ✅ |
| MBA 560 Analytics | 32991 | 5 | ✅ |
| MBA 580 Strategy | 33202 | 75 | ✅ |
| MBA 654 Client Acq | 34642 | 2 | ⚠️ Low |
| MBA 664 VC/PE | 34638 | 4 | ⚠️ Low - embedded syllabus |
| MBA 677R ETA | 34458 | 4 | ⚠️ Low |
| Post-MBA Career | 34634 | 0 | ⚠️ Check needed |

---

## 🔄 CHANGELOG

### 2026-02-05 (Major Progress!)
- ✅ Fixed sync-service push.ts to use correct hub endpoints
- ✅ Added /api/classes/with-canvas-ids endpoint
- ✅ Added POST /api/classes endpoint for creating classes
- ✅ 119 Canvas materials now in hub
- ✅ Updated CourseView to display canvas materials
- ✅ Materials grouped by Canvas module
- ✅ Added useMaterialsByCanvasCourseId hook
- ⚠️ Plaud recordings sync needs work (recordings endpoint)

### 2026-02-04
- Fixed assignment sync (53 → 280)
- Created sync-service with gold standard approach
- Created this feature tracker

### 2026-02-03
- Launched to production
- 17 features shipped

---

## 🔧 NEXT STEPS

1. **Download actual PDF files** — Use Canvas API to download materials
2. **Fix MBA 664** — Parse syllabus for embedded assignments
3. **Push Plaud to hub** — Add recordings sync endpoint
4. **Trigger Remarkable sync** — Get handwritten notes flowing
5. **Add AI summaries** — Start with material summaries
