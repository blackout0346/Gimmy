"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { cartService } from "@/services/cart.service"
import { ApiError, tokenStorage } from "@/lib/http"
import { CART_CHANGED_EVENT } from "@/lib/cart-events"
import { cartPositions } from "@/components/cart/cart-data"

const CartContext = createContext<{ count: number | null; addition: number }>({ count: null, addition: 0 })
export function useCartCount() { return useContext(CartContext) }

export function CartProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const [count, setCount] = useState<number | null>(null)
  const [addition, setAddition] = useState(0)
  const previous = useRef<number | null>(null)
  useEffect(() => {
    let cancelled = false
    let version = 0
    previous.current = null
    setCount(null)
    if (!token) return
    const ownerToken = token
    async function refresh() {
      const current = ++version
      try {
        if (tokenStorage.get() !== ownerToken) return
        const cart = await cartService.getCart()
        const quantity = cartPositions(cart).reduce((sum, item) => sum + item.quantity, 0)
        if (!Number.isSafeInteger(quantity)) throw new Error("Invalid cart count")
        if (cancelled || current !== version || tokenStorage.get() !== ownerToken) return
        if (previous.current !== null && quantity > previous.current) setAddition((value) => value + 1)
        previous.current = quantity
        setCount(quantity)
      } catch (failure) {
        if (!cancelled && current === version && failure instanceof ApiError && failure.status === 401) {
          previous.current = null
          setCount(null)
        }
      }
    }
    function changed() { void refresh() }
    function focus() { void refresh() }
    void refresh()
    window.addEventListener(CART_CHANGED_EVENT, changed)
    window.addEventListener("focus", focus)
    return () => { cancelled = true; version += 1; window.removeEventListener(CART_CHANGED_EVENT, changed); window.removeEventListener("focus", focus) }
  }, [token])
  return <CartContext.Provider value={{ count, addition }}>{children}</CartContext.Provider>
}
