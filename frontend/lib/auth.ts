"use client";

export interface UserSession {
  token: string;
  kode: string;
  nama: string;
  is_admin: boolean;
  permissions: Record<string, boolean>;
}

export function saveSession(session: UserSession) {
  localStorage.setItem("simrscb_token", session.token);
  localStorage.setItem("simrscb_user", JSON.stringify(session));
}

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("simrscb_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasPerm(perm: string): boolean {
  const session = getSession();
  if (!session) return false;
  if (session.is_admin) return true;
  return session.permissions?.[perm] === true;
}

export function clearSession() {
  localStorage.removeItem("simrscb_token");
  localStorage.removeItem("simrscb_user");
}
