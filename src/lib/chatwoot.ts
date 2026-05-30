// 3001 = Chatwoot HTTPS 포트(유효한 Let's Encrypt 인증서). 3000은 HTTP 전용이라
// HTTPS 페이지에서 Mixed Content로 차단되므로 기본값은 HTTPS를 사용한다.
export const CHATWOOT_BASE_URL =
  import.meta.env.VITE_CHATWOOT_BASE_URL ?? "https://mac.kurl.kr:3001";
export const CHATWOOT_WEBSITE_TOKEN = "ZsvpfT9oQbiuhpDwoM6qnBYk";

/** 기존 ChatSupport 버튼과 동일: bottom-[calc(4rem+30px-1.75rem)] */
export const CHATWOOT_DEFAULT_BOTTOM = "calc(4rem + 30px - 1.75rem)";
export const CHATWOOT_LAUNCHER_RIGHT = "1.5rem";
const BUBBLE_HOLDER_ID = "cw-bubble-holder";

declare global {
  interface Window {
    chatwootSettings?: { position: string; type: string; launcherTitle: string };
    chatwootSDK?: { run: (config: { websiteToken: string; baseUrl: string }) => void };
    __chatwootStanBooted?: boolean;
    __chatwootStanTracerStarted?: boolean;
  }
}

export type ChatwootBubblePositionOptions = {
  isMapView: boolean;
  mapSheetPanelHeight: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const updateChatwootBubblePosition = (_options: ChatwootBubblePositionOptions) => {
  // 카드뷰·지도뷰 모두 동일한 하단 위치를 사용한다.
  document.documentElement.style.setProperty(
    "--chatwoot-widget-bottom",
    CHATWOOT_DEFAULT_BOTTOM
  );

  applyChatwootHolderLayout();
};

/** SDK가 top/left로 잡은 런처를 bottom/right 기준으로 통일 */
export const applyChatwootHolderLayout = () => {
  const bottom =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--chatwoot-widget-bottom")
      .trim() || CHATWOOT_DEFAULT_BOTTOM;

  const positionElement = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty("top", "auto", "important");
    el.style.setProperty("left", "auto", "important");
    el.style.setProperty("right", CHATWOOT_LAUNCHER_RIGHT, "important");
    el.style.setProperty("bottom", bottom, "important");
    el.style.setProperty("z-index", "60", "important");
  };

  positionElement(document.getElementById(BUBBLE_HOLDER_ID));

  // 실제 런처 버튼은 holder와 별개로 position:fixed라서 직접 띄워야 한다.
  document
    .querySelectorAll<HTMLElement>(".woot-widget-bubble")
    .forEach(positionElement);
};

const logChatwootTrace = (phase: string, extra?: Record<string, unknown>) => {
  const holder = document.getElementById(BUBBLE_HOLDER_ID);
  const bubble = holder?.querySelector<HTMLElement>(".woot-widget-bubble");
  const holderStyle = holder ? getComputedStyle(holder) : null;
  const bubbleStyle = bubble ? getComputedStyle(bubble) : null;

  console.info(`[Chatwoot] ${phase}`, {
    ...extra,
    holderInDom: Boolean(holder),
    bubbleInDom: Boolean(bubble),
    holderRect: holder
      ? ((r) => ({
          top: r.top,
          left: r.left,
          bottom: r.bottom,
          right: r.right,
          width: r.width,
          height: r.height,
        }))(holder.getBoundingClientRect())
      : null,
    holderDisplay: holderStyle?.display,
    holderVisibility: holderStyle?.visibility,
    holderOpacity: holderStyle?.opacity,
    holderTop: holderStyle?.top,
    holderLeft: holderStyle?.left,
    holderBottom: holderStyle?.bottom,
    holderRight: holderStyle?.right,
    holderZIndex: holderStyle?.zIndex,
    bubbleBottom: bubbleStyle?.bottom,
    sdkReady: Boolean(window.chatwootSDK),
    booted: Boolean(window.__chatwootStanBooted),
  });
};

/** 개발 시 DOM 삽입·표시 상태 추적 (Performance 탭 마커 포함) */
export const attachChatwootDomTracer = () => {
  if (!import.meta.env.DEV || window.__chatwootStanTracerStarted) return;
  window.__chatwootStanTracerStarted = true;

  const mark = (name: string) => {
    try {
      performance.mark(name);
    } catch {
      /* ignore */
    }
    logChatwootTrace(name);
  };

  mark("trace:start");

  document.addEventListener("DOMContentLoaded", () => mark("DOMContentLoaded"));
  window.addEventListener("load", () => mark("window.load"));

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.id === BUBBLE_HOLDER_ID || node.querySelector?.(`#${BUBBLE_HOLDER_ID}`)) {
          mark("mutation:#cw-bubble-holder-added");
          applyChatwootHolderLayout();
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let polls = 0;
  const poll = window.setInterval(() => {
    polls += 1;
    if (document.getElementById(BUBBLE_HOLDER_ID)) {
      mark(`poll:found@${polls}`);
      window.clearInterval(poll);
      return;
    }
    if (polls >= 40) {
      mark("poll:timeout-8s");
      window.clearInterval(poll);
    }
  }, 200);
};

let mountObserverStarted = false;

export const watchChatwootBubbleMount = () => {
  if (mountObserverStarted) return;
  mountObserverStarted = true;

  const onMount = () => {
    applyChatwootHolderLayout();
    if (import.meta.env.DEV) logChatwootTrace("holder-layout-applied");
  };

  if (document.getElementById(BUBBLE_HOLDER_ID)) onMount();

  const observer = new MutationObserver(() => {
    if (document.getElementById(BUBBLE_HOLDER_ID)) onMount();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("resize", onMount);
  window.visualViewport?.addEventListener("resize", onMount);
};

export const bootChatwoot = () => {
  if (window.__chatwootStanBooted) return;
  window.__chatwootStanBooted = true;

  try {
    performance.mark("chatwoot:boot-start");
  } catch {
    /* ignore */
  }

  if (
    window.location.protocol === "https:" &&
    CHATWOOT_BASE_URL.startsWith("http://")
  ) {
    console.error(
      `[Chatwoot] Mixed Content — HTTPS 페이지에서 HTTP 위젯(${CHATWOOT_BASE_URL})은 브라우저가 차단합니다. ` +
        `VITE_CHATWOOT_BASE_URL을 HTTPS 주소로 설정하세요.`
    );
  }

  window.chatwootSettings = { position: "right", type: "standard", launcherTitle: "" };
  attachChatwootDomTracer();
  watchChatwootBubbleMount();

  const script = document.createElement("script");
  script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`;
  script.async = true;

  script.addEventListener("load", () => {
    try {
      performance.mark("chatwoot:sdk-loaded");
    } catch {
      /* ignore */
    }
    logChatwootTrace("sdk.js:onload");

    window.chatwootSDK?.run({
      websiteToken: CHATWOOT_WEBSITE_TOKEN,
      baseUrl: CHATWOOT_BASE_URL,
    });

    try {
      performance.mark("chatwoot:sdk-run-called");
    } catch {
      /* ignore */
    }
    logChatwootTrace("chatwootSDK.run-called");

    // run() 직후엔 아직 DOM에 없을 수 있음 — 짧게 재시도
    window.setTimeout(() => applyChatwootHolderLayout(), 0);
    window.setTimeout(() => applyChatwootHolderLayout(), 500);
    window.setTimeout(() => logChatwootTrace("post-run+500ms"), 500);
    window.setTimeout(() => logChatwootTrace("post-run+3000ms"), 3000);
  });

  script.addEventListener("error", () => {
    console.error(
      `[Chatwoot] sdk.js 로드 실패 — ${CHATWOOT_BASE_URL}/packs/js/sdk.js (네트워크·Mixed Content 확인)`
    );
    logChatwootTrace("sdk.js:error");
  });

  document.head.appendChild(script);
};
