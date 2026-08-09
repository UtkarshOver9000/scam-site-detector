import { ScoreResult, RiskTier } from "../detection/types";

const scoresByTab = new Map<number, ScoreResult>();

const BADGE_COLORS: Record<RiskTier, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCORE_RESULT" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    const result: ScoreResult = message.result;
    scoresByTab.set(tabId, result);

    chrome.action.setBadgeText({ tabId, text: result.tier === "LOW" ? "" : String(result.score) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[result.tier] });
    return false;
  }

  if (message.type === "GET_SCORE_FOR_TAB") {
    sendResponse(scoresByTab.get(message.tabId) ?? null);
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  scoresByTab.delete(tabId);
});
