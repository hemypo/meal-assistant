"use client";

import { Camera, FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/validation/receipt";
import type { ReceiptDTO } from "@/server/receipts";

type Mode = "PHOTO" | "TEXT";

/**
 * Client-side downscale before upload: cuts mobile-data cost ~4x (master plan
 * §11) and keeps the payload under the 5MB cap.
 */
async function compress(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg" };
}

export function UploadReceiptModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (receipt: ReceiptDTO) => void;
}) {
  const [mode, setMode] = useState<Mode>("PHOTO");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const [payload, setPayload] = useState<{ base64: string; mimeType: string }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setText("");
    setFileName(undefined);
    setPayload(undefined);
    setError(undefined);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(undefined);

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError("Поддерживаются JPEG, PNG, WebP и HEIC");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES * 4) {
      setError("Файл слишком большой");
      return;
    }

    try {
      setPayload(await compress(file));
      setFileName(file.name);
    } catch {
      setError("Не удалось прочитать изображение");
    }
  }

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      const body =
        mode === "PHOTO"
          ? { source: "PHOTO", imageBase64: payload!.base64, mimeType: payload!.mimeType }
          : { source: "TEXT", rawText: text.trim() };

      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Не удалось распознать чек");
      onCreated(result as ReceiptDTO);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось распознать чек");
      setPending(false);
    }
  }

  const canSubmit = mode === "PHOTO" ? Boolean(payload) : text.trim().length > 0;

  return (
    <Modal open={open} onClose={close} title="Новый чек">
      <div className="flex-1 overflow-y-auto p-5">
        <div role="tablist" className="mb-4 flex gap-1 rounded-full bg-muted p-1">
          {(["PHOTO", "TEXT"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-all duration-[160ms]",
                mode === value
                  ? "bg-card text-primary shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {value === "PHOTO" ? (
                <Camera className="h-4 w-4" aria-hidden />
              ) : (
                <FileText className="h-4 w-4" aria-hidden />
              )}
              {value === "PHOTO" ? "Фото" : "Текст"}
            </button>
          ))}
        </div>

        {mode === "PHOTO" ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={onPick}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border px-6 py-10 text-muted-foreground transition-colors duration-[160ms] hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Upload className="h-6 w-6" aria-hidden />
              <span className="text-[15px] font-bold">
                {fileName ?? "Выбрать снимок чека"}
              </span>
              <span className="text-[13px] font-medium">
                JPEG, PNG, WebP или HEIC · до 5 МБ
              </span>
            </button>
          </>
        ) : (
          <>
            <label
              htmlFor="receipt-text"
              className="mb-1.5 block text-[13px] font-semibold text-muted-foreground"
            >
              Текст чека
            </label>
            <textarea
              id="receipt-text"
              autoFocus
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Пятёрочка\n02.08.2026\nМолоко 1 x 89.90\nХлеб 2 x 45.50\nИТОГ 180.90"}
              className="w-full resize-y rounded-[10px] bg-muted px-3.5 py-2.5 text-base font-medium text-foreground placeholder:text-muted-foreground focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring"
            />
          </>
        )}

        {error && (
          <p className="mt-3 text-[13px] font-semibold text-destructive">{error}</p>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="tonal" onClick={close} type="button" disabled={pending}>
          Отмена
        </Button>
        <Button onClick={submit} type="button" disabled={!canSubmit || pending}>
          {pending ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
              Gemini думает…
            </>
          ) : (
            "Распознать"
          )}
        </Button>
      </footer>
    </Modal>
  );
}
