"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { messengerService } from "@/services/messenger.service"
import { readSession } from "@/lib/session"
import { ApiError } from "@/lib/http"
import { routes } from "@/lib/routes"
import { chatHref, announceChatNavigation } from "@/lib/chat-navigation"
import { Button } from "@/components/ui/button"

export function ContactSellerButton({ product, disabled = false }: { product: ProductsResponse; disabled?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const lock = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function contact() {
    if (lock.current || disabled) return
    const session = readSession()
    const login = () => router.push(`${routes.login}?next=${encodeURIComponent(routes.product(product.id))}`)
    if (!session.token) { login(); return }
    if (session.userId?.toLowerCase() === product.userId.toLowerCase()) { setError("Это ваше объявление."); return }
    lock.current = true
    setPending(true)
    setError("")
    try {
      const chat = await messengerService.getOrCreateChat({ productId: product.id, productName: product.nameProduct, targetUserId: product.userId, initiatorName: session.login || "Покупатель", TargetUserName: product.sellerLogin || "Продавец" })
      if (!chat?.id) throw new Error("Chat ID missing")
      if (!mounted.current) return
      router.push(chatHref(chat.id))
      announceChatNavigation(chat.id)
    } catch (failure) {
      if (!mounted.current) return
      if (failure instanceof ApiError && failure.status === 401) login()
      else setError(failure instanceof ApiError && failure.status >= 400 && failure.status < 500 ? failure.message : "Не удалось открыть чат с продавцом. Попробуйте ещё раз.")
    } finally { lock.current = false; if (mounted.current) setPending(false) }
  }
  return <div className="w-full">
    <Button type="button" size="sm" className="min-h-11 w-full" loading={pending} disabled={disabled} onClick={() => { void contact() }}><span className="whitespace-normal">Обсудить покупку</span></Button>
    {error && <p role="alert" className="mt-2 text-xs/5 text-destructive">{error}</p>}
  </div>
}
