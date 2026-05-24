import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const PwaInstallPrompt = () => {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ios = isIos();
    setIsIosDevice(ios);

    if (ios) {
      // iOS는 Safari일 때만 안내 표시
      const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
      if (isSafari) setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[200] mx-auto max-w-md px-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-border bg-card shadow-xl p-4">
        <div className="flex items-start gap-3">
          <img src="/favicon.png" alt="스탠" className="h-12 w-12 rounded-xl shrink-0 object-contain border border-border/40" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground">홈 화면에 추가하기</p>
            {isIosDevice ? (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                하단의 <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" /> 공유 버튼을 누른 후<br />
                <strong>"홈 화면에 추가"</strong>를 선택하세요.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                앱처럼 빠르게 사용할 수 있어요.
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!isIosDevice && (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={dismiss}>
              나중에
            </Button>
            <Button size="sm" className="flex-1 gap-1.5" onClick={install}>
              <Plus className="h-4 w-4" />
              추가하기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
