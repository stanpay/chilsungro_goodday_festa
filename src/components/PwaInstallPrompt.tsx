import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

const STORAGE_KEY = "pwa-install-dismissed";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function isIosSafari() {
  return (
    isIos() &&
    /safari/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent)
  );
}

// Chrome / Whale 등 Chromium 계열 브라우저는 beforeinstallprompt를 가로채지 않음.
// 브라우저가 자체 설치 UI(모바일: 하단 시트, 데스크탑: 주소창 아이콘)를 띄운다.
// iOS Safari만 직접 안내 팝업을 표시한다.
const PwaInstallPrompt = () => {
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (isIosSafari()) setShowIosGuide(true);
  }, []);

  const dismiss = () => {
    setShowIosGuide(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  if (!showIosGuide) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[200] mx-auto max-w-md px-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-border bg-card shadow-xl p-4">
        <div className="flex items-start gap-3">
          <img
            src="/favicon.png"
            alt="스탠"
            className="h-12 w-12 rounded-xl shrink-0 object-contain border border-border/40"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground">홈 화면에 추가하기</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              하단의{" "}
              <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />{" "}
              공유 버튼을 누른 후
              <br />
              <strong>"홈 화면에 추가"</strong>를 선택하세요.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
