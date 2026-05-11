# 💳 Toss Payments 결제 플로우 정리

## 🎯 현재 구현 상태

### 결제 시스템
- **현재 모드**: 결제위젯 (Widget)
- **확장 가능**: 브랜드페이로 쉽게 전환 가능
- **설정 파일**: `src/lib/paymentConfig.ts`

---

## 📱 결제 플로우

### 1단계: 기프티콘 선택 (Step 1)
```
/payment/:storeId
```

**화면 구성**:
- 매장별 기프티콘 목록 표시
- 할인율 정보 표시
- 기프티콘 선택 (체크박스)
- 총 구매 포인트, 할인 금액 계산
- **확인 버튼** → Toss Payments 결제창 호출

**주요 함수**: `handleConfirmStep1()`

### 2단계: Toss Payments 결제
```javascript
// 결제위젯 초기화
const widgets = await initPaymentWidget(customerKey);

// 결제 금액 설정
await widgets.setAmount({
  currency: "KRW",
  value: totalCost,
});

// 결제 요청
await widgets.requestPayment({
  orderId: generateOrderId(),
  orderName: "매장명 기프티콘 N개",
  successUrl: "/payment-success?storeId=...",
  failUrl: "/payment-fail",
  // ...
});
```

**성공 시**: `/payment-success?paymentKey=...&orderId=...&amount=...&storeId=...`
**실패 시**: `/payment-fail?code=...&message=...`

### 3단계: 결제 승인 (PaymentSuccess 페이지)
```
/payment-success
```

**처리 순서**:
1. URL에서 결제 정보 추출 (`paymentKey`, `orderId`, `amount`, `storeId`)
2. Supabase Edge Function 호출 → Toss Payments 결제 승인 API
3. 결제 내역 DB 저장 (`payment_history` 테이블)
4. sessionStorage에 성공 플래그 저장
5. **바코드 페이지로 자동 리다이렉트**: `/payment/:storeId?step=2`

**Edge Function**: `supabase/functions/confirm-payment/index.ts`

### 4단계: 바코드 표시 (Step 2)
```
/payment/:storeId?step=2
```

**화면 구성**:
- 구매한 기프티콘 바코드 표시 (카드 스와이프)
- 멤버십 바코드 표시
- 매장에 제시하여 사용

**완료 버튼**: `handlePaymentComplete()` → 메인 페이지로 이동

---

## 🗂️ 파일 구조

### 핵심 파일
```
src/
├── lib/
│   ├── paymentConfig.ts        # 결제 모드 설정 (widget/brandpay)
│   └── tossPayments.ts         # Toss Payments SDK 초기화
├── pages/
│   ├── Payment.tsx             # 메인 결제 페이지 (Step 1, 2)
│   ├── PaymentSuccess.tsx      # 결제 승인 & 리다이렉트
│   ├── PaymentFail.tsx         # 결제 실패 페이지
│   └── CallbackAuth.tsx        # 브랜드페이 인증 콜백 (나중에 사용)

supabase/
└── functions/
    └── confirm-payment/
        └── index.ts            # 결제 승인 Edge Function

scripts/
└── create-payment-history-table.sql  # DB 스키마
```

---

## 🔧 주요 함수

### Payment.tsx

#### `handleConfirmStep1()`
- 결제 요청 전 검증
- customerKey, orderId 생성
- 주문 정보 sessionStorage 저장
- Toss Payments 결제창 호출

#### `handlePaymentComplete()`
- sessionStorage 정리
- 상태 초기화
- 메인 페이지로 이동

### PaymentSuccess.tsx

#### `confirmPaymentAndRedirect()`
- 결제 승인 API 호출
- 결제 내역 DB 저장
- 바코드 페이지로 자동 리다이렉트

---

## 💾 데이터 흐름

### sessionStorage
```javascript
// 결제 요청 시 저장
{
  "toss_payment_order": {
    orderId: "order_1234567890_abc",
    amount: 50000,
    orderName: "스타벅스 기프티콘 2개",
    storeId: "20089944",
    storeName: "스타벅스 강남점",
    storeBrand: "스타벅스",
    gifticons: [...],
    selectedGifticonIds: [...],
    timestamp: "2024-..."
  },
  "toss_payment_return_url": "/payment/20089944",
  "payment_success": "true",  // 결제 성공 후 설정
  "payment_result": {...}     // Toss Payments 응답
}
```

### Database (payment_history)
```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  order_id TEXT UNIQUE,
  payment_key TEXT,
  amount INTEGER,
  status TEXT,  -- 'pending', 'completed', 'failed'
  payment_method TEXT,
  payment_data JSONB,  -- Toss Payments 전체 응답
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🎨 UI 플로우

```
┌─────────────────┐
│   Step 1        │  기프티콘 선택
│   /payment/:id  │
└────────┬────────┘
         │ 확인 버튼 클릭
         ↓
┌─────────────────┐
│ Toss Payments   │  결제창 (외부 팝업/리다이렉트)
│   결제창         │
└────────┬────────┘
         │ 결제 성공
         ↓
┌─────────────────┐
│ PaymentSuccess  │  결제 승인 처리
│ /payment-success│  (자동, 사용자 대기)
└────────┬────────┘
         │ 자동 리다이렉트
         ↓
┌─────────────────┐
│   Step 2        │  바코드 표시
│   /payment/:id  │  (매장에 제시)
│   ?step=2       │
└────────┬────────┘
         │ 결제 완료 버튼
         ↓
┌─────────────────┐
│   Main Page     │  메인으로 돌아가기
│   /main         │
└─────────────────┘
```

---

## ⚙️ 환경 설정

### .env.local
```env
# 결제위젯 연동 키 (현재)
VITE_TOSS_CLIENT_KEY=test_gck_XXXXXXXXXXXXXXXXXXXX
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX

# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Site URL
VITE_SITE_URL=http://localhost:8080
```

### Supabase Edge Function 환경 변수
```bash
supabase secrets set VITE_TOSS_CLIENT_KEY=test_gck_XXX
supabase secrets set VITE_TOSS_SECRET_KEY=test_sk_XXX
```

---

## 🔄 브랜드페이로 전환

`src/lib/paymentConfig.ts` 수정:

```typescript
export const PAYMENT_CONFIG = {
  // ❌ 현재 (결제위젯)
  mode: 'widget' as PaymentMode,
  
  // ✅ 브랜드페이로 전환
  mode: 'brandpay' as PaymentMode,
  
  // ...
};
```

**주의**: 브랜드페이는 Toss Payments 계약 필요

---

## 🧪 테스트 시나리오

### 1. 정상 결제
1. `/payment/20089944` 접속
2. 기프티콘 선택
3. 확인 버튼 클릭
4. 결제창에서 테스트 카드 입력 (`9430-1234-5678-9019`)
5. 결제 완료 → 자동으로 바코드 페이지 이동
6. 바코드 확인

### 2. 결제 취소
1. 결제창에서 취소 버튼
2. `/payment-fail` 페이지로 이동
3. "다시 시도" 또는 "메인으로"

### 3. 결제 실패
1. 잘못된 카드 정보 입력
2. 실패 메시지 확인
3. `/payment-fail` 페이지

---

## 📊 결제 내역 확인

### Supabase 대시보드
```sql
SELECT * FROM payment_history 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC;
```

### Toss Payments 개발자센터
1. 로그인
2. **결제내역** 메뉴
3. 테스트 결제 확인

---

## 🚀 다음 단계

1. ✅ 결제위젯 구현 완료
2. ⏳ Toss Payments 계약
3. ⏳ 브랜드페이로 전환 (원클릭 결제)
4. ⏳ 원터치결제 활성화
5. ⏳ 결제수단 관리 기능 추가

---

## 📞 문의

- **Toss Payments**: 1544-7772, support@tosspayments.com
- **개발자센터**: https://developers.tosspayments.com

