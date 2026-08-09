export interface FormFieldInfo {
  type: string;
  name: string;
  autocomplete: string | null;
}

export interface FormInfo {
  actionOrigin: string | null;
  hasPasswordField: boolean;
  fields: FormFieldInfo[];
}

export interface PageSignals {
  hostname: string;
  origin: string;
  isHttps: boolean;
  bodyText: string;
  forms: FormInfo[];
}

export interface Finding {
  code: string;
  message: string;
  weight: number;
}

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ScoreResult {
  score: number;
  tier: RiskTier;
  findings: Finding[];
}
