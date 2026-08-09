import { PageSignals, FormInfo, FormFieldInfo } from "../detection/types";

function resolveOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// tagName-based check instead of `instanceof HTMLInputElement`: the latter
// depends on the global HTMLInputElement constructor matching the realm the
// element was created in, which isn't guaranteed (e.g. cross-frame elements,
// or a DOM implementation without that global populated). tagName works
// identically regardless of realm.
function isInputElement(el: Element): el is HTMLInputElement {
  return el.tagName === "INPUT";
}

// textContent includes <script>/<style> contents, which could produce false
// matches from CSS class names or inline JS strings. Strip them from a clone
// before reading text, rather than touching the live page.
function extractVisibleText(doc: Document): string {
  const body = doc.body;
  if (!body) return "";
  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  return clone.textContent || "";
}

// Thin, browser-API-coupled extraction layer. Deliberately kept minimal --
// all the actual decision logic lives in ../detection, which is pure and
// unit-tested. This file translates a live DOM into the PageSignals shape
// that pure logic expects.
export function extractPageSignals(doc: Document, loc: Location): PageSignals {
  const forms: FormInfo[] = Array.from(doc.forms).map((form) => {
    const fields: FormFieldInfo[] = Array.from(form.elements)
      .filter(isInputElement)
      .map((input) => ({
        type: input.type,
        name: input.name || input.id || "",
        autocomplete: input.autocomplete || null,
      }));

    const actionUrl = form.getAttribute("action") ? form.action : loc.href;
    return {
      actionOrigin: resolveOrigin(actionUrl),
      hasPasswordField: fields.some((f) => f.type === "password"),
      fields,
    };
  });

  // textContent, not innerText: innerText is layout-dependent (requires an
  // actual rendering engine to compute) and unsupported in some DOM
  // implementations. textContent works everywhere and, as a side benefit,
  // still catches urgency text an attacker tried to hide via CSS tricks
  // (display:none, font-size:0) that innerText would have skipped.
  return {
    hostname: loc.hostname,
    origin: loc.origin,
    isHttps: loc.protocol === "https:",
    bodyText: extractVisibleText(doc).slice(0, 20000),
    forms,
  };
}
