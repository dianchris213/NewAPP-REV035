/**
 * Tagihan Bulanan (monthly billing) domain layer.
 *
 * Pure, framework-free: parsing/validation, money math and the WhatsApp
 * reminder deep link. Kept out of the store and the UI so the bank-grade rules
 * (integer rupiah, clamped percentages, no NaN leaking into totals) are
 * testable in isolation.
 */

export type RecurringInterval = "none" | "weekly" | "monthly" | "yearly";

export type InvoiceTemplate = "minimal" | "professional";

export type DiscountMode = "percent" | "fixed";

export type Bill = {
  id: string;
  name: string;
  /** Base amount in rupiah, integer, > 0. */
  amount: number;
  /** Due date as `YYYY-MM-DD`. */
  dueDate: string;
  /** Tax percentage, 0..100. */
  taxPercent: number;
  discountMode: DiscountMode;
  /** Percentage 0..100 when mode is "percent", otherwise rupiah. */
  discountValue: number;
  recurring: RecurringInterval;
  /** Material Symbols icon name from `BILL_ICONS`. */
  icon: string;
  /** Optional WhatsApp destination in international format, digits only. */
  phone?: string;
  note?: string;
  paid: boolean;
  createdAt: string;
};

/** Curated icon set for bill names, with the keywords that suggest each one. */
export const BILL_ICONS: readonly { name: string; label: string; keywords: string[] }[] = [
  { name: "wifi", label: "Internet / WiFi", keywords: ["internet", "wifi", "indihome", "biznet"] },
  { name: "bolt", label: "Listrik", keywords: ["listrik", "pln", "token"] },
  { name: "water_drop", label: "Air / PDAM", keywords: ["air", "pdam", "water"] },
  { name: "smartphone", label: "Pulsa / Paket data", keywords: ["pulsa", "kuota", "data", "hp"] },
  { name: "live_tv", label: "TV / Streaming", keywords: ["tv", "netflix", "spotify", "streaming", "langganan"] },
  { name: "home", label: "Sewa / Kontrakan", keywords: ["sewa", "kontrakan", "rumah", "kos"] },
  { name: "directions_car", label: "Kendaraan", keywords: ["mobil", "motor", "kendaraan", "parkir"] },
  { name: "credit_card", label: "Kartu kredit / Cicilan", keywords: ["kartu", "kredit", "cicilan", "pinjaman", "angsuran"] },
  { name: "school", label: "Pendidikan", keywords: ["sekolah", "kuliah", "spp", "kursus", "les"] },
  { name: "local_hospital", label: "Kesehatan / Asuransi", keywords: ["bpjs", "asuransi", "kesehatan", "dokter"] },
  { name: "shopping_cart", label: "Belanja", keywords: ["belanja", "groceries", "toko"] },
  { name: "receipt_long", label: "Tagihan lain", keywords: [] },
];

export const DEFAULT_BILL_ICON = "receipt_long";

export function isBillIcon(value: unknown): value is string {
  return typeof value === "string" && BILL_ICONS.some((icon) => icon.name === value);
}

/** Picks the icon whose keywords best match the bill name. */
export function suggestBillIcon(name: unknown): string {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  if (!text) return DEFAULT_BILL_ICON;
  for (const icon of BILL_ICONS) {
    if (icon.keywords.some((keyword) => text.includes(keyword))) return icon.name;
  }
  return DEFAULT_BILL_ICON;
}


export type BillingProfile = {
  businessName: string;
  /** Hex brand color (`#rrggbb`). */
  brandColor: string;
  /** Logo placeholder text / initials. */
  logoText: string;
  template: InvoiceTemplate;
  /** Optional footer / terms line printed on the invoice. */
  footerNote: string;
};

export const RECURRING_LABEL: Record<RecurringInterval, string> = {
  none: "Sekali bayar",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

export const TEMPLATE_LABEL: Record<InvoiceTemplate, string> = {
  minimal: "Minimal",
  professional: "Profesional",
};

export const defaultBillingProfile: BillingProfile = {
  businessName: "",
  brandColor: "#2563eb",
  logoText: "",
  template: "professional",
  footerNote: "",
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isRecurringInterval(value: unknown): value is RecurringInterval {
  return value === "none" || value === "weekly" || value === "monthly" || value === "yearly";
}

export function isInvoiceTemplate(value: unknown): value is InvoiceTemplate {
  return value === "minimal" || value === "professional";
}

/** Clamps to [min,max] and rounds; any non-finite input becomes `min`. */
export function clampNumber(value: unknown, min: number, max: number): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Strict `YYYY-MM-DD` check that also rejects impossible calendar days. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export type BillTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
};

/**
 * Discount first, tax on the discounted base (Indonesian invoicing practice).
 * Every result is a non-negative integer so the displayed grand total can never
 * drift from the persisted one.
 */
export function computeTotals(input: {
  amount: number;
  taxPercent: number;
  discountMode: DiscountMode;
  discountValue: number;
}): BillTotals {
  const subtotal = Math.max(0, Math.round(clampNumber(input.amount, 0, 1e15)));
  const rawDiscount =
    input.discountMode === "percent"
      ? (subtotal * clampNumber(input.discountValue, 0, 100)) / 100
      : clampNumber(input.discountValue, 0, 1e15);
  const discount = Math.min(subtotal, Math.round(rawDiscount));
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * clampNumber(input.taxPercent, 0, 100)) / 100);
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export type BillDraft = {
  name: string;
  amount: string | number;
  dueDate: string;
  taxPercent: string | number;
  discountMode: DiscountMode;
  discountValue: string | number;
  recurring: RecurringInterval;
  icon?: string;
  phone?: string;

  note?: string;
};

export type ParsedBill = Omit<Bill, "id" | "paid" | "createdAt">;

/** Normalizes a phone number to digits (leading `0` → `62`). Empty ⇒ undefined. */
export function normalizePhone(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const digits = input.replace(/\D/g, "");
  if (!digits) return undefined;
  const national = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return national.length >= 8 && national.length <= 15 ? national : undefined;
}

/**
 * Single strict gate for every write into the store. Returns `null` when the
 * draft is not a valid bill, so invalid input can never reach persisted state.
 */
export function parseBillDraft(draft: BillDraft): ParsedBill | null {
  const name = typeof draft.name === "string" ? draft.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 60) return null;
  const amount = Math.round(clampNumber(draft.amount, 0, 1e15));
  if (amount <= 0) return null;
  if (!isIsoDate(draft.dueDate)) return null;
  if (!isRecurringInterval(draft.recurring)) return null;
  const discountMode: DiscountMode = draft.discountMode === "fixed" ? "fixed" : "percent";
  const phone = normalizePhone(draft.phone);
  const note = typeof draft.note === "string" ? draft.note.trim().slice(0, 160) : "";
  return {
    name,
    amount,
    dueDate: draft.dueDate,
    taxPercent: clampNumber(draft.taxPercent, 0, 100),
    discountMode,
    discountValue: clampNumber(draft.discountValue, 0, discountMode === "percent" ? 100 : 1e15),
    recurring: draft.recurring,
    icon: isBillIcon(draft.icon) ? draft.icon : suggestBillIcon(name),

    ...(phone ? { phone } : {}),
    ...(note ? { note } : {}),
  };
}

export function parseBillingProfile(input: unknown): BillingProfile {
  const raw = (input ?? {}) as Partial<BillingProfile>;
  return {
    businessName:
      typeof raw.businessName === "string" ? raw.businessName.trim().slice(0, 60) : "",
    brandColor:
      typeof raw.brandColor === "string" && HEX.test(raw.brandColor)
        ? raw.brandColor.toLowerCase()
        : defaultBillingProfile.brandColor,
    logoText: typeof raw.logoText === "string" ? raw.logoText.trim().slice(0, 4) : "",
    template: isInvoiceTemplate(raw.template) ? raw.template : defaultBillingProfile.template,
    footerNote: typeof raw.footerNote === "string" ? raw.footerNote.trim().slice(0, 120) : "",
  };
}

/** Drops malformed persisted rows instead of rendering broken bills. */
export function normalizeBills(input: readonly unknown[]): Bill[] {
  const out: Bill[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<Bill>;
    const parsed = parseBillDraft({
      name: candidate.name ?? "",
      amount: candidate.amount ?? 0,
      dueDate: candidate.dueDate ?? "",
      taxPercent: candidate.taxPercent ?? 0,
      discountMode: candidate.discountMode === "fixed" ? "fixed" : "percent",
      discountValue: candidate.discountValue ?? 0,
      recurring: isRecurringInterval(candidate.recurring) ? candidate.recurring : "none",
      ...(isBillIcon(candidate.icon) ? { icon: candidate.icon } : {}),

      ...(candidate.phone ? { phone: candidate.phone } : {}),
      ...(candidate.note ? { note: candidate.note } : {}),
    });
    if (!parsed) continue;
    const id =
      typeof candidate.id === "string" && candidate.id && !seen.has(candidate.id)
        ? candidate.id
        : createBillId();
    seen.add(id);
    out.push({
      ...parsed,
      id,
      paid: candidate.paid === true,
      createdAt:
        typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
    });
  }
  return out;
}

let billSeq = 0;
export function createBillId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `b${uuid}`;
  billSeq += 1;
  return `b${Date.now().toString(36)}${billSeq.toString(36)}`;
}

/** Next due date for a recurring bill; `null` when the bill is one-off. */
export function nextDueDate(dueDate: string, recurring: RecurringInterval): string | null {
  if (!isIsoDate(dueDate) || recurring === "none") return null;
  const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
  if (recurring === "weekly") {
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    return next.toISOString().slice(0, 10);
  }
  const months = recurring === "monthly" ? 1 : 12;
  const targetMonth = m - 1 + months;
  const year = y + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = String(Math.min(d, lastDay)).padStart(2, "0");
  return `${year}-${String(month + 1).padStart(2, "0")}-${day}`;
}

export function formatDueDate(dueDate: string): string {
  if (!isIsoDate(dueDate)) return "-";
  const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days until the due date relative to `today` (negative = overdue). */
export function daysUntilDue(dueDate: string, today = new Date()): number {
  if (!isIsoDate(dueDate)) return 0;
  const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
  const due = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - now) / 86_400_000);
}

export type BillStatus = "paid" | "overdue" | "due-soon" | "upcoming";

export function billStatus(bill: Bill, today = new Date()): BillStatus {
  if (bill.paid) return "paid";
  const days = daysUntilDue(bill.dueDate, today);
  if (days < 0) return "overdue";
  return days <= 3 ? "due-soon" : "upcoming";
}

export const STATUS_LABEL: Record<BillStatus, string> = {
  paid: "Lunas",
  overdue: "Terlambat",
  "due-soon": "Segera jatuh tempo",
  upcoming: "Akan datang",
};

function rupiah(value: number): string {
  return `Rp ${Math.abs(Math.round(value)).toLocaleString("id-ID")}`;
}

/**
 * Professionally worded reminder text. Deterministic (no locale surprises) so
 * the message can be snapshot-tested.
 */
export function buildReminderMessage(
  bill: Bill,
  profile: BillingProfile,
  today = new Date(),
): string {
  const totals = computeTotals(bill);
  const days = daysUntilDue(bill.dueDate, today);
  const timing =
    days > 0
      ? `jatuh tempo dalam ${days} hari`
      : days === 0
        ? "jatuh tempo hari ini"
        : `terlambat ${Math.abs(days)} hari`;
  const sender = profile.businessName.trim() || "Tim Keuangan";
  const lines = [
    `Halo, kami dari ${sender}.`,
    "",
    `Pengingat tagihan *${bill.name}* yang ${timing}.`,
    `Jatuh tempo: ${formatDueDate(bill.dueDate)}`,
    `Nominal: ${rupiah(totals.subtotal)}`,
  ];
  if (totals.discount > 0) lines.push(`Diskon: -${rupiah(totals.discount)}`);
  if (totals.tax > 0) lines.push(`Pajak (${bill.taxPercent}%): ${rupiah(totals.tax)}`);
  lines.push(`*Total tagihan: ${rupiah(totals.total)}*`);
  if (bill.recurring !== "none") {
    lines.push(`Siklus: ${RECURRING_LABEL[bill.recurring]}`);
  }
  if (bill.note) lines.push(`Catatan: ${bill.note}`);
  lines.push("", "Mohon lakukan pembayaran sebelum tanggal jatuh tempo. Terima kasih.");
  if (profile.footerNote.trim()) lines.push(profile.footerNote.trim());
  return lines.join("\n");
}

/**
 * Hard cap for the `text` query parameter. WhatsApp silently truncates very
 * long deep links, so we truncate deterministically instead.
 */
export const WHATSAPP_TEXT_LIMIT = 4000;

/**
 * Makes reminder text safe for a URL query parameter: normalizes newlines,
 * strips control/zero-width/bidi characters (which can corrupt or spoof the
 * rendered message), collapses excessive blank lines and caps the length.
 */
export function sanitizeReminderText(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= WHATSAPP_TEXT_LIMIT) return cleaned;
  return `${cleaned.slice(0, WHATSAPP_TEXT_LIMIT - 1).trimEnd()}…`;
}

/**
 * WhatsApp deep link; includes the recipient only when a valid phone exists.
 * The message is sanitized then fully percent-encoded, so no user-typed
 * character (`&`, `#`, `+`, `=`, newline, emoji) can break the URL.
 */
export function buildWhatsAppLink(
  bill: Bill,
  profile: BillingProfile,
  today = new Date(),
): string {
  const text = encodeURIComponent(sanitizeReminderText(buildReminderMessage(bill, profile, today)));
  const phone = normalizePhone(bill.phone);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export type WhatsAppLinkRejection = "malformed" | "protocol" | "host" | "phone" | "text" | "length";

/**
 * Format gate for a built deep link. Used by tests and by any future share
 * surface so a broken/unsafe URL can never be handed to `window.open`.
 */
export function validateWhatsAppLink(
  link: unknown,
): { ok: true; phone: string | null; text: string } | { ok: false; reason: WhatsAppLinkRejection } {
  if (typeof link !== "string" || !link) return { ok: false, reason: "malformed" };
  if (/[\s<>"'`\\]/.test(link)) return { ok: false, reason: "malformed" };
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "protocol" };
  if (url.hostname !== "wa.me") return { ok: false, reason: "host" };
  const path = url.pathname.replace(/^\//, "");
  if (path && !/^\d{8,15}$/.test(path)) return { ok: false, reason: "phone" };
  const text = url.searchParams.get("text");
  if (!text || !text.trim()) return { ok: false, reason: "text" };
  if (text.length > WHATSAPP_TEXT_LIMIT) return { ok: false, reason: "length" };
  return { ok: true, phone: path || null, text };
}


/* ── Nominal (amount) input ──────────────────────────────────────────────── */

/** Digits only, capped at 15 digits. Anything else (`-`, `,`, letters) is dropped. */
export function sanitizeAmountInput(input: unknown): string {
  return String(input ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 15);
}

/** Renders digits with Indonesian thousand separators (`5000` → `5.000`). */
export function formatAmountInput(input: unknown): string {
  const digits = sanitizeAmountInput(input);
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

/** True only for a canonical dotted amount such as `5.000` or `120.000`. */
export function isDottedAmount(value: unknown): boolean {
  return typeof value === "string" && /^\d{1,3}(\.\d{3})*$/.test(value);
}

export type AmountRejection = "empty" | "invalid" | "range";

/**
 * Strict gate for the Nominal field. Rejects empty input, negatives, decimals
 * and special characters instead of silently coercing them to a number.
 */
export function validateAmountInput(
  input: unknown,
): { ok: true; value: number } | { ok: false; reason: AmountRejection } {
  const raw = typeof input === "number" ? String(input) : String(input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (!/^[\d.]+$/.test(raw)) return { ok: false, reason: "invalid" };
  if (raw.includes(".") && !isDottedAmount(raw)) return { ok: false, reason: "invalid" };
  const value = Number(raw.replace(/\./g, ""));
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: "range" };
  if (value > 1e15) return { ok: false, reason: "range" };
  return { ok: true, value };
}

export const AMOUNT_ERROR: Record<AmountRejection, string> = {
  empty: "Nominal wajib diisi.",
  invalid: "Nominal hanya boleh angka dengan format bertitik, mis. 5.000.",
  range: "Nominal harus lebih besar dari 0.",
};
