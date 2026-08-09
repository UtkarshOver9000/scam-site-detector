import { Finding } from "./types";
import { KNOWN_BRANDS, KnownBrand } from "./knownBrands";

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Naive "last two labels" registrable-domain extraction. Doesn't handle
// multi-part public suffixes (e.g. "co.uk") correctly -- a real production
// system would use the Public Suffix List. Documented limitation, not a
// silent one; see README.
export function getRegistrableDomain(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname.toLowerCase();
  return parts.slice(-2).join(".").toLowerCase();
}

export function analyzeDomain(hostname: string, brands: KnownBrand[] = KNOWN_BRANDS): Finding[] {
  const registrable = getRegistrableDomain(hostname);
  const lowerHostname = hostname.toLowerCase();

  for (const brand of brands) {
    if (registrable === brand.domain) {
      return []; // this IS the real site
    }
  }

  for (const brand of brands) {
    const distance = levenshteinDistance(registrable, brand.domain);
    if (distance > 0 && distance <= 2) {
      return [
        {
          code: "LOOKALIKE_DOMAIN_TYPO",
          message: `Domain "${registrable}" is ${distance} character${distance > 1 ? "s" : ""} away from "${brand.domain}" (${brand.name})`,
          weight: 45,
        },
      ];
    }
  }

  for (const brand of brands) {
    const brandKey = brand.name.toLowerCase().replace(/\s+/g, "");
    if (brandKey.length >= 4 && registrable !== brand.domain && lowerHostname.includes(brandKey)) {
      return [
        {
          code: "BRAND_NAME_IN_SUBDOMAIN",
          message: `Hostname "${hostname}" contains brand name "${brand.name}" but the actual domain is "${registrable}", not "${brand.domain}"`,
          weight: 45,
        },
      ];
    }
  }

  return [];
}
