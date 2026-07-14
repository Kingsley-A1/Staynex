import Image from "next/image";
import type { ReactEventHandler } from "react";

// Host of the media bucket — the one remote origin allowed through the
// next/image optimizer (mirrored in next.config.ts remotePatterns).
const MEDIA_HOST = (() => {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return null;
  }
})();

function isOptimizable(src: string): boolean {
  if (src.startsWith("/")) return true;
  if (!MEDIA_HOST) return false;
  try {
    return new URL(src).host === MEDIA_HOST;
  } catch {
    return false;
  }
}

interface OptimizedFillImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  onError?: ReactEventHandler<HTMLImageElement>;
}

export function OptimizedFillImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
  onError,
}: OptimizedFillImageProps) {
  if (isOptimizable(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        onError={onError}
      />
    );
  }

  // Legacy rows only: URLs attached before uploads were locked to our storage
  // point at foreign hosts the optimizer doesn't allowlist. Render them
  // unoptimized rather than erroring; new uploads never take this path.
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
      onError={onError}
    />
  );
}
