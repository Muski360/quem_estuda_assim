export function safeReturnTo(value: string | null): string {
  return value === "/scrolla" || value === "/scrolla/progresso" || value === "/perfil" ? value : "/";
}
export function authReturnTo(): string {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (requested) {
    const target = safeReturnTo(requested);
    try { localStorage.setItem("qe:auth-return", target); } catch { /* Password login can use the URL directly. */ }
    return target;
  }
  // Email confirmation can open in another tab of the same browser.
  try { return safeReturnTo(localStorage.getItem("qe:auth-return")); } catch { return "/"; }
}
