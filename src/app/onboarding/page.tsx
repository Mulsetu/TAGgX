import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { getActivePlansForPublic, getPlanForSignup } from "@/modules/billing/actions";
import { getCurrentUser } from "@/modules/users/actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Create your workspace",
  robots: { index: false, follow: false },
};

interface OnboardingPageProps {
  searchParams: { plan?: string };
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signup");
  }
  if (user.companyId) {
    redirect("/dashboard");
  }

  const plans = await getActivePlansForPublic();
  const cookiePlan = cookies().get("tagx-signup-plan")?.value;
  const selectedPlanId =
    typeof searchParams.plan === "string"
      ? searchParams.plan
      : cookiePlan;
  const selected = selectedPlanId ? await getPlanForSignup(selectedPlanId) : null;

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">
            Step 2 of 2
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your company workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You become the Company Admin for this workspace. Plan limits still apply after setup.
            Signed in as {user.email}.
          </p>
        </div>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Plans are not published yet. Contact Mulsetu to continue.
          </p>
        ) : (
          <OnboardingForm plans={plans} selectedPlanId={selected?.id ?? plans[0]?.id ?? ""} />
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
