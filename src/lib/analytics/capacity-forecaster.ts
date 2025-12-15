/**
 * Capacity Forecaster for Predictive Analytics
 *
 * Uses linear regression to forecast storage growth,
 * node count trends, and network capacity.
 */

export interface DataPoint {
  timestamp: Date;
  value: number;
}

export interface LinearRegressionResult {
  slope: number; // Rate of change per day
  intercept: number;
  rSquared: number; // Goodness of fit (0-1)
  predictions: Array<{
    timestamp: Date;
    value: number;
  }>;
}

export interface CapacityForecast {
  currentValue: number;
  currentTimestamp: Date;
  dailyGrowthRate: number;
  weeklyGrowthRate: number;
  monthlyGrowthRate: number;
  predictions: {
    nextWeek: number;
    nextMonth: number;
    next3Months: number;
    next6Months: number;
  };
  trend: "growing" | "stable" | "declining";
  confidence: number; // 0-1 based on R-squared
  warning?: string;
}

/**
 * Perform simple linear regression
 */
export function linearRegression(
  data: DataPoint[],
): LinearRegressionResult | null {
  if (data.length < 2) {
    return null;
  }

  // Convert timestamps to days from first point
  const firstTimestamp = data[0].timestamp.getTime();
  const points = data.map((d) => ({
    x: (d.timestamp.getTime() - firstTimestamp) / (1000 * 60 * 60 * 24), // days
    y: d.value,
  }));

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  let ssRes = 0;
  let ssTot = 0;

  for (const { x, y } of points) {
    const predicted = slope * x + intercept;
    ssRes += Math.pow(y - predicted, 2);
    ssTot += Math.pow(y - yMean, 2);
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Generate predictions for next 180 days
  const lastDay = points[points.length - 1].x;
  const predictions = [7, 30, 90, 180].map((days) => ({
    timestamp: new Date(
      firstTimestamp + (lastDay + days) * 24 * 60 * 60 * 1000,
    ),
    value: slope * (lastDay + days) + intercept,
  }));

  return {
    slope,
    intercept,
    rSquared,
    predictions,
  };
}

/**
 * Calculate growth rates
 */
function calculateGrowthRates(
  slope: number,
  currentValue: number,
): { daily: number; weekly: number; monthly: number } {
  if (currentValue === 0) {
    return { daily: 0, weekly: 0, monthly: 0 };
  }

  const dailyRate = (slope / currentValue) * 100;
  const weeklyRate = dailyRate * 7;
  const monthlyRate = dailyRate * 30;

  return {
    daily: dailyRate,
    weekly: weeklyRate,
    monthly: monthlyRate,
  };
}

/**
 * Determine trend based on slope and data
 */
function determineTrend(
  slope: number,
  currentValue: number,
): "growing" | "stable" | "declining" {
  if (currentValue === 0) return "stable";

  const dailyChangePercent = Math.abs((slope / currentValue) * 100);

  // Less than 0.1% daily change is considered stable
  if (dailyChangePercent < 0.1) return "stable";

  return slope > 0 ? "growing" : "declining";
}

/**
 * Generate capacity forecast from historical data
 */
export function forecastCapacity(
  data: DataPoint[],
  label: string = "storage",
): CapacityForecast | null {
  if (data.length < 3) {
    return null;
  }

  // Sort by timestamp
  const sorted = [...data].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const regression = linearRegression(sorted);
  if (!regression) {
    return null;
  }

  const currentValue = sorted[sorted.length - 1].value;
  const currentTimestamp = sorted[sorted.length - 1].timestamp;

  const growthRates = calculateGrowthRates(regression.slope, currentValue);
  const trend = determineTrend(regression.slope, currentValue);

  // Calculate predictions
  const predictions = {
    nextWeek: regression.predictions[0].value,
    nextMonth: regression.predictions[1].value,
    next3Months: regression.predictions[2].value,
    next6Months: regression.predictions[3].value,
  };

  // Generate warnings if needed
  let warning: string | undefined;

  if (trend === "declining" && predictions.nextMonth < currentValue * 0.5) {
    warning = `${label} is declining rapidly. Projected to decrease by 50%+ in the next month.`;
  } else if (trend === "growing" && predictions.nextMonth > currentValue * 2) {
    warning = `${label} is growing rapidly. Projected to double in the next month.`;
  } else if (regression.rSquared < 0.3) {
    warning = `Low forecast confidence (${(regression.rSquared * 100).toFixed(0)}%). Data is highly variable.`;
  }

  return {
    currentValue,
    currentTimestamp,
    dailyGrowthRate: growthRates.daily,
    weeklyGrowthRate: growthRates.weekly,
    monthlyGrowthRate: growthRates.monthly,
    predictions,
    trend,
    confidence: regression.rSquared,
    warning,
  };
}

/**
 * Forecast storage capacity for a node
 */
export interface StorageForecast extends CapacityForecast {
  estimatedCapacityLimit?: number;
  daysUntilCapacity?: number;
}

export function forecastStorageGrowth(
  storageHistory: DataPoint[],
  estimatedCapacity?: number,
): StorageForecast | null {
  const forecast = forecastCapacity(storageHistory, "Storage");
  if (!forecast) return null;

  const result: StorageForecast = {
    ...forecast,
    estimatedCapacityLimit: estimatedCapacity,
  };

  // Calculate days until capacity limit is reached
  if (estimatedCapacity && forecast.dailyGrowthRate > 0) {
    const remainingCapacity = estimatedCapacity - forecast.currentValue;
    if (remainingCapacity > 0) {
      const dailyGrowth =
        forecast.currentValue * (forecast.dailyGrowthRate / 100);
      if (dailyGrowth > 0) {
        result.daysUntilCapacity = Math.floor(remainingCapacity / dailyGrowth);
      }
    }
  }

  return result;
}

/**
 * Forecast network growth (node count)
 */
export interface NetworkGrowthForecast {
  currentNodeCount: number;
  activeNodeCount: number;
  predictions: {
    nextWeek: number;
    nextMonth: number;
    next3Months: number;
  };
  trend: "growing" | "stable" | "declining";
  dailyGrowthRate: number;
  confidence: number;
  churnRate: number; // Percentage of nodes going inactive
}

export function forecastNetworkGrowth(
  nodeCountHistory: DataPoint[],
  currentActive: number,
  currentTotal: number,
): NetworkGrowthForecast | null {
  const forecast = forecastCapacity(nodeCountHistory, "Node count");
  if (!forecast) return null;

  // Calculate churn rate
  const churnRate =
    currentTotal > 0
      ? ((currentTotal - currentActive) / currentTotal) * 100
      : 0;

  return {
    currentNodeCount: currentTotal,
    activeNodeCount: currentActive,
    predictions: {
      nextWeek: Math.round(forecast.predictions.nextWeek),
      nextMonth: Math.round(forecast.predictions.nextMonth),
      next3Months: Math.round(forecast.predictions.next3Months),
    },
    trend: forecast.trend,
    dailyGrowthRate: forecast.dailyGrowthRate,
    confidence: forecast.confidence,
    churnRate,
  };
}

/**
 * Aggregate forecasts for network-wide summary
 */
export interface NetworkCapacityForecast {
  totalStorage: CapacityForecast;
  nodeCount: NetworkGrowthForecast;
  summary: {
    healthScore: number; // 0-100
    outlook: "positive" | "neutral" | "concerning";
    highlights: string[];
  };
}

export function generateNetworkForecastSummary(
  storageForecast: CapacityForecast | null,
  nodeForecast: NetworkGrowthForecast | null,
): NetworkCapacityForecast["summary"] {
  const highlights: string[] = [];
  let healthScore = 70; // Base score

  if (storageForecast) {
    if (storageForecast.trend === "growing") {
      healthScore += 10;
      highlights.push(
        `Storage capacity growing at ${storageForecast.monthlyGrowthRate.toFixed(1)}% monthly`,
      );
    } else if (storageForecast.trend === "declining") {
      healthScore -= 15;
      highlights.push("Warning: Storage capacity declining");
    }

    if (storageForecast.confidence > 0.7) {
      highlights.push("High prediction confidence");
    }
  }

  if (nodeForecast) {
    if (nodeForecast.trend === "growing") {
      healthScore += 10;
      highlights.push(
        `Network expanding: ${nodeForecast.predictions.nextMonth - nodeForecast.currentNodeCount} new nodes expected this month`,
      );
    } else if (nodeForecast.trend === "declining") {
      healthScore -= 20;
      highlights.push("Warning: Network node count declining");
    }

    if (nodeForecast.churnRate > 20) {
      healthScore -= 10;
      highlights.push(
        `High churn rate: ${nodeForecast.churnRate.toFixed(1)}% inactive nodes`,
      );
    }
  }

  // Determine outlook
  let outlook: "positive" | "neutral" | "concerning" = "neutral";
  if (healthScore >= 80) outlook = "positive";
  else if (healthScore < 60) outlook = "concerning";

  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    outlook,
    highlights,
  };
}
