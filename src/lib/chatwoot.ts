// 3001 = Chatwoot HTTPS 포트(유효한 Let's Encrypt 인증서). 3000은 HTTP 전용이라
// HTTPS 페이지에서 Mixed Content로 차단되므로 기본값은 HTTPS를 사용한다.
export const CHATWOOT_BASE_URL =
  import.meta.env.VITE_CHATWOOT_BASE_URL ?? "https://mac.kurl.kr:3001";
export const CHATWOOT_WEBSITE_TOKEN = "ZsvpfT9oQbiuhpDwoM6qnBYk";

/** 기존 ChatSupport 버튼과 동일: bottom-[calc(4rem+30px-1.75rem)] */
export const CHATWOOT_DEFAULT_BOTTOM = "calc(4rem + 30px - 1.75rem)";
export const CHATWOOT_LAUNCHER_RIGHT = "1.5rem";
const BUBBLE_HOLDER_ID = "cw-bubble-holder";
const WIDGET_HOLDER_ID = "cw-widget-holder";
const CHATWOOT_MOBILE_BREAKPOINT_PX = 667;
const CHATWOOT_BOTTOM_NAV_PX = 64;
const CHATWOOT_PANEL_GAP_PX = 12;
const CHATWOOT_PANEL_TOP_MIN_PX = 48;
const CHATWOOT_PANEL_MAX_HEIGHT_PX = 560;
const CHATWOOT_PANEL_MIN_HEIGHT_PX = 280;
const CHATWOOT_PANEL_MAX_WIDTH_PX = 400;
const CHATWOOT_OVERRIDES_STYLE_ID = "stan-chatwoot-overrides";

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

let lastPanelLayoutSignature = "";

const resetPanelLayoutSignature = () => {
  lastPanelLayoutSignature = "";
};

const isMobileChatwootLayout = () =>
  typeof window !== "undefined" &&
  window.matchMedia(`(max-width: ${CHATWOOT_MOBILE_BREAKPOINT_PX}px)`).matches;

const getChatwootWidgetHolder = () =>
  document.getElementById(WIDGET_HOLDER_ID) as HTMLElement | null;

const isChatwootPanelOpen = () => {
  const holder = getChatwootWidgetHolder();
  return Boolean(holder && !holder.classList.contains("woot--hide"));
};

/** SDK가 주입하는 모바일 전체화면 CSS보다 뒤에 덮어쓰기 (1회만) */
export const injectChatwootMobileOverrides = () => {
  if (document.getElementById(CHATWOOT_OVERRIDES_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = CHATWOOT_OVERRIDES_STYLE_ID;
  style.textContent = `
@media only screen and (max-width: ${CHATWOOT_MOBILE_BREAKPOINT_PX}px) {
  #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) {
    top: auto !important;
    left: auto !important;
    right: ${CHATWOOT_LAUNCHER_RIGHT} !important;
    width: min(calc(100vw - 2rem), ${CHATWOOT_PANEL_MAX_WIDTH_PX}px) !important;
    height: var(--chatwoot-panel-height, min(72dvh, ${CHATWOOT_PANEL_MAX_HEIGHT_PX}px)) !important;
    max-height: var(--chatwoot-panel-height, min(72dvh, ${CHATWOOT_PANEL_MAX_HEIGHT_PX}px)) !important;
    min-height: ${CHATWOOT_PANEL_MIN_HEIGHT_PX}px !important;
    border-radius: 16px !important;
  }

  #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) iframe {
    min-height: 0 !important;
    max-height: 100% !important;
    height: 100% !important;
  }
}
`;

  const sdkStyles = document.getElementById("cw-widget-styles");
  if (sdkStyles?.parentNode) {
    sdkStyles.parentNode.insertBefore(style, sdkStyles.nextSibling);
  } else {
    document.head.appendChild(style);
  }
};

let bodyScrollLockY = 0;
let isBodyScrollLocked = false;

const setChatwootOpenScrollLock = (locked: boolean) => {
  if (locked === isBodyScrollLocked) return;

  const html = document.documentElement;
  const body = document.body;
  isBodyScrollLocked = locked;

  if (locked) {
    bodyScrollLockY = window.scrollY;
    html.classList.add("chatwoot-panel-open");
    body.style.setProperty("overflow", "hidden");
    body.style.setProperty("overscroll-behavior", "none");
    return;
  }

  html.classList.remove("chatwoot-panel-open");
  body.style.removeProperty("overflow");
  body.style.removeProperty("overscroll-behavior");
  window.scrollTo(0, bodyScrollLockY);
};

const resetChatwootPanelInlineLayout = (holder: HTMLElement) => {
  holder.style.removeProperty("top");
  holder.style.removeProperty("right");
  holder.style.removeProperty("bottom");
  holder.style.removeProperty("left");
  holder.style.removeProperty("width");
  holder.style.removeProperty("height");
  holder.style.removeProperty("max-height");
  holder.style.removeProperty("transform");
};

/** 모바일: visualViewport 기준 팝업 위치·높이 — 키보드 시 패널만 줄어듦 */
export const applyChatwootPanelLayout = () => {
  if (!isMobileChatwootLayout()) {
    const holder = getChatwootWidgetHolder();
    if (holder) resetChatwootPanelInlineLayout(holder);
    document.documentElement.style.removeProperty("--chatwoot-panel-height");
    document.documentElement.style.removeProperty("--chatwoot-vv-height");
    document.documentElement.style.removeProperty("--chatwoot-vv-offset-top");
    return;
  }

  const holder = getChatwootWidgetHolder();
  if (!holder || holder.classList.contains("woot--hide") || holder.classList.contains("has-unread-view")) {
    return;
  }

  const vv = window.visualViewport;
  const viewportHeight = Math.round(vv?.height ?? window.innerHeight);
  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  const offsetLeft = Math.round(vv?.offsetLeft ?? 0);
  const viewportWidth = Math.round(vv?.width ?? window.innerWidth);
  const bottomReserve = CHATWOOT_BOTTOM_NAV_PX + CHATWOOT_PANEL_GAP_PX;
  const availableHeight = viewportHeight - CHATWOOT_PANEL_TOP_MIN_PX - bottomReserve;
  const panelHeight = Math.min(
    CHATWOOT_PANEL_MAX_HEIGHT_PX,
    Math.max(
      CHATWOOT_PANEL_MIN_HEIGHT_PX,
      Math.round(Math.min(availableHeight, viewportHeight * 0.72))
    )
  );
  const panelWidth = Math.min(
    CHATWOOT_PANEL_MAX_WIDTH_PX,
    Math.max(280, viewportWidth - 32)
  );
  const panelTop = Math.max(
    offsetTop + CHATWOOT_PANEL_TOP_MIN_PX,
    offsetTop + viewportHeight - panelHeight - bottomReserve
  );
  const panelRight = Math.max(
    16,
    window.innerWidth - (offsetLeft + viewportWidth) + 16
  );

  const signature = [
    Math.round(panelTop),
    Math.round(panelRight),
    panelWidth,
    panelHeight,
    offsetTop,
    viewportHeight,
  ].join("|");
  if (signature === lastPanelLayoutSignature) return;
  lastPanelLayoutSignature = signature;

  document.documentElement.style.setProperty("--chatwoot-panel-height", `${panelHeight}px`);
  document.documentElement.style.setProperty("--chatwoot-vv-height", `${viewportHeight}px`);
  document.documentElement.style.setProperty("--chatwoot-vv-offset-top", `${offsetTop}px`);
  holder.style.setProperty("top", `${Math.round(panelTop)}px`, "important");
  holder.style.setProperty("right", `${Math.round(panelRight)}px`, "important");
  holder.style.setProperty("bottom", "auto", "important");
  holder.style.setProperty("left", "auto", "important");
  holder.style.setProperty("width", `${panelWidth}px`, "important");
  holder.style.setProperty("height", `${panelHeight}px`, "important");
  holder.style.setProperty("max-height", `${panelHeight}px`, "important");
  holder.style.setProperty("transform", "none", "important");
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
          observer.disconnect();
          return;
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
let panelStateWatcherStarted = false;
let panelLayoutRaf = 0;
let panelViewportListenersAttached = false;

const onChatwootViewportResize = () => {
  scheduleChatwootPanelLayout();
};

const attachPanelViewportListeners = () => {
  if (panelViewportListenersAttached) return;
  panelViewportListenersAttached = true;
  window.visualViewport?.addEventListener("resize", onChatwootViewportResize, {
    passive: true,
  });
};

const detachPanelViewportListeners = () => {
  if (!panelViewportListenersAttached) return;
  panelViewportListenersAttached = false;
  window.visualViewport?.removeEventListener("resize", onChatwootViewportResize);
  if (panelLayoutRaf) {
    cancelAnimationFrame(panelLayoutRaf);
    panelLayoutRaf = 0;
  }
};

const openChatwootPanel = () => {
  injectChatwootMobileOverrides();
  setChatwootOpenScrollLock(true);
  attachPanelViewportListeners();
  applyChatwootPanelLayout();
};

const closeChatwootPanel = () => {
  detachPanelViewportListeners();
  resetPanelLayoutSignature();
  setChatwootOpenScrollLock(false);
  const holder = getChatwootWidgetHolder();
  if (holder) resetChatwootPanelInlineLayout(holder);
  document.documentElement.style.removeProperty("--chatwoot-panel-height");
  document.documentElement.style.removeProperty("--chatwoot-vv-height");
  document.documentElement.style.removeProperty("--chatwoot-vv-offset-top");
};

const scheduleChatwootPanelLayout = () => {
  if (!isChatwootPanelOpen() || !isMobileChatwootLayout()) return;
  if (panelLayoutRaf) return;
  panelLayoutRaf = requestAnimationFrame(() => {
    panelLayoutRaf = 0;
    applyChatwootPanelLayout();
  });
};

export const watchChatwootPanelState = () => {
  if (panelStateWatcherStarted) return;
  panelStateWatcherStarted = true;

  window.addEventListener("chatwoot:opened", openChatwootPanel);
  window.addEventListener("chatwoot:closed", closeChatwootPanel);
};

export const watchChatwootBubbleMount = () => {
  if (mountObserverStarted) return;
  mountObserverStarted = true;

  const onMount = () => {
    applyChatwootHolderLayout();
    injectChatwootMobileOverrides();
    if (import.meta.env.DEV) logChatwootTrace("holder-layout-applied");
  };

  if (document.getElementById(BUBBLE_HOLDER_ID)) {
    onMount();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BUBBLE_HOLDER_ID)) return;
    onMount();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("resize", () => {
    applyChatwootHolderLayout();
  }, { passive: true });
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
  injectChatwootMobileOverrides();
  watchChatwootBubbleMount();
  watchChatwootPanelState();

  const script = document.createElement("script");
  script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`;
  script.async = true;

  script.addEventListener("load", () => {
    try {
      performance.mark("chatwoot:sdk-loaded");
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV) logChatwootTrace("sdk.js:onload");

    window.chatwootSDK?.run({
      websiteToken: CHATWOOT_WEBSITE_TOKEN,
      baseUrl: CHATWOOT_BASE_URL,
    });

    try {
      performance.mark("chatwoot:sdk-run-called");
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV) logChatwootTrace("chatwootSDK.run-called");

    injectChatwootMobileOverrides();
    // run() 직후엔 아직 DOM에 없을 수 있음 — 짧게 재시도
    window.setTimeout(() => applyChatwootHolderLayout(), 0);
    window.setTimeout(() => applyChatwootHolderLayout(), 500);
    if (import.meta.env.DEV) {
      window.setTimeout(() => logChatwootTrace("post-run+500ms"), 500);
      window.setTimeout(() => logChatwootTrace("post-run+3000ms"), 3000);
    }
  });

  script.addEventListener("error", () => {
    console.error(
      `[Chatwoot] sdk.js 로드 실패 — ${CHATWOOT_BASE_URL}/packs/js/sdk.js (네트워크·Mixed Content 확인)`
    );
    logChatwootTrace("sdk.js:error");
  });

  document.head.appendChild(script);
};
