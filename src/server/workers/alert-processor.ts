/**
 * Alert Processor Worker
 *
 * Evaluates alert rules against latest node metrics and triggers alerts.
 * Runs every 30 seconds (synced with collector).
 *
 * Usage:
 *   npx tsx src/server/workers/alert-processor.ts
 */

import { db } from "@/lib/db";
import {
  createWorker,
  getNotificationQueue,
  scheduleAlertEvaluation,
  type AlertJobData,
  type NotificationJobData,
} from "@/lib/queue";
import type { AlertMetric, AlertOperator, AlertRule, Prisma } from "@prisma/client";

console.log("Starting Alert Processor...");

// Metric extraction from latest node metrics
interface LatestMetric {
  nodeId: number;
  address: string;
  cpuPercent: number | null;
  ramPercent: number | null;
  fileSize: bigint | null;
  uptime: number | null;
  isActive: boolean;
  packetsReceived: number | null;
  packetsSent: number | null;
}

/**
 * Get latest metrics for all active nodes
 */
async function getLatestMetrics(): Promise<LatestMetric[]> {
  const metrics = await db.$queryRaw<
    Array<{
      node_id: number;
      address: string;
      is_active: boolean;
      cpu_percent: number | null;
      ram_percent: number | null;
      file_size: bigint | null;
      uptime: number | null;
      packets_received: number | null;
      packets_sent: number | null;
    }>
  >`
    SELECT
      n.id as node_id,
      n.address,
      n.is_active,
      lm.cpu_percent,
      CASE WHEN lm.ram_total > 0
        THEN (lm.ram_used::float / lm.ram_total * 100)
        ELSE 0
      END as ram_percent,
      lm.file_size,
      lm.uptime,
      lm.packets_received,
      lm.packets_sent
    FROM nodes n
    LEFT JOIN LATERAL (
      SELECT
        nm.cpu_percent,
        nm.ram_used,
        nm.ram_total,
        nm.file_size,
        nm.uptime,
        nm.packets_received,
        nm.packets_sent
      FROM node_metrics nm
      WHERE nm.node_id = n.id
      ORDER BY nm.time DESC
      LIMIT 1
    ) lm ON true
  `;

  return metrics.map((m) => ({
    nodeId: m.node_id,
    address: m.address,
    cpuPercent: m.cpu_percent,
    ramPercent: m.ram_percent,
    fileSize: m.file_size,
    uptime: m.uptime,
    isActive: m.is_active,
    packetsReceived: m.packets_received,
    packetsSent: m.packets_sent,
  }));
}

/**
 * Get metric value from node metrics
 */
function getMetricValue(metric: AlertMetric, nodeMetric: LatestMetric): number | null {
  switch (metric) {
    case "CPU_PERCENT":
      return nodeMetric.cpuPercent;
    case "RAM_PERCENT":
      return nodeMetric.ramPercent;
    case "STORAGE_SIZE":
      return nodeMetric.fileSize ? Number(nodeMetric.fileSize) : null;
    case "UPTIME":
      return nodeMetric.uptime;
    case "NODE_STATUS":
      return nodeMetric.isActive ? 1 : 0;
    case "PACKETS_RECEIVED":
      return nodeMetric.packetsReceived;
    case "PACKETS_SENT":
      return nodeMetric.packetsSent;
    default:
      return null;
  }
}

/**
 * Evaluate condition based on operator
 */
function evaluateCondition(
  value: number,
  operator: AlertOperator,
  threshold: number
): boolean {
  switch (operator) {
    case "GT":
      return value > threshold;
    case "GTE":
      return value >= threshold;
    case "LT":
      return value < threshold;
    case "LTE":
      return value <= threshold;
    case "EQ":
      return value === threshold;
    case "NEQ":
      return value !== threshold;
    default:
      return false;
  }
}

/**
 * Generate alert message
 */
function generateMessage(
  rule: AlertRule,
  nodeAddress: string,
  value: number
): string {
  const metricLabels: Record<AlertMetric, string> = {
    CPU_PERCENT: "CPU usage",
    RAM_PERCENT: "RAM usage",
    STORAGE_SIZE: "Storage size",
    UPTIME: "Uptime",
    NODE_STATUS: "Node status",
    PACKETS_RECEIVED: "Packets received",
    PACKETS_SENT: "Packets sent",
  };

  const operatorLabels: Record<AlertOperator, string> = {
    GT: "exceeded",
    GTE: "reached",
    LT: "dropped below",
    LTE: "at or below",
    EQ: "equals",
    NEQ: "changed from",
  };

  const metricLabel = metricLabels[rule.metric];
  const operatorLabel = operatorLabels[rule.operator];

  return `${metricLabel} on ${nodeAddress} has ${operatorLabel} ${rule.threshold} (current: ${value.toFixed(2)})`;
}

/**
 * Check if we should trigger alert (respects cooldown)
 */
async function shouldTriggerAlert(
  ruleId: string,
  nodeId: number,
  cooldownSeconds: number
): Promise<boolean> {
  const recentAlert = await db.alert.findFirst({
    where: {
      ruleId,
      nodeId,
      triggeredAt: {
        gte: new Date(Date.now() - cooldownSeconds * 1000),
      },
    },
  });

  return !recentAlert;
}

/**
 * Get nodes to evaluate for a rule
 */
async function getTargetNodeIds(
  rule: AlertRule,
  allMetrics: LatestMetric[]
): Promise<number[]> {
  switch (rule.targetType) {
    case "ALL_NODES":
      return allMetrics.map((m) => m.nodeId);
    case "SPECIFIC_NODES":
      return rule.nodeIds;
    case "BOOKMARKED":
      // For bookmarked, we'd need to get bookmarks from session
      // For now, fall back to specific nodes if provided
      return rule.nodeIds.length > 0 ? rule.nodeIds : [];
    default:
      return [];
  }
}

/**
 * Process escalations for unacknowledged alerts
 */
async function processEscalations(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Processing escalations...`);

  // Get active alerts that have escalation policies
  const activeAlerts = await db.alert.findMany({
    where: {
      status: "ACTIVE",
      rule: {
        escalationPolicyId: { not: null },
      },
    },
    include: {
      rule: {
        include: {
          escalationPolicy: {
            include: {
              steps: { orderBy: { stepOrder: "asc" } },
            },
          },
        },
      },
      node: { select: { address: true } },
    },
  });

  if (activeAlerts.length === 0) {
    console.log("No alerts requiring escalation");
    return;
  }

  console.log(`Found ${activeAlerts.length} active alerts with escalation policies`);

  let escalationsProcessed = 0;

  for (const alert of activeAlerts) {
    const policy = alert.rule.escalationPolicy;
    if (!policy || policy.steps.length === 0) continue;

    const now = new Date();
    const alertAgeMinutes = (now.getTime() - alert.triggeredAt.getTime()) / 60000;
    const currentStep = alert.currentEscalationStep;

    // Find the next step that should trigger
    for (const step of policy.steps) {
      if (step.stepOrder <= currentStep) {
        // Check if this step needs to repeat
        if (step.repeatIntervalMinutes && alert.lastEscalationAt) {
          const timeSinceLastEscalation = (now.getTime() - alert.lastEscalationAt.getTime()) / 60000;
          if (timeSinceLastEscalation >= step.repeatIntervalMinutes) {
            // Send repeat notification
            await sendEscalationNotifications(
              alert.id,
              step.channels as string[],
              alert.rule.name,
              alert.node?.address || "Unknown",
              alert.metric,
              alert.value,
              alert.threshold,
              alert.triggeredAt,
              alert.message,
              step.stepOrder,
              true // isRepeat
            );
            escalationsProcessed++;

            await db.alert.update({
              where: { id: alert.id },
              data: { lastEscalationAt: now },
            });
          }
        }
        continue;
      }

      // Check if it's time for this step
      if (alertAgeMinutes >= step.delayMinutes) {
        console.log(`Escalating alert ${alert.id} to step ${step.stepOrder}`);

        // Send notifications for this escalation step
        await sendEscalationNotifications(
          alert.id,
          step.channels as string[],
          alert.rule.name,
          alert.node?.address || "Unknown",
          alert.metric,
          alert.value,
          alert.threshold,
          alert.triggeredAt,
          alert.message,
          step.stepOrder,
          false
        );
        escalationsProcessed++;

        // Update alert with new escalation step
        await db.alert.update({
          where: { id: alert.id },
          data: {
            currentEscalationStep: step.stepOrder,
            lastEscalationAt: now,
          },
        });

        break; // Only process one new step at a time
      }
    }
  }

  console.log(`Escalation processing complete. ${escalationsProcessed} escalations sent.`);
}

/**
 * Send escalation notifications through specified channels
 */
async function sendEscalationNotifications(
  alertId: string,
  channelIds: string[],
  ruleName: string,
  nodeAddress: string,
  metric: AlertMetric,
  value: number,
  threshold: number,
  triggeredAt: Date,
  message: string,
  stepNumber: number,
  isRepeat: boolean
): Promise<void> {
  const notificationQueue = getNotificationQueue();

  for (const channelId of channelIds) {
    const channel = await db.notificationChannel.findUnique({
      where: { id: channelId },
    });

    if (channel && channel.isVerified) {
      const escalationPrefix = isRepeat
        ? `[ESCALATION REMINDER - Step ${stepNumber}]`
        : `[ESCALATION - Step ${stepNumber}]`;

      await notificationQueue.add(`escalate-${alertId}-${channelId}-${Date.now()}`, {
        type: channel.type.toLowerCase() as "email" | "discord" | "telegram",
        alertId,
        channelId: channel.id,
        payload: {
          subject: `${escalationPrefix} ${ruleName}`,
          message: `${escalationPrefix} ${message}`,
          nodeAddress,
          metric,
          value,
          threshold,
        },
      });
    }
  }
}

/**
 * Evaluate all enabled rules
 */
async function evaluateAllRules(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Evaluating alert rules...`);

  // Get all enabled rules
  const rules = await db.alertRule.findMany({
    where: { isEnabled: true },
  });

  if (rules.length === 0) {
    console.log("No enabled rules to evaluate");
    return;
  }

  console.log(`Found ${rules.length} enabled rules`);

  // Get latest metrics for all nodes
  const allMetrics = await getLatestMetrics();
  const metricsMap = new Map(allMetrics.map((m) => [m.nodeId, m]));

  console.log(`Got metrics for ${allMetrics.length} nodes`);

  const notificationQueue = getNotificationQueue();
  let alertsTriggered = 0;

  // Evaluate each rule
  for (const rule of rules) {
    const targetNodeIds = await getTargetNodeIds(rule, allMetrics);

    for (const nodeId of targetNodeIds) {
      const nodeMetric = metricsMap.get(nodeId);
      if (!nodeMetric) continue;

      const value = getMetricValue(rule.metric, nodeMetric);
      if (value === null) continue;

      const conditionMet = evaluateCondition(value, rule.operator, rule.threshold);

      if (conditionMet) {
        // Check cooldown
        const shouldTrigger = await shouldTriggerAlert(rule.id, nodeId, rule.cooldown);

        if (shouldTrigger) {
          const message = generateMessage(rule, nodeMetric.address, value);

          // Create alert record
          const alert = await db.alert.create({
            data: {
              ruleId: rule.id,
              nodeId,
              metric: rule.metric,
              value,
              threshold: rule.threshold,
              message,
              status: "ACTIVE",
            },
          });

          // Update rule last triggered time
          await db.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });

          console.log(`Alert triggered: ${rule.name} for node ${nodeMetric.address}`);
          alertsTriggered++;

          // Queue notifications for each channel
          const channelIds = rule.channels as string[];
          for (const channelId of channelIds) {
            const channel = await db.notificationChannel.findUnique({
              where: { id: channelId },
            });

            if (channel && channel.isVerified) {
              await notificationQueue.add(`notify-${alert.id}-${channelId}`, {
                type: channel.type.toLowerCase() as "email" | "discord" | "telegram",
                alertId: alert.id,
                channelId: channel.id,
                payload: {
                  subject: `[pNode Pulse] ${rule.name}`,
                  message,
                  nodeAddress: nodeMetric.address,
                  metric: rule.metric,
                  value,
                  threshold: rule.threshold,
                },
              });
            }
          }
        }
      }
    }
  }

  console.log(`Evaluation complete. ${alertsTriggered} alerts triggered.`);
}

/**
 * Process notification job
 */
async function processNotification(job: { data: NotificationJobData }): Promise<void> {
  const { type, alertId, channelId, payload } = job.data;
  console.log(`Processing ${type} notification for alert ${alertId}`);

  try {
    const channel = await db.notificationChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      console.error(`Channel ${channelId} not found`);
      return;
    }

    const alert = await db.alert.findUnique({
      where: { id: alertId },
      include: { node: true },
    });

    if (!alert) {
      console.error(`Alert ${alertId} not found`);
      return;
    }

    // Import notification service dynamically to avoid circular deps
    const { sendNotification } = await import("@/lib/notifications/service");

    const result = await sendNotification(
      type,
      channel.config as unknown as Parameters<typeof sendNotification>[1],
      {
        alertId,
        ruleName: payload.subject || "Alert",
        nodeAddress: payload.nodeAddress || alert.node?.address || "Unknown",
        nodeId: alert.nodeId || 0,
        metric: payload.metric || alert.metric,
        operator: "GT", // Default, could be passed in payload
        value: payload.value || alert.value,
        threshold: payload.threshold || alert.threshold,
        triggeredAt: alert.triggeredAt,
        message: payload.message,
      },
      channelId
    );

    // Update notification tracking
    const currentSent = (alert.notificationsSent as Record<string, string[]>) || {};
    if (!currentSent[type]) currentSent[type] = [];
    currentSent[type].push(channelId);

    await db.alert.update({
      where: { id: alertId },
      data: { notificationsSent: currentSent as Prisma.InputJsonValue },
    });

    if (result.success) {
      console.log(`${type} notification sent successfully`);
    } else {
      console.error(`Failed to send ${type} notification: ${result.error}`);
    }
  } catch (error) {
    console.error(`Error processing notification:`, error);
    throw error; // Re-throw to trigger retry
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    // Create alert evaluation worker
    const alertWorker = createWorker<AlertJobData>(
      "alerts",
      async (job) => {
        if (job.data.type === "evaluate_rules") {
          await evaluateAllRules();
        } else if (job.data.type === "process_escalations") {
          await processEscalations();
        }
      },
      1 // Single concurrency for evaluation
    );

    // Create notification worker
    const notificationWorker = createWorker<NotificationJobData>(
      "notifications",
      processNotification,
      5 // Allow parallel notification sending
    );

    // Schedule repeating evaluation and escalation jobs
    await scheduleAlertEvaluation();
    console.log("Alert evaluation scheduled every 30 seconds");
    console.log("Escalation processing scheduled every 60 seconds");

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down alert processor...");
      await alertWorker.close();
      await notificationWorker.close();
      await db.$disconnect();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log("Alert processor is running. Press Ctrl+C to stop.");

    // Keep the process running
    await new Promise(() => {});
  } catch (error) {
    console.error("Fatal error in alert processor:", error);
    process.exit(1);
  }
}

main();
