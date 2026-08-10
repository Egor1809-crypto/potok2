export type ImportSource = "csv" | "xlsx" | "google-sheets";
export type ImportStatus = "uploading" | "mapping" | "validating" | "complete" | "failed";

export interface ImportFieldMapping {
  sourceColumn: string;
  targetField: string;
  sampleValue: string;
}

export interface ImportValidationSummary {
  total: number;
  ready: number;
  duplicates: number;
  invalidEmails: number;
  missingEmails: number;
}

export interface ImportJob {
  id: string;
  fileName: string;
  source: ImportSource;
  status: ImportStatus;
  progress: number;
  mapping: ImportFieldMapping[];
  summary: ImportValidationSummary;
  createdAt: string;
}
