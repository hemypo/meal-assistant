"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn, formatPrice, formatQuantity } from "@/lib/utils";
import type { ReceiptItemDTO } from "@/server/receipts";

/**
 * MASTER.md §5 ReceiptDraftRow. Read mode renders values as buttons with a
 * transparent dashed border (the "editable" affordance); edit mode is an input
 * with autofocus+select, Enter commits, Esc cancels, blur commits, and an
 * invalid value is rejected with a toast rather than silently saved.
 */
function EditableValue({
  value,
  display,
  onCommit,
  onInvalid,
  validate,
  align = "left",
  width,
  label,
}: {
  value: string;
  display: string;
  onCommit: (next: string) => void;
  onInvalid: () => void;
  validate: (raw: string) => boolean;
  align?: "left" | "right";
  width?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (!validate(draft)) {
      onInvalid();
      setDraft(value);
      setEditing(false);
      return;
    }
    onCommit(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        aria-label={label}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          "min-w-0 rounded-lg border-[1.5px] border-primary bg-card px-2 py-1 text-[15px] font-medium outline-none",
          align === "right" && "text-right",
          width,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title={`Изменить: ${label}`}
      className={cn(
        "cursor-pointer truncate rounded-lg border border-dashed border-transparent px-2 py-1 text-[15px] font-medium",
        "transition-colors duration-[160ms] hover:border-border hover:bg-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        align === "right" && "text-right",
        width,
      )}
    >
      {display}
    </button>
  );
}

const isPositiveNumber = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100_000;
};

const isPrice = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 100_000;
};

export function ReceiptDraftRow({
  item,
  edited,
  onChange,
  onRemove,
  onInvalid,
}: {
  item: ReceiptItemDTO;
  edited: boolean;
  onChange: (patch: Partial<ReceiptItemDTO>) => void;
  onRemove: () => void;
  onInvalid: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-[10px] px-1 py-1",
        edited && "bg-muted",
      )}
    >
      <EditableValue
        label="Название"
        value={item.name}
        display={item.name}
        validate={(raw) => raw.trim().length > 0}
        onCommit={(next) => onChange({ name: next.trim() })}
        onInvalid={onInvalid}
        width="flex-1"
      />
      <EditableValue
        label="Количество"
        value={String(item.quantity)}
        display={formatQuantity(item.quantity)}
        validate={isPositiveNumber}
        onCommit={(next) =>
          onChange({ quantity: Number(next.replace(",", ".")) })
        }
        onInvalid={onInvalid}
        align="right"
        width="w-16 tabular"
      />
      <span className="text-[13px] text-muted-foreground">{item.unit}</span>
      <span aria-hidden className="text-[13px] text-muted-foreground">
        ×
      </span>
      <EditableValue
        label="Сумма"
        value={String(item.price)}
        display={formatPrice(item.price)}
        validate={isPrice}
        onCommit={(next) => onChange({ price: Number(next.replace(",", ".")) })}
        onInvalid={onInvalid}
        align="right"
        width="tabular min-w-[86px] font-bold"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Удалить «${item.name}»`}
        title={`Удалить «${item.name}»`}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
