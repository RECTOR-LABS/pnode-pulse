/**
 * Discord Bot Configuration
 */

export interface Config {
  // Discord
  discordToken: string;
  discordClientId: string;
  discordGuildId?: string; // Optional: for guild-specific commands

  // pNode Pulse API
  pulseApiUrl: string;
  pulseApiKey?: string;

  // Bot settings
  refreshInterval: number; // in seconds
  embedColor: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error("Missing required environment variable: " + name);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    // Discord
    discordToken: requireEnv("DISCORD_TOKEN"),
    discordClientId: requireEnv("DISCORD_CLIENT_ID"),
    discordGuildId: process.env.DISCORD_GUILD_ID,

    // pNode Pulse API
    pulseApiUrl: process.env.PULSE_API_URL || "https://pulse.rectorspace.com",
    pulseApiKey: process.env.PULSE_API_KEY,

    // Bot settings
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || "60", 10),
    embedColor: parseInt(process.env.EMBED_COLOR || "0x5865F2", 16), // Discord blurple
  };
}

export const config = loadConfig();
