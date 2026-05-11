# 🔑 Toss Payments 키 설정 수정 가이드

## 문제 상황
```
결제 요청 오류: API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 
결제위젯 연동 키는 지원하지 않습니다.
```

## 원인
현재 `.env` 파일에 **결제위젯 연동 키** (`test_gck_XXX`)가 설정되어 있음.
브랜드페이는 **API 개별 연동 키** (`test_ck_XXX`)가 필요합니다!

## 해결 방법

### 1단계: Toss Payments 개발자센터에서 올바른 키 확인

1. [Toss Payments 개발자센터](https://developers.tosspayments.com) 로그인
2. **API 키** 메뉴 클릭
3. **키 종류 선택** 드롭다운에서:
   - ❌ "결제위젯 연동 키" (test_gck_XXX) - 사용하지 마세요!
   - ✅ **"API 개별 연동 키"** (test_ck_XXX) - 이것을 선택하세요!

### 2단계: API 개별 연동 키 복사

화면에 표시되는:
- **클라이언트 키**: `test_ck_XXXXXXXXXXXXXXXXXXXX` (test_ck_로 시작)
- **시크릿 키**: `test_sk_XXXXXXXXXXXXXXXXXXXX` (test_sk_로 시작)

### 3단계: .env 파일 수정

프로젝트 루트의 `.env` 파일을 열고 다음과 같이 수정:

```env
# ❌ 잘못된 예시 (결제위젯 연동 키)
# VITE_TOSS_CLIENT_KEY=test_gck_XXXXXXXXXXXXXXXXXXXX

# ✅ 올바른 예시 (API 개별 연동 키)
VITE_TOSS_CLIENT_KEY=test_ck_XXXXXXXXXXXXXXXXXXXX
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX

# Supabase 설정 (기존 유지)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL
VITE_SITE_URL=http://localhost:8080
```

### 4단계: 개발 서버 재시작

환경 변수를 변경했으므로 개발 서버를 재시작해야 합니다:

```bash
# Ctrl+C로 서버 중지 후
npm run dev
```

### 5단계: 브랜드페이 설정 (개발자센터)

API 개별 연동 키를 사용하려면 브랜드페이 설정도 확인하세요:

1. 개발자센터에서 **상점관리자** 클릭
2. **API 개별 연동 키**로 계약된 MID 선택
3. **브랜드페이** 메뉴 > **리다이렉트 URL** 설정:
   - `http://localhost:8080/callback-auth` 추가

## 키 구분하는 방법

| 키 종류 | 시작 문자 | 용도 |
|---------|----------|------|
| 결제위젯 클라이언트 키 | `test_gck_` | 결제위젯 전용 |
| API 개별 클라이언트 키 | `test_ck_` | 브랜드페이, 결제창, 빌링 |
| 시크릿 키 | `test_sk_` | 서버 사이드 API 호출 |

## 테스트 환경에서 계약 없이 사용 가능?

- **결제위젯**: 계약 필요 없음 (테스트 키만으로 가능)
- **브랜드페이**: ⚠️ **계약 필요** (테스트라도 계약 필요)
- **일반 결제창**: 계약 필요 없음 (테스트 키만으로 가능)

### 브랜드페이 테스트를 위한 임시 해결책

브랜드페이 계약이 아직 안 되어 있다면:

#### 옵션 1: 일반 결제창 사용 (빠른 테스트)
브랜드페이 대신 일반 결제창으로 임시 구현 가능합니다.

#### 옵션 2: 브랜드페이 계약
Toss Payments 고객센터에 문의:
- 전화: 1544-7772
- 이메일: support@tosspayments.com

## 확인 방법

개발자 도구 콘솔에서 확인:

```javascript
// 올바른 키 형식
console.log(import.meta.env.VITE_TOSS_CLIENT_KEY); 
// 출력: test_ck_... (올바름)
// 출력: test_gck_... (잘못됨!)
```

## 여전히 문제가 발생하면?

1. 브라우저 캐시 삭제
2. `.env` 파일 위치 확인 (프로젝트 루트에 있어야 함)
3. 환경 변수 이름 확인 (`VITE_` 접두사 필수)
4. 개발 서버가 완전히 재시작되었는지 확인

