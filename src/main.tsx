import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initClarity } from "@/lib/analytics";
initClarity();
createRoot(document.getElementById("root")!).render(<App />);
document.addEventListener("dragstart", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
    event.preventDefault();
});
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("gesturechange", (event) => event.preventDefault());
document.addEventListener("gestureend", (event) => event.preventDefault());
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        });
    });
}
