import {
  BarChart3,
  Building2,
  ContactRound,
  FileText,
  LayoutDashboard,
  MailOpen,
  Megaphone,
  Settings,
  Shapes,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProductNavItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  keywords?: string[];
};

export type ProductNavGroup = {
  label: string;
  items: ProductNavItem[];
};

export const productNavigation: ProductNavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Overview",
        description: "Workspace activity and performance",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        keywords: ["home", "dashboard"],
      },
      {
        label: "Contacts",
        description: "People, saved views and relationship history",
        href: "/contacts",
        icon: ContactRound,
        keywords: ["people", "crm", "database"],
      },
      {
        label: "Companies",
        description: "Organizations and their contacts",
        href: "/companies",
        icon: Building2,
        keywords: ["accounts", "organizations"],
      },
      {
        label: "Segments",
        description: "Saved and dynamic audiences",
        href: "/segments",
        icon: UsersRound,
        keywords: ["audiences", "lists", "filters"],
      },
    ],
  },
  {
    label: "Outreach",
    items: [
      {
        label: "Campaigns",
        description: "Draft, schedule and track outreach",
        href: "/campaigns",
        icon: Megaphone,
        keywords: ["email", "send", "broadcast"],
      },
      {
        label: "Email builder",
        description: "Design and personalize campaign content",
        href: "/email-builder",
        icon: MailOpen,
        keywords: ["editor", "compose", "design"],
      },
      {
        label: "Templates",
        description: "Reusable email designs",
        href: "/templates",
        icon: FileText,
        keywords: ["library", "designs"],
      },
      {
        label: "Analytics",
        description: "Delivery, engagement and reply performance",
        href: "/analytics",
        icon: BarChart3,
        keywords: ["reports", "metrics", "performance"],
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        label: "Imports",
        description: "Bring contacts into your workspace",
        href: "/import",
        icon: UploadCloud,
        keywords: ["csv", "xlsx", "upload"],
      },
      {
        label: "Settings",
        description: "Workspace, members and sending setup",
        href: "/settings",
        icon: Settings,
        keywords: ["billing", "domains", "brand", "members"],
      },
    ],
  },
];

export const productRoutes: ProductNavItem[] = productNavigation.flatMap(
  (group) => group.items,
);

export const quickCreateRoutes: ProductNavItem[] = [
  {
    label: "New campaign",
    description: "Choose an audience and start an email",
    href: "/campaigns/new",
    icon: Shapes,
    exact: true,
    keywords: ["create", "compose", "send"],
  },
];

export function isProductRouteActive(
  pathname: string,
  item: ProductNavItem,
) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getProductSection(pathname: string) {
  if (pathname === "/campaigns/new") return "New campaign";
  return (
    productRoutes.find((item) => isProductRouteActive(pathname, item))?.label ??
    "Overview"
  );
}
