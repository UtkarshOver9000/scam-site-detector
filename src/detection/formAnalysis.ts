import { Finding, FormFieldInfo, FormInfo } from "./types";

// Leading \b only (not trailing) on most alternatives: real-world field
// names like "otp_code" or "otp-input" have no word boundary between "otp"
// and the following underscore/hyphen, since \b only fires between a \w and
// non-\w character and "_" itself counts as \w.
const OTP_PATTERN = /\botp|\bone[-\s]?time|\bverification[-\s]?code|\bauth[-\s]?code|\b2fa\b/i;
const CARD_PATTERN = /\bcard ?number|\bcc ?number|\bcredit ?card|\bcvv|\bcvc/i;

export function classifyField(field: FormFieldInfo): { isOtp: boolean; isCard: boolean } {
  const haystack = `${field.name} ${field.autocomplete ?? ""}`.toLowerCase();
  return {
    isOtp: OTP_PATTERN.test(haystack),
    isCard: CARD_PATTERN.test(haystack) || field.autocomplete === "cc-number",
  };
}

// Only flags a cross-origin form action when the form also collects a
// password. Checkout forms legitimately submit to a different origin (e.g. a
// payment processor) all the time -- that's normal and not phishing. A LOGIN
// form doing the same thing essentially never is legitimate, so restricting
// to password fields keeps this from flagging ordinary checkout flows.
// Documented tradeoff: this could still false-positive on some enterprise
// SSO setups that post credentials cross-origin by design.
export function analyzeForms(forms: FormInfo[], pageOrigin: string): Finding[] {
  for (const form of forms) {
    if (!form.hasPasswordField) continue;
    if (form.actionOrigin && form.actionOrigin !== pageOrigin) {
      return [
        {
          code: "FORM_ACTION_MISMATCH",
          message: `A form collecting a password submits to "${form.actionOrigin}", a different origin than the page itself ("${pageOrigin}")`,
          weight: 45,
        },
      ];
    }
  }
  return [];
}
