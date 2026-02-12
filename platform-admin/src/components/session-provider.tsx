"use client";

import { createContext, useContext } from "react";
import type { PlatformRole } from "@/generated/prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
}

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSessionUser must be used inside SessionProvider");
  return value;
}
