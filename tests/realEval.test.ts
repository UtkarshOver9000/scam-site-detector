import { describe, it, expect } from "vitest";
import { parseCsv, rates, rocAuc, signalsFromPhiusiil } from "../src/eval/realEval";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and newlines inside quotes", () => {
    const rows = parseCsv('a,b,c\n1,"x, y","he said ""hi"""\n2,"line1\nline2",z\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'he said "hi"'],
      ["2", "line1\nline2", "z"],
    ]);
  });
});

describe("rates", () => {
  it("computes precision, recall, F1, accuracy and FPR from a confusion matrix", () => {
    const r = rates({ tp: 8, fp: 2, tn: 88, fn: 2 });
    expect(r.precision).toBe(0.8);
    expect(r.recall).toBe(0.8);
    expect(r.f1).toBe(0.8);
    expect(r.accuracy).toBe(0.96);
    expect(r.false_positive_rate).toBe(0.0222);
  });
});

describe("rocAuc", () => {
  it("is 1 for perfect separation, 0.5 for identical scores", () => {
    expect(rocAuc([90, 80, 10, 5], [1, 1, 0, 0])).toBe(1);
    expect(rocAuc([10, 10, 10, 10], [1, 0, 1, 0])).toBe(0.5);
    expect(rocAuc([90, 10, 50, 5], [1, 1, 0, 0])).toBe(0.75);
  });
});

describe("signalsFromPhiusiil", () => {
  it("maps PhiUSIIL page features onto extension signals", () => {
    const s = signalsFromPhiusiil({
      URL: "http://login.paypa1.com/x",
      Domain: "login.paypa1.com",
      IsHTTPS: "0",
      HasPasswordField: "1",
      HasExternalFormSubmit: "1",
      Title: "Verify your account",
    });
    expect(s.hostname).toBe("login.paypa1.com");
    expect(s.isHttps).toBe(false);
    expect(s.forms[0].hasPasswordField).toBe(true);
    expect(s.forms[0].actionOrigin).not.toBe(s.origin);
    expect(s.bodyText).toBe("Verify your account");
  });

  it("keeps the form same-origin when there is no external submit", () => {
    const s = signalsFromPhiusiil({ URL: "https://www.example.com", Domain: "www.example.com", IsHTTPS: "1",
      HasPasswordField: "1", HasExternalFormSubmit: "0", Title: "" });
    expect(s.forms[0].actionOrigin).toBe(s.origin);
  });
});
