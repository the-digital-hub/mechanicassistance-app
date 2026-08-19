/**
 * Public legal pages. Static content URLs — not API endpoints, so they don't
 * belong in ConfigService (which resolves per-environment API/WS hosts).
 */
export const LEGAL_URLS = {
  terms: "https://mechanicassistance.com/terms-conditions/",
  privacy: "https://mechanicassistance.com/privacy-policy/",
} as const;
