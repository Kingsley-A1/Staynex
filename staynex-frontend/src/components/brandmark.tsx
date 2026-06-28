import Image from "next/image";

export function Brandmark({
  className = "h-10 w-36",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`relative block ${className}`}>
      <Image
        src="/assets/logo.png"
        alt="Staynex"
        fill
        sizes="144px"
        priority={priority}
        className="object-cover object-center"
      />
    </span>
  );
}
