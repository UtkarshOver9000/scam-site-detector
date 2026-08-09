import { describe, it, expect } from "vitest";
import { classifyField, analyzeForms } from "../src/detection/formAnalysis";
import { FormInfo } from "../src/detection/types";

describe("classifyField", () => {
  it("identifies an OTP field by name", () => {
    expect(classifyField({ type: "text", name: "otp_code", autocomplete: null }).isOtp).toBe(true);
  });

  it("identifies a card number field by autocomplete attribute", () => {
    expect(classifyField({ type: "text", name: "cc", autocomplete: "cc-number" }).isCard).toBe(true);
  });

  it("does not misclassify an ordinary username field", () => {
    const result = classifyField({ type: "text", name: "username", autocomplete: "username" });
    expect(result.isOtp).toBe(false);
    expect(result.isCard).toBe(false);
  });
});

describe("analyzeForms", () => {
  const loginForm = (actionOrigin: string | null): FormInfo => ({
    actionOrigin,
    hasPasswordField: true,
    fields: [{ type: "password", name: "password", autocomplete: "current-password" }],
  });

  it("flags a password form submitting cross-origin", () => {
    const findings = analyzeForms([loginForm("https://attacker-server.example")], "https://real-site.com");
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("FORM_ACTION_MISMATCH");
  });

  it("does not flag a password form submitting same-origin", () => {
    expect(analyzeForms([loginForm("https://real-site.com")], "https://real-site.com")).toEqual([]);
  });

  it("does not flag a cross-origin checkout form without a password field", () => {
    const checkoutForm: FormInfo = {
      actionOrigin: "https://checkout.stripe.com",
      hasPasswordField: false,
      fields: [{ type: "text", name: "cc-number", autocomplete: "cc-number" }],
    };
    expect(analyzeForms([checkoutForm], "https://real-shop.com")).toEqual([]);
  });

  it("handles a page with no forms", () => {
    expect(analyzeForms([], "https://real-site.com")).toEqual([]);
  });
});
