"use client"

import { useState } from "react"

export function HomeHero() {
  const [imageAvailable, setImageAvailable] = useState(true)

  return (
    <section aria-labelledby="home-title" className="mx-auto mt-5 w-full max-w-[1328px] px-4 md:mt-7 md:px-6">
      <div className="grid items-center gap-8 rounded-[16px] bg-primary-50 p-6 md:grid-cols-2 md:p-8 min-[1200px]:gap-12 min-[1200px]:pl-12">
        <div className={imageAvailable ? "" : "md:col-span-2"}>
          <h1 id="home-title" className="text-[30px]/[36px] font-bold [overflow-wrap:anywhere] min-[1200px]:text-[48px]/[54px]">
            Находите нужное.<br />Продавайте своё.
          </h1>
          <p className="mt-4 max-w-[480px] text-sm/6 text-text-secondary min-[1200px]:text-base/6">
            Объявления от людей рядом с вами. Выбирайте предложения и связывайтесь с продавцами напрямую.
          </p>
        </div>
        {imageAvailable && (
          // Temporary hero photo
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1120&h=480&q=85"
            alt=""
            width={560}
            height={240}
            fetchPriority="high"
            onError={() => setImageAvailable(false)}
            className="hidden h-60 w-full rounded-[12px] object-cover md:block"
          />
        )}
      </div>
    </section>
  )
}
