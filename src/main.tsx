import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

// 🚀 Toss Payments SDK 사전 로딩
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;

if (clientKey) {
  console.log('⚡ Toss Payments SDK 사전 로딩 시작');
  const preloadStart = performance.now();

  loadTossPayments(clientKey)
    .then(() => {
      const preloadTime = Math.round(performance.now() - preloadStart);
      console.log(`✅ Toss Payments SDK 사전 로딩 완료 (${preloadTime}ms)`);
    })
    .catch((error) => {
      console.error('⚠️ Toss Payments SDK 사전 로딩 실패:', error);
    });
}

createRoot(document.getElementById("root")!).render(<App />);

document.addEventListener("dragstart", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
  event.preventDefault();
});

document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("gesturechange", (event) => event.preventDefault());
document.addEventListener("gestureend", (event) => event.preventDefault());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
