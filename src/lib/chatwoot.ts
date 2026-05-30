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
const CHATWOOT_VIEWPORT_RESIZES =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content";
const CHATWOOT_VIEWPORT_OVERLAYS =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=overlays-content";

let savedIOSViewportContent: string | null = null;

const getViewportMeta = () =>
  document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;

/** iOS: PWA는 viewport meta 전환이 무시되는 경우가 많아 body 고정 + shift 보정에 의존 */
const setIOSChatwootViewportMode = (panelOpen: boolean) => {
  if (!isIOSMobileChatwoot() || isIOSStandalonePWA()) return;
  const meta = getViewportMeta();
  if (!meta) return;

  if (panelOpen) {
    if (!savedIOSViewportContent) {
      savedIOSViewportContent = meta.content;
    }
    if (meta.content.includes("interactive-widget=resizes-content")) {
      meta.content = meta.content.replace(
        "interactive-widget=resizes-content",
        "interactive-widget=overlays-content"
      );
      return;
    }
    if (!meta.content.includes("interactive-widget=")) {
      meta.content = `${meta.content}, interactive-widget=overlays-content`;
    }
    return;
  }

  if (savedIOSViewportContent) {
    meta.content = savedIOSViewportContent;
    savedIOSViewportContent = null;
    return;
  }
  meta.content = CHATWOOT_VIEWPORT_RESIZES;
};

let iosLockedLayoutHeight = 0;

const isIOSStandalonePWA = () =>
  isIOSMobileChatwoot() &&
  ((window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches);

const setIOSLayoutShiftCompensation = (inset: number) => {
  if (!isIOSMobileChatwoot()) return;
  const html = document.documentElement;
  const shift = Math.max(0, Math.round(inset));
  if (shift > 0) {
    html.style.setProperty("--chatwoot-ios-layout-shift", `${shift}px`);
    html.classList.add("chatwoot-ios-layout-compensate");
    return;
  }
  html.style.removeProperty("--chatwoot-ios-layout-shift");
  html.classList.remove("chatwoot-ios-layout-compensate");
};

const getIOSBackgroundLayoutShift = () => {
  const vv = window.visualViewport;
  const vvDelta =
    baselineViewportHeight > 0 && vv
      ? Math.max(0, baselineViewportHeight - Math.round(vv.height))
      : 0;
  const innerDelta =
    iosLockedLayoutHeight > 0
      ? Math.max(0, iosLockedLayoutHeight - window.innerHeight)
      : 0;
  return Math.max(vvDelta, innerDelta);
};

const syncIOSBackgroundCompensation = () => {
  if (!isIOSMobileChatwoot() || !isChatwootPanelOpen()) {
    setIOSLayoutShiftCompensation(0);
    return;
  }
  // 키보드 애니메이션 중 transform 토글은 배경 번쩍임 유발 → 거의 다 열린 뒤에만 보정
  const inset = getKeyboardInset();
  if (inset <= CHATWOOT_KEYBOARD_INSET_THRESHOLD_PX) {
    setIOSLayoutShiftCompensation(0);
    return;
  }
  const progress = getKeyboardLayoutProgress();
  if (progress < 0.92) {
    return;
  }
  setIOSLayoutShiftCompensation(getIOSBackgroundLayoutShift());
};

const getIOSPinnedViewportHeight = () =>
  iosLockedLayoutHeight > 0
    ? iosLockedLayoutHeight
    : baselineViewportHeight > 0
      ? baselineViewportHeight
      : Math.round(window.visualViewport?.height ?? window.innerHeight);

const applyIOSPinnedDocumentHeight = (pinnedHeight: number) => {
  const html = document.documentElement;
  const body = document.body;
  const root = getRootElement();
  html.style.setProperty("height", `${pinnedHeight}px`);
  body.style.setProperty("height", `${pinnedHeight}px`);
  if (root) {
    root.style.setProperty("height", `${pinnedHeight}px`);
    root.style.setProperty("min-height", `${pinnedHeight}px`);
  }
};

const clearIOSPinnedDocumentHeight = () => {
  const html = document.documentElement;
  const body = document.body;
  const root = getRootElement();
  html.style.removeProperty("height");
  body.style.removeProperty("height");
  if (root) {
    root.style.removeProperty("height");
    root.style.removeProperty("min-height");
  }
};

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
let lastScrollNotifyProgress = 0;

type PanelRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const lerpPanelValue = (from: number, to: number, progress: number) =>
  Math.round(from + (to - from) * progress);

const isIOSMobileChatwoot = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

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
  const vvHeightDelta =
    vv && baselineViewportHeight > 0
      ? Math.max(0, baselineViewportHeight - Math.round(vv.height))
      : 0;

  // iOS: layout shrink + visual viewport height 모두 반영 (PWA는 innerHeight 변화가 큼)
  if (isIOSMobileChatwoot()) {
    const innerDelta =
      iosLockedLayoutHeight > 0
        ? Math.max(0, iosLockedLayoutHeight - window.innerHeight)
        : 0;
    return Math.max(vvHeightDelta, innerDelta);
  }

  const vvInset = vv
    ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    : 0;
  const vkInset = getVirtualKeyboardInset();
  const innerHeightDelta =
    baselineViewportHeight > 0
      ? Math.max(0, baselineViewportHeight - window.innerHeight)
      : 0;
  return Math.max(vvInset, vkInset, innerHeightDelta, vvHeightDelta);
};

/** iOS: visual viewport top (layout 좌표) — fixed 패널은 top >= 이 값이어야 화면 밖으로 안 밀림 */
const getIOSKeyboardPanelTop = () => {
  const vv = window.visualViewport;
  const rawOffsetTop = Math.max(0, Math.round(vv?.offsetTop ?? 0));
  if (rawOffsetTop <= 0) return 0;

  const baseline = baselineViewportHeight || window.innerHeight;
  return Math.min(rawOffsetTop, Math.round(baseline * 0.65));
};

/** iOS: 키보드가 열렸을 때 도달할 최종 패널 위치 (중간 추적 없이 한 번에 이동할 목표) */
const getIOSKeyboardTargetRect = (keyboard: PanelRect): PanelRect => {
  const vv = window.visualViewport;
  const offsetTop = getIOSKeyboardPanelTop();
  const vvHeight = Math.max(200, Math.round(vv?.height ?? window.innerHeight));
  return {
    top: offsetTop,
    left: keyboard.left,
    width: keyboard.width,
    height: Math.min(keyboard.height, vvHeight),
  };
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
    right: auto !important;
    bottom: auto !important;
    border-radius: 16px !important;
    overscroll-behavior: contain !important;
    touch-action: pan-y !important;
    transition: ${CHATWOOT_PANEL_LAYOUT_TRANSITION} !important;
    will-change: top, left, width, height, transform;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) iframe {
    min-height: 0 !important;
    max-height: 100% !important;
    height: 100% !important;
  }

  html.chatwoot-keyboard-open #${WIDGET_HOLDER_ID}.woot-widget-holder:not(.woot--hide):not(.has-unread-view) {
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
    if (isIOSMobileChatwoot()) {
      html.classList.add("chatwoot-ios-panel-open");
      applyIOSPinnedDocumentHeight(getIOSPinnedViewportHeight());
      body.style.setProperty("position", "fixed");
      body.style.setProperty("top", `-${bodyScrollLockY}px`);
      body.style.setProperty("left", "0");
      body.style.setProperty("right", "0");
      body.style.setProperty("width", "100%");
    } else {
      html.style.setProperty("height", "100%");
    }
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
  html.classList.remove("chatwoot-ios-panel-open");
  html.style.removeProperty("overflow");
  if (isIOSMobileChatwoot()) {
    clearIOSPinnedDocumentHeight();
    body.style.removeProperty("position");
    body.style.removeProperty("top");
    body.style.removeProperty("left");
    body.style.removeProperty("right");
    body.style.removeProperty("width");
  } else {
    html.style.removeProperty("height");
  }
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

const getRestPanelRect = (panelWidth: number, panelHeight: number): PanelRect => {
  const layoutWidth = window.innerWidth;
  const layoutHeight = baselineViewportHeight || window.innerHeight;
  return {
    top: Math.round((layoutHeight - panelHeight) / 2),
    left: Math.round((layoutWidth - panelWidth) / 2),
    width: panelWidth,
    height: panelHeight,
  };
};

const getKeyboardPanelRect = (panelWidth: number, panelHeight: number): PanelRect => {
  const vv = window.visualViewport;
  const visibleWidth = Math.round(vv?.width ?? window.innerWidth);
  const fittedWidth = Math.min(panelWidth, Math.max(280, visibleWidth - 32));
  const fittedHeight = Math.max(
    200,
    Math.round(vv?.height ?? window.innerHeight)
  );

  if (isIOSMobileChatwoot()) {
    const layoutWidth = window.innerWidth;
    return {
      top: getIOSKeyboardPanelTop(),
      left: Math.round((layoutWidth - fittedWidth) / 2),
      width: Math.round(fittedWidth),
      height: fittedHeight,
    };
  }

  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  const offsetLeft = Math.round(vv?.offsetLeft ?? 0);

  return {
    top: offsetTop,
    left: Math.round(offsetLeft + Math.max(0, (visibleWidth - fittedWidth) / 2)),
    width: Math.round(fittedWidth),
    height: fittedHeight,
  };
};

const getKeyboardLayoutProgress = () => {
  const inset = getKeyboardInset();
  if (inset <= 0) return 0;

  const referenceInset = Math.max(
    CHATWOOT_KEYBOARD_INSET_THRESHOLD_PX * 2,
    Math.round((baselineViewportHeight || window.innerHeight) * 0.35)
  );
  return Math.min(1, inset / referenceInset);
};

const applyPanelRect = (
  holder: HTMLElement,
  rect: PanelRect,
  options: { minHeight?: number; animate?: boolean } = {}
) => {
  const { minHeight, animate = true } = options;
  if (animate) {
    enablePanelLayoutTransition(holder);
  } else {
    holder.style.setProperty("transition", "none", "important");
  }

  holder.style.setProperty("top", `${rect.top}px`, "important");
  holder.style.setProperty("left", `${rect.left}px`, "important");
  holder.style.setProperty("right", "auto", "important");
  holder.style.setProperty("bottom", "auto", "important");
  holder.style.setProperty("transform", "none", "important");
  holder.style.setProperty("width", `${rect.width}px`, "important");
  holder.style.setProperty("height", `${rect.height}px`, "important");
  holder.style.setProperty("max-height", `${rect.height}px`, "important");

  if (minHeight !== undefined) {
    holder.style.setProperty("min-height", `${minHeight}px`, "important");
  } else {
    holder.style.removeProperty("min-height");
  }

  if (!animate) {
    requestAnimationFrame(() => {
      enablePanelLayoutTransition(holder);
    });
  }
};

const applyInterpolatedPanelLayout = (
  holder: HTMLElement,
  panelWidth: number,
  panelHeight: number,
  progress: number,
  options: { animate?: boolean } = {}
) => {
  const rest = getRestPanelRect(panelWidth, panelHeight);
  const keyboard = getKeyboardPanelRect(panelWidth, panelHeight);
  const t = Math.min(1, Math.max(0, progress));

  // iOS: offsetTop 스파이크 추적이 출렁임을 만드므로 보간하지 않고
  // rest ↔ keyboard 목표 둘 중 하나로 CSS transition을 통해 "한 번에" 이동한다.
  if (isIOSMobileChatwoot()) {
    const keyboardActive =
      getKeyboardInset() > CHATWOOT_KEYBOARD_INSET_THRESHOLD_PX;
    const target = keyboardActive ? getIOSKeyboardTargetRect(keyboard) : rest;

    applyPanelRect(holder, target, {
      animate: options.animate !== false,
      minHeight: keyboardActive ? undefined : CHATWOOT_PANEL_MIN_HEIGHT_PX,
    });
    setChatwootKeyboardOpenClass(keyboardActive);
    syncIOSBackgroundCompensation();

    if (keyboardActive && lastScrollNotifyProgress <= 0.45) {
      notifyChatwootScrollToBottom();
      window.setTimeout(notifyChatwootScrollToBottom, 100);
    }
    lastScrollNotifyProgress = keyboardActive ? 1 : 0;
    return;
  }

  const rect: PanelRect = {
    top: lerpPanelValue(rest.top, keyboard.top, t),
    left: lerpPanelValue(rest.left, keyboard.left, t),
    width: lerpPanelValue(rest.width, keyboard.width, t),
    height: lerpPanelValue(rest.height, keyboard.height, t),
  };

  const shouldAnimate =
    options.animate !== false && (t < 0.05 || t > 0.95);

  applyPanelRect(holder, rect, {
    animate: shouldAnimate,
    minHeight: t < 0.05 ? CHATWOOT_PANEL_MIN_HEIGHT_PX : undefined,
  });
  setChatwootKeyboardOpenClass(t > 0.85);

  if (t > 0.45 && lastScrollNotifyProgress <= 0.45) {
    notifyChatwootScrollToBottom();
    window.setTimeout(notifyChatwootScrollToBottom, 100);
  }
  lastScrollNotifyProgress = t;
};

const setChatwootKeyboardOpenClass = (open: boolean) => {
  document.documentElement.classList.toggle("chatwoot-keyboard-open", open);
};

/** 모바일: rest↔keyboard 사이를 inset 비율로 보간 — 축소·확대 모두 px 좌표계 */
export const applyChatwootPanelLayout = (options: { animate?: boolean } = {}) => {
  if (!isMobileChatwootLayout()) {
    setChatwootKeyboardOpenClass(false);
    lastScrollNotifyProgress = 0;
    const holder = getChatwootWidgetHolder();
    if (holder) resetChatwootPanelInlineLayout(holder);
    return;
  }

  const holder = getChatwootWidgetHolder();
  if (!holder || holder.classList.contains("woot--hide") || holder.classList.contains("has-unread-view")) {
    return;
  }

  const { panelWidth, panelHeight } = ensureBasePanelMetrics();
  const progress = getKeyboardLayoutProgress();
  const signature = `p|${progress.toFixed(3)}|${panelWidth}|${panelHeight}|${Math.round(window.visualViewport?.height ?? 0)}|${Math.round(window.visualViewport?.offsetTop ?? 0)}`;

  if (signature === lastPanelLayoutSignature) return;
  lastPanelLayoutSignature = signature;

  applyInterpolatedPanelLayout(holder, panelWidth, panelHeight, progress, options);
};

const onChatwootViewportChange = () => {
  if (!isChatwootPanelOpen() || !isMobileChatwootLayout()) return;
  const keyboardActive = getKeyboardLayoutProgress() > 0.02;
  if (isBodyScrollLocked && !(isIOSMobileChatwoot() && keyboardActive)) {
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
    if (frames < (isIOSMobileChatwoot() ? 30 : 18)) {
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
  iosLockedLayoutHeight = Math.round(
    window.visualViewport?.height ?? window.innerHeight
  );
  captureBaselineViewportHeight();
  setIOSChatwootViewportMode(true);
  setChatwootOpenScrollLock(true);
  ensureChatwootBackdrop();
  setBackgroundTouchBlocker(true);
  pushChatwootHistory();
  attachPanelViewportListeners();
  attachPanelFocusListeners();
  lastScrollNotifyProgress = 0;
  resetPanelLayoutSignature();
  const holder = getChatwootWidgetHolder();
  if (holder) {
    const { panelWidth, panelHeight } = ensureBasePanelMetrics();
    applyInterpolatedPanelLayout(holder, panelWidth, panelHeight, 0, { animate: false });
  }
  scheduleDismissChatwootKeyboard();
};

const closeChatwootPanel = (fromPopState = false) => {
  clearDismissChatwootKeyboardTimers();
  detachPanelViewportListeners();
  detachPanelFocusListeners();
  resetPanelLayoutSignature();
  resetBasePanelMetrics();
  resetBaselineViewportHeight();
  iosLockedLayoutHeight = 0;
  lastScrollNotifyProgress = 0;
  setIOSLayoutShiftCompensation(0);
  setChatwootKeyboardOpenClass(false);
  setChatwootOpenScrollLock(false);
  setIOSChatwootViewportMode(false);
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
