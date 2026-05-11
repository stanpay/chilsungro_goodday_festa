# 관리자 보안 구조 및 계정 설정 가이드

## 현재 구조 분석

### 문제점
1. **이메일 충돌**: 같은 이메일로 일반 사용자와 관리자 계정을 만들면 충돌 발생
2. **인증 시스템 공유**: Supabase Auth는 하나의 시스템이라 관리자/일반 사용자가 섞임

### 해결 방법

## 방법 1: 기존 계정을 관리자로 승격 (권장)

### 장점
- 추가 계정 생성 불필요
- 기존 계정 활용
- 비밀번호 관리 간단

### 단계

1. **기존 계정 확인**
   - `zi5708@naver.com` 계정이 이미 존재함
   - 카카오 로그인으로 가입된 계정

2. **이메일/비밀번호 로그인 추가**
   - Supabase 대시보드 → Authentication → Users
   - `zi5708@naver.com` 계정 선택
   - "Reset Password" 또는 "Update User"에서 비밀번호 설정
   - 또는 Supabase Auth API로 비밀번호 설정

3. **admin_users 테이블에 추가** (이미 완료됨)
   ```sql
   -- 이미 추가되어 있음
   SELECT * FROM admin_users WHERE email = 'zi5708@naver.com';
   ```

4. **로그인 방법**
   - `/admin/login`에서 이메일/비밀번호로 로그인
   - 일반 사용자 페이지에서는 카카오 로그인 사용 가능

## 방법 2: 관리자 전용 이메일 사용 (더 안전)

### 장점
- 완전 분리된 관리자 계정
- 보안성 향상
- 관리자 계정 관리 용이

### 단계

1. **새 관리자 이메일 생성**
   - 예: `admin@yourdomain.com` 또는 `admin-stanpay@yourdomain.com`

2. **Supabase Auth에 계정 생성**
   - Supabase 대시보드 → Authentication → Users
   - "Add user" 클릭
   - Email: 새 관리자 이메일
   - Password: 강력한 비밀번호
   - Auto Confirm User: 체크

3. **admin_users 테이블에 추가**
   ```sql
   INSERT INTO public.admin_users (email, is_active)
   VALUES ('admin@yourdomain.com', true)
   ON CONFLICT (email) DO NOTHING;
   ```

4. **기존 zi5708@naver.com을 admin_users에서 제거** (선택사항)
   ```sql
   DELETE FROM public.admin_users 
   WHERE email = 'zi5708@naver.com';
   ```

## 보안 구조

### 현재 보안 메커니즘

1. **admin_users 테이블**: 관리자 권한 관리
   - 일반 사용자는 `admin_users` 테이블에 없음
   - 관리자만 `admin_users` 테이블에 등록됨

2. **이중 검증**:
   - 로그인 전: `admin_users` 테이블 확인
   - 로그인 후: `admin_users` 테이블 재확인

3. **권한 분리**:
   - 일반 사용자: `/main`, `/mypage` 등 접근 가능
   - 관리자: `/admin` 접근 가능 (admin_users 테이블 확인 필수)

### 보안 강화 방안

1. **RLS 정책 강화**: admin_users 테이블 접근 제한
2. **로그인 시도 제한**: 실패 시 일시 차단
3. **2FA 추가**: 관리자 계정에 2단계 인증 추가
4. **IP 화이트리스트**: 특정 IP에서만 관리자 로그인 허용

## 권장 사항

### 방법 1 선택 시 (기존 계정 승격)
- ✅ 빠르고 간단
- ✅ 추가 계정 불필요
- ⚠️ 같은 이메일로 일반/관리자 역할 공유

### 방법 2 선택 시 (전용 이메일)
- ✅ 완전 분리된 관리자 계정
- ✅ 보안성 향상
- ⚠️ 추가 이메일 계정 필요

## 현재 상태

- ✅ `admin_users` 테이블에 `zi5708@naver.com` 등록됨
- ✅ 보안 구조 구현 완료
- ⚠️ Supabase Auth에 이메일/비밀번호 로그인 추가 필요

## 다음 단계

1. **기존 계정에 비밀번호 추가**:
   - Supabase 대시보드 → Authentication → Users
   - `zi5708@naver.com` 선택
   - 비밀번호 설정

2. **또는 새 관리자 이메일 생성**:
   - 전용 관리자 이메일 생성
   - 새 계정 생성 후 admin_users에 추가

