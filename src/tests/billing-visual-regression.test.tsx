/**
 * Visual regression baselines (DOM style contract) for BillingCalendar and
 * BillingSheet in their focus/hover states.
 *
 * jsdom cannot rasterise pixels, so the snapshot pins what a screenshot would
 * catch: the utility classes that produce the focus ring / hover fill, the
 * active-selection flags (aria-checked, data-day, tabIndex roving) and where
 * focus actually lands. Baselines are refreshed after the Nominal (amount)
 * formatting change and the icon-picker addition.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/lib/app-store";
import { BillingCalendar } from "@/components/BillingCalendar";
import { BillingSheet } from "@/components/BillingSheet";
import type { Bill } from "@/lib/billing";

const TODAY = new Date("2026-03-08T00:00:00Z");

const BILLS: Bill[] = [
  {
    id: "b1",
    name: "Internet Rumah",
    amount: 300_000,
    dueDate: "2026-03-10",
    taxPercent: 11,
    discountMode: "percent",
    discountValue: 10,
    recurring: "monthly",
    icon: "wifi",
    paid: false,
    createdAt: "2026-03-01T00:00:00.000Z",
  },
];

/** Style contract of a single control: what a pixel diff would notice. */
function styleOf(el: HTMLElement) {
  return {
    tag: el.tagName.toLowerCase(),
    testId: el.dataset["testid"] ?? null,
    role: el.getAttribute("role"),
    className: el.className,
    ariaChecked: el.getAttribute("aria-checked"),
    ariaSelected: el.parentElement?.getAttribute("aria-selected") ?? null,
    tabIndex: el.tabIndex,
    dataDay: el.dataset["day"] ?? null,
    focused: document.activeElement === el,
    hovered: el.matches(":hover"),
  };
}

describe("Visual regression — BillingCalendar focus/hover", () => {
  it("keeps the selected-day highlight, roving tabindex and focus ring stable", async () => {
    const user = userEvent.setup();
    render(<BillingCalendar bills={BILLS} today={TODAY} />);

    const selected = screen.getByTestId("billing-day-2026-03-08");
    const due = screen.getByTestId("billing-day-2026-03-10");

    expect(styleOf(selected)).toMatchSnapshot("calendar-day-selected");
    expect(styleOf(due)).toMatchSnapshot("calendar-day-idle");

    await user.hover(due);
    expect(styleOf(due)).toMatchSnapshot("calendar-day-hover");

    due.focus();
    expect(styleOf(due)).toMatchSnapshot("calendar-day-focus");

    // Only one day is reachable with Tab (WAI-ARIA grid pattern).
    const stops = screen
      .getAllByRole("button")
      .filter((b) => b.dataset["testid"]?.startsWith("billing-day-") && b.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it("keeps the month navigation focus ring stable", async () => {
    const user = userEvent.setup();
    render(<BillingCalendar bills={BILLS} today={TODAY} />);

    const prev = screen.getByTestId("billing-calendar-prev");
    const next = screen.getByTestId("billing-calendar-next");
    await user.hover(prev);
    prev.focus();
    expect(styleOf(prev)).toMatchSnapshot("calendar-prev-focus-hover");
    next.focus();
    expect(styleOf(next)).toMatchSnapshot("calendar-next-focus");
  });
});

describe("Visual regression — BillingSheet focus/hover", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function openSheet() {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <BillingSheet onClose={() => {}} />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("billing-sheet")).toBeInTheDocument());
    return user;
  }

  it("keeps the icon picker active/idle states and focus ring stable", async () => {
    const user = await openSheet();

    const idle = screen.getByTestId("billing-icon-wifi");
    const active = screen.getByTestId("billing-icon-receipt_long");
    expect(styleOf(active)).toMatchSnapshot("icon-active");
    expect(styleOf(idle)).toMatchSnapshot("icon-idle");

    await user.hover(idle);
    expect(styleOf(idle)).toMatchSnapshot("icon-hover");

    await user.click(idle);
    await waitFor(() => expect(idle).toHaveAttribute("aria-checked", "true"));
    expect(styleOf(idle)).toMatchSnapshot("icon-toggled-active");
    expect(active).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the Nominal field layout stable across value, focus and error states", async () => {
    const user = await openSheet();
    const amount = screen.getByTestId("billing-amount") as HTMLInputElement;

    amount.focus();
    expect(styleOf(amount)).toMatchSnapshot("amount-focus-empty");

    await user.type(amount, "1250000");
    expect(amount.value).toBe("1.250.000");
    expect(styleOf(amount)).toMatchSnapshot("amount-focus-filled");
    expect(screen.getByTestId("billing-total-grand").textContent).toMatchSnapshot("amount-total");

    await user.clear(amount);
    await user.tab();
    await waitFor(() => expect(screen.getByTestId("billing-amount-error")).toBeInTheDocument());
    expect(styleOf(amount)).toMatchSnapshot("amount-error");
    expect(amount).toHaveAttribute("aria-describedby", "billing-amount-error");
  });

  it("keeps the submit button and summary layout stable on hover/focus", async () => {
    const user = await openSheet();
    const submit = screen.getByTestId("billing-submit");
    await user.hover(submit);
    submit.focus();
    expect(styleOf(submit)).toMatchSnapshot("submit-focus-hover");
    expect(screen.getByTestId("billing-summary").className).toMatchSnapshot("summary-layout");
  });
});
