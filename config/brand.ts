/**
 * Product identity and demo-workspace defaults.
 * Keep product copy and branding imports pointed here so MAILFLOW can be
 * rebranded without hunting through feature code.
 */
export const brandConfig = {
  name: "MAILFLOW",
  legalName: "Mailflow Workspace, Inc.",
  tagline: "Email outreach. Finally organized.",
  description:
    "Manage contacts, build personalized emails and launch targeted campaigns from one beautifully organized workspace.",
  shortDescription: "Contacts, emails and campaigns in one workspace.",
  accentColor: "#635BFF",
  secondaryAccentColor: "#34B6E4",
  logoMark: "M",
  website: "https://mailflow.example",
  supportEmail: "hello@mailflow.example",
  social: {
    linkedin: "https://linkedin.com/company/mailflow-demo",
    x: "https://x.com/mailflow_demo",
  },
} as const;

export const workspaceConfig = {
  id: "workspace-legal-team",
  name: "Legal Team",
  plan: "Scale",
  timezone: "Europe/Moscow",
  locale: "en",
  contactLimit: 50_000,
  monthlySendLimit: 250_000,
} as const;

export const demoUser = {
  id: "user-egor-sabalin",
  name: "Egor Sabalin",
  firstName: "Egor",
  email: "egor@mailflow.example",
  initials: "ES",
  role: "Workspace Admin",
  avatarColor: "#675CF5",
} as const;

export const BRAND_NAME = brandConfig.name;

export default brandConfig;
