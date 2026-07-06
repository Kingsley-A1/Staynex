import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Staynex Bookings lockup — the `S` mark (logo-main.png) paired with the
 * "Staynex Bookings" wordmark set in the brand typeface (font-brand), which is
 * the closest web match to the lettering in the original logo. Single source of
 * truth for the brand: header, footer, and dashboard chrome all render this.
 *
 * The image is decorative (alt="") because the adjacent text already names the
 * brand for assistive tech; wrapping links carry their own aria-label.
 */
export function Brandmark({
  className,
  iconClassName = "size-8",
  textClassName = "text-lg sm:text-xl",
  priority = false,
}: {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/assets/logo-main.png"
        alt=""
        width={40}
        height={40}
        priority={priority}
        className={cn("w-auto shrink-0 object-contain", iconClassName)}
      />
      <span
        className={cn(
          "font-brand font-bold leading-none tracking-tight whitespace-nowrap",
          textClassName,
        )}
      >
        <span className="text-primary">Staynex</span>{" "}
        <span className="text-ink">Bookings</span>
      </span>
    </span>
  );
}
