import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TutorialGuideProps {
  targetElement: HTMLElement | null;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
  onNext?: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  allowDirectClick?: boolean; // 강조된 요소 직접 클릭 허용 여부
  allowAnywhereClick?: boolean; // 화면 어디든 클릭해도 다음으로 진행 여부
}

const TutorialGuide = ({
  targetElement,
  message,
  position = "bottom",
  onNext,
  onSkip,
  showSkip = true,
  allowDirectClick = true,
  allowAnywhereClick = false,
}: TutorialGuideProps) => {
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!targetElement) return;

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);
      
      const guideRect = guideRef.current?.getBoundingClientRect();
      if (!guideRect) return;

      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = rect.top + scrollY - guideRect.height - 20;
          left = rect.left + scrollX + rect.width / 2 - guideRect.width / 2;
          break;
        case "bottom":
          top = rect.bottom + scrollY + 20;
          left = rect.left + scrollX + rect.width / 2 - guideRect.width / 2;
          break;
        case "left":
          top = rect.top + scrollY + rect.height / 2 - guideRect.height / 2;
          left = rect.left + scrollX - guideRect.width - 20;
          break;
        case "right":
          top = rect.top + scrollY + rect.height / 2 - guideRect.height / 2;
          left = rect.right + scrollX + 20;
          break;
      }

      // 화면 경계 체크
      const padding = 16;
      if (left < padding) left = padding;
      if (left + guideRect.width > window.innerWidth - padding) {
        left = window.innerWidth - guideRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + guideRect.height > window.innerHeight + scrollY - padding) {
        top = window.innerHeight + scrollY - guideRect.height - padding;
      }

      setPositionStyle({
        position: "absolute",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
      });
    };

    // 초기 위치 계산 및 지연 실행 (컴포넌트 렌더링 후 guideRef 확보용)
    updatePosition();
    const timer = setTimeout(updatePosition, 50);
    
    // 애니메이션이나 레이아웃 변화에 대응하기 위해 일정 시간 동안 반복 업데이트
    const interval = setInterval(updatePosition, 100);
    setTimeout(() => clearInterval(interval), 2000);

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [targetElement, position]);

  if (!targetElement) return null;

  // 타겟 요소 클릭 핸들러 - 직접 클릭 허용
  useEffect(() => {
    if (!targetElement || !allowDirectClick || !onNext) return;

    const handleTargetClick = (e: MouseEvent | TouchEvent) => {
      // 타겟 요소나 그 자식 요소를 클릭한 경우에만 처리
      const target = e.target as HTMLElement;
      if (targetElement.contains(target) || targetElement === target) {
        // 원래 클릭 이벤트가 먼저 발생하도록 preventDefault를 호출하지 않음
        // 이벤트 전파를 막지 않아서 원래 클릭 핸들러가 실행되도록 함
        // 약간의 지연 후 가이드를 닫아서 원래 클릭 이벤트가 먼저 처리되도록 함
        setTimeout(() => {
          onNext();
        }, 0);
      }
    };

    // 타겟 요소에 클릭 이벤트 리스너 추가 (버블링 단계에서 - 원래 클릭 이벤트가 먼저 실행되도록)
    targetElement.addEventListener('click', handleTargetClick, false);
    targetElement.addEventListener('touchend', handleTargetClick, false);
    
    // 타겟 요소의 z-index를 높여서 클릭 가능하게
    const computedStyle = window.getComputedStyle(targetElement);
    const originalZIndex = targetElement.style.zIndex;
    const originalPosition = targetElement.style.position;
    const currentPosition = computedStyle.position;
    
    targetElement.style.zIndex = '9999';
    if (currentPosition === 'static') {
      targetElement.style.position = 'relative';
    }
    
    return () => {
      targetElement.removeEventListener('click', handleTargetClick, false);
      targetElement.removeEventListener('touchend', handleTargetClick, false);
      targetElement.style.zIndex = originalZIndex;
      if (!originalPosition || originalPosition === 'static') {
        targetElement.style.position = originalPosition || '';
      }
    };
  }, [targetElement, allowDirectClick, onNext]);

  const overlayPieces = targetRect
    ? [
        // 상단
        {
          top: 0,
          left: 0,
          width: "100%",
          height: targetRect.top,
        },
        // 좌측
        {
          top: targetRect.top,
          left: 0,
          width: targetRect.left,
          height: targetRect.height,
        },
        // 우측
        {
          top: targetRect.top,
          left: targetRect.right,
          width: `calc(100% - ${targetRect.right}px)`,
          height: targetRect.height,
        },
        // 하단
        {
          top: targetRect.bottom,
          left: 0,
          width: "100%",
          height: `calc(100% - ${targetRect.bottom}px)`,
        },
      ]
    : null;

  // 화면 어디든 클릭 시 다음으로 진행
  useEffect(() => {
    if (!allowAnywhereClick || !onNext) return;

    const handleAnywhereClick = () => {
      onNext();
    };

    // 지연 추가 (가이드가 뜨자마자 이전 클릭 이벤트로 인해 닫히는 현상 방지)
    const timer = setTimeout(() => {
      document.addEventListener("click", handleAnywhereClick);
      document.addEventListener("touchend", handleAnywhereClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleAnywhereClick);
      document.removeEventListener("touchend", handleAnywhereClick);
    };
  }, [allowAnywhereClick, onNext]);

  return createPortal(
    <>
      {/* 오버레이 배경 - 클릭 차단 (타겟 영역은 비움) */}
      {overlayPieces
        ? overlayPieces.map((piece, idx) => (
            <div
              key={idx}
              className="fixed bg-black/60 z-[9998]"
              style={{
                pointerEvents: "auto",
                top: piece.top,
                left: piece.left,
                width: piece.width,
                height: piece.height,
              }}
            />
          ))
        : (
          <div
            className="fixed inset-0 bg-black/60 z-[9998]"
            style={{ pointerEvents: "auto" }}
          />
        )}
      
      {/* 타겟 요소 강조 */}
      {targetRect && (
        <div
          className="fixed z-[9999] border-4 border-primary rounded-lg pointer-events-none"
          style={{
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            animation: "pulse 2s cubic-bezier(0.4, 0, 0, 1) infinite",
          }}
        />
      )}

      {/* 가이드 메시지 */}
      <div
        ref={guideRef}
        className={cn(
          "bg-background border-2 border-primary rounded-lg shadow-2xl p-4 min-w-[300px] max-w-[360px]",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          "fixed"
        )}
        style={{ ...positionStyle, pointerEvents: "none" }}
      >
        <div className="flex items-start gap-3 pointer-events-none">
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default TutorialGuide;
