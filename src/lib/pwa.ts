/** 홈 화면에 추가된 PWA·iOS 웹앱 등 브라우저 UI 없이 실행 중인지 */
export function isInStandaloneMode(): boolean {
    if (typeof window === "undefined")
        return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if ("standalone" in nav && nav.standalone) {
        return true;
    }
    if (["standalone", "fullscreen", "minimal-ui"].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)) {
        return true;
    }
    // Android TWA / 일부 런처: display-mode가 browser가 아니면 홈 화면 실행으로 간주
    if (/Android/i.test(nav.userAgent) && !window.matchMedia("(display-mode: browser)").matches) {
        return true;
    }
    if (document.referrer.startsWith("android-app://")) {
        return true;
    }
    return false;
}

/** PWA·모바일에서 intent/custom scheme 등 외부 URL 열기 (location.href 대신 anchor click) */
export function openExternalUrl(
    url: string,
    options?: { targetBlank?: boolean },
): void {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener noreferrer";
    if (options?.targetBlank) {
        anchor.target = "_blank";
    }
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}
