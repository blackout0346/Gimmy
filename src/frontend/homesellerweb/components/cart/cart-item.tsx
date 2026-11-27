"use client"

import Link from "next/link"
import { useState } from "react"
import { ImageOff } from "lucide-react"
import { routes } from "@/lib/routes"
import { productImageUrl } from "@/components/home/product-display"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatCartMoney, type CartLine } from "./cart-data"

type CartItemProps = {
  line: CartLine
  disabled: boolean
  removing: boolean
  retrying: boolean
  onRemove: () => void
  onRetry: () => void
}

export function CartItem({ line, disabled, removing, retrying, onRemove, onRetry }: CartItemProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const product = line.state === "ready" ? line.product : null
  const image = productImageUrl(product?.imageURLs?.[0])
  const price = product && Number.isFinite(product.price) && product.price >= 0 ? product.price : null
  const subtotal = price !== null ? Math.round(price * 100) * line.quantity : null

  return (
    <article className="flex flex-col gap-4 rounded-[12px] border border-border bg-card p-4 min-[560px]:flex-row min-[560px]:items-center">
      {product ? (
        <Link href={routes.product(line.productId)} className="flex min-w-0 flex-1 gap-3 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <span className="block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg bg-muted md:w-28">
            {image && failedImage !== image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image)} className="size-full object-cover" />
            ) : <span className="grid size-full place-items-center text-muted-foreground"><ImageOff aria-hidden="true" className="size-5" /><span className="sr-only">Нет фото</span></span>}
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 text-sm/5 font-medium">{product.nameProduct || "Объявление"}</span>
            <span className="mt-1 block text-lg/6 font-bold [overflow-wrap:anywhere]">{price === null ? "Цена недоступна" : price === 0 ? "Цена договорная" : formatCartMoney(price)}</span>
            <span className="mt-1 block text-xs/4 text-muted-foreground">Количество: {line.quantity}</span>
            {line.quantity > 1 && price !== null && price > 0 && subtotal !== null && Number.isSafeInteger(subtotal) && <span className="mt-1 block text-xs/4 text-muted-foreground">За все: {formatCartMoney(subtotal / 100)}</span>}
          </span>
        </Link>
      ) : (
        <div className="min-w-0 flex-1">
          <h2 className="text-base/6 font-semibold">{line.state === "missing" ? "Объявление не найдено" : "Не удалось загрузить объявление"}</h2>
          <p className="mt-1 text-sm/5 text-muted-foreground">{line.state === "missing" ? "Оно могло быть удалено продавцом." : "Попробуйте загрузить его ещё раз."}</p>
          <p className="mt-1 text-xs/4 text-muted-foreground">Количество: {line.quantity}</p>
        </div>
      )}
      <div className="flex shrink-0 flex-wrap gap-2 min-[560px]:max-w-40 min-[560px]:justify-end">
        {line.state === "error" && <Button type="button" variant="secondary" size="sm" disabled={disabled} loading={retrying} onClick={onRetry}>Повторить</Button>}
        {line.state === "error" && <Link href={routes.product(line.productId)} className={buttonVariants({ variant: "text", size: "sm" })}>Открыть</Link>}
        <Button type="button" variant="text" size="sm" disabled={disabled} loading={removing} onClick={onRemove} aria-label={`Убрать из корзины: ${product?.nameProduct || "объявление"}`}>Убрать</Button>
      </div>
    </article>
  )
}
