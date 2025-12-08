/**
 * Version Advisor for pNode Analytics
 *
 * Compares node versions against the latest and provides
 * upgrade recommendations.
 */

export interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

export interface VersionAdvisory {
  currentVersion: string;
  latestVersion: string;
  status: VersionStatus;
  severity: AdvisorySeverity;
  message: string;
  recommendation: string;
  versionsBehind: {
    major: number;
    minor: number;
    patch: number;
  };
}

export type VersionStatus =
  | "current"
  | "patch_available"
  | "minor_available"
  | "major_available"
  | "outdated"
  | "unknown";

export type AdvisorySeverity = "none" | "low" | "medium" | "high" | "critical";

/**
 * Parse a version string into components
 */
export function parseVersion(version: string): VersionInfo {
  const cleaned = version.replace(/^v/, "").trim();
  const parts = cleaned.split(".").map((n) => parseInt(n, 10) || 0);

  return {
    version: cleaned,
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;

  return 0;
}

/**
 * Find the latest version from a list
 */
export function findLatestVersion(versions: string[]): string {
  if (versions.length === 0) return "0.0.0";

  return versions.reduce((latest, current) => {
    return compareVersions(current, latest) > 0 ? current : latest;
  });
}

/**
 * Generate version advisory for a node
 */
export function generateVersionAdvisory(
  nodeVersion: string | null | undefined,
  latestVersion: string
): VersionAdvisory {
  if (!nodeVersion) {
    return {
      currentVersion: "unknown",
      latestVersion,
      status: "unknown",
      severity: "medium",
      message: "Version information unavailable",
      recommendation: "Verify node configuration and connectivity",
      versionsBehind: { major: 0, minor: 0, patch: 0 },
    };
  }

  const current = parseVersion(nodeVersion);
  const latest = parseVersion(latestVersion);

  const majorDiff = latest.major - current.major;
  const minorDiff = latest.minor - current.minor;
  const patchDiff = latest.patch - current.patch;

  // Check if current is same or newer
  if (compareVersions(nodeVersion, latestVersion) >= 0) {
    return {
      currentVersion: nodeVersion,
      latestVersion,
      status: "current",
      severity: "none",
      message: "Running the latest version",
      recommendation: "No action required",
      versionsBehind: { major: 0, minor: 0, patch: 0 },
    };
  }

  // Major version behind
  if (majorDiff > 0) {
    return {
      currentVersion: nodeVersion,
      latestVersion,
      status: "major_available",
      severity: majorDiff > 1 ? "critical" : "high",
      message: `${majorDiff} major version(s) behind`,
      recommendation: `Upgrade to v${latestVersion} immediately. Major versions often include security fixes and breaking changes.`,
      versionsBehind: { major: majorDiff, minor: 0, patch: 0 },
    };
  }

  // Minor version behind
  if (minorDiff > 0) {
    const severity: AdvisorySeverity =
      minorDiff > 3 ? "high" : minorDiff > 1 ? "medium" : "low";
    return {
      currentVersion: nodeVersion,
      latestVersion,
      status: "minor_available",
      severity,
      message: `${minorDiff} minor version(s) behind`,
      recommendation: `Upgrade to v${latestVersion} to receive new features and improvements.`,
      versionsBehind: { major: 0, minor: minorDiff, patch: 0 },
    };
  }

  // Patch version behind
  if (patchDiff > 0) {
    return {
      currentVersion: nodeVersion,
      latestVersion,
      status: "patch_available",
      severity: patchDiff > 2 ? "low" : "none",
      message: `${patchDiff} patch(es) behind`,
      recommendation: `Consider upgrading to v${latestVersion} for bug fixes and stability improvements.`,
      versionsBehind: { major: 0, minor: 0, patch: patchDiff },
    };
  }

  // Fallback (shouldn't reach here)
  return {
    currentVersion: nodeVersion,
    latestVersion,
    status: "outdated",
    severity: "medium",
    message: "Version comparison inconclusive",
    recommendation: "Check version format and consider upgrading",
    versionsBehind: { major: 0, minor: 0, patch: 0 },
  };
}

/**
 * Analyze version distribution across the network
 */
export interface VersionDistribution {
  version: string;
  count: number;
  percentage: number;
  status: VersionStatus;
  severity: AdvisorySeverity;
}

export function analyzeVersionDistribution(
  versionCounts: Array<{ version: string; count: number }>
): {
  distribution: VersionDistribution[];
  latestVersion: string;
  healthyPercentage: number;
  outdatedCount: number;
  recommendations: string[];
} {
  const versions = versionCounts.map((v) => v.version);
  const latestVersion = findLatestVersion(versions);
  const totalNodes = versionCounts.reduce((sum, v) => sum + v.count, 0);

  const distribution: VersionDistribution[] = versionCounts
    .map((v) => {
      const advisory = generateVersionAdvisory(v.version, latestVersion);
      return {
        version: v.version,
        count: v.count,
        percentage: totalNodes > 0 ? (v.count / totalNodes) * 100 : 0,
        status: advisory.status,
        severity: advisory.severity,
      };
    })
    .sort((a, b) => compareVersions(b.version, a.version));

  // Calculate health metrics
  const healthyVersions = distribution.filter(
    (d) => d.status === "current" || d.status === "patch_available"
  );
  const healthyCount = healthyVersions.reduce((sum, d) => sum + d.count, 0);
  const healthyPercentage = totalNodes > 0 ? (healthyCount / totalNodes) * 100 : 0;

  const outdatedVersions = distribution.filter(
    (d) => d.severity === "high" || d.severity === "critical"
  );
  const outdatedCount = outdatedVersions.reduce((sum, d) => sum + d.count, 0);

  // Generate recommendations
  const recommendations: string[] = [];

  if (outdatedCount > 0) {
    recommendations.push(
      `${outdatedCount} node(s) are running significantly outdated versions and should be upgraded immediately.`
    );
  }

  const uniqueVersions = distribution.length;
  if (uniqueVersions > 3) {
    recommendations.push(
      `Network is running ${uniqueVersions} different versions. Consider coordinating upgrades for consistency.`
    );
  }

  if (healthyPercentage < 80) {
    recommendations.push(
      `Only ${Math.round(healthyPercentage)}% of nodes are on current or recent versions. A network-wide upgrade campaign is recommended.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Network version health is good. Continue monitoring for new releases.");
  }

  return {
    distribution,
    latestVersion,
    healthyPercentage: Math.round(healthyPercentage * 10) / 10,
    outdatedCount,
    recommendations,
  };
}
