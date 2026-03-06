//\client\src\utils/authStorage.js

export const TOKEN_KEYS = ["accessToken", "token", "access_token"];
export const TYPE_KEYS = ["userType", "user_type"];

export function getToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function getUserType() {
  for (const k of TYPE_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function clearAuth() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
  for (const k of TYPE_KEYS) localStorage.removeItem(k);
}