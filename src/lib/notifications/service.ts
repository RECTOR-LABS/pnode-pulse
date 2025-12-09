/**
 * Notification Service
 *
 * Handles sending notifications through various channels:
 * - Email (via nodemailer)
 * - Discord (via webhooks)
 * - Telegram (via bot API)
 */

import nodemailer from "nodemailer";
import type {
  NotificationPayload,
  NotificationResult,
  NotificationChannelType,
  EmailConfig,
  DiscordConfig,
  TelegramConfig,
} from "./types";
import { ALERT_METRICS, ALERT_OPERATORS } from "./types";
import { logger } from "@/lib/logger";

// Email transporter (singleton)
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

/**
 * Format alert message for display
 */
export function formatAlertMessage(payload: NotificationPayload): string {
  const metric = ALERT_METRICS[payload.metric as keyof typeof ALERT_METRICS];
  const operator = ALERT_OPERATORS[payload.operator as keyof typeof ALERT_OPERATORS];

  return `Alert: ${payload.ruleName}
Node: ${payload.nodeAddress}
Condition: ${metric?.label || payload.metric} ${operator?.label || payload.operator} ${payload.threshold}${metric?.unit || ""}
Current Value: ${payload.value}${metric?.unit || ""}
Time: ${payload.triggeredAt.toISOString()}`;
}

// Severity colors for notifications
const SEVERITY_COLORS = {
  critical: { bg: "#fef2f2", border: "#ef4444", text: "#dc2626", discord: 0xed4245 },
  warning: { bg: "#fffbeb", border: "#f59e0b", text: "#d97706", discord: 0xfee75c },
  info: { bg: "#eff6ff", border: "#3b82f6", text: "#2563eb", discord: 0x5865f2 },
  resolved: { bg: "#f0fdf4", border: "#22c55e", text: "#16a34a", discord: 0x57f287 },
} as const;

type Severity = keyof typeof SEVERITY_COLORS;

/**
 * Determine severity from metric and threshold
 */
function getSeverity(metric: string, value: number, threshold: number): Severity {
  // Node offline is always critical
  if (metric === "NODE_STATUS" && value === 0) return "critical";

  // High resource usage thresholds
  if (metric === "CPU_PERCENT" || metric === "RAM_PERCENT") {
    if (value >= 95) return "critical";
    if (value >= 80) return "warning";
    return "info";
  }

  // Default based on how far over threshold
  const ratio = value / threshold;
  if (ratio >= 1.5) return "critical";
  if (ratio >= 1.0) return "warning";
  return "info";
}

/**
 * Get emoji for severity
 */
function getSeverityEmoji(severity: Severity): string {
  return severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵";
}

/**
 * Send email notification
 */
export async function sendEmail(
  config: EmailConfig,
  payload: NotificationPayload,
  channelId: string
): Promise<NotificationResult> {
  try {
    if (!config.verified) {
      return {
        success: false,
        channelType: "email",
        channelId,
        error: "Email not verified",
      };
    }

    const transporter = getEmailTransporter();
    const metric = ALERT_METRICS[payload.metric as keyof typeof ALERT_METRICS];
    const severity = getSeverity(payload.metric, payload.value, payload.threshold);
    const colors = SEVERITY_COLORS[severity];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulse.rectorspace.com";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px; margin-bottom: 24px;">
          <h2 style="color: ${colors.text}; margin: 0 0 8px 0;">
            ${getSeverityEmoji(severity)} ${payload.ruleName}
          </h2>
          <p style="margin: 0; color: #374151;">${payload.message}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; width: 140px;"><strong>Severity</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <span style="background: ${colors.bg}; color: ${colors.text}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">
                ${severity.charAt(0).toUpperCase() + severity.slice(1)}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Node</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: 'SF Mono', Monaco, monospace; font-size: 14px;">${payload.nodeAddress}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Metric</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${metric?.label || payload.metric}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Current Value</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: ${colors.text};">${payload.value}${metric?.unit || ""}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Threshold</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${payload.threshold}${metric?.unit || ""}</td>
          </tr>
          <tr>
            <td style="padding: 12px;"><strong>Time</strong></td>
            <td style="padding: 12px;">${payload.triggeredAt.toLocaleString()}</td>
          </tr>
        </table>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${appUrl}/nodes/${payload.nodeId}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            View Node Details
          </a>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">You're receiving this because you enabled alerts for pNode Pulse.</p>
          <a href="${appUrl}/alerts" style="color: #6b7280;">Manage Alert Settings</a>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "pNode Pulse <alerts@rectorspace.com>",
      to: config.address,
      subject: `[pNode Pulse] ${payload.ruleName} - ${payload.nodeAddress}`,
      text: formatAlertMessage(payload),
      html,
    });

    return {
      success: true,
      channelType: "email",
      channelId,
      messageId: info.messageId,
    };
  } catch (error) {
    return {
      success: false,
      channelType: "email",
      channelId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send Discord webhook notification
 */
export async function sendDiscord(
  config: DiscordConfig,
  payload: NotificationPayload,
  channelId: string
): Promise<NotificationResult> {
  try {
    const metric = ALERT_METRICS[payload.metric as keyof typeof ALERT_METRICS];
    const operator = ALERT_OPERATORS[payload.operator as keyof typeof ALERT_OPERATORS];
    const severity = getSeverity(payload.metric, payload.value, payload.threshold);

    const embed = {
      title: `${getSeverityEmoji(severity)} ${payload.ruleName}`,
      description: payload.message,
      color: SEVERITY_COLORS[severity].discord,
      fields: [
        {
          name: "Severity",
          value: severity.charAt(0).toUpperCase() + severity.slice(1),
          inline: true,
        },
        {
          name: "Node",
          value: `\`${payload.nodeAddress}\``,
          inline: true,
        },
        {
          name: "Metric",
          value: metric?.label || payload.metric,
          inline: true,
        },
        {
          name: "Condition",
          value: `${operator?.label || payload.operator} ${payload.threshold}${metric?.unit || ""}`,
          inline: true,
        },
        {
          name: "Current Value",
          value: `${payload.value}${metric?.unit || ""}`,
          inline: true,
        },
      ],
      timestamp: payload.triggeredAt.toISOString(),
      footer: {
        text: "pNode Pulse",
      },
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "pNode Pulse",
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    return {
      success: true,
      channelType: "discord",
      channelId,
    };
  } catch (error) {
    return {
      success: false,
      channelType: "discord",
      channelId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send Telegram notification
 */
export async function sendTelegram(
  config: TelegramConfig,
  payload: NotificationPayload,
  channelId: string
): Promise<NotificationResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("Telegram bot token not configured");
    }

    const metric = ALERT_METRICS[payload.metric as keyof typeof ALERT_METRICS];
    const operator = ALERT_OPERATORS[payload.operator as keyof typeof ALERT_OPERATORS];
    const severity = getSeverity(payload.metric, payload.value, payload.threshold);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulse.rectorspace.com";

    const message = `
${getSeverityEmoji(severity)} *pNode Pulse Alert*

*${payload.ruleName}*
${payload.message}

*Severity:* ${severity.charAt(0).toUpperCase() + severity.slice(1)}
*Node:* \`${payload.nodeAddress}\`
*Metric:* ${metric?.label || payload.metric}
*Condition:* ${operator?.label || payload.operator} ${payload.threshold}${metric?.unit || ""}
*Value:* ${payload.value}${metric?.unit || ""}
*Time:* ${payload.triggeredAt.toLocaleString()}

[View Node](${appUrl}/nodes/${payload.nodeId}) | [Manage Alerts](${appUrl}/alerts)
    `.trim();

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.description || "Telegram API error");
    }

    return {
      success: true,
      channelType: "telegram",
      channelId,
      messageId: String(result.result.message_id),
    };
  } catch (error) {
    return {
      success: false,
      channelType: "telegram",
      channelId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send notification through the appropriate channel
 */
export async function sendNotification(
  channelType: NotificationChannelType,
  config: EmailConfig | DiscordConfig | TelegramConfig,
  payload: NotificationPayload,
  channelId: string
): Promise<NotificationResult> {
  switch (channelType) {
    case "email":
      return sendEmail(config as EmailConfig, payload, channelId);
    case "discord":
      return sendDiscord(config as DiscordConfig, payload, channelId);
    case "telegram":
      return sendTelegram(config as TelegramConfig, payload, channelId);
    default:
      return {
        success: false,
        channelType,
        channelId,
        error: `Unknown channel type: ${channelType}`,
      };
  }
}

/**
 * Generate email verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send email verification code
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    const transporter = getEmailTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "pNode Pulse <noreply@rectorspace.com>",
      to: email,
      subject: "Verify your email for pNode Pulse alerts",
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; text-align: center;">
          <h2>pNode Pulse</h2>
          <p>Your email verification code is:</p>
          <div style="background: #f3f4f6; padding: 24px; border-radius: 8px; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #6b7280;">This code expires in 10 minutes.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send verification email:", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Test Discord webhook
 */
export async function testDiscordWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "pNode Pulse",
        content: "Test message from pNode Pulse. Your Discord webhook is working!",
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
