/**
 * BullMQ Queue Configuration
 *
 * Provides background job processing for:
 * - Alert evaluation and notifications
 * - Scheduled report generation
 * - Email delivery
 */

import { Queue, Worker, Job } from "bullmq";
import {
  ALERT_EVALUATION_INTERVAL_MS,
  ALERT_ESCALATION_INTERVAL_MS,
  QUEUE_COMPLETED_JOB_RETENTION,
  QUEUE_FAILED_JOB_RETENTION,
  DEFAULT_WORKER_CONCURRENCY,
} from "@/lib/constants/limits";
import { getRedisConnectionConfig } from "@/lib/constants/redis";

// Redis connection config for BullMQ
function getRedisConfig() {
  return {
    ...getRedisConnectionConfig(),
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}

// Queue names
export const QUEUE_NAMES = {
  ALERTS: "alerts",
  NOTIFICATIONS: "notifications",
  REPORTS: "reports",
} as const;

// Job types
export interface AlertJobData {
  type: "evaluate_rules" | "process_alert" | "process_escalations";
  ruleId?: string;
  alertId?: string;
  nodeId?: number;
}

export interface NotificationJobData {
  type: "email" | "discord" | "telegram";
  alertId: string;
  channelId: string;
  payload: {
    subject?: string;
    message: string;
    nodeAddress?: string;
    metric?: string;
    value?: number;
    threshold?: number;
  };
}

export interface ReportJobData {
  type: "generate_report" | "check_scheduled";
  reportId?: string;
  userId?: string;
  sessionId?: string;
}

// Singleton queues
let alertQueue: Queue<AlertJobData> | null = null;
let notificationQueue: Queue<NotificationJobData> | null = null;
let reportQueue: Queue<ReportJobData> | null = null;

/**
 * Get or create the alerts queue
 */
export function getAlertQueue(): Queue<AlertJobData> {
  if (!alertQueue) {
    alertQueue = new Queue(QUEUE_NAMES.ALERTS, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: QUEUE_COMPLETED_JOB_RETENTION,
        removeOnFail: QUEUE_FAILED_JOB_RETENTION,
      },
    });
  }
  return alertQueue;
}

/**
 * Get or create the notifications queue
 */
export function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });
  }
  return notificationQueue;
}

/**
 * Get or create the reports queue
 */
export function getReportQueue(): Queue<ReportJobData> {
  if (!reportQueue) {
    reportQueue = new Queue(QUEUE_NAMES.REPORTS, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }
  return reportQueue;
}

/**
 * Create a worker for processing jobs
 */
export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = DEFAULT_WORKER_CONCURRENCY
): Worker<T> {
  return new Worker(queueName, processor, {
    connection: getRedisConfig(),
    concurrency,
  });
}

/**
 * Schedule alert evaluation (runs every 30 seconds)
 */
export async function scheduleAlertEvaluation(): Promise<void> {
  const queue = getAlertQueue();

  // Remove existing repeatable jobs
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === "evaluate_rules" || job.name === "process_escalations") {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add rule evaluation job
  await queue.add(
    "evaluate_rules",
    { type: "evaluate_rules" },
    {
      repeat: {
        every: ALERT_EVALUATION_INTERVAL_MS,
      },
    }
  );

  // Add escalation processing job
  await queue.add(
    "process_escalations",
    { type: "process_escalations" },
    {
      repeat: {
        every: ALERT_ESCALATION_INTERVAL_MS,
      },
    }
  );
}

/**
 * Schedule report checking (runs every minute to check for due reports)
 */
export async function scheduleReportChecks(): Promise<void> {
  const queue = getReportQueue();

  // Remove existing repeatable jobs
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === "check_scheduled") {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add scheduled report check job (every minute)
  await queue.add(
    "check_scheduled",
    { type: "check_scheduled" },
    {
      repeat: {
        every: 60000, // 1 minute
      },
    }
  );
}

/**
 * Close all queue connections
 */
export async function closeQueues(): Promise<void> {
  const queues = [alertQueue, notificationQueue, reportQueue].filter(Boolean);
  await Promise.all(queues.map((q) => q?.close()));
  alertQueue = null;
  notificationQueue = null;
  reportQueue = null;
}
