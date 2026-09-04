"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDateWithTime, formatEur } from "@/utils/format";
import type { Payment } from "@/lib/calc/types";

export default function HistoryPage() {
  const toast = useToast();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { payments } = await api.listPayments();
      setPayments(payments);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { payments } = await api.listPayments();
        if (!cancelled) {
          setPayments(payments);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markPaid = async (p: Payment) => {
    try {
      const { payment } = await api.updatePayment(p.id, { status: "paid" });
      setPayments((list) =>
        list ? list.map((x) => (x.id === payment.id ? payment : x)) : list,
      );
      toast.show("success", "Marked as paid.");
    } catch (err) {
      toast.show("error", (err as Error).message);
    }
  };

  const remove = async (p: Payment) => {
    try {
      await api.deletePayment(p.id);
      setPayments((list) => (list ? list.filter((x) => x.id !== p.id) : list));
      toast.show("success", "Payment removed.");
    } catch (err) {
      toast.show("error", (err as Error).message);
    }
  };

  const tone = (s: Payment["status"]): "success" | "warning" | "danger" =>
    s === "paid" ? "success" : s === "failed" ? "danger" : "warning";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payment history</h1>
          <p className="text-muted-foreground">
            Settlements triggered for the upper-floor split.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!payments && !error && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Spinner className="size-5" /> Loading payments…
        </div>
      )}

      {payments && payments.length === 0 && (
        <p className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          No payments recorded yet. Use the “Pay upper share” button on a reading
          to settle a split.
        </p>
      )}

      {payments && payments.length > 0 && (
        <div className="flex flex-col gap-3">
          {payments.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {formatEur(p.amount)}
                    </span>
                    <Badge tone={tone(p.status)}>{p.status}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDateWithTime(p.createdAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {p.method} → {p.recipient}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  {p.status !== "paid" && (
                    <Button variant="outline" size="sm" onClick={() => void markPaid(p)}>
                      Mark paid
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void remove(p)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
