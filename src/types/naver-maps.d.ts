/**
 * 네이버 지도 SDK 최소 타입 선언.
 *
 * 공식 타입 패키지를 쓰지 않고 스크립트 태그로 로드하므로, 실제로 호출하는
 * 표면만 선언한다. 새로운 SDK API를 쓰기 시작하면 여기에 먼저 추가해야 한다.
 * (window as any) 대신 이 선언을 통해 접근한다.
 */

declare namespace naver.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class LatLngBounds {
    constructor(sw?: LatLng, ne?: LatLng);
    extend(latlng: LatLng): LatLngBounds;
    hasLatLng(latlng: LatLng): boolean;
    getSW(): LatLng;
    getNE(): LatLng;
  }

  interface Projection {
    fromCoordToOffset(coord: LatLng): Point;
  }

  /** 옵션 객체는 SDK 문서 기준으로 종류가 많아 느슨하게 둔다 */
  type MapOptions = Record<string, unknown>;
  type MarkerOptions = Record<string, unknown>;

  class Map {
    constructor(element: HTMLElement | string, options?: MapOptions);
    setCenter(latlng: LatLng): void;
    setZoom(zoom: number, animate?: boolean): void;
    getZoom(): number;
    setOptions(options: MapOptions | string, value?: unknown): void;
    getProjection(): Projection;
    getBounds(): LatLngBounds;
    getMaxZoom(): number;
    getSize(): { width: number; height: number };
    fitBounds(bounds: LatLngBounds, options?: unknown): void;
    morph(latlng: LatLng, zoom?: number, transition?: unknown): void;
    panBy(offset: Point): void;
  }

  interface MarkerIcon {
    /** 커스텀 HTML 마커에서 사용하는 DOM 노드 또는 HTML 문자열 */
    content?: HTMLElement | string;
    anchor?: Point;
    [key: string]: unknown;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setZIndex(zIndex: number): void;
    getPosition(): LatLng;
    getIcon(): MarkerIcon | undefined;
  }

  type MapEventListener = unknown;

  namespace Event {
    function addListener(
      target: unknown,
      type: string,
      listener: (...args: never[]) => void,
    ): MapEventListener;
    function once(
      target: unknown,
      type: string,
      listener: (...args: never[]) => void,
    ): MapEventListener;
    function removeListener(listener: MapEventListener): void;
    function trigger(target: unknown, type: string, ...args: unknown[]): void;
  }

  namespace Service {
    const Status: { OK: string; ERROR: string };

    interface GeocodeAddress {
      roadAddress?: string;
      jibunAddress?: string;
      englishAddress?: string;
      x?: string;
      y?: string;
      [key: string]: unknown;
    }

    interface GeocodeResponse {
      v2: { addresses: GeocodeAddress[]; meta?: unknown };
    }

    interface ReverseGeocodeResponse {
      v2: { address?: unknown; results?: unknown[] };
    }

    function geocode(
      options: { query: string; [key: string]: unknown },
      callback: (status: string, response: GeocodeResponse) => void,
    ): void;

    function reverseGeocode(
      options: { coords: LatLng; [key: string]: unknown },
      callback: (status: string, response: ReverseGeocodeResponse) => void,
    ): void;
  }
}

interface Window {
  naver?: typeof naver;
}
