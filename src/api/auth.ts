import { DUMMY_USER } from "./dummyData";

export interface User {
  id: string;
  email: string;
}

export interface Session {
  user: User;
  access_token: string;
}

// 더미 세션 - API 완성 전까지 항상 로그인 상태
const DUMMY_SESSION: Session = {
  user: DUMMY_USER,
  access_token: "dummy-token",
};

export const authApi = {
  getSession: async (): Promise<Session | null> => {
    // TODO: GET /api/auth/session
    return DUMMY_SESSION;
  },

  getUser: async (): Promise<User | null> => {
    // TODO: GET /api/auth/me
    return DUMMY_USER;
  },

  signIn: async (email: string, _password: string): Promise<Session> => {
    // TODO: POST /api/auth/signin
    return { user: { id: "user-001", email }, access_token: "token" };
  },

  signOut: async (): Promise<void> => {
    // TODO: POST /api/auth/signout
    localStorage.removeItem("auth_token");
  },
};
