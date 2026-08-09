/**
 * Synthetic labeled benchmark for the scorer.
 *
 * Generates realistic benign and phishing page-signal scenarios with known
 * ground truth, so precision/recall/F1 are measured, not asserted. Phishing
 * scenarios deliberately span a difficulty range -- from a single weak signal
 * (should sometimes be missed) to multiple stacked signals (should always be
 * caught) -- so the resulting numbers are informative rather than saturated.
 */

import { PageSignals, FormInfo } from "./types";
import { scorePage } from "./scorer";
import { KNOWN_BRANDS } from "./knownBrands";

interface LabeledScenario {
  id: string;
  signals: PageSignals;
  isPhishing: boolean;
}

// Deterministic PRNG (mulberry32) so results are reproducible across runs/CI.
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChoice<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

const BENIGN_DOMAINS = [
  "mynotes.app", "recipehub.io", "travelblog.net", "opensource-project.dev",
  "localcoffeeshop.com", "studygroup.org", "photogallery.io", "weatherapp.dev",
  "musicplayer.app", "bookclub.net", "hikingtrails.org", "petadoption.io",
  "fitnesstracker.app", "gardeningtips.com", "boardgamehub.net", "codingblog.dev",
  "artportfolio.io", "podcastdirectory.com", "cookingclass.app", "cyclingroutes.org",
];

function buildBenignScenario(rng: () => number, id: string): LabeledScenario {
  const hostname = randomChoice(rng, BENIGN_DOMAINS);
  const includeForm = rng() < 0.5;
  const forms: FormInfo[] = includeForm
    ? [{ actionOrigin: `https://${hostname}`, hasPasswordField: rng() < 0.6, fields: [] }]
    : [];

  return {
    id,
    isPhishing: false,
    signals: {
      hostname,
      origin: `https://${hostname}`,
      isHttps: true,
      bodyText: "Welcome back. Check out what's new and manage your preferences below.",
      forms,
    },
  };
}

function typosquat(rng: () => number, domain: string): string {
  const idx = randomInt(rng, domain.length);
  const chars = "abcdefghijklmnopqrstuvwxyz0";
  const replacement = chars[randomInt(rng, chars.length)];
  if (domain[idx] === ".") return typosquat(rng, domain); // avoid mangling the dot
  return domain.slice(0, idx) + replacement + domain.slice(idx + 1);
}

type PhishingStrategy = "typo-only" | "subdomain-stuff-only" | "urgency-only" | "form-mismatch-only" | "stacked";

const STRATEGIES: PhishingStrategy[] = [
  "typo-only",
  "subdomain-stuff-only",
  "urgency-only",
  "form-mismatch-only",
  "stacked",
];

function buildPhishingScenario(rng: () => number, id: string): LabeledScenario {
  const brand = randomChoice(rng, KNOWN_BRANDS);
  const strategy = randomChoice(rng, STRATEGIES);
  const brandKey = brand.name.toLowerCase().replace(/\s+/g, "");
  const randomSuffix = randomInt(rng, 9999);

  let hostname = `random-service-${randomSuffix}.com`;
  let bodyText = "Sign in to continue to your account.";
  let forms: FormInfo[] = [];
  let isHttps = true;

  switch (strategy) {
    case "typo-only":
      hostname = typosquat(rng, brand.domain);
      break;
    case "subdomain-stuff-only":
      hostname = `${brandKey}-secure-login.verification-${randomSuffix}.net`;
      break;
    case "urgency-only":
      bodyText = "Your account has been limited. Verify your account now to restore access.";
      break;
    case "form-mismatch-only":
      forms = [{ actionOrigin: "https://data-collector.example", hasPasswordField: true, fields: [] }];
      break;
    case "stacked":
      hostname = typosquat(rng, brand.domain);
      bodyText = "Urgent action required: verify your account now or it will be suspended.";
      forms = [{ actionOrigin: "https://data-collector.example", hasPasswordField: true, fields: [] }];
      isHttps = rng() > 0.5;
      break;
  }

  return {
    id,
    isPhishing: true,
    signals: { hostname, origin: `https://${hostname}`, isHttps, bodyText, forms },
  };
}

export function generateLabeledScenarios(seed: number, countPerClass = 150): LabeledScenario[] {
  const rng = mulberry32(seed);
  const scenarios: LabeledScenario[] = [];
  for (let i = 0; i < countPerClass; i++) {
    scenarios.push(buildBenignScenario(rng, `benign_${i}`));
    scenarios.push(buildPhishingScenario(rng, `phishing_${i}`));
  }
  return scenarios;
}

export interface BenchmarkMetrics {
  totalScenarios: number;
  decisionThreshold: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  falsePositiveRate: number;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

export function runBenchmark(seed = 7, countPerClass = 150, decisionThreshold = 45): BenchmarkMetrics {
  const scenarios = generateLabeledScenarios(seed, countPerClass);
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const scenario of scenarios) {
    const result = scorePage(scenario.signals);
    const predictedPhishing = result.score >= decisionThreshold;
    if (predictedPhishing && scenario.isPhishing) tp++;
    else if (predictedPhishing && !scenario.isPhishing) fp++;
    else if (!predictedPhishing && scenario.isPhishing) fn++;
    else tn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / scenarios.length;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;

  return {
    totalScenarios: scenarios.length,
    decisionThreshold,
    precision: round4(precision),
    recall: round4(recall),
    f1: round4(f1),
    accuracy: round4(accuracy),
    falsePositiveRate: round4(falsePositiveRate),
  };
}
