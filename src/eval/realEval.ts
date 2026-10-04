/**
 * Evaluates the extension's scorer on real data.
 *
 *   npm run eval -- --phiusiil data/PhiUSIIL_Phishing_URL_Dataset.csv \
 *                   --tranco data/top-1m.csv --openphish data/openphish-feed.txt
 *
 * 1. PhiUSIIL (UCI #967): 235,795 real pages with crawled page features. Each
 *    row becomes the PageSignals the extension would extract: hostname and
 *    origin from the URL, HTTPS from IsHTTPS, and a password form from
 *    HasPasswordField that submits cross-origin when HasExternalFormSubmit is
 *    set. The dataset has no page body text, so the urgency detector only sees
 *    the page title.
 * 2. OpenPhish community feed: phishing URLs live on the day of the run.
 *    Only the URL is used (nothing is fetched), so only the domain detector
 *    can fire.
 * 3. Tranco top-1M: real popular domains. Domain-detector false alarms.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { analyzeDomain } from "../detection/domainAnalysis";
import { scorePage } from "../detection/scorer";
import { PageSignals } from "../detection/types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface Counts {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export function rates(c: Counts) {
  const r = (x: number) => Math.round(x * 10000) / 10000;
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 0;
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0;
  return {
    confusion_matrix: c,
    accuracy: r((c.tp + c.tn) / (c.tp + c.tn + c.fp + c.fn)),
    precision: r(precision),
    recall: r(recall),
    f1: r(precision + recall ? (2 * precision * recall) / (precision + recall) : 0),
    false_positive_rate: r(c.fp + c.tn ? c.fp / (c.fp + c.tn) : 0),
  };
}

/** ROC-AUC of a score, as the probability a random phishing page outscores a random legitimate one (ties count half). */
export function rocAuc(scores: number[], labels: number[]): number {
  const pos = scores.filter((_, i) => labels[i] === 1);
  const neg = scores.filter((_, i) => labels[i] === 0);
  const counts = new Map<number, [number, number]>();
  for (const s of pos) counts.set(s, [(counts.get(s)?.[0] ?? 0) + 1, counts.get(s)?.[1] ?? 0]);
  for (const s of neg) counts.set(s, [counts.get(s)?.[0] ?? 0, (counts.get(s)?.[1] ?? 0) + 1]);
  let negBelow = 0;
  let wins = 0;
  for (const s of [...counts.keys()].sort((a, b) => a - b)) {
    const [p, n] = counts.get(s)!;
    wins += p * (negBelow + n / 2);
    negBelow += n;
  }
  return Math.round((wins / (pos.length * neg.length)) * 10000) / 10000;
}

export function signalsFromPhiusiil(row: Record<string, string>): PageSignals {
  let url: URL;
  try {
    url = new URL(row.URL.includes("://") ? row.URL : `http://${row.URL}`);
  } catch {
    url = new URL(`http://${row.Domain}`);
  }
  const origin = `${url.protocol}//${url.hostname}`;
  const hasPassword = row.HasPasswordField === "1";
  return {
    hostname: url.hostname,
    origin,
    isHttps: row.IsHTTPS === "1",
    bodyText: row.Title ?? "",
    forms: hasPassword
      ? [
          {
            actionOrigin: row.HasExternalFormSubmit === "1" ? "https://external-form-target.invalid" : origin,
            hasPasswordField: true,
            fields: [{ type: "password", name: "password", autocomplete: null }],
          },
        ]
      : [],
  };
}

function tally(predicted: boolean[], labels: number[]): Counts {
  const c: Counts = { tp: 0, fp: 0, tn: 0, fn: 0 };
  predicted.forEach((p, i) => {
    if (p && labels[i]) c.tp++;
    else if (p) c.fp++;
    else if (labels[i]) c.fn++;
    else c.tn++;
  });
  return c;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function main(): void {
  const phiPath = arg("phiusiil", "data/PhiUSIIL_Phishing_URL_Dataset.csv");
  const trancoPath = arg("tranco", "data/top-1m.csv");
  const feedPath = arg("openphish", "data/openphish-feed.txt");
  const out = arg("out", "reports/real_eval.json");

  // --- PhiUSIIL -----------------------------------------------------------
  const rows = parseCsv(readFileSync(phiPath, "utf8").replace(/^﻿/, ""));
  const header = rows[0];
  const records = rows.slice(1).filter((r) => r.length === header.length);
  const labels: number[] = [];
  const scores: number[] = [];
  const domainScores: number[] = [];
  const fired: Record<string, [number, number]> = {};
  for (const r of records) {
    const row = Object.fromEntries(header.map((h, i) => [h, r[i]]));
    const label = row.label === "0" ? 1 : 0; // PhiUSIIL: 0 = phishing, 1 = legitimate
    const result = scorePage(signalsFromPhiusiil(row));
    labels.push(label);
    scores.push(result.score);
    domainScores.push(analyzeDomain(signalsFromPhiusiil(row).hostname).reduce((s, f) => s + f.weight, 0));
    for (const f of result.findings) {
      fired[f.code] ??= [0, 0];
      fired[f.code][label]++;
    }
  }
  const nPhish = labels.filter((l) => l === 1).length;
  const nLegit = labels.length - nPhish;
  const detectorRates = Object.fromEntries(
    Object.entries(fired).map(([code, [legit, phish]]) => [
      code,
      {
        fires_on_phishing_pages: Math.round((phish / nPhish) * 10000) / 10000,
        fires_on_legitimate_pages: Math.round((legit / nLegit) * 10000) / 10000,
        precision_when_it_fires: Math.round((phish / (phish + legit)) * 10000) / 10000,
      },
    ]),
  );

  // --- Live OpenPhish (domain detector only) ------------------------------
  const feed = readFileSync(feedPath, "utf8").split(/\r?\n/).filter(Boolean);
  const feedHits = feed.filter((u) => {
    try {
      return analyzeDomain(new URL(u).hostname).length > 0;
    } catch {
      return false;
    }
  }).length;

  // --- Tranco (domain detector false alarms) ------------------------------
  const tranco = readFileSync(trancoPath, "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split(",")[1]);
  const trancoFlags = tranco.filter((d) => analyzeDomain(d).length > 0);

  const report = {
    data: {
      phiusiil: { file: phiPath, sha256: sha256(phiPath), pages: labels.length, phishing: nPhish, legitimate: nLegit },
      openphish: { file: feedPath, sha256: sha256(feedPath), urls: feed.length },
      tranco: { file: trancoPath, sha256: sha256(trancoPath), domains: tranco.length },
    },
    phiusiil_full_scorer: {
      roc_auc_of_score: rocAuc(scores, labels),
      at_score_45_high: rates(tally(scores.map((s) => s >= 45), labels)),
      at_score_20_medium: rates(tally(scores.map((s) => s >= 20), labels)),
      detectors: detectorRates,
    },
    phiusiil_domain_detector_only: {
      roc_auc_of_score: rocAuc(domainScores, labels),
      flags_any_domain_finding: rates(tally(domainScores.map((s) => s > 0), labels)),
    },
    openphish_live_domain_detector: {
      urls: feed.length,
      flagged: feedHits,
      recall: Math.round((feedHits / feed.length) * 10000) / 10000,
    },
    tranco_domain_detector: {
      domains: tranco.length,
      flagged: trancoFlags.length,
      false_positive_rate: Math.round((trancoFlags.length / tranco.length) * 1e6) / 1e6,
      examples_flagged_in_top_1000: tranco.slice(0, 1000).filter((d) => analyzeDomain(d).length > 0),
    },
  };
  mkdirSync(out.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/eval/realEval.ts")) main();
