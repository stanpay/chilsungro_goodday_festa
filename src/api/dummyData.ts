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

