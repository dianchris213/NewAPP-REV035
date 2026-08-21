import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { FullScreenModal } from "./FullScreenModal";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { AllTransactionsSheet } from "./AllTransactionsSheet";
import { useApp } from "@/lib/app-store";

const tabs = [
  { to: "/", label: "Beranda", icon: "home" },
  { to: "/analytics", label: "Analitik", icon: "equalizer" },
  { to: "/wallet", label: "Dompet", icon: "account_balance_wallet" },
  { to: "/settings", label: "Pengaturan", icon: "settings" },
] as const;

/** Safe read of the Telegram WebApp user; never throws in a normal browser. */
type TelegramWebAppUser = {
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramGlobal = {
  Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramWebAppUser } } };
};

function useTelegramUser() {
  const [tg, setTg] = useState<{ name?: string; avatar?: string; handle?: string } | null>(null);
  useEffect(() => {
    const u = (globalThis as unknown as TelegramGlobal).Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return;
    const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || undefined;
    setTg({
      ...(name ? { name } : {}),
      ...(u?.photo_url ? { avatar: u.photo_url as string } : {}),
      ...(u?.username ? { handle: `@${u.username}` } : {}),
    });
  }, []);
  return tg;
}

export function TopBar({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  const { user, notifications, unreadCount, markNotificationsRead, updateProfile, profileSaving } =
    useApp();
  const tg = useTelegramUser();
  const [editOpen, setEditOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [avatarDraft, setAvatarDraft] = useState("");
  const [avatarError, setAvatarError] = useState<string | undefined>(undefined);
  const notifRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Notification popover closes on any outside click/tap or Escape.
  useEffect(() => {
    if (!notifOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (notifRef.current?.contains(target) || bellRef.current?.contains(target)) return;
      setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [notifOpen]);

  // Local gallery pick -> data URL preview. Nothing leaves the device.
  const onPickAvatar = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("File harus berupa gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Ukuran gambar maksimal 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarError(undefined);
      setAvatarDraft(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => setAvatarError("Gagal membaca gambar.");
    reader.readAsDataURL(file);
  }, []);

  // The store is the single source of truth once a profile exists: Telegram
  // data is only a fallback while no user is loaded. This keeps the TopBar and
  // every modal in sync instantly, with no duplicated avatar state.
  const displayName = user?.name ?? tg?.name ?? "Pengguna";
  const displayAvatar = user ? user.avatar : tg?.avatar;
  const displayHandle = eyebrow ?? user?.handle ?? tg?.handle ?? "Catatan Keuangan";

  // Keep the open editor's drafts aligned with the store (single source of
  // truth) so an avatar change elsewhere is reflected without duplication.
  useEffect(() => {
    if (!editOpen) return;
    setAvatarDraft(displayAvatar ?? "");
  }, [editOpen, displayAvatar]);

  const openEdit = useCallback(() => {
    setNameDraft(displayName);
    setAvatarDraft(displayAvatar ?? "");
    setAvatarError(undefined);
    setNotifOpen(false);
    setEditOpen(true);
  }, [displayName, displayAvatar]);

  const toggleNotif = useCallback(() => {
    setNotifOpen((v: boolean) => {
      if (!v) markNotificationsRead();
      return !v;
    });
  }, [markNotificationsRead]);

  const submitProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // Optimistic: the store applies the change immediately, the button shows
      // a busy state until the write settles, then the sheet closes.
      const ok = await updateProfile({ name: nameDraft.trim(), avatar: avatarDraft });
      setEditOpen(false);
      if (!ok) {
        toast.info("Tidak ada perubahan profil");
        return;
      }
      toast.success("Profil diperbarui", {
        description: avatarDraft ? "Nama dan foto profil tersimpan." : "Nama profil tersimpan.",
      });
    },
    [nameDraft, avatarDraft, updateProfile],
  );

  return (
    <div className="relative flex items-center justify-between">
      <div className="flex min-h-12 items-center gap-3">
        {/* Only the avatar opens the profile editor; the greeting and name are
            plain text so they never trigger a modal. */}
        <button
          type="button"
          data-testid="profile-button"
          aria-label="Edit foto profil"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.stopPropagation();
            openEdit();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={`Foto profil ${displayName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon name="person" className="text-[20px]" />
          )}
        </button>
        <span className="flex flex-col">
          <span className="text-meta text-on-surface-variant/80">{displayHandle}</span>
          <h1 className="m-0 text-section text-on-surface">{title}</h1>
        </span>
      </div>
      <div className="flex items-center gap-1 text-on-surface-variant">
        {actions ?? (
          <>
            <button
              type="button"
              aria-label="Sinkronisasi"
              className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-surface-variant/60"
            >
              <Icon name="cloud" className="text-[20px]" />
            </button>
            <button
              type="button"
              ref={bellRef}
              data-testid="notification-bell"
              aria-label={unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"}
              aria-expanded={notifOpen}
              onClick={toggleNotif}
              className="relative flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-surface-variant/60"
            >
              <Icon name="notifications" className="text-[20px]" fill={notifOpen ? 1 : 0} />
              {unreadCount > 0 ? (
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-on-error">
                  {unreadCount}
                </span>
              ) : null}
            </button>
          </>
        )}
      </div>

      {notifOpen ? (
        <div
          ref={notifRef}
          data-testid="notification-panel"
          role="dialog"
          aria-label="Notifikasi"
          className="absolute right-0 top-14 z-50 w-[280px] rounded-3xl border border-outline-variant/20 bg-surface-container-high/95 p-2 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-meta font-semibold text-on-surface-variant">Notifikasi</span>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setNotifOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/60"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-2xl px-3 py-2 hover:bg-surface-variant/40">
                <p className="m-0 text-[13px] font-semibold text-on-surface">{n.title}</p>
                <p className="m-0 text-[12px] text-on-surface-variant/80">{n.body}</p>
                <span className="text-[10px] text-on-surface-variant/60">{n.time}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FullScreenModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Profil"
        subtitle="Perbarui nama dan foto profil"
      >
        <form className="flex flex-col gap-4" onSubmit={submitProfile}>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Nama</span>
            <input
              data-testid="profile-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container-high px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-meta text-on-surface-variant/80">Foto Profil</span>
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container-high text-on-surface-variant">
                {avatarDraft ? (
                  <img
                    src={avatarDraft}
                    alt="Pratinjau foto profil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Icon name="person" className="text-[24px]" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label
                  htmlFor="profile-avatar-file"
                  className="text-[12px] font-semibold text-primary"
                >
                  Pilih dari galeri
                </label>
                <input
                  id="profile-avatar-file"
                  type="file"
                  accept="image/*"
                  data-testid="profile-avatar-input"
                  onChange={onPickAvatar}
                  className="text-[12px] text-on-surface-variant file:mr-3 file:rounded-full file:border-0 file:bg-surface-variant file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-on-surface-variant"
                />
                {avatarError ? (
                  <p role="alert" className="m-0 text-[11px] font-semibold text-error">
                    {avatarError}
                  </p>
                ) : (
                  <p className="m-0 text-[11px] text-on-surface-variant/70">
                    Format gambar, maksimal 2 MB.
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            type="submit"
            data-testid="profile-save-button"
            disabled={profileSaving}
            aria-busy={profileSaving}
            className="gradient-primary flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-on-primary-container transition-transform active:scale-95 disabled:opacity-60"
          >
            {profileSaving ? (
              <Icon name="progress_activity" className="animate-spin text-[18px]" />
            ) : null}
            {profileSaving ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        </form>
      </FullScreenModal>
    </div>
  );
}

export function AppShell({ children, topBar }: { children: ReactNode; topBar?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    hydrated,
    user,
    setAddTxOpen,
    transactions,
    allTxOpen,
    setAllTxOpen,
    openCurrentMonth,
    setTxFilters,
    resetTxFilters,
  } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/login" });
  }, [hydrated, user, navigate]);

  // Rapid double-tap guard: ignore a second tap within 400ms so state
  // transitions stay clean.
  const lastTapRef = useRef(0);
  const guard = useCallback((fn: () => void) => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) return;
    lastTapRef.current = now;
    fn();
  }, []);

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      guard(() => setAddTxOpen(true));
    },
    [guard, setAddTxOpen],
  );

  // "Bulan" shortcut: purge every other filter, pin the current month, and
  // open the "Lihat Semua" overlay in one clean transition.
  const handleMonthShortcut = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      guard(() => {
        resetTxFilters();
        setTxFilters({ month: String(new Date().getMonth()) });
        openCurrentMonth();
      });
    },
    [guard, resetTxFilters, setTxFilters, openCurrentMonth],
  );

  const handleCloseAllTx = useCallback(() => setAllTxOpen(false), [setAllTxOpen]);

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-on-background antialiased">
      <div className="pointer-events-none fixed -top-24 left-1/2 h-64 w-[420px] -translate-x-1/2 rounded-full bg-primary-container/25 blur-[90px]" />
      {topBar ? (
        <header className="sticky top-0 z-40 border-b border-outline-variant/15 bg-background/85 px-margin-main pt-safe-area-top pb-3 backdrop-blur-xl">
          {topBar}
        </header>
      ) : null}
      <main className="relative z-10 flex-1 overflow-x-hidden px-margin-main pt-stack-md pb-[136px]">
        {children}
      </main>

      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-0 left-0 z-50 flex h-[72px] w-full items-center justify-around border-t border-outline-variant/15 bg-surface-container-lowest/85 px-gutter-grid pb-safe-area-bottom backdrop-blur-xl"
      >
        {tabs.slice(0, 2).map((t) => (
          <NavItem key={t.to} {...t} active={pathname === t.to} />
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="group -mt-8 flex min-h-12 w-16 flex-col items-center justify-center transition-all active:scale-95"
          aria-label="Tambah transaksi"
        >
          <div className="gradient-primary flex h-14 w-14 items-center justify-center rounded-full text-on-primary-container shadow-glow ring-4 ring-background">
            <Icon name="add" className="text-[28px]" fill={1} />
          </div>
        </button>
        <button
          type="button"
          onClick={handleMonthShortcut}
          aria-label="Transaksi bulan ini"
          aria-haspopup="dialog"
          className="flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 text-on-surface-variant/70 transition-all active:scale-90"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <Icon name="calendar_month" className="text-[22px]" />
          </span>
          <span className="text-[10px] font-semibold tracking-wide">Bulan</span>
        </button>
        {tabs.slice(2).map((t) => (
          <NavItem key={t.to} {...t} active={pathname === t.to} />
        ))}
      </nav>

      <AddTransactionSheet />
      <AllTransactionsSheet open={allTxOpen} onClose={handleCloseAllTx} items={transactions} />
    </div>
  );
}

function NavItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        // Empty/hash anchors must never jump the viewport to the top.
        if (!to || to === "#") e.preventDefault();
        if (active) e.preventDefault();
      }}
      className={`flex min-h-12 w-16 flex-col items-center justify-center gap-1 transition-all active:scale-90 ${
        active ? "text-primary" : "text-on-surface-variant/70"
      }`}
    >
      <span
        className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
          active ? "bg-primary-container/25" : ""
        }`}
      >
        <Icon name={icon} className="text-[22px]" fill={active ? 1 : 0} />
      </span>
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
    </Link>
  );
}
