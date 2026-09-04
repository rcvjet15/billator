import { NextRequest, NextResponse } from "next/server";

import type { PaymentStatus } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body || {}) as Record<string, unknown>;
  const patch: { status?: PaymentStatus; note?: string } = {};

  if (
    b.status !== undefined &&
    (b.status === "initiated" || b.status === "paid" || b.status === "failed")
  ) {
    patch.status = b.status as PaymentStatus;
  }
  if (b.note !== undefined) {
    if (typeof b.note !== "string") {
      return NextResponse.json({ error: "note must be a string." }, { status: 400 });
    }
    patch.note = b.note;
  }

  try {
    const storage = StorageService.getInstance();
    const payment = await storage.updatePayment(id, patch);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    return NextResponse.json({ payment });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to update payment." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const storage = StorageService.getInstance();
    const ok = await storage.deletePayment(id);
    if (!ok) {
      return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to delete payment." },
      { status: 500 },
    );
  }
}
