import { supabase } from "@/integrations/supabase/client";

/**
 * 현재 사용자가 관리자인지 확인하는 함수
 * admin_users 테이블에서 확인 (일반 사용자와 완전히 분리)
 */
export async function isOperator(): Promise<boolean> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log("세션 확인 오류:", sessionError.message);
      return false;
    }

    if (!session?.user?.email) {
      console.log("세션 또는 이메일 없음");
      return false;
    }

    // admin_users 테이블에서 해당 이메일이 활성화된 관리자인지 확인
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, email, is_active")
      .eq("email", session.user.email)
      .eq("is_active", true)
      .maybeSingle(); // .single() 대신 .maybeSingle() 사용 (레코드 없으면 null 반환)

    if (error) {
      console.error("관리자 확인 쿼리 오류:", error);
      return false;
    }

    if (!data) {
      console.log("관리자 레코드를 찾을 수 없음");
      return false;
    }

    console.log("관리자 확인 성공:", data.email);
    return true;
  } catch (error: any) {
    console.error("관리자 확인 중 오류 발생:", error);
    return false;
  }
}

/**
 * 이메일이 관리자 이메일인지 확인하는 함수 (admin_users 테이블 확인)
 */
export async function checkAdminEmail(email: string | undefined): Promise<boolean> {
  if (!email) {
    return false;
  }

  try {
    // admin_users 테이블에서 해당 이메일이 활성화된 관리자인지 확인
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, email, is_active")
      .eq("email", email.trim())
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("관리자 이메일 확인 중 오류 발생:", error);
    return false;
  }
}

/**
 * 관리자 로그인 성공 시 last_login_at 업데이트
 */
export async function updateAdminLastLogin(email: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("admin_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("email", email);

    if (error) {
      // RLS 정책 오류인 경우 경고만 출력 (로그인은 계속 진행)
      if (error.code === "42501" || error.message.includes("permission") || error.message.includes("policy")) {
        console.warn("관리자 로그인 시간 업데이트 권한 없음 (RLS 정책):", error.message);
      } else {
        console.error("관리자 로그인 시간 업데이트 오류:", error);
      }
    } else {
      console.log("관리자 로그인 시간 업데이트 성공");
    }
  } catch (error: any) {
    // 네트워크 오류 등 예외 상황은 무시 (로그인은 계속 진행)
    console.warn("관리자 로그인 시간 업데이트 실패 (무시됨):", error?.message || error);
  }
}

