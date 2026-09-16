import { ComponentStub } from "@/components/dev/ComponentStub";
import type { ProfileFact, UniversityEntity } from "@/lib/types";

export interface ProfileHeaderProps {
  entity: UniversityEntity | null;
  facts: ProfileFact[];
  startedAt: number | null; // live timer starts here
  finishedMs: number | null; // null while streaming
  cached: boolean;
  generatedAt?: string; // for the "saved profile" badge
  originalTotalMs?: number; // how long the cached profile originally took
  distanceToCityCenterM?: number;
  onRefresh?: () => void;
}

/**
 * P4 · #4 · name, city/country, website, facts with source links, LIVE timer (tick every 100 ms while
 * finishedMs is null), badge "Сохранённый профиль · создан … за … с · Обновить" when cached,
 * "≈ N км до центра по прямой".
 */
export function ProfileHeader(props: ProfileHeaderProps) {
  return (
    <ComponentStub name="ProfileHeader" issue={4}>
      <div className="text-base font-semibold">{props.entity?.name ?? "Ищем университет…"}</div>
      <div>
        {props.finishedMs === null ? "Идёт поиск…" : `Готово за ${(props.finishedMs / 1000).toFixed(1)} с`}
        {props.cached ? " · сохранённый профиль" : ""}
      </div>
    </ComponentStub>
  );
}
