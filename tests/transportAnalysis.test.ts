import { describe, it, expect } from "vitest";
import { analyzeTransport } from "../src/detection/transportAnalysis";
import { FormInfo } from "../src/detection/types";

const passwordForm: FormInfo = {
  actionOrigin: "https://site.com",
  hasPasswordField: true,
  fields: [],
};

describe("analyzeTransport", () => {
  it("does not flag HTTPS pages", () => {
    expect(analyzeTransport(true, [passwordForm])).toEqual([]);
  });

  it("flags HTTP pages with a password form", () => {
    const findings = analyzeTransport(false, [passwordForm]);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("INSECURE_TRANSPORT");
  });

  it("does not flag HTTP pages without a password form", () => {
    expect(analyzeTransport(false, [])).toEqual([]);
  });
});
