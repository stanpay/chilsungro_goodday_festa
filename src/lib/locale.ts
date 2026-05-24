export type AppLocale = "ko" | "en" | "zh" | "ja";

export const LOCALE_STORAGE_KEY = "app_locale";

export const APP_LOCALES: AppLocale[] = ["ko", "zh", "en", "ja"];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "ko" || value === "en" || value === "zh" || value === "ja";
}

export function getStoredLocale(): AppLocale {
  if (typeof localStorage === "undefined") return "ko";
  const v = localStorage.getItem(LOCALE_STORAGE_KEY);
  return isAppLocale(v) ? v : "ko";
}

export function setStoredLocale(locale: AppLocale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/** 드롭다운에 표시할 언어 이름 (각 언어의 자기 표기) */
export const LOCALE_MENU_LABELS: Record<AppLocale, string> = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  ja: "日本語",
};

type MainCopy = {
  searchPlaceholder: string;
  storesHeading: string;
  chipAll: string;
  chipChilsungro: string;
  chipLocalCurrency: string;
  chipRestaurant: string;
  chipCafe: string;
  chipOther: string;
  chipOpenNow: string;
  storeFilterToolbarAria: string;
  sortByDistance: string;
  sortByDiscount: string;
  sortDistance: string;
  sortDiscount: string;
  mapStoreCount: (n: number) => string;
  mapSheetTitle: string;
  mapSheetDragHint: string;
  mapFabChangeLocationAria: string;
  bottomNavCardView: string;
  bottomNavMapView: string;
  bottomNavListView: string;
  loadingStores: string;
  noStores: string;
  languageMenuAria: string;
};

const MAIN_COPY: Record<AppLocale, MainCopy> = {
  ko: {
    searchPlaceholder: "매장 검색...",
    storesHeading: "결제 가능 매장",
    chipAll: "전체",
    chipChilsungro: "원도심쿠폰",
    chipLocalCurrency: "지역화폐",
    chipRestaurant: "음식점",
    chipCafe: "카페",
    chipOther: "기타",
    chipOpenNow: "영업중",
    storeFilterToolbarAria: "매장 유형 필터",
    sortByDistance: "거리 순으로 정렬됩니다",
    sortByDiscount: "최대 할인율 순으로 정렬됩니다",
    sortDistance: "거리순",
    sortDiscount: "할인순",
    mapStoreCount: (n: number) => `총 ${n}개 매장이 지도에 표시됩니다.`,
    mapSheetTitle: "주변 매장",
    mapSheetDragHint: "위로 당겨 카드 보기",
    mapFabChangeLocationAria: "현재 위치로 설정",
    bottomNavCardView: "카드뷰",
    bottomNavMapView: "지도뷰",
    bottomNavListView: "리스트",
    loadingStores: "매장 정보를 불러오는 중...",
    noStores: "주변에 매장이 없습니다",
    languageMenuAria: "언어 선택",
  },
  en: {
    searchPlaceholder: "Search stores...",
    storesHeading: "Stores you can pay at",
    chipAll: "All",
    chipChilsungro: "Jeju Old Town coupon",
    chipLocalCurrency: "Local currency",
    chipRestaurant: "Restaurant",
    chipCafe: "Cafe",
    chipOther: "Other",
    chipOpenNow: "Open now",
    storeFilterToolbarAria: "Store type filters",
    sortByDistance: "Sorted by distance",
    sortByDiscount: "Sorted by max discount",
    sortDistance: "Distance",
    sortDiscount: "Discount",
    mapStoreCount: (n: number) => `${n} stores shown on the map.`,
    mapSheetTitle: "Nearby stores",
    mapSheetDragHint: "Pull up to see cards",
    mapFabChangeLocationAria: "Set to current location",
    bottomNavCardView: "Cards",
    bottomNavMapView: "Map",
    bottomNavListView: "List",
    loadingStores: "Loading stores...",
    noStores: "No stores nearby",
    languageMenuAria: "Choose language",
  },
  zh: {
    searchPlaceholder: "搜索门店...",
    storesHeading: "可付款门店",
    chipAll: "全部",
    chipChilsungro: "济州旧城区优惠券",
    chipLocalCurrency: "地区货币",
    chipRestaurant: "餐厅",
    chipCafe: "咖啡厅",
    chipOther: "其他",
    chipOpenNow: "营业中",
    storeFilterToolbarAria: "门店类型筛选",
    sortByDistance: "按距离排序",
    sortByDiscount: "按最高折扣排序",
    sortDistance: "距离",
    sortDiscount: "折扣",
    mapStoreCount: (n: number) => `地图上显示 ${n} 家门店。`,
    mapSheetTitle: "附近门店",
    mapSheetDragHint: "上拉查看卡片",
    mapFabChangeLocationAria: "使用当前位置",
    bottomNavCardView: "卡片",
    bottomNavMapView: "地图",
    bottomNavListView: "列表",
    loadingStores: "正在加载门店信息...",
    noStores: "附近没有门店",
    languageMenuAria: "选择语言",
  },
  ja: {
    searchPlaceholder: "店舗を検索...",
    storesHeading: "支払い可能な店舗",
    chipAll: "すべて",
    chipChilsungro: "済州旧市街クーポン",
    chipLocalCurrency: "地域通貨",
    chipRestaurant: "飲食店",
    chipCafe: "カフェ",
    chipOther: "その他",
    chipOpenNow: "営業中",
    storeFilterToolbarAria: "店舗タイプの絞り込み",
    sortByDistance: "距離順に並びます",
    sortByDiscount: "最大割引率順に並びます",
    sortDistance: "距離順",
    sortDiscount: "割引順",
    mapStoreCount: (n: number) => `地図に${n}件の店舗を表示しています。`,
    mapSheetTitle: "周辺の店舗",
    mapSheetDragHint: "上にスワイプしてカードを表示",
    mapFabChangeLocationAria: "現在地に設定",
    bottomNavCardView: "カード",
    bottomNavMapView: "地図",
    bottomNavListView: "リスト",
    loadingStores: "店舗情報を読み込み中...",
    noStores: "近くに店舗がありません",
    languageMenuAria: "言語を選択",
  },
};

export function mainStrings(locale: AppLocale): MainCopy {
  return MAIN_COPY[locale];
}

/** 상태 메시지는 내부적으로 한국어로 저장되며, 표시 시 현재 언어로 바꿉니다. */
const KO_LOCATION_SYSTEM = {
  initialFetching: "위치 가져오는 중...",
  checkingLocation: "위치 확인 중...",
  locationUnavailable: "위치 불러올 수 없음",
  locationUnknownGeo: "위치를 확인할 수 없음",
} as const;

type HeaderCopy = {
  initialFetching: string;
  checkingLocation: string;
  manualLocationLabel: string;
  currentLocationLabel: string;
  locationUnavailable: string;
  locationUnknownGeo: string;
  refreshLocationAria: string;
  mapCurrentLocationTitle: string;
};

const HEADER_COPY: Record<AppLocale, HeaderCopy> = {
  ko: {
    initialFetching: "위치 가져오는 중...",
    checkingLocation: "위치 확인 중...",
    manualLocationLabel: "사용자 위치",
    currentLocationLabel: "현재 위치",
    locationUnavailable: "위치 불러올 수 없음",
    locationUnknownGeo: "위치를 확인할 수 없음",
    refreshLocationAria: "위치 새로고침",
    mapCurrentLocationTitle: "현재 위치",
  },
  en: {
    initialFetching: "Getting location...",
    checkingLocation: "Checking location...",
    manualLocationLabel: "Saved location",
    currentLocationLabel: "Current location",
    locationUnavailable: "Could not load location",
    locationUnknownGeo: "Location unavailable",
    refreshLocationAria: "Refresh location",
    mapCurrentLocationTitle: "Current location",
  },
  zh: {
    initialFetching: "正在获取位置...",
    checkingLocation: "正在确认位置...",
    manualLocationLabel: "已保存位置",
    currentLocationLabel: "当前位置",
    locationUnavailable: "无法加载位置",
    locationUnknownGeo: "无法确认位置",
    refreshLocationAria: "刷新位置",
    mapCurrentLocationTitle: "当前位置",
  },
  ja: {
    initialFetching: "位置を取得中...",
    checkingLocation: "位置を確認中...",
    manualLocationLabel: "保存した位置",
    currentLocationLabel: "現在地",
    locationUnavailable: "位置を読み込めません",
    locationUnknownGeo: "位置を確認できません",
    refreshLocationAria: "位置を更新",
    mapCurrentLocationTitle: "現在地",
  },
};

export function headerStrings(locale: AppLocale): HeaderCopy {
  return HEADER_COPY[locale];
}

/** `currentLocation` 등에 저장된 한국어 시스템 문구를 현재 언어 문구로 치환합니다. */
export function resolveLocationDisplay(locale: AppLocale, stored: string): string {
  const t = HEADER_COPY[locale];
  if (stored === KO_LOCATION_SYSTEM.initialFetching) return t.initialFetching;
  if (stored === KO_LOCATION_SYSTEM.checkingLocation) return t.checkingLocation;
  if (stored === KO_LOCATION_SYSTEM.locationUnavailable) return t.locationUnavailable;
  if (stored === KO_LOCATION_SYSTEM.locationUnknownGeo) return t.locationUnknownGeo;
  return stored;
}

const KO_LOCATION_SYSTEM_VALUES = new Set<string>(Object.values(KO_LOCATION_SYSTEM));

/** 위치 API가 아닌 앱 고정 한국어 상태 문구인지 (기계번역 대상에서 제외) */
export function isStoredKoreanSystemLocation(stored: string): boolean {
  return KO_LOCATION_SYSTEM_VALUES.has(stored);
}

type StoreCardCopy = {
  maxDiscountPercent: (n: number) => string;
  localCurrencyDiscount: (n: number) => string;
  freeParking: string;
  freeParkingWithSize: (sizeLabel: string) => string;
  paidParking: string;
  paidParkingWithSize: (sizeLabel: string) => string;
  directionsButton: string;
  directionsSheetTitle: string;
  mapNaver: string;
  mapKakao: string;
  mapGoogle: string;
};

const STORE_CARD_COPY: Record<AppLocale, StoreCardCopy> = {
  ko: {
    maxDiscountPercent: (n) => `최대 ${n}% 할인`,
    localCurrencyDiscount: (n) => `지역화폐 ${n}%할인`,
    freeParking: "무료 주차 가능",
    freeParkingWithSize: (s) => `무료 주차 가능: ${s}`,
    paidParking: "주차 가능",
    paidParkingWithSize: (s) => `주차 가능: ${s}`,
    directionsButton: "길찾기",
    directionsSheetTitle: "길찾기",
    mapNaver: "네이버 지도",
    mapKakao: "카카오맵",
    mapGoogle: "구글 맵",
  },
  en: {
    maxDiscountPercent: (n) => `Up to ${n}% off`,
    localCurrencyDiscount: (n) => `Local currency ${n}% off`,
    freeParking: "Parking available (free)",
    freeParkingWithSize: (s) => `Free parking: ${s}`,
    paidParking: "Parking available",
    paidParkingWithSize: (s) => `Parking: ${s}`,
    directionsButton: "Directions",
    directionsSheetTitle: "Open in maps",
    mapNaver: "Naver Map",
    mapKakao: "KakaoMap",
    mapGoogle: "Google Maps",
  },
  zh: {
    maxDiscountPercent: (n) => `最高 ${n}% 折扣`,
    localCurrencyDiscount: (n) => `本地货币 ${n}% 优惠`,
    freeParking: "可免费停车",
    freeParkingWithSize: (s) => `免费停车：${s}`,
    paidParking: "可停车",
    paidParkingWithSize: (s) => `停车：${s}`,
    directionsButton: "路线",
    directionsSheetTitle: "在地图中打开",
    mapNaver: "Naver 地图",
    mapKakao: "Kakao 地图",
    mapGoogle: "Google 地图",
  },
  ja: {
    maxDiscountPercent: (n) => `最大${n}%オフ`,
    localCurrencyDiscount: (n) => `地域プレミアム ${n}%割引`,
    freeParking: "無料駐車可",
    freeParkingWithSize: (s) => `無料駐車可：${s}`,
    paidParking: "駐車可",
    paidParkingWithSize: (s) => `駐車：${s}`,
    directionsButton: "経路",
    directionsSheetTitle: "地図で開く",
    mapNaver: "NAVERマップ",
    mapKakao: "カカオマップ",
    mapGoogle: "Googleマップ",
  },
};

export function storeCardStrings(locale: AppLocale): StoreCardCopy {
  return STORE_CARD_COPY[locale];
}

const PARKING_SIZE: Record<string, Record<AppLocale, string>> = {
  넓음: { ko: "넓음", en: "Spacious", zh: "宽敞", ja: "広い" },
  보통: { ko: "보통", en: "Medium", zh: "一般", ja: "普通" },
  좁음: { ko: "좁음", en: "Tight", zh: "较窄", ja: "狭い" },
};

export function parkingSizeLabel(locale: AppLocale, size: string): string {
  return PARKING_SIZE[size]?.[locale] ?? size;
}

type ChatSupportCopy = {
  title: string;
  subtitle: string;
  greeting: string;
  autoReply: string;
  inputPlaceholder: string;
  sendErrorTitle: string;
  sendErrorDesc: string;
  pageNames: Record<string, string>;
};

const CHAT_SUPPORT_COPY: Record<AppLocale, ChatSupportCopy> = {
  ko: {
    title: "1:1 상담",
    subtitle: "스탠 고객지원팀",
    greeting: "안녕하세요! 스탠 고객지원팀입니다. 무엇을 도와드릴까요?",
    autoReply: "문의해주셔서 감사합니다. 담당자가 확인 후 빠른 시일 내에 답변드리겠습니다.",
    inputPlaceholder: "메시지를 입력하세요...",
    sendErrorTitle: "메시지 저장 실패",
    sendErrorDesc: "메시지 저장 중 오류가 발생했습니다.",
    pageNames: {
      "/": "메인",
      "/main": "메인",
      "/location": "위치 설정",
      "/sell": "판매하기",
      "/payment": "결제",
      "/mypage": "마이페이지",
      "/my-gifticons": "내 기프티콘",
      "/history": "결제 내역",
      "/payment-methods": "결제 수단",
    },
  },
  en: {
    title: "1:1 Support",
    subtitle: "Stan Support Team",
    greeting: "Hello! This is the Stan support team. How can we help you?",
    autoReply: "Thank you for your inquiry. Our team will review it and get back to you as soon as possible.",
    inputPlaceholder: "Type a message...",
    sendErrorTitle: "Failed to send message",
    sendErrorDesc: "An error occurred while sending your message.",
    pageNames: {
      "/": "Main",
      "/main": "Main",
      "/location": "Location",
      "/sell": "Sell",
      "/payment": "Payment",
      "/mypage": "My Page",
      "/my-gifticons": "My Gifticons",
      "/history": "History",
      "/payment-methods": "Payment Methods",
    },
  },
  zh: {
    title: "1:1 客服",
    subtitle: "斯坦客服团队",
    greeting: "您好！这里是斯坦客服团队，请问有什么可以帮您？",
    autoReply: "感谢您的咨询。我们的团队将尽快确认并回复您。",
    inputPlaceholder: "请输入消息...",
    sendErrorTitle: "消息发送失败",
    sendErrorDesc: "发送消息时发生错误。",
    pageNames: {
      "/": "主页",
      "/main": "主页",
      "/location": "位置设置",
      "/sell": "出售",
      "/payment": "付款",
      "/mypage": "我的主页",
      "/my-gifticons": "我的礼品券",
      "/history": "付款记录",
      "/payment-methods": "付款方式",
    },
  },
  ja: {
    title: "1:1 サポート",
    subtitle: "スタンサポートチーム",
    greeting: "こんにちは！スタンサポートチームです。どのようなご用件でしょうか？",
    autoReply: "お問い合わせありがとうございます。担当者が確認後、できる限り早くご回答いたします。",
    inputPlaceholder: "メッセージを入力してください...",
    sendErrorTitle: "メッセージ送信失敗",
    sendErrorDesc: "メッセージの送信中にエラーが発生しました。",
    pageNames: {
      "/": "メイン",
      "/main": "メイン",
      "/location": "位置設定",
      "/sell": "売る",
      "/payment": "決済",
      "/mypage": "マイページ",
      "/my-gifticons": "マイギフティコン",
      "/history": "決済履歴",
      "/payment-methods": "決済手段",
    },
  },
};

export function chatSupportStrings(locale: AppLocale): ChatSupportCopy {
  return CHAT_SUPPORT_COPY[locale];
}
