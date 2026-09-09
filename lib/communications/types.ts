import type { ContactRecord } from "@/types/api";
import type { Channel, Evidence, ReplyCategory } from "./rules";
export type PressurePolicy = {
    window_days: number;
    contact_limit: number;
    company_limit: number;
    auto_tasks: number;
};
export type CommunicationCheck = {
    policy: PressurePolicy;
    operatorName: string;
    checkedAt: string;
    blockedIds: string[];
    warningIds: string[];
    allowedIds: string[];
    rows: Array<{
        id: string;
        name: string;
        company: string;
        endpoint: string;
        channel: Channel;
        consent: string;
        sent: number;
        projected: number;
        percentage: number;
        companySelected: number;
        blocked: boolean;
        reasons: string[];
        warnings: string[];
    }>;
};
export type ContactCommunicationData = {
    contact: ContactRecord;
    policy: PressurePolicy;
    check: CommunicationCheck;
    evidence: Evidence[];
    history: Array<{
        id: string;
        occurred_at: string;
        author: string;
        campaign_name: string;
        channel: string;
    }>;
    holds: Array<{
        id: string;
        reason: string;
        until_at: string | null;
    }>;
    companyHistory: {
        total: number;
        recipients: number;
    };
};
export type ReplyRecord = {
    id: string;
    contact_id: string;
    contact_name: string;
    campaign_name: string | null;
    sender: string;
    subject: string;
    body: string;
    category: ReplyCategory;
    confidence: number;
    classifier: string;
    quote: string;
    suggested_date: string | null;
    suggested_action: string | null;
    received_at: string;
    reviewed: number;
};
export type TaskRecord = {
    id: string;
    contact_id: string;
    contact_name: string;
    assigned_to: string;
    assignee: string;
    title: string;
    due_date: string | null;
    status: string;
};
export type CommunicationOverview = {
    policy: PressurePolicy;
    people: Array<{
        id: string;
        full_name: string;
        email: string;
        company_name: string;
    }>;
    members: Array<{
        id: string;
        display_name: string;
    }>;
    replies: ReplyRecord[];
    tasks: TaskRecord[];
    webhookConfigured: boolean;
    aiConfigured: boolean;
    webhookPath: string;
};
