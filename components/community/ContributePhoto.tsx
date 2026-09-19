"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/lib/config/categories";
import type { CategoryId } from "@/lib/types";
import type { CommunityCheck, PublicCommunityPhoto } from "@/lib/community/types";

export interface UploadOutcome {
  status?: PublicCommunityPhoto["status"];
  checks: CommunityCheck[];
  error?: string;
}

export interface ContributePhotoProps {
  onUpload: (file: File, category: CategoryId, caption: string) => Promise<UploadOutcome>;
}

const RESULT_LABEL: Record<PublicCommunityPhoto["status"], string> = {
  verified_onsite: "Подтверждено съёмкой на месте",
  plausible: "Похоже на настоящее фото, но без подтверждения места",
  rejected: "Не прошло проверку",
  pending_review: "На модерации — зрение сейчас недоступно",
};

/** P1 · community feature · presentational upload form: props/callback in, JSX out (data fetching stays in the container). */
export function ContributePhoto({ onUpload }: ContributePhotoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<CategoryId>("campus");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadOutcome | null>(null);
  const inputId = useId();

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const outcome = await onUpload(file, category, caption);
      setResult(outcome);
      if (outcome.status && outcome.status !== "rejected") {
        setFile(null);
        setCaption("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-input bg-card/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
        >
          <Upload className="size-4" aria-hidden="true" />
          {file ? file.name : "Выбрать фото"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as CategoryId)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.labelRu}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        placeholder="Подпись (необязательно, до 200 символов)"
        maxLength={200}
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        className="min-h-16"
      />
      <Button type="button" size="sm" disabled={!file || busy} onClick={submit} className="gap-2">
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        {busy ? "Проверяем…" : "Загрузить и проверить"}
      </Button>

      {result ? (
        <div className="space-y-1.5 rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">
            {result.status ? RESULT_LABEL[result.status] : (result.error ?? "Не удалось загрузить фото.")}
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {result.checks.map((check) => (
              <li key={check.id} className="flex gap-1.5">
                <span aria-hidden="true">{check.result === "pass" ? "✓" : check.result === "fail" ? "✗" : "?"}</span>
                <span>{check.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
