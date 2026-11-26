import { cn } from "cn"
import { Button, buttonVariants } from "@/components/ui/button"

type ContactActionsProps = {
  onMessage: () => void
  pending: boolean
  phone: string | null
  phoneVisible: boolean
  onRevealPhone: () => void
  compact?: boolean
}

export function ContactActions({ onMessage, pending, phone, phoneVisible, onRevealPhone, compact }: ContactActionsProps) {
  return (
    <div className={compact ? "flex w-full items-center gap-2" : "grid gap-2"}>
      <Button type="button" loading={pending} onClick={onMessage} className="min-w-0 flex-1">
        <span className="whitespace-normal text-sm/5">Написать продавцу</span>
      </Button>
      {phone && (phoneVisible ? (
        <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className={cn(buttonVariants({ variant: "secondary" }), "min-w-0 flex-1")}>
          <span className="break-all whitespace-normal text-sm/5">{phone}</span>
        </a>
      ) : (
        <Button type="button" variant="secondary" onClick={onRevealPhone} className="min-w-0 flex-1">
          <span className="whitespace-normal text-sm/5">Показать телефон</span>
        </Button>
      ))}
    </div>
  )
}
