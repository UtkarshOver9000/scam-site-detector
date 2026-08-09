export interface KnownBrand {
  name: string;
  domain: string;
}

// A small, deliberately-curated list of frequently-impersonated brands, not
// an exhaustive database. See README for why this is a documented tradeoff
// rather than a hidden limitation.
export const KNOWN_BRANDS: KnownBrand[] = [
  { name: "PayPal", domain: "paypal.com" },
  { name: "Amazon", domain: "amazon.com" },
  { name: "Apple", domain: "apple.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "Google", domain: "google.com" },
  { name: "Chase", domain: "chase.com" },
  { name: "Bank of America", domain: "bankofamerica.com" },
  { name: "Netflix", domain: "netflix.com" },
  { name: "Facebook", domain: "facebook.com" },
  { name: "Instagram", domain: "instagram.com" },
  { name: "LinkedIn", domain: "linkedin.com" },
  { name: "Wells Fargo", domain: "wellsfargo.com" },
  { name: "Coinbase", domain: "coinbase.com" },
  { name: "Binance", domain: "binance.com" },
  { name: "DHL", domain: "dhl.com" },
  { name: "FedEx", domain: "fedex.com" },
  { name: "USPS", domain: "usps.com" },
  { name: "Steam", domain: "steampowered.com" },
  { name: "Discord", domain: "discord.com" },
  { name: "Dropbox", domain: "dropbox.com" },
];
