# Scam Site Detector

![CI](https://github.com/UtkarshOver9000/scam-site-detector/actions/workflows/ci.yml/badge.svg)

A browser extension that scores the page you're actually on for phishing/scam signals in
real time — lookalike domains, forms that collect a password but submit somewhere else,
urgency/pressure language — and shows a risk tier in the toolbar badge and popup. No
server, no external API calls, everything runs locally in the browser.

## Why this, not a blocklist

Most "phishing detector" demos just check a domain against a static blocklist, which only
catches sites someone already reported. This scores live page *behavior* instead:
- Does a password field submit to a different origin than the page itself?
- Is the domain one or two characters off from a well-known brand (`paypa1.com`)?
- Does the hostname stuff a brand name into a subdomain it doesn't own
  (`paypal-secure-login.verification-portal.net`)?
- Does the page use urgency/pressure language ("verify your account now", "account will be suspended")?

None of that requires the site to already be on anyone's list.

## How it's scored

Four independent detectors each contribute weighted findings; scores combine into a
0–100 risk score and a `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` tier:

| Signal | Weight | Standalone tier |
|---|---|---|
| Domain typo of a known brand (Levenshtein ≤2) | 45 | HIGH |
| Brand name stuffed into an unrelated subdomain | 45 | HIGH |
| Password field submitting cross-origin | 45 | HIGH |
| Password collected over plain HTTP | 30 | MEDIUM |
| Urgency/pressure language | up to 25 | MEDIUM |

Structural/URL-based signals (domain, form action) are weighted to stand alone as strong
evidence, since those patterns essentially never occur on legitimate sites. Content-based
signals (urgency language) are weighted as supporting evidence only, since some legitimate
sites use similar phrasing for real security notices — a single urgency phrase alone
shouldn't flag a page as CRITICAL.

## Real benchmark, not a claim

`src/detection/syntheticEval.ts` generates 300 labeled synthetic page scenarios (benign +
five phishing strategies, from single-weak-signal to fully-stacked) and measures precision/recall
against them:

```bash
npm run benchmark
```

| Metric | Score |
|---|---|
| Precision | 100% |
| Recall | 74% |
| F1 | 0.851 |
| False positive rate | 0% |

**0% false positive rate is the important number for a tool like this** — it never flags a
benign page in this benchmark. The 74% recall is honest, not maximized: some phishing
scenarios deliberately use only one weak signal (e.g. urgency language alone), and the
scorer correctly declines to escalate those to a hard flag rather than risk crying wolf.

## Real bugs found while building this

- **`instanceof HTMLInputElement` failed outside a real browser realm.** Element extraction
  crashed in any DOM implementation where that global constructor isn't populated the same
  way (e.g. testing environments). Switched to a `tagName === "INPUT"` check, which works
  identically everywhere.
- **`.innerText` is layout-dependent and unreliable outside a real rendering engine** — it
  silently returned empty text in the test environment, which would have shipped a content
  detector that only worked by accident. Switched to `.textContent` (with `<script>`/`<style>`
  stripped from a clone first), which is also arguably *more* correct: it still catches
  urgency text an attacker hid via CSS tricks that `innerText` would have skipped.
- **The OTP-field regex's trailing `\b` failed on realistic field names** like `otp_code` —
  `_` counts as a word character, so there's no boundary between "otp" and "_". Fixed by
  dropping the trailing boundary.

## Install it locally

```bash
npm install
npm run build
```

Then in Chrome/Edge: `chrome://extensions` → enable **Developer mode** → **Load unpacked**
→ select this repo's root folder (the one containing `manifest.json`).

## Test pages

`demo/` has three pages for manually exercising the extension after loading it: a benign
page (expect LOW), a borderline page with urgency language only (expect MEDIUM), and a
page with a password form submitting cross-origin plus urgency language (expect CRITICAL).
Open them with `npx serve demo` or any static file server.

Domain-lookalike detection can't be demonstrated on a live page here since it requires
actually owning a typosquatted domain — see the synthetic benchmark and
`tests/domainAnalysis.test.ts` for verified coverage of that detector instead.

## Tests

```bash
npm test              # 37 tests
npm run test:coverage # 97.6% statements
npm run typecheck
npm run lint
```

Includes an integration test (`tests/demoPages.test.ts`) that runs the real extraction +
scoring pipeline against the actual `demo/*.html` files via jsdom — not just hand-built
fixtures — so the detectors are verified against real DOM parsing, not only their own
synthetic inputs. CI runs typecheck + lint + tests + coverage + the benchmark + the
production build across Node 18/20/22 on every push and PR.

## Project layout

```
src/
  detection/          pure, framework-free detection logic (fully unit-tested)
    domainAnalysis.ts   Levenshtein-based lookalike domain detection
    formAnalysis.ts      sensitive-field classification + cross-origin form detection
    contentAnalysis.ts    urgency-language detection
    transportAnalysis.ts   insecure (HTTP) password collection
    scorer.ts             combines all findings into a score + tier
    syntheticEval.ts        labeled benchmark generator
  content/            thin browser-API-coupled layer: extracts PageSignals from the live DOM
  background/         service worker: badge updates, per-tab score storage
  popup/               toolbar popup UI
demo/                 test pages for manual verification after loading the extension
```

## Limitations & honest notes

- **Known-brand list is small and curated** (~20 entries), not an exhaustive database —
  see `knownBrands.ts`. Real deployment would need a much larger, maintained list.
- **Registrable-domain extraction is naive** (last two labels of the hostname) and doesn't
  correctly handle multi-part public suffixes like `.co.uk`. A production version would use
  the Public Suffix List.
- **Not published to the Chrome Web Store** — install via `Load unpacked` for now. Store
  review/publishing is a separate step this repo doesn't cover.
- **No live web-app demo** (unlike this author's other repos) — a browser extension's
  "demo" is running it against real pages, which only makes sense installed locally; see
  the Install and Test pages sections above instead of a hosted URL.

## License

MIT
