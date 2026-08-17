"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ReadingForm } from "@/components/readings/ReadingForm";
import { Button, Spinner } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useReadings } from "@/hooks/useReadings";
import { api } from "@/lib/api";
import { formatDate } from "@/utils/format";
import type { Reading, ReadingInput } from "@/lib/calc/types";

export default function EditReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { update } = useReadings();
  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reading } = await api.getReading(id);
        if (!cancelled) setReading(reading);
      } catch {
        // handled via loading fallthrough below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleUpdate = async (rid: string, input: Partial<ReadingInput>) => {
    await update(rid, input);
    router.push(`/readings/${rid}`);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Spinner className="size-5" /> Loading reading…
      </div>
    );
  }

  if (!reading) {
    return <p className="text-red-600">Reading not found.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Edit reading {formatDate(reading.periodStart)} → {formatDate(reading.periodEnd)}
          </h1>
          <p className="text-muted-foreground">
            Re-import the invoice PDF and/or enter the floor monitor readings. The other part stays as-is.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/readings/${reading.id}`}>
            <Button variant="ghost">Details</Button>
          </Link>
          <Link href="/readings">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader title="Reading details" />
        <ReadingForm
          key={`edit-${reading.id}`}
          initial={reading}
          onSubmit={async () => {}}
          onUpdate={handleUpdate}
        />
      </Card>
    </div>
  );
}
