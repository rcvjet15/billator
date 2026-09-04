"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { buildKeksUrl, buildRevolutUrl, buildCopyDetails } from "@/lib/pay/links";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/components/ui/Toast";
import type { Payment, PaymentMethod, Reading } from "@/lib/calc/types";

export interface PaymentModalTarget {
  /** Which reading the "upper share" belongs to. */
  reading: Reading;
  /** Default amount to pay (the reading's upper split estimate). */
  amount: number;
}

interface Props {
  open: boolean;
  target: PaymentModalTarget | null;
  onClose: () => void;
  onRecorded?: (p: Payment) => void;
}

/** Rendered per target (remounts each time `readId` changes) so it starts fresh. */
function PaymentBody({
  target,
  onRecorded,
}: {
  target: PaymentModalTarget;
  onRecorded?: (p: Payment) => void;
}) {
  const { settings } = useSettings();
  const toast = useToast();
  const payments = settings?.payments;

  const [method, setMethod] = useState<PaymentMethod>(payments?.defaultMethod ?? "Revolut");
  const [recipientOverride, setRecipientOverride] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const amount = target.amount;
  const note = `electricity ${target.reading.periodStart.slice(0, 7)} upper`;

  const defaultRecipient =
    method === "KEKS Pay"
      ? (payments?.keksRecipient ?? "")
      : (payments?.revolutUsername ?? "");
  const recipient = recipientOverride || defaultRecipient;

  const link = useMemo(() => {
    if (!payments) return "";
    const params = { amount, note, recipient, settings: payments };
    return method === "Revolut" ? buildRevolutUrl(params) : buildKeksUrl(params);
  }, [amount, note, recipient, payments, method]);

  const record = async (status: "initiated" | "paid") => {
    setSaving(true);
    try {
      const { payment } = await api.createPayment({
        billId: target.reading.id,
        amount,
        method,
        recipient,
        note,
        status,
      });
      onRecorded?.(payment);
    } catch (err) {
      toast.show("error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openLink = async () => {
    if (!link) return;
    await record("initiated");
    window.open(link, "_blank", "noopener");
    toast.show("success", "Payment link opened.");
  };

  const copy = async () => {
    await record("initiated");
    const details = buildCopyDetails({ amount, recipient, note, method });
    try {
      await navigator.clipboard.writeText(link || details);
      setCopied(true);
      toast.show("success", "Copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.show("error", "Could not copy. Open the link instead.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted px-3 py-2 text-center text-2xl font-semibold">
        €{amount.toFixed(2)}
      </div>
      {note && <p className="text-center text-sm text-muted-foreground">{note}</p>}

      <div className="flex gap-2">
        {(["Revolut", "KEKS Pay"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={method === m ? "primary" : "outline"}
            className="flex-1"
            onClick={() => {
              setMethod(m);
              setRecipientOverride("");
            }}
          >
            {m}
          </Button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {method === "Revolut"
            ? "Recipient (Revolut username)"
            : "Recipient (KEKS phone/alias)"}
        </span>
        <input
          type="text"
          value={recipientOverride}
          onChange={(e) => setRecipientOverride(e.target.value)}
          placeholder={defaultRecipient || (method === "Revolut" ? "myhandle" : "09xxxxxxxx")}
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">
          Using: <strong>{recipient || "— none configured"}</strong>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={() => void openLink()} loading={saving}>
          <ExternalLink className="mr-1 size-4" /> Pay with {method}
        </Button>
        <Button variant="outline" onClick={() => void copy()} disabled={saving}>
          {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
          {copied ? "Copied" : "Copy details"}
        </Button>
      </div>
    </div>
  );
}

export function PaymentModal({ open, target, onClose, onRecorded }: Props) {
  return (
    <Modal open={open && !!target} onClose={onClose} title="Pay upper share">
      {target && (
        <PaymentBody
          key={target.reading.id}
          target={target}
          onRecorded={onRecorded}
        />
      )}
    </Modal>
  );
}
