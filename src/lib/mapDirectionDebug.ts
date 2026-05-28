/** 임시 디버그 — PWA 딥링크 동작 확인용. 확인 후 제거 */
export const MAP_DIRECTION_DEBUG_EVENT = "naver-map:debug";

export type MapDirectionDebugDetail = {
  lines: string[];
  webFallbackUrl?: string;
  platform?: "ios" | "android";
};

export function emitMapDirectionDebug(
  lines: string[],
  extra?: Pick<MapDirectionDebugDetail, "webFallbackUrl" | "platform">,
): void {
  window.dispatchEvent(
    new CustomEvent<MapDirectionDebugDetail>(MAP_DIRECTION_DEBUG_EVENT, {
      detail: { lines, ...extra },
    }),
  );
}

export function appendMapDirectionDebug(line: string): void {
  emitMapDirectionDebug([line]);
}
