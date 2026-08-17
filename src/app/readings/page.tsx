"use client";

import { useState } from "react";

import { ReadingForm } from "@/components/readings/ReadingForm";
import { ReadingList } from "@/components/readings/ReadingList";
import { Card } from "@/components/ui/Card";
import { Button, Spinner } from "@/components/ui/Button";
import { useReadings } from "@/hooks/useReadings";
import { formatDate } from "@/utils/format";
import type { Reading, ReadingInput } from "@/lib/calc/types";

export default function ReadingsPage() {
  const { readings, loading, error, add, update, remove } = useReadings();
  const [editing, setEditing] = useState<Reading | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Monthly readings</h1>
        <p className="text-muted-foreground">
          Enter each month&apos;s HEP meter and upper-floor monitor values. You
          can add the invoice one day and the floor monitor readings another.
        </p>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {editing ? "Continue reading" : "Add a reading"}
          </h2>
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          )}
        </div>
        <ReadingForm
          key={editing?.id ?? "new"}
          initial={editing ?? undefined}
          onSubmit={add}
          onUpdate={update as (id: string, input: Partial<ReadingInput>) => Promise<unknown>}
        />
        {editing && (
          <p className="mt-2 text-xs text-muted-foreground">
            Editing {formatDate(editing.periodStart)} → {formatDate(editing.periodEnd)}. Only the fields
            you change are updated; the other part stays as-is.
          </p>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        {loading ? (
          <Card className="flex items-center justify-center py-12 text-muted-foreground">
            <Spinner className="size-6" /> &nbsp; Loading…
          </Card>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 text-red-800">{error}</Card>
        ) : (
          <ReadingList
            readings={readings}
            onDelete={remove}
            onContinue={(r) => {
              setEditing(r);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </div>
    </div>
  );
}
