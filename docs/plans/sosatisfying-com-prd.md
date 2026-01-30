# Product Requirements Document: SoSatisfying.com

## 1. Executive Summary

**Product Name:** SoSatisfying.com

**Product Vision:** A community-driven content platform inspired by old Reddit's simplicity and functionality, where users curate and share satisfying content across niche interest groups, monetized through the Gadz.io advertising model.

**Target Audience:** Content curators, niche hobbyists, collectors, and anyone who finds joy in organizing and sharing satisfying content (ASMR videos, oddly satisfying clips, perfect fits, clean aesthetics, craftsmanship, etc.)

**Core Value Proposition:** Simple, distraction-free interface for discovering and curating deeply satisfying content across specialized communities, with fair monetization for both creators and the platform.

---

## 2. Product Goals & Success Metrics

### Primary Goals
1. Build a thriving community around "satisfying" content curation
2. Create sustainable revenue through Gadz.io ad integration
3. Establish simple, friction-reduced user onboarding
4. Foster quality content over viral engagement metrics

### Success Metrics
- **User Engagement:** Daily active users, time on site, content interactions
- **Community Health:** Number of active groups, posts per group, user retention
- **Monetization:** Ad impressions, click-through rates, revenue per user
- **Content Quality:** Upvote ratio, content flagging rate, group subscriber growth

---

## 3. User Personas

### Primary Personas

**The Curator (Power User)**
- Creates and moderates groups around niche satisfying topics
- Posts 3-5x per week with high-quality content
- Values customization and moderation tools
- Motivated by community building and recognition

**The Browser (Casual User)**
- Visits for stress relief and entertainment
- Upvotes/downvotes but rarely comments
- Subscribes to 5-10 groups
- Values simple, fast interface

**The Contributor (Active Member)**
- Posts occasionally to groups they follow
- Engages with comments and discussions
- Values ease of content submission
- Motivated by community appreciation

---

## 4. Core Features & Functionality

### 4.1 Authentication & Account Management

**Account Creation (Shared System)**
- Unified account system across SoSatisfying.com, Gadz.io, and ProofOfWork.info
- Email + password registration
- Email verification required
- Optional: Google/GitHub OAuth integration for convenience
- Profile creation: username, bio, avatar
- Privacy settings: public/private profile, content visibility

**Wallet Connection (Gadz.io Only)**
- Wallet connection only required for Gadz.io features
- SoSatisfying.com and ProofOfWork.info operate without wallet requirement
- Optional wallet linking for future monetization features

### 4.2 Home Page (Feed)

**Classic Reddit-Style Layout**
- Top navigation: Logo, search bar, create post button, user menu
- Left sidebar: Subscribed groups, trending groups, create group button
- Main feed: Hot/New/Top (hour/day/week/month/all time) sorting
- Right sidebar: Rules, group discovery, trending posts

**Post Card Design**
- Thumbnail preview (for images/videos)
- Title (max 300 characters)
- Group name and author
- Upvote/downvote count and arrows
- Comment count
- Age of post
- Tag indicators (21+, OC, etc.)

### 4.3 Groups (Subreddit Equivalent)

**Group Creation**
- Any authenticated user can create a group
- Required fields:
  - Group name (unique, lowercase, alphanumeric + hyphens)
  - Display title
  - Description (max 500 characters)
  - Category selection (from predefined list)
  - Content rating (All ages / 21+)
- Optional fields:
  - Custom rules (max 10 rules)
  - Banner image
  - Icon/avatar
  - Related groups

**Group Settings & Moderation**
- Creator becomes default moderator
- Moderator abilities:
  - Add/remove additional moderators
  - Edit group description and rules
  - Remove posts/comments
  - Ban users from group
  - Set post approval requirements
  - Pin posts
  - Create custom post flairs

**Group Discovery**
- Browse by category
- Search by keyword
- Trending groups (based on subscriber growth)
- Recommended groups (based on user subscriptions)

### 4.4 Content Posting

**Supported Content Types**
1. **Link Posts:** External URLs (YouTube, Imgur, Vimeo, etc.)
2. **Image Posts:** Direct upload (JPG, PNG, GIF, WEBP - max 20MB)
3. **Video Posts:** Direct upload (MP4, WEBM - max 100MB, 2min duration)
4. **Text Posts:** Rich text editor with markdown support
5. **Gallery Posts:** Multiple images (up to 20 images)

**Post Creation Flow**
1. Select group (dropdown of subscribed + all groups)
2. Choose content type
3. Add title (required, 10-300 characters)
4. Upload/link content
5. Add optional flair (if group has flairs)
6. Add optional description (markdown supported)
7. Mark as 21+ if applicable (overrides group default)
8. Mark as OC (Original Content) checkbox
9. Preview before posting
10. Submit

**Post Requirements**
- Must belong to a group (no groupless posts)
- Title must be descriptive
- Content must load/be accessible
- Must comply with platform rules
- 21+ content must be marked appropriately

### 4.5 Voting & Engagement

**Voting System**
- Upvote/downvote on posts and comments
- Score = upvotes - downvotes (displayed publicly)
- Vote fuzzing for spam prevention (slight randomization)
- Users cannot vote on own content
- Vote history stored but private

**Comments**
- Threaded comment system (Reddit-style)
- Markdown support
- Reply, edit, delete functionality
- Upvote/downvote on comments
- Sort by: Best, New, Top, Controversial
- Comment depth limit: 10 levels
- Collapse/expand comment trees

**Sharing**
- Native share button: Copy link, Reddit, Twitter, Facebook
- Embed code generation for posts
- Cross-post to other groups (with attribution)

### 4.6 Content Moderation

**Age Restriction System**
- 21+ content groups have prominent warnings
- First visit to 21+ group requires age confirmation
- Age confirmation stored in user preferences
- 21+ badge on posts/groups
- Default: All-ages content

**Content Policies**
- **Prohibited Content:**
  - Pornography/sexually explicit content
  - Illegal content
  - Harassment/doxxing
  - Spam/malicious links
  - Copyright violations
  - Misinformation designed to harm
- **Moderation Tools:**
  - User reporting system (spam, rule violation, inappropriate)
  - Automated content filtering (NSFW detection for non-21+ content)
  - Moderator queue for reported content
  - Platform admin override for severe violations

**User Consequences**
- Warning system (3 strikes)
- Temporary bans (group-level or platform-level)
- Permanent bans for severe violations
- Appeal process through contact form

### 4.7 User Profiles

**Public Profile Elements**
- Username and avatar
- Join date
- Post karma and comment karma (separate)
- Bio (max 300 characters)
- Posts tab (user's submissions)
- Comments tab (user's comment history)
- Groups tab (moderated/created groups)
- Awards/badges (future feature)

**Private Profile Elements**
- Email address
- Saved posts
- Hidden posts
- Upvoted/downvoted history
- Blocked users list
- Notification preferences

### 4.8 Search & Discovery

**Search Functionality**
- Global search bar in header
- Search scope: Posts, Groups, Users
- Advanced filters:
  - Time range (hour/day/week/month/year/all)
  - Content type (image/video/link/text)
  - Group filter
  - Sort by relevance/score/new

**Trending Algorithm**
- Weighted score: `(upvotes - downvotes) / (time_decay_factor)`
- Boost for: Comment activity, cross-posts, external shares
- Decay: Exponential over 24-48 hours
- Category-specific trending (optional)

---

## 5. Gadz.io Ad Integration

### Ad Placement Strategy

**Old Reddit-Inspired Placements**
1. **Banner Ad (Top):** 728x90 leaderboard above feed
2. **Sidebar Ad (Right):** 300x250 medium rectangle in right sidebar
3. **In-Feed Native Ads:** Every 5-7 posts, styled as post cards with "Sponsored" label
4. **Bottom Sidebar:** 300x600 half-page ad (optional, lower priority)

**Ad Loading & Performance**
- Lazy loading for in-feed ads (load as user scrolls)
- Ad refresh on page navigation (SPA routing)
- Maximum 3 ad units per page load (avoid clutter)
- Ad blockers: Graceful degradation, non-intrusive message

**Gadz.io Integration Technical Specs**
- Gadz.io JavaScript SDK embedded in base template
- Ad unit divs with unique IDs per placement
- Revenue attribution: Platform (80%), Group creator (20% split for ads on group pages)
- Analytics dashboard: Impressions, clicks, revenue by group/user

### User Ad Experience
- Clearly labeled "Sponsored" content
- No auto-play video ads with sound
- Skip interstitial ads on initial load
- Respect "reduced motion" preferences
- No pop-ups or overlays

---

## 6. Technical Architecture

### 6.1 Tech Stack Recommendation

**Frontend**
- **Framework:** Next.js 14+ (React, App Router)
- **Styling:** Tailwind CSS (for old Reddit aesthetic with modern touches)
- **State Management:** Zustand or React Query
- **Real-time:** WebSocket (for live comment updates)

**Backend**
- **API:** Next.js API routes OR standalone Express.js/Fastify
- **Database:** PostgreSQL (aligned with JD Agent ecosystem)
- **Cache:** Redis (for hot posts, trending calculations)
- **File Storage:** S3-compatible (AWS S3, Cloudflare R2, Backblaze B2)
- **CDN:** Cloudflare for image/video delivery

**Authentication**
- **Shared Auth Service:** JWT-based authentication shared across SoSatisfying, Gadz.io, ProofOfWork
- **Session Storage:** Redis-backed sessions
- **Password Security:** Bcrypt hashing, rate limiting on login

**Content Moderation**
- **Image Moderation:** AWS Rekognition or Google Cloud Vision API (NSFW detection)
- **Text Moderation:** OpenAI Moderation API or custom keyword filtering
- **Manual Review Queue:** Admin dashboard for flagged content

### 6.2 Database Schema (Core Tables)

```sql
-- Users (shared across platforms)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    email_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    age_verified_21plus BOOLEAN DEFAULT FALSE
);

-- Groups (subreddit equivalent)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- URL-safe name
    display_title VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_21plus BOOLEAN DEFAULT FALSE,
    banner_url TEXT,
    icon_url TEXT,
    creator_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    subscriber_count INTEGER DEFAULT 0,
    rules JSONB -- Array of rule objects
);

-- Posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL,
    content_type VARCHAR(20) NOT NULL, -- 'link', 'image', 'video', 'text', 'gallery'
    content_url TEXT, -- For link/image/video
    content_text TEXT, -- For text posts
    thumbnail_url TEXT,
    is_21plus BOOLEAN DEFAULT FALSE,
    is_oc BOOLEAN DEFAULT FALSE,
    flair VARCHAR(50),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE
);

-- Comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    depth INTEGER DEFAULT 0 -- For limiting nesting
);

-- Votes (deduplicated)
CREATE TABLE votes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    vote_type SMALLINT NOT NULL, -- 1 for upvote, -1 for downvote
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, COALESCE(post_id, comment_id)),
    CHECK ((post_id IS NULL) != (comment_id IS NULL)) -- Exactly one must be set
);

-- Subscriptions
CREATE TABLE subscriptions (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

-- Moderators
CREATE TABLE moderators (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    permissions JSONB, -- Array of permission strings
    PRIMARY KEY (user_id, group_id)
);

-- Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, actioned
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ad Revenue (for group creators)
CREATE TABLE ad_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    revenue_cents INTEGER DEFAULT 0, -- Store in cents to avoid float issues
    creator_share_cents INTEGER DEFAULT 0,
    UNIQUE(group_id, date)
);
```

### 6.3 Key Indexes
```sql
-- Performance optimization
CREATE INDEX idx_posts_group_created ON posts(group_id, created_at DESC);
CREATE INDEX idx_posts_score ON posts((upvotes - downvotes) DESC);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
```

---

## 7. User Flows

### 7.1 New User Journey
1. Land on homepage (sees trending posts from all groups)
2. Browse without account (can view posts/comments, cannot interact)
3. Click "Sign Up" in header
4. Enter email, username, password
5. Receive verification email
6. Click verification link -> redirected to home feed
7. See onboarding tooltip: "Subscribe to groups to customize your feed"
8. Browse group directory, subscribe to 3-5 groups
9. Feed updates to show subscribed content
10. Make first post or comment

### 7.2 Content Creator Journey
1. Navigate to group directory
2. Click "Create Group"
3. Fill out group creation form
4. Submit -> redirected to new group page
5. See empty group with prompt to "Make your first post"
6. Create inaugural post with group rules/welcome message
7. Share group link on social media
8. Moderate incoming posts and comments
9. View ad revenue dashboard (future feature)

### 7.3 Daily User Journey
1. Visit sosatisfying.com (already logged in)
2. See personalized feed of subscribed groups
3. Scroll through posts, upvote satisfying content
4. Click into post to read comments
5. Leave a comment or reply to existing thread
6. Discover new group via trending sidebar
7. Subscribe to new group
8. Create post in favorite group
9. Check notifications for comment replies
10. Log out or close tab

---

## 8. Design System & UI Guidelines

### 8.1 Visual Design Philosophy
- **Inspiration:** Old Reddit's utilitarian design (circa 2010-2018)
- **Modernization:** Clean typography, improved spacing, subtle shadows
- **Color Palette:**
  - Primary: `#FF4500` (Orange-red, Reddit-inspired)
  - Background: `#FFFFFF` (Light mode), `#1A1A1B` (Dark mode)
  - Text: `#222222` (Light mode), `#D7DADC` (Dark mode)
  - Accent: `#0079D3` (Blue for links)
  - Upvote: `#FF4500`, Downvote: `#7193FF`

### 8.2 Component Specifications

**Post Card**
```
┌─────────────────────────────────────────────┐
│ ↑ 234 [Thumbnail] Title of the post        │
│ ↓     └─ 150x150  Submitted 3 hours ago to │
│           preview r/oddlysatisfying by u/... │
│                   💬 45 comments | Share    │
└─────────────────────────────────────────────┘
```

**Navigation Bar**
- Height: 56px
- Logo (left), Search bar (center), User menu (right)
- Sticky on scroll
- Transparent overlay when sidebar menu open (mobile)

**Sidebar**
- Width: 300px (desktop), hidden on mobile (hamburger menu)
- Sections: Subscribed Groups (scrollable), Trending, Create Group button
- Light background, 1px border

### 8.3 Responsive Breakpoints
- **Mobile:** < 768px (single column, hamburger menu)
- **Tablet:** 768px - 1024px (two columns, collapsible sidebar)
- **Desktop:** > 1024px (three columns: sidebar, feed, ads)

---

## 9. Monetization Strategy

### 9.1 Revenue Streams

**Primary: Gadz.io Advertising**
- 80% platform revenue, 20% to group creators (for ads on group pages)
- Minimum payout threshold: $50 for creator payouts
- Monthly revenue reports for group moderators

**Future: Premium Membership** (Optional)
- Ad-free browsing
- Custom themes/badges
- Exclusive features (e.g., saved folders, advanced filters)
- Price: $3.99/month or $39.99/year

**Future: Tipping/Donations**
- Direct support for content creators
- Integrated with wallet (requires Gadz.io wallet connection)
- Platform fee: 5%

### 9.2 Creator Incentives
- Revenue sharing dashboard showing:
  - Total ad impressions on your groups
  - Estimated earnings (updated daily)
  - Top-performing posts/groups
- Quarterly creator leaderboard with recognition badges
- Exclusive creator events/AMAs

---

## 10. Launch Strategy

### Phase 1: MVP (Months 1-2)
**Core Features:**
- User authentication (email/password)
- Group creation and basic moderation
- Post creation (link, image, text only)
- Voting system
- Comments (basic, no threading yet)
- Homepage feed (Hot/New sorting)
- Basic search (groups and posts)

**Excluded from MVP:**
- Video uploads (use external links initially)
- Ad integration (focus on user growth)
- Advanced moderation tools
- Revenue sharing
- Mobile app

### Phase 2: Growth (Months 3-4)
**Added Features:**
- Threaded comments with advanced sorting
- Video upload support
- Gallery posts
- Gadz.io ad integration (limited placements)
- Group customization (banners, rules, flairs)
- User profiles (karma, post/comment history)
- Dark mode

### Phase 3: Monetization (Months 5-6)
**Added Features:**
- Full Gadz.io ad rollout (all placements)
- Revenue sharing dashboard for creators
- Advanced moderation tools (auto-mod, reports queue)
- Content moderation AI integration
- Premium membership tier
- Mobile-responsive improvements

### Phase 4: Scale (Months 7+)
**Added Features:**
- Native mobile apps (iOS/Android)
- Creator tools (analytics, scheduling)
- Wallet integration for tipping
- API for third-party integrations
- Multi-language support

---

## 11. Success Criteria & KPIs

### Launch Success (Month 1)
- 1,000 registered users
- 50 active groups
- 500 posts created
- 2,000 comments
- 50% user retention (return within 7 days)

### Growth Milestones (Month 6)
- 50,000 registered users
- 500 active groups (>10 posts/week)
- 100,000 total posts
- 500,000 total comments
- $5,000 monthly ad revenue

### Long-term Vision (Year 1)
- 250,000 registered users
- 2,500 active groups
- 1M+ total posts
- $50,000 monthly ad revenue
- 5+ creator success stories (earning >$500/month)

---

## 12. Risk Mitigation

### Technical Risks
- **CDN costs for media:** Implement aggressive caching, image optimization (WebP conversion), storage tier policies (archive old content)
- **Database scaling:** Implement read replicas, partition hot tables (posts, comments) by date
- **Spam/abuse:** Rate limiting, CAPTCHA on signup, automated content filtering

### Business Risks
- **Low ad revenue:** Diversify with premium memberships, sponsored groups, affiliate partnerships
- **Toxic communities:** Clear content policies, empowered moderators, platform admin oversight
- **Competitor threats:** Focus on niche (satisfying content), superior UX, creator revenue sharing

### Legal Risks
- **Copyright infringement:** DMCA takedown process, automated detection for known copyrighted content
- **User-generated content liability:** Section 230 protections (US), GDPR compliance (EU), age verification for 21+ content
- **Terms of Service:** Clear policies on prohibited content, ban procedures, data usage

---

## 13. Open Questions for Stakeholder Review

1. **Branding:** Should the logo/mascot evoke satisfaction (e.g., smooth curves, ASMR aesthetics)?
2. **Moderation:** Should platform admins pre-approve new groups to prevent spam?
3. **Content Quality:** Implement minimum karma requirements for posting (anti-spam measure)?
4. **Cross-posting:** Allow users to cross-post to multiple groups simultaneously?
5. **Awards System:** Introduce Reddit-style awards/coins for tipping content creators?
6. **API Access:** Provide public API for third-party apps/bots from day one?

---

## 14. Appendices

### A. Content Categories (Initial Set)
- Oddly Satisfying
- ASMR
- Perfect Fits
- Craftsmanship
- Clean & Organized
- Nature & Patterns
- Food Prep
- Power Washing
- Time Lapses
- Miniatures
- Restoration

### B. Sample Group Rules Template
1. All posts must be satisfying in nature
2. No reposts from top 100 all-time
3. Credit original creators when possible
4. No spam or self-promotion without mod approval
5. Be respectful in comments
6. NSFW content must be marked (if 21+ group)

### C. Moderation Action Types
- Remove post/comment
- Lock comment thread
- Ban user (temp/permanent, group/platform)
- Pin post to top of group
- Mark post as announcement
- Add removal reason (template system)

---

## 15. Implementation Handoff Notes

### Priority Order
1. **Authentication system** (shared across platforms) -> foundational
2. **Database schema** -> set up core tables with indexes
3. **Group creation & management** -> enable community building
4. **Post creation (link/image/text)** -> content flywheel
5. **Feed & sorting algorithms** -> user engagement
6. **Voting system** -> content quality
7. **Comments** -> community interaction
8. **Search** -> discovery
9. **Gadz.io integration** -> monetization

### Code Style Preferences
- **Framework:** Next.js 14 with App Router (TypeScript)
- **Database:** Use Drizzle ORM or Prisma for type-safety
- **API Design:** RESTful endpoints under `/api/v1/` namespace
- **Testing:** Jest for unit tests, Playwright for E2E
- **Deployment:** Vercel for frontend, Neon/Supabase for Postgres

### Environment Variables Template
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sosatisfying

# Auth
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# File Storage
S3_BUCKET=sosatisfying-media
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
CDN_URL=https://cdn.sosatisfying.com

# External Services
GADZ_IO_API_KEY=your-gadz-api-key
AWS_REKOGNITION_KEY=your-rekognition-key

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-key
```

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Status:** Ready for Development
