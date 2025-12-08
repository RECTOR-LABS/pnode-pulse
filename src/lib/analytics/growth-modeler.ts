/**
 * Growth Modeler for Network Expansion Forecasting
 *
 * Models and predicts network growth with scenario planning,
 * churn analysis, and milestone projections.
 */

export interface GrowthDataPoint {
  timestamp: Date;
  totalNodes: number;
  activeNodes: number;
  totalStorageBytes: number;
}

export interface GrowthMetrics {
  // Current state
  currentNodes: number;
  currentActiveNodes: number;
  currentStorageTB: number;

  // Growth rates (per day)
  dailyNodeGrowth: number;
  dailyStorageGrowthTB: number;

  // Churn
  churnRate: number; // Percentage of nodes going inactive
  netGrowthRate: number; // New nodes minus churned

  // Trends
  nodeTrend: "accelerating" | "steady" | "decelerating" | "declining";
  storageTrend: "accelerating" | "steady" | "decelerating" | "declining";
}

export interface ScenarioForecast {
  scenario: "optimistic" | "baseline" | "pessimistic";
  description: string;
  growthMultiplier: number;
  predictions: {
    days30: ForecastPoint;
    days60: ForecastPoint;
    days90: ForecastPoint;
  };
  milestones: Milestone[];
}

export interface ForecastPoint {
  date: Date;
  nodes: number;
  activeNodes: number;
  storageTB: number;
  confidence: number;
}

export interface Milestone {
  id: string;
  name: string;
  target: number;
  unit: "nodes" | "TB" | "PB";
  currentProgress: number;
  estimatedDate: Date | null;
  daysUntil: number | null;
  achieved: boolean;
}

export interface GrowthReport {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  metrics: GrowthMetrics;
  scenarios: ScenarioForecast[];
  historicalAccuracy?: number; // How accurate were past predictions
  highlights: string[];
}

// Scenario multipliers
const SCENARIO_CONFIG = {
  optimistic: {
    growthMultiplier: 1.5,
    churnReduction: 0.7,
    description: "Strong adoption, minimal churn",
  },
  baseline: {
    growthMultiplier: 1.0,
    churnReduction: 1.0,
    description: "Current trends continue",
  },
  pessimistic: {
    growthMultiplier: 0.6,
    churnReduction: 1.5,
    description: "Slower adoption, higher churn",
  },
} as const;

// Milestones to track
const MILESTONE_DEFINITIONS = [
  { id: "nodes-100", name: "100 Nodes", target: 100, unit: "nodes" as const },
  { id: "nodes-250", name: "250 Nodes", target: 250, unit: "nodes" as const },
  { id: "nodes-500", name: "500 Nodes", target: 500, unit: "nodes" as const },
  { id: "nodes-1000", name: "1,000 Nodes", target: 1000, unit: "nodes" as const },
  { id: "storage-1pb", name: "1 PB Storage", target: 1, unit: "PB" as const },
  { id: "storage-5pb", name: "5 PB Storage", target: 5, unit: "PB" as const },
  { id: "storage-10pb", name: "10 PB Storage", target: 10, unit: "PB" as const },
];

/**
 * Calculate growth metrics from historical data
 */
export function calculateGrowthMetrics(
  history: GrowthDataPoint[]
): GrowthMetrics | null {
  if (history.length < 2) {
    return null;
  }

  // Sort by timestamp
  const sorted = [...history].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const latest = sorted[sorted.length - 1];
  const currentNodes = latest.totalNodes;
  const currentActiveNodes = latest.activeNodes;
  const currentStorageTB = latest.totalStorageBytes / (1024 ** 4);

  // Calculate daily growth rates using linear regression
  const nodeGrowth = calculateDailyGrowth(sorted.map(d => ({
    timestamp: d.timestamp,
    value: d.totalNodes,
  })));

  const storageGrowth = calculateDailyGrowth(sorted.map(d => ({
    timestamp: d.timestamp,
    value: d.totalStorageBytes / (1024 ** 4),
  })));

  // Calculate churn rate
  const churnRate = currentNodes > 0
    ? ((currentNodes - currentActiveNodes) / currentNodes) * 100
    : 0;

  // Net growth (accounting for churn - simplified)
  const netGrowthRate = nodeGrowth.dailyRate * (1 - churnRate / 100);

  return {
    currentNodes,
    currentActiveNodes,
    currentStorageTB,
    dailyNodeGrowth: nodeGrowth.dailyRate,
    dailyStorageGrowthTB: storageGrowth.dailyRate,
    churnRate,
    netGrowthRate,
    nodeTrend: determineTrend(nodeGrowth),
    storageTrend: determineTrend(storageGrowth),
  };
}

interface GrowthRate {
  dailyRate: number;
  acceleration: number;
  rSquared: number;
}

function calculateDailyGrowth(
  data: Array<{ timestamp: Date; value: number }>
): GrowthRate {
  if (data.length < 2) {
    return { dailyRate: 0, acceleration: 0, rSquared: 0 };
  }

  const firstTimestamp = data[0].timestamp.getTime();
  const points = data.map(d => ({
    x: (d.timestamp.getTime() - firstTimestamp) / (1000 * 60 * 60 * 24), // days
    y: d.value,
  }));

  // Linear regression
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return { dailyRate: 0, acceleration: 0, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // R-squared
  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const { x, y } of points) {
    const predicted = slope * x + (sumY - slope * sumX) / n;
    ssRes += Math.pow(y - predicted, 2);
    ssTot += Math.pow(y - yMean, 2);
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Calculate acceleration (comparing first half to second half growth)
  const midpoint = Math.floor(points.length / 2);
  const firstHalfSlope = calculateSimpleSlope(points.slice(0, midpoint));
  const secondHalfSlope = calculateSimpleSlope(points.slice(midpoint));
  const acceleration = secondHalfSlope - firstHalfSlope;

  return {
    dailyRate: slope,
    acceleration,
    rSquared,
  };
}

function calculateSimpleSlope(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

function determineTrend(growth: GrowthRate): GrowthMetrics["nodeTrend"] {
  if (growth.dailyRate < 0) return "declining";
  if (growth.acceleration > 0.1) return "accelerating";
  if (growth.acceleration < -0.1) return "decelerating";
  return "steady";
}

/**
 * Generate scenario forecasts
 */
export function generateScenarioForecasts(
  metrics: GrowthMetrics
): ScenarioForecast[] {
  const scenarios: ScenarioForecast[] = [];
  const now = new Date();

  for (const [scenarioName, config] of Object.entries(SCENARIO_CONFIG)) {
    const scenario = scenarioName as keyof typeof SCENARIO_CONFIG;
    const adjustedNodeGrowth = metrics.dailyNodeGrowth * config.growthMultiplier;
    const adjustedStorageGrowth = metrics.dailyStorageGrowthTB * config.growthMultiplier;
    const adjustedChurn = metrics.churnRate * config.churnReduction;

    // Generate predictions
    const predictions = {
      days30: generateForecastPoint(30, metrics, adjustedNodeGrowth, adjustedStorageGrowth, adjustedChurn),
      days60: generateForecastPoint(60, metrics, adjustedNodeGrowth, adjustedStorageGrowth, adjustedChurn),
      days90: generateForecastPoint(90, metrics, adjustedNodeGrowth, adjustedStorageGrowth, adjustedChurn),
    };

    // Calculate milestones
    const milestones = calculateMilestones(
      metrics,
      adjustedNodeGrowth,
      adjustedStorageGrowth
    );

    scenarios.push({
      scenario,
      description: config.description,
      growthMultiplier: config.growthMultiplier,
      predictions,
      milestones,
    });
  }

  return scenarios;
}

function generateForecastPoint(
  days: number,
  metrics: GrowthMetrics,
  dailyNodeGrowth: number,
  dailyStorageGrowth: number,
  churnRate: number
): ForecastPoint {
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const predictedNodes = Math.round(
    metrics.currentNodes + dailyNodeGrowth * days
  );

  // Active nodes accounting for churn
  const activeRatio = 1 - churnRate / 100;
  const predictedActiveNodes = Math.round(predictedNodes * activeRatio);

  const predictedStorageTB = metrics.currentStorageTB + dailyStorageGrowth * days;

  // Confidence decreases with time
  const confidence = Math.max(0.3, 1 - days * 0.005);

  return {
    date: futureDate,
    nodes: Math.max(0, predictedNodes),
    activeNodes: Math.max(0, predictedActiveNodes),
    storageTB: Math.max(0, predictedStorageTB),
    confidence,
  };
}

function calculateMilestones(
  metrics: GrowthMetrics,
  dailyNodeGrowth: number,
  dailyStorageGrowth: number
): Milestone[] {
  const milestones: Milestone[] = [];

  for (const def of MILESTONE_DEFINITIONS) {
    let currentProgress = 0;
    let achieved = false;
    let daysUntil: number | null = null;
    let estimatedDate: Date | null = null;

    if (def.unit === "nodes") {
      currentProgress = metrics.currentNodes;
      achieved = currentProgress >= def.target;

      if (!achieved && dailyNodeGrowth > 0) {
        daysUntil = Math.ceil((def.target - currentProgress) / dailyNodeGrowth);
        if (daysUntil > 0 && daysUntil < 365 * 3) { // Cap at 3 years
          estimatedDate = new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
        }
      }
    } else if (def.unit === "PB") {
      const currentPB = metrics.currentStorageTB / 1024;
      currentProgress = currentPB;
      achieved = currentPB >= def.target;

      if (!achieved && dailyStorageGrowth > 0) {
        const dailyGrowthPB = dailyStorageGrowth / 1024;
        daysUntil = Math.ceil((def.target - currentPB) / dailyGrowthPB);
        if (daysUntil > 0 && daysUntil < 365 * 3) {
          estimatedDate = new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
        }
      }
    }

    milestones.push({
      id: def.id,
      name: def.name,
      target: def.target,
      unit: def.unit,
      currentProgress,
      estimatedDate,
      daysUntil,
      achieved,
    });
  }

  return milestones;
}

/**
 * Generate a comprehensive growth report
 */
export function generateGrowthReport(
  history: GrowthDataPoint[],
  periodDays: number = 30
): GrowthReport | null {
  const metrics = calculateGrowthMetrics(history);
  if (!metrics) {
    return null;
  }

  const scenarios = generateScenarioForecasts(metrics);
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Generate highlights
  const highlights: string[] = [];

  if (metrics.nodeTrend === "accelerating") {
    highlights.push(`Network growth is accelerating at ${metrics.dailyNodeGrowth.toFixed(1)} nodes/day`);
  } else if (metrics.nodeTrend === "declining") {
    highlights.push("Warning: Network is shrinking");
  }

  if (metrics.churnRate > 20) {
    highlights.push(`High churn rate: ${metrics.churnRate.toFixed(1)}% of nodes inactive`);
  } else if (metrics.churnRate < 5) {
    highlights.push("Excellent node retention");
  }

  // Check for upcoming milestones
  const upcomingMilestones = scenarios[1].milestones // baseline scenario
    .filter(m => !m.achieved && m.daysUntil !== null && m.daysUntil <= 90)
    .sort((a, b) => (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity));

  if (upcomingMilestones.length > 0) {
    const next = upcomingMilestones[0];
    highlights.push(`${next.name} milestone expected in ~${next.daysUntil} days`);
  }

  // Recently achieved milestones
  const achievedMilestones = scenarios[1].milestones.filter(m => m.achieved);
  if (achievedMilestones.length > 0) {
    const latest = achievedMilestones[achievedMilestones.length - 1];
    highlights.push(`Achieved: ${latest.name}`);
  }

  return {
    generatedAt: now,
    period: {
      start: periodStart,
      end: now,
    },
    metrics,
    scenarios,
    highlights,
  };
}

/**
 * Compare scenarios side by side
 */
export interface ScenarioComparison {
  timeframe: "30d" | "60d" | "90d";
  optimistic: { nodes: number; storageTB: number };
  baseline: { nodes: number; storageTB: number };
  pessimistic: { nodes: number; storageTB: number };
  range: {
    nodesMin: number;
    nodesMax: number;
    storageTBMin: number;
    storageTBMax: number;
  };
}

export function compareScenarios(
  scenarios: ScenarioForecast[]
): ScenarioComparison[] {
  const timeframes: Array<{ key: "30d" | "60d" | "90d"; days: "days30" | "days60" | "days90" }> = [
    { key: "30d", days: "days30" },
    { key: "60d", days: "days60" },
    { key: "90d", days: "days90" },
  ];

  return timeframes.map(({ key, days }) => {
    const optimistic = scenarios.find(s => s.scenario === "optimistic")!;
    const baseline = scenarios.find(s => s.scenario === "baseline")!;
    const pessimistic = scenarios.find(s => s.scenario === "pessimistic")!;

    const optPred = optimistic.predictions[days];
    const basePred = baseline.predictions[days];
    const pessPred = pessimistic.predictions[days];

    return {
      timeframe: key,
      optimistic: { nodes: optPred.nodes, storageTB: optPred.storageTB },
      baseline: { nodes: basePred.nodes, storageTB: basePred.storageTB },
      pessimistic: { nodes: pessPred.nodes, storageTB: pessPred.storageTB },
      range: {
        nodesMin: pessPred.nodes,
        nodesMax: optPred.nodes,
        storageTBMin: pessPred.storageTB,
        storageTBMax: optPred.storageTB,
      },
    };
  });
}
