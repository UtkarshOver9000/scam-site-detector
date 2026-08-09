/**
 * Integration test: runs the REAL extraction + scoring pipeline against the
 * actual demo HTML files shipped in demo/, not hand-constructed PageSignals
 * objects. This is the closest thing to an end-to-end test without actually
 * loading the packed extension into a browser.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { JSDOM } from "jsdom";
import { extractPageSignals } from "../src/content/extractSignals";
import { scorePage } from "../src/detection/scorer";

function scoreDemoPage(filename: string, url: string) {
  const html = readFileSync(resolve(__dirname, "../demo", filename), "utf-8");
  const dom = new JSDOM(html, { url });
  const signals = extractPageSignals(dom.window.document, dom.window.location as unknown as Location);
  return scorePage(signals);
}

describe("demo pages (real DOM extraction, not hand-built fixtures)", () => {
  it("scores benign.html as LOW", () => {
    const result = scoreDemoPage("benign.html", "https://scam-site-detector-demo.example/benign.html");
    expect(result.tier).toBe("LOW");
  });

  it("scores borderline.html as MEDIUM", () => {
    const result = scoreDemoPage("borderline.html", "https://scam-site-detector-demo.example/borderline.html");
    expect(result.tier).toBe("MEDIUM");
    expect(result.findings.map((f) => f.code)).toEqual(["URGENCY_LANGUAGE"]);
  });

  it("scores suspicious-form.html as CRITICAL", () => {
    const result = scoreDemoPage(
      "suspicious-form.html",
      "https://scam-site-detector-demo.example/suspicious-form.html",
    );
    expect(result.tier).toBe("CRITICAL");
    expect(result.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(["FORM_ACTION_MISMATCH", "URGENCY_LANGUAGE"]),
    );
  });
});
