import { TAGX_ICON_SRC, TAGX_LOGO_SRC } from "@/lib/brand";
import { mediaSrc } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function TagXLogo({
  alt = "TagX",
  size = 160,
  className,
}: {
  alt?: string;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={TAGX_LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
    />
  );
}

export function BrandLogo({
  src,
  alt,
  size,
  className,
  variant = "logo",
  fallback = true,
}: {
  src?: string | null;
  alt: string;
  size: number;
  className?: string;
  variant?: "logo" | "icon";
  fallback?: boolean;
}) {
  const resolved = mediaSrc(src) ?? (fallback ? (variant === "icon" ? TAGX_ICON_SRC : TAGX_LOGO_SRC) : null);
  if (!resolved) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
    />
  );
}
