"use client"

import type { ChangeEvent } from "react"
import { ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export type ProductPhotoDraft = {
  file: File
  previewUrl: string
  uploadedUrl?: string
}

type ProductPhotoPickerProps = {
  photos: ProductPhotoDraft[]
  disabled: boolean
  onAdd: (files: File[]) => void
  onRemove: (previewUrl: string) => void
  onCover: (previewUrl: string) => void
}

export function ProductPhotoPicker({ photos, disabled, onAdd, onRemove, onCover }: ProductPhotoPickerProps) {
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    onAdd(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  return (
    <div className="space-y-4">
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-border bg-background p-4 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring has-[:disabled]:cursor-wait">
        <ImagePlus aria-hidden="true" className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">Выбрать фотографии</span>
        <input
          type="file"
          multiple
          accept="image/*"
          aria-label="Выбрать фотографии объявления"
          disabled={disabled}
          onChange={chooseFiles}
          className="sr-only"
        />
      </label>

      {photos.length > 0 && (
        <>
          <p className="text-xs/4 text-muted-foreground">Первая фотография — обложка объявления.</p>
          <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3">
            {photos.map((photo, index) => (
              <li key={photo.previewUrl} className="min-w-0 space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={`Фотография ${index + 1}`} className="size-full object-cover" />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    disabled={disabled}
                    aria-label={`Удалить фотографию ${index + 1}`}
                    onClick={() => onRemove(photo.previewUrl)}
                    className="absolute top-1 right-1"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                {index === 0 ? (
                  <p className="text-xs/4 text-muted-foreground">Обложка</p>
                ) : (
                  <Button type="button" size="sm" variant="text" disabled={disabled} onClick={() => onCover(photo.previewUrl)}>
                    Сделать обложкой
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
