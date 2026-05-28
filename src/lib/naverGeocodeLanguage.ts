/** NCP Geocoding REST: language=kor|eng — https://api.ncloud-docs.com/docs/application-maps-geocoding */
export type NaverGeocodeRestLanguage = "kor" | "eng";

export function normalizeGeocodeRestLanguage(
  input?: string | null
): NaverGeocodeRestLanguage {
  const tag = (input ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (tag === "eng" || tag.startsWith("en")) return "eng";
  return "kor";
}
