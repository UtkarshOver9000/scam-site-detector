import { Finding, FormInfo } from "./types";

export function analyzeTransport(isHttps: boolean, forms: FormInfo[]): Finding[] {
  if (isHttps) return [];
  const hasSensitiveForm = forms.some((f) => f.hasPasswordField);
  if (!hasSensitiveForm) return [];

  return [
    {
      code: "INSECURE_TRANSPORT",
      message: "Page collects a password over an insecure (non-HTTPS) connection",
      weight: 30,
    },
  ];
}
