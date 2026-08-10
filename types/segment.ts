export type SegmentField =
  | "role"
  | "city"
  | "status"
  | "category"
  | "tag"
  | "company"
  | "lastContactedAt"
  | "engagementScore";

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "before"
  | "after";

export interface SegmentRule {
  id: string;
  field: SegmentField;
  operator: SegmentOperator;
  value: string | number | string[];
  join: "and" | "or";
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  contactCount: number;
  rules: SegmentRule[];
  color: string;
  isDynamic: boolean;
  campaignsCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
