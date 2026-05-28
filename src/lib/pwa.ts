/** 홈 화면에 추가된 PWA·iOS 웹앱 등 브라우저 UI 없이 실행 중인지 */
export function isInStandaloneMode(): boolean {
    if (typeof window === "undefined")
        return false;
    if ("standalone" in window.navigator &&
        (window.navigator as Navigator & {
            standalone?: boolean;
        }).standalone) {
        return true;
    }
    return ["standalone", "fullscreen", "minimal-ui"].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
}
