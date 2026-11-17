export function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")
    || /[\\\x00-\x20]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://local.test");
    if (url.origin !== "https://local.test") return "/dashboard";
    if (url.pathname !== "/dashboard" && !url.pathname.startsWith("/dashboard/")
      && !url.pathname.startsWith("/invite/")) return "/dashboard";
    return `${url.pathname}${url.search}`;
  } catch { return "/dashboard"; }
}
