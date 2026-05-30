import { resolveNaverCredsFromEnv } from "./_upstream.js";

export function getNaverServerCredentials() {
  return resolveNaverCredsFromEnv();
}
