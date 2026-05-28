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
import {
  MAP_DIRECTION_DEBUG_EVENT,
  type MapDirectionDebugDetail,
} from "@/lib/mapDirectionDebug";
import { openNaverMapStore } from "@/lib/mapDirectionFallback";
import { openNaverMapWebFallback } from "@/lib/mapDirectionLinks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 임시 — PWA intent/nmap 디버그 팝업. 확인 후 제거 */
export default function MapDirectionDebugDialog() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [webFallbackUrl, setWebFallbackUrl] = useState("");
  const [platform, setPlatform] = useState<"ios" | "android">("android");

  const handleEvent = useCallback((event: Event) => {
    const detail = (event as CustomEvent<MapDirectionDebugDetail>).detail;
    if (!detail?.lines?.length) return;

    setLines((prev) => {
      const next = [...prev, ...detail.lines];
      return next.slice(-40);
    });
    if (detail.webFallbackUrl) setWebFallbackUrl(detail.webFallbackUrl);
    if (detail.platform) setPlatform(detail.platform);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(MAP_DIRECTION_DEBUG_EVENT, handleEvent);
    return () => {
      window.removeEventListener(MAP_DIRECTION_DEBUG_EVENT, handleEvent);
    };
  }, [handleEvent]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-h-[85vh] max-w-sm overflow-hidden rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>[DEBUG] 지도 딥링크</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <pre className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-left text-[11px] leading-relaxed text-foreground">
              {lines.length > 0 ? lines.join("\n") : "로그 없음"}
            </pre>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {webFallbackUrl ? (
            <>
              <AlertDialogAction
                className="w-full"
                onClick={() => openNaverMapStore(platform)}
              >
                네이버 지도 설치 (수동)
              </AlertDialogAction>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                onClick={() => openNaverMapWebFallback(webFallbackUrl)}
              >
                웹 지도로 보기 (수동)
              </AlertDialogAction>
            </>
          ) : null}
          <AlertDialogCancel className="w-full">닫기</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
