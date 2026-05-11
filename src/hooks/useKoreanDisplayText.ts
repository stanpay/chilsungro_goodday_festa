import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/locale";
import { isStoredKoreanSystemLocation, resolveLocationDisplay } from "@/lib/locale";
import { translateKoText } from "@/lib/koTranslate";

const HANGUL = /[가-힣]/;

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

  const [out, setOut] = useState(() => {
    if (system || locale === "ko") {
      return resolveLocationDisplay(locale, currentLocation);
    }
    if (!HANGUL.test(currentLocation)) return currentLocation;
    return currentLocation;
  });

  useEffect(() => {
    if (system || locale === "ko") {
      setOut(resolveLocationDisplay(locale, currentLocation));
      return;
    }
    if (!HANGUL.test(currentLocation)) {
      setOut(currentLocation);
      return;
    }
    setOut(currentLocation);
    let cancelled = false;
    translateKoText(currentLocation, locale).then((t) => {
      if (!cancelled) setOut(t);
    });
    return () => {
      cancelled = true;
    };
  }, [currentLocation, locale, system]);

  return out;
}
