/**
 * Telegram Bot Configuration
 */

export interface Config {
  // Telegram
  telegramToken: string;

  // pNode Pulse API
  pulseApiUrl: string;
  pulseApiKey?: string;

  // Bot settings
  refreshInterval: number; // in seconds
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
    // Telegram
    telegramToken: requireEnv("TELEGRAM_TOKEN"),

    // pNode Pulse API
    pulseApiUrl: process.env.PULSE_API_URL || "https://pulse.rectorspace.com",
    pulseApiKey: process.env.PULSE_API_KEY,

    // Bot settings
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || "60", 10),
  };
}

export const config = loadConfig();
