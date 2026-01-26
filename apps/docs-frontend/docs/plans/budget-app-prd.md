# Budget App PRD (YNAB Clone)
> **Date:** January 24, 2026
> **Status:** Planning
> **Related Roadmap:** Finance (Replaces current Budget page)

---

## Problem Statement

The current Command Center Budget page is a basic YNAB-inspired interface, but it lacks the proactive engagement that makes budgeting a habit:

1. **No proactive reporting** - Users must open the app to see their status
2. **No daily/weekly summaries** - No regular touchpoints to build awareness
3. **Reactive alerts only** - Only notifies when something is wrong (80% threshold)
4. **No spending insights** - Limited analysis of patterns and trends
5. **Clunky UX** - Too much complexity on one page

**Goal:** Build a true YNAB-style budgeting experience with proactive daily/weekly reports delivered via email and SMS, making budget awareness effortless.

---

## Goals

1. **Zero-Based Budgeting**: Every dollar has a job. "To Be Budgeted" stays at $0.
2. **Proactive Engagement**: Daily and weekly reports keep the user informed without opening the app.
3. **Multi-Channel Delivery**: Email for detailed reports, SMS for quick daily pulse.
4. **Habit Formation**: Regular touchpoints that build financial awareness.
5. **Actionable Insights**: Not just data - recommendations and alerts that drive behavior.

---

## Non-Goals (for v1)

- Multi-user/shared budgets
- Bill pay or money transfers
- Investment tracking
- Debt payoff calculators
- Receipt scanning/OCR

---

## Target User

- **Primary**: JD - wants to maintain budget discipline with minimal daily effort
- **Use Case**: MBA student managing limited income, needs awareness without obsession

---

## Core Features

### 1. Zero-Based Budget Engine (Enhance Existing)

Keep the current YNAB-style category system but simplify the UI:

- **Budget Dashboard**: Clean view of To Be Budgeted, total assigned, total spent
- **Category Groups**: Organize categories (Fixed Expenses, Everyday, True Expenses, Savings Goals)
- **Monthly Assignments**: Assign dollars to categories each month
- **Rollover Logic**: Overspending carries forward, savings accumulate
- **Quick Actions**: Fast category creation, money moves between categories

### 2. Daily Pulse (SMS + Email)

**Delivered:** Every morning at 7:00 AM

**SMS Format (concise):**
```
Budget Pulse - Jan 24
Spent yesterday: $47.23
Today available: $892
Dining: $45 left (3 days)
Groceries: On track
Reply DETAIL for more
```

**Email Format (detailed):**
- Yesterday's transactions with categories
- Per-category burn rate and days remaining
- Recommendations (e.g., "Slow down on Dining - only $45 left for 3 days")
- Link to open Budget app

### 3. Weekly Report (Email + SMS Summary)

**Delivered:** Sunday at 9:00 AM

**Email Report Includes:**
- **Week Summary**: Total income, total spent, net savings
- **Category Breakdown**: Each category with budget vs. actual, variance
- **Trend Analysis**: Comparison to last 4 weeks
- **Top Spending**: Merchants and categories where money went
- **Upcoming**: Bills due next week, expected recurring charges
- **Recommendations**:
  - Categories trending over budget
  - Unassigned money opportunities
  - Savings goal progress
- **Month Progress**: Days left, projected end-of-month position

**SMS Summary:**
```
Weekly Budget Report
Income: $1,200
Spent: $847 (71%)
Saved: $353
Top: Dining $189, Groceries $156
3 categories over pace
Full report in email
```

### 4. Smart Alerts (Enhanced)

Beyond threshold alerts, add contextual notifications:

| Alert Type | Trigger | Channel |
|------------|---------|---------|
| **Threshold Warning** | Category hits 80% | SMS |
| **Overspent** | Category goes negative | SMS + Email |
| **Large Transaction** | Single txn > $100 | SMS |
| **Unusual Spending** | 2x normal daily spend | SMS |
| **Bill Due** | Recurring charge expected tomorrow | SMS |
| **Good News** | Week finished under budget | SMS |
| **Month Complete** | End of month summary | Email |

### 5. Transaction Feed (App)

Improved transaction viewing:

- **Grouped by Day**: Clear daily spending view
- **Quick Categorize**: Tap to assign/change category
- **Split Transactions**: Divide one purchase across categories
- **Notes**: Add context to transactions
- **Search & Filter**: Find past transactions quickly

### 6. Reports & Analytics (App)

New Reports page:

- **Spending Trends**: Line chart of spending over time
- **Category Breakdown**: Pie/bar chart of where money goes
- **Income vs. Expenses**: Monthly comparison
- **Net Worth Tracker**: Simple assets - liabilities view
- **Budget Accuracy**: How well forecasts matched reality

---

## Report Templates

### Daily Email Template

```
Subject: Budget Pulse - January 24, 2026

Good morning!

Yesterday's Spending: $47.23
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Transactions:
• Starbucks          $6.45    → Dining Out
• Amazon             $34.89   → Shopping
• Spotify            $5.89    → Subscriptions

Category Health:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 Groceries        $234 left   (14 days)    On track
🟡 Dining Out       $45 left    (3 days)     Slow down
🟢 Transportation   $89 left    (7 days)     On track
🔴 Shopping         -$12        OVERSPENT

💡 Recommendation: You're spending $15/day on Dining Out
   but only have $45 left. Consider packing lunch for
   the next few days.

[Open Budget App →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To Be Budgeted: $0
January Progress: 77% through month, 68% spent
```

### Weekly Email Template

```
Subject: Weekly Budget Report - Week of Jan 18-24

WEEK IN REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Income This Week:     $1,200.00
💸 Total Spent:          $847.32
📈 Net Savings:          $352.68

CATEGORY BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Category       | Budget | Spent  | Left   | Status |
|---------------|--------|--------|--------|--------|
| Rent          | $1,500 | $1,500 | $0     | ✓ Paid |
| Groceries     | $400   | $156   | $244   | 🟢     |
| Dining Out    | $200   | $189   | $11    | 🟡     |
| Transportation| $150   | $67    | $83    | 🟢     |
| Shopping      | $100   | $112   | -$12   | 🔴     |

TOP MERCHANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Whole Foods       $89.34
2. Chipotle          $52.40
3. Uber              $45.00
4. Amazon            $34.89

TRENDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
vs. Last Week: Spending ↓ 12%
vs. 4-Week Avg: Spending ↓ 8%

Dining is up 23% from your average -
mostly driven by weekday lunches.

NEXT WEEK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Upcoming recurring charges:
• Netflix        $15.99    (Jan 26)
• Gym           $50.00    (Jan 28)

RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Move $12 from Transportation → Shopping to cover overspend
2. Dining Out has $11 left for 7 days - meal prep this week?
3. You have $0 To Be Budgeted - great job assigning every dollar!

[View Full Report →]  [Open Budget App →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
January: 7 days left | 68% of budget spent
Projected end-of-month: +$420 (under budget)
```

---

## Technical Requirements

### Backend (Hub)

#### New Services
- `BudgetReportService` - Generate daily/weekly reports
- `BudgetNotificationService` - Coordinate multi-channel delivery
- `SpendingAnalyticsService` - Calculate trends, anomalies, projections

#### New Scheduled Jobs
| Job | Schedule | Description |
|-----|----------|-------------|
| `daily-budget-pulse` | 7:00 AM | Generate and send daily report |
| `weekly-budget-report` | Sun 9:00 AM | Generate and send weekly report |
| `transaction-sync` | Every 15 min | Fetch new transactions from Plaid |
| `spending-anomaly-check` | Hourly | Detect unusual spending patterns |

#### New API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/finance/reports/daily` | Get today's report data |
| `GET /api/finance/reports/weekly` | Get this week's report data |
| `GET /api/finance/analytics/trends` | Spending trends over time |
| `GET /api/finance/analytics/merchants` | Top merchants analysis |
| `POST /api/finance/preferences` | Update report preferences |
| `GET /api/finance/upcoming` | Upcoming recurring charges |

#### Database Additions
```sql
-- Report preferences
CREATE TABLE budget_report_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  daily_email_enabled BOOLEAN DEFAULT true,
  daily_sms_enabled BOOLEAN DEFAULT true,
  weekly_email_enabled BOOLEAN DEFAULT true,
  weekly_sms_enabled BOOLEAN DEFAULT true,
  daily_time TIME DEFAULT '07:00',
  weekly_day INTEGER DEFAULT 0, -- 0 = Sunday
  weekly_time TIME DEFAULT '09:00',
  large_transaction_threshold INTEGER DEFAULT 10000, -- cents
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Report history (for debugging/replay)
CREATE TABLE budget_reports (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  report_type TEXT NOT NULL, -- 'daily' | 'weekly' | 'monthly'
  report_date DATE NOT NULL,
  data JSONB NOT NULL,
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recurring transaction detection
CREATE TABLE recurring_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  merchant_name TEXT NOT NULL,
  expected_amount_cents INTEGER,
  expected_day INTEGER, -- day of month
  last_seen_at DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Frontend (Command Center)

#### Simplified Budget Page
- Clean dashboard with key metrics
- Category list with visual progress
- Quick money moves
- Recent transactions sidebar

#### New Reports Page
- Daily/weekly report viewer
- Trend charts
- Spending analytics
- Report preferences

#### Settings
- Notification preferences
- Report timing
- Alert thresholds

### Notification Channels

| Channel | Use Case | Provider |
|---------|----------|----------|
| Email | Detailed reports, weekly summaries | Resend |
| SMS | Quick alerts, daily pulse | Twilio |
| Push | Future mobile app | - |

---

## Configuration

Required environment variables (in addition to existing):

```bash
# Report timing (optional, defaults shown)
BUDGET_DAILY_REPORT_TIME=07:00
BUDGET_WEEKLY_REPORT_DAY=0       # 0=Sunday
BUDGET_WEEKLY_REPORT_TIME=09:00

# Thresholds (optional)
BUDGET_LARGE_TXN_THRESHOLD=10000  # cents
BUDGET_ANOMALY_MULTIPLIER=2.0     # 2x normal = unusual
```

---

## Implementation Phases

### Phase 1: Daily Pulse (MVP)
- Daily report generation service
- Email template with transactions + category health
- SMS summary
- Scheduled job at 7 AM
- Basic preferences (enable/disable)

### Phase 2: Weekly Reports
- Weekly report generation
- Trend calculations (vs. last week, vs. average)
- Recurring transaction detection
- Upcoming bills prediction
- Email + SMS delivery

### Phase 3: Smart Alerts
- Large transaction detection
- Unusual spending patterns
- Good news notifications
- Bill due reminders

### Phase 4: Analytics Dashboard
- Reports page in Command Center
- Spending trend charts
- Merchant analysis
- Budget accuracy tracking

### Phase 5: Polish
- Preference management UI
- Report history/archive
- Mobile push notifications
- Export to PDF

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Daily email open rate | > 60% |
| SMS response rate (DETAIL) | > 10% |
| Budget accuracy (forecast vs. actual) | < 10% variance |
| Category overspend frequency | < 2/month |
| "To Be Budgeted" days at $0 | > 25/month |
| Time to categorize new transaction | < 30 seconds |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Report fatigue | Users ignore reports | Smart frequency, make them genuinely useful |
| SMS costs | High volume = high cost | Limit to 1-2 SMS/day, use email for detail |
| Plaid sync delays | Stale data in reports | Clear "as of" timestamps, explain delays |
| Over-alerting | Alert fatigue | Consolidate alerts, smart batching |

---

## Open Questions

1. Should reports be opt-in or opt-out by default?
2. What time zones should we support? (currently assume user's local)
3. Should we support Telegram as a third channel?
4. How do we handle months where income varies significantly?
5. Should categories auto-detect from transaction descriptions?

---

## Appendix: YNAB Feature Comparison

| Feature | YNAB | Current | This PRD |
|---------|------|---------|----------|
| Zero-based budgeting | ✓ | ✓ | ✓ |
| Category groups | ✓ | ✓ | ✓ |
| Rollover | ✓ | ✓ | ✓ |
| Goals/targets | ✓ | ✓ | ✓ |
| Bank sync | ✓ | ✓ | ✓ |
| Mobile app | ✓ | ✗ | Phase 5 |
| Reports | ✓ | Basic | ✓ |
| Age of money | ✓ | ✗ | Phase 4 |
| Daily reports | ✗ | ✗ | ✓ |
| Weekly reports | ✗ | ✗ | ✓ |
| Proactive SMS alerts | ✗ | ✗ | ✓ |
| AI recommendations | ✗ | ✗ | ✓ |
