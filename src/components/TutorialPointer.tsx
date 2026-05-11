import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

interface TutorialPointerProps {
  targetElement: HTMLElement | null;
}

const TutorialPointer = ({ targetElement }: TutorialPointerProps) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!targetElement) return;

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
      });
    };

    updatePosition();
    
    // 리사이즈와 스크롤 시 위치 재계산
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    // 애니메이션이나 부드러운 스크롤 대응을 위해 일정 시간 동안 반복 체크
    const intervalId = setInterval(updatePosition, 100);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 2000);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [targetElement]);

  if (!targetElement || !position) return null;

  return createPortal(
    <div
      className="fixed pointer-events-none z-[10000]"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="w-12 h-12 rounded-full border-4 border-gray-300/80 bg-gray-200/40 shadow-[0_0_0_8px_rgba(209,213,219,0.25)] animate-ping" />
    </div>,
    document.body
  );
};

export default TutorialPointer;
