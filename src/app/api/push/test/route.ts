import { NextResponse } from "next/server";

import { sendPush } from "@/lib/push/send";

export async function POST() {
  const sent = await sendPush({
    title: "Billator",
    body: "Test notification — push is working.",
    url: "/",
  });
  return NextResponse.json({ ok: sent });
}
