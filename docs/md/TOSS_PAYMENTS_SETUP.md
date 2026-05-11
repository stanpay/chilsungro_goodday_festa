# 🚀 Toss Payments 브랜드페이 원클릭 구매 설정 가이드

## 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경 변수를 추가하세요:

```env
# Toss Payments API Keys
VITE_TOSS_CLIENT_KEY=test_ck_XXXXXXXXXXXXXXXXXXXX
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX

# Supabase (기존 설정 유지)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL
VITE_SITE_URL=http://localhost:8080
```

## 2. Toss Payments API 키 발급

1. [Toss Payments 개발자센터](https://developers.tosspayments.com) 회원가입
2. **API 키** 메뉴로 이동
3. **API 개별 연동 키** 선택
4. **테스트 클라이언트 키**와 **시크릿 키** 복사
5. `.env.local` 파일에 붙여넣기

## 3. 개발자센터에서 브랜드페이 설정

### 3.1 리다이렉트 URL 등록
1. Toss Payments 개발자센터 로그인
2. **상점관리자** > **브랜드페이** > **리다이렉트 URL** 메뉴
3. 다음 URL들을 추가:
   - 개발: `http://localhost:8080/callback-auth`
   - 배포: `https://your-domain.com/callback-auth`

### 3.2 브랜드페이 활성화
1. **결제 UI 설정** > **UI 환경** > **선택 후 기능** > **브랜드페이**
2. 브랜드페이 사용 활성화

## 4. Supabase 설정

### 4.1 결제 내역 테이블 생성

Supabase SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- scripts/create-payment-history-table.sql 파일 내용 참고
```

또는 터미널에서:

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/create-payment-history-table.sql
```

### 4.2 Edge Function 배포

```bash
# Supabase CLI 로그인
supabase login

# Edge Function 배포
supabase functions deploy confirm-payment

# 환경 변수 설정
supabase secrets set VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX
```

## 5. 의존성 설치

이미 설치되어 있지만, 확인차 재설치:

```bash
npm install @tosspayments/tosspayments-sdk
```

## 6. 개발 서버 실행

```bash
npm run dev
```

서버가 시작되면 `http://localhost:8080`에서 접속 가능합니다.

## 7. 결제 플로우 테스트

### 7.1 로그인
1. 메인 페이지에서 이메일로 로그인

### 7.2 매장 선택
1. 메인 페이지에서 근처 매장 선택
2. 또는 직접 `http://localhost:8080/payment/[storeId]` 접속

### 7.3 결제 진행
1. 원하는 기프티콘 선택
2. **확인 버튼 클릭** → Toss Payments 결제창 열림
3. 테스트 카드로 결제:
   - 카드 번호: `5270123456789012` (테스트용)
   - 유효기간: 미래 날짜 (예: `12/25`)
   - CVC: `123`
4. 결제 완료 → 성공 페이지로 리다이렉트

### 7.4 결제 확인
- Supabase의 `payment_history` 테이블에서 결제 내역 확인
- Toss Payments 개발자센터의 **결제내역** 메뉴에서도 확인 가능

## 8. 테스트 카드 정보

Toss Payments에서 제공하는 테스트 카드:

| 카드사 | 카드 번호 | 결과 |
|--------|----------|------|
| 국민카드 | 9430123456789019 | 성공 |
| 신한카드 | 9510123456789012 | 성공 |
| 우리카드 | 9490123456789010 | 성공 |
| 하나카드 | 5270123456789012 | 성공 |

- **유효기간**: 미래 날짜 아무거나 (예: `12/25`)
- **CVC**: 아무 3자리 숫자 (예: `123`)
- **비밀번호**: 앞 2자리만 입력 (예: `12`)

## 9. 원클릭 결제 (브랜드페이)

### 최초 결제
1. 첫 결제 시 결제수단 등록
2. 등록 후 `callback-auth` 페이지로 리다이렉트
3. Access Token 발급 및 저장

### 두 번째 결제부터
1. **확인 버튼만 클릭** → 바로 결제창 열림
2. 이미 등록된 결제수단으로 빠른 결제
3. 원터치결제 활성화 시 비밀번호 없이 결제 가능

## 10. 배포 시 주의사항

### 10.1 환경 변수 설정
Vercel/Netlify 등 배포 플랫폼에서:
- `VITE_TOSS_CLIENT_KEY`: 라이브 클라이언트 키
- `VITE_TOSS_SECRET_KEY`: 라이브 시크릿 키
- `VITE_SITE_URL`: 배포된 도메인

### 10.2 리다이렉트 URL 업데이트
Toss Payments 개발자센터에서:
- `https://your-domain.com/callback-auth` 추가

### 10.3 Supabase Edge Function 환경 변수
```bash
supabase secrets set VITE_TOSS_SECRET_KEY=live_sk_XXXXXXXXXXXXXXXXXXXX
```

## 11. 문제 해결

### 결제창이 열리지 않음
- 브라우저 콘솔에서 에러 확인
- Toss Payments API 키 확인
- 네트워크 탭에서 API 호출 확인

### 결제 승인 실패
- Edge Function 로그 확인: `supabase functions logs confirm-payment`
- Toss Payments 시크릿 키 확인
- Supabase 환경 변수 확인

### Access Token 발급 실패
- 리다이렉트 URL이 개발자센터에 등록되어 있는지 확인
- `customerKey`가 올바른 형식인지 확인

## 12. 추가 기능

### 결제수단 관리
```typescript
import { initBrandPay } from '@/lib/tossPayments';

const brandpay = await initBrandPay(customerKey);

// 결제수단 추가
await brandpay.addPaymentMethod();

// 결제수단 관리 설정
await brandpay.openSettings();

// 원터치결제 활성화 여부 확인
const isEnabled = await brandpay.isOneTouchPayEnabled();
```

## 13. 참고 자료

- [Toss Payments 개발자센터](https://developers.tosspayments.com)
- [브랜드페이 연동 가이드](https://docs.tosspayments.com/guides/brandpay)
- [JavaScript SDK 문서](https://docs.tosspayments.com/sdk/v2/js)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## 14. 지원

문제가 있으면:
- Toss Payments 고객센터: 1544-7772
- 이메일: support@tosspayments.com
- 실시간 기술지원: [채널톡](https://developers.tosspayments.com)

