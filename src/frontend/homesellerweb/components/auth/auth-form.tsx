"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { authService } from "@/services/auth.service"
import { ApiError } from "@/lib/http"
import { routes } from "@/lib/routes"
import { authRedirect } from "@/lib/auth-redirect"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"

type AuthFormProps = { mode: "login" | "register" }

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const registering = mode === "register"
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [registered, setRegistered] = useState(false)
  const [returnTo, setReturnTo] = useState<string>(routes.home)
  const submitting = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setRegistered(!registering && params.get("registered") === "1")
    setReturnTo(authRedirect(params.get("next")))
  }, [registering])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (!login.trim() || !password) {
      setError("Введите логин и пароль.")
      return
    }

    submitting.current = true
    setPending(true)
    setError("")
    try {
      if (!process.env.NEXT_PUBLIC_AUTH_API_URL) throw new Error("Auth API URL is missing")
      const request = { login: login.trim(), password }
      const result = registering
        ? await authService.register(request)
        : await authService.login(request)

      if (!registering && !result.token) {
        setError("Сервер не вернул данные для входа. Попробуйте ещё раз.")
        return
      }
      router.replace(result.token ? returnTo : `${routes.login}?registered=1&next=${encodeURIComponent(returnTo)}`)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401 && !registering) {
        setError("Неверный логин или пароль.")
      } else if (failure instanceof ApiError && failure.status === 409 && registering) {
        setError("Этот логин уже занят. Выберите другой.")
      } else if (failure instanceof ApiError && failure.status === 400) {
        setError(failure.message || "Проверьте логин и пароль. Сервер отклонил введённые данные.")
      } else {
        setError(registering
          ? "Не удалось завершить регистрацию. Попробуйте ещё раз."
          : "Не удалось войти. Проверьте соединение и попробуйте ещё раз.")
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader authenticated={false} />
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:py-12">
        <section aria-labelledby="auth-title" className="w-full max-w-md rounded-[12px] border border-border bg-card p-6 md:p-8">
          <h1 id="auth-title" className="text-2xl/8 font-bold">{registering ? "Регистрация" : "Вход"}</h1>
          <p className="mt-2 text-sm/5 text-muted-foreground">
            {registering ? "Создайте аккаунт, чтобы публиковать объявления и общаться с продавцами." : "Войдите, чтобы сохранять объявления и писать продавцам."}
          </p>

          {registered && <p role="status" className="mt-4 text-sm/5 text-primary">Аккаунт создан. Войдите с вашим логином и паролем.</p>}
          <form onSubmit={submit} aria-busy={pending} className="mt-6 space-y-4">
            <Field>
              <FieldLabel htmlFor="auth-login">Логин</FieldLabel>
              <Input
                id="auth-login"
                name="login"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={login}
                disabled={pending}
                onChange={(event) => setLogin(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="auth-password">Пароль</FieldLabel>
              <Input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                required
                value={password}
                disabled={pending}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={error ? "auth-error" : undefined}
              />
            </Field>
            {error && <p id="auth-error" ref={errorRef} tabIndex={-1} role="alert" className="text-sm/5 text-destructive outline-none">{error}</p>}
            <Button type="submit" loading={pending} className="w-full">
              {registering ? "Создать аккаунт" : "Войти"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm/5 text-muted-foreground">
            {registering ? "Уже есть аккаунт? " : "Нет аккаунта? "}
            <Link href={`${registering ? routes.login : routes.register}${returnTo === routes.home ? "" : `?next=${encodeURIComponent(returnTo)}`}`} className="rounded-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {registering ? "Войти" : "Зарегистрироваться"}
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
