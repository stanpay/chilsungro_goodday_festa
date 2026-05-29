// 더미 데이터 - API 완성 전까지 사용

export const DUMMY_USER = {
  id: "user-001",
  email: "test@jejuone.com",
};

export const DUMMY_STORES = [
  {
    id: "store-001",
    name: "스타벅스 제주연동점",
    franchise_id: "franchise-001",
    kakao_place_id: "12345678",
    local_currency_available: true,
    local_currency_discount_rate: 10,
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
