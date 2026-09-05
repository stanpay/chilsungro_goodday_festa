/**
 * 텍스트 폭 측정용 공용 probe.
 *
 * 같은 패턴(span 생성 -> body에 붙임 -> scrollWidth 읽음 -> 제거)이 세 컴포넌트에
 * 중복 구현돼 있었다. 후보 폰트 크기마다 DOM을 붙였다 떼면 그때마다 문서 전체
 * 레이아웃이 무효화되므로, probe 하나를 만들어두고 재사용한다.
 *
 * Canvas.measureText로 바꾸면 DOM을 아예 건드리지 않지만, 폰트가 Tailwind 클래스로
 * 지정돼 있어 실제 계산된 font 문자열을 얻으려면 결국 DOM에 붙여야 한다.
 */

let probe: HTMLSpanElement | null = null;

/** 같은 (클래스, 텍스트) 조합의 재측정을 피한다 */
const cache = new Map<string, number>();
let listenersAttached = false;

function attachInvalidation(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  // 화면 크기·확대 배율이 바뀌면 측정값이 달라진다
  const invalidate = () => cache.clear();
  window.addEventListener("resize", invalidate, { passive: true });
  window.visualViewport?.addEventListener("resize", invalidate, { passive: true });
}

function getProbe(): HTMLSpanElement {
  if (probe?.isConnected) return probe;
  probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;white-space:nowrap;";
  document.body.appendChild(probe);
  attachInvalidation();
  return probe;
}

/**
 * 주어진 클래스가 적용된 상태의 텍스트 폭(px)을 잰다.
 * className에는 폰트 크기·굵기 등 폭에 영향을 주는 클래스를 모두 넘겨야 한다.
 */
export function measureTextWidth(text: string, className: string): number {
  if (typeof document === "undefined" || !text) return 0;

  const key = `${className}\u0000${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const el = getProbe();
  el.className = className;
  el.textContent = text;
  const width = el.scrollWidth;

  cache.set(key, width);
  return width;
}
