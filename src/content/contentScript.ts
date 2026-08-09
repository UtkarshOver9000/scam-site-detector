import { extractPageSignals } from "./extractSignals";
import { scorePage } from "../detection/scorer";

function run(): void {
  const signals = extractPageSignals(document, window.location);
  const result = scorePage(signals);
  chrome.runtime.sendMessage({ type: "SCORE_RESULT", result, url: window.location.href });
}

run();

// Debounced re-score on DOM mutation, so single-page apps or late-loading
// login forms still get evaluated without re-scoring on every keystroke.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 500);
});
observer.observe(document.body, { childList: true, subtree: true });
