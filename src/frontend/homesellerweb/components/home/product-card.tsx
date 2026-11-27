"use client"

import Link from "next/link"
import { useState } from "react"
import { Heart, ImageOff } from "lucide-react"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { homeRoutes } from "./home-routes"
import { formatProductDate, formatProductPrice, productImageUrl } from "./product-display"

type ProductCardProps = {
  product: ProductsResponse
  favorite: boolean
  favoriteDisabled: boolean
  favoritePending: boolean
  onFavorite: (id: string) => void
}

export function ProductCard({ product, favorite, favoriteDisabled, favoritePending, onFavorite }: ProductCardProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const images = (product.imageURLs ?? []).map(productImageUrl).filter((url): url is string => url !== null)
  const image = images[0]
  const date = formatProductDate(product.createAt)

  return (
    <article className="relative flex h-full min-w-0 flex-col rounded-[12px] border border-border bg-card transition-colors duration-150 hover:border-border-strong motion-reduce:transition-none">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-[11px] bg-muted">
        {image && failedImage !== image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailedImage(image)} />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground"><ImageOff aria-hidden="true" size={24} /><span>Нет фото</span></div>
        )}
        
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-[6px] bg-card px-2 py-1 text-xs/4 font-medium text-text-secondary"><span className="sr-only">Количество фотографий </span>{images.length}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[18px]/[24px] font-bold [overflow-wrap:anywhere] md:text-[22px]/[28px]">{formatProductPrice(product.price)}</p>
        <h3 className="mt-1 min-h-10 text-[14px]/[20px] font-medium md:min-h-11 md:text-[15px]/[22px]">
          <Link href={homeRoutes.product(product.id)} prefetch={false} className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-[12px] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
            {product.nameProduct}
          </Link>
        </h3>
        <div className="mt-auto grid gap-1 pt-4 text-[12px]/[16px] text-muted-foreground md:text-[13px]/[18px] [&>p]:truncate">
          {product.position && <p title={product.position}>{product.position}</p>}
          {date && <time dateTime={product.createAt}>{date}</time>}
        </div>
      </div>
      <button
        type="button"
        className="group/favorite absolute right-2 top-2 z-[1] grid size-11 cursor-pointer place-items-center rounded-[10px] aria-pressed:text-primary disabled:cursor-wait disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`${favorite ? "Убрать из избранного" : "Добавить в избранное"} — ${product.nameProduct}`}
        aria-pressed={favorite}
        aria-busy={favoritePending}
        disabled={favoriteDisabled}
        onClick={() => onFavorite(product.id)}
      >
        <span className="grid size-9 place-items-center rounded-[10px] bg-card group-hover/favorite:bg-muted group-aria-pressed/favorite:group-hover/favorite:bg-primary-50 group-aria-pressed/favorite:group-hover/favorite:text-primary-800 group-disabled/favorite:bg-muted group-disabled/favorite:text-muted-foreground">
          <Heart aria-hidden="true" size={20} fill={favorite ? "currentColor" : "none"} />
        </span>
      </button>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="relative flex h-full min-w-0 flex-col rounded-[12px] border border-border bg-card transition-colors duration-150 hover:border-border-strong motion-reduce:transition-none">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-[11px] bg-muted" />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 h-7 w-1/2 rounded bg-muted" />
        <div className="mb-2 h-11 rounded bg-muted" />
        <div className="mt-auto h-[18px] w-3/5 rounded bg-muted" />
        <div className="mt-1 h-[18px] w-3/5 rounded bg-muted" />
      </div>
    </div>
  )
}
