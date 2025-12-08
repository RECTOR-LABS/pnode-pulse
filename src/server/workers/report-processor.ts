/**
 * Report Processor Worker
 *
 * Generates and sends scheduled reports:
 * - Checks for due reports every minute
 * - Generates report content based on type
 * - Sends via email to configured recipients
 *
 * Usage:
 *   npx tsx src/server/workers/report-processor.ts
 */

import { db } from "@/lib/db";
import {
  createWorker,
  getReportQueue,
  scheduleReportChecks,
  type ReportJobData,
} from "@/lib/queue";
import nodemailer from "nodemailer";
import type { ReportType, ReportScope } from "@prisma/client";

console.log("Starting Report Processor...");

// Email transporter
let emailTransporter: nodemailer.Transporter | null = null;

function getEmailTransporter(): nodemailer.Transporter {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.resend.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "resend",
        pass: process.env.SMTP_PASS || "",
      },
    });
  }
  return emailTransporter;
}

interface NodeStats {
  address: string;
  isActive: boolean;
  cpuPercent: number | null;
  ramPercent: number | null;
  uptime: number | null;
  fileSize: bigint | null;
  version: string | null;
}

interface ReportData {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  avgCpuPercent: number;
  avgRamPercent: number;
  avgUptime: number;
  totalStorage: bigint;
  versionDistribution: Record<string, number>;
  topNodes: NodeStats[];
  underperformers: NodeStats[];
}

/**
 * Calculate uptime percentage for SLA
 */
function calculateUptimePercentage(
  _nodeId: number,
  _startDate: Date,
  _endDate: Date
): Promise<number> {
  // Simplified calculation - would use uptime_events in production
  return Promise.resolve(99.5);
}

/**
 * Get report data based on scope
 */
async function getReportData(
  scope: ReportScope,
  portfolioId: string | null,
  _reportType: ReportType
): Promise<ReportData> {
  // Get nodes based on scope
  let nodeFilter = {};
  if (scope === "PORTFOLIO" && portfolioId) {
    const portfolioNodes = await db.portfolioNode.findMany({
      where: { portfolioId },
      select: { nodeId: true },
    });
    const nodeIds = portfolioNodes.map((pn) => pn.nodeId);
    nodeFilter = { id: { in: nodeIds } };
  }

  // Get all nodes with latest metrics
  const nodes = await db.node.findMany({
    where: nodeFilter,
    include: {
      metrics: {
        orderBy: { time: "desc" },
        take: 1,
      },
    },
  });

  const activeNodes = nodes.filter((n) => n.isActive);
  const inactiveNodes = nodes.filter((n) => !n.isActive);

  // Calculate aggregates
  const stats: NodeStats[] = nodes.map((n) => ({
    address: n.address,
    isActive: n.isActive,
    cpuPercent: n.metrics[0]?.cpuPercent ?? null,
    ramPercent: n.metrics[0]?.ramTotal
      ? Number(n.metrics[0].ramUsed) / Number(n.metrics[0].ramTotal) * 100
      : null,
    uptime: n.metrics[0]?.uptime ?? null,
    fileSize: n.metrics[0]?.fileSize ?? null,
    version: n.version,
  }));

  const withCpu = stats.filter((s) => s.cpuPercent !== null);
  const withRam = stats.filter((s) => s.ramPercent !== null);
  const withUptime = stats.filter((s) => s.uptime !== null);

  const avgCpuPercent = withCpu.length
    ? withCpu.reduce((sum, s) => sum + (s.cpuPercent || 0), 0) / withCpu.length
    : 0;
  const avgRamPercent = withRam.length
    ? withRam.reduce((sum, s) => sum + (s.ramPercent || 0), 0) / withRam.length
    : 0;
  const avgUptime = withUptime.length
    ? withUptime.reduce((sum, s) => sum + (s.uptime || 0), 0) / withUptime.length
    : 0;

  const totalStorage = stats.reduce(
    (sum, s) => sum + (s.fileSize || BigInt(0)),
    BigInt(0)
  );

  // Version distribution
  const versionDistribution: Record<string, number> = {};
  for (const s of stats) {
    const version = s.version || "unknown";
    versionDistribution[version] = (versionDistribution[version] || 0) + 1;
  }

  // Top performers (by uptime)
  const topNodes = [...stats]
    .filter((s) => s.isActive && s.uptime !== null)
    .sort((a, b) => (b.uptime || 0) - (a.uptime || 0))
    .slice(0, 5);

  // Underperformers (high CPU or RAM, or offline)
  const underperformers = stats.filter(
    (s) =>
      !s.isActive ||
      (s.cpuPercent !== null && s.cpuPercent > 80) ||
      (s.ramPercent !== null && s.ramPercent > 80)
  ).slice(0, 10);

  return {
    totalNodes: nodes.length,
    activeNodes: activeNodes.length,
    inactiveNodes: inactiveNodes.length,
    avgCpuPercent,
    avgRamPercent,
    avgUptime,
    totalStorage,
    versionDistribution,
    topNodes,
    underperformers,
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format storage size
 */
function formatBytes(bytes: bigint): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate HTML email content for weekly summary
 */
function generateWeeklySummaryHtml(data: ReportData, reportName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulse.rectorspace.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">pNode Pulse</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Weekly Network Summary</p>
    </div>

    <!-- Main Content -->
    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px;">
      <h2 style="margin: 0 0 24px 0; color: #111827; font-size: 20px;">${reportName}</h2>

      <!-- Overview Stats -->
      <div style="display: grid; gap: 16px; margin-bottom: 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 50%; padding: 16px; background: #f0fdf4; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${data.activeNodes}</div>
              <div style="font-size: 13px; color: #6b7280;">Active Nodes</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="width: 50%; padding: 16px; background: #fef2f2; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #dc2626;">${data.inactiveNodes}</div>
              <div style="font-size: 13px; color: #6b7280;">Inactive Nodes</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Performance Metrics -->
      <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px; font-weight: 600;">Performance Overview</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Average CPU</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.avgCpuPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Average RAM</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.avgRamPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Average Uptime</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatDuration(data.avgUptime)}</td>
        </tr>
        <tr>
          <td style="padding: 12px;"><strong>Total Storage</strong></td>
          <td style="padding: 12px; text-align: right;">${formatBytes(data.totalStorage)}</td>
        </tr>
      </table>

      ${data.underperformers.length > 0 ? `
      <!-- Nodes Needing Attention -->
      <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px; font-weight: 600;">Nodes Needing Attention</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        ${data.underperformers.slice(0, 5).map((node) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${node.address}</code>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${!node.isActive ? '<span style="color: #dc2626;">Offline</span>' : ''}
            ${node.cpuPercent !== null && node.cpuPercent > 80 ? `<span style="color: #d97706;">CPU ${node.cpuPercent.toFixed(0)}%</span>` : ''}
            ${node.ramPercent !== null && node.ramPercent > 80 ? `<span style="color: #d97706;">RAM ${node.ramPercent.toFixed(0)}%</span>` : ''}
          </td>
        </tr>
        `).join('')}
      </table>
      ` : ''}

      <!-- Version Distribution -->
      <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px; font-weight: 600;">Version Distribution</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        ${Object.entries(data.versionDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([version, count]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${version}</code>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${count} nodes</td>
        </tr>
        `).join('')}
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          View Full Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">You're receiving this as part of your scheduled report.</p>
      <a href="${appUrl}/reports" style="color: #6b7280;">Manage Report Settings</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML email content for daily digest
 */
function generateDailyDigestHtml(data: ReportData, reportName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulse.rectorspace.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background: white; border-radius: 12px; padding: 32px;">
      <h1 style="margin: 0 0 8px 0; color: #111827; font-size: 22px;">Daily Network Digest</h1>
      <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background: #f0fdf4; border-radius: 8px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${data.activeNodes}/${data.totalNodes}</div>
            <div style="font-size: 13px; color: #6b7280;">Nodes Online</div>
          </td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">CPU Usage</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${data.avgCpuPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">RAM Usage</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${data.avgRamPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 10px 0;">Total Storage</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600;">${formatBytes(data.totalStorage)}</td>
        </tr>
      </table>

      ${data.underperformers.length > 0 ? `
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <strong style="color: #dc2626;">${data.underperformers.length} node(s) need attention</strong>
        <p style="color: #374151; margin: 8px 0 0 0; font-size: 14px;">
          ${data.underperformers.slice(0, 3).map(n => n.address).join(', ')}${data.underperformers.length > 3 ? ` and ${data.underperformers.length - 3} more` : ''}
        </p>
      </div>
      ` : `
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <strong style="color: #16a34a;">All nodes operating normally</strong>
      </div>
      `}

      <div style="text-align: center;">
        <a href="${appUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View Dashboard</a>
      </div>
    </div>

    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
      <a href="${appUrl}/reports" style="color: #6b7280;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML email content for monthly SLA report
 */
function generateMonthlySlaHtml(data: ReportData, reportName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulse.rectorspace.com";
  const slaPercent = data.totalNodes > 0
    ? ((data.activeNodes / data.totalNodes) * 100).toFixed(2)
    : "N/A";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background: white; border-radius: 12px; padding: 32px;">
      <h1 style="margin: 0 0 8px 0; color: #111827; font-size: 22px;">Monthly SLA Report</h1>
      <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>

      <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; font-weight: bold; color: white;">${slaPercent}%</div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.9);">Current Availability</div>
      </div>

      <h3 style="margin: 24px 0 16px 0; color: #374151; font-size: 16px;">Network Summary</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Total Nodes</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${data.totalNodes}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Currently Active</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #16a34a;">${data.activeNodes}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Currently Inactive</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #dc2626;">${data.inactiveNodes}</td>
        </tr>
        <tr>
          <td style="padding: 12px;">Average Uptime</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">${formatDuration(data.avgUptime)}</td>
        </tr>
      </table>

      <h3 style="margin: 24px 0 16px 0; color: #374151; font-size: 16px;">Resource Utilization</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Average CPU</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.avgCpuPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Average RAM</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.avgRamPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 12px;">Total Storage</td>
          <td style="padding: 12px; text-align: right;">${formatBytes(data.totalStorage)}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View Full Report</a>
      </div>
    </div>

    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
      <a href="${appUrl}/reports" style="color: #6b7280;">Manage Reports</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate report HTML based on type
 */
function generateReportHtml(
  reportType: ReportType,
  data: ReportData,
  reportName: string
): string {
  switch (reportType) {
    case "DAILY_DIGEST":
      return generateDailyDigestHtml(data, reportName);
    case "MONTHLY_SLA":
      return generateMonthlySlaHtml(data, reportName);
    case "WEEKLY_SUMMARY":
    case "CUSTOM":
    default:
      return generateWeeklySummaryHtml(data, reportName);
  }
}

/**
 * Generate plain text version
 */
function generateReportText(
  reportType: ReportType,
  data: ReportData,
  reportName: string
): string {
  return `
${reportName}
${"-".repeat(reportName.length)}

Network Status:
- Active Nodes: ${data.activeNodes}/${data.totalNodes}
- Average CPU: ${data.avgCpuPercent.toFixed(1)}%
- Average RAM: ${data.avgRamPercent.toFixed(1)}%
- Total Storage: ${formatBytes(data.totalStorage)}

${data.underperformers.length > 0 ? `
Nodes Needing Attention:
${data.underperformers.slice(0, 5).map(n => `- ${n.address}${!n.isActive ? ' (Offline)' : ''}`).join('\n')}
` : 'All nodes operating normally.'}

View full dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pulse.rectorspace.com'}
  `.trim();
}

/**
 * Calculate next send time based on schedule
 */
function calculateNextSendAt(
  schedule: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM",
  hour: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);

  switch (schedule) {
    case "DAILY":
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      const targetDay = dayOfWeek ?? 1;
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    case "MONTHLY":
      const targetDate = dayOfMonth ?? 1;
      next.setDate(targetDate);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      break;
    case "CUSTOM":
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
  }

  return next;
}

/**
 * Check for due reports and queue them
 */
async function checkScheduledReports(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Checking for scheduled reports...`);

  const now = new Date();

  const dueReports = await db.scheduledReport.findMany({
    where: {
      isEnabled: true,
      nextSendAt: { lte: now },
    },
  });

  if (dueReports.length === 0) {
    console.log("No reports due at this time");
    return;
  }

  console.log(`Found ${dueReports.length} report(s) due for sending`);

  const queue = getReportQueue();

  for (const report of dueReports) {
    // Create delivery record
    await db.reportDelivery.create({
      data: {
        reportId: report.id,
        status: "PENDING",
        recipients: report.recipients as string[],
        scheduledFor: now,
      },
    });

    // Queue report generation
    await queue.add(`generate-${report.id}-${Date.now()}`, {
      type: "generate_report",
      reportId: report.id,
      sessionId: report.sessionId || undefined,
    });

    console.log(`Queued report: ${report.name}`);
  }
}

/**
 * Generate and send a report
 */
async function generateAndSendReport(reportId: string): Promise<void> {
  console.log(`[${new Date().toISOString()}] Generating report: ${reportId}`);

  const report = await db.scheduledReport.findUnique({
    where: { id: reportId },
    include: { portfolio: true },
  });

  if (!report) {
    console.error(`Report ${reportId} not found`);
    return;
  }

  const recipients = report.recipients as string[];
  if (recipients.length === 0) {
    console.error(`Report ${reportId} has no recipients`);
    return;
  }

  // Get pending delivery
  const delivery = await db.reportDelivery.findFirst({
    where: {
      reportId: report.id,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  try {
    // Generate report data
    const data = await getReportData(
      report.scope,
      report.portfolioId,
      report.reportType
    );

    // Generate email content
    const html = generateReportHtml(report.reportType, data, report.name);
    const text = generateReportText(report.reportType, data, report.name);

    // Get subject based on type
    const subjectMap: Record<ReportType, string> = {
      DAILY_DIGEST: `Daily Digest - ${data.activeNodes}/${data.totalNodes} nodes active`,
      WEEKLY_SUMMARY: `Weekly Summary - pNode Pulse`,
      MONTHLY_SLA: `Monthly SLA Report - ${((data.activeNodes / data.totalNodes) * 100).toFixed(1)}%`,
      CUSTOM: report.name,
    };
    const subject = subjectMap[report.reportType];

    // Send email
    const transporter = getEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "pNode Pulse <reports@rectorspace.com>",
      to: recipients.join(", "),
      subject: `[pNode Pulse] ${subject}`,
      text,
      html,
    });

    console.log(`Report sent to ${recipients.length} recipient(s)`);

    // Update delivery status
    if (delivery) {
      await db.reportDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    // Update report next send time
    const nextSendAt = calculateNextSendAt(
      report.schedule,
      report.sendHour,
      report.sendDayOfWeek,
      report.sendDayOfMonth
    );

    await db.scheduledReport.update({
      where: { id: report.id },
      data: {
        lastSentAt: new Date(),
        nextSendAt,
      },
    });

    console.log(`Next send scheduled for: ${nextSendAt.toISOString()}`);
  } catch (error) {
    console.error(`Error generating report:`, error);

    // Update delivery with error
    if (delivery) {
      await db.reportDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    throw error;
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    // Create report worker
    const reportWorker = createWorker<ReportJobData>(
      "reports",
      async (job) => {
        if (job.data.type === "check_scheduled") {
          await checkScheduledReports();
        } else if (job.data.type === "generate_report" && job.data.reportId) {
          await generateAndSendReport(job.data.reportId);
        }
      },
      2 // Low concurrency for report generation
    );

    // Schedule repeating check jobs
    await scheduleReportChecks();
    console.log("Report checks scheduled every 60 seconds");

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down report processor...");
      await reportWorker.close();
      await db.$disconnect();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log("Report processor is running. Press Ctrl+C to stop.");

    // Keep the process running
    await new Promise(() => {});
  } catch (error) {
    console.error("Fatal error in report processor:", error);
    process.exit(1);
  }
}

main();
