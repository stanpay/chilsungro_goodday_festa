import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initClarity } from "@/lib/analytics";
import { bootChatwoot, updateChatwootBubblePosition } from "@/lib/chatwoot";

bootChatwoot();
initClarity();
updateChatwootBubblePosition({ isMapView: false, mapSheetPanelHeight: 0 });
createRoot(document.getElementById("root")!).render(<App />);
document.addEventListener("dragstart", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
    event.preventDefault();
});
// 핀치 줌 차단은 지도 영역에만 적용한다.
// 문서 전체에 걸면 본문 확대가 막혀 접근성 기준(WCAG 1.4.4)에 어긋난다.
const preventGestureInsideMap = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".map-container")) {
        event.preventDefault();
    }
};
document.addEventListener("gesturestart", preventGestureInsideMap);
document.addEventListener("gesturechange", preventGestureInsideMap);
document.addEventListener("gestureend", preventGestureInsideMap);
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        });
    });
}
