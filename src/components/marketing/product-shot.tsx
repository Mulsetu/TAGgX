import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductShot({
  src,
  alt,
  priority = false,
  className,
  caption,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  caption?: string;
}) {
  return (
    <figure className={cn("relative", className)}>
      <div className="overflow-hidden rounded-2xl border border-[#0F6E7A]/12 bg-white shadow-[0_28px_80px_-28px_rgba(7,52,60,0.45)]">
        <div className="flex items-center gap-2 border-b border-[#0F6E7A]/10 bg-[#f4faf8] px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#E57373]" aria-hidden />
          <span className="size-2.5 rounded-full bg-[#FFD54F]" aria-hidden />
          <span className="size-2.5 rounded-full bg-[#81C784]" aria-hidden />
          <span className="ml-2 truncate font-mono text-[11px] text-[#07343C]/40">tagx · workspace</span>
        </div>
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={900}
          className="h-auto w-full"
          priority={priority}
          sizes="(min-width: 1024px) 720px, 100vw"
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-sm text-[#07343C]/60">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
