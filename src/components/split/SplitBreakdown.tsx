import { Card } from "@/components/ui/Card";
import { FloorResultCard } from "@/components/split/FloorResultCard";
import { PenaltyCard } from "@/components/split/PenaltyCard";
import { SemesterBanner } from "@/components/split/SemesterBanner";
import type { SplitResult } from "@/lib/calc/types";
import { formatEur } from "@/utils/format";

export function SplitBreakdown({ result }: { result: SplitResult }) {
  return (
    <div className="flex flex-col gap-4">
      <SemesterBanner result={result} />

      <PenaltyCard result={result} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FloorResultCard result={result.ground} />
        <FloorResultCard result={result.upper} />
      </div>

      <Card className="flex items-center justify-between">
        <span className="font-medium">Total combined bill</span>
        <span className="text-2xl font-semibold">{formatEur(result.grandTotal)}</span>
      </Card>
    </div>
  );
}
