# Product Requirements Document: Gadz.io Ad Exchange Agent

## Executive Summary

An autonomous agent system for managing a decentralized advertising exchange where ad space ownership and advertiser allocations are tokenized, tradeable assets with automated contract enforcement and revenue distribution.

## Product Vision

Gadz.io transforms digital advertising into a liquid marketplace where ad space operates like real estate - owners lease their properties (impressions) to advertisers through smart contracts, creating passive income streams while advertisers gain predictable, allocated impression access. The agent orchestrates the entire ecosystem, managing contracts, enforcement, payments, and market dynamics.

## Core Entities & Relationships

### Ad Space

- **Owner**: Current holder of ad space contract
- **Creator**: Original ad space publisher (receives perpetual revenue share)
- **Properties**:
  - Total available impressions per period (week)
  - Current reserve price
  - Performance metrics (views, clicks, CTR)
  - Contract terms
  - Historical pricing data

### Ad Space Contract

- **Ownership Transfer Price**: One-time payment to acquire ownership
- **Weekly Holding Fee**: Required payment to maintain ownership
- **Creator Revenue Share**: % of sale price + % of weekly fees → creator
- **Payment Enforcement**: Auto-reversion to previous owner on non-payment
- **Contract Flexibility**: Custom terms beyond base requirements

### Advertiser Allocation

- **Unit**: 1/8th of total impressions (12.5% allocation)
- **Owner**: Current holder of allocation contract
- **Properties**:
  - Number of units owned (1-8 per ad space)
  - Weekly fee per unit
  - Creative assets
  - Performance data

### Advertiser Contract

- **Acquisition Price**: One-time payment for allocation unit(s)
- **Weekly Fee**: Required payment to maintain allocation
- **Revenue Distribution**:
  - Majority → current ad space owner
  - Small % → original ad space creator
- **Payment Enforcement**: Auto-reversion to previous allocation owner

## Agent System Architecture

### 1. Market Intelligence Agent

**Responsibilities:**

- Real-time monitoring of all ad spaces and allocations
- Price discovery and trend analysis
- Performance analytics across the network
- Anomaly detection (unusual pricing, suspicious activity)
- Market opportunity identification

**Capabilities:**

- Multi-dimensional data aggregation (views, clicks, pricing, ownership changes)
- Predictive modeling for ad space valuation
- Network health monitoring
- Automated reporting and alerts

### 2. Contract Enforcement Agent

**Responsibilities:**

- Weekly payment verification for all active contracts
- Automated ownership reversion on non-payment
- Contract state management
- Payment routing and distribution
- Grace period management (configurable)

**Capabilities:**

- Scheduled batch processing of payment checks
- Multi-signature wallet integration
- Transaction logging and audit trails
- Dispute resolution workflow triggers
- Emergency circuit breakers

### 3. Marketplace Operations Agent

**Responsibilities:**

- Ad space listing management
- Bid/ask matching for ownership transfers
- Allocation trading facilitation
- Price validation against reserve prices
- Transaction settlement

**Capabilities:**

- Order book management
- Automated market making (optional)
- Transaction batching for gas optimization
- Liquidity incentive programs
- Fee calculation and collection

### 4. Creative & Delivery Agent

**Responsibilities:**

- Ad creative storage and validation
- Impression allocation calculation
- Real-time ad serving decisions
- Performance tracking (views, clicks)
- Creative rotation and testing

**Capabilities:**

- CDN integration for creative assets
- Impression counting and verification
- Click fraud detection
- A/B testing framework
- Delivery optimization algorithms

### 5. Analytics & Insights Agent

**Responsibilities:**

- Dashboard data aggregation
- Performance reporting
- ROI calculation for advertisers
- Yield optimization for ad space owners
- Network-wide statistics

**Capabilities:**

- Real-time metric computation
- Historical trend analysis
- Comparative benchmarking
- Custom report generation
- Data export functionality

## Database Schema

```sql
-- Ad Spaces
CREATE TABLE ad_spaces (
    id UUID PRIMARY KEY,
    creator_address TEXT NOT NULL,
    current_owner_address TEXT NOT NULL,
    previous_owner_address TEXT,

    -- Inventory
    weekly_impressions BIGINT NOT NULL,

    -- Pricing
    current_reserve_price DECIMAL(18,8) NOT NULL,
    ownership_transfer_price DECIMAL(18,8),
    weekly_holding_fee DECIMAL(18,8) NOT NULL,

    -- Contract Terms
    creator_sale_share_percent DECIMAL(5,2) NOT NULL, -- e.g., 5.00 = 5%
    creator_fee_share_percent DECIMAL(5,2) NOT NULL,
    custom_contract_terms JSONB,

    -- Metadata
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    tags TEXT[],

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ownership_acquired_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    next_payment_due TIMESTAMPTZ
);

-- Advertiser Allocations
CREATE TABLE advertiser_allocations (
    id UUID PRIMARY KEY,
    ad_space_id UUID REFERENCES ad_spaces(id),

    -- Ownership
    current_owner_address TEXT NOT NULL,
    previous_owner_address TEXT,

    -- Allocation
    allocation_units INTEGER NOT NULL CHECK (allocation_units >= 1 AND allocation_units <= 8),
    impressions_per_week BIGINT NOT NULL, -- calculated: ad_space.weekly_impressions * (allocation_units / 8)

    -- Pricing
    acquisition_price DECIMAL(18,8),
    weekly_fee DECIMAL(18,8) NOT NULL,

    -- Creative
    creative_asset_urls TEXT[],
    click_through_url TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    allocation_acquired_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    next_payment_due TIMESTAMPTZ
);

-- Payment History
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('ad_space_ownership', 'ad_space_weekly_fee', 'allocation_acquisition', 'allocation_weekly_fee')),

    -- References
    ad_space_id UUID REFERENCES ad_spaces(id),
    allocation_id UUID REFERENCES advertiser_allocations(id),

    -- Transaction
    payer_address TEXT NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    transaction_hash TEXT,

    -- Revenue Distribution
    revenue_distribution JSONB, -- {"ad_space_owner": 0.95, "creator": 0.05}

    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'reverted')),

    -- Timestamps
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ownership Transfer Events
CREATE TABLE ownership_transfers (
    id UUID PRIMARY KEY,
    transfer_type TEXT NOT NULL CHECK (transfer_type IN ('ad_space', 'allocation')),

    -- References
    ad_space_id UUID REFERENCES ad_spaces(id),
    allocation_id UUID REFERENCES advertiser_allocations(id),

    -- Transfer Details
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    transfer_price DECIMAL(18,8),
    reason TEXT NOT NULL CHECK (reason IN ('sale', 'non_payment_reversion', 'initial_creation')),

    -- Transaction
    transaction_hash TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY,
    ad_space_id UUID REFERENCES ad_spaces(id),
    allocation_id UUID REFERENCES advertiser_allocations(id),

    -- Time Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Metrics
    impressions_delivered BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr DECIMAL(5,4), -- click-through rate

    -- Revenue (for ad space owners)
    revenue_generated DECIMAL(18,8),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(ad_space_id, allocation_id, period_start)
);

-- Market Listings
CREATE TABLE market_listings (
    id UUID PRIMARY KEY,
    listing_type TEXT NOT NULL CHECK (listing_type IN ('ad_space', 'allocation')),

    -- References
    ad_space_id UUID REFERENCES ad_spaces(id),
    allocation_id UUID REFERENCES advertiser_allocations(id),

    -- Listing Details
    seller_address TEXT NOT NULL,
    ask_price DECIMAL(18,8) NOT NULL,
    min_price DECIMAL(18,8), -- reserve price

    -- Status
    status TEXT NOT NULL CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),

    -- Timestamps
    listed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_ad_spaces_owner ON ad_spaces(current_owner_address);
CREATE INDEX idx_ad_spaces_creator ON ad_spaces(creator_address);
CREATE INDEX idx_ad_spaces_active ON ad_spaces(is_active) WHERE is_active = true;
CREATE INDEX idx_allocations_ad_space ON advertiser_allocations(ad_space_id);
CREATE INDEX idx_allocations_owner ON advertiser_allocations(current_owner_address);
CREATE INDEX idx_payments_due ON payments(due_date, status) WHERE status = 'pending';
CREATE INDEX idx_performance_period ON performance_metrics(period_start, period_end);
CREATE INDEX idx_listings_active ON market_listings(status) WHERE status = 'active';
```

## User Interface: Ad Exchange Dashboard

### Main Grid View

**Sortable/Filterable Columns:**

- Ad Space Name
- Category/Tags
- Weekly Impressions
- Current Reserve Price
- Allocation Units Available (x/8)
- Total Views (period)
- Total Clicks (period)
- CTR %
- Current Owner
- Creator
- Yield (weekly revenue)
- Status (active, payment pending, etc.)

**Filtering Options:**

- Price range
- Impression volume
- Performance metrics (CTR, views)
- Availability (allocation units)
- Category/tags
- Owner/creator address

### Detail View (Drill-down)

**Ad Space Details Tab:**

- Full contract terms
- Ownership history
- Price history chart
- Performance trends (30/60/90 day)
- Current allocations breakdown
- Revenue distribution visualization

**Advertiser Allocations Tab:**

- List of current allocations (1-8 units)
- Per-allocation performance
- Creative preview
- Allocation owner details
- Weekly fee schedule

**Market Activity Tab:**

- Recent ownership transfers
- Active listings
- Bid/ask spread
- Trading volume

**Analytics Tab:**

- ROI calculators
- Comparative benchmarks
- Predictive pricing models
- Market positioning

## Agent Workflows

### Weekly Payment Enforcement Cycle

```
Every Monday 00:00 UTC:
1. Contract Enforcement Agent queries all active contracts
2. Check payment status for previous week
3. For each unpaid contract:
   a. Grace period check (configurable: 24-72 hours)
   b. Notification to current owner
   c. If grace period expired:
      - Trigger ownership reversion
      - Update ad_spaces/allocations table
      - Create ownership_transfer event
      - Notify previous owner of reacquisition
      - Notify current owner of loss
4. Process successful payments:
   a. Calculate revenue distribution
   b. Execute transfers
   c. Log payment records
   d. Update next_payment_due
5. Generate weekly enforcement report
```

### New Ad Space Listing Workflow

```
1. Creator submits ad space details:
   - Impression inventory
   - Reserve price
   - Creator revenue share terms
   - Custom contract terms
2. Market Intelligence Agent validates:
   - Pricing reasonableness
   - Inventory verification
   - Contract term compliance
3. Marketplace Operations Agent:
   - Creates ad_space record
   - Sets creator as initial owner
   - Generates listing
4. Analytics Agent:
   - Establishes baseline metrics
   - Calculates initial valuation
```

### Advertiser Allocation Purchase Workflow

```
1. Advertiser selects ad space + allocation units
2. Marketplace Operations Agent:
   - Verifies availability (≤8 units total)
   - Calculates weekly impressions allocation
   - Validates payment
3. Contract creation:
   - Create advertiser_allocation record
   - Set payment schedule
   - Link creative assets
4. Creative & Delivery Agent:
   - Validates creative assets
   - Schedules impression delivery
5. Analytics Agent:
   - Initializes performance tracking
```

### Market-Making & Liquidity Operations

```
Optional automated market-making:
1. Market Intelligence Agent identifies:
   - Underpriced ad spaces
   - High-performing allocations with low ownership turnover
2. Marketplace Operations Agent:
   - Creates strategic bid offers
   - Manages house inventory
   - Provides liquidity during low-volume periods
3. Risk management:
   - Position limits per category
   - Automated exit strategies
   - Revenue targets
```

## Revenue Model

**Platform Fees:**

- 2.5% of all ownership transfer sales
- 1% of weekly allocation fees
- Premium analytics subscriptions
- Market-making spread capture

**Fee Distribution:**

- 40% → Platform operational costs
- 30% → Agent infrastructure & development
- 20% → Liquidity incentives
- 10% → Treasury/reserves

## Technical Stack Recommendations

**Backend:**

- PostgreSQL with TimescaleDB extension (time-series data)
- pgvector for similarity search (ad matching)
- Redis for caching and real-time data
- Message queue (RabbitMQ/Kafka) for agent communication

**Agent Framework:**

- Python with asyncio for concurrent operations
- APScheduler for scheduled tasks
- Web3.py for blockchain integration
- Pandas/NumPy for analytics

**Frontend:**

- React + AG Grid for high-performance data grid
- Chart.js/D3.js for visualizations
- WebSocket for real-time updates
- TanStack Query for data fetching

**Infrastructure:**

- Docker containerization
- Kubernetes orchestration
- Prometheus/Grafana monitoring
- ELK stack for logging

## Security & Compliance

**Payment Security:**

- Multi-signature wallets for large transfers
- Automated fraud detection
- Rate limiting on transactions
- Cold storage for platform treasury

**Data Protection:**

- Encrypted wallet addresses at rest
- Audit logs for all ownership changes
- GDPR compliance for user data
- Regular security audits

**Contract Safety:**

- Formal verification of critical logic
- Emergency pause mechanisms
- Governance for contract upgrades
- Insurance fund for critical failures

## Success Metrics

**Platform Health:**

- Total ad spaces listed
- Total impressions under management
- Active advertiser allocations
- Weekly transaction volume
- Average payment compliance rate (target: >95%)

**Market Efficiency:**

- Average time to allocation purchase
- Bid/ask spread compression
- Price discovery accuracy
- Liquidity depth

**User Satisfaction:**

- Ad space owner yield rates
- Advertiser ROI
- Platform uptime (target: 99.9%)
- Customer support resolution time

## Phased Implementation

### Phase 1: Core Infrastructure (Weeks 1-4)

- Database schema implementation
- Contract Enforcement Agent MVP
- Basic marketplace operations
- Simple UI grid with sorting/filtering

### Phase 2: Market Operations (Weeks 5-8)

- Full Marketplace Operations Agent
- Creative & Delivery Agent
- Payment processing integration
- Advanced filtering and search

### Phase 3: Intelligence Layer (Weeks 9-12)

- Market Intelligence Agent
- Analytics & Insights Agent
- Predictive pricing models
- Performance dashboards

### Phase 4: Optimization & Scale (Weeks 13-16)

- Automated market making
- Advanced analytics
- Mobile-responsive UI
- Load testing and optimization

### Phase 5: Advanced Features (Weeks 17+)

- Cross-ad-space bundling
- Programmatic buying APIs
- Yield optimization tools
- Governance mechanisms

## Open Design Decisions for Agent Autonomy

**Agent Decision Authority:**

1. Should Market Intelligence Agent auto-adjust reserve prices based on demand?
2. Can Marketplace Agent auto-match buyers/sellers at market price?
3. Should agents have treasury allocation for strategic market interventions?
4. Degree of autonomy in fraud/abuse enforcement vs. human oversight

**Recommendation:** Start with conservative automation (monitoring + alerts) → gradually increase autonomy based on proven performance and governance approval.
