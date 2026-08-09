import { describe, it, expect } from "vitest";
import { scorePage } from "../src/detection/scorer";
import { PageSignals } from "../src/detection/types";

function baseSignals(overrides: Partial<PageSignals> = {}): PageSignals {
  return {
    hostname: "example.com",
    origin: "https://example.com",
    isHttps: true,
    bodyText: "Welcome to our site.",
    forms: [],
    ...overrides,
  };
}

describe("scorePage", () => {
  it("scores a benign page as LOW", () => {
    const result = scorePage(baseSignals());
    expect(result.tier).toBe("LOW");
    expect(result.score).toBeLessThan(20);
  });

  it("scores lone urgency language as MEDIUM at most -- weak evidence alone", () => {
    const result = scorePage(
      baseSignals({
        bodyText: "Act now: your account has been limited. Verify your account to avoid closure.",
      }),
    );
    expect(result.tier).toBe("MEDIUM");
  });

  it("scores a lone brand-name-stuffed subdomain as HIGH -- structural signals are strong alone", () => {
    const result = scorePage(baseSignals({ hostname: "paypal-updates.randomsite.net" }));
    expect(result.tier).toBe("HIGH");
  });

  it("scores a lone strong signal (domain typo) as HIGH", () => {
    const result = scorePage(baseSignals({ hostname: "paypa1.com" }));
    expect(result.tier).toBe("HIGH");
  });

  it("escalates to CRITICAL when multiple strong signals stack", () => {
    const result = scorePage(
      baseSignals({
        hostname: "paypal-secure-login.verification-portal.net",
        origin: "https://paypal-secure-login.verification-portal.net",
        bodyText: "Your account has been limited. Verify your account now. Act immediately.",
        forms: [
          {
            actionOrigin: "https://collector.example",
            hasPasswordField: true,
            fields: [],
          },
        ],
      }),
    );
    expect(result.tier).toBe("CRITICAL");
    expect(result.score).toBe(100);
    expect(result.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(["BRAND_NAME_IN_SUBDOMAIN", "FORM_ACTION_MISMATCH", "URGENCY_LANGUAGE"]),
    );
  });

  it("never exceeds a score of 100", () => {
    const result = scorePage(
      baseSignals({
        hostname: "paypal-verify.example",
        isHttps: false,
        bodyText: "act now verify your account account suspended final notice urgent action",
        forms: [{ actionOrigin: "https://evil.example", hasPasswordField: true, fields: [] }],
      }),
    );
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
