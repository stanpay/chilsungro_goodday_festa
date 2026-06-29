import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import {
  getNaverMapFallbackCopy,
  NAVER_MAP_FALLBACK_EVENT,
  openNaverMapStore,
  type NaverMapFallbackDetail,
  type NaverMapFallbackPlatform,
} from "@/lib/mapDirectionFallback";
import {
  buildNaverMapWebFallbackUrl,
  openNaverMapWebFallback,
} from "@/lib/mapDirectionLinks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function resolveFallbackWebUrl(detail: NaverMapFallbackDetail): string {
  if (detail.webFallbackUrl?.startsWith("http")) {
    return detail.webFallbackUrl;
  }

  return buildNaverMapWebFallbackUrl(
    detail.targetUrl ?? "nmap://",
    detail.context,
  );
}

export default function NaverMapFallbackDialog() {
  const { locale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const [fallbackDetail, setFallbackDetail] =
    useState<NaverMapFallbackDetail | null>(null);
  const [platform, setPlatform] = useState<NaverMapFallbackPlatform>("android");

  const copy = getNaverMapFallbackCopy(locale);

  const handleEvent = useCallback((event: Event) => {
    const detail = (event as CustomEvent<NaverMapFallbackDetail>).detail;
    if (!detail?.platform) {
      return;
    }

    if (!detail.targetUrl && !detail.webFallbackUrl && !detail.context) {
      return;
    }

    setFallbackDetail(detail);
    setPlatform(detail.platform);
    setOpen(true);
  }, []);

  const handleOpenWebFallback = useCallback(() => {
    if (!fallbackDetail) return;
    openNaverMapWebFallback(resolveFallbackWebUrl(fallbackDetail));
  }, [fallbackDetail]);

  useEffect(() => {
    window.addEventListener(NAVER_MAP_FALLBACK_EVENT, handleEvent);
    return () => {
      window.removeEventListener(NAVER_MAP_FALLBACK_EVENT, handleEvent);
    };
  }, [handleEvent]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            className="w-full"
            onClick={() => openNaverMapStore(platform)}
          >
            {copy.install}
          </AlertDialogAction>
          <AlertDialogAction
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full text-foreground",
            )}
            onClick={handleOpenWebFallback}
          >
            {copy.web}
          </AlertDialogAction>
          <AlertDialogCancel
            className={cn(
              "mt-0 w-full border-primary bg-background text-foreground",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
            )}
          >
            {copy.close}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
