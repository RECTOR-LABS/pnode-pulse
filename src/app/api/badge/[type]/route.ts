import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type BadgeType = "network" | "nodes" | "storage" | "uptime";
type BadgeStyle = "flat" | "plastic" | "flat-square";

interface BadgeConfig {
  label: string;
  value: string;
  color: string;
}

/**
 * Generate shields.io style SVG badge
 */
function generateBadge(config: BadgeConfig, style: BadgeStyle): string {
  const { label, value, color } = config;

  // Calculate widths (approximate character width)
  const labelWidth = label.length * 6.5 + 10;
  const valueWidth = value.length * 6.5 + 10;
  const totalWidth = labelWidth + valueWidth;

  const gradientId = `gradient-${Math.random().toString(36).slice(2, 9)}`;

  // Style-specific attributes
  let gradient = "";
  let borderRadius = "3";

  if (style === "plastic") {
    gradient = `
      <linearGradient id="${gradientId}" x2="0" y2="100%">
        <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
        <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
        <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
        <stop offset="1" stop-color="#000" stop-opacity=".5"/>
      </linearGradient>`;
    borderRadius = "4";
  } else if (style === "flat-square") {
    borderRadius = "0";
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  ${gradient}
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${borderRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
    ${style === "plastic" ? `<rect width="${totalWidth}" height="20" fill="url(#${gradientId})"/>` : ""}
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

/**
 * GET /api/badge/:type.svg
 * Returns an SVG badge for the specified metric
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type: typeWithExt } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Remove .svg extension if present
    const type = typeWithExt.replace(/\.svg$/, "") as BadgeType;
    const style = (searchParams.get("style") || "flat") as BadgeStyle;

    const validTypes: BadgeType[] = ["network", "nodes", "storage", "uptime"];
    const validStyles: BadgeStyle[] = ["flat", "plastic", "flat-square"];

    if (!validTypes.includes(type)) {
      return new NextResponse("Invalid badge type", { status: 400 });
    }

    if (!validStyles.includes(style)) {
      return new NextResponse("Invalid badge style", { status: 400 });
    }

    let config: BadgeConfig;

    switch (type) {
      case "network": {
        const [total, active] = await Promise.all([
          db.node.count(),
          db.node.count({ where: { isActive: true } }),
        ]);
        const healthPercent = total > 0 ? (active / total) * 100 : 0;

        let status: string;
        let color: string;

        if (healthPercent >= 90) {
          status = "healthy";
          color = "#4c1";
        } else if (healthPercent >= 70) {
          status = "degraded";
          color = "#fe7d37";
        } else {
          status = "down";
          color = "#e05d44";
        }

        config = {
          label: "pNode Network",
          value: status,
          color,
        };
        break;
      }

      case "nodes": {
        const [total, active] = await Promise.all([
          db.node.count(),
          db.node.count({ where: { isActive: true } }),
        ]);

        config = {
          label: "pNodes",
          value: `${active}/${total} active`,
          color: "#007ec6",
        };
        break;
      }

      case "storage": {
        const result = await db.$queryRaw<Array<{ total: bigint }>>`
          SELECT COALESCE(SUM("fileSize"), 0) as total
          FROM (
            SELECT DISTINCT ON ("nodeId") "fileSize"
            FROM "NodeMetric"
            ORDER BY "nodeId", time DESC
          ) latest
        `;
        const total = Number(result[0]?.total ?? 0);

        config = {
          label: "Storage",
          value: formatBytes(total),
          color: "#9f7be1",
        };
        break;
      }

      case "uptime": {
        const result = await db.$queryRaw<Array<{ avg_uptime: number }>>`
          SELECT COALESCE(AVG(uptime), 0) as avg_uptime
          FROM (
            SELECT DISTINCT ON ("nodeId") uptime
            FROM "NodeMetric"
            ORDER BY "nodeId", time DESC
          ) latest
        `;
        const avgUptime = result[0]?.avg_uptime ?? 0;

        config = {
          label: "Avg Uptime",
          value: formatUptime(avgUptime),
          color: "#97ca00",
        };
        break;
      }
    }

    const svg = generateBadge(config, style);

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    logger.error("Badge Error:", error instanceof Error ? error : new Error(String(error)));

    // Return error badge
    const errorBadge = generateBadge(
      { label: "pNode", value: "error", color: "#e05d44" },
      "flat"
    );

    return new NextResponse(errorBadge, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
      },
    });
  }
}
