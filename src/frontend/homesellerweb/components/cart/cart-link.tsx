"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ShoppingCart } from "lucide-react"
import { useCartCount } from "@/providers/CartProvider"
import { routes } from "@/lib/routes"
import { buttonVariants } from "@/components/ui/button"

export function CartLink() {
  const { count, addition } = useCartCount()
  const [animated, setAnimated] = useState(false)
  const seen = useRef(addition)
  useEffect(() => {
    if (addition === seen.current) return
    seen.current = addition
    setAnimated(true)
    const timer = window.setTimeout(() => setAnimated(false), 600)
    return () => window.clearTimeout(timer)
  }, [addition])
  return <Link href={routes.cart} prefetch={false} aria-label={count === null ? "Корзина" : `Корзина, товаров: ${count}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
    <ShoppingCart aria-hidden="true" className={animated ? "motion-safe:animate-bounce" : undefined} />
    {count !== null && count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px]/4 font-semibold text-primary-foreground">{count > 99 ? "99+" : count}</span>}
  </Link>
}
