import { notFound } from "next/navigation";
import { sampleProfile } from "@/fixtures/profile.sample";
import { CATEGORIES } from "@/lib/config/categories";
import { devFeaturesEnabled } from "@/lib/devOnly";
import { Badge } from "@/components/ui/badge";

/**
 * DEV/PREVIEW ONLY — P4's workbench. Build components in components/profile/* and render them here
 * against fixtures/profile.sample.ts. Returns 404 in production.
 */
export default function FixturesPage() {
  if (!devFeaturesEnabled) notFound();
  const profile = sampleProfile;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
      <div className="space-y-2">
        <Badge variant="destructive">ФИКСТУРА — ненастоящие данные</Badge>
        <h1 className="text-3xl font-semibold">{profile.entity.name}</h1>
        <p className="text-muted-foreground">
          Страница-песочница для UI. Стрим-реплей:{" "}
          <a className="underline" href="/api/dev/replay">
            /api/dev/replay
          </a>
        </p>
      </div>

      {CATEGORIES.map((category) => {
        const photos = profile.photos.filter((p) => p.category === category.id);
        const coverage = profile.coverage[category.id];
        return (
          <section key={category.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-medium">{category.labelRu}</h2>
              <Badge variant="outline">{coverage.status}</Badge>
            </div>
            {photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет проверенных фотографий</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {photos.map((photo) => (
                  <figure key={photo.id} className="overflow-hidden rounded-lg border">
                    <img src={photo.thumbUrl} alt={photo.title ?? ""} className="aspect-4/3 w-full object-cover" />
                    <figcaption className="space-y-1 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{photo.tier}</Badge>
                        <span className="text-muted-foreground">{photo.points} б.</span>
                      </div>
                      <div className="truncate text-muted-foreground">{photo.sourceDomain}</div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
