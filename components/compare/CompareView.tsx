"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EvidenceDialog } from "@/components/profile/EvidenceDialog";
import type { Photo, ResolveResult } from "@/lib/types";
import {
  compareHref,
  savedProfileResult,
  toCompareColumn,
  type CompareSlotLoad,
  type CompareSlotSearch,
  type SavedProfileResult,
} from "@/lib/ui/compare";
import { CompareSlot } from "./CompareSlot";
import { CompareTable } from "./CompareTable";

/**
 * P4 · #38 · /compare container — the only compare component that talks to the API (AGENTS.md exception):
 * GET /api/resolve to pick a university and GET /api/profile/{qid} for its SAVED profile. It never opens an
 * EventSource and never starts the pipeline, so comparing costs no free quota.
 */
async function loadSavedProfile(qid: string, signal: AbortSignal): Promise<SavedProfileResult | null> {
  try {
    const response = await fetch(`/api/profile/${qid}`, { signal });
    const body: unknown = await response.json().catch(() => null);
    return savedProfileResult(response.status, body);
  } catch {
    return signal.aborted ? null : { status: "error" };
  }
}

async function resolveUniversity(query: string): Promise<ResolveResult | null> {
  try {
    const response = await fetch(`/api/resolve?q=${encodeURIComponent(query)}`);
    return response.ok ? ((await response.json()) as ResolveResult) : null;
  } catch {
    return null;
  }
}

function useSavedProfile(qid?: string): CompareSlotLoad {
  const [loaded, setLoaded] = useState<{ qid: string; result: SavedProfileResult } | null>(null);
  useEffect(() => {
    if (!qid) return;
    const controller = new AbortController();
    loadSavedProfile(qid, controller.signal).then((result) => {
      if (result) setLoaded({ qid, result });
    });
    return () => controller.abort();
  }, [qid]);
  if (!qid) return { status: "empty" };
  return loaded?.qid === qid ? loaded.result : { status: "loading" };
}

interface Slot {
  qid?: string;
  name?: string;
  search: CompareSlotSearch;
}

const IDLE: CompareSlotSearch = { status: "idle" };

export function CompareView({ initialA, initialB }: { initialA?: string; initialB?: string }) {
  const [slots, setSlots] = useState<[Slot, Slot]>([
    { qid: initialA, search: IDLE },
    { qid: initialB, search: IDLE },
  ]);
  const loads = [useSavedProfile(slots[0].qid), useSavedProfile(slots[1].qid)] as const;
  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);
  const searchRuns = useRef([0, 0]);

  const setSlot = (index: 0 | 1, slot: Slot) => {
    setSlots((current) => {
      const next: [Slot, Slot] = [...current];
      next[index] = slot;
      return next;
    });
  };

  // Keep the URL shareable: /compare?a=Q…&b=Q… (no navigation, no refetch).
  useEffect(() => {
    window.history.replaceState(null, "", compareHref(slots[0].qid, slots[1].qid));
  }, [slots]);

  const search = async (index: 0 | 1, query: string) => {
    const run = ++searchRuns.current[index];
    setSlot(index, { search: { status: "searching", query } });
    const result = await resolveUniversity(query);
    if (run !== searchRuns.current[index]) return; // a newer search or a pick replaced this one
    if (!result) setSlot(index, { search: { status: "error", query } });
    else if (result.status === "resolved")
      setSlot(index, { qid: result.entity.qid, name: result.entity.name, search: IDLE });
    else if (result.status === "ambiguous")
      setSlot(index, { search: { status: "ambiguous", query, candidates: result.candidates } });
    else setSlot(index, { search: { status: "not_found", query, suggestions: result.suggestions } });
  };

  const pick = (index: 0 | 1, qid: string, name?: string) => {
    searchRuns.current[index]++;
    setSlot(index, { qid, name, search: IDLE });
  };

  const clear = (index: 0 | 1) => {
    searchRuns.current[index]++;
    setSlot(index, { search: IDLE });
  };

  const [left, right] = loads;
  const columns = useMemo(
    () =>
      left.status === "ready" && right.status === "ready"
        ? ([toCompareColumn(left.profile), toCompareColumn(right.profile)] as const)
        : null,
    [left, right],
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="max-w-2xl space-y-3">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
          Сравнение вузов
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          Сравниваем уже сохранённые профили: новые проверки здесь не запускаются. Если профиля ещё нет, откройте его —
          он соберётся примерно за полминуты — и вернитесь.
        </p>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {([0, 1] as const).map((index) => (
          <CompareSlot
            key={index}
            label={index === 0 ? "Первый вуз" : "Второй вуз"}
            qid={slots[index].qid}
            name={slots[index].name}
            search={slots[index].search}
            load={loads[index]}
            onSearch={(query) => search(index, query)}
            onPick={(qid, name) => pick(index, qid, name)}
            onClear={() => clear(index)}
          />
        ))}
      </div>

      {columns ? <CompareTable columns={[columns[0], columns[1]]} onOpenPhoto={setOpenPhoto} /> : null}

      <EvidenceDialog
        photo={openPhoto}
        open={openPhoto !== null}
        onOpenChange={(open) => !open && setOpenPhoto(null)}
      />
    </main>
  );
}
