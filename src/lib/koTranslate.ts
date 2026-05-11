import type { AppLocale } from "@/lib/locale";

const HANGUL = /[가-힣]/;

const GOOGLE_TL: Record<Exclude<AppLocale, "ko">, string> = {
  en: "en",
  zh: "zh-CN",
  ja: "ja",
};

const MYMEMORY_PAIR: Record<Exclude<AppLocale, "ko">, string> = {
  en: "ko|en",
  zh: "ko|zh-CN",
  ja: "ko|ja",
};

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function cacheKey(locale: AppLocale, text: string): string {
  return `${locale}\u0000${text}`;
}

function parseGtx(data: unknown): string | null {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const parts: string[] = [];
  for (const chunk of data[0]) {
    if (Array.isArray(chunk) && typeof chunk[0] === "string") parts.push(chunk[0]);
  }
  const s = parts.join("");
  return s.trim() ? s : null;
}

async function tryGoogleGtx(text: string, tl: string): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: unknown = await res.json();
  return parseGtx(data);
}

async function tryMyMemory(text: string, langpair: string): Promise<string | null> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  if (data.responseStatus !== 200) return null;
  const t = data.responseData?.translatedText;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

/**
 * 한국어 원문을 선택 언어로 번역합니다. (무료 공개 엔드포인트 — 실패 시 원문 유지)
 * `ko`이거나 한글이 없으면 원문을 그대로 반환합니다.
 */
export async function translateKoText(text: string, targetLocale: AppLocale): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || targetLocale === "ko" || !HANGUL.test(trimmed)) {
    return text;
  }

  const key = cacheKey(targetLocale, trimmed);
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = inflight.get(key);
  if (pending) return pending;

  const tl = GOOGLE_TL[targetLocale as Exclude<AppLocale, "ko">];
  const pair = MYMEMORY_PAIR[targetLocale as Exclude<AppLocale, "ko">];

  const work = (async () => {
    try {
      const g = await tryGoogleGtx(trimmed, tl);
      if (g) {
        cache.set(key, g);
        return g;
      }
    } catch {
      /* fall through */
    }
    try {
      const m = await tryMyMemory(trimmed, pair);
      if (m) {
        cache.set(key, m);
        return m;
      }
    } catch {
      /* fall through */
    }
    return text;
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}
