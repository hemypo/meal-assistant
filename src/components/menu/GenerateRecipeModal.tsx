"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { RecipeDTO } from "@/server/recipes";

const EXAMPLES = ["лёгкий ужин", "высокобелковое", "быстро, до 20 минут", "без мяса"];

/** «Шеф-повар Gemini» — generates from what is in stock; wishes are free text. */
export function GenerateRecipeModal({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: (recipe: RecipeDTO) => void;
}) {
  const [wishes, setWishes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  function close() {
    setWishes("");
    setError(undefined);
    setPending(false);
    onClose();
  }

  async function generate() {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/ai/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishes: wishes.trim() || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Не удалось создать рецепт");
      onGenerated(body as RecipeDTO);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать рецепт");
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Шеф-повар Gemini">
      <div className="flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          Рецепт будет составлен из того, что сейчас «В наличии». Пожелания
          необязательны.
        </p>

        <label
          htmlFor="wishes"
          className="mb-1.5 block text-[13px] font-semibold text-muted-foreground"
        >
          Пожелания
        </label>
        <input
          id="wishes"
          autoFocus
          value={wishes}
          onChange={(e) => setWishes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pending) generate();
          }}
          placeholder="лёгкий ужин, высокобелковое"
          className="w-full rounded-[10px] bg-muted px-3.5 py-2.5 text-base font-semibold text-foreground placeholder:font-medium placeholder:text-muted-foreground focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        />

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setWishes(example)}
              className="cursor-pointer rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors duration-[160ms] hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {example}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-[13px] font-semibold text-destructive">{error}</p>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="tonal" onClick={close} type="button" disabled={pending}>
          Отмена
        </Button>
        <Button onClick={generate} disabled={pending} type="button">
          {pending ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
              Gemini думает…
            </>
          ) : (
            <>
              <Sparkles className="h-[18px] w-[18px]" aria-hidden />
              Придумать рецепт
            </>
          )}
        </Button>
      </footer>
    </Modal>
  );
}
