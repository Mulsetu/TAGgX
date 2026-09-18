import { handleRazorpayWebhookAction } from "@/modules/billing/actions";

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const rawBody = await request.text();
  const result = await handleRazorpayWebhookAction(rawBody, signature);

  return new Response(null, { status: result.status });
}
