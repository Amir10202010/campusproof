import { ComponentStub } from "@/components/dev/ComponentStub";
import type { CategoryConfig } from "@/lib/config/categories";
import type { CategoryCoverage, Photo } from "@/lib/types";
import { PhotoCard } from "./PhotoCard";

export interface CategorySectionProps {
  category: CategoryConfig;
  photos: Photo[]; // already filtered for this category
  coverage: CategoryCoverage;
  onOpenPhoto?: (photo: Photo) => void;
}

/** P4 · #3 · title + description from config, counts, grid (2 cols mobile / 4 desktop), honest empty state. */
export function CategorySection(props: CategorySectionProps) {
  return (
    <ComponentStub name="CategorySection" issue={3}>
      <div className="font-medium">
        {props.category.labelRu} · {props.photos.length} фото · {props.coverage.status}
      </div>
      {props.photos.length === 0 ? (
        <div>Нет проверенных фотографий</div>
      ) : (
        props.photos.map((photo) => <PhotoCard key={photo.id} photo={photo} onOpen={props.onOpenPhoto} />)
      )}
    </ComponentStub>
  );
}
