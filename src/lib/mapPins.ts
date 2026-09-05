/**
 * 지도 핀 라벨 측정과 마커 클러스터링 유틸.
 *
 * Main.tsx가 4,000줄 규모라 순수 계산 로직을 분리했다. 여기 있는 함수는
 * React 상태에 의존하지 않고 좌표·DOM 측정값만 다룬다.
 */
import { MAP_VIEW_SHEET_BOTTOM_NAV_PX } from "@/components/MapViewBottomSheet";
import { distanceMeters } from "@/lib/geoDistance";

export const MAP_SPIDERFY_MAX_RADIUS_PX = 96;
const MAP_VIEW_PADDING = { top: 100, right: 48, bottom: 220, left: 48 };
/** 선택 매장 핀 — UI 경계(재검색 버튼·시트 핸들)와의 여백 */
const MAP_PIN_FOCUS_BAND_GAP_PX = 8;
/** 0=밴드 상단, 1=밴드 하단 — 핀 시각 중심 목표 (시트 쪽으로 치우침) */
const MAP_PIN_FOCUS_BAND_POSITION = 0.72;
const PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX = 16;

type MapPinFocusBand = {
  top: number;
  bottom: number;
  targetY: number;
};

function measureMapPinFocusBand(
  mapEl: HTMLElement | null,
  researchButtonEl: HTMLElement | null,
  sheetHeightPx: number
): MapPinFocusBand {
  const mapRect = mapEl?.getBoundingClientRect();
  const viewportH = window.visualViewport?.height ?? window.innerHeight;

  if (!mapRect?.height) {
    const mapHeight = mapEl?.clientHeight ?? 600;
    const fallbackBottom =
      mapHeight -
      (MAP_VIEW_SHEET_BOTTOM_NAV_PX + sheetHeightPx + MAP_PIN_FOCUS_BAND_GAP_PX);
    const fallbackTop = MAP_VIEW_PADDING.top;
    const fallbackBandBottom = Math.max(fallbackTop, fallbackBottom);
    return {
      top: fallbackTop,
      bottom: fallbackBandBottom,
      targetY:
        fallbackTop +
        (fallbackBandBottom - fallbackTop) * MAP_PIN_FOCUS_BAND_POSITION,
    };
  }

  const mapTop = mapRect.top;
  const mapHeight = mapRect.height;

  let bandTop = MAP_VIEW_PADDING.top;
  if (researchButtonEl) {
    const boundaryRect = researchButtonEl.getBoundingClientRect();
    bandTop = Math.max(
      bandTop,
      boundaryRect.bottom - mapTop + MAP_PIN_FOCUS_BAND_GAP_PX
    );
  }

  const sheetTopInViewport =
    viewportH - MAP_VIEW_SHEET_BOTTOM_NAV_PX - sheetHeightPx;
  const bandBottom = Math.min(
    mapHeight - MAP_PIN_FOCUS_BAND_GAP_PX,
    sheetTopInViewport - mapTop - MAP_PIN_FOCUS_BAND_GAP_PX
  );

  const clampedBottom = Math.max(bandTop + 20, bandBottom);
  const targetY =
    bandTop + (clampedBottom - bandTop) * MAP_PIN_FOCUS_BAND_POSITION;

  return {
    top: bandTop,
    bottom: clampedBottom,
    targetY: Math.max(bandTop, Math.min(clampedBottom, targetY)),
  };
}

function panMapPinToTargetY(
  map: { getSize?: () => { height: number }; panBy: (offset: unknown) => void },
  naver: { maps: { Point: new (x: number, y: number) => unknown } },
  targetVisualCenterY: number,
  anchorOffsetBelowVisualCenterPx = PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX
) {
  const mapSize = map.getSize?.();
  if (!mapSize) return;
  const anchorTargetY = targetVisualCenterY + anchorOffsetBelowVisualCenterPx;
  const deltaY = mapSize.height / 2 - anchorTargetY;
  if (Math.abs(deltaY) > 0.5) {
    map.panBy(new naver.maps.Point(0, deltaY));
  }
}
const PIN_LABEL_GAP_PX = 4;
const PIN_TAIL_HEIGHT_PX = 8;
const PIN_BALLOON_PADDING_X = 16;
const PIN_BALLOON_PADDING_Y = 8;
export const PIN_LABEL_FONT_SIZE_PX = 11;
const PIN_LABEL_FONT = `700 ${PIN_LABEL_FONT_SIZE_PX}px system-ui, -apple-system, sans-serif`;
export const PIN_LABEL_LINE_HEIGHT = 1.35;
export const PIN_CLUSTER_SIZE_PX = 30;
export const PIN_CLUSTER_FONT_SIZE_PX = 11;
export const PIN_CLUSTER_BORDER_PX = 2;

export type PinLabelRect = { left: number; top: number; right: number; bottom: number };

let pinLabelMeasureCtx: CanvasRenderingContext2D | null = null;

function measurePinLabelTextWidth(text: string): number {
  if (!pinLabelMeasureCtx) {
    const canvas = document.createElement("canvas");
    pinLabelMeasureCtx = canvas.getContext("2d")!;
    pinLabelMeasureCtx.font = PIN_LABEL_FONT;
  }
  return Math.ceil(pinLabelMeasureCtx.measureText(text).width);
}

export function getPinLabelText(markerContent: HTMLElement | null): string {
  return markerContent?.querySelector("[data-store-label]")?.textContent ?? "";
}

export function measurePinLabelRect(
  anchorX: number,
  anchorY: number,
  labelText: string,
  spiderfyOffset = { x: 0, y: 0 }
): PinLabelRect {
  const width = Math.max(measurePinLabelTextWidth(labelText) + PIN_BALLOON_PADDING_X, 22);
  const height = Math.ceil(PIN_LABEL_FONT_SIZE_PX * PIN_LABEL_LINE_HEIGHT) + PIN_BALLOON_PADDING_Y;
  const x = anchorX + spiderfyOffset.x;
  const y = anchorY + spiderfyOffset.y;
  return {
    left: x - width / 2,
    top: y - PIN_TAIL_HEIGHT_PX - height,
    right: x + width / 2,
    bottom: y,
  };
}

function computePinAnchorOffsetBelowVisualCenter(
  marker: naver.maps.Marker,
  proj: naver.maps.Projection,
  spiderfyOffset = { x: 0, y: 0 }
): number {
  try {
    const pos = marker.getPosition();
    const pt = proj.fromCoordToOffset(pos);
    const icon = marker?.getIcon?.();
    const root = (icon?.content as HTMLElement) ?? null;
    const text = getPinLabelText(root);
    const bounds = measurePinLabelRect(pt.x, pt.y, text, spiderfyOffset);
    return (bounds.bottom - bounds.top) / 2;
  } catch {
    return PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX;
  }
}

function labelRectsOverlap(a: PinLabelRect, b: PinLabelRect, gap = PIN_LABEL_GAP_PX): boolean {
  return !(
    a.right + gap < b.left ||
    a.left - gap > b.right ||
    a.bottom + gap < b.top ||
    a.top - gap > b.bottom
  );
}

function labelRectsOverlapForCluster(a: PinLabelRect, b: PinLabelRect, zoom: number): boolean {
  if (!labelRectsOverlap(a, b, 0)) return false;
  const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  // minW/minH = "이만큼 이상 겹쳐야 같은 클러스터" → 값이 클수록 묶임이 어려워져 클러스터 개수↑
  // v5 타일 기준: 줌 16≈100m, 줌 15≈300m 확대비율. 줌 15도 일반 구간과 동일 기준으로 묶는다.
  const minW = zoom >= 16 ? 18 : 12;
  const minH = zoom >= 16 ? 12 : 8;
  return overlapW >= minW && overlapH >= minH;
}

function getMaxClusterDistanceM(zoom: number): number {
  // v5 타일 확대비율: 줌 16≈100m, 줌 15≈300m, 줌 13~14≈500m~1km.
  // 줌이 커질수록(확대) 화면상 같은 픽셀이 더 작은 실거리를 덮으므로 묶는 최대 거리도 단조 감소.
  if (zoom >= 18) return 20;
  if (zoom >= 16) return 40;
  if (zoom >= 15) return 100; // 300m 확대비율 구간
  if (zoom >= 13) return 160;
  return 280;
}

export type ClusterPinItem = {
  id: string;
  marker: naver.maps.Marker;
  bounds: PinLabelRect;
  pos: { lat: () => number; lng: () => number };
};

export function groupPinsForClustering(items: ClusterPinItem[], zoom: number): ClusterPinItem[][] {
  const n = items.length;
  if (n === 0) return [];
  const maxDistM = getMaxClusterDistanceM(zoom);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!labelRectsOverlapForCluster(items[i].bounds, items[j].bounds, zoom)) continue;
      const distM = distanceMeters(
        items[i].pos.lat(),
        items[i].pos.lng(),
        items[j].pos.lat(),
        items[j].pos.lng()
      );
      if (distM <= maxDistM) union(i, j);
    }
  }

  const groups = new Map<number, ClusterPinItem[]>();
  items.forEach((item, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(item);
  });
  return [...groups.values()];
}

export function pinLabelRectsOverlap(rects: PinLabelRect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (labelRectsOverlap(rects[i], rects[j])) return true;
    }
  }
  return false;
}

export function panMapPinAboveSheet(
  map: {
    getSize?: () => { height: number };
    panBy: (offset: unknown) => void;
    getProjection?: () => naver.maps.Projection;
  },
  naver: { maps: { Point: new (x: number, y: number) => unknown } },
  mapEl: HTMLElement | null,
  researchButtonEl: HTMLElement | null,
  sheetHeightPx: number,
  selectedMarker?: naver.maps.Marker
) {
  const band = measureMapPinFocusBand(
    mapEl,
    researchButtonEl,
    sheetHeightPx
  );
  let anchorOffset = PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX;
  const proj = map.getProjection?.();
  if (proj && selectedMarker) {
    anchorOffset = computePinAnchorOffsetBelowVisualCenter(selectedMarker, proj);
  }
  panMapPinToTargetY(map, naver, band.targetY, anchorOffset);
}

export function buildMyLocationPinElement(title: string): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;";
  root.title = title;
  const dot = document.createElement("div");
  dot.style.cssText =
    "position:absolute;width:13px;height:13px;transform:translate(-50%,-50%);border-radius:9999px;background:#22c55e;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);";
  root.appendChild(dot);
  return root;
}
