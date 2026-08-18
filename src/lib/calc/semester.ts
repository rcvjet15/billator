import { energyRate } from "@/lib/calc/config";
import type {
  FloorConsumption,
  FloorResult,
  OverageDetail,
  Reading,
  SemesterBlock,
  SplitResult,
  TariffConfig,
} from "@/lib/calc/types";
import {
  prorateReading,
  semesterBlockContaining,
} from "@/utils/dates";

/** Round to a stable money precision to avoid float noise. */
function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The overage (kWh above the semester threshold) that a single block bill must
 * carry, given the running semester total *up to and including* this reading.
 * Once the threshold is crossed the overage grows one-for-one; before crossing
 * it is 0.
 */
function overageForRunningTotal(
  runningTotalKwh: number,
  threshold: number,
): number {
  return Math.max(0, runningTotalKwh - threshold);
}

/**
 * Attribute a shared overage (kWh) onto the VT and NT lines of a tariff group,
 * in proportion to each line's share of that group's total kWh. If there is no
 * consumption, the overage is attributed by a straight split.
 */
function attributeOverageAcrossTariffs(
  overageKwh: number,
  vtKwh: number,
  ntKwh: number,
): { vtOverage: number; ntOverage: number } {
  const total = vtKwh + ntKwh;
  if (total <= 0) {
    return { vtOverage: overageKwh / 2, ntOverage: overageKwh / 2 };
  }
  return {
    vtOverage: overageKwh * (vtKwh / total),
    ntOverage: overageKwh * (ntKwh / total),
  };
}

/** Build the per-floor consumption within a block from prorated readings. */
function aggregateConsumption(
  readings: Reading[],
  block: SemesterBlock,
): { hepVt: number; hepNt: number; upperVt: number; upperNt: number } {
  let hepVt = 0;
  let hepNt = 0;
  let upperVt = 0;
  let upperNt = 0;
  for (const r of readings) {
    const p = prorateReading(
      r.periodStart,
      r.periodEnd,
      r.hepVtKwh,
      r.hepNtKwh,
      r.upperVtKwh,
      r.upperNtKwh,
    );
    const side = block.type === "winter" ? p.winter : p.summer;
    hepVt += side.hepVtKwh;
    hepNt += side.hepNtKwh;
    upperVt += side.upperVtKwh;
    upperNt += side.upperNtKwh;
  }
  return { hepVt, hepNt, upperVt, upperNt };
}

/**
 * The core split & tier engine.
 *
 * For a semester block (Winter Oct 1-Mar 31 / Summer Apr 1-Sep 30), it:
 *  1. prorates any straddling readings into the block by days,
 *  2. computes the running semester kWh total and flags the 3,000 kWh
 *     threshold / overage,
 *  3. applies the 35% penalty on the overage energy,
 *  4. splits the cost proportionally between the ground floor (main HEP
 *     meter, upper extends from it) and the upper floor (its own monitor).
 *
 * `readings` should be all readings that fall in (or straddle) the block,
 * in billing order, so the cumulative threshold crossing is accurate.
 */
export function calculateSplit(
  block: SemesterBlock,
  readings: Reading[],
  tariff: TariffConfig,
): SplitResult {
  const agg = aggregateConsumption(readings, block);

  const hepTotalKwh = agg.hepVt + agg.hepNt;

  // Running total & threshold crossing (sensitive to billing order).
  const runningTotalKwh = hepTotalKwh; // sum of prorated HEP kWh in block
  const overageKwh = overageForRunningTotal(
    runningTotalKwh,
    tariff.overageThresholdKwh,
  );
  // Threshold is "crossed" (at or above 3,000). Penalty applies to the overage.
  const crossed = runningTotalKwh >= tariff.overageThresholdKwh;

  // Energy cost at base rates, per tariff line (whole block).
  const baseVtCost = agg.hepVt * energyRate(tariff, "vt");
  const baseNtCost = agg.hepNt * energyRate(tariff, "nt");
  const energyCostAtBase = baseVtCost + baseNtCost;

  // Penalty: the overage kWh, attributed to VT/NT, priced at the surcharge.
  const { vtOverage, ntOverage } = attributeOverageAcrossTariffs(
    overageKwh,
    agg.hepVt,
    agg.hepNt,
  );
  const baseCostOfOverage =
    vtOverage * energyRate(tariff, "vt") +
    ntOverage * energyRate(tariff, "nt");
  const penalizedCostOfOverage =
    baseCostOfOverage * tariff.overageMultiplier;
  const penaltyCost = penalizedCostOfOverage - baseCostOfOverage;

  // Network & fixed components (excluding energy): transmission, distribution,
  // OIE (renewable), supply fee and metering fee — across the block's months.
  const months = Math.max(1, readings.length);
  const transmissionTotal = hepTotalKwh * tariff.transmissionRate;
  const distributionTotal =
    agg.hepVt * tariff.distributionRateVt + agg.hepNt * tariff.distributionRateNt;
  const oieTotal = hepTotalKwh * tariff.oieRate;
  const supplyTotal = tariff.fixedFee * months;
  const meteringTotal = tariff.meteringFee * months;
  const fixedCostTotal =
    transmissionTotal + distributionTotal + oieTotal + supplyTotal + meteringTotal;

  // Proportional consumption shares for cost splitting.
  const makeConsumption = (
    vtKwh: number,
    ntKwh: number,
    totalBlock: number,
  ): FloorConsumption => {
    const total = vtKwh + ntKwh;
    return {
      vtKwh,
      ntKwh,
      totalKwh: total,
      share: totalBlock > 0 ? total / totalBlock : 0,
    };
  };

  const groundConsumption = makeConsumption(
    Math.max(0, agg.hepVt - agg.upperVt),
    Math.max(0, agg.hepNt - agg.upperNt),
    hepTotalKwh,
  );
  const upperConsumption = makeConsumption(
    agg.upperVt,
    agg.upperNt,
    hepTotalKwh,
  );

  const computeFloor = (
    floor: "ground" | "upper",
    consumption: FloorConsumption,
  ): FloorResult => {
    const baseVt = consumption.vtKwh * energyRate(tariff, "vt");
    const baseNt = consumption.ntKwh * energyRate(tariff, "nt");
    const baseTotal = baseVt + baseNt;
    const penaltyShare = penaltyCost * consumption.share;
    const fixedShare = fixedCostTotal * consumption.share;
    return {
      floor,
      consumption,
      baseEnergyCostVt: money(baseVt),
      baseEnergyCostNt: money(baseNt),
      baseEnergyCostTotal: money(baseTotal),
      penaltyShare: money(penaltyShare),
      fixedCostShare: money(fixedShare),
      totalOwed: money(baseTotal + penaltyShare + fixedShare),
    };
  };

  const ground = computeFloor("ground", groundConsumption);
  const upper = computeFloor("upper", upperConsumption);

  const overage: OverageDetail = {
    crossed,
    runningTotalKwh: money(runningTotalKwh),
    thresholdKwh: tariff.overageThresholdKwh,
    overageKwh: money(overageKwh),
    penaltyMultiplier: tariff.overageMultiplier,
  };

  return {
    semester: block,
    readingsInBlock: readings.length,
    runningTotalKwh: money(runningTotalKwh),
    hepVtKwh: money(agg.hepVt),
    hepNtKwh: money(agg.hepNt),
    overage,
    energyCostAtBase: money(energyCostAtBase),
    energyCostAtPenalty: money(energyCostAtBase + penaltyCost),
    penaltyCost: money(penaltyCost),
    fixedCostTotal: money(fixedCostTotal),
    ground,
    upper,
    grandTotal: money(ground.totalOwed + upper.totalOwed),
  };
}

/**
 * Resolve which semester block a supplied date belongs to, deferring to the
 * dates util so callers (route handlers) don't duplicate block logic.
 */
export function resolveBlock(date: Date | string): SemesterBlock {
  return semesterBlockContaining(
    typeof date === "string" ? new Date(date) : date,
  );
}
