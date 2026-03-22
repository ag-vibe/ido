import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { signInMutation, signUpMutation } from "@/api-anclax/@tanstack/react-query.gen";
import { getToken, setAuthSession } from "@/lib/auth";

type AuthMode = "sign-in" | "sign-up";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (getToken()) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = Route.useNavigate();

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const signIn = useMutation(signInMutation());
  const signUp = useMutation(signUpMutation());

  const isSubmitting = signIn.isPending || signUp.isPending;
  const activeError = signIn.error ?? signUp.error;

  const title = useMemo(
    () => (mode === "sign-in" ? "Welcome back" : "Create your account"),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "sign-in"
        ? "A silky, focused flow for your daily priorities."
        : "Start clean, then glide into your work rhythm.",
    [mode]
  );

  const submitLabel =
    mode === "sign-in"
      ? isSubmitting
        ? "Signing in..."
        : "Sign in"
      : isSubmitting
        ? "Creating..."
        : "Create account";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !password) return;

    const result =
      mode === "sign-in"
        ? await signIn.mutateAsync({ body: { name: trimmedName, password } })
        : await signUp.mutateAsync({ body: { name: trimmedName, password } });

    setAuthSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: result.tokenType,
    });

    void navigate({ to: "/" });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-(--bg-base) px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[rgba(191,170,140,0.22)] blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[rgba(164,143,121,0.20)] blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-2xl border border-[rgba(179,161,136,0.45)] bg-[rgba(248,245,238,0.78)] p-6 shadow-[0_30px_80px_rgba(44,38,31,0.14)] backdrop-blur-sm sm:p-8">
        <p className="mb-2 text-[11px] tracking-[0.22em] text-[rgba(99,88,72,0.75)] uppercase">
          flodo authentication
        </p>
        <h1 className="text-2xl font-medium text-(--sea-ink)">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-(--sea-ink-soft)">{subtitle}</p>

        <div className="mt-6 grid grid-cols-2 rounded-xl border border-[rgba(179,161,136,0.45)] bg-[rgba(250,247,241,0.85)] p-1">
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className={`rounded-lg px-3 py-2 text-sm transition ${mode === "sign-in"
                ? "bg-(--sea-ink) text-[rgba(255,251,243,0.95)]"
                : "text-(--sea-ink-soft) hover:text-(--sea-ink)"
              }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className={`rounded-lg px-3 py-2 text-sm transition ${mode === "sign-up"
                ? "bg-(--sea-ink) text-[rgba(255,251,243,0.95)]"
                : "text-(--sea-ink-soft) hover:text-(--sea-ink)"
              }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-(--sea-ink-soft)">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="username"
              placeholder="test"
              className="w-full rounded-xl border border-[rgba(179,161,136,0.5)] bg-[rgba(255,252,247,0.86)] px-3.5 py-2.5 text-sm text-(--sea-ink) outline-none transition placeholder:text-[rgba(139,129,115,0.95)] focus:border-[rgba(109,93,72,0.78)] focus:ring-2 focus:ring-[rgba(109,93,72,0.15)]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-(--sea-ink-soft)">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              placeholder="test"
              className="w-full rounded-xl border border-[rgba(179,161,136,0.5)] bg-[rgba(255,252,247,0.86)] px-3.5 py-2.5 text-sm text-(--sea-ink) outline-none transition placeholder:text-[rgba(139,129,115,0.95)] focus:border-[rgba(109,93,72,0.78)] focus:ring-2 focus:ring-[rgba(109,93,72,0.15)]"
            />
          </label>

          {activeError && (
            <p className="rounded-lg border border-[rgba(214,95,95,0.35)] bg-[rgba(247,223,223,0.5)] px-3 py-2 text-xs text-[rgba(140,52,52,0.95)]">
              {activeError instanceof Error
                ? activeError.message
                : "Authentication failed. Please try again."}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-(--sea-ink) px-4 py-2.5 text-sm text-[rgba(255,251,243,0.95)] shadow-[0_10px_24px_rgba(44,38,31,0.24)] transition hover:-translate-y-px hover:shadow-[0_14px_32px_rgba(44,38,31,0.28)] disabled:translate-y-0 disabled:opacity-70"
          >
            {submitLabel}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-(--sea-ink-soft)">
          Dev default in README: use name/password as test/test.
        </p>
      </section>
    </main>
  );
}
