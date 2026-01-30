# SoSatisfying API

Standalone API service for SoSatisfying.com.

## Required Environment Variables

- `SOS_DATABASE_URL` (Postgres connection string)
- `SOS_API_PORT` (optional, default: 3180)
- `SOS_CORS_ORIGINS` (optional, comma-separated)
- `SOS_SMTP_HOST` (bug report email)
- `SOS_SMTP_PORT` (bug report email)
- `SOS_SMTP_USER` (bug report email)
- `SOS_SMTP_PASS` (bug report email)
- `SOS_SMTP_FROM` (optional, defaults to bugs@sosatisfying.com)
- `SOS_BUG_REPORT_TO` (optional, defaults to jddavenport46@gmail.com)

## Local Setup

1. Create a new Postgres database for SoSatisfying.
2. Apply the migration in `migrations/0001_sosatisfying_core.sql` or run `bun run migrate`.
3. Start the API:

```bash
bun run dev
```

## Public Ad API (for external integrations)

- `GET /api/v1/sosatisfying/public/ad-spaces`
- `GET /api/v1/sosatisfying/public/ads/:placement`

## Quickstart with Docker

```bash
docker compose up -d
```

Use this connection string:

```
postgresql://sosatisfying:sosatisfying@localhost:5542/sosatisfying
```

## Seed Data

```bash
bun run seed
```
