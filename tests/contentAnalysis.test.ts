import { describe, it, expect } from "vitest";
import { analyzeContent } from "../src/detection/contentAnalysis";

describe("analyzeContent", () => {
  it("returns no findings for ordinary content", () => {
    expect(analyzeContent("Welcome to our blog about gardening tips and recipes.")).toEqual([]);
  });

  it("flags a single urgency phrase", () => {
    const findings = analyzeContent("Please verify your account to continue using our service.");
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("URGENCY_LANGUAGE");
    expect(findings[0].weight).toBe(8);
  });

  it("scales weight with the number of matched phrases, capped at 25", () => {
    const text = "act now, account suspended, verify your account, final notice, urgent action";
    const findings = analyzeContent(text);
    expect(findings[0].weight).toBe(25);
  });

  it("is case-insensitive", () => {
    expect(analyzeContent("VERIFY YOUR ACCOUNT IMMEDIATELY")).toHaveLength(1);
  });
});
