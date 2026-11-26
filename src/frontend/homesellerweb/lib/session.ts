import { tokenStorage } from "@/lib/http"

export type Session = { token: string | null; userId: string | null; login: string }

// Claims are used for presentation only. The backend authorizes each request.
export function readSession(): Session {
  let token: string | null = null
  try {
    token = tokenStorage.get()
    if (!token) return { token, userId: null, login: "" }
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")), (char) => char.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    const userId = claims.sub ?? claims.nameid ?? claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]
    const login = claims.unique_name ?? claims.login ?? claims.name ?? claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"]
    return { token, userId: typeof userId === "string" ? userId : null, login: typeof login === "string" ? login : "" }
  } catch {
    return { token, userId: null, login: "" }
  }
}
