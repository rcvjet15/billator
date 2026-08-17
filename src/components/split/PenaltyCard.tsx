import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import type { SplitResult } from "@/lib/calc/types";
import { formatEur } from "@/utils/format";

export function PenaltyCard({ result }: { result: SplitResult }) {
  const { overage, penaltyCost, energyCostAtBase, energyCostAtPenalty } = result;
  if (!overage.crossed) {
    return (
      <Card>
        <CardHeader
          title="Overage penalty"
          subtitle="Not applied — total within the semester threshold."
        />
        <Badge tone="success">No penalty</Badge>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Overage penalty (35%)"
        subtitle="Split proportionally to each floor&apos;s usage share."
      />
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Energy at base rates</dt>
          <dd className="font-semibold">{formatEur(energyCostAtBase)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">At penalty rate (+{Math.round((overage.penaltyMultiplier - 1) * 100)}%)</dt>
          <dd className="font-semibold">{formatEur(energyCostAtPenalty)}</dd>
        </div>
        <div className="col-span-2 rounded-md bg-amber-50 p-3">
          <dt className="text-amber-800">Penalty surcharge</dt>
          <dd className="text-xl font-semibold text-amber-800">
            +{formatEur(penaltyCost)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
