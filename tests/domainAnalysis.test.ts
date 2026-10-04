import { describe, it, expect } from "vitest";
import { levenshteinDistance, getRegistrableDomain, analyzeDomain } from "../src/detection/domainAnalysis";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("paypal.com", "paypal.com")).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(levenshteinDistance("paypal.com", "paypa1.com")).toBe(1);
  });

  it("counts insertions", () => {
    expect(levenshteinDistance("paypal.com", "paypaal.com")).toBe(1);
  });
});

describe("getRegistrableDomain", () => {
  it("strips subdomains", () => {
    expect(getRegistrableDomain("secure.login.paypal.com")).toBe("paypal.com");
  });

  it("leaves a bare domain unchanged", () => {
    expect(getRegistrableDomain("paypal.com")).toBe("paypal.com");
  });

  it("uses the Public Suffix List for multi-part suffixes", () => {
    expect(getRegistrableDomain("login.bbc.co.uk")).toBe("bbc.co.uk");
    expect(getRegistrableDomain("secure.sbi.co.in")).toBe("sbi.co.in");
  });

  it("treats hosting-platform subdomains as their own domain", () => {
    expect(getRegistrableDomain("paypal-login.pages.dev")).toBe("paypal-login.pages.dev");
  });
});

describe("analyzeDomain", () => {
  it("returns no findings for the real brand domain", () => {
    expect(analyzeDomain("www.paypal.com")).toEqual([]);
    expect(analyzeDomain("paypal.com")).toEqual([]);
  });

  it("flags a 1-character typosquat", () => {
    const findings = analyzeDomain("paypa1.com");
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("LOOKALIKE_DOMAIN_TYPO");
  });

  it("flags a brand name stuffed into an unrelated domain", () => {
    const findings = analyzeDomain("paypal-secure-login.verification-portal.net");
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("BRAND_NAME_IN_SUBDOMAIN");
  });

  it("does not flag an unrelated, legitimate-looking domain", () => {
    expect(analyzeDomain("example.com")).toEqual([]);
    expect(analyzeDomain("my-personal-blog.dev")).toEqual([]);
  });
});
