import { Finding, PageSignals, ScoreResult, RiskTier } from "./types";
import { analyzeDomain } from "./domainAnalysis";
import { analyzeForms } from "./formAnalysis";
import { analyzeContent } from "./contentAnalysis";
import { analyzeTransport } from "./transportAnalysis";

function tierFor(score: number): RiskTier {
  if (score >= 70) return "CRITICAL";
  if (score >= 45) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
}

export function scorePage(signals: PageSignals): ScoreResult {
  const findings: Finding[] = [
    ...analyzeDomain(signals.hostname),
    ...analyzeForms(signals.forms, signals.origin),
    ...analyzeContent(signals.bodyText),
    ...analyzeTransport(signals.isHttps, signals.forms),
  ];

  const score = Math.min(100, findings.reduce((sum, f) => sum + f.weight, 0));

  return { score, tier: tierFor(score), findings };
}
