export interface AnalyticsPoint {
  date: string;
  label: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replies: number;
}

export interface FunnelStage {
  key: "sent" | "delivered" | "opened" | "clicked" | "replies";
  label: string;
  value: number;
  rate: number;
  color: string;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  change: number;
  changeLabel: string;
  trend: "up" | "down" | "neutral";
}

export interface BreakdownDatum {
  label: string;
  value: number;
  color: string;
}

export interface AnalyticsSummary {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replies: number;
  bounced: number;
  unsubscribed: number;
}
