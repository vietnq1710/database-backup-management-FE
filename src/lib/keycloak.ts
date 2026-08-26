import type { User } from "@/types/api";

// ── Cấu hình qua .env (VITE_*) ───────────────────────────────────
const KC_URL = import.meta.env.VITE_KEYCLOAK_URL ?? "";
const REALM = import.meta.env.VITE_KEYCLOAK_REALM ?? "";
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "";

export const keycloakConfigured = !!(KC_URL && REALM && CLIENT_ID);

const oidcBase = `${KC_URL}/realms/${REALM}/protocol/openid-connect`;

// ── Token storage ────────────────────────────────────────────────

const ACCESS_KEY = "bm_access_token";
const REFRESH_KEY = "bm_refresh_token";
const ID_KEY = "bm_id_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function getIdToken(): string | null {
  return localStorage.getItem(ID_KEY);
}

export function setTokens(tokens: {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
}): void {
  if (tokens.access_token) localStorage.setItem(ACCESS_KEY, tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  if (tokens.id_token) localStorage.setItem(ID_KEY, tokens.id_token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ID_KEY);
}

// ── PKCE helpers ─────────────────────────────────────────────────

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

function randomValue(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

// ── Login redirect (Authorization Code + PKCE) ───────────────────

export async function loginWithKeycloak(): Promise<void> {
  if (!keycloakConfigured) return;

  const state = randomValue();
  const verifier = randomValue();
  sessionStorage.setItem("kc_state", state);
  sessionStorage.setItem("kc_verifier", verifier);

  const challenge = base64url(new Uint8Array(await sha256(verifier)));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${window.location.origin}/callback`,
    response_type: "code",
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${oidcBase}/auth?${params}`;
}

// ── Callback: đổi code lấy token ─────────────────────────────────

type TokenSet = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
};

async function exchangeCode(code: string, verifier: string): Promise<TokenSet> {
  const res = await fetch(`${oidcBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: `${window.location.origin}/callback`,
      code,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Keycloak token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenSet;
}

export async function handleCallback(): Promise<void> {
  const url = new URL(window.location.href);
  const error = url.searchParams.get("error");
  if (error) {
    throw new Error(
      url.searchParams.get("error_description") ?? `SSO error: ${error}`,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = sessionStorage.getItem("kc_state");
  const verifier = sessionStorage.getItem("kc_verifier");

  if (!code || !state || !expectedState || !verifier) {
    throw new Error("Thiếu code/state trong callback URL");
  }
  if (state !== expectedState) {
    throw new Error("State không khớp — có thể là request giả mạo");
  }

  const tokens = await exchangeCode(code, verifier);
  setTokens(tokens);
  sessionStorage.removeItem("kc_state");
  sessionStorage.removeItem("kc_verifier");
  window.history.replaceState({}, "", "/callback");
}

// ── Refresh / logout ─────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

export function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken || !keycloakConfigured) return Promise.resolve(false);

  refreshPromise ??= fetch(`${oidcBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const tokens = (await res.json()) as TokenSet;
      setTokens(tokens);
      return !!tokens.access_token;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// Xóa token cục bộ và về trang login (dùng khi 401 sau khi refresh thất bại)
export function clearSessionAndGoLogin(): void {
  clearTokens();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

// Đăng xuất thật sự: kết thúc session Keycloak rồi quay lại app.
// Lưu ý 1: phải đọc id_token TRƯỚC khi xóa storage — nếu không sẽ bị
// Keycloak từ chối với lỗi "Missing parameters: id_token_hint"
// Lưu ý 2: post_logout_redirect_uri PHẢI nằm trong "Valid post logout
// redirect URIs" của client trên Keycloak Admin, nếu không sẽ báo
// "Invalid redirect uri". Dùng /callback (đã whitelist cho login flow) —
// AuthCallback nhận biết "về từ logout" (không có code) rồi tự chuyển /login.
export function logoutWithKeycloak(): void {
  const idToken = getIdToken();
  clearTokens();

  if (!keycloakConfigured) {
    window.location.href = "/login";
    return;
  }

  const params = new URLSearchParams({
    // client_id là phương án dự phòng khi id_token không còn
    // (Keycloak chấp nhận một trong hai để cho phép post-logout redirect)
    client_id: CLIENT_ID,
    post_logout_redirect_uri: `${window.location.origin}/callback`,
  });
  if (idToken) params.set("id_token_hint", idToken);

  window.location.href = `${oidcBase}/logout?${params}`;
}

// ── Decode user info từ access token ─────────────────────────────

type KcClaims = {
  sub?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  realm_access?: { roles?: string[] };
};

// atob() trả về chuỗi nhị phân 1-byte/ký tự — nếu dùng trực tiếp,
// ký tự Unicode nhiều byte (tiếng Việt có dấu) sẽ bị vỡ font.
// Phải chuyển qua bytes rồi decode UTF-8.
function base64UrlDecode(part: string): Uint8Array {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJwtPayload(token: string): KcClaims {
  const part = token.split(".")[1];
  if (!part) throw new Error("Token không hợp lệ");
  const json = new TextDecoder("utf-8").decode(base64UrlDecode(part));
  return JSON.parse(json) as KcClaims;
}

export function getUserFromToken(): User | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const claims = decodeJwtPayload(token);
    const roles = claims.realm_access?.roles ?? [];
    return {
      id: claims.sub ?? "",
      unionId: claims.sub ?? "",
      username: claims.preferred_username ?? null,
      name: claims.name ?? claims.preferred_username ?? null,
      email: claims.email ?? null,
      avatar: null,
      role: roles.some((r) => r.toLowerCase() === "admin") ? "admin" : "user",
    };
  } catch {
    return null;
  }
}
