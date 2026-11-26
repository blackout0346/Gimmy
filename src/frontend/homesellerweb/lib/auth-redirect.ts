import { routes } from "@/lib/routes"

export function authRedirect(value: string | null): string {
  if (!value?.startsWith("/")) return routes.home
  try {
    const url = new URL(value, "https://local.invalid")
    if (url.origin !== "https://local.invalid" || [routes.login, routes.register].includes(url.pathname)) return routes.home
    return url.pathname + url.search + url.hash
  } catch {
    return routes.home
  }
}
