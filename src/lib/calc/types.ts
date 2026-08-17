export type TariffCode = "vt" | "nt";

export type SemesterType = "winter" | "summer";

export interface SemesterBlock {
  type: SemesterType;
  year: number;
  start: Date;
  end: Date;
  label: string;
}

export interface Reading {
  id: string;
  periodStart: string;
  periodEnd: string;
  hepVtKwh: number;
  hepNtKwh: number;
  hepTotalSupply: number;
  hepFees: number;
  hepGrandTotal: number;
  upperVtKwh: number;
  upperNtKwh: number;
  createdAt: string;
  updatedAt: string;
  /** Optional reference to the invoice PDF that produced this reading. */
  sourcePdfId?: string;
  sourcePdfName?: string;
}

export interface ReadingInput {
  periodStart: string;
  periodEnd: string;
  hepVtKwh: number;
  hepNtKwh: number;
  hepTotalSupply: number;
  hepFees: number;
  hepGrandTotal: number;
  upperVtKwh: number;
  upperNtKwh: number;
  sourcePdfId?: string;
  sourcePdfName?: string;
}

export interface TariffConfig {
  energyRateVt: number;
  energyRateNt: number;
  overageMultiplier: number;
  overageThresholdKwh: number;
  fixedFee: number;
  gridFeeRate: number;
  vatRate: number;
}

/** A reading split into the two semester blocks it touches, with prorated kWh. */
export interface ProratedSplit {
  readingId?: string;
  periodStart: string;
  periodEnd: string;
  winter: {
    fraction: number;
    hepVtKwh: number;
    hepNtKwh: number;
    upperVtKwh: number;
    upperNtKwh: number;
  };
  summer: {
    fraction: number;
    hepVtKwh: number;
    hepNtKwh: number;
    upperVtKwh: number;
    upperNtKwh: number;
  };
}

export interface FloorConsumption {
  vtKwh: number;
  ntKwh: number;
  totalKwh: number;
  share: number;
}

export interface FloorResult {
  floor: "ground" | "upper";
  consumption: FloorConsumption;
  baseEnergyCostVt: number;
  baseEnergyCostNt: number;
  baseEnergyCostTotal: number;
  penaltyShare: number;
  fixedCostShare: number;
  totalOwed: number;
}

export interface OverageDetail {
  crossed: boolean;
  runningTotalKwh: number;
  thresholdKwh: number;
  overageKwh: number;
  penaltyMultiplier: number;
  /** Which month (reading) the threshold was first crossed. */
  crossedReadingDate?: string;
}

export interface SplitResult {
  semester: SemesterBlock;
  readingsInBlock: number;
  runningTotalKwh: number;
  hepVtKwh: number;
  hepNtKwh: number;
  overage: OverageDetail;
  energyCostAtBase: number;
  energyCostAtPenalty: number;
  penaltyCost: number;
  fixedCostTotal: number;
  ground: FloorResult;
  upper: FloorResult;
  grandTotal: number;
}

export type SyncTrigger = "sync" | "cron" | "manual";

export interface SyncLog {
  id: string;
  timestamp: string;
  ok: boolean;
  found: boolean;
  messageId?: string;
  downloadedFile?: string;
  error?: string;
  status: string;
  trigger: SyncTrigger;
}

export interface InboxPdf {
  id: string;
  filename: string;
  path: string;
  msgId?: string;
  downloadedAt: string;
  parsedAt?: string;
  readingId?: string;
  parsePreview?: HepParsePreview;
}

export interface HepParsePreview {
  periodStart?: string;
  periodEnd?: string;
  hepVtKwh?: number;
  hepNtKwh?: number;
  hepTotalSupply?: number;
  hepFees?: number;
  hepGrandTotal?: number;
  hepOverageKwh?: number;
  confidence: number;
}

export interface GmailAuthState {
  refreshToken?: string;
  accessToken?: string;
  expiry?: number;
  email?: string;
  createdAt: string;
  updatedAt: string;
}
