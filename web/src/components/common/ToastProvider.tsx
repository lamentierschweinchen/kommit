"use client";

import * as RadixToast from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export type ToastVariant = "confirmation" | "error";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Optional recovery button label. Errors only. */
  recoveryLabel?: string;
  /** Optional secondary recovery (e.g. "Different method"). Errors only. */
  secondaryLabel?: string;
  onRecover?: () => void;
  onSecondary?: () => void;
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id">) => void;
  confirm: (title: string, description?: string) => void;
  error: (
    title: string,
    description?: string,
    options?: Pick<ToastItem, "recoveryLabel" | "secondaryLabel" | "onRecover" | "onSecondary">,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seedId = useId();

  const remove = useCallback((id: string) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (t) => {
      const id = `${seedId}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((cur) => [{ ...t, id }, ...cur]);
    },
    [seedId],
  );

  const confirm = useCallback<ToastContextValue["confirm"]>(
    (title, description) => toast({ variant: "confirmation", title, description }),
    [toast],
  );

  const error = useCallback<ToastContextValue["error"]>(
    (title, description, options) =>
      toast({ variant: "error", title, description, ...(options ?? {}) }),
    [toast],
  );

  const value = useMemo(() => ({ toast, confirm, error }), [toast, confirm, error]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {items.map((t) => (
          <ToastItemView key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
        <RadixToast.Viewport
          className={cn(
            "fixed z-[100] outline-none",
            "bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0",
            "flex flex-col gap-3 max-w-[calc(100vw-2rem)] sm:max-w-md",
          )}
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

// Per audit spec (handoff 30): confirmation toasts auto-dismiss in 4s; errors
// persist until the user dismisses. Radix's docs say `Infinity` makes a toast
// persistent, but on Vercel's runtime that magic value sometimes leaks back into
// the confirmation timer state — using finite values is the reliable form.
// 24h = "effectively persistent" for the error variant.
const CONFIRM_DURATION_MS = 4000;
const ERROR_DURATION_MS = 24 * 60 * 60 * 1000;

function ToastItemView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const isError = item.variant === "error";
  return (
    <RadixToast.Root
      duration={isError ? ERROR_DURATION_MS : CONFIRM_DURATION_MS}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={cn(
        "relative bg-white border-[3px] border-black p-5 flex items-start gap-4",
        "data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
        isError ? "shadow-brutal" : "shadow-brutal-green",
      )}
    >
      {isError ? (
        <span
          className="material-symbols-outlined text-black mt-0.5 shrink-0 filled"
          aria-hidden
        >
          error
        </span>
      ) : (
        <span
          className="material-symbols-outlined text-black shrink-0 bg-secondary border-[2px] border-black w-9 h-9 flex items-center justify-center filled"
          aria-hidden
        >
          check
        </span>
      )}
      <div className="flex-1 min-w-0">
        <RadixToast.Title className="font-epilogue font-black uppercase text-sm tracking-tight leading-snug">
          {item.title}
        </RadixToast.Title>
        {item.description ? (
          <RadixToast.Description className="font-medium text-sm text-gray-700 mt-1">
            {item.description}
          </RadixToast.Description>
        ) : null}
        {(item.recoveryLabel || item.secondaryLabel) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {item.recoveryLabel ? (
              <RadixToast.Action altText={item.recoveryLabel} asChild>
                <button
                  onClick={() => {
                    item.onRecover?.();
                    onClose();
                  }}
                  className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
                >
                  {item.recoveryLabel}
                </button>
              </RadixToast.Action>
            ) : null}
            {item.secondaryLabel ? (
              <button
                onClick={() => {
                  item.onSecondary?.();
                  onClose();
                }}
                className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              >
                {item.secondaryLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <RadixToast.Close
        aria-label="Dismiss"
        className="shrink-0 w-7 h-7 flex items-center justify-center border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </RadixToast.Close>
    </RadixToast.Root>
  );
}
