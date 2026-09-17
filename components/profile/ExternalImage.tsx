"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ExternalImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fallbackText?: string;
}

/**
 * P4 · a third-party photo (AGENTS.md: plain <img>, lazy, no referrer, never next/image) with an honest
 * fallback when the host refuses to serve it. Shared by PhotoCard, EvidenceDialog and FilteredOutTray.
 */
export function ExternalImage({
  src,
  alt,
  className,
  loading = "lazy",
  fallbackText = "Превью не загрузилось",
}: ExternalImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span
        role="img"
        aria-label={`${alt} — изображение не загрузилось`}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 bg-muted p-3 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-5 shrink-0" aria-hidden="true" />
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      ref={(img) => {
        // A server-rendered image can fail before hydration, when onError is not attached yet.
        if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
      }}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
