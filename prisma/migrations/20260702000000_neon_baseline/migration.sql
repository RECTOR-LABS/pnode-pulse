-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClaimVerificationMethod" AS ENUM ('WALLET_SIGNATURE', 'VERIFICATION_FILE', 'DNS_TXT');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AlertTargetType" AS ENUM ('ALL_NODES', 'SPECIFIC_NODES', 'BOOKMARKED');

-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('CPU_PERCENT', 'RAM_PERCENT', 'STORAGE_SIZE', 'UPTIME', 'NODE_STATUS', 'PACKETS_RECEIVED', 'PACKETS_SENT');

-- CreateEnum
CREATE TYPE "AlertOperator" AS ENUM ('GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('EMAIL', 'DISCORD', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "UptimeEventType" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY_SUMMARY', 'DAILY_DIGEST', 'MONTHLY_SLA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportScope" AS ENUM ('ALL_NODES', 'PORTFOLIO');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ApiKeyTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BadgeTier" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_claims" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "node_id" INTEGER NOT NULL,
    "verification_method" "ClaimVerificationMethod" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "display_name" TEXT,
    "verification_data" JSONB,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "gossipAddress" TEXT,
    "pubkey" TEXT,
    "version" TEXT,
    "is_public" BOOLEAN,
    "rpc_port" INTEGER,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "NodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "country" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_address_changes" (
    "id" BIGSERIAL NOT NULL,
    "node_id" INTEGER NOT NULL,
    "old_address" TEXT NOT NULL,
    "new_address" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_address_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_metrics" (
    "id" BIGSERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "node_id" INTEGER NOT NULL,
    "cpu_percent" DOUBLE PRECISION,
    "ram_used" BIGINT,
    "ram_total" BIGINT,
    "uptime" INTEGER,
    "file_size" BIGINT,
    "total_bytes" BIGINT,
    "total_pages" INTEGER,
    "current_index" INTEGER,
    "storage_committed" BIGINT,
    "storage_usage_percent" DOUBLE PRECISION,
    "packets_received" INTEGER,
    "packets_sent" INTEGER,
    "active_streams" INTEGER,

    CONSTRAINT "node_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_metrics_hourly" (
    "bucket" TIMESTAMP(3) NOT NULL,
    "node_id" INTEGER NOT NULL,
    "avg_cpu" DOUBLE PRECISION,
    "avg_ram_percent" DOUBLE PRECISION,
    "max_uptime" INTEGER,
    "max_file_size" BIGINT,
    "max_total_bytes" BIGINT,
    "total_packets_received" BIGINT,
    "total_packets_sent" BIGINT,
    "sample_count" BIGINT NOT NULL,

    CONSTRAINT "node_metrics_hourly_pkey" PRIMARY KEY ("bucket","node_id")
);

-- CreateTable
CREATE TABLE "node_metrics_daily" (
    "bucket" TIMESTAMP(3) NOT NULL,
    "node_id" INTEGER NOT NULL,
    "avg_cpu" DOUBLE PRECISION,
    "avg_ram_percent" DOUBLE PRECISION,
    "max_uptime" INTEGER,
    "max_file_size" BIGINT,
    "max_total_bytes" BIGINT,
    "total_packets_received" BIGINT,
    "total_packets_sent" BIGINT,
    "sample_count" BIGINT NOT NULL,

    CONSTRAINT "node_metrics_daily_pkey" PRIMARY KEY ("bucket","node_id")
);

-- CreateTable
CREATE TABLE "node_metrics_weekly" (
    "bucket" TIMESTAMP(3) NOT NULL,
    "node_id" INTEGER NOT NULL,
    "avg_cpu" DOUBLE PRECISION,
    "avg_ram_percent" DOUBLE PRECISION,
    "max_uptime" INTEGER,
    "max_file_size" BIGINT,
    "max_total_bytes" BIGINT,
    "total_packets_received" BIGINT,
    "total_packets_sent" BIGINT,
    "sample_count" BIGINT NOT NULL,

    CONSTRAINT "node_metrics_weekly_pkey" PRIMARY KEY ("bucket","node_id")
);

-- CreateTable
CREATE TABLE "network_metrics_hourly" (
    "bucket" TIMESTAMP(3) NOT NULL,
    "node_count" BIGINT NOT NULL,
    "total_storage" BIGINT NOT NULL,
    "avg_cpu" DOUBLE PRECISION,
    "avg_ram_percent" DOUBLE PRECISION,
    "avg_uptime" DOUBLE PRECISION,
    "total_packets_received" BIGINT,
    "total_packets_sent" BIGINT,
    "sample_count" BIGINT NOT NULL,

    CONSTRAINT "network_metrics_hourly_pkey" PRIMARY KEY ("bucket")
);

-- CreateTable
CREATE TABLE "network_metrics_daily" (
    "bucket" TIMESTAMP(3) NOT NULL,
    "node_count" BIGINT NOT NULL,
    "total_storage" BIGINT NOT NULL,
    "avg_cpu" DOUBLE PRECISION,
    "avg_ram_percent" DOUBLE PRECISION,
    "avg_uptime" DOUBLE PRECISION,
    "total_packets_received" BIGINT,
    "total_packets_sent" BIGINT,
    "sample_count" BIGINT NOT NULL,

    CONSTRAINT "network_metrics_daily_pkey" PRIMARY KEY ("bucket")
);

-- CreateTable
CREATE TABLE "node_peers" (
    "id" BIGSERIAL NOT NULL,
    "node_id" INTEGER NOT NULL,
    "peer_node_id" INTEGER,
    "peer_address" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "peer_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_peers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_stats" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_nodes" INTEGER NOT NULL,
    "active_nodes" INTEGER NOT NULL,
    "total_storage" BIGINT NOT NULL,
    "avg_cpu_percent" DOUBLE PRECISION NOT NULL,
    "avg_ram_percent" DOUBLE PRECISION NOT NULL,
    "avg_uptime" INTEGER NOT NULL,
    "total_peers" INTEGER NOT NULL,
    "version_distribution" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_jobs" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "nodes_polled" INTEGER NOT NULL DEFAULT 0,
    "nodes_success" INTEGER NOT NULL DEFAULT 0,
    "nodes_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "collection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_type" "AlertTargetType" NOT NULL DEFAULT 'ALL_NODES',
    "node_ids" INTEGER[],
    "metric" "AlertMetric" NOT NULL,
    "operator" "AlertOperator" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "cooldown" INTEGER NOT NULL DEFAULT 300,
    "escalation_policy_id" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "node_id" INTEGER,
    "metric" "AlertMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "notifications_sent" JSONB NOT NULL DEFAULT '{}',
    "current_escalation_step" INTEGER NOT NULL DEFAULT 0,
    "last_escalation_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "type" "NotificationChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_code" TEXT,
    "verification_expiry" TIMESTAMP(3),
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_steps" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "delay_minutes" INTEGER NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "repeat_interval_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Portfolio',
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_nodes" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "node_id" INTEGER NOT NULL,
    "label" TEXT,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "sla_target" DOUBLE PRECISION,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uptime_events" (
    "id" BIGSERIAL NOT NULL,
    "node_id" INTEGER NOT NULL,
    "event_type" "UptimeEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_seconds" INTEGER,

    CONSTRAINT "uptime_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "schedule" "ReportSchedule" NOT NULL,
    "cron_expr" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "send_hour" INTEGER NOT NULL DEFAULT 9,
    "send_day_of_week" INTEGER,
    "send_day_of_month" INTEGER,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "channel_ids" TEXT[],
    "scope" "ReportScope" NOT NULL DEFAULT 'PORTFOLIO',
    "portfolio_id" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "next_send_at" TIMESTAMP(3),
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '["read"]',
    "tier" "ApiKeyTier" NOT NULL DEFAULT 'FREE',
    "last_used_at" TIMESTAMP(3),
    "request_count" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_usage" (
    "id" BIGSERIAL NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "total_response_ms" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "show_node_stats" BOOLEAN NOT NULL DEFAULT true,
    "show_badges" BOOLEAN NOT NULL DEFAULT true,
    "total_nodes" INTEGER NOT NULL DEFAULT 0,
    "total_uptime" BIGINT NOT NULL DEFAULT 0,
    "total_storage" BIGINT NOT NULL DEFAULT 0,
    "avg_cpu_efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "rank_period" TEXT,
    "rank_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "tier" "BadgeTier" NOT NULL DEFAULT 'COMMON',
    "criteria" JSONB NOT NULL,
    "earned_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_badges" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "achievement_value" DOUBLE PRECISION,
    "node_id" INTEGER,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_wallet_address_idx" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_token_hash_idx" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_challenges_wallet_address_idx" ON "auth_challenges"("wallet_address");

-- CreateIndex
CREATE INDEX "auth_challenges_nonce_idx" ON "auth_challenges"("nonce");

-- CreateIndex
CREATE INDEX "node_claims_user_id_idx" ON "node_claims"("user_id");

-- CreateIndex
CREATE INDEX "node_claims_status_idx" ON "node_claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "node_claims_node_id_key" ON "node_claims"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_address_key" ON "nodes"("address");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_pubkey_key" ON "nodes"("pubkey");

-- CreateIndex
CREATE INDEX "nodes_address_idx" ON "nodes"("address");

-- CreateIndex
CREATE INDEX "nodes_is_active_idx" ON "nodes"("is_active");

-- CreateIndex
CREATE INDEX "nodes_version_idx" ON "nodes"("version");

-- CreateIndex
CREATE INDEX "nodes_last_seen_idx" ON "nodes"("last_seen" DESC);

-- CreateIndex
CREATE INDEX "nodes_is_active_version_idx" ON "nodes"("is_active", "version");

-- CreateIndex
CREATE INDEX "nodes_is_active_last_seen_idx" ON "nodes"("is_active", "last_seen" DESC);

-- CreateIndex
CREATE INDEX "nodes_is_public_idx" ON "nodes"("is_public");

-- CreateIndex
CREATE INDEX "nodes_status_idx" ON "nodes"("status");

-- CreateIndex
CREATE INDEX "nodes_status_last_seen_idx" ON "nodes"("status", "last_seen" DESC);

-- CreateIndex
CREATE INDEX "node_address_changes_node_id_idx" ON "node_address_changes"("node_id");

-- CreateIndex
CREATE INDEX "node_address_changes_detected_at_idx" ON "node_address_changes"("detected_at" DESC);

-- CreateIndex
CREATE INDEX "node_metrics_node_id_time_idx" ON "node_metrics"("node_id", "time" DESC);

-- CreateIndex
CREATE INDEX "node_metrics_hourly_node_id_bucket_idx" ON "node_metrics_hourly"("node_id", "bucket");

-- CreateIndex
CREATE INDEX "node_metrics_daily_node_id_bucket_idx" ON "node_metrics_daily"("node_id", "bucket");

-- CreateIndex
CREATE INDEX "node_metrics_weekly_node_id_bucket_idx" ON "node_metrics_weekly"("node_id", "bucket");

-- CreateIndex
CREATE INDEX "node_peers_node_id_idx" ON "node_peers"("node_id");

-- CreateIndex
CREATE INDEX "node_peers_peer_node_id_idx" ON "node_peers"("peer_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "node_peers_node_id_peer_address_key" ON "node_peers"("node_id", "peer_address");

-- CreateIndex
CREATE INDEX "network_stats_time_idx" ON "network_stats"("time" DESC);

-- CreateIndex
CREATE INDEX "collection_jobs_status_idx" ON "collection_jobs"("status");

-- CreateIndex
CREATE INDEX "collection_jobs_started_at_idx" ON "collection_jobs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "alert_rules_session_id_idx" ON "alert_rules"("session_id");

-- CreateIndex
CREATE INDEX "alert_rules_user_id_idx" ON "alert_rules"("user_id");

-- CreateIndex
CREATE INDEX "alert_rules_is_enabled_idx" ON "alert_rules"("is_enabled");

-- CreateIndex
CREATE INDEX "alert_rules_escalation_policy_id_idx" ON "alert_rules"("escalation_policy_id");

-- CreateIndex
CREATE INDEX "alerts_rule_id_idx" ON "alerts"("rule_id");

-- CreateIndex
CREATE INDEX "alerts_node_id_idx" ON "alerts"("node_id");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_triggered_at_idx" ON "alerts"("triggered_at" DESC);

-- CreateIndex
CREATE INDEX "notification_channels_session_id_idx" ON "notification_channels"("session_id");

-- CreateIndex
CREATE INDEX "notification_channels_user_id_idx" ON "notification_channels"("user_id");

-- CreateIndex
CREATE INDEX "notification_channels_type_idx" ON "notification_channels"("type");

-- CreateIndex
CREATE INDEX "escalation_policies_session_id_idx" ON "escalation_policies"("session_id");

-- CreateIndex
CREATE INDEX "escalation_policies_user_id_idx" ON "escalation_policies"("user_id");

-- CreateIndex
CREATE INDEX "escalation_steps_policy_id_idx" ON "escalation_steps"("policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "escalation_steps_policy_id_step_order_key" ON "escalation_steps"("policy_id", "step_order");

-- CreateIndex
CREATE INDEX "portfolios_session_id_idx" ON "portfolios"("session_id");

-- CreateIndex
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

-- CreateIndex
CREATE INDEX "portfolio_nodes_portfolio_id_idx" ON "portfolio_nodes"("portfolio_id");

-- CreateIndex
CREATE INDEX "portfolio_nodes_node_id_idx" ON "portfolio_nodes"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_nodes_portfolio_id_node_id_key" ON "portfolio_nodes"("portfolio_id", "node_id");

-- CreateIndex
CREATE INDEX "uptime_events_node_id_timestamp_idx" ON "uptime_events"("node_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "uptime_events_event_type_idx" ON "uptime_events"("event_type");

-- CreateIndex
CREATE INDEX "scheduled_reports_session_id_idx" ON "scheduled_reports"("session_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_user_id_idx" ON "scheduled_reports"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_next_send_at_idx" ON "scheduled_reports"("next_send_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_is_enabled_idx" ON "scheduled_reports"("is_enabled");

-- CreateIndex
CREATE INDEX "report_deliveries_report_id_idx" ON "report_deliveries"("report_id");

-- CreateIndex
CREATE INDEX "report_deliveries_status_idx" ON "report_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");

-- CreateIndex
CREATE INDEX "api_key_usage_api_key_id_idx" ON "api_key_usage"("api_key_id");

-- CreateIndex
CREATE INDEX "api_key_usage_bucket_idx" ON "api_key_usage"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_usage_api_key_id_bucket_endpoint_method_key" ON "api_key_usage"("api_key_id", "bucket", "endpoint", "method");

-- CreateIndex
CREATE UNIQUE INDEX "operator_profiles_user_id_key" ON "operator_profiles"("user_id");

-- CreateIndex
CREATE INDEX "operator_profiles_display_name_idx" ON "operator_profiles"("display_name");

-- CreateIndex
CREATE INDEX "operator_profiles_rank_idx" ON "operator_profiles"("rank");

-- CreateIndex
CREATE INDEX "operator_profiles_is_public_idx" ON "operator_profiles"("is_public");

-- CreateIndex
CREATE UNIQUE INDEX "badges_slug_key" ON "badges"("slug");

-- CreateIndex
CREATE INDEX "badges_slug_idx" ON "badges"("slug");

-- CreateIndex
CREATE INDEX "badges_tier_idx" ON "badges"("tier");

-- CreateIndex
CREATE INDEX "badges_is_active_idx" ON "badges"("is_active");

-- CreateIndex
CREATE INDEX "operator_badges_profile_id_idx" ON "operator_badges"("profile_id");

-- CreateIndex
CREATE INDEX "operator_badges_badge_id_idx" ON "operator_badges"("badge_id");

-- CreateIndex
CREATE INDEX "operator_badges_earned_at_idx" ON "operator_badges"("earned_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "operator_badges_profile_id_badge_id_key" ON "operator_badges"("profile_id", "badge_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_claims" ADD CONSTRAINT "node_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_address_changes" ADD CONSTRAINT "node_address_changes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_metrics" ADD CONSTRAINT "node_metrics_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_peers" ADD CONSTRAINT "node_peers_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_peers" ADD CONSTRAINT "node_peers_peer_node_id_fkey" FOREIGN KEY ("peer_node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_escalation_policy_id_fkey" FOREIGN KEY ("escalation_policy_id") REFERENCES "escalation_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_steps" ADD CONSTRAINT "escalation_steps_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "escalation_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_nodes" ADD CONSTRAINT "portfolio_nodes_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_nodes" ADD CONSTRAINT "portfolio_nodes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uptime_events" ADD CONSTRAINT "uptime_events_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_profiles" ADD CONSTRAINT "operator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_badges" ADD CONSTRAINT "operator_badges_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_badges" ADD CONSTRAINT "operator_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

