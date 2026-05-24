import { useEffect, useState } from "react";
import { X, Share, Download } from "lucide-react";

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

const PwaInstallPrompt = () => {
  const [showIos, setShowIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showChromium, setShowChromium] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    if (isIosSafari()) {
      setShowIos(true);
      return;
    }

    // Chromium 계열: beforeinstallprompt 캡처 → 커스텀 배너 표시
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowChromium(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setShowChromium(false);
  };

  if (!showIos && !showChromium) return null;

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
            <p className="font-bold text-sm text-foreground">스탠 앱 설치</p>
            {showIos ? (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                하단의{" "}
                <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" />{" "}
                공유 버튼을 누른 후{" "}
                <strong>"홈 화면에 추가"</strong>를 선택하세요.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                홈 화면에 추가하면 더 빠르게 사용할 수 있어요
              </p>
            )}
          </div>
          <button
            onClick={() => { setShowIos(false); setShowChromium(false); }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {showChromium && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:opacity-80 transition-opacity"
          >
            <Download className="h-4 w-4" />
            설치하기
          </button>
        )}
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
