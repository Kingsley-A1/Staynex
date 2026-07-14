"use client";

import { useEffect, useMemo, useState } from "react";
import { OptimizedFillImage } from "@/ui";

const LIVE_SLIDES_BEFORE_COVER = 5;
const SLIDE_INTERVAL_MS = 3600;

interface DestinationImageCycleProps {
  city: string;
  fallbackImageUrl: string;
  propertyImageUrls: string[];
}

export function DestinationImageCycle({
  city,
  fallbackImageUrl,
  propertyImageUrls,
}: DestinationImageCycleProps) {
  const slides = useMemo(
    () => buildSlides(propertyImageUrls, fallbackImageUrl),
    [fallbackImageUrl, propertyImageUrls],
  );
  const [index, setIndex] = useState(0);
  const current = slides[index % slides.length] ?? fallbackImageUrl;
  const isLiveProperty = propertyImageUrls.includes(current);

  useEffect(() => {
    setIndex(0);
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <OptimizedFillImage
      key={current}
      src={current}
      alt={isLiveProperty ? `Stay in ${city}` : `${city}, Nigeria`}
      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
      onError={(event) => {
        if (event.currentTarget.dataset.fallback !== "true") {
          event.currentTarget.dataset.fallback = "true";
          event.currentTarget.src = fallbackImageUrl;
        }
      }}
    />
  );
}

function buildSlides(
  propertyImageUrls: string[],
  fallbackImageUrl: string,
): string[] {
  const liveImages = [...new Set(propertyImageUrls.filter(Boolean))];
  if (liveImages.length === 0) return [fallbackImageUrl];

  const liveSlides = Array.from(
    { length: LIVE_SLIDES_BEFORE_COVER },
    (_, index) => liveImages[index % liveImages.length],
  );
  return [...liveSlides, fallbackImageUrl];
}
