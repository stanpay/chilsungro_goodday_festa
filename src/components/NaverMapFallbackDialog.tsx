import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import {
  getNaverMapFallbackCopy,
  NAVER_MAP_FALLBACK_EVENT,
  openNaverMapStore,
  resumeNaverMapFallbackFromNavigation,
  type NaverMapFallbackDetail,
  type NaverMapFallbackPlatform,
} from "@/lib/mapDirectionFallback";
import { openNaverMapWebFallback } from "@/lib/mapDirectionLinks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NaverMapFallbackDialog() {
  const { locale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const [webFallbackUrl, setWebFallbackUrl] = useState("");
  const [platform, setPlatform] = useState<NaverMapFallbackPlatform>("android");

  const copy = getNaverMapFallbackCopy(locale);

  const handleEvent = useCallback((event: Event) => {
    const detail = (event as CustomEvent<NaverMapFallbackDetail>).detail;
    if (!detail?.webFallbackUrl || !detail.platform) {
      return;
    }
    setWebFallbackUrl(detail.webFallbackUrl);
    setPlatform(detail.platform);
    setOpen(true);
  }, []);

  useEffect(() => {
    resumeNaverMapFallbackFromNavigation();
  }, []);

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
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            className="w-full"
            onClick={() => openNaverMapStore(platform)}
          >
            {copy.install}
          </AlertDialogAction>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            onClick={() => openNaverMapWebFallback(webFallbackUrl)}
          >
            {copy.web}
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">{copy.close}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
