import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { X, Share } from "lucide-react";

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
  const [step, setStep] = useState<Step>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isSamsung, setIsSamsung] = useState(false);
  const iosGuideTouchStartY = useRef<number | null>(null);

  useEffect(() => {
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
      setStep("popup");
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
  }, []);

  const handleDismissToday = () => {
    dismissForToday();
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

  const handleIosGuideTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    iosGuideTouchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleIosGuideTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startY = iosGuideTouchStartY.current;
    iosGuideTouchStartY.current = null;
    if (startY === null) return;

    const endY = event.changedTouches[0]?.clientY;
    if (endY !== undefined && endY - startY > 48) {
      setStep(null);
    }
  };

  if (step === "ios-guide") {
    return (
      <div className="fixed bottom-20 left-0 right-0 z-[200] mx-auto max-w-md px-4 animate-in slide-in-from-bottom-4 duration-300">
        <div
          className="rounded-2xl border border-border bg-card shadow-xl p-4"
          onTouchStart={handleIosGuideTouchStart}
          onTouchEnd={handleIosGuideTouchEnd}
        >
          <div className="flex items-start gap-3">
            <img
              src="/favicon.png"
              alt="스탠"
              className="h-10 w-10 rounded-xl shrink-0 object-contain border border-border/40"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">홈 화면에 추가하기</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />{" "}
                공유 버튼 →{" "}
                <strong>"홈 화면에 추가"</strong> 선택
              </p>
            </div>
            <button
              onClick={() => setStep(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleDismissToday}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              오늘 하루 보지 않기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "popup") {
    return (
      <div className="fixed inset-0 z-[200] flex items-end justify-center pb-24 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl py-3 px-5 animate-in slide-in-from-bottom-4 duration-300">
          {/* 앱 정보 + 오늘하루 보지 않기 */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src="/favicon.png"
                  alt="스탠"
                  className="h-14 w-14 rounded-2xl shrink-0 object-contain border border-border/40"
                />
                <p className="font-bold text-base text-foreground">홈 화면 추가</p>
              </div>
              <button
                onClick={handleDismissToday}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="오늘하루 보지 않기"
              >
                오늘하루 보지 않기
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              <span className="block whitespace-nowrap">홈 화면에 추가하시면 앱처럼</span>
              <span className="block whitespace-nowrap">빠르게 이용할 수 있어요</span>
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleNo}
              className="flex-1 rounded-xl border border-border bg-muted/60 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:opacity-70 transition-opacity"
            >
              아니오
            </button>
            <button
              onClick={handleYes}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:opacity-80 transition-opacity"
            >
              홈 화면에 추가
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PwaInstallPrompt;
