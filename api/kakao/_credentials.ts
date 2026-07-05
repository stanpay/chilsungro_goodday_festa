import { resolveKakaoRestKeyFromEnv } from "./_upstream.js";

export function getKakaoServerCredentials() {
  return resolveKakaoRestKeyFromEnv();
}
