"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

function ProductPhoto({ src, alt, contain = false }: { src: string; alt: string; contain?: boolean }) {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <span className="flex size-full items-center justify-center gap-2 bg-muted text-sm text-muted-foreground"><ImageOff aria-hidden="true" className="size-5" />Нет фото</span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)} className={cn("size-full", contain ? "object-contain" : "object-cover")} />
  )
}

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)

  function move(offset: number) {
    setIndex((current) => (current + offset + images.length) % images.length)
  }

  return (
    <div className="min-w-0 space-y-3">
      <button
        type="button"
        disabled={!images.length}
        aria-label="Открыть фотографию"
        onClick={() => dialog.current?.showModal()}
        className="block aspect-[4/3] w-full overflow-hidden rounded-[12px] border border-border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {images.length ? (
          <ProductPhoto key={images[index]} src={images[index]} alt={title} contain />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><ImageOff aria-hidden="true" className="size-8" />Нет фото</span>
        )}
      </button>
      {images.length > 1 && (
        <>
          <p role="status" className="text-xs/4 text-muted-foreground">Фото {index + 1} из {images.length}</p>
          <div className="flex gap-2 overflow-x-auto p-0.5">
            {images.map((image, position) => (
              <button
                key={image}
                type="button"
                aria-label={`Фотография ${position + 1}`}
                aria-pressed={index === position}
                onClick={() => setIndex(position)}
                className={cn("h-16 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", index === position ? "border-primary" : "border-border")}
              >
                <ProductPhoto src={image} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        aria-label={`Фотографии объявления «${title}»`}
        onKeyDown={(event) => {
          if (images.length > 1 && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault()
            move(event.key === "ArrowLeft" ? -1 : 1)
          }
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh_-_32px)] w-[calc(100%_-_32px)] max-w-5xl overflow-y-auto rounded-[12px] border border-border bg-card p-3 text-foreground backdrop:bg-foreground/60"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm">Фото {index + 1} из {images.length}</p>
          <Button type="button" size="icon" variant="ghost" aria-label="Закрыть фотографии" onClick={() => dialog.current?.close()}><X /></Button>
        </div>
        {images[index] && <div className="h-[65dvh]"><ProductPhoto key={images[index]} src={images[index]} alt={title} contain /></div>}
        {images.length > 1 && (
          <div className="mt-2 flex justify-center gap-3">
            <Button type="button" variant="secondary" size="icon" aria-label="Предыдущее фото" onClick={() => move(-1)}><ChevronLeft /></Button>
            <Button type="button" variant="secondary" size="icon" aria-label="Следующее фото" onClick={() => move(1)}><ChevronRight /></Button>
          </div>
        )}
      </dialog>
    </div>
  )
}
