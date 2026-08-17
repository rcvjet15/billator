import { Card, CardHeader } from "@/components/ui/Card";
import type { FloorResult } from "@/lib/calc/types";
import { formatEur, formatKwh, formatPct } from "@/utils/format";

export function FloorResultCard({ result }: { result: FloorResult }) {
  const isGround = result.floor === "ground";
  return (
    <Card>
      <CardHeader
        title={isGround ? "Ground floor" : "Upper floor"}
        subtitle={
          <span>
            {formatKwh(result.consumption.totalKwh)} · {formatPct(result.consumption.share)} of usage
          </span>
        }
      />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Energy (VT)</dt>
          <dd>{formatEur(result.baseEnergyCostVt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Energy (NT)</dt>
          <dd>{formatEur(result.baseEnergyCostNt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Penalty share</dt>
          <dd className="text-amber-700">{formatEur(result.penaltyShare)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fees &amp; grid</dt>
          <dd>{formatEur(result.fixedCostShare)}</dd>
        </div>
        <div className="col-span-2 border-t border-border pt-2">
          <dt className="text-muted-foreground">Total owed</dt>
          <dd className="text-xl font-semibold">{formatEur(result.totalOwed)}</dd>
        </div>
      </dl>
    </Card>
  );
}
