import Link from "next/link";
import { CAPABILITIES, LANDING_FAQS, PRODUCT_SHOTS } from "@/components/marketing/content";
import { LandingJsonLd } from "@/components/marketing/json-ld";
import { ProductShot } from "@/components/marketing/product-shot";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { formatInr } from "@/lib/money";
import { MULSETU_PRODUCTS_URL, MULSETU_URL, SITE_NAME, SITE_PARENT, SITE_PRODUCT_LINE } from "@/lib/site";
import type { BillingPlan } from "@/modules/billing/types";

const HERO_STATS = [
  { label: "Live register", value: "QR to record" },
  { label: "Floor audits", value: "Scan as you walk" },
  { label: "Your brand", value: "Logo, colors, slug" },
] as const;

export function LandingPage({ plans }: { plans: BillingPlan[] }) {
  const featuredIndex = plans.length >= 3 ? 1 : 0;
  const heroShot = PRODUCT_SHOTS[0];
  const galleryShots = PRODUCT_SHOTS.slice(1);
  if (!heroShot) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <LandingJsonLd plans={plans} />
      <MarketingHeader />
      <main>
        <section className="marketing-hero relative overflow-hidden">
          <div className="marketing-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">
                {SITE_PRODUCT_LINE} · by {SITE_PARENT}
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-[#07343C] md:text-6xl md:leading-[1.05]">
                See every asset. Scan it. Run the floor from one workspace.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#07343C]/75 md:text-lg">
                {SITE_NAME} is {SITE_PARENT}&apos;s asset management system. Claim a workspace URL,
                print QR tags, and run locations, maintenance, and physical audits the way an
                in-house team would — not a one-off vendor project.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/demo"
                  className="inline-flex h-11 items-center rounded-md bg-[#0F6E7A] px-6 text-sm font-medium text-white hover:bg-[#0c5c66]"
                >
                  Book a demo
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-md border border-[#0F6E7A]/20 px-6 text-sm font-medium text-[#0F6E7A] hover:bg-[#0F6E7A]/5"
                >
                  Sign in
                </Link>
                <Link
                  href="/#product-tour"
                  className="inline-flex h-11 items-center rounded-md px-2 text-sm font-medium text-[#0F6E7A] underline-offset-4 hover:underline"
                >
                  See the product
                </Link>
              </div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-[#0F6E7A]/10 bg-white/80 px-3 py-3">
                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B9E3A]">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold leading-5">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-sm text-[#07343C]/60">
                Already set up?{" "}
                <Link href="/login" className="font-medium text-[#0F6E7A] underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                at your company workspace.
              </p>
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[#0F6E7A]/10 blur-2xl"
                aria-hidden
              />
              <ProductShot src={heroShot.src} alt={heroShot.alt} priority />
              <div className="absolute -bottom-4 left-4 hidden rounded-xl border border-[#0F6E7A]/10 bg-white px-4 py-3 shadow-lg sm:block">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B9E3A]">
                  Dashboard
                </p>
                <p className="text-sm font-semibold">Totals, risk, and work in one view</p>
              </div>
              <div className="absolute -right-2 top-16 hidden rounded-xl border border-[#0F6E7A]/10 bg-white px-4 py-3 shadow-lg md:block">
                <p className="text-2xl font-semibold tracking-tight text-[#0F6E7A]">1,248</p>
                <p className="text-xs text-[#07343C]/60">assets in the register</p>
              </div>
            </div>
          </div>
        </section>

        <section id="product-tour" className="border-t border-[#0F6E7A]/10 bg-[#f4faf8] px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">
              Inside the workspace
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              The screens your team will actually live in
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#07343C]/70 md:text-base">
              Dashboard, register, floor audit, and maintenance — configured per company, branded
              to you, isolated from every other tenant.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {galleryShots.map((shot) => (
                <article key={shot.src} className="flex flex-col gap-4">
                  <ProductShot src={shot.src} alt={shot.alt} />
                  <div>
                    <h3 className="text-lg font-semibold">{shot.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#07343C]/70">{shot.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">
              Core capabilities
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Asset operations built around how your floor actually works
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#07343C]/70 md:text-base">
              {SITE_NAME} is not a generic inventory sheet with a QR plugin. It is the scan, the
              record, the ticket, and the audit — in one tenant-isolated workspace.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((item) => (
                <article key={item.index} className="rounded-xl border border-[#0F6E7A]/10 bg-white p-6">
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#6B9E3A]">{item.index}</p>
                  <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#07343C]/70">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-[#0F6E7A]/10 bg-[#f4faf8] px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">
                How we work with you
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Not a vendor dump. Your team&apos;s system.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#07343C]/70 md:text-base">
                {SITE_PARENT} builds products the way it builds client platforms: long-term,
                branded to you, and owned by the people who use them. {SITE_NAME} follows the same
                model.
              </p>
              <ol className="mt-8 flex flex-col gap-5">
                <li className="border-l-2 border-[#6B9E3A] pl-4">
                  <h3 className="font-semibold">1. Choose a plan</h3>
                  <p className="mt-1 text-sm leading-6 text-[#07343C]/70">
                    Plans are priced by asset volume. Limits and prices can change on the platform —
                    they are not frozen in the product code.
                  </p>
                </li>
                <li className="border-l-2 border-[#6B9E3A] pl-4">
                  <h3 className="font-semibold">2. Claim your workspace URL</h3>
                  <p className="mt-1 text-sm leading-6 text-[#07343C]/70">
                    Pick a unique slug such as <span className="font-mono text-[#0F6E7A]">acme</span>.
                    Everyone in the company signs in at /acme/login.
                  </p>
                </li>
                <li className="border-l-2 border-[#6B9E3A] pl-4">
                  <h3 className="font-semibold">3. White-label it</h3>
                  <p className="mt-1 text-sm leading-6 text-[#07343C]/70">
                    Upload your logo and colors. Login, sidebar, and printed tags show your company.
                  </p>
                </li>
                <li className="border-l-2 border-[#6B9E3A] pl-4">
                  <h3 className="font-semibold">4. Grow without a migration</h3>
                  <p className="mt-1 text-sm leading-6 text-[#07343C]/70">
                    Need more assets later? Buy extra packs from Settings. Same workspace, same
                    tags, no re-onboarding.
                  </p>
                </li>
              </ol>
            </div>
            <ProductShot
              src="/marketing/tagx-asset-register.png"
              alt="TagX asset register in a branded workspace"
              caption="Your register. Your locations. Your statuses."
            />
          </div>
        </section>

        <section className="border-y border-[#0F6E7A]/10 bg-[#07343C] px-4 py-16 text-white md:px-6 md:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8BC34A]">
              Spreadsheet vs {SITE_NAME}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Still counting assets in Excel?
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/50">
                  Traditional tracking
                </h3>
                <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-white/75">
                  <li>Stickers that nobody can look up</li>
                  <li>A shared sheet that drifts from the floor</li>
                  <li>Maintenance history in someone&apos;s inbox</li>
                  <li>Audits that take a week and still miss units</li>
                  <li>No company branding — just another generic tool</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#8BC34A]/40 bg-white/5 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8BC34A]">
                  With {SITE_NAME}
                </h3>
                <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-white/90">
                  <li>Every tag opens the live asset record</li>
                  <li>Locations, photos, and custom fields stay with the asset</li>
                  <li>Tickets and audits sit on the same workspace</li>
                  <li>Roles so technicians and admins see the right screens</li>
                  <li>Your slug, logo, and colors — a {SITE_PARENT} product underneath</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">Pricing</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Plans that follow your asset count
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#07343C]/70 md:text-base">
                Monthly billing through Razorpay. Extra asset packs are available inside the
                workspace when you outgrow the cap.
              </p>
            </div>
            {plans.length === 0 ? (
              <p className="mt-10 text-center text-sm text-[#07343C]/60">
                Plans aren&apos;t published yet. Check back shortly, or{" "}
                <a href={MULSETU_URL} className="text-[#0F6E7A] underline-offset-4 hover:underline" rel="noreferrer" target="_blank">
                  talk to {SITE_PARENT}
                </a>
                .
              </p>
            ) : (
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {plans.map((plan, index) => {
                  const featured = index === featuredIndex;
                  return (
                    <article
                      key={plan.id}
                      className={
                        featured
                          ? "flex flex-col gap-4 rounded-xl border-2 border-[#0F6E7A] bg-white p-6 shadow-lg shadow-[#0F6E7A]/10"
                          : "flex flex-col gap-4 rounded-xl border border-[#0F6E7A]/15 bg-white p-6"
                      }
                    >
                      {featured ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B9E3A]">
                          Most teams start here
                        </p>
                      ) : null}
                      <div>
                        <h3 className="text-xl font-semibold">{plan.name}</h3>
                        {plan.description ? (
                          <p className="mt-1 text-sm text-[#07343C]/65">{plan.description}</p>
                        ) : null}
                      </div>
                      <p className="text-4xl font-semibold tracking-tight">
                        {formatInr(plan.priceMonthly)}
                        <span className="text-sm font-normal text-[#07343C]/55"> / month</span>
                      </p>
                      <ul className="flex flex-col gap-2 text-sm text-[#07343C]/75">
                        <li>Up to {plan.assetLimit.toLocaleString("en-IN")} assets</li>
                        <li>
                          Extra pack: {plan.extraAssetQuantity.toLocaleString("en-IN")} assets for{" "}
                          {formatInr(plan.extraAssetPrice)}
                        </li>
                        <li>Your own slug, logo, and colors</li>
                        <li>QR tags, audits, and maintenance</li>
                      </ul>
                      <Link
                        href={`/signup?plan=${plan.id}`}
                        className={
                          featured
                            ? "mt-auto inline-flex h-10 items-center justify-center rounded-md bg-[#0F6E7A] text-sm font-medium text-white hover:bg-[#0c5c66]"
                            : "mt-auto inline-flex h-10 items-center justify-center rounded-md border border-[#0F6E7A]/20 text-sm font-medium text-[#0F6E7A] hover:bg-[#0F6E7A]/5"
                        }
                      >
                        Get started
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-[#0F6E7A]/10 bg-[#f4faf8] px-4 py-16 md:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">
                Part of the {SITE_PARENT} product family
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                {SITE_NAME} is our asset platform. {SITE_PARENT} is the team behind it.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#07343C]/70">
                The same engineering squads that ship industrial automation, SaaS, and ERP for
                Indian businesses also build and maintain {SITE_NAME}. Your workspace stays{" "}
                {SITE_NAME} — the parent company is {SITE_PARENT}.
              </p>
            </div>
            <a
              href={MULSETU_PRODUCTS_URL}
              className="inline-flex h-10 shrink-0 items-center rounded-md border border-[#0F6E7A]/20 px-4 text-sm font-medium text-[#0F6E7A] hover:bg-white"
              rel="noreferrer"
              target="_blank"
            >
              View {SITE_PARENT} products
            </a>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight">Questions, answered</h2>
            <div className="mt-8 divide-y divide-[#0F6E7A]/10 border-y border-[#0F6E7A]/10">
              {LANDING_FAQS.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="cursor-pointer list-none text-base font-medium marker:content-none">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-[#07343C]/70">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
