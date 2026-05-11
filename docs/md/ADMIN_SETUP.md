# 관리자 계정 설정 가이드

## 개요

관리자 계정은 일반 사용자와 완전히 분리된 `admin_users` 테이블에서 관리됩니다. 일반 사용자는 절대로 관리자 페이지에 접근할 수 없습니다.

## 보안 구조

1. **admin_users 테이블**: 관리자 이메일만 저장 (일반 사용자와 완전 분리)
2. **Supabase Auth**: 실제 인증은 Supabase Auth 사용
3. **이중 검증**: 
   - 로그인 전: admin_users 테이블 확인
   - 로그인 후: admin_users 테이블 재확인

## 관리자 계정 생성 방법

### 방법 1: Supabase 대시보드에서 생성 (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **Authentication → Users 메뉴로 이동**

3. **"Add user" 클릭**

4. **사용자 정보 입력**:
   - Email: 관리자 이메일 (예: `zi5708@naver.com`)
   - Password: 강력한 비밀번호 입력
   - Auto Confirm User: ✅ 체크 (이메일 인증 없이 바로 사용)

5. **"Create user" 클릭**

6. **admin_users 테이블에 추가**:
   - SQL Editor로 이동
   - 다음 SQL 실행:
   ```sql
   INSERT INTO public.admin_users (email, is_active)
   VALUES ('your-admin-email@example.com', true)
   ON CONFLICT (email) DO NOTHING;
   ```

### 방법 2: SQL로 직접 생성

Supabase SQL Editor에서 실행:

```sql
-- 1. Supabase Auth에 사용자 생성 (Service Role Key 필요)
-- 이 부분은 Supabase 대시보드의 Authentication → Users에서 수동으로 생성하거나
-- Supabase CLI를 사용해야 합니다.

-- 2. admin_users 테이블에 관리자 추가
INSERT INTO public.admin_users (email, is_active, created_at)
VALUES ('zi5708@naver.com', true, now())
ON CONFLICT (email) DO NOTHING;
```

### 방법 3: Supabase MCP 사용

Cursor에서 Supabase MCP를 사용하여 직접 생성할 수 있습니다.

## 관리자 로그인

1. `/admin/login` 접속
2. 관리자 이메일 입력 (`admin_users` 테이블에 등록된 이메일)
3. 비밀번호 입력 (Supabase Auth에 설정한 비밀번호)
4. 로그인 성공 시 관리자 대시보드로 이동

## 관리자 계정 관리

### 관리자 목록 조회

```sql
SELECT email, is_active, created_at, last_login_at 
FROM public.admin_users 
ORDER BY created_at DESC;
```

### 관리자 비활성화

```sql
UPDATE public.admin_users 
SET is_active = false 
WHERE email = 'admin@example.com';
```

### 관리자 활성화

```sql
UPDATE public.admin_users 
SET is_active = true 
WHERE email = 'admin@example.com';
```

### 관리자 삭제

```sql
-- admin_users 테이블에서 삭제
DELETE FROM public.admin_users 
WHERE email = 'admin@example.com';

-- Supabase Auth에서도 삭제 (선택사항)
-- Supabase 대시보드 → Authentication → Users에서 삭제
```

## 보안 주의사항

1. ⚠️ **일반 사용자는 절대로 관리자 페이지에 접근할 수 없습니다**
   - `admin_users` 테이블에 없는 이메일은 로그인 시도 시 즉시 거부됩니다
   - Supabase Auth에 계정이 있어도 `admin_users` 테이블에 없으면 관리자로 인증되지 않습니다

2. 🔒 **비밀번호 보안**
   - 강력한 비밀번호 사용 (최소 8자 이상, 영문/숫자/특수문자 조합)
   - 정기적으로 비밀번호 변경

3. 📝 **관리자 계정 모니터링**
   - `last_login_at` 필드로 마지막 로그인 시간 확인 가능
   - 비정상적인 로그인 시도 모니터링

## 문제 해결

### "접근 거부" 오류가 발생하는 경우

1. `admin_users` 테이블에 해당 이메일이 있는지 확인
2. `is_active`가 `true`인지 확인
3. Supabase Auth에 계정이 생성되어 있는지 확인

### 로그인이 안 되는 경우

1. 이메일과 비밀번호가 정확한지 확인
2. Supabase Auth에서 계정 상태 확인 (비활성화되지 않았는지)
3. `admin_users` 테이블에서 계정 상태 확인

