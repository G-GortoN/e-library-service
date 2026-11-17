import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { api, ApiError, clearCsrf, ensureCsrf } from "./api";
import type { User } from "./types";
import { ErrorState, LoadingState } from "./components";

interface AuthState {
  user: User | null;
  pending: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => {
    const expire = () => {
      clearCsrf();
      client.setQueryData(["me"], null);
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    };
    window.addEventListener("folio:session-expired", expire);
    return () => window.removeEventListener("folio:session-expired", expire);
  }, [client]);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<User>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
  });
  const login = async (email: string, password: string) => {
    const user = await api.post<User>("/auth/login", { email, password });
    clearCsrf();
    await ensureCsrf();
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    client.setQueryData(["me"], user);
    return user;
  };
  const logout = async () => {
    await api.post("/auth/logout");
    clearCsrf();
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    client.setQueryData(["me"], null);
  };
  return (
    <AuthContext.Provider
      value={{ user: me.data || null, pending: me.isPending, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  return auth;
}
export function RequireAuth({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, pending } = useAuth();
  const location = useLocation();
  if (pending) return <LoadingState />;
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (admin && user.role !== "ADMIN")
    return (
      <ErrorState
        title="这里需要管理员权限"
        description="你仍然可以浏览图书和管理自己的书架。"
      />
    );
  return children;
}
