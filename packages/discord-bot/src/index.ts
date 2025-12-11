/**
 * pNode Pulse Discord Bot
 *
 * Provides real-time pNode network monitoring commands for Discord servers.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { config } from "./config";

// Initialize Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

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

// Command definitions
const commands = [
  new SlashCommandBuilder()
    .setName("network")
    .setDescription("Get pNode network overview"),

  new SlashCommandBuilder()
    .setName("node")
    .setDescription("Get details for a specific node")
    .addStringOption((option) =>
      option
        .setName("address")
        .setDescription("Node address (IP:port) or ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View top performing nodes")
    .addStringOption((option) =>
      option
        .setName("metric")
        .setDescription("Metric to rank by")
        .addChoices(
          { name: "Uptime", value: "uptime" },
          { name: "CPU Efficiency", value: "cpu" },
          { name: "Storage", value: "storage" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of entries (default: 5)")
        .setMinValue(1)
        .setMaxValue(10)
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Get detailed network statistics"),
];

// Command handlers
async function handleNetwork(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

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

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle("pNode Network Overview")
      .setURL("https://pulse.rectorspace.com")
      .addFields(
        {
          name: "Nodes",
          value:
            "Active: **" + data.nodes.active + "**\n" +
            "Inactive: **" + data.nodes.inactive + "**\n" +
            "Total: **" + data.nodes.total + "**",
          inline: true,
        },
        {
          name: "Metrics",
          value:
            "CPU: **" + data.metrics.avgCpuPercent.toFixed(1) + "%**\n" +
            "RAM: **" + data.metrics.avgRamPercent.toFixed(1) + "%**\n" +
            "Storage: **" + formatBytes(data.metrics.totalStorageBytes) + "**",
          inline: true,
        },
        {
          name: "Avg Uptime",
          value: formatUptime(data.metrics.avgUptimeSeconds),
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: "pNode Pulse" });

    // Add version distribution if available
    if (data.versions.length > 0) {
      const versionText = data.versions
        .slice(0, 5)
        .map((v) => "v" + v.version + ": " + v.count)
        .join("\n");
      embed.addFields({ name: "Top Versions", value: versionText });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply("Failed to fetch network data: " + (error as Error).message);
  }
}

async function handleNode(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const address = interaction.options.getString("address", true);

  try {
    interface NodeDetails {
      id: number;
      address: string;
      pubkey: string | null;
      version: string | null;
      isActive: boolean;
      lastSeen: string | null;
      firstSeen: string;
      metrics: {
        cpuPercent: number | null;
        ramUsedBytes: number;
        ramTotalBytes: number;
        ramPercent: number;
        storageBytes: number;
        uptimeSeconds: number | null;
        packetsReceived: number | null;
        packetsSent: number | null;
      } | null;
      peerCount: number;
    }

    const data = await fetchApi<NodeDetails>("/api/v1/nodes/" + encodeURIComponent(address));

    const statusEmoji = data.isActive ? ":green_circle:" : ":red_circle:";
    const statusText = data.isActive ? "Active" : "Inactive";

    const embed = new EmbedBuilder()
      .setColor(data.isActive ? 0x57f287 : 0xed4245)
      .setTitle(statusEmoji + " Node #" + data.id)
      .setURL("https://pulse.rectorspace.com/nodes/" + data.id)
      .addFields(
        { name: "Address", value: "`" + data.address + "`", inline: true },
        { name: "Status", value: statusText, inline: true },
        { name: "Version", value: data.version || "Unknown", inline: true }
      );

    if (data.metrics) {
      embed.addFields(
        {
          name: "CPU",
          value: data.metrics.cpuPercent?.toFixed(1) + "%" || "N/A",
          inline: true,
        },
        {
          name: "RAM",
          value: data.metrics.ramPercent.toFixed(1) + "%",
          inline: true,
        },
        {
          name: "Storage",
          value: formatBytes(data.metrics.storageBytes),
          inline: true,
        }
      );

      if (data.metrics.uptimeSeconds !== null) {
        embed.addFields({
          name: "Uptime",
          value: formatUptime(data.metrics.uptimeSeconds),
          inline: true,
        });
      }

      if (data.metrics.packetsReceived !== null) {
        embed.addFields({
          name: "Packets",
          value:
            "RX: " + data.metrics.packetsReceived.toLocaleString() + "\n" +
            "TX: " + (data.metrics.packetsSent?.toLocaleString() || "0"),
          inline: true,
        });
      }
    }

    embed.addFields({ name: "Peers", value: data.peerCount.toString(), inline: true });

    if (data.pubkey) {
      embed.addFields({
        name: "Public Key",
        value: "`" + data.pubkey.substring(0, 20) + "...`",
      });
    }

    embed.setTimestamp().setFooter({ text: "pNode Pulse" });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply("Failed to fetch node: " + (error as Error).message);
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const metric = interaction.options.getString("metric") || "uptime";
  const limit = interaction.options.getInteger("limit") || 5;

  try {
    interface LeaderboardEntry {
      rank: number;
      nodeId: number;
      address: string;
      version: string;
      metrics: {
        uptimeSeconds: number;
        cpuPercent: number;
        ramPercent: number;
        storageBytes: number;
      };
    }

    interface Leaderboard {
      metric: string;
      rankings: LeaderboardEntry[];
    }

    const data = await fetchApi<Leaderboard>(
      "/api/v1/leaderboard?metric=" + metric + "&limit=" + limit
    );

    const metricLabels: Record<string, string> = {
      uptime: "Uptime",
      cpu: "CPU Efficiency",
      storage: "Storage",
    };

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(":trophy: Leaderboard - " + metricLabels[metric])
      .setURL("https://pulse.rectorspace.com/leaderboard");

    const lines = data.rankings.map((entry, i) => {
      const medals = [":first_place:", ":second_place:", ":third_place:"];
      const prefix = medals[i] || (i + 1) + ".";

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

      return prefix + " **" + entry.address.split(":")[0] + "** - " + value;
    });

    embed.setDescription(lines.join("\n"));
    embed.setTimestamp().setFooter({ text: "pNode Pulse" });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply("Failed to fetch leaderboard: " + (error as Error).message);
  }
}

async function handleStats(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    interface NetworkStats {
      cpu: { avg: number; min: number; max: number; p50: number; p90: number; p99: number };
      ram: { avgPercent: number; minPercent: number; maxPercent: number };
      storage: { total: number; avg: number };
      uptime: { avgSeconds: number };
      nodeCount: number;
    }

    const data = await fetchApi<NetworkStats>("/api/v1/network/stats");

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(":bar_chart: Network Statistics")
      .setURL("https://pulse.rectorspace.com")
      .addFields(
        {
          name: "CPU Usage",
          value:
            "Avg: **" + data.cpu.avg.toFixed(1) + "%**\n" +
            "Min: " + data.cpu.min.toFixed(1) + "% / Max: " + data.cpu.max.toFixed(1) + "%\n" +
            "P50: " + data.cpu.p50.toFixed(1) + "% / P90: " + data.cpu.p90.toFixed(1) + "%",
          inline: true,
        },
        {
          name: "RAM Usage",
          value:
            "Avg: **" + data.ram.avgPercent.toFixed(1) + "%**\n" +
            "Min: " + data.ram.minPercent.toFixed(1) + "% / Max: " + data.ram.maxPercent.toFixed(1) + "%",
          inline: true,
        },
        {
          name: "Storage",
          value:
            "Total: **" + formatBytes(data.storage.total) + "**\n" +
            "Avg/Node: " + formatBytes(data.storage.avg),
          inline: true,
        },
        {
          name: "Network Health",
          value:
            "Active Nodes: **" + data.nodeCount + "**\n" +
            "Avg Uptime: " + formatUptime(data.uptime.avgSeconds),
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: "pNode Pulse" });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply("Failed to fetch stats: " + (error as Error).message);
  }
}

// Event handlers
client.once(Events.ClientReady, (readyClient) => {
  console.log("Bot is ready! Logged in as " + readyClient.user.tag);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "network":
        await handleNetwork(interaction);
        break;
      case "node":
        await handleNode(interaction);
        break;
      case "leaderboard":
        await handleLeaderboard(interaction);
        break;
      case "stats":
        await handleStats(interaction);
        break;
    }
  } catch (error) {
    console.error("Command error:", error);
    const reply = {
      content: "An error occurred while executing this command.",
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Register commands and start bot
async function main() {
  // Register slash commands
  const rest = new REST().setToken(config.discordToken);

  console.log("Registering slash commands...");

  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);

  await rest.put(route, { body: commands.map((c) => c.toJSON()) });

  console.log("Slash commands registered!");

  // Login to Discord
  await client.login(config.discordToken);
}

main().catch(console.error);
