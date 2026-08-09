import { describe, it, expect } from "vitest";
import { generateLabeledScenarios, runBenchmark } from "../src/detection/syntheticEval";

describe("generateLabeledScenarios", () => {
  it("produces an equal split of benign and phishing scenarios", () => {
    const scenarios = generateLabeledScenarios(7, 20);
    expect(scenarios).toHaveLength(40);
    expect(scenarios.filter((s) => s.isPhishing)).toHaveLength(20);
    expect(scenarios.filter((s) => !s.isPhishing)).toHaveLength(20);
  });

  it("is deterministic for a given seed", () => {
    const a = generateLabeledScenarios(42, 10);
    const b = generateLabeledScenarios(42, 10);
    expect(a.map((s) => s.signals.hostname)).toEqual(b.map((s) => s.signals.hostname));
  });
});

describe("runBenchmark", () => {
  it("reports well-formed metrics", () => {
    const metrics = runBenchmark(7, 150, 45);
    expect(metrics.totalScenarios).toBe(300);
    for (const key of ["precision", "recall", "f1", "accuracy", "falsePositiveRate"] as const) {
      expect(metrics[key]).toBeGreaterThanOrEqual(0);
      expect(metrics[key]).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the false positive rate low -- benign sites should rarely be flagged", () => {
    const metrics = runBenchmark(7, 150, 45);
    expect(metrics.falsePositiveRate).toBeLessThan(0.05);
  });

  it("catches the large majority of phishing scenarios despite some being deliberately weak-signal-only", () => {
    const metrics = runBenchmark(7, 150, 45);
    expect(metrics.recall).toBeGreaterThan(0.6);
  });
});
