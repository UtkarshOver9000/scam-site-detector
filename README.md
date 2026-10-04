# Scam Site Detector

![CI](https://github.com/UtkarshOver9000/scam-site-detector/actions/workflows/ci.yml/badge.svg)

A Chrome/Edge extension that scores the page you're on for phishing signals and shows a
risk tier in the toolbar badge and popup. It looks for:
- lookalike domains (`paypa1.com`),
- brand names inside unrelated domains,
- password forms that submit to another site,
- passwords collected over plain HTTP,
- urgency language.

Everything runs locally; no page data leaves the browser.

This README reports how well those rules actually work, measured on **real phishing
data**: 235,795 pages from the PhiUSIIL dataset, the live OpenPhish feed, and the
1,000,000-domain Tranco list. The short version: the rules almost never raise false
alarms, but they **miss most real phishing**.

## Results on real data

`npm run eval` (`src/eval/realEval.ts`, results in `reports/real_eval.json`):

### PhiUSIIL: 235,795 real pages (100,945 phishing, 134,850 legitimate)

Each page is turned into the signals the extension would extract:
- hostname and origin from the URL,
- HTTPS from the crawled `IsHTTPS` flag,
- a password form from `HasPasswordField`, which submits cross-origin when
  `HasExternalFormSubmit` is set.

| Flag pages scoring ... | Accuracy | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| ≥ 45 (HIGH or CRITICAL) | 56.99% | 44.89% | **2.04%** | 0.0390 | 1.88% |
| ≥ 20 (MEDIUM or above) | 57.48% | 55.92% | 3.18% | 0.0601 | 1.88% |

ROC-AUC of the 0-100 risk score: **0.5064**, close to random. At the HIGH threshold:
2,060 phishing pages caught, 98,885 missed, 2,529 legitimate pages flagged.

**What each detector does on real pages:**

| Detector | Fires on phishing pages | Fires on legitimate pages | Precision when it fires |
|---|---|---|---|
| Brand name in an unrelated domain | 1.73% | 0.10% | 92.88% |
| Password over plain HTTP | 1.36% | 0.00% | 100.00%* |
| Password form posts to another site | 0.28% | 1.67% | 11.21% |
| Lookalike typo of a known brand | 0.03% | 0.11% | 18.64% |

\*Every legitimate PhiUSIIL page is HTTPS (a known property of the dataset), so this
detector can't produce a false alarm here. On the open web it could.

What this means:
- The two domain-name detectors are precise but rare. Only about 2% of real phishing
  pages imitate one of the 20 listed brands in their domain.
- Cross-origin password forms turn out to be **more common on legitimate sites** (single
  sign-on, embedded login widgets) than on phishing pages. That detector does more harm
  than good on this data.
- The urgency detector can't be measured fairly: PhiUSIIL has no page text, only titles.

### Live phishing (OpenPhish feed, 300 URLs fetched 2026-10-04 04:29 UTC)

Only the URL is used (nothing is fetched or visited), so only the domain detectors can
fire: **32 of 300 caught (10.67%)**.

### False alarms on real popular sites (Tranco top-1M, list Y83KG)

The domain detectors flag **2,667 of 1,000,000** domains (0.27%). In the top 1,000 they
flag the brands' own infrastructure, for example `amazonaws.com`, `googleapis.com`,
`microsoftonline.com`, `cdninstagram.com` and `discord.gg`, because the brand-name rule
can't tell a brand's secondary domains from impostors.

### Takeaway

Hand-written rules give near-zero false alarms but very low recall. A data-trained model
does much better on the same kind of data. The companion project
[phishing URL detection](https://github.com/UtkarshOver9000/phishvpn-detection) catches
63.24% of live OpenPhish domains at a 0.09% false-alarm rate on Tranco, using the domain
only. Porting that model into this extension is the natural next step.

## How the score is built

Four independent detectors add weighted findings into a 0-100 score and a
`LOW` / `MEDIUM` / `HIGH` / `CRITICAL` tier:

| Signal | Weight | Alone reaches |
|---|---|---|
| Domain within 2 edits of a known brand domain | 45 | HIGH |
| Brand name inside a domain the brand doesn't own | 45 | HIGH |
| Password form submitting to another origin | 45 | HIGH |
| Password collected over plain HTTP | 30 | MEDIUM |
| Urgency/pressure phrases | up to 25 | MEDIUM |

Registrable domains come from the Public Suffix List (via `tldts`). So `login.bbc.co.uk`
counts as `bbc.co.uk`, and `x.pages.dev` counts as its own site.

## Data

| Dataset | Use | License / terms |
|---|---|---|
| [PhiUSIIL Phishing URL Dataset](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset), UCI #967 (CSV SHA-256 `a236549c…d06d1c6`) | page-level evaluation | CC BY 4.0 |
| [OpenPhish community feed](https://openphish.com/feed.txt) (SHA-256 `15ce676d…511a41`) | live evaluation | non-commercial research only; not redistributed |
| [Tranco top-1M](https://tranco-list.eu/list/Y83KG/1000000), list Y83KG (CSV SHA-256 `8862c140…37af1d7`) | false-alarm evaluation | see Tranco site |

To reproduce (data goes in `data/`, which is gitignored):

```bash
curl -L -o phiusiil.zip "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip"
curl -L -o tranco.zip https://tranco-list.eu/download/daily/top-1m.csv.zip
curl -L -o data/openphish-feed.txt https://openphish.com/feed.txt
unzip phiusiil.zip -d data && unzip tranco.zip -d data
npm run eval
```

## Install the extension

```bash
npm install
npm run build
```

In Chrome or Edge, open `chrome://extensions`, turn on **Developer mode**, click **Load
unpacked**, and select this folder (the one with `manifest.json`).

`demo/` has three pages for checking it by hand: benign (expect LOW), urgency text only
(expect MEDIUM), and a cross-origin password form with urgency text (expect CRITICAL).
Serve them with `npx serve demo`.

## Tests

```bash
npm test               # 39 tests
npm run test:coverage  # 100% statements in src/detection
npm run typecheck && npm run lint
```

The tests cover every detector, the scorer, CSV parsing, and the metric maths (checked
against hand-computed values). `tests/demoPages.test.ts` also runs the real extraction
and scoring pipeline on the `demo/` pages through jsdom. CI runs typecheck, lint, tests
and the build on Node 20, 22 and 24.

## Limitations

- The brand list has 20 entries. Most phishing targets something else.
- The PhiUSIIL mapping is approximate. "Has an external form submit" is page-level, so a
  page with a same-site login form and an unrelated external form counts as a mismatch.
- Not published to the Chrome Web Store; install it unpacked.

## License

MIT
