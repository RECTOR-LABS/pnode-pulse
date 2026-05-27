import { PrismaClient } from "@prisma/client";

let cached: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!cached) {
    cached = new PrismaClient({
      log:
        process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
    });
  }
  return cached;
}

export async function disconnectDb(): Promise<void> {
  if (cached) {
    await cached.$disconnect();
    cached = null;
  }
}
