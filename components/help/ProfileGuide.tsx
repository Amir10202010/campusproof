import { ComponentStub } from "@/components/dev/ComponentStub";

export interface ProfileGuideProps {
  photosCount: number; // photos currently visible after filters
}

/**
 * P4 · #37 · dismissible hint for first-time visitors (dismissal flag in localStorage, access wrapped in try/catch):
 * tier legend (✓ Проверено / ◐ Вероятно / ? Не подтверждено), "нажмите на фото, чтобы увидеть доказательства",
 * link to /how-it-works. Render nothing while photosCount === 0.
 */
export function ProfileGuide(props: ProfileGuideProps) {
  if (props.photosCount === 0) return null;
  return (
    <ComponentStub name="ProfileGuide" issue={37}>
      Как читать профиль: нажмите на фото, чтобы увидеть, почему мы ему доверяем
    </ComponentStub>
  );
}
