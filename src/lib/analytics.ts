export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
export const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

export const isAnalyticsEnabled = () => Boolean(GA_MEASUREMENT_ID);
export const isClarityEnabled = () => Boolean(CLARITY_PROJECT_ID);

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type CtaClickParams = {
  /** 배너·버튼 식별자 (예: travel-center, covernat_directions) */
  cta_id: string;
  /** 사람이 읽을 수 있는 이름 */
  cta_name?: string;
  /** UI 위치 (예: main_promo_banner) */
  cta_location?: string;
  /** 동작 유형 (예: banner, store_redirect, naver_map_directions) */
  cta_type?: string;
};

/** GA4 커스텀/권장 이벤트 전송 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (!isAnalyticsEnabled()) return;
  window.gtag?.("event", eventName, params);
}

/** CTA 클릭 측정 — GA 이벤트명 `cta_click` */
export function trackCtaClick(params: CtaClickParams): void {
  trackEvent("cta_click", {
    cta_id: params.cta_id,
    cta_name: params.cta_name,
    cta_location: params.cta_location,
    cta_type: params.cta_type,
  });
}

export const initClarity = () => {
  if (!isClarityEnabled()) return;

  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function (...args: unknown[]) {
        (c[a].q = c[a].q || []).push(args);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
};
