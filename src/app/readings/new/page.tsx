"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { ReadingForm } from "@/components/readings/ReadingForm";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useReadings } from "@/hooks/useReadings";
import type { ReadingInput } from "@/lib/calc/types";

export default function NewReadingPage() {
  const router = useRouter();
  const { add } = useReadings();

  const handleCreate = async (input: ReadingInput) => {
    await add(input);
    router.push("/readings");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New reading</h1>
          <p className="text-muted-foreground">
            Enter the invoice (HEP meter) and/or the upper-floor monitor values.
            You can add one part now and the other later.
          </p>
        </div>
        <Link href="/readings">
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="Reading details" />
        <ReadingForm onSubmit={handleCreate} />
      </Card>
    </div>
  );
}
