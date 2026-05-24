// 더미 데이터 - API 완성 전까지 사용

export const DUMMY_USER = {
  id: "user-001",
  email: "test@jejuone.com",
};

const today = new Date();
const future30 = new Date(today);
future30.setDate(today.getDate() + 30);
const future60 = new Date(today);
future60.setDate(today.getDate() + 60);
const future7 = new Date(today);
future7.setDate(today.getDate() + 7);
const past5 = new Date(today);
past5.setDate(today.getDate() - 5);
const past10 = new Date(today);
past10.setDate(today.getDate() - 10);
const past15 = new Date(today);
past15.setDate(today.getDate() - 15);

export const DUMMY_GIFTICONS = [
  {
    id: "gift-001",
    user_id: "user-001",
    brand: "스타벅스",
    name: "아메리카노 Tall",
    original_price: 4500,
    image: "☕",
    expiry_date: future30.toISOString().split("T")[0],
    status: "사용가능",
    is_selling: false,
    barcode: "8801234567890",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "gift-002",
    user_id: "user-001",
    brand: "이디야",
    name: "카페라떼",
    original_price: 4000,
    image: "🥤",
    expiry_date: future60.toISOString().split("T")[0],
    status: "사용가능",
    is_selling: true,
    barcode: "8809876543210",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    sale_price: 3500,
  },
  {
    id: "gift-003",
    user_id: "user-001",
    brand: "메가커피",
    name: "아이스 아메리카노",
    original_price: 2000,
    image: "🧊",
    expiry_date: future7.toISOString().split("T")[0],
    status: "사용가능",
    is_selling: false,
    barcode: "1234567890123",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "gift-004",
    user_id: "user-001",
    brand: "투썸플레이스",
    name: "카페라떼",
    original_price: 5000,
    image: "🍰",
    expiry_date: past5.toISOString().split("T")[0],
    status: "사용완료",
    is_selling: false,
    barcode: "9876543210987",
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "gift-005",
    user_id: "user-001",
    brand: "할리스",
    name: "바닐라라떼",
    original_price: 5500,
    image: "🍪",
    expiry_date: past10.toISOString().split("T")[0],
    status: "판매완료",
    is_selling: false,
    barcode: "1122334455667",
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    sale_price: 4500,
  },
];

export const DUMMY_USED_GIFTICONS = [
  {
    id: "used-001",
    seller_id: "user-002",
    available_at: "스타벅스",
    name: "아메리카노 Grande",
    barcode: "8801122334455",
    original_price: 5000,
    sale_price: 4200,
    expiry_date: future30.toISOString().split("T")[0],
    status: "판매중",
  },
  {
    id: "used-002",
    seller_id: "user-003",
    available_at: "투썸플레이스",
    name: "아이스 카페모카",
    barcode: "8805544332211",
    original_price: 5500,
    sale_price: 4800,
    expiry_date: future60.toISOString().split("T")[0],
    status: "판매중",
  },
  {
    id: "used-003",
    seller_id: "user-004",
    available_at: "파스쿠찌",
    name: "카푸치노",
    barcode: "8807766554433",
    original_price: 4800,
    sale_price: 4000,
    expiry_date: future7.toISOString().split("T")[0],
    status: "판매중",
  },
];

export const DUMMY_PAYMENT_HISTORY = [
  {
    id: "pay-001",
    user_id: "user-001",
    store: "스타벅스 제주연동점",
    date: new Date().toISOString().split("T")[0],
    time: "10:30:00",
    amount: 4500,
    method: "기프티콘",
    status: "완료",
    created_at: new Date().toISOString(),
  },
  {
    id: "pay-002",
    user_id: "user-001",
    store: "이디야 제주시청점",
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    time: "14:20:00",
    amount: 4000,
    method: "카카오페이",
    status: "완료",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "pay-003",
    user_id: "user-001",
    store: "메가커피 노형점",
    date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
    time: "09:15:00",
    amount: 2000,
    method: "네이버페이",
    status: "완료",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export const DUMMY_USER_SETTINGS = {
  user_id: "user-001",
  kakaopay: true,
  samsungpay: false,
  naverpay: true,
  payco: false,
  tosspay: false,
  kbpay: false,
  shinhan: false,
  one_touch_payment_enabled: false,
  happy_point: false,
  cjone: false,
  hpoint: false,
  lpoint: false,
  starbucks: false,
  ediya: false,
  twosome: false,
  compose_coffee: false,
  mega_coffee: false,
  paik: false,
};

export const DUMMY_COUPONS = [
  {
    id: "coupon-001",
    name: "신규 가입 쿠폰",
    description: "3,000원 할인",
    discount_type: "fixed" as const,
    discount_value: 3000,
    min_purchase_amount: 10000,
    expiry_date: future30.toISOString().split("T")[0],
    used_at: null,
    status: "available" as const,
  },
  {
    id: "coupon-002",
    name: "첫 결제 10% 할인",
    description: "최대 5,000원 할인",
    discount_type: "percent" as const,
    discount_value: 10,
    min_purchase_amount: 5000,
    expiry_date: future60.toISOString().split("T")[0],
    used_at: null,
    status: "available" as const,
  },
  {
    id: "coupon-003",
    name: "여름 특별 쿠폰",
    description: "5,000원 할인",
    discount_type: "fixed" as const,
    discount_value: 5000,
    min_purchase_amount: 20000,
    expiry_date: past5.toISOString().split("T")[0],
    used_at: past5.toISOString(),
    status: "used" as const,
  },
];

export const DUMMY_STORES = [
  {
    id: "store-001",
    name: "스타벅스 제주연동점",
    franchise_id: "franchise-001",
    kakao_place_id: "12345678",
    local_currency_available: true,
    local_currency_discount_rate: 10,
    gifticon_available: true,
    parking_available: true,
    free_parking: false,
    parking_size: "소형",
  },
  {
    id: "store-002",
    name: "이디야 제주시청점",
    franchise_id: "franchise-002",
    kakao_place_id: "23456789",
    local_currency_available: true,
    local_currency_discount_rate: 5,
    gifticon_available: true,
    parking_available: false,
    free_parking: false,
    parking_size: null,
  },
];

export const DUMMY_FRANCHISES: Record<string, { id: string; name: string }> = {
  스타벅스: { id: "franchise-001", name: "스타벅스" },
  이디야: { id: "franchise-002", name: "이디야" },
  메가커피: { id: "franchise-003", name: "메가커피" },
  투썸플레이스: { id: "franchise-004", name: "투썸플레이스" },
  파스쿠찌: { id: "franchise-005", name: "파스쿠찌" },
};

export const DUMMY_FRANCHISE_PAYMENT_METHODS = [
  {
    franchise_id: "franchise-001",
    method_name: "카카오페이",
    method_type: "간편결제",
    rate: 0,
  },
  {
    franchise_id: "franchise-001",
    method_name: "네이버페이",
    method_type: "간편결제",
    rate: 0,
  },
  {
    franchise_id: "franchise-001",
    method_name: "삼성페이",
    method_type: "간편결제",
    rate: 0,
  },
];

export const DUMMY_RECOGNITION_JOBS: Record<string, any> = {};
