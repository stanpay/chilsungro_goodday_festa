# 🔧 네비게이션 및 뒤로가기 문제 해결

## 🐛 문제점

1. **토스 결제 화면에서 뒤로가기 시 오류 발생**
   - "결제수단을 선택해주세요" 오류
   - 브랜드페이 관련 오류 (`initBrandPay` 호출)

2. **Step 2에서 Step 1로 돌아가지 않고 메인으로 튕김**

3. **브라우저 뒤로가기 시 state가 초기화됨**

## ✅ 해결 방법

### 1. URL 쿼리 파라미터로 Step 관리

Step을 state뿐만 아니라 URL에도 반영하여 브라우저 히스토리 지원:

```typescript
// Step 1 → Step 2
navigate(`/payment/${storeId}?step=2`, { replace: false });

// Step 2 → Step 1 (뒤로가기)
navigate(`/payment/${storeId}`, { replace: false });

// Step 3 (결제 완료)
navigate(`/payment/${storeId}?step=3`);
```

### 2. URL 쿼리 파라미터에서 Step 복원

```typescript
useEffect(() => {
  const stepParam = searchParams.get('step');
  
  if (paymentSuccess === 'true') {
    setStep(3);
  } else if (stepParam === '3') {
    setStep(3);
  } else if (stepParam === '2') {
    // 주문 정보 확인 후 Step 2로
    const orderDataStr = sessionStorage.getItem('toss_payment_order');
    if (orderDataStr) {
      setStep(2);
    } else {
      // 주문 정보 없으면 Step 1로
      navigate(`/payment/${storeId}`, { replace: true });
    }
  } else {
    setStep(1);
  }
}, [searchParams]);
```

### 3. 헤더 뒤로가기 버튼 수정

```typescript
// Step 2 헤더의 뒤로가기 버튼
<button onClick={() => {
  sessionStorage.removeItem('toss_payment_order');
  navigate(`/payment/${storeId}`, { replace: false });
}}>
  <ArrowLeft />
</button>
```

### 4. 브랜드페이 코드 완전 제거

`Payment.tsx`에서 `initBrandPay` 호출을 완전히 제거하여 결제위젯만 사용.

## 🔄 네비게이션 플로우

```
Step 1: /payment/:storeId
  ↓ [확인 버튼]
  
Step 2: /payment/:storeId?step=2
  ↓ [뒤로가기 버튼] → /payment/:storeId (Step 1로)
  ↓ [결제하기 버튼] → Toss 결제창
  
Toss 결제창
  ↓ [뒤로가기] → /payment/:storeId?step=2 (Step 2로 복귀)
  ↓ [결제 완료]
  
PaymentSuccess
  ↓ 자동 리다이렉트
  
Step 3: /payment/:storeId?step=3
  ↓ [완료 버튼] → /main
```

## 🎯 브라우저 뒤로가기 동작

| 현재 위치 | 뒤로가기 동작 | 결과 |
|----------|-------------|------|
| Step 1 | 브라우저 뒤로가기 | 메인 페이지로 |
| Step 2 | 브라우저 뒤로가기 | Step 1로 복귀 |
| Step 2 (결제위젯) | 헤더 뒤로가기 버튼 | Step 1로 복귀 |
| Toss 결제창 | 결제창 내 뒤로가기 | Step 2로 복귀 |
| Step 3 | 브라우저 뒤로가기 | 메인으로 이동 (결제 완료) |

## 📋 sessionStorage 관리

### 저장 시점
- Step 1 → Step 2 이동 시: 주문 정보 저장

### 삭제 시점
- Step 2 → Step 1 뒤로가기 시: 주문 정보 삭제
- 결제 완료 후: 주문 정보 및 플래그 삭제

```typescript
// 저장
sessionStorage.setItem('toss_payment_order', JSON.stringify(orderData));

// 삭제
sessionStorage.removeItem('toss_payment_order');
sessionStorage.removeItem('payment_success');
sessionStorage.removeItem('payment_result');
```

## 🧪 테스트 시나리오

### 시나리오 1: 정상 결제 플로우
1. Step 1에서 기프티콘 선택
2. 확인 버튼 → Step 2로 이동 (URL: `?step=2`)
3. 결제위젯 UI 렌더링
4. 결제수단 선택
5. 결제하기 버튼 → Toss 결제창
6. 결제 완료 → Step 3로 자동 이동

### 시나리오 2: Step 2에서 뒤로가기
1. Step 2에서 헤더 뒤로가기 버튼 클릭
2. Step 1로 복귀 (URL: `/payment/:storeId`)
3. sessionStorage 주문 정보 삭제
4. 다시 기프티콘 선택 가능

### 시나리오 3: Toss 결제창에서 뒤로가기
1. Step 2에서 결제하기 버튼 클릭
2. Toss 결제창 열림 (딥링크 or 팝업)
3. 결제창에서 뒤로가기
4. Step 2로 복귀
5. 결제위젯 UI 유지됨

### 시나리오 4: 브라우저 새로고침
1. Step 2에서 브라우저 새로고침 (F5)
2. URL 쿼리 파라미터 `?step=2` 유지
3. sessionStorage 주문 정보 확인
4. 주문 정보 있으면 Step 2 유지
5. 없으면 Step 1로 리다이렉트

## 🔍 디버깅 팁

### 브라우저 콘솔에서 확인

```javascript
// 현재 step 확인
console.log('Current URL:', window.location.href);
console.log('Step param:', new URLSearchParams(window.location.search).get('step'));

// sessionStorage 확인
console.log('Order data:', sessionStorage.getItem('toss_payment_order'));
console.log('Payment success:', sessionStorage.getItem('payment_success'));
```

### 네트워크 탭 확인

- 결제위젯 SDK 로딩: `js.tosspayments.com/v2/standard`
- 결제 승인 API: `api.tosspayments.com`
- Edge Function: `supabase.co/functions/v1/confirm-payment`

## 🚨 주의사항

1. **절대 `initBrandPay`를 호출하지 마세요**
   - 결제위젯 키(`test_gck_`)와 호환되지 않음
   - `initPaymentWidget`만 사용

2. **뒤로가기 시 sessionStorage 정리**
   - Step 2 → Step 1: 주문 정보 삭제
   - 그렇지 않으면 불필요한 데이터 남음

3. **URL 쿼리 파라미터 유지**
   - `replace: false` 사용하여 히스토리에 추가
   - 뒤로가기 동작 지원

4. **결제위젯 DOM 준비 대기**
   - `setTimeout(100ms)` 후 렌더링
   - DOM 요소가 준비되지 않으면 오류 발생

## 📞 문제 해결

### "결제수단을 선택해주세요" 오류
- **원인**: 결제위젯 UI가 렌더링되지 않음
- **해결**: Step 2 useEffect에서 자동 렌더링 확인

### 브랜드페이 관련 오류
- **원인**: `initBrandPay` 호출 코드가 남아있음
- **해결**: `initPaymentWidget`만 사용하도록 확인

### Step 2에서 메인으로 튕김
- **원인**: sessionStorage에 주문 정보 없음
- **해결**: Step 1 → Step 2 이동 시 주문 정보 저장 확인

### 결제창에서 뒤로가기 후 오류
- **원인**: 결제위젯 인스턴스가 초기화됨
- **해결**: URL 쿼리 파라미터로 Step 2 복원, 위젯 재렌더링

