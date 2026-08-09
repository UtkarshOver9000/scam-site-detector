import { Finding } from "./types";

const URGENCY_PHRASES = [
  "act now",
  "verify your account",
  "account suspended",
  "account will be locked",
  "confirm your identity",
  "unusual activity detected",
  "click here immediately",
  "account has been limited",
  "action required",
  "act immediately",
  "urgent action",
  "final notice",
  "account will be closed",
  "verify now",
  "your account will be permanently",
];

export function analyzeContent(bodyText: string): Finding[] {
  const lower = bodyText.toLowerCase();
  const matched = URGENCY_PHRASES.filter((phrase) => lower.includes(phrase));
  if (matched.length === 0) return [];

  const weight = Math.min(25, 8 * matched.length);
  return [
    {
      code: "URGENCY_LANGUAGE",
      message: `Page contains ${matched.length} urgency/pressure phrase(s): ${matched.slice(0, 3).join(", ")}${matched.length > 3 ? ", ..." : ""}`,
      weight,
    },
  ];
}
