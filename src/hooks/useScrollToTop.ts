import { useCallback, useEffect, useState } from "react";

/** 이 높이를 넘겨 스크롤하면 최상단 이동 버튼을 띄운다 */
const SCROLL_TO_TOP_THRESHOLD_PX = 300;

/**
 * 최상단 이동 버튼의 노출 여부와 스크롤 동작.
 *
 * Main.tsx 분해 5단계. 상태·리스너·핸들러가 한 덩어리라 그대로 묶었다.
 * enabled가 false면 리스너를 붙이지 않고 버튼도 숨긴다(지도뷰에서는 불필요).
 */
export function useScrollToTop({ enabled }: { enabled: boolean }) {
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShowScrollToTop(false);
      return;
    }

    const onScroll = () => {
      setShowScrollToTop(window.scrollY > SCROLL_TO_TOP_THRESHOLD_PX);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { showScrollToTop, scrollToTop };
}
