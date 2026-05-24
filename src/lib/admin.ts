import { adminApi } from "@/api/admin";
import { authApi } from "@/api/auth";

export async function isOperator(): Promise<boolean> {
  try {
    const session = await authApi.getSession();
    if (!session?.user?.email) return false;
    return adminApi.isAdmin(session.user.email);
  } catch {
    return false;
  }
}

export async function checkAdminEmail(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  return adminApi.isAdmin(email);
}
