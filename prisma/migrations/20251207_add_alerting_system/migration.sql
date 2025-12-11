-- Phase 3: Alerting System
-- This migration adds the alert rule engine, alert instances, and notification channels

-- Create enums
CREATE TYPE "AlertTargetType" AS ENUM ('ALL_NODES', 'SPECIFIC_NODES', 'BOOKMARKED');
CREATE TYPE "AlertMetric" AS ENUM ('CPU_PERCENT', 'RAM_PERCENT', 'STORAGE_SIZE', 'UPTIME', 'NODE_STATUS', 'PACKETS_RECEIVED', 'PACKETS_SENT');
CREATE TYPE "AlertOperator" AS ENUM ('GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ');
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED');
CREATE TYPE "NotificationChannelType" AS ENUM ('EMAIL', 'DISCORD', 'TELEGRAM');

-- Alert Rules table
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_type" "AlertTargetType" NOT NULL DEFAULT 'ALL_NODES',
    "node_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "metric" "AlertMetric" NOT NULL,
    "operator" "AlertOperator" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "cooldown" INTEGER NOT NULL DEFAULT 300,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- Alerts (triggered instances)
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- Notification Channels
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

-- Indexes for alert_rules
CREATE INDEX "alert_rules_session_id_idx" ON "alert_rules"("session_id");
CREATE INDEX "alert_rules_user_id_idx" ON "alert_rules"("user_id");
CREATE INDEX "alert_rules_is_enabled_idx" ON "alert_rules"("is_enabled");

-- Indexes for alerts
CREATE INDEX "alerts_rule_id_idx" ON "alerts"("rule_id");
CREATE INDEX "alerts_node_id_idx" ON "alerts"("node_id");
CREATE INDEX "alerts_status_idx" ON "alerts"("status");
CREATE INDEX "alerts_triggered_at_idx" ON "alerts"("triggered_at" DESC);

-- Indexes for notification_channels
CREATE INDEX "notification_channels_session_id_idx" ON "notification_channels"("session_id");
CREATE INDEX "notification_channels_user_id_idx" ON "notification_channels"("user_id");
CREATE INDEX "notification_channels_type_idx" ON "notification_channels"("type");

-- Foreign keys
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_node_id_fkey"
    FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
