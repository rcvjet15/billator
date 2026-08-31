export type TariffCode = "vt" | "nt";

export type SemesterType = "winter" | "summer";

export interface SemesterBlock {
  type: SemesterType;
  year: number;
  start: Date;
  end: Date;
  label: string;
}

export type ReadingStatus = "pending" | "complete";

export type ReadingOrigin = "parsed" | "manual";

export interface Reading {
  id: string;
  periodStart: string;
  periodEnd: string;
  /** Derived monthly consumption (typically End - Start). */
  hepVtKwh: number;
  hepNtKwh: number;
  hepTotalSupply: number;
  hepFees: number;
  hepGrandTotal: number;
  upperVtKwh: number;
  upperNtKwh: number;
  /** Cumulative (odometer-style) meter values. Optional Start/End per channel. */
  hepStartVt?: number;
  hepEndVt?: number;
  hepStartNt?: number;
  hepEndNt?: number;
  upperStartVt?: number;
  upperEndVt?: number;
  upperStartNt?: number;
  upperEndNt?: number;
  createdAt: string;
  updatedAt: string;
  /** A reading is complete when it has invoice (HEP) data and upper-floor data. */
  status?: ReadingStatus;
  /** How this reading came to be: via PDF parse or manual entry. */
  origin?: ReadingOrigin;
  /** Estimated upper-floor cost for this reading (set by the list route). */
  upperCost?: number;
  /** Optional reference to the invoice PDF that produced this reading. */
  sourcePdfId?: string;
  sourcePdfName?: string;
}

export interface ReadingInput {
  periodStart: string;
  periodEnd: string;
  hepVtKwh?: number;
  hepNtKwh?: number;
  hepTotalSupply?: number;
  hepFees?: number;
  hepGrandTotal?: number;
  upperVtKwh?: number;
  upperNtKwh?: number;
  hepStartVt?: number;
  hepEndVt?: number;
  hepStartNt?: number;
  hepEndNt?: number;
  upperStartVt?: number;
  upperEndVt?: number;
  upperStartNt?: number;
  upperEndNt?: number;
  sourcePdfId?: string;
  sourcePdfName?: string;
  origin?: ReadingOrigin;
}

export interface TariffConfig {
  energyRateVt: number;
  energyRateNt: number;
  /** Single-tariff (JT) energy rate, available for meters without separate tariffing. */
  energyRateJt: number;
  overageMultiplier: number;
  overageThresholdKwh: number;
  /** Monthly fixed supply fee (Opskrbna naknada). */
  fixedFee: number;
  /** Monthly metering-point fee (Naknada za OMM). */
  meteringFee: number;
  /** Transmission fee (Prijenos - HOPS), applied to total kWh. */
  transmissionRate: number;
  /** Distribution fee (Distribucija - HEP ODS) for VT and NT. */
  distributionRateVt: number;
  distributionRateNt: number;
  /** Renewable energy fee (OIE), applied to total kWh. */
  oieRate: number;
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
  /** Cumulative meter readings (Stanje od/do) where present on the invoice. */
  hepStartVt?: number;
  hepEndVt?: number;
  hepStartNt?: number;
  hepEndNt?: number;
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
