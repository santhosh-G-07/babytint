const LOCAL_ADMIN_TOKEN_KEY = "babytint-local-admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(LOCAL_ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCAL_ADMIN_TOKEN_KEY, token);
  window.dispatchEvent(new Event("babytint-auth-change"));
}

export function setAuthToken(token: string) {
  setAdminToken(token);
}

export function clearAdminToken() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(LOCAL_ADMIN_TOKEN_KEY);
  window.dispatchEvent(new Event("babytint-auth-change"));
}

export function clearAuthToken() {
  clearAdminToken();
}

export function hasAdminToken(): boolean {
  return Boolean(getAdminToken());
}

export function hasAuthToken(): boolean {
  return hasAdminToken();
}
