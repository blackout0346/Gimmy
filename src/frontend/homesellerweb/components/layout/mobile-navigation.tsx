import Link from "next/link"
import { Heart, House, MessageCircle, Plus, UserRound } from "lucide-react"
import { routes } from "@/lib/routes"

type MobileNavigationProps = {
  authenticated: boolean
  active?: "home" | "favorites" | "create" | "messages" | "profile"
}

export function MobileNavigation({ authenticated, active }: MobileNavigationProps) {
  const items = [
    { id: "home", href: routes.home, label: "Главная", Icon: House },
    { id: "favorites", href: routes.favorites, label: "Избранное", Icon: Heart },
    { id: "create", href: routes.create, label: "Создать", Icon: Plus },
    { id: "messages", href: routes.messages, label: "Чаты", Icon: MessageCircle },
    { id: "profile", href: authenticated ? routes.profile : routes.login, label: "Профиль", Icon: UserRound },
  ]

  return (
    <nav aria-label="Мобильная навигация" className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(64px_+_env(safe-area-inset-bottom))] border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ id, href, label, Icon }) => (
        <Link
          key={id}
          href={href}
          prefetch={false}
          aria-current={active === id ? "page" : undefined}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px]/[14px] font-medium text-muted-foreground aria-[current=page]:text-primary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
        >
          <Icon aria-hidden="true" className="size-[22px]" />{label}
        </Link>
      ))}
    </nav>
  )
}
