import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Accessible toaster:
 * - `closeButton` gives every toast a keyboard-reachable dismiss control.
 * - `hotkey` (Alt+T) lets keyboard users jump into the toast region on demand;
 *   focus is never moved automatically, so navigation is not disrupted.
 * - Focus is returned to the previously focused control on dismiss/auto-close
 *   by the helpers in `@/lib/toast-a11y`.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      hotkey={["altKey", "KeyT"]}
      containerAriaLabel="Notifikasi"
      toastOptions={{
        closeButton: true,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border focus-visible:ring-2 focus-visible:ring-primary/60",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
