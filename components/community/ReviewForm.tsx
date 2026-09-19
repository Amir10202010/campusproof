"use client";

import { LoaderCircle, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_REVIEW_LENGTH, MIN_REVIEW_LENGTH } from "@/lib/community/moderateReview";
import { REVIEW_ASPECT_LABEL, type PublicCommunityReview, type ReviewAspect } from "@/lib/community/types";

export interface ReviewOutcome {
  review?: PublicCommunityReview;
  error?: string;
}

export interface ReviewFormProps {
  onSubmit: (aspect: ReviewAspect, rating: number, text: string) => Promise<ReviewOutcome>;
}

/** P1 · community feature · presentational: props/callback in, JSX out. */
export function ReviewForm({ onSubmit }: ReviewFormProps) {
  const [aspect, setAspect] = useState<ReviewAspect>("campus");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (busy || text.trim().length < MIN_REVIEW_LENGTH) return;
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await onSubmit(aspect, rating, text.trim());
      if (outcome.error) setMessage(outcome.error);
      else if (outcome.review?.status === "published") {
        setMessage("Опубликовано.");
        setText("");
      } else {
        setMessage("Отправлено на модерацию — появится после проверки.");
        setText("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-input bg-card/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={aspect}
          onChange={(event) => setAspect(event.target.value as ReviewAspect)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {Object.entries(REVIEW_ASPECT_LABEL).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Оценка">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              onClick={() => setRating(value)}
              className="p-0.5"
            >
              <Star
                className={`size-5 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
      <Textarea
        placeholder={`Ваш отзыв (${MIN_REVIEW_LENGTH}–${MAX_REVIEW_LENGTH} символов)`}
        maxLength={MAX_REVIEW_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-24"
      />
      <Button
        type="button"
        size="sm"
        disabled={text.trim().length < MIN_REVIEW_LENGTH || busy}
        onClick={submit}
        className="gap-2"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        {busy ? "Проверяем…" : "Отправить отзыв"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
