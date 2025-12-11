# Changelog

All notable changes to pNode Pulse will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Infrastructure Improvements (2025-12-09)
- **Docker Networking**: Explicit network definition for better service isolation
  - All services now explicitly join `pnode-pulse-net` bridge network
  - Better DNS resolution between containers
  - Improved multi-project isolation on shared VPS
  - Clearer container communication patterns

- **Database Backup Strategy**: Comprehensive backup and restore procedures
  - Automated daily backups with 30-day retention (`scripts/backup-db.sh`)
  - Safe restore procedure with confirmation prompts (`scripts/restore-db.sh`)
  - PostgreSQL custom format with level 9 compression
  - Backup verification and old backup cleanup
  - Disaster recovery procedures documented (`docs/DATABASE_BACKUP.md`)
  - S3 off-site backup support (optional)

- **Operations Runbook**: Complete deployment and operations guide
  - Automated and manual deployment procedures (`docs/RUNBOOK.md`)
  - Blue/green deployment strategy
  - Rollback procedures (application and database)
  - Comprehensive troubleshooting guides
  - Emergency response procedures
  - Monitoring and health check procedures
  - Maintenance task schedules (weekly/monthly/quarterly)

- **APM & Error Tracking**: Production monitoring setup guide
  - Sentry integration instructions (`docs/APM_SETUP.md`)
  - Client and server-side error capturing
  - Performance monitoring configuration
  - Source map upload for readable stack traces
  - Alert configuration (error spikes, new errors, performance)
  - Cost management and best practices
  - Alternative APM services comparison

### Legal & Compliance

- **Privacy Policy**: GDPR/CCPA compliant privacy documentation
  - Comprehensive data collection disclosure (`docs/PRIVACY_POLICY.md`)
  - User rights (access, deletion, portability, objection)
  - Data retention policies and schedules
  - Third-party service transparency
  - International data transfer safeguards
  - Cookie and tracking disclosure
  - Contact information for privacy requests

#### v0.7.0 Heidelberg Support (2025-12-09)
- **Database Migration `20251209060207_add_v070_fields`**: Added support for v0.7.0 pNode metrics
  - `nodes.is_public` (Boolean): Whether RPC port is publicly accessible
  - `nodes.rpc_port` (Integer): RPC service port (typically 6000)
  - `node_metrics.storage_committed` (BigInt): Total storage allocated in bytes
  - `node_metrics.storage_usage_percent` (Float): Storage utilization percentage
  - Index on `nodes.is_public` for efficient filtering
  - All fields nullable for backward compatibility
  - Rollback procedure documented in `prisma/migrations/20251209060207_add_v070_fields/rollback.sql`

#### Quick Tech Debt Wins - Phase 4 (2025-12-09)
- Environment-aware configuration for Redis and mobile tRPC client
- Centralized constants in `src/lib/constants/limits.ts`
- Graceful shutdown with promise tracking for collector worker
- Zod validation for API route parameters (validates before casting)
- Configurable pNode seed IPs via `PRPC_SEED_NODES` env var
- Fixed ESLint violations in test setup and components

### Changed
- Collector worker now tracks in-flight collections to prevent overlaps during shutdown
- Search parameter validation order fixed in metrics API route
- Mobile tRPC client requires explicit `EXPO_PUBLIC_API_URL` (no localhost fallback)

### Fixed
- TypeScript type errors in collector worker promise handling
- Unsafe type casting in API route parameter validation

## [0.1.0] - 2024-12-07

### Added
- Initial release with core analytics features
- Real-time pNode monitoring
- Time-series metrics collection with TimescaleDB
- Node discovery via pRPC API
- Network-wide statistics aggregation
- Alerting system with multi-channel notifications
- Portfolio management for operators
- Scheduled reporting
- Wallet-based authentication
- Public REST API with rate limiting
- Operator profiles and achievement badges

### Technical
- Next.js 14 with App Router
- tRPC for type-safe APIs
- PostgreSQL + TimescaleDB for time-series data
- Redis for caching and pub/sub
- Docker Compose deployment
- Prisma ORM with optimized indexes
