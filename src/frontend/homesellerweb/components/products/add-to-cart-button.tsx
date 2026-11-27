"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart } from "lucide-react"
import { cartService } from "@/services/cart.service"
import { ApiError } from "@/lib/http"
import { routes } from "@/lib/routes"
import { cartContains } from "@/components/cart/cart-data"
import { Button, buttonVariants } from "@/components/ui/button"

export function AddToCartButton({ productId, token }: { productId: string; token: string | null }) {
  const router = useRouter()
  const [inCart, setInCart] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [retry, setRetry] = useState(0)
  const mounted = useRef(false)
  const lock = useRef(false)
  const version = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; version.current += 1 }
  }, [])

  useEffect(() => {
    let cancelled = false
    version.current += 1
    setInCart(false)
    setChecked(false)
    setPending(false)
    setError("")
    setNotice("")
    setNeedsLogin(false)
    if (!token) { setChecking(false); return }
    setChecking(true)
    cartService.getCart()
      .then((cart) => {
        if (cancelled) return
        setInCart(cartContains(cart, productId))
        setChecked(true)
      })
      .catch((failure) => {
        if (cancelled) return
        if (failure instanceof ApiError && failure.status === 401) setNeedsLogin(true)
        else setError("Не удалось проверить корзину. Повторите загрузку.")
      })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [productId, token, retry])

  function login() {
    router.push(`${routes.login}?next=${encodeURIComponent(routes.product(productId))}`)
  }

  async function add() {
    if (!token || needsLogin) { login(); return }
    if (lock.current || checking || !checked) return
    lock.current = true
    const currentVersion = version.current
    const active = () => mounted.current && currentVersion === version.current
    setPending(true)
    setError("")
    let submitted = false
    try {
      // Recheck before adding: another tab may already contain this product.
      const current = await cartService.getCart()
      if (!active()) return
      if (!cartContains(current, productId)) {
        submitted = true
        await cartService.addToCart({ productId, quantity: 1 })
      }
      if (active()) { setInCart(true); setNotice("Товар в корзине.") }
    } catch (failure) {
      if (!active()) return
      if (failure instanceof ApiError && failure.status === 401) { login(); return }
      if (submitted) {
        // A request can fail after the server saves the product. Confirm before retrying.
        try {
          const current = await cartService.getCart()
          if (!active()) return
          if (cartContains(current, productId)) {
            setInCart(true)
            setNotice("Товар в корзине.")
            return
          }
        } catch {
          if (!active()) return
        }
      }
      setChecked(false)
      setError(failure instanceof ApiError && failure.status >= 400 && failure.status < 500
        ? failure.message
        : "Не удалось подтвердить добавление. Проверьте корзину или повторите её загрузку.")
    } finally {
      lock.current = false
      if (active()) setPending(false)
    }
  }

  return (
    <div className="mt-3">
      {inCart ? (
        <Link href={routes.cart} className={`${buttonVariants({ variant: "soft" })} w-full`}><ShoppingCart aria-hidden="true" />В корзине — открыть</Link>
      ) : (
        <Button type="button" variant="secondary" className="w-full" loading={pending || checking} disabled={Boolean(token && !checked && !needsLogin)} onClick={() => { void add() }}>
          <ShoppingCart aria-hidden="true" />В корзину
        </Button>
      )}
      <p role="status" className="sr-only">{notice}</p>
      {error && <div role="alert" className="mt-2 text-sm/5 text-destructive">
        <p>{error}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="text" size="sm" disabled={pending || checking} onClick={() => setRetry((value) => value + 1)}>Повторить загрузку</Button>
          <Link href={routes.cart} className={buttonVariants({ variant: "text", size: "sm" })}>Открыть корзину</Link>
        </div>
      </div>}
    </div>
  )
}
