"use client";

import { ReadingForm } from "@/components/readings/ReadingForm";
import { ReadingList } from "@/components/readings/ReadingList";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Button";
import { useReadings } from "@/hooks/useReadings";

export default function ReadingsPage() {
  const { readings, loading, error, add, remove } = useReadings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Monthly readings</h1>
        <p className="text-muted-foreground">
          Enter each month&apos;s HEP meter and upper-floor monitor values.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add a reading</h2>
        <ReadingForm onSubmit={add} />
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
          <ReadingList readings={readings} onDelete={remove} />
        )}
      </div>
    </div>
  );
}
