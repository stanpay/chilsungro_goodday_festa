import { MAP_VIEW_SHEET_BOTTOM_NAV_PX } from "@/components/MapViewBottomSheet";

export const CHATWOOT_BASE_URL = "http://mac.kurl.kr:3000";
export const CHATWOOT_WEBSITE_TOKEN = "ZsvpfT9oQbiuhpDwoM6qnBYk";

/** 기존 ChatSupport 버튼과 동일: bottom-[calc(4rem+30px-1.75rem)] */
export const CHATWOOT_DEFAULT_BOTTOM = "calc(4rem + 30px - 1.75rem)";
export const CHATWOOT_LAUNCHER_RIGHT = "1.5rem";
const MAP_LAUNCHER_GAP_PX = 12;
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

export const updateChatwootBubblePosition = ({
  isMapView,
  mapSheetPanelHeight,
}: ChatwootBubblePositionOptions) => {
  const root = document.documentElement;

  if (!isMapView) {
    root.style.setProperty("--chatwoot-widget-bottom", CHATWOOT_DEFAULT_BOTTOM);
  } else {
    const bottomPx =
      MAP_VIEW_SHEET_BOTTOM_NAV_PX + mapSheetPanelHeight + MAP_LAUNCHER_GAP_PX;
    root.style.setProperty("--chatwoot-widget-bottom", `${bottomPx}px`);
  }

  applyChatwootHolderLayout();
};

/** SDK가 top/left로 잡은 런처를 bottom/right 기준으로 통일 */
export const applyChatwootHolderLayout = () => {
  const holder = document.getElementById(BUBBLE_HOLDER_ID);
  if (!holder) return;

  holder.style.setProperty("top", "auto", "important");
  holder.style.setProperty("left", "auto", "important");
  holder.style.setProperty("right", CHATWOOT_LAUNCHER_RIGHT, "important");
  holder.style.setProperty(
    "bottom",
    getComputedStyle(document.documentElement).getPropertyValue("--chatwoot-widget-bottom").trim() ||
      CHATWOOT_DEFAULT_BOTTOM,
    "important"
  );
  holder.style.setProperty("z-index", "60", "important");
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
