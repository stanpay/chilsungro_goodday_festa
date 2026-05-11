# 💳 결제 시스템 마이그레이션 가이드
## 결제위젯 → 브랜드페이 전환 가이드

현재 시스템은 **결제위젯**으로 구현되어 있으며, 나중에 **브랜드페이**로 쉽게 전환할 수 있도록 설계되었습니다.

---

## 📊 현재 상태: 결제위젯 사용

### 특징
- ✅ **계약 전에도 테스트 가능**
- ✅ 신용카드, 가상계좌, 계좌이체, 간편결제 등 모든 결제수단 지원
- ✅ 토스페이먼츠가 제공하는 UI 사용
- ⚠️ 매 결제마다 결제수단 입력 필요 (원클릭 결제 불가)

### 현재 환경 변수

```env
# .env.local
VITE_TOSS_CLIENT_KEY=test_gck_XXXXXXXXXXXXXXXXXXXX  # 결제위젯 연동 키
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SITE_URL=http://localhost:8080
```

### 결제 플로우
1. 매장 페이지에서 기프티콘 선택
2. **확인 버튼 클릭** → Toss Payments 결제창 열림
3. 결제수단 선택 (카드, 계좌이체, 간편결제 등)
4. 결제 정보 입력
5. 결제 완료

---

## 🚀 브랜드페이로 전환하기

브랜드페이는 **내 상점의 자체 간편결제**를 만들 수 있는 서비스입니다.

### 브랜드페이의 장점
- ✅ **원클릭 결제**: 한 번 등록하면 다음부터는 클릭 한 번으로 결제
- ✅ **원터치결제**: 안전한 거래는 비밀번호 입력 없이 결제
- ✅ **높은 전환율**: 간편한 결제로 이탈률 감소
- ⚠️ **계약 필요**: Toss Payments와 브랜드페이 계약 필요

### Step 1: Toss Payments 계약

1. Toss Payments 고객센터 문의
   - 전화: **1544-7772**
   - 이메일: **support@tosspayments.com**
2. **브랜드페이 서비스** 계약 진행
3. 계약 완료 후 **API 개별 연동 키** 발급

### Step 2: API 키 변경

브랜드페이는 **API 개별 연동 키**가 필요합니다:

```env
# .env.local 수정
# ❌ 기존 (결제위젯 연동 키)
# VITE_TOSS_CLIENT_KEY=test_gck_XXXXXXXXXXXXXXXXXXXX

# ✅ 변경 (API 개별 연동 키)
VITE_TOSS_CLIENT_KEY=test_ck_XXXXXXXXXXXXXXXXXXXX  # test_ck_로 시작
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX
```

### Step 3: 개발자센터 설정

1. [Toss Payments 개발자센터](https://developers.tosspayments.com) 로그인
2. **상점관리자** > **브랜드페이** 메뉴
3. **리다이렉트 URL** 추가:
   - 개발: `http://localhost:8080/callback-auth`
   - 배포: `https://your-domain.com/callback-auth`

### Step 4: 결제 모드 전환

`src/lib/paymentConfig.ts` 파일을 수정:

```typescript
export const PAYMENT_CONFIG = {
  // ❌ 기존 (결제위젯)
  // mode: 'widget' as PaymentMode,
  
  // ✅ 변경 (브랜드페이)
  mode: 'brandpay' as PaymentMode,
  
  // ...
};
```

### Step 5: 개발 서버 재시작

```bash
# Ctrl+C로 서버 중지 후
npm run dev
```

### Step 6: 테스트

1. 매장 페이지에서 기프티콘 선택
2. **확인 버튼 클릭** → Toss Payments 결제창 (첫 결제 시 결제수단 등록)
3. 결제수단 등록 완료 → `callback-auth` 페이지로 리다이렉트
4. **두 번째 결제부터**: 확인 버튼 클릭 → 바로 결제 (원클릭!)

---

## 🔄 결제위젯에서 브랜드페이도 함께 사용하기

결제위젯에서도 브랜드페이 기능을 활성화할 수 있습니다!

### 결제위젯 + 브랜드페이 동시 사용

`src/lib/paymentConfig.ts` 파일을 수정:

```typescript
export const PAYMENT_CONFIG = {
  mode: 'widget' as PaymentMode, // 결제위젯 유지
  
  widget: {
    enableBrandpay: true, // ✅ 브랜드페이 활성화
  },
  
  // ...
};
```

이렇게 하면:
- 일반 결제수단 (카드, 계좌이체 등) + 브랜드페이 모두 사용 가능
- 사용자가 선택 가능 (일반 결제 or 브랜드페이)

**주의**: 이 경우에도 브랜드페이 계약이 필요합니다!

---

## 📋 환경별 권장 설정

### 개발 초기 (계약 전)
```typescript
mode: 'widget'
widget.enableBrandpay: false
```
→ 결제위젯만 사용, 테스트 자유롭게 가능

### 서비스 런칭 준비
```typescript
mode: 'widget'
widget.enableBrandpay: true
```
→ 결제위젯 + 브랜드페이, 사용자 선택 가능

### 서비스 성숙기
```typescript
mode: 'brandpay'
```
→ 브랜드페이만 사용, 원클릭 결제로 전환율 극대화

---

## 🔍 코드 구조

### 결제 모드 자동 감지
코드는 환경 변수에서 키 타입을 자동으로 감지합니다:

```typescript
// src/lib/paymentConfig.ts
export function getPaymentMode(): PaymentMode {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
  
  if (clientKey?.startsWith('test_gck_')) {
    return 'widget';  // 결제위젯 키 감지
  } else if (clientKey?.startsWith('test_ck_')) {
    return PAYMENT_CONFIG.mode;  // API 개별 키 → 설정에 따라
  }
  
  return 'widget';  // 기본값
}
```

### 결제 요청 처리
```typescript
// src/pages/Payment.tsx - handleConfirmStep1()
const paymentMode = getPaymentMode();

if (paymentMode === 'brandpay') {
  // 브랜드페이 로직
  const brandpay = await initBrandPay(customerKey);
  await brandpay.requestPayment({ ... });
} else {
  // 결제위젯 로직
  const widgets = await initPaymentWidget(customerKey);
  await widgets.requestPayment({ ... });
}
```

---

## 📊 비교표

| 항목 | 결제위젯 | 브랜드페이 |
|------|----------|------------|
| **계약 필요** | ❌ 테스트 가능 | ✅ 필수 |
| **원클릭 결제** | ❌ 불가 | ✅ 가능 |
| **원터치결제** | ❌ 불가 | ✅ 가능 |
| **결제수단** | 카드, 계좌, 간편결제 등 | 카드, 계좌 |
| **UI** | 토스 제공 | 토스 제공 |
| **적용 난이도** | ⭐⭐ 쉬움 | ⭐⭐⭐ 중간 |
| **전환율** | ⭐⭐⭐ 보통 | ⭐⭐⭐⭐⭐ 높음 |
| **사용 키** | `test_gck_` | `test_ck_` |

---

## 🎯 권장 로드맵

### Phase 1: MVP (현재)
- ✅ 결제위젯으로 빠르게 구현
- ✅ 모든 결제수단 지원
- ✅ 계약 없이 테스트 가능

### Phase 2: 서비스 론칭
- 🔄 Toss Payments 계약
- 🔄 결제위젯 + 브랜드페이 동시 지원
- 🔄 사용자 데이터 수집

### Phase 3: 최적화
- 🎯 브랜드페이로 전환
- 🎯 원클릭/원터치결제로 전환율 극대화
- 🎯 재구매율 향상

---

## ❓ FAQ

### Q1. 지금 당장 브랜드페이를 사용할 수 있나요?
A. 아니요. 브랜드페이는 Toss Payments와 계약이 필요합니다. 계약 전까지는 결제위젯을 사용하세요.

### Q2. 결제위젯에서 브랜드페이로 전환하면 기존 결제 데이터는?
A. 결제 내역은 그대로 유지됩니다. `payment_history` 테이블에 저장되어 있습니다.

### Q3. 두 가지를 동시에 사용할 수 있나요?
A. 네! `PAYMENT_CONFIG.widget.enableBrandpay = true`로 설정하면 결제위젯에서 브랜드페이 옵션도 제공됩니다.

### Q4. 브랜드페이 계약은 어떻게 하나요?
A. Toss Payments 고객센터(1544-7772)로 문의하세요. 서비스 규모와 거래량에 따라 계약 조건이 달라질 수 있습니다.

### Q5. 테스트 환경에서 브랜드페이를 테스트할 수 있나요?
A. 계약 후 테스트 API 키를 발급받으면 테스트 환경에서도 브랜드페이를 테스트할 수 있습니다.

---

## 📞 문의

- Toss Payments 고객센터: **1544-7772**
- 이메일: **support@tosspayments.com**
- 개발자센터: https://developers.tosspayments.com

