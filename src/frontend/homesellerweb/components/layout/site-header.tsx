import Link from "next/link"
import { cn } from "cn"
import type { ReactNode } from "react"
import { Heart, MessageCircle, Plus, ShoppingCart, UserRound } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { routes } from "@/lib/routes"
import { NotificationBell } from "@/components/notifications/notification-bell"

type SiteHeaderProps = {
  authenticated: boolean
  search?: ReactNode
  categoryNavigation?: ReactNode
}

export function SiteHeader({ authenticated, search, categoryNavigation }: SiteHeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto grid w-full max-w-[1328px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 md:h-16 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-3 md:px-6 min-[1200px]:h-[72px] min-[1200px]:gap-6">
        <Link href={routes.home} className="flex h-[60px] shrink-0 items-center text-lg/7 font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-xl/7">
          Gimmy<span className="text-primary">.</span>
        </Link>
        <div className="col-start-2 row-start-1 flex items-center gap-2 md:hidden">
          <Link href={routes.cart} prefetch={false} aria-label="Корзина" className={buttonVariants({ variant: "ghost", size: "icon" })}><ShoppingCart aria-hidden="true" /></Link>
          {authenticated && <NotificationBell />}
          <Link href={authenticated ? routes.profile : routes.login} prefetch={false} aria-label={authenticated ? "Профиль" : undefined} className={buttonVariants({ variant: "secondary", size: authenticated ? "icon" : "default" })}>
            {authenticated ? <UserRound aria-hidden="true" /> : "Войти"}
          </Link>
        </div>
        <div
          className={cn(
            "col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1",
            search ? "mb-3 md:mb-0" : "hidden md:block"
          )}
        >
          {search}
        </div>
        <nav aria-label="Действия пользователя" className="hidden items-center gap-1 md:col-start-3 md:row-start-1 md:flex md:justify-self-end min-[1200px]:gap-2">
          <Link href={routes.favorites} prefetch={false} aria-label="Избранное" className={buttonVariants({ variant: "ghost", size: "icon" })}><Heart aria-hidden="true" /></Link>
          <Link href={routes.cart} prefetch={false} aria-label="Корзина" className={buttonVariants({ variant: "ghost", size: "icon" })}><ShoppingCart aria-hidden="true" /></Link>
          <Link href={routes.messages} prefetch={false} aria-label="Сообщения" className={buttonVariants({ variant: "ghost", size: "icon" })}><MessageCircle aria-hidden="true" /></Link>
          {authenticated && <NotificationBell />}
          {authenticated ? (
            <Link href={routes.profile} prefetch={false} aria-label="Профиль" className={buttonVariants({ variant: "ghost", size: "icon" })}><UserRound aria-hidden="true" /></Link>
          ) : (
            <Link href={routes.login} prefetch={false} className={buttonVariants({ variant: "secondary", size: "sm" })}>Войти</Link>
          )}
          <Link href={routes.create} prefetch={false} className={buttonVariants()}>
            <Plus aria-hidden="true" />
            <span className="min-[1200px]:hidden">Подать</span>
            <span className="hidden min-[1200px]:inline">Подать объявление</span>
          </Link>
        </nav>
      </div>
      {categoryNavigation && <div className="border-t border-border">{categoryNavigation}</div>}
    </header>
  )
}
