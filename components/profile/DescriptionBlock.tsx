import { ComponentStub } from "@/components/dev/ComponentStub";
import type { Description } from "@/lib/types";

export interface DescriptionBlockProps {
  description: Description | null;
  ready: boolean; // false → skeleton while the description is being written
}

/** P4 · #4 · text with clickable [n] citation markers → source links; skeleton while !ready; hide when null. */
export function DescriptionBlock(props: DescriptionBlockProps) {
  return (
    <ComponentStub name="DescriptionBlock" issue={4}>
      {!props.ready ? "Описание готовится…" : (props.description?.text ?? "Нет надёжных текстовых источников")}
    </ComponentStub>
  );
}
