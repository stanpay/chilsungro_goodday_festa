import { loadKakaoMaps } from "@/lib/kakao";

/**
 * 위도/경도 → 주소 문자열 변환.
 * 반환 형식: "경주시 석장동 753-1" (시·군·구 + 읍·면·동 + 지번)
 */
export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    await loadKakaoMaps();

    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) return "위치를 확인할 수 없음";

    const geocoder = new kakao.maps.services.Geocoder();

    return new Promise<string>((resolve) => {
      const timeoutId = setTimeout(() => resolve("위치를 확인할 수 없음"), 10000);

      const coord = new kakao.maps.LatLng(latitude, longitude);

      const callback = (result: any, status: any) => {
        clearTimeout(timeoutId);

        if (status === kakao.maps.services.Status.OK && result.length > 0) {
          const addr = result[0].address || result[0].road_address;
          if (addr) {
            // 시/군/구
            let city = addr.region_2depth_name ?? "";
            if (!city && addr.region_1depth_name) {
              city = addr.region_1depth_name
                .replace(/특별자치도$/, "")
                .replace(/특별시$/, "시")
                .replace(/광역시$/, "시")
                .replace(/도$/, "");
            }
            // 서울·광역시는 구 대신 시 이름을 앞에 붙이지 않아도 구만으로 충분
            const district = addr.region_3depth_name || addr.region_3depth_h_name || "";

            // 지번
            let lot = "";
            if (addr.main_address_no) {
              lot = " " + addr.main_address_no;
              if (addr.sub_address_no) lot += "-" + addr.sub_address_no;
            }

            const parts = [city, district].filter(Boolean).join(" ") + lot;
            if (parts.trim()) {
              resolve(parts.trim());
              return;
            }
          }
        }

        resolve("위치를 확인할 수 없음");
      };

      try {
        geocoder.coord2Address(coord.getLng(), coord.getLat(), callback);
      } catch {
        clearTimeout(timeoutId);
        resolve("위치를 확인할 수 없음");
      }
    });
  } catch {
    return "위치를 확인할 수 없음";
  }
}
