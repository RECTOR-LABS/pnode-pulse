/**
 * pNode Pulse Telegram Bot
 *
 * Provides real-time pNode network monitoring commands for Telegram.
 *
 * Commands:
 * /start - Welcome message
 * /network - Network overview
 * /node <address> - Node details
 * /leaderboard [metric] - Top performing nodes
 * /stats - Detailed statistics
 * /help - Command list
 */

import { Telegraf, Context } from "telegraf";
import { config } from "./config";
import { logger } from "./logger";

// Initialize bot
const bot = new Telegraf(config.telegramToken);

// API helper
async function fetchApi<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.pulseApiKey) {
    headers["X-API-Key"] = config.pulseApiKey;
  }

  const response = await fetch(config.pulseApiUrl + path, { headers });
  if (!response.ok) {
    throw new Error("API request failed: " + response.status);
  }
  return response.json() as Promise<T>;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Format seconds to human readable
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return days + "d " + hours + "h";
  if (hours > 0) return hours + "h " + mins + "m";
  return mins + "m";
}

// Escape markdown special characters
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// Commands
bot.command("start", (ctx) => {
  ctx.replyWithMarkdownV2(
    "*Welcome to pNode Pulse Bot\\!* <\n\n" +
    "I provide real\\-time monitoring data for the Xandeum pNode network\\.\n\n" +
    "*Available Commands:*\n" +
    "/network \\- Network overview\n" +
    "/node \\<address\\> \\- Node details\n" +
    "/leaderboard \\- Top performers\n" +
    "/stats \\- Detailed statistics\n" +
    "/help \\- Show this message\n\n" +
    "= [pNode Pulse Dashboard](https://pulse\\.rectorspace\\.com)"
  );
});

bot.command("help", (ctx) => {
  ctx.replyWithMarkdownV2(
    "*pNode Pulse Bot Commands* =�\n\n" +
    "/network \\- View network overview\n" +
    "/node \\<address\\> \\- Get node details\n" +
    "/leaderboard \\[uptime|cpu|storage\\] \\- Leaderboard\n" +
    "/stats \\- Detailed network statistics\n\n" +
    "*Examples:*\n" +
    "`/node 192\\.168\\.1\\.1:9001`\n" +
    "`/leaderboard uptime`"
  );
});

bot.command("network", async (ctx) => {
  try {
    interface NetworkOverview {
      nodes: { total: number; active: number; inactive: number };
      versions: Array<{ version: string; count: number }>;
      metrics: {
        totalStorageBytes: number;
        avgCpuPercent: number;
        avgRamPercent: number;
        avgUptimeSeconds: number;
      };
    }

    const data = await fetchApi<NetworkOverview>("/api/v1/network");

    const activePercent = ((data.nodes.active / data.nodes.total) * 100).toFixed(1);

    let message = "*< pNode Network Overview*\n\n";
    message += "*Nodes*\n";
    message += "=� Active: `" + data.nodes.active + "`\n";
    message += "=4 Inactive: `" + data.nodes.inactive + "`\n";
    message += "=� Total: `" + data.nodes.total + "` \\(" + activePercent + "% online\\)\n\n";
    message += "*Metrics*\n";
    message += "=� CPU: `" + data.metrics.avgCpuPercent.toFixed(1) + "%`\n";
    message += ">� RAM: `" + data.metrics.avgRamPercent.toFixed(1) + "%`\n";
    message += "=� Storage: `" + escapeMarkdown(formatBytes(data.metrics.totalStorageBytes)) + "`\n";
    message += "� Uptime: `" + escapeMarkdown(formatUptime(data.metrics.avgUptimeSeconds)) + "`\n\n";

    if (data.versions.length > 0) {
      message += "*Top Versions*\n";
      data.versions.slice(0, 3).forEach((v) => {
        message += "\\- v" + escapeMarkdown(v.version) + ": " + v.count + " nodes\n";
      });
    }

    await ctx.replyWithMarkdownV2(message);
  } catch (error) {
    ctx.reply("Failed to fetch network data: " + (error as Error).message);
  }
});

bot.command("node", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    ctx.reply("Usage: /node <address or id>\nExample: /node 192.168.1.1:9001");
    return;
  }

  const address = args[0];

  try {
    interface NodeDetails {
      id: number;
      address: string;
      pubkey: string | null;
      version: string | null;
      isActive: boolean;
      metrics: {
        cpuPercent: number | null;
        ramPercent: number;
        storageBytes: number;
        uptimeSeconds: number | null;
        packetsReceived: number | null;
        packetsSent: number | null;
      } | null;
      peerCount: number;
    }

    const data = await fetchApi<NodeDetails>("/api/v1/nodes/" + encodeURIComponent(address));

    const statusEmoji = data.isActive ? "=�" : "=4";
    const statusText = data.isActive ? "Active" : "Inactive";

    let message = "*" + statusEmoji + " Node \\#" + data.id + "*\n\n";
    message += "*Address:* `" + escapeMarkdown(data.address) + "`\n";
    message += "*Status:* " + statusText + "\n";
    message += "*Version:* " + escapeMarkdown(data.version || "Unknown") + "\n";
    message += "*Peers:* " + data.peerCount + "\n\n";

    if (data.metrics) {
      message += "*Metrics*\n";
      message += "=� CPU: `" + (data.metrics.cpuPercent?.toFixed(1) || "N/A") + "%`\n";
      message += ">� RAM: `" + data.metrics.ramPercent.toFixed(1) + "%`\n";
      message += "=� Storage: `" + escapeMarkdown(formatBytes(data.metrics.storageBytes)) + "`\n";

      if (data.metrics.uptimeSeconds !== null) {
        message += "� Uptime: `" + escapeMarkdown(formatUptime(data.metrics.uptimeSeconds)) + "`\n";
      }

      if (data.metrics.packetsReceived !== null) {
        message += "=� Packets RX: `" + data.metrics.packetsReceived.toLocaleString() + "`\n";
        message += "=� Packets TX: `" + (data.metrics.packetsSent?.toLocaleString() || "0") + "`\n";
      }
    }

    if (data.pubkey) {
      message += "\n*Public Key:*\n`" + escapeMarkdown(data.pubkey) + "`";
    }

    await ctx.replyWithMarkdownV2(message);
  } catch (error) {
    ctx.reply("Failed to fetch node: " + (error as Error).message);
  }
});

bot.command("leaderboard", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  const metric = args[0] || "uptime";
  const validMetrics = ["uptime", "cpu", "storage"];

  if (!validMetrics.includes(metric)) {
    ctx.reply("Invalid metric. Use: uptime, cpu, or storage");
    return;
  }

  try {
    interface LeaderboardEntry {
      rank: number;
      address: string;
      metrics: {
        uptimeSeconds: number;
        cpuPercent: number;
        storageBytes: number;
      };
    }

    interface Leaderboard {
      metric: string;
      rankings: LeaderboardEntry[];
    }

    const data = await fetchApi<Leaderboard>(
      "/api/v1/leaderboard?metric=" + metric + "&limit=10"
    );

    const metricLabels: Record<string, string> = {
      uptime: "� Uptime",
      cpu: "=� CPU Efficiency",
      storage: "=� Storage",
    };

    let message = "*<� Leaderboard \\- " + metricLabels[metric] + "*\n\n";

    const medals = [">G", ">H", ">I"];

    data.rankings.forEach((entry, i) => {
      const prefix = medals[i] || (i + 1) + "\\.";
      const ip = entry.address.split(":")[0];

      let value = "";
      switch (metric) {
        case "uptime":
          value = formatUptime(entry.metrics.uptimeSeconds);
          break;
        case "cpu":
          value = entry.metrics.cpuPercent.toFixed(1) + "%";
          break;
        case "storage":
          value = formatBytes(entry.metrics.storageBytes);
          break;
      }

      message += prefix + " `" + escapeMarkdown(ip) + "` \\- " + escapeMarkdown(value) + "\n";
    });

    await ctx.replyWithMarkdownV2(message);
  } catch (error) {
    ctx.reply("Failed to fetch leaderboard: " + (error as Error).message);
  }
});

bot.command("stats", async (ctx) => {
  try {
    interface NetworkStats {
      cpu: { avg: number; min: number; max: number; p50: number; p90: number };
      ram: { avgPercent: number; minPercent: number; maxPercent: number };
      storage: { total: number; avg: number };
      uptime: { avgSeconds: number };
      nodeCount: number;
    }

    const data = await fetchApi<NetworkStats>("/api/v1/network/stats");

    let message = "*=� Network Statistics*\n\n";

    message += "*CPU Usage*\n";
    message += "Average: `" + data.cpu.avg.toFixed(1) + "%`\n";
    message += "Range: `" + data.cpu.min.toFixed(1) + "% \\- " + data.cpu.max.toFixed(1) + "%`\n";
    message += "P50/P90: `" + data.cpu.p50.toFixed(1) + "% / " + data.cpu.p90.toFixed(1) + "%`\n\n";

    message += "*RAM Usage*\n";
    message += "Average: `" + data.ram.avgPercent.toFixed(1) + "%`\n";
    message += "Range: `" + data.ram.minPercent.toFixed(1) + "% \\- " + data.ram.maxPercent.toFixed(1) + "%`\n\n";

    message += "*Storage*\n";
    message += "Total: `" + escapeMarkdown(formatBytes(data.storage.total)) + "`\n";
    message += "Per Node: `" + escapeMarkdown(formatBytes(data.storage.avg)) + "`\n\n";

    message += "*Network Health*\n";
    message += "Active Nodes: `" + data.nodeCount + "`\n";
    message += "Avg Uptime: `" + escapeMarkdown(formatUptime(data.uptime.avgSeconds)) + "`";

    await ctx.replyWithMarkdownV2(message);
  } catch (error) {
    ctx.reply("Failed to fetch stats: " + (error as Error).message);
  }
});

// Error handler
bot.catch((err, ctx) => {
  logger.error("Bot error", err instanceof Error ? err : new Error(String(err)));
  ctx.reply("An error occurred. Please try again.");
});

// Start bot
async function main() {
  logger.info("Starting pNode Pulse Telegram Bot...");
  await bot.launch();
  logger.info("Bot is running!");

  // Graceful shutdown
  process.once("SIGINT", () => {
    logger.info("Received SIGINT, shutting down...");
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down...");
    bot.stop("SIGTERM");
  });
}

main().catch((err) => {
  logger.error("Failed to start bot", err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
