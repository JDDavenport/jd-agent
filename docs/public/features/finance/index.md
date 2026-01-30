---
title: Budget & Finance
description: Monitor spending, set budgets, and receive alerts in real time.
---

# Budget & Finance

Monitor spending in real time, assign every dollar a job, and receive alerts when you get close to your limits. The Budget page in Command Center is the central place to connect accounts, manage envelope-style categories, and review recent activity.

**Last updated:** 2026-01-24

## Overview

The Budget system follows a YNAB-style, zero-based philosophy: each month you assign income to categories until **To Be Budgeted** reaches zero. It pulls transactions from your bank (Chase supported via Plaid), calculates current-period spending by category, and compares it against your assigned targets. It keeps data fresh with automatic background sync and notifies you by email or text when thresholds are crossed.

## Getting Started

### Prerequisites
- Running Hub API
- Plaid credentials (recommended) or a CSV export from your bank

### Connect a Bank (Plaid)
1. Open **Command Center → Budget**
2. Click **Connect Bank**
3. Complete Plaid Link (Chase and most major banks supported)
4. Click **Sync now** to fetch the latest transactions

### Import via CSV (Fallback)
1. Export transactions from your bank (CSV format)
2. Click **Upload CSV** in the Budget page
3. Transactions appear immediately and budgets update

## Core Features

### Envelope Budgeting (YNAB-style)
- Assign monthly targets to categories
- Organize categories into groups (e.g., Everyday, True Expenses)
- Track Budgeted, Activity, and Available per category
- Keep “To Be Budgeted” at $0
- Visual progress bars and over-budget indicators

### Budget Dashboard
- Whole budget at a glance (To Be Budgeted, Budgeted, Activity, Available)
- Category overview with remaining amounts
- Quick access to the full category list

### Month View
- Switch months to review past or future budgets
- Per‑month “Budgeted” values (allocations)

### Targets & Overspending
- Set weekly, monthly, or yearly targets per category
- Track funded progress against targets
- Optional “carry overspending” toggle to keep negatives month to month

### Move Money Between Categories
- Reassign dollars on the fly without changing transactions
- Move from one category to another in a single action

### Real-Time Sync
- Automatic background sync every ~15 minutes
- Manual **Sync now** button for immediate refresh

### Alerts
- Threshold alerts (default 80%)
- Delivered via Email, SMS, or Telegram (based on configuration)
- One alert per budget per period to avoid spam

## Available Tools

| Tool | Description |
|------|-------------|
| `GET /api/finance/budgets` | List budgets with status |
| `POST /api/finance/budgets` | Create a budget |
| `PATCH /api/finance/budgets/:id` | Update budget |
| `DELETE /api/finance/budgets/:id` | Deactivate budget |
| `POST /api/finance/sync` | Sync all accounts |
| `GET /api/finance/transactions` | List transactions |

## Configuration

Required environment variables for Plaid:
```bash
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox # or development / production
ENCRYPTION_KEY=64_hex_chars_for_token_encryption
```

Email alerts (optional):
```bash
RESEND_API_KEY=your_resend_api_key
USER_EMAIL=you@example.com
```

SMS alerts (optional):
```bash
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+15551234567
USER_PHONE_NUMBER=+15557654321
```

## Best Practices

1. Start with 3-5 core categories (Dining, Groceries, Travel).
2. Set alert threshold to 80% so you can react early.
3. Use CSV import as a quick fallback while Plaid is being configured.

## Demo Data

Seed sample budgets and transactions:
```bash
cd hub
bun run db:push
bun run scripts/seed-finance-demo.ts
```

## Next Steps

- Add additional budgets for recurring expenses
- Review top categories in the Budget insights panel
- Use alerts to adjust spending before you overshoot
