# 🔧 Toss Payments 결제 문제 해결 가이드

## ❌ 에러: "API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요"

### 증상
```
결제 요청 오류: API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 
결제위젯 연동 키는 지원하지 않습니다.
```

### 원인
브랜드페이 함수(`initBrandPay`)를 호출하고 있는데, 결제위젯 키(`test_gck_`)를 사용 중입니다.

### ✅ 해결 방법

#### 1단계: 환경 변수 확인

`.env.local` 파일을 열어서 확인:

```bash
cat .env.local
```

**올바른 설정** (결제위젯):
```env
VITE_TOSS_CLIENT_KEY=test_gck_XXXXXXXXXXXXXXXXXXXX  # test_gck_로 시작해야 함!
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX
```

**잘못된 설정**:
```env
VITE_TOSS_CLIENT_KEY=test_ck_XXXXXXXXXXXXXXXXXXXX   # ❌ 브랜드페이 키
```

#### 2단계: Toss Payments 개발자센터에서 올바른 키 복사

1. https://developers.tosspayments.com 로그인
2. **API 키** 메뉴
3. 키 종류 드롭다운에서 **"결제위젯 연동 키"** 선택
4. 클라이언트 키 복사 (`test_gck_`로 시작하는 키)
5. 시크릿 키 복사 (`test_sk_`로 시작하는 키)

#### 3단계: .env.local 파일 수정

```env
VITE_TOSS_CLIENT_KEY=test_gck_여기에_복사한_키_붙여넣기
VITE_TOSS_SECRET_KEY=test_sk_여기에_복사한_키_붙여넣기

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SITE_URL=http://localhost:8080
```

#### 4단계: 개발 서버 재시작 (중요!)

환경 변수를 변경했으므로 **반드시 재시작**해야 합니다:

```bash
# 터미널에서 Ctrl+C로 서버 중지

# 다시 시작
npm run dev
```

#### 5단계: 브라우저 캐시 삭제 (선택)

브라우저 개발자 도구 (F12) → Console에서:

```javascript
// 환경 변수 확인
console.log(import.meta.env.VITE_TOSS_CLIENT_KEY);
// 출력: test_gck_XXX (정상)
// 출력: test_ck_XXX (잘못됨!)
```

캐시 삭제:
- Chrome: Ctrl+Shift+Delete → "캐시된 이미지 및 파일" 삭제
- 또는 시크릿 모드로 테스트

---

## ❌ 에러: "결제 요청 오류"

### 증상
결제 버튼 클릭 시 일반적인 오류 메시지

### 체크리스트

#### 1. 환경 변수 확인
```bash
# .env.local 파일이 프로젝트 루트에 있는지 확인
ls -la .env.local

# 내용 확인
cat .env.local
```

#### 2. VITE_ 접두사 확인
모든 환경 변수는 `VITE_`로 시작해야 합니다:

✅ 올바름:
```env
VITE_TOSS_CLIENT_KEY=...
VITE_TOSS_SECRET_KEY=...
```

❌ 잘못됨:
```env
TOSS_CLIENT_KEY=...        # VITE_ 접두사 없음
REACT_APP_TOSS_KEY=...     # 잘못된 접두사
```

#### 3. 개발 서버 재시작 여부
환경 변수를 변경한 후 **반드시** 개발 서버를 재시작해야 합니다.

#### 4. 키 형식 확인

| 키 종류 | 시작 문자 | 용도 |
|---------|----------|------|
| 결제위젯 클라이언트 키 | `test_gck_` | 결제위젯 전용 ✅ |
| API 개별 클라이언트 키 | `test_ck_` | 브랜드페이 전용 |
| 시크릿 키 | `test_sk_` | 서버 사이드 API |

---

## ❌ 에러: "VITE_TOSS_CLIENT_KEY가 설정되지 않았습니다"

### 해결 방법

1. `.env.local` 파일이 프로젝트 **루트**에 있는지 확인
   ```
   /home/jihoon/project/stanpay/.env.local  ✅
   /home/jihoon/project/stanpay/src/.env.local  ❌
   ```

2. 파일 내용에 공백이나 따옴표가 없는지 확인:
   ```env
   # ✅ 올바름
   VITE_TOSS_CLIENT_KEY=test_gck_XXX
   
   # ❌ 잘못됨
   VITE_TOSS_CLIENT_KEY="test_gck_XXX"  # 따옴표 불필요
   VITE_TOSS_CLIENT_KEY = test_gck_XXX  # 공백 불필요
   ```

3. 개발 서버 재시작

---

## ❌ 에러: "결제창이 열리지 않음"

### 원인
- 팝업 차단
- SDK 로딩 실패
- CORS 문제

### 해결 방법

1. **팝업 차단 해제**
   - 브라우저 주소창 옆 팝업 차단 아이콘 클릭
   - "항상 허용" 선택

2. **네트워크 확인**
   - 개발자 도구 (F12) → Network 탭
   - `https://js.tosspayments.com/v2/standard` 로딩 확인
   - 빨간색 에러가 있는지 확인

3. **콘솔 에러 확인**
   - 개발자 도구 (F12) → Console 탭
   - 에러 메시지 확인

---

## ❌ 에러: "결제 승인 실패"

### 원인
Edge Function 문제 또는 Supabase 설정 문제

### 해결 방법

1. **Supabase Edge Function 배포 확인**
   ```bash
   supabase functions list
   # confirm-payment가 목록에 있어야 함
   ```

2. **Edge Function 환경 변수 설정**
   ```bash
   supabase secrets list
   
   # 없으면 설정
   supabase secrets set VITE_TOSS_CLIENT_KEY=test_gck_XXX
   supabase secrets set VITE_TOSS_SECRET_KEY=test_sk_XXX
   ```

3. **Edge Function 로그 확인**
   ```bash
   supabase functions logs confirm-payment
   ```

---

## 🧪 테스트 체크리스트

결제 테스트 전에 확인:

- [ ] `.env.local` 파일이 프로젝트 루트에 있음
- [ ] `VITE_TOSS_CLIENT_KEY`가 `test_gck_`로 시작
- [ ] `VITE_TOSS_SECRET_KEY`가 `test_sk_`로 시작
- [ ] 개발 서버를 재시작함
- [ ] 브라우저 팝업 차단 해제
- [ ] 콘솔에 에러가 없음
- [ ] Supabase Edge Function 배포됨

---

## 🔍 디버깅 팁

### 브라우저 콘솔에서 환경 변수 확인

```javascript
// 모든 환경 변수 출력
console.log(import.meta.env);

// Toss 키 확인
console.log('Client Key:', import.meta.env.VITE_TOSS_CLIENT_KEY);
console.log('Secret Key:', import.meta.env.VITE_TOSS_SECRET_KEY);

// 키 타입 확인
const key = import.meta.env.VITE_TOSS_CLIENT_KEY;
console.log('키 타입:', 
  key?.startsWith('test_gck_') ? '결제위젯 ✅' :
  key?.startsWith('test_ck_') ? 'API 개별 (브랜드페이)' :
  '알 수 없음 ❌'
);
```

### 네트워크 요청 확인

개발자 도구 (F12) → Network 탭:
- `js.tosspayments.com` - SDK 로딩
- `api.tosspayments.com` - 결제 승인 API
- `supabase.co/functions` - Edge Function 호출

---

## 📞 여전히 문제가 해결되지 않는다면?

1. **개발자 도구 콘솔 스크린샷** 찍기
2. **Network 탭 스크린샷** 찍기
3. **터미널 에러 로그** 복사하기
4. `.env.local` 파일 내용 확인 (키는 제외하고 형식만)

Toss Payments 고객센터:
- 전화: 1544-7772
- 이메일: support@tosspayments.com

