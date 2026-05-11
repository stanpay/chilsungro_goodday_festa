# 환경 변수 설정 템플릿

프로젝트 루트의 `.env` 파일에 아래 내용을 설정하세요.
(이미 `.env` 파일이 있다면 기존 내용을 확인하고 필요한 변수만 추가하세요)

## 현재 권장 설정 (결제위젯 사용)

```env
# Toss Payments - 결제위젯 연동 키
# 개발자센터에서 "결제위젯 연동 키" 선택
VITE_TOSS_CLIENT_KEY=test_gck_XXXXXXXXXXXXXXXXXXXX
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX

# Kakao - JavaScript 키 (지도 SDK 및 주소 검색용)
# 카카오 개발자 콘솔에서 "JavaScript 키" 발급
# 주소 검색 API는 이 키로도 작동합니다 (코드에 fallback 포함)
VITE_KAKAO_APP_KEY=your_kakao_javascript_key

# Kakao - REST API 키 (선택사항, 주소 검색 최적화용)
# VITE_KAKAO_APP_KEY만 있어도 작동하지만, REST API 키가 있으면 우선 사용됩니다
# VITE_KAKAO_REST_API_KEY=your_kakao_rest_api_key

# Supabase (기존 설정 유지)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL
VITE_SITE_URL=http://localhost:8080
```

## 나중에 브랜드페이로 전환 시

```env
# Toss Payments - API 개별 연동 키
# 개발자센터에서 "API 개별 연동 키" 선택
VITE_TOSS_CLIENT_KEY=test_ck_XXXXXXXXXXXXXXXXXXXX
VITE_TOSS_SECRET_KEY=test_sk_XXXXXXXXXXXXXXXXXXXX

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL
VITE_SITE_URL=http://localhost:8080
```

## 키 발급 방법

### 1. Toss Payments 개발자센터
1. https://developers.tosspayments.com 접속
2. 회원가입 및 로그인
3. **API 키** 메뉴 클릭

### 2. 결제위젯 연동 키 선택 (현재)
- 키 종류: **"결제위젯 연동 키"**
- 클라이언트 키: `test_gck_`로 시작
- 시크릿 키: `test_sk_`로 시작
- ✅ 계약 없이 바로 테스트 가능

### 3. API 개별 연동 키 선택 (나중에)
- 키 종류: **"API 개별 연동 키"**
- 클라이언트 키: `test_ck_`로 시작
- 시크릿 키: `test_sk_`로 시작
- ⚠️ 브랜드페이 계약 필요

## Kakao API 키 설정

### 필수: JavaScript 키 (지도 SDK용)
1. https://developers.kakao.com 접속
2. 애플리케이션 생성 (또는 기존 앱 선택)
3. **내 애플리케이션** > **앱 설정** > **앱 키**
4. **JavaScript 키** 복사 후 `VITE_KAKAO_APP_KEY`에 입력
   - 이 키로 지도 SDK와 주소 검색 API 모두 사용 가능합니다

### 선택사항: REST API 키 (주소 검색 최적화용)
- `VITE_KAKAO_APP_KEY`만 있어도 주소 검색이 작동합니다
- REST API 키를 추가로 설정하면 주소 검색 시 우선 사용됩니다
- **내 애플리케이션** > **앱 설정** > **앱 키**에서 **REST API 키** 복사 후 `VITE_KAKAO_REST_API_KEY`에 입력

## Supabase 설정

1. https://supabase.com 프로젝트 대시보드
2. **Settings** > **API**
3. **Project URL**: `VITE_SUPABASE_URL`에 입력
4. **anon public**: `VITE_SUPABASE_ANON_KEY`에 입력

## 확인 방법

`.env` 파일 설정 후:

```bash
# 개발 서버 실행
npm run dev

# 브라우저 개발자 도구 콘솔에서 확인
console.log(import.meta.env.VITE_TOSS_CLIENT_KEY);
// 출력: test_gck_... (결제위젯) 또는 test_ck_... (브랜드페이)

console.log(import.meta.env.VITE_KAKAO_APP_KEY);
// 출력: JavaScript 키 값
```

## 주의사항

- `.env` 파일은 git에 커밋하지 마세요 (`.gitignore`에 포함됨)
- 환경 변수 변경 후 반드시 개발 서버 재시작
- 라이브 키는 절대 클라이언트 코드에 노출하지 마세요
- 카카오 지도는 `VITE_KAKAO_APP_KEY`만 있으면 작동합니다 (REST API 키는 선택사항)

