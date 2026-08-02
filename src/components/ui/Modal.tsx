"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Native <dialog> gives focus trapping, Esc-to-close and an inert backdrop for
 * free — no dependency needed. MASTER.md §5: desktop centered dialog max-w 640,
 * mobile full-screen sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-label={title}
      className={cn(
        "m-auto w-full max-w-[640px] bg-transparent p-0 text-foreground",
        "backdrop:bg-black/60 open:animate-screen-enter",
        "max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none",
      )}
    >
      <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[18px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
