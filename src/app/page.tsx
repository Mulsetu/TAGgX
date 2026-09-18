import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/landing-page";
import { SITE_TITLE } from "@/lib/site";
import { getActivePlansForPublic } from "@/modules/billing/actions";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
};

export default async function Home() {
  const plans = await getActivePlansForPublic();
  return <LandingPage plans={plans} />;
}
