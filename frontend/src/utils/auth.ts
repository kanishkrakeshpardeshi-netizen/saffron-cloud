export function getAuthHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
  if (match) {
    return { "Authorization": `Bearer ${match[2]}` };
  }
  return {};
}

export function getAuthRole(): string {
  if (typeof document === "undefined") return "user";
  const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
  if (match) {
    try {
      const payload = JSON.parse(atob(match[2].split('.')[1]));
      return payload.role || "user";
    } catch (e) {}
  }
  return "user";
}
