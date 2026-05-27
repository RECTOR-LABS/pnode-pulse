import pino from "pino";
import { loadConfig } from "../config";

const env = loadConfig();

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "pulse-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    },
  }),
});

export type Logger = typeof logger;
