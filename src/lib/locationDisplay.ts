import { getAddressFromCoords, UNKNOWN_ADDRESS } from "@/lib/geocoding";
import { headerStrings, type AppLocale } from "@/lib/locale";

/**
 * 역지오코딩 결과를 화면 표시용 문자열로 바꾼다.
 *
 * 이 변환이 네 곳에 같은 모양으로 복사돼 있었고, 비교 대상인
 * "위치를 확인할 수 없음"을 UNKNOWN_ADDRESS 상수 대신 리터럴로 적어두고 있었다.
 * 상수가 바뀌면 비교가 조용히 어긋나므로 한곳으로 모았다.
 */
export function toDisplayAddress(address: string, locale: AppLocale): string {
  return address === UNKNOWN_ADDRESS
    ? headerStrings(locale).locationUnknownGeo
    : address;
}

/** 좌표를 화면 표시용 주소 문자열로 해석한다 */
export async function resolveDisplayAddress(
  latitude: number,
  longitude: number,
  locale: AppLocale,
): Promise<string> {
  const address = await getAddressFromCoords(latitude, longitude, locale);
  return toDisplayAddress(address, locale);
}
