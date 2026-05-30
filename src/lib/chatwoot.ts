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
const CHATWOOT_PANEL_MAX_HEIGHT_PX = 560;
const CHATWOOT_PANEL_MIN_HEIGHT_PX = 280;
const CHATWOOT_PANEL_MAX_WIDTH_PX = 400;
const CHATWOOT_KEYBOARD_INSET_THRESHOLD_PX = 80;
const CHATWOOT_PANEL_LAYOUT_TRANSITION =
  "top 0.28s ease, left 0.28s ease, width 0.28s ease, height 0.28s ease, max-height 0.28s ease, min-height 0.28s ease, transform 0.28s ease, border-radius 0.28s ease";
const ROOT_ELEMENT_ID = "root";
const CHATWOOT_OVERRIDES_STYLE_ID = "stan-chatwoot-overrides";
const CHATWOOT_BACKDROP_ID = "stan-chatwoot-backdrop";
const CHATWOOT_FOCUS_SENTINEL_ID = "stan-chatwoot-focus-sentinel";
const CHATWOOT_HISTORY_STATE_KEY = "stanChatwoot";

declare global {
  interface Window {
    chatwootSettings?: { position: string; type: string; launcherTitle: string };
    chatwootSDK?: { run: (config: { websiteToken: string; baseUrl: string }) => void };
    $chatwoot?: { toggle: (state?: "open" | "close") => void; isOpen?: boolean };
    __chatwootStanBooted?: boolean;
    __chatwootStanTracerStarted?: boolean;
  }
  interface Navigator {
    virtualKeyboard?: {
      overlaysContent: boolean;
      boundingRect: DOMRect;
      addEventListener(type: "geometrychange", listener: () => void): void;
      removeEventListener(type: "geometrychange", listener: () => void): void;
    };
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
let basePanelWidth = 0;
let basePanelHeight = 0;
let baselineViewportHeight = 0;
let chatIframeFocused = false;
let panelLayoutRaf = 0;
let panelViewportListenersAttached = false;
let panelFocusListenersAttached = false;
let keyboardLayoutPollRaf = 0;

const resetPanelLayoutSignature = () => {
  lastPanelLayoutSignature = "";
};

const resetBasePanelMetrics = () => {
  basePanelWidth = 0;
  basePanelHeight = 0;
  chatIframeFocused = false;
};

const resetBaselineViewportHeight = () => {
  baselineViewportHeight = 0;
};

const getChatwootIframe = () =>
  document.getElementById("chatwoot_live_chat_widget");

const isChatIframeFocused = () => {
  const iframe = getChatwootIframe();
  return iframe instanceof HTMLElement && document.activeElement === iframe;
};

const getVirtualKeyboardInset = () => {
  const rect = navigator.virtualKeyboard?.boundingRect;
  if (!rect || rect.height <= 0) return 0;
  return Math.round(rect.height);
};

const getKeyboardInset = () => {
  const vv = window.visualViewport;
  const vvInset = vv
    ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    : 0;
  const vkInset = getVirtualKeyboardInset();
  const innerHeightDelta =
    baselineViewportHeight > 0
      ? Math.max(0, baselineViewportHeight - window.innerHeight)
      : 0;
  const vvHeightDelta =
    vv && baselineViewportHeight > 0
      ? Math.max(0, baselineViewportHeight - Math.round(vv.height))
      : 0;
  return Math.max(vvInset, vkInset, innerHeightDelta, vvHeightDelta);
};

const isKeyboardVisible = () => {
  if (!isMobileChatwootLayout()) return false;
  return getKeyboardInset() > CHATWOOT_KEYBOARD_INSET_THRESHOLD_PX;
};

const captureBaselineViewportHeight = () => {
  baselineViewportHeight = Math.round(
    window.visualViewport?.height ?? window.innerHeight
  );
};

const ensureBasePanelMetrics = () => {
  if (basePanelWidth > 0 && basePanelHeight > 0) {
    return { panelWidth: basePanelWidth, panelHeight: basePanelHeight };
  }
  const metrics = getFixedPanelMetrics();
  basePanelWidth = metrics.panelWidth;
  basePanelHeight = metrics.panelHeight;
  return metrics;
};

const getFixedPanelMetrics = () => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = baselineViewportHeight || window.innerHeight;
  const panelWidth = Math.min(
    CHATWOOT_PANEL_MAX_WIDTH_PX,
    Math.max(280, viewportWidth - 32)
  );
  const panelHeight = Math.min(
    CHATWOOT_PANEL_MAX_HEIGHT_PX,
    Math.max(
      CHATWOOT_PANEL_MIN_HEIGHT_PX,
      Math.round(viewportHeight * 0.72)
    )
  );
  return { panelWidth, panelHeight };
};

const enablePanelLayoutTransition = (holder: HTMLElement) => {
  holder.style.setProperty("transition", CHATWOOT_PANEL_LAYOUT_TRANSITION, "important");
};

const getRootElement = () => document.getElementById(ROOT_ELEMENT_ID);

const isMobileChatwootLayout = () =>
  typeof window !== "undefined" &&
  window.matchMedia(`(max-width: ${CHATWOOT_MOBILE_BREAKPOINT_PX}px)`).matches;

const getChatwootWidgetHolder = () =>
  document.getElementById(WIDGET_HOLDER_ID) as HTMLElement | null;

const isChatwootPanelOpen = () => {
  const holder = getChatwootWidgetHolder();
  return Boolean(holder && !holder.classList.contains("woot--hide"));
};

/** Chatwoot iframe 입력 autofocus 후 키보드를 내리기 위한 숨김 포커스 대상 */
const ensureChatwootFocusSentinel = () => {
  let sentinel = document.getElementById(CHATWOOT_FOCUS_SENTINEL_ID);
  if (!sentinel) {
    sentinel = document.createElement("button");
    sentinel.id = CHATWOOT_FOCUS_SENTINEL_ID;
    sentinel.type = "button";
    sentinel.tabIndex = -1;
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.textContent = "";
    sentinel.style.cssText =
      "position:fixed;left:-9999px;width:1px;height:1px;opacity:0;overflow:hidden;border:0;padding:0;";
    document.body.appendChild(sentinel);
  }
  return sentinel;
};

/** 모바일: iframe 자동 포커스로 올라온 키보드 숨김 */
export const dismissChatwootKeyboard = () => {
  if (!isMobileChatwootLayout()) return;

  const iframe = document.getElementById("chatwoot_live_chat_widget");
  if (iframe instanceof HTMLElement) {
    iframe.blur();
  }

  const sentinel = ensureChatwootFocusSentinel();
  sentinel.focus({ preventScroll: true });
  sentinel.blur();
};

let dismissKeyboardTimers: number[] = [];

const scheduleDismissChatwootKeyboard = () => {
  if (!isMobileChatwootLayout() || !isChatwootPanelOpen()) return;

  dismissKeyboardTimers.forEach((timer) => window.clearTimeout(timer));
  dismissKeyboardTimers = [];

  dismissChatwootKeyboard();
  dismissKeyboardTimers.push(window.setTimeout(dismissChatwootKeyboard, 0));
  dismissKeyboardTimers.push(window.setTimeout(dismissChatwootKeyboard, 50));
  dismissKeyboardTimers.push(window.setTimeout(dismissChatwootKeyboard, 150));
};

const clearDismissChatwootKeyboardTimers = () => {
  dismissKeyboardTimers.forEach((timer) => window.clearTimeout(timer));
  dismissKeyboardTimers = [];
};

const isContactChatwootMessage = (detail: unknown) => {
  if (!detail || typeof detail !== "object") return false;
  const message = detail as { sender_type?: string; sender?: { type?: string } };
  return message.sender_type === "Contact" || message.sender?.type === "contact";
};

/** SDK 모바일 전체화면 CSS를 덮어쓰기 — SDK style 뒤에 항상 재삽입 */
export const injectChatwootMobileOverrides = () => {
  document.getElementById(CHATWOOT_OVERRIDES_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = CHATWOOT_OVERRIDES_STYLE_ID;
  style.textContent = `
@media only screen and (max-width: ${CHATWOOT_MOBILE_BREAKPOINT_PX}px) {
  #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) {
    top: 50% !important;
    left: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translate(-50%, -50%) !important;
    width: min(calc(100vw - 2rem), ${CHATWOOT_PANEL_MAX_WIDTH_PX}px) !important;
    height: min(72dvh, ${CHATWOOT_PANEL_MAX_HEIGHT_PX}px) !important;
    max-height: min(72dvh, ${CHATWOOT_PANEL_MAX_HEIGHT_PX}px) !important;
    min-height: ${CHATWOOT_PANEL_MIN_HEIGHT_PX}px !important;
    border-radius: 16px !important;
    overscroll-behavior: contain !important;
    touch-action: pan-y !important;
    transition: ${CHATWOOT_PANEL_LAYOUT_TRANSITION} !important;
  }

  #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) iframe {
    min-height: 0 !important;
    max-height: 100% !important;
    height: 100% !important;
  }

  html.chatwoot-keyboard-open #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) {
    top: 0 !important;
    left: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translateX(-50%) !important;
    min-height: 0 !important;
    border-radius: 0 0 16px 16px !important;
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
let chatwootHistoryActive = false;
let suppressChatwootHistoryBack = false;

const setChatwootOpenScrollLock = (locked: boolean) => {
  if (locked === isBodyScrollLocked) return;

  const html = document.documentElement;
  const body = document.body;
  const root = getRootElement();
  isBodyScrollLocked = locked;

  if (locked) {
    bodyScrollLockY = window.scrollY;
    html.classList.add("chatwoot-panel-open");
    html.style.setProperty("overflow", "hidden");
    html.style.setProperty("height", "100%");
    body.style.setProperty("overflow", "hidden");
    body.style.setProperty("overscroll-behavior", "none");
    if (root) {
      root.style.setProperty("position", "fixed");
      root.style.setProperty("top", `-${bodyScrollLockY}px`);
      root.style.setProperty("left", "0");
      root.style.setProperty("right", "0");
      root.style.setProperty("width", "100%");
      root.style.setProperty("overflow", "hidden");
    }
    return;
  }

  html.classList.remove("chatwoot-panel-open");
  html.style.removeProperty("overflow");
  html.style.removeProperty("height");
  body.style.removeProperty("overflow");
  body.style.removeProperty("overscroll-behavior");
  if (root) {
    root.style.removeProperty("position");
    root.style.removeProperty("top");
    root.style.removeProperty("left");
    root.style.removeProperty("right");
    root.style.removeProperty("width");
    root.style.removeProperty("overflow");
  }
  window.scrollTo(0, bodyScrollLockY);
};

const ensureChatwootBackdrop = () => {
  let backdrop = document.getElementById(CHATWOOT_BACKDROP_ID);
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = CHATWOOT_BACKDROP_ID;
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", () => {
      window.$chatwoot?.toggle("close");
    });
    document.body.appendChild(backdrop);
  }
  backdrop.classList.add("is-visible");
};

const hideChatwootBackdrop = () => {
  document.getElementById(CHATWOOT_BACKDROP_ID)?.classList.remove("is-visible");
};

const preventBackgroundTouchMove = (event: TouchEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(`#${WIDGET_HOLDER_ID}, #${BUBBLE_HOLDER_ID}`)) return;
  event.preventDefault();
};

let backgroundTouchBlockerAttached = false;

const setBackgroundTouchBlocker = (enabled: boolean) => {
  if (enabled === backgroundTouchBlockerAttached) return;
  backgroundTouchBlockerAttached = enabled;
  if (enabled) {
    document.addEventListener("touchmove", preventBackgroundTouchMove, {
      passive: false,
    });
    return;
  }
  document.removeEventListener("touchmove", preventBackgroundTouchMove);
};

const pushChatwootHistory = () => {
  if (chatwootHistoryActive) return;
  chatwootHistoryActive = true;
  history.pushState({ [CHATWOOT_HISTORY_STATE_KEY]: true }, "");
};

const syncChatwootHistoryOnClose = (fromPopState: boolean) => {
  if (!chatwootHistoryActive) return;
  chatwootHistoryActive = false;

  if (fromPopState) return;

  if (history.state?.[CHATWOOT_HISTORY_STATE_KEY]) {
    suppressChatwootHistoryBack = true;
    history.back();
  }
};

const closeChatwootWidget = () => {
  window.$chatwoot?.toggle("close");
};

const resetChatwootPanelInlineLayout = (holder: HTMLElement) => {
  holder.style.removeProperty("top");
  holder.style.removeProperty("right");
  holder.style.removeProperty("bottom");
  holder.style.removeProperty("left");
  holder.style.removeProperty("width");
  holder.style.removeProperty("height");
  holder.style.removeProperty("max-height");
  holder.style.removeProperty("min-height");
  holder.style.removeProperty("transform");
  holder.style.removeProperty("transition");
};

const notifyChatwootScrollToBottom = () => {
  const iframe = document.getElementById("chatwoot_live_chat_widget");
  if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(
    `chatwoot-widget:${JSON.stringify({ event: "widget-visible" })}`,
    "*"
  );
};

const applyRestPanelLayout = (
  holder: HTMLElement,
  panelWidth: number,
  panelHeight: number
) => {
  enablePanelLayoutTransition(holder);
  holder.style.setProperty("top", "50%", "important");
  holder.style.setProperty("left", "50%", "important");
  holder.style.setProperty("right", "auto", "important");
  holder.style.setProperty("bottom", "auto", "important");
  holder.style.setProperty("transform", "translate(-50%, -50%)", "important");
  holder.style.setProperty("width", `${panelWidth}px`, "important");
  holder.style.setProperty("height", `${panelHeight}px`, "important");
  holder.style.setProperty("max-height", `${panelHeight}px`, "important");
  holder.style.setProperty("min-height", `${CHATWOOT_PANEL_MIN_HEIGHT_PX}px`, "important");
};

const applyKeyboardPanelLayout = (holder: HTMLElement, panelWidth: number) => {
  const vv = window.visualViewport;
  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  const visibleWidth = Math.round(vv?.width ?? window.innerWidth);
  const offsetLeft = Math.round(vv?.offsetLeft ?? 0);
  const fittedWidth = Math.min(panelWidth, Math.max(280, visibleWidth - 32));
  const panelLeft = offsetLeft + Math.max(0, (visibleWidth - fittedWidth) / 2);
  const fittedHeight = Math.max(
    200,
    Math.round(vv?.height ?? window.innerHeight)
  );

  enablePanelLayoutTransition(holder);
  // #root 고정 + visualViewport offsetTop — iOS에서 배경·네비가 밀리지 않음
  holder.style.setProperty("top", `${offsetTop}px`, "important");
  holder.style.setProperty("left", `${Math.round(panelLeft)}px`, "important");
  holder.style.setProperty("right", "auto", "important");
  holder.style.setProperty("bottom", "auto", "important");
  holder.style.setProperty("transform", "none", "important");
  holder.style.setProperty("width", `${Math.round(fittedWidth)}px`, "important");
  holder.style.setProperty("height", `${fittedHeight}px`, "important");
  holder.style.setProperty("max-height", `${fittedHeight}px`, "important");
  holder.style.removeProperty("min-height");
};

const setChatwootKeyboardOpenClass = (open: boolean) => {
  document.documentElement.classList.toggle("chatwoot-keyboard-open", open);
};

/** 모바일: 기본은 중앙 팝업, 키보드 시 visualViewport 최상단 + 높이 축소 */
export const applyChatwootPanelLayout = () => {
  if (!isMobileChatwootLayout()) {
    setChatwootKeyboardOpenClass(false);
    const holder = getChatwootWidgetHolder();
    if (holder) resetChatwootPanelInlineLayout(holder);
    return;
  }

  const holder = getChatwootWidgetHolder();
  if (!holder || holder.classList.contains("woot--hide") || holder.classList.contains("has-unread-view")) {
    return;
  }

  const { panelWidth, panelHeight } = ensureBasePanelMetrics();
  const keyboardOpen = isKeyboardVisible();
  const signature = keyboardOpen
    ? `kb|${getKeyboardInset()}|${panelWidth}|${Math.round(window.visualViewport?.height ?? 0)}|${Math.round(window.visualViewport?.offsetTop ?? 0)}`
    : `rest|${panelWidth}|${panelHeight}`;

  if (signature === lastPanelLayoutSignature) return;
  lastPanelLayoutSignature = signature;

  setChatwootKeyboardOpenClass(keyboardOpen);

  if (keyboardOpen) {
    applyKeyboardPanelLayout(holder, panelWidth);
    window.setTimeout(notifyChatwootScrollToBottom, 0);
    window.setTimeout(notifyChatwootScrollToBottom, 100);
  } else {
    applyRestPanelLayout(holder, panelWidth, panelHeight);
  }
};

const onChatwootViewportChange = () => {
  if (!isChatwootPanelOpen() || !isMobileChatwootLayout()) return;
  if (isBodyScrollLocked) {
    window.scrollTo(0, bodyScrollLockY);
  }
  if (panelLayoutRaf) return;
  panelLayoutRaf = requestAnimationFrame(() => {
    panelLayoutRaf = 0;
    resetPanelLayoutSignature();
    applyChatwootPanelLayout();
  });
};

const stopKeyboardLayoutPoll = () => {
  if (keyboardLayoutPollRaf) {
    cancelAnimationFrame(keyboardLayoutPollRaf);
    keyboardLayoutPollRaf = 0;
  }
};

const startKeyboardLayoutPoll = () => {
  stopKeyboardLayoutPoll();
  let frames = 0;
  const poll = () => {
    resetPanelLayoutSignature();
    applyChatwootPanelLayout();
    frames += 1;
    if (frames < 12) {
      keyboardLayoutPollRaf = requestAnimationFrame(poll);
    } else {
      keyboardLayoutPollRaf = 0;
    }
  };
  poll();
};

const onChatwootIframeFocusIn = (event: FocusEvent) => {
  if (!isChatwootPanelOpen() || !isMobileChatwootLayout()) return;
  if (event.target !== getChatwootIframe()) return;
  chatIframeFocused = true;
  startKeyboardLayoutPoll();
};

const onChatwootIframeFocusOut = (event: FocusEvent) => {
  if (!isChatwootPanelOpen() || !isMobileChatwootLayout()) return;
  if (event.target !== getChatwootIframe()) return;
  window.setTimeout(() => {
    if (isChatIframeFocused()) return;
    chatIframeFocused = false;
    resetPanelLayoutSignature();
    applyChatwootPanelLayout();
  }, 200);
};

const attachPanelFocusListeners = () => {
  if (panelFocusListenersAttached) return;
  panelFocusListenersAttached = true;
  window.addEventListener("focusin", onChatwootIframeFocusIn);
  window.addEventListener("focusout", onChatwootIframeFocusOut);
};

const detachPanelFocusListeners = () => {
  if (!panelFocusListenersAttached) return;
  panelFocusListenersAttached = false;
  window.removeEventListener("focusin", onChatwootIframeFocusIn);
  window.removeEventListener("focusout", onChatwootIframeFocusOut);
  stopKeyboardLayoutPoll();
};

const attachPanelViewportListeners = () => {
  if (panelViewportListenersAttached) return;
  panelViewportListenersAttached = true;
  window.visualViewport?.addEventListener("resize", onChatwootViewportChange, {
    passive: true,
  });
  window.visualViewport?.addEventListener("scroll", onChatwootViewportChange, {
    passive: true,
  });
  window.addEventListener("resize", onChatwootViewportChange, { passive: true });
  navigator.virtualKeyboard?.addEventListener("geometrychange", onChatwootViewportChange);
};

const detachPanelViewportListeners = () => {
  if (!panelViewportListenersAttached) return;
  panelViewportListenersAttached = false;
  window.visualViewport?.removeEventListener("resize", onChatwootViewportChange);
  window.visualViewport?.removeEventListener("scroll", onChatwootViewportChange);
  window.removeEventListener("resize", onChatwootViewportChange);
  navigator.virtualKeyboard?.removeEventListener("geometrychange", onChatwootViewportChange);
  if (panelLayoutRaf) {
    cancelAnimationFrame(panelLayoutRaf);
    panelLayoutRaf = 0;
  }
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
let closingChatwootFromPopState = false;

const openChatwootPanel = () => {
  injectChatwootMobileOverrides();
  resetBasePanelMetrics();
  resetBaselineViewportHeight();
  captureBaselineViewportHeight();
  setChatwootOpenScrollLock(true);
  ensureChatwootBackdrop();
  setBackgroundTouchBlocker(true);
  pushChatwootHistory();
  attachPanelViewportListeners();
  attachPanelFocusListeners();
  applyChatwootPanelLayout();
  scheduleDismissChatwootKeyboard();
};

const closeChatwootPanel = (fromPopState = false) => {
  clearDismissChatwootKeyboardTimers();
  detachPanelViewportListeners();
  detachPanelFocusListeners();
  resetPanelLayoutSignature();
  resetBasePanelMetrics();
  resetBaselineViewportHeight();
  setChatwootKeyboardOpenClass(false);
  setChatwootOpenScrollLock(false);
  hideChatwootBackdrop();
  setBackgroundTouchBlocker(false);
  syncChatwootHistoryOnClose(fromPopState);
  const holder = getChatwootWidgetHolder();
  if (holder) resetChatwootPanelInlineLayout(holder);
  dismissChatwootKeyboard();
};

const onChatwootPopState = () => {
  if (suppressChatwootHistoryBack) {
    suppressChatwootHistoryBack = false;
    return;
  }
  if (!isChatwootPanelOpen()) return;
  closingChatwootFromPopState = true;
  closeChatwootWidget();
};

export const watchChatwootPanelState = () => {
  if (panelStateWatcherStarted) return;
  panelStateWatcherStarted = true;

  window.addEventListener("chatwoot:opened", openChatwootPanel);
  window.addEventListener("chatwoot:closed", () => {
    closeChatwootPanel(closingChatwootFromPopState);
    closingChatwootFromPopState = false;
  });
  window.addEventListener("popstate", onChatwootPopState);
  window.addEventListener("chatwoot:on-start-conversation", scheduleDismissChatwootKeyboard);
  window.addEventListener("chatwoot:on-message", (event) => {
    if (isContactChatwootMessage(event.detail)) {
      scheduleDismissChatwootKeyboard();
    }
  });
};

export const watchChatwootBubbleMount = () => {
  if (mountObserverStarted) return;
  mountObserverStarted = true;

  const onMount = () => {
    applyChatwootHolderLayout();
    injectChatwootMobileOverrides();

    const widgetHolder = getChatwootWidgetHolder();
    if (widgetHolder) {
      const holderObserver = new MutationObserver(() => {
        injectChatwootMobileOverrides();
        if (isChatwootPanelOpen()) applyChatwootPanelLayout();
      });
      holderObserver.observe(widgetHolder, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    if (import.meta.env.DEV) logChatwootTrace("holder-layout-applied");
  };

  if (document.getElementById(BUBBLE_HOLDER_ID) || getChatwootWidgetHolder()) {
    onMount();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BUBBLE_HOLDER_ID) && !getChatwootWidgetHolder()) return;
    onMount();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener(
    "resize",
    () => {
      applyChatwootHolderLayout();
      if (isChatwootPanelOpen() && isMobileChatwootLayout()) {
        resetPanelLayoutSignature();
        applyChatwootPanelLayout();
      }
    },
    { passive: true }
  );
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
    window.setTimeout(() => {
      applyChatwootHolderLayout();
      injectChatwootMobileOverrides();
    }, 0);
    window.setTimeout(() => {
      applyChatwootHolderLayout();
      injectChatwootMobileOverrides();
    }, 500);
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
