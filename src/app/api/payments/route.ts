import { NextRequest, NextResponse } from "next/server";

import type { PaymentInput, PaymentMethod, PaymentStatus } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";

function isMethod(v: unknown): v is PaymentMethod {
  return v === "KEKS Pay" || v === "Revolut";
}
function isStatus(v: unknown): v is PaymentStatus {
  return v === "initiated" || v === "paid" || v === "failed";
}

export async function GET() {
  try {
    const storage = StorageService.getInstance();
    const payments = await storage.listPayments();
    return NextResponse.json({ payments });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to list payments." },
      { status: 500 },
    );
  }
}

function isValidAmount(n: unknown): boolean {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body || {}) as Record<string, unknown>;

  if (typeof b.billId !== "string" || !b.billId) {
    return NextResponse.json({ error: "billId is required." }, { status: 400 });
  }
  if (!isValidAmount(b.amount)) {
    return NextResponse.json(
      { error: "amount must be a non-negative number." },
      { status: 400 },
    );
  }
  if (!isMethod(b.method)) {
    return NextResponse.json(
      { error: "method must be 'KEKS Pay' or 'Revolut'." },
      { status: 400 },
    );
  }
  if (typeof b.recipient !== "string" || !b.recipient) {
    return NextResponse.json({ error: "recipient is required." }, { status: 400 });
  }

  const input: PaymentInput = {
    billId: b.billId,
    amount: b.amount as number,
    method: b.method,
    recipient: b.recipient,
    note: typeof b.note === "string" && b.note ? b.note : undefined,
    status: isStatus(b.status) ? b.status : "initiated",
  };

  try {
    const storage = StorageService.getInstance();
    const payment = await storage.createPayment(input);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create payment." },
      { status: 500 },
    );
  }
}
