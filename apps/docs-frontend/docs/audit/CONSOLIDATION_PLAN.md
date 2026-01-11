# JD Agent Consolidation Plan

**Created:** January 8, 2026
**Auditor:** Claude Opus 4.5
**Version:** 1.0

---

## Overview

This document outlines the approach for consolidating the JD Agent codebase's contracts, roadmaps, and documentation into a unified, maintainable system.

---

## 1. Contracts Consolidation

### Current State

Three separate contract files exist:
- `CLAUDE.md` (248 lines) - Development rules and documentation requirements
- `claude-code-prompt.md` (177 lines) - Implementation workflow and checkpoints
- `FEATURES.md` (1,657 lines) - Feature inventory and source of truth

### Problem

- 3 duplication instances between files
- Agents must read 3 files before working
- No single authoritative location for all rules

### Consolidation Approach

**Recommendation:** Keep CLAUDE.md as the master contract, merge workflow rules from claude-code-prompt.md, keep FEATURES.md as feature inventory only.

#### Step 1: Merge Implementation Rules into CLAUDE.md

Move these rules from `claude-code-prompt.md` to `CLAUDE.md`:
- Test everything rule
- Fix before moving on rule
- Demo to user format
- Checkpoint verification requirements
- Environment verification steps

#### Step 2: Simplify claude-code-prompt.md

Convert `claude-code-prompt.md` to a project-specific implementation guide (not a contract):
- Keep it as optional reference for complex multi-step features
- Remove duplicate rules that exist in CLAUDE.md
- Rename to `IMPLEMENTATION_GUIDE.md`

#### Step 3: Refactor FEATURES.md

Keep FEATURES.md focused on feature inventory only:
- Remove "rules" about updating it (those belong in CLAUDE.md)
- Keep feature descriptions, API docs, and changelog
- Add frontmatter pointing to CLAUDE.md for rules

#### Step 4: Add Cross-References

Update all files with clear cross-references:
```markdown
# In CLAUDE.md
See also:
- [Feature Inventory](FEATURES.md) - Current system capabilities
- [Implementation Guide](IMPLEMENTATION_GUIDE.md) - Step-by-step workflows

# In FEATURES.md
See also:
- [Development Contract](CLAUDE.md) - Rules for modifying this file
```

### Final Contract Structure

```
CLAUDE.md                    # Master development contract (all rules)
├── Required Reading
├── Code Style Guidelines
├── Testing Requirements
├── Documentation Requirements (merged)
├── Implementation Workflow (merged from claude-code-prompt.md)
└── Cross-references

FEATURES.md                  # Feature inventory only (no rules)
├── System Overview
├── Feature Descriptions
├── API Documentation
└── Changelog

IMPLEMENTATION_GUIDE.md      # Optional step-by-step guide (renamed)
├── Phase-by-phase workflows
├── Verification checkpoints
└── Demo format templates
```

### Effort Estimate

| Task | Effort |
|------|--------|
| Merge rules into CLAUDE.md | 2 hours |
| Refactor FEATURES.md | 1 hour |
| Rename and simplify claude-code-prompt.md | 1 hour |
| Add cross-references | 30 minutes |
| **Total** | **4.5 hours** |

---

## 2. Roadmaps Consolidation

### Current State

Seven planning documents exist:
1. `/docs/roadmap/index.md` - Product roadmap (47 items)
2. `/docs/roadmap/backlog.md` - Issues and requests (45 items)
3. `/docs/roadmap/changelog.md` - Release history (6 releases)
4. `/docs/plans/plaud-integration-prd-v3.0.md` - Plaud implementation (5 phases)
5. `/docs/plans/llm-cost-optimization.md` - LLM provider plan (5 phases)
6. `/docs/internal/goals-habits-implementation-plan.md` - Goals system (6 phases)
7. `/docs/vault-restructuring-plan.md` - Vault architecture (4 priorities)

### Problem

- Multiple sources of truth for "what's planned"
- Implementation plans may drift from roadmap
- Hard to track what's actually being worked on

### Consolidation Approach

**Recommendation:** Keep 3-tier structure but enforce synchronization.

#### Tier 1: Roadmap (Single Source of Truth)

`/docs/roadmap/index.md` remains the **only** place for:
- Current status of features
- What's shipped, in progress, planned, exploring
- High-level milestones

#### Tier 2: Backlog (Issue Tracking)

`/docs/roadmap/backlog.md` remains the place for:
- Known bugs
- Enhancement requests
- Feature requests
- Links to implementation plans when relevant

#### Tier 3: Implementation Plans (Detailed Technical Docs)

Keep `/docs/plans/` for detailed PRDs but:
- Each plan MUST have a status in the roadmap
- Each plan MUST link to related backlog items
- Archive completed plans to `/docs/plans/archive/`

### Synchronization Rules (Add to CLAUDE.md)

```markdown
## Planning Document Rules

1. **Roadmap is authoritative** - If roadmap says "Shipped", it's shipped
2. **Plans link to roadmap** - Every plan must reference its roadmap item
3. **Backlog tracks issues** - Use backlog for bugs/enhancements, not roadmap
4. **Archive completed plans** - Move to /docs/plans/archive/ when done
5. **Update roadmap on completion** - Mark items shipped immediately
```

### Step-by-Step Consolidation

#### Step 1: Audit Plan Status

For each implementation plan:

| Plan | Roadmap Status | Action Needed |
|------|----------------|---------------|
| Plaud PRD v3.0 | 20% Complete | Add to "In Progress" if not there |
| LLM Cost Optimization | Ready | Add to "Planned" |
| Goals & Habits | Ready | Add to "Planned" |
| Vault Restructuring | Proposed | Add to "Exploring" |

#### Step 2: Add Backlinks to Plans

Each plan should start with:
```markdown
---
roadmap_item: "VIP Pipeline v2.0"
backlog_items: ["BUG-002"]
status: "In Progress"
last_updated: "2026-01-08"
---
```

#### Step 3: Create Archive Structure

```
/docs/plans/
├── active/
│   ├── plaud-integration-prd-v3.0.md
│   ├── llm-cost-optimization.md
│   └── goals-habits-implementation-plan.md
├── archive/
│   └── (completed plans go here)
└── README.md (explains the system)
```

#### Step 4: Move Vault Restructuring

Move `/docs/vault-restructuring-plan.md` to `/docs/plans/active/` for consistency.

### Effort Estimate

| Task | Effort |
|------|--------|
| Audit and sync roadmap status | 1 hour |
| Add frontmatter to all plans | 1 hour |
| Create archive structure | 30 minutes |
| Move and organize files | 30 minutes |
| Update CLAUDE.md with rules | 30 minutes |
| **Total** | **3.5 hours** |

---

## 3. Documentation Consolidation

### Current State

Documentation is well-organized:
- `/docs/public/features/` - 13 complete feature docs
- `/docs/roadmap/` - 3 planning docs
- `/docs/plans/` - 4 implementation plans
- `/docs/internal/` - 1 internal plan
- Root level: `FEATURES.md`, `README.md`, PRD

### Problem

- Some overlap between `FEATURES.md` and `/docs/public/features/`
- Internal docs mixed with plans
- PRD at root level

### Consolidation Approach

**Recommendation:** Minor reorganization to reduce overlap.

#### Step 1: Clarify FEATURES.md vs Feature Docs

| Document | Purpose | Audience |
|----------|---------|----------|
| `FEATURES.md` | Quick reference, API docs, changelog | Developers/Agents |
| `/docs/public/features/` | User guides, tutorials, how-tos | End users |

Add note to both explaining the distinction.

#### Step 2: Reorganize /docs/

Current:
```
/docs/
├── public/features/
├── roadmap/
├── plans/
├── internal/
├── jd-agent-prd.md
├── vault-restructuring-plan.md
└── documentation-system-prd.md
```

Proposed:
```
/docs/
├── public/
│   └── features/           # User-facing docs (unchanged)
├── planning/
│   ├── roadmap/            # Roadmap, backlog, changelog
│   └── plans/              # Implementation PRDs
│       ├── active/
│       └── archive/
├── internal/
│   └── prds/               # Product requirement docs
│       ├── jd-agent-prd.md
│       └── documentation-system-prd.md
└── audit/                  # This audit output
```

#### Step 3: Move Files

| Current Location | New Location |
|------------------|--------------|
| `/docs/jd-agent-prd.md` | `/docs/internal/prds/jd-agent-prd.md` |
| `/docs/documentation-system-prd.md` | `/docs/internal/prds/documentation-system-prd.md` |
| `/docs/vault-restructuring-plan.md` | `/docs/planning/plans/active/vault-restructuring-plan.md` |
| `/docs/internal/goals-habits-implementation-plan.md` | `/docs/planning/plans/active/goals-habits-implementation-plan.md` |
| `/docs/roadmap/` | `/docs/planning/roadmap/` |
| `/docs/plans/` | `/docs/planning/plans/active/` |

### Effort Estimate

| Task | Effort |
|------|--------|
| Create new directory structure | 15 minutes |
| Move files | 30 minutes |
| Update cross-references | 1 hour |
| Update CLAUDE.md with new paths | 30 minutes |
| **Total** | **2.25 hours** |

---

## 4. Implementation Order

### Phase 1: Quick Wins (Same Day)

1. Add cross-references between existing files
2. Create `/docs/audit/` directory (done)
3. Remove debug console.log statements
4. Connect Header health check

**Effort:** 2 hours

### Phase 2: Contracts Consolidation (Day 1-2)

1. Merge workflow rules from `claude-code-prompt.md` into `CLAUDE.md`
2. Refactor FEATURES.md to remove embedded rules
3. Rename `claude-code-prompt.md` to `IMPLEMENTATION_GUIDE.md`
4. Add planning document rules to CLAUDE.md

**Effort:** 4.5 hours

### Phase 3: Documentation Reorganization (Day 2-3)

1. Create new directory structure
2. Move files to new locations
3. Update all cross-references
4. Update CLAUDE.md with new paths

**Effort:** 2.25 hours

### Phase 4: Roadmap Sync (Day 3)

1. Audit all plan statuses against roadmap
2. Add frontmatter to all plans
3. Create archive structure
4. Move completed/stale plans

**Effort:** 3.5 hours

### Phase 5: Validation (Day 4)

1. Verify all links work
2. Run test suite
3. Update any broken references
4. Create new consolidated index

**Effort:** 2 hours

---

## 5. Total Effort Summary

| Phase | Hours |
|-------|-------|
| Phase 1: Quick Wins | 2 |
| Phase 2: Contracts | 4.5 |
| Phase 3: Documentation | 2.25 |
| Phase 4: Roadmap | 3.5 |
| Phase 5: Validation | 2 |
| **Total** | **14.25 hours** |

**Estimated Calendar Time:** 3-4 days (with other work)

---

## 6. Risk Assessment

### Low Risk
- Contracts consolidation (documents are read-only by nature)
- Documentation reorganization (can be done incrementally)

### Medium Risk
- Breaking cross-references during file moves
- Agents may reference old file locations

### Mitigation
- Create redirects or symlinks for moved files
- Update CLAUDE.md first so new agents see correct paths
- Run validation phase thoroughly

---

## 7. Success Criteria

After consolidation:

- [ ] Single contract file (CLAUDE.md) contains all development rules
- [ ] FEATURES.md is feature inventory only (no embedded rules)
- [ ] All implementation plans have roadmap frontmatter
- [ ] Archive structure exists for completed plans
- [ ] Documentation directory structure is logical
- [ ] All cross-references work
- [ ] No duplicate rules across files
- [ ] Agents can find everything from CLAUDE.md

---

## 8. Post-Consolidation Maintenance

### Weekly
- Verify roadmap status matches actual progress
- Archive completed implementation plans

### After Each Feature
- Update FEATURES.md
- Update roadmap status
- Update or archive relevant implementation plan

### Monthly
- Audit contract for stale rules
- Review backlog for completed items
- Clean up documentation inconsistencies

---

*Generated by Claude Opus 4.5 Audit Agent*
