import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/locale";
import { isStoredKoreanSystemLocation, resolveLocationDisplay } from "@/lib/locale";
import { translateKoText } from "@/lib/koTranslate";

const HANGUL = /[가-힣]/;
const KOREAN_LOCALITY_SUFFIX = /(동|읍|면)$/;

function trimAddressToLocality(address: string): string {
  const parts = address.trim().split(/\s+/);
  const localityIndex = parts.findIndex((part) => KOREAN_LOCALITY_SUFFIX.test(part));
  if (localityIndex === -1) return address;
  return parts.slice(0, localityIndex + 1).join(" ");
}

/** 매장명 등 일반 한국어 문장 */
export function useTranslatedKoreanText(source: string, locale: AppLocale): string {
  const [out, setOut] = useState(source);

  useEffect(() => {
    if (locale === "ko" || !HANGUL.test(source)) {
      setOut(source);
      return;
    }
    setOut(source);
    let cancelled = false;
    translateKoText(source, locale).then((t) => {
      if (!cancelled) setOut(t);
    });
    return () => {
      cancelled = true;
    };
  }, [source, locale]);

  return out;
}

/** 헤더 주소: 시스템 문구는 로케일 사전, 실제 주소는 기계번역 */
export function useTranslatedAddressLine(currentLocation: string, locale: AppLocale): string {
  const system = isStoredKoreanSystemLocation(currentLocation);
  const displayLocation = system ? currentLocation : trimAddressToLocality(currentLocation);

  const [out, setOut] = useState(() => {
    if (system || locale === "ko") {
      return system
        ? resolveLocationDisplay(locale, currentLocation)
        : displayLocation;
    }
    if (!HANGUL.test(displayLocation)) return displayLocation;
    return displayLocation;
  });

  useEffect(() => {
    if (system || locale === "ko") {
      setOut(
        system
          ? resolveLocationDisplay(locale, currentLocation)
          : displayLocation
      );
      return;
    }
    if (!HANGUL.test(displayLocation)) {
      setOut(displayLocation);
      return;
    }
    setOut(displayLocation);
    let cancelled = false;
    translateKoText(displayLocation, locale).then((t) => {
      if (!cancelled) setOut(t);
    });
    return () => {
      cancelled = true;
    };
  }, [currentLocation, displayLocation, locale, system]);

  return out;
}
