import { NextResponse } from "next/server";
import { completeEmailCallbackAction } from "@/modules/users/actions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/signup", url.origin));
  }

  const path = await completeEmailCallbackAction(code, url.searchParams.get("next"));
  return NextResponse.redirect(new URL(path, url.origin));
}
