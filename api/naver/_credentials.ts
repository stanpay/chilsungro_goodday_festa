import { resolveNaverCredsFromEnv } from "./_upstream";

export function getNaverServerCredentials() {
  return resolveNaverCredsFromEnv();
}
