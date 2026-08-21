import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Icon } from "./Icon";
import { useApp } from "@/lib/app-store";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const { user, hydrated, authLoading, login } = useApp();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  useEffect(() => {
    if (hydrated && user) navigate({ to: "/" });
  }, [hydrated, user, navigate]);

  const run = (provider: "telegram" | "google") => {
    void login(provider);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background px-margin-main pb-10 pt-safe-area-top text-on-background antialiased">
      <div className="pointer-events-none fixed -top-24 left-1/2 h-64 w-[420px] -translate-x-1/2 rounded-full bg-primary-container/30 blur-[90px]" />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="gradient-hero mb-stack-lg rounded-[28px] p-6">
          <span className="text-label uppercase text-primary/80">Telegram Mini App</span>
          <h1 className="mt-2 text-display text-on-surface">{isSignup ? "Buat Akun" : "Masuk"}</h1>
          <p className="mt-2 text-body text-on-surface-variant">
            {isSignup
              ? "Daftar sekali, catatan keuangan langsung tersinkron di Telegram."
              : "Lanjutkan mencatat pemasukan dan pengeluaran harian Anda."}
          </p>
        </div>

        <div className="glass-card rounded-[24px] p-5">
          <button
            type="button"
            onClick={() => run("telegram")}
            disabled={authLoading !== null}
            aria-label={isSignup ? "Daftar dengan Telegram" : "Login dengan Telegram"}
            className="gradient-primary flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-on-primary-container shadow-glow disabled:opacity-60"
          >
            {authLoading === "telegram" ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-[20px]" />
                Menghubungkan Telegram...
              </>
            ) : (
              <>
                <Icon name="send" className="text-[20px]" fill={1} />
                {isSignup ? "Daftar dengan Telegram" : "Login dengan Telegram"}
              </>
            )}
          </button>

          <div className="my-4 flex items-center gap-3 text-meta text-on-surface-variant/70">
            <span className="h-px flex-1 bg-outline-variant/30" />
            atau
            <span className="h-px flex-1 bg-outline-variant/30" />
          </div>

          <button
            type="button"
            onClick={() => run("google")}
            disabled={authLoading !== null}
            aria-label={isSignup ? "Daftar dengan Google" : "Login dengan Google"}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-high py-3.5 text-sm font-semibold text-on-surface disabled:opacity-60"
          >
            {authLoading === "google" ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-[20px]" />
                Memverifikasi Google...
              </>
            ) : (
              <>
                <Icon name="g_translate" className="text-[20px]" />
                {isSignup ? "Daftar dengan Google" : "Login via Google"}
              </>
            )}
          </button>

          <p className="mt-5 text-center text-meta text-on-surface-variant/80">
            {isSignup ? (
              <>
                Sudah punya akun?{" "}
                <Link to="/login" className="font-semibold text-primary">
                  Masuk
                </Link>
              </>
            ) : (
              <>
                Belum punya akun?{" "}
                <Link to="/signup" className="font-semibold text-primary">
                  Daftar
                </Link>
              </>
            )}
          </p>
        </div>

        <p className="mt-stack-lg text-center text-meta text-on-surface-variant/60">
          Dengan melanjutkan Anda menyetujui Ketentuan Layanan & Kebijakan Privasi.
        </p>
      </div>
    </div>
  );
}
