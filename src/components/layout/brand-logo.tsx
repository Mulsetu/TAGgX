import { TAGX_ICON_SRC, TAGX_LOGO_HEIGHT, TAGX_LOGO_SRC, TAGX_LOGO_WIDTH } from "@/lib/brand";
import { mediaSrc } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function TagXLogo({
  alt = "TagX by Mulsetu",
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
      width={TAGX_LOGO_WIDTH}
      height={TAGX_LOGO_HEIGHT}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ maxHeight: size }}
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
  const custom = mediaSrc(src);
  const resolved = custom ?? (fallback ? (variant === "icon" ? TAGX_ICON_SRC : TAGX_LOGO_SRC) : null);
  if (!resolved) {
    return null;
  }

  const isTagXMark = !custom;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      width={isTagXMark ? TAGX_LOGO_WIDTH : size}
      height={isTagXMark ? TAGX_LOGO_HEIGHT : size}
      className={cn("object-contain", isTagXMark ? "h-auto w-auto" : null, className)}
    />
  );
}
