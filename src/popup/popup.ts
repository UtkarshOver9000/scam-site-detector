import { ScoreResult } from "../detection/types";

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function main(): Promise<void> {
  const container = document.getElementById("content");
  if (!container) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    container.innerHTML = '<p class="empty">No active tab.</p>';
    return;
  }

  chrome.runtime.sendMessage({ type: "GET_SCORE_FOR_TAB", tabId: tab.id }, (result: ScoreResult | null) => {
    if (!result) {
      container.innerHTML = '<p class="empty">No data yet for this page -- try reloading it.</p>';
      return;
    }

    const findingsHtml = result.findings.length
      ? `<ul>${result.findings.map((f) => `<li>${escapeHtml(f.message)}</li>`).join("")}</ul>`
      : '<p class="empty">No suspicious signals detected on this page.</p>';

    container.innerHTML = `
      <div class="tier tier-${result.tier}">${result.tier}</div>
      <div class="score">Risk score: ${result.score}/100</div>
      ${findingsHtml}
    `;
  });
}

main();
