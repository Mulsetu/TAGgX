import type { CSSProperties, ReactNode } from "react";
import { TAGX_LOGO_TRANSPARENT_HEIGHT, TAGX_LOGO_TRANSPARENT_SRC, TAGX_LOGO_TRANSPARENT_WIDTH } from "@/lib/brand";
import { companyShellStyle } from "@/lib/color";

/**
 * Shared frame for every standalone sign-in style page (tenant + admin
 * login, forgot/reset password, invite): a slightly darker, brand-tinted
 * page with the form on a light card in the middle — the classic login
 * layout. `style` carries a company's colours (companyShellStyle); it
 * defaults to the TagX brand so --brand-primary is always defined.
 */
export function AuthShell({
  logo,
  title,
  subtitle,
  children,
  style,
  showPoweredBy = true,
}: {
  logo: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  showPoweredBy?: boolean;
}) {
  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-100 bg-[radial-gradient(ellipse_at_top,hsl(var(--brand-primary)/0.10),transparent_60%)] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
      style={style ?? companyShellStyle(null, null)}
    >
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {logo}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--brand-primary))]">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex flex-col items-center [&>form]:max-w-none">{children}</div>
      </section>
      {showPoweredBy ? (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Powered by</span>
          {/* Transparent, trimmed wordmark so no white box shows on the tinted page. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={TAGX_LOGO_TRANSPARENT_SRC}
            alt="TagX by Mulsetu"
            width={TAGX_LOGO_TRANSPARENT_WIDTH}
            height={TAGX_LOGO_TRANSPARENT_HEIGHT}
            className="h-12 w-auto sm:h-14"
          />
        </div>
      ) : null}
    </main>
  );
}
