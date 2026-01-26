---
title: Budget Monitoring & Alerts PRD
status: Shipped
last_updated: 2026-01-24
roadmap_item: "Budget Monitoring & Alerts (Command Center)"
---

# Budget Monitoring & Alerts PRD

## Overview
Build a real-time budget and spending monitoring experience inside Command Center that syncs bank data (Chase via Plaid), tracks category budgets, and sends email/SMS alerts when spending approaches limits. The system should show how much remains to spend at any time and keep budgets up to date as new transactions arrive.

## Goals
- Connect Chase accounts quickly using the cheapest, fastest integration.
- Track category budgets with remaining spend and percent used.
- Keep spending data fresh with automatic background sync.
- Deliver alerts via email and SMS (and Telegram if configured).
- Provide a clear Command Center page for budget management and monitoring.

## Non-Goals
- Full accounting (invoices, bill pay, tax prep).
- Multi-user or shared budgets.
- Cash-flow forecasting beyond current period.

## Target Users
- Primary user (single-user system) managing personal budgets in real time.

## User Stories
1. As a user, I can connect my Chase account in minutes so transactions sync automatically.
2. As a user, I can create a monthly budget for a category (e.g., "Dining") and see remaining spend.
3. As a user, I receive a text/email alert when I hit 80% of a budget.
4. As a user, I can manually upload CSVs when Plaid is not available.
5. As a user, I can sync now and see updated budget totals quickly.

## Functional Requirements

### Bank Sync
- Support Plaid Link for account connection.
- Use Plaid transactions endpoint with cursor-based sync.
- Automatic background sync (every 15-30 minutes).
- Manual “Sync now” button in Command Center.
- Fallback CSV import (Chase supported).

### Budgets
- CRUD budgets by category.
- Budget periods: weekly, monthly, yearly.
- Rollover support (fixed carryover amount).
- Status calculation:
  - Spent (current period)
  - Remaining
  - Percent used
- Active period calculation using calendar periods (week/month/year).

### Alerts
- Budget threshold alerts (default 80%).
- Alert channels: Email (Resend), SMS (Twilio), Telegram (existing).
- Avoid alert spam: one alert per budget per period.
- Store alerts in `finance_insights` for traceability.

### UI (Command Center)
- Dedicated Budget page in sidebar.
- Connection status + sync controls.
- Budget list with progress bars and remaining spend.
- Add/edit budget form.
- Recent transactions list.

## Integrations

### Primary Integration: Plaid
- **Reason:** fastest setup, broad coverage, Chase supported, lowest integration effort.
- Environment variables: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `ENCRYPTION_KEY`.

### Alerting
- **Email:** Resend (`RESEND_API_KEY`, `USER_EMAIL`).
- **SMS:** Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `USER_PHONE_NUMBER`).
- **Telegram:** Existing bot credentials.

## Data Model
- `finance_transactions` (existing)
- `finance_budgets` (existing)
- `finance_insights` (used for budget alerts)

## API Endpoints
- `GET /api/finance/budgets` - List budgets with current status
- `POST /api/finance/budgets` - Create budget
- `PATCH /api/finance/budgets/:id` - Update budget
- `DELETE /api/finance/budgets/:id` - Deactivate budget
- `GET /api/finance/budgets/:id` - Get budget
- `POST /api/finance/sync` - Sync all accounts

## Success Metrics
- Budget status updates within 15-30 minutes of transaction posting.
- Alerts delivered within 5 minutes of threshold crossing.
- < 5 minutes setup time to connect Chase.

## Risks & Mitigations
- **Plaid auth failures:** Provide CSV fallback.
- **Alert spam:** Use `finance_insights` to dedupe.
- **Category mismatch:** Allow manual category overrides and flexible category text.

## Milestones
1. Budget CRUD + status calculation
2. Command Center Budget page
3. Alerts + scheduler integration
4. Documentation + setup instructions
