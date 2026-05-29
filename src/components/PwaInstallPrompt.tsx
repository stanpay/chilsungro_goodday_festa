import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { useLocation } from "react-router-dom";
import { X, Share } from "lucide-react";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { pwaInstallStrings } from "@/lib/locale";

const HOME_PATHS = new Set(["/", "/jeju", "/main"]);

function isHomePath(pathname: string) {
  return HOME_PATHS.has(pathname);
}

const PROMPT_STORAGE_PREFIX = `pwa-prompt:${__APP_BUILD_ID__}`;
const SESSION_KEY = `${PROMPT_STORAGE_PREFIX}:shown`;
const DISMISS_KEY = `${PROMPT_STORAGE_PREFIX}:dismissed-until`;

function isInStandaloneMode() {
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
}

function isSamsungInternet() {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function isDismissedToday(): boolean {
  const until = localStorage.getItem(DISMISS_KEY);
  if (!until) return false;
  return Date.now() < parseInt(until, 10);
}

function dismissForToday() {
  localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
}

type Step = "popup" | "ios-guide" | null;

const PwaInstallPrompt = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const shouldShow = isMobile && isHomePath(location.pathname);
  const { locale } = useAppLocale();
  const t = pwaInstallStrings(locale);
  const [step, setStep] = useState<Step>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isSamsung, setIsSamsung] = useState(false);
  const swipeStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!step) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";

    const blockPullRefresh = (event: globalThis.TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      event.preventDefault();
    };

    document.addEventListener("touchmove", blockPullRefresh, { passive: false });

    return () => {
      html.style.overscrollBehaviorY = prevHtmlOverscroll;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
      document.removeEventListener("touchmove", blockPullRefresh);
    };
  }, [step]);

  useEffect(() => {
    if (!shouldShow) return;
    if (isInStandaloneMode()) return;
    if (isDismissedToday()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const samsung = isSamsungInternet();
    setIsSamsung(samsung);

    if (samsung) {
      setStep("popup");
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }

    if (isIosSafari()) {
      setIsIos(true);
      setStep("ios-guide");
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setStep("popup");
      sessionStorage.setItem(SESSION_KEY, "1");
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [shouldShow]);

  const handleDismissToday = () => {
    dismissForToday();
    setStep(null);
  };

  const handleClose = () => {
    setStep(null);
  };

  const handleNo = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setStep(null);
  };

  const handleYes = async () => {
    if (isIos) {
      setStep("ios-guide");
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setStep(null);
  };

  const handleSwipeStart = (event: TouchEvent<HTMLDivElement>) => {
    swipeStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleSwipeMove = (event: TouchEvent<HTMLDivElement>) => {
    const startY = swipeStartY.current;
    if (startY === null) return;

    const currentY = event.touches[0]?.clientY;
    if (currentY !== undefined && currentY - startY > 10) {
      event.preventDefault();
    }
  };

  const handleSwipeEnd = (event: TouchEvent<HTMLDivElement>, onDismiss: () => void) => {
    const startY = swipeStartY.current;
    swipeStartY.current = null;
    if (startY === null) return;

    const endY = event.changedTouches[0]?.clientY;
    if (endY !== undefined && endY - startY > 48) {
      onDismiss();
    }
  };

  if (!shouldShow) return null;

  if (step === "ios-guide") {
    return (
      <div className="fixed bottom-20 left-0 right-0 z-[200] mx-auto max-w-md px-4 animate-in slide-in-from-bottom-4 duration-300">
        <div
          className="touch-none rounded-2xl border border-border bg-card shadow-xl p-4"
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={(event) => handleSwipeEnd(event, handleClose)}
        >
          <div className="flex items-start gap-3">
            <img
              src="/favicon.png"
              alt={t.appNameAlt}
              className="h-10 w-10 rounded-xl shrink-0 object-contain border border-border/40"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">{t.iosGuideTitle}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />{" "}
                {t.iosGuideShareLabel} →{" "}
                <strong>"{t.iosGuideMenuItem}"</strong> {t.iosGuideSelectAction}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t.closeAria}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleDismissToday}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.dismissToday}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "popup") {
    return (
      <div className="fixed inset-0 z-[200] flex items-end justify-center overscroll-none pb-24 px-4 touch-none">
        <div
          className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl py-3 px-5 animate-in slide-in-from-bottom-4 duration-300"
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={(event) => handleSwipeEnd(event, handleNo)}
        >
          {/* 앱 정보 + 오늘 하루 보지 않기 */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src="/favicon.png"
                  alt={t.appNameAlt}
                  className="h-14 w-14 rounded-2xl shrink-0 object-contain border border-border/40"
                />
                <p className="font-bold text-base text-foreground">{t.popupTitle}</p>
              </div>
              <button
                onClick={handleDismissToday}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label={t.dismissToday}
              >
                {t.dismissToday}
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              <span className="block whitespace-nowrap">{t.popupDescriptionLine1}</span>
              <span className="block whitespace-nowrap">{t.popupDescriptionLine2}</span>
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleNo}
              className="flex-1 rounded-xl border border-border bg-muted/60 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:opacity-70 transition-opacity"
            >
              {t.noButton}
            </button>
            <button
              onClick={handleYes}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:opacity-80 transition-opacity"
            >
              {t.addButton}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PwaInstallPrompt;
