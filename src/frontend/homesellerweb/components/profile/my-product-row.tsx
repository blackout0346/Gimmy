"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { ImageOff } from "lucide-react"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { formatProductDate, formatProductPrice, productImageUrl } from "@/components/home/product-display"
import { routes } from "@/lib/routes"

export function MyProductRow({ product, children }: { product: ProductsResponse; children: ReactNode }) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const image = productImageUrl(product.imageURLs?.[0])
  const date = formatProductDate(product.createAt)

  return (
    <article className="flex flex-col gap-4 rounded-[12px] border border-border bg-card p-4 min-[560px]:flex-row min-[560px]:items-center">
      <Link href={routes.product(product.id)} className="flex min-w-0 flex-1 gap-3 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg bg-muted md:w-32">
          {image && failedImage !== image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image)} className="size-full object-cover" />
          ) : <span className="grid size-full place-items-center text-muted-foreground"><ImageOff aria-label="Нет фото" className="size-5" /></span>}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm/5 font-medium">{product.nameProduct || "Объявление"}</span>
          <span className="mt-1 block text-lg/6 font-bold [overflow-wrap:anywhere]">{formatProductPrice(product.price)}</span>
          {date && <span className="mt-2 block text-xs/4 text-muted-foreground">Опубликовано {date}</span>}
        </span>
      </Link>
      <div className="flex shrink-0 flex-wrap gap-2 min-[560px]:max-w-48 min-[560px]:justify-end">{children}</div>
    </article>
  )
}
