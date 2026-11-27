import { tokenStorage } from "@/lib/http"

export const CART_CHANGED_EVENT = "gimmy:cart-changed"

export function notifyCartChanged(token: string | null): void {
  if (typeof window === "undefined" || !token) return
  try {
    if (tokenStorage.get() === token) window.dispatchEvent(new Event(CART_CHANGED_EVENT))
  } catch { /* A notification must not replace the result of the cart request. */ }
}
