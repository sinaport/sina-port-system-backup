// Decision engine: win probability + confidence.
// Implements the reference win-probability and confidence model, verified for
// parity against it. Difference from the reference: benchmarks are passed in
// (loaded from the live engine.v_data_kpi_benchmark table) instead of hardcoded,
// so targets are tunable without changing this math.

export interface Benchmarks {
  cpl: number; // EUR, lower is better
  leadToCall: number; // 0..1, higher is better
  callToShow: number; // 0..1
  showToHto: number; // 0..1
}

export interface Weights {
  cpl: number;
  leadToCall: number;
  callToShow: number;
  showToHto: number;
  trend: number;
  stability: number;
}

export interface Metrics {
  cpl: number;
  leadToCall: number;
  callToShow: number;
  showToHto: number;
  trend: number; // 0..1, already normalised (1 improving, 0 fatiguing)
  stability: number; // 0..1
  leads: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  cpl: 0.2,
  leadToCall: 0.2,
  callToShow: 0.15,
  showToHto: 0.25,
  trend: 0.1,
  stability: 0.1,
};

export const STEEPNESS = 4;

export const CONFIDENCE_TIERS: Array<[number, number]> = [
  [250, 100],
  [100, 90],
  [50, 70],
  [25, 50],
  [10, 30],
  [0, 10],
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const logistic = (ratio: number, k = STEEPNESS) => 1 / (1 + Math.exp(-k * (ratio - 1)));
const scoreHigher = (v: number, b: number, k = STEEPNESS) => logistic(v / b, k);
const scoreLower = (v: number, b: number, k = STEEPNESS) => logistic(b / v, k);

export interface Signals {
  cpl: number;
  leadToCall: number;
  callToShow: number;
  showToHto: number;
  trend: number;
  stability: number;
}

export function winProbability(
  m: Metrics,
  benchmarks: Benchmarks,
  weights: Weights = DEFAULT_WEIGHTS,
  k = STEEPNESS
): { probability: number; signals: Signals } {
  const signals: Signals = {
    cpl: scoreLower(m.cpl, benchmarks.cpl, k),
    leadToCall: scoreHigher(m.leadToCall, benchmarks.leadToCall, k),
    callToShow: scoreHigher(m.callToShow, benchmarks.callToShow, k),
    showToHto: scoreHigher(m.showToHto, benchmarks.showToHto, k),
    trend: clamp01(m.trend),
    stability: clamp01(m.stability),
  };
  const raw =
    weights.cpl * signals.cpl +
    weights.leadToCall * signals.leadToCall +
    weights.callToShow * signals.callToShow +
    weights.showToHto * signals.showToHto +
    weights.trend * signals.trend +
    weights.stability * signals.stability;
  return { probability: Math.round(clamp01(raw) * 100), signals };
}

export function confidence(leads: number, tiers = CONFIDENCE_TIERS): number {
  for (const [minLeads, score] of tiers) {
    if (leads >= minLeads) return score;
  }
  return 0;
}

// Trend from a daily series of a lower-is-better metric (CAC or CPL).
// Falling cost => improving => toward 1.
export function trendScore(series: number[], k = STEEPNESS): number {
  if (!series || series.length < 4) return 0.5;
  const mid = Math.floor(series.length / 2);
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const earlier = avg(series.slice(0, mid));
  const recent = avg(series.slice(mid));
  if (recent <= 0) return 0.5;
  return clamp01(logistic(earlier / recent, k));
}

// Stability = 1 - coefficient of variation of a daily series.
export function stabilityScore(series: number[]): number {
  if (!series || series.length < 3) return 0.5;
  const mean = series.reduce((s, x) => s + x, 0) / series.length;
  if (mean === 0) return 0.5;
  const variance = series.reduce((s, x) => s + (x - mean) ** 2, 0) / series.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return clamp01(1 - cv);
}

// Discovery (ABO): graduate winners, cut losers, keep the rest testing.
export function aboDecision(prob: number, conf: number): string {
  if (prob > 85 && conf > 60) return "Graduate";
  if (prob >= 40 && prob <= 85) return "Keep Testing";
  if (prob > 85) return "Keep Testing";
  return conf > 40 ? "Replace" : "Keep Testing";
}

// Scaling (CBO): probability x confidence sets how aggressively to fund.
export function cboDecision(prob: number, conf: number): string {
  if (prob >= 90 && conf >= 95) return "Increase Budget 40%";
  if (prob >= 87 && conf >= 75) return "Increase Budget 30%";
  if (prob >= 82 && conf >= 60) return "Increase Budget 20%";
  if (prob >= 58) return "Hold";
  if (prob >= 40) return conf >= 60 ? "Reduce Budget 20%" : "Hold";
  return conf >= 70 ? "Exit" : "Reduce Budget 20%";
}

export function scoreCreative(m: Metrics, benchmarks: Benchmarks, weights = DEFAULT_WEIGHTS) {
  const { probability, signals } = winProbability(m, benchmarks, weights);
  return { probability, confidence: confidence(m.leads), signals };
}
