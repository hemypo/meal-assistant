"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/**
 * MASTER.md §5 Toast: --inverse-bg pill, radius-full, bottom-centered,
 * fade-up 220ms, auto-dismiss ~2600ms, above the nav on mobile.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message }]);
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      2600,
    );
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 lg:bottom-7"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-toast-in max-w-[calc(100vw-32px)] rounded-full bg-inverse-bg px-4 py-2.5 text-sm font-semibold text-inverse-fg shadow-soft"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
