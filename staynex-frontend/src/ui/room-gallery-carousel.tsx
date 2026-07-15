"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { OptimizedFillImage } from "./optimized-fill-image";

export interface GallerySlide {
  id: string;
  url?: string | null;
  mediaType?: "IMAGE" | "VIDEO";
  altText?: string | null;
}

export function RoomGalleryCarousel({
  slides,
  label = "Room gallery",
}: {
  slides: GallerySlide[];
  label?: string;
}) {
  const [index, setIndex] = useState(0);
  const items: GallerySlide[] = slides.length ? slides : [{ id: "empty" }];
  const total = items.length;
  const go = (next: number) => setIndex((next + total) % total);

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-800">
        {items.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-300",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            {slide.url && slide.mediaType === "VIDEO" ? (
              <video
                src={slide.url}
                controls
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
                aria-label={slide.altText ?? "Property video"}
              />
            ) : slide.url ? (
              <OptimizedFillImage
                src={slide.url}
                alt={slide.altText ?? ""}
                sizes="(min-width: 1280px) 720px, (min-width: 1024px) 60vw, calc(100vw - 2rem)"
                priority={i === 0}
                quality={88}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-sm text-white/80">
                No media yet
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous media"
            className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-surface-raised/90 text-lg text-ink shadow-md"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next media"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-surface-raised/90 text-lg text-ink shadow-md"
          >
            ›
          </button>
          <div className="mt-3 flex justify-center gap-1.5">
            {items.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to media ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>
        </>
      )}

      <p className="sr-only" aria-live="polite">
        Media {index + 1} of {total}
      </p>
    </div>
  );
}
