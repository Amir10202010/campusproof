"use client";

import Link from "next/link";
import { useState } from "react";

interface Suggestion {
  qid: string;
  name: string;
  city?: string;
  country: string;
  reason: string;
}

const EXAMPLES = [
  "Хочу учиться на IT в Алматы, нужно общежитие",
  "Медицинский вуз в Казахстане с обучением на русском",
  "Сильная инженерная школа в Европе, преподавание на английском",
];

/** Онбординг: абитуриент описывает словами, чего хочет; выбранный вуз уходит в обычный поиск. */
export default function OnboardingPage() {
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(query: string) {
    if (query.trim().length < 3 || loading) return;
    setLoading(true);
    setError(null);
    setPicks(null);
    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: query.trim() }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message ?? "Не удалось подобрать вуз.");
      else setPicks(data.picks ?? []);
    } catch {
      setError("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Не знаете, какой вуз искать?</h1>
        <p className="text-sm text-muted-foreground">
          Опишите своими словами, чего вы хотите — город, направление, язык, важно ли общежитие. Подберём варианты из
          нашего каталога, а дальше откроем по нему обычный проверенный профиль.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(text);
        }}
        className="space-y-3"
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Например: хочу на программиста в Астане, нужно общежитие и обучение на русском"
          className="w-full rounded-md border bg-background p-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example);
                void submit(example);
              }}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {example}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || text.trim().length < 3}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Подбираем…" : "Подобрать вуз"}
        </button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {picks && picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ничего не подобрали. Попробуйте описать запрос иначе.</p>
      ) : null}

      {picks && picks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Подходящие варианты</h2>
          <p className="text-sm text-muted-foreground">
            Подбор делает языковая модель по вашему описанию и нашему каталогу. Это не проверенный факт о вузе —
            проверенные фото с источниками вы увидите в профиле.
          </p>
          <ul className="space-y-3">
            {picks.map((pick) => (
              <li key={pick.qid} className="rounded-lg border p-4">
                <div className="font-medium">{pick.name}</div>
                <div className="text-sm text-muted-foreground">
                  {pick.city ? `${pick.city}, ` : ""}
                  {pick.country}
                </div>
                <p className="mt-2 text-sm">{pick.reason}</p>
                <Link
                  href={`/search?q=${encodeURIComponent(pick.name)}`}
                  className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Открыть проверенный профиль
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
