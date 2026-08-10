import type {
  AnalyticsPoint,
  AnalyticsSummary,
  BreakdownDatum,
  DashboardMetric,
  FunnelStage,
} from "@/types";

export const performanceData: AnalyticsPoint[] = [
  { date: "2026-07-13", label: "Jul 13", sent: 820, delivered: 807, opened: 371, clicked: 91, replies: 22 },
  { date: "2026-07-14", label: "Jul 14", sent: 1_040, delivered: 1_021, opened: 482, clicked: 116, replies: 31 },
  { date: "2026-07-15", label: "Jul 15", sent: 960, delivered: 943, opened: 451, clicked: 109, replies: 27 },
  { date: "2026-07-16", label: "Jul 16", sent: 1_220, delivered: 1_198, opened: 585, clicked: 142, replies: 34 },
  { date: "2026-07-17", label: "Jul 17", sent: 1_360, delivered: 1_337, opened: 661, clicked: 156, replies: 39 },
  { date: "2026-07-18", label: "Jul 18", sent: 630, delivered: 618, opened: 286, clicked: 68, replies: 17 },
  { date: "2026-07-19", label: "Jul 19", sent: 420, delivered: 412, opened: 194, clicked: 43, replies: 11 },
  { date: "2026-07-20", label: "Jul 20", sent: 1_080, delivered: 1_059, opened: 511, clicked: 123, replies: 33 },
  { date: "2026-07-21", label: "Jul 21", sent: 1_440, delivered: 1_414, opened: 706, clicked: 178, replies: 44 },
  { date: "2026-07-22", label: "Jul 22", sent: 1_180, delivered: 1_159, opened: 574, clicked: 141, replies: 36 },
  { date: "2026-07-23", label: "Jul 23", sent: 1_310, delivered: 1_287, opened: 636, clicked: 159, replies: 42 },
  { date: "2026-07-24", label: "Jul 24", sent: 1_520, delivered: 1_491, opened: 753, clicked: 190, replies: 49 },
  { date: "2026-07-25", label: "Jul 25", sent: 720, delivered: 707, opened: 337, clicked: 79, replies: 20 },
  { date: "2026-07-26", label: "Jul 26", sent: 510, delivered: 500, opened: 238, clicked: 54, replies: 13 },
  { date: "2026-07-27", label: "Jul 27", sent: 1_260, delivered: 1_236, opened: 612, clicked: 149, replies: 38 },
  { date: "2026-07-28", label: "Jul 28", sent: 1_390, delivered: 1_365, opened: 684, clicked: 173, replies: 46 },
  { date: "2026-07-29", label: "Jul 29", sent: 1_948, delivered: 1_919, opened: 894, clicked: 218, replies: 55 },
  { date: "2026-07-30", label: "Jul 30", sent: 1_170, delivered: 1_151, opened: 559, clicked: 139, replies: 35 },
  { date: "2026-07-31", label: "Jul 31", sent: 1_330, delivered: 1_307, opened: 651, clicked: 164, replies: 41 },
  { date: "2026-08-01", label: "Aug 1", sent: 760, delivered: 746, opened: 354, clicked: 86, replies: 21 },
  { date: "2026-08-02", label: "Aug 2", sent: 540, delivered: 530, opened: 249, clicked: 59, replies: 14 },
  { date: "2026-08-03", label: "Aug 3", sent: 1_140, delivered: 1_118, opened: 552, clicked: 136, replies: 36 },
  { date: "2026-08-04", label: "Aug 4", sent: 1_284, delivered: 1_265, opened: 658, clicked: 169, replies: 89 },
  { date: "2026-08-05", label: "Aug 5", sent: 1_470, delivered: 1_444, opened: 721, clicked: 181, replies: 47 },
  { date: "2026-08-06", label: "Aug 6", sent: 1_210, delivered: 1_189, opened: 601, clicked: 149, replies: 39 },
  { date: "2026-08-07", label: "Aug 7", sent: 1_560, delivered: 1_531, opened: 781, clicked: 202, replies: 53 },
  { date: "2026-08-08", label: "Aug 8", sent: 810, delivered: 795, opened: 381, clicked: 93, replies: 24 },
  { date: "2026-08-09", label: "Aug 9", sent: 610, delivered: 598, opened: 291, clicked: 69, replies: 17 },
  { date: "2026-08-10", label: "Aug 10", sent: 1_360, delivered: 1_335, opened: 676, clicked: 171, replies: 45 },
  { date: "2026-08-11", label: "Aug 11", sent: 2_185, delivered: 2_140, opened: 1_039, clicked: 245, replies: 85 },
];

export const analyticsSummary: AnalyticsSummary = {
  sent: 10_000,
  delivered: 9_820,
  opened: 4_921,
  clicked: 1_284,
  replies: 328,
  bounced: 180,
  unsubscribed: 42,
};

export const analyticsFunnel: FunnelStage[] = [
  { key: "sent", label: "Sent", value: 10_000, rate: 100, color: "#635BFF" },
  { key: "delivered", label: "Delivered", value: 9_820, rate: 98.2, color: "#746CF8" },
  { key: "opened", label: "Opened", value: 4_921, rate: 49.2, color: "#2F7CF6" },
  { key: "clicked", label: "Clicked", value: 1_284, rate: 12.8, color: "#21A8D8" },
  { key: "replies", label: "Replies", value: 328, rate: 3.3, color: "#0F9F7A" },
];

export const dashboardMetrics: DashboardMetric[] = [
  {
    id: "metric-contacts",
    label: "Contacts",
    value: "24,821",
    rawValue: 24_821,
    change: 8.2,
    changeLabel: "+8.2% this month",
    trend: "up",
  },
  {
    id: "metric-campaigns",
    label: "Campaigns sent",
    value: "128",
    rawValue: 128,
    change: 12,
    changeLabel: "+12% this quarter",
    trend: "up",
  },
  {
    id: "metric-delivery",
    label: "Delivery rate",
    value: "98.2%",
    rawValue: 98.2,
    change: 0.4,
    changeLabel: "+0.4% vs last month",
    trend: "up",
  },
  {
    id: "metric-replies",
    label: "Reply rate",
    value: "6.4%",
    rawValue: 6.4,
    change: 1.1,
    changeLabel: "+1.1% vs last month",
    trend: "up",
  },
];

export const deviceBreakdown: BreakdownDatum[] = [
  { label: "Desktop", value: 54, color: "#635BFF" },
  { label: "Mobile", value: 41, color: "#2F7CF6" },
  { label: "Tablet", value: 5, color: "#B9C1D6" },
];

export const engagementByIndustry: BreakdownDatum[] = [
  { label: "Legal services", value: 37, color: "#635BFF" },
  { label: "Events", value: 23, color: "#2F7CF6" },
  { label: "Technology", value: 18, color: "#21A8D8" },
  { label: "Consulting", value: 13, color: "#0F9F7A" },
  { label: "Other", value: 9, color: "#D5D9E5" },
];

export const analyticsTimeSeries = performanceData;
export const campaignFunnel = analyticsFunnel;
export const mockAnalytics = performanceData;
