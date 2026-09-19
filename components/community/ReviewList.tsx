"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { REVIEW_ASPECT_LABEL, type PublicCommunityReview } from "@/lib/community/types";

export interface ReviewListProps {
  reviews: PublicCommunityReview[];
  onReport?: (id: string) => void;
}

/** P1 · community feature · presentational: student opinions, explicitly not part of scoring. */
export function ReviewList({ reviews, onReport }: ReviewListProps) {
  const [reported, setReported] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Личное мнение авторов. Мы это не проверяем и в оценку фотографий не включаем.
      </p>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет отзывов.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{REVIEW_ASPECT_LABEL[review.aspect]}</span>
                <span className="flex items-center gap-0.5" aria-label={`Оценка ${review.rating} из 5`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      className={`size-3.5 ${value <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              </div>
              <p>{review.text}</p>
              <button
                type="button"
                disabled={reported.has(review.id)}
                className="text-xs text-muted-foreground underline underline-offset-2 disabled:no-underline disabled:opacity-60"
                onClick={() => {
                  setReported((prev) => new Set(prev).add(review.id));
                  onReport?.(review.id);
                }}
              >
                {reported.has(review.id) ? "Жалоба отправлена" : "Пожаловаться"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
