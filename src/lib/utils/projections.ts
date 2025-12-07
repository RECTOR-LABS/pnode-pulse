/**
 * Projection Utilities
 *
 * Functions for calculating linear regression and projections
 */

interface DataPoint {
  time: Date;
  value: number;
}

/**
 * Calculate linear regression coefficients
 */
export function linearRegression(data: DataPoint[]): { slope: number; intercept: number; r2: number } {
  if (data.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = data.length;

  // Convert times to numeric values (days from first point)
  const firstTime = data[0].time.getTime();
  const points = data.map(d => ({
    x: (d.time.getTime() - firstTime) / (1000 * 60 * 60 * 24), // Days
    y: d.value,
  }));

  // Calculate means
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  let ssTotal = 0;
  let ssResidual = 0;

  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Calculate R² (coefficient of determination)
  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssResidual += (point.y - predicted) ** 2;
    ssTotal += (point.y - meanY) ** 2;
  }

  const r2 = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

/**
 * Project future values using linear regression
 */
export function projectValues(
  data: DataPoint[],
  daysAhead: number,
  pointCount: number = 10
): DataPoint[] {
  if (data.length < 2) {
    return [];
  }

  const { slope, intercept } = linearRegression(data);
  const firstTime = data[0].time.getTime();
  const lastTime = data[data.length - 1].time.getTime();
  const lastX = (lastTime - firstTime) / (1000 * 60 * 60 * 24);

  const projections: DataPoint[] = [];
  for (let i = 1; i <= pointCount; i++) {
    const x = lastX + (daysAhead / pointCount) * i;
    const time = new Date(firstTime + x * 24 * 60 * 60 * 1000);
    const value = Math.max(0, slope * x + intercept); // Don't go negative
    projections.push({ time, value });
  }

  return projections;
}

/**
 * Calculate when a milestone will be reached
 */
export function projectMilestone(
  data: DataPoint[],
  targetValue: number
): { date: Date | null; daysFromNow: number | null } {
  if (data.length < 2) {
    return { date: null, daysFromNow: null };
  }

  const { slope, intercept } = linearRegression(data);

  if (slope <= 0) {
    // Not growing, will never reach milestone
    return { date: null, daysFromNow: null };
  }

  const firstTime = data[0].time.getTime();
  const x = (targetValue - intercept) / slope;
  const milestoneTime = firstTime + x * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (milestoneTime < now) {
    // Already passed
    return { date: null, daysFromNow: null };
  }

  return {
    date: new Date(milestoneTime),
    daysFromNow: Math.ceil((milestoneTime - now) / (24 * 60 * 60 * 1000)),
  };
}
