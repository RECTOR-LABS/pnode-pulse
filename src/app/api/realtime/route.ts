/**
 * Server-Sent Events (SSE) Endpoint for Real-time Updates
 *
 * Connects to Redis pub/sub and streams updates to clients.
 * Scales horizontally - each server instance subscribes independently.
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import {  createSubscriber,
  subscribe,
  closeSubscriber,
  CHANNELS,
  type Channel,
} from "@/lib/redis/pubsub";

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Connection timeout (5 minutes without activity)
const CONNECTION_TIMEOUT = 300000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check for SSE support
  const accept = request.headers.get("accept");
  if (!accept?.includes("text/event-stream")) {
    return new Response("SSE not supported", { status: 406 });
  }

  // Get optional channel filter from query
  const channelParam = request.nextUrl.searchParams.get("channels");
  const allChannels = Object.values(CHANNELS) as Channel[];
  const requestedChannels: Channel[] = channelParam
    ? channelParam.split(",").filter((c): c is Channel => allChannels.includes(c as Channel))
    : allChannels;

  // Create response stream
  const encoder = new TextEncoder();
  let subscriber: ReturnType<typeof createSubscriber> | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let timeoutTimer: NodeJS.Timeout | null = null;
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ channels: requestedChannels })}\n\n`)
      );

      try {
        // Create subscriber for this connection
        subscriber = createSubscriber();

        // Set up heartbeat
        heartbeatTimer = setInterval(() => {
          if (isConnected) {
            try {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            } catch {
              // Connection closed
              isConnected = false;
            }
          }
        }, HEARTBEAT_INTERVAL);

        // Set up connection timeout
        const resetTimeout = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          timeoutTimer = setTimeout(() => {
            isConnected = false;
            controller.close();
          }, CONNECTION_TIMEOUT);
        };
        resetTimeout();

        // Subscribe to channels
        await subscribe(
          subscriber,
          requestedChannels,
          (channel, payload) => {
            if (!isConnected) return;

            resetTimeout();

            try {
              const eventName = channel.split(":").pop() || "update";
              const data = JSON.stringify(payload);
              controller.enqueue(
                encoder.encode(`event: ${eventName}\ndata: ${data}\n\n`)
              );
            } catch {
              // Connection closed
              isConnected = false;
            }
          }
        );
      } catch (error) {
        logger.error("[SSE] Setup error:", error instanceof Error ? error : new Error(String(error)));
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Connection failed" })}\n\n`)
        );
        controller.close();
      }
    },

    async cancel() {
      isConnected = false;

      // Cleanup
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (subscriber) {
        await closeSubscriber(subscriber);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
