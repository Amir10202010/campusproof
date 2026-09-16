import { ComponentStub } from "@/components/dev/ComponentStub";
import type { StageState } from "@/lib/client/profileStream";
import type { SourceStatus } from "@/lib/types";

export interface PipelineRailProps {
  stages: StageState[];
  sources: SourceStatus[];
}

/** P4 · #4 · Поиск → Дедупликация → Проверка → Профиль with counts; source chips ok / timeout / error / skipped / simulated_down. */
export function PipelineRail(props: PipelineRailProps) {
  return (
    <ComponentStub name="PipelineRail" issue={4}>
      <div>{props.stages.map((s) => `${s.stage}:${s.status}`).join(" → ")}</div>
      <div>
        {props.sources.map((s) => `${s.source}:${s.status}(${s.candidates})`).join(" · ") ||
          "источники ещё не ответили"}
      </div>
    </ComponentStub>
  );
}
