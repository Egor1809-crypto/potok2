export type ContactFinderMode = "url" | "text";

export type ContactFinderCandidate = {
  id: string;
  type: "email" | "phone";
  value: string;
  suggestedName: string;
  confidence: "high" | "medium";
  sourceUrl: string | null;
  sourceLabel: string;
  context: string;
};

export type ContactFinderPageReport = {
  url: string;
  status: "scanned" | "skipped";
  reason: string | null;
  foundCount: number;
};

export type ContactFinderRequest = {
  mode: ContactFinderMode;
  acknowledgedResponsibleUse: true;
  url?: string;
  text?: string;
  includeSameSitePages?: boolean;
};

export type ContactFinderResponse = {
  candidates: ContactFinderCandidate[];
  pages: ContactFinderPageReport[];
  summary: {
    emailCount: number;
    phoneCount: number;
    scannedPageCount: number;
  };
  policy: {
    persisted: false;
    sameSiteLimit: number;
    message: string;
  };
};
