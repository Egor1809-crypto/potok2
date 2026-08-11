/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    ASSETS: Fetcher;
    OPENAI_API_KEY?: string;
    OPENAI_EMAIL_MODEL?: string;
    VK_WORKSPACE_SMTP_PASSWORD?: string;
    TELEGRAM_BOT_TOKEN?: string;
    VK_COMMUNITY_ACCESS_TOKEN?: string;
    UNISENDER_API_KEY?: string;
    SENDPULSE_CLIENT_ID?: string;
    SENDPULSE_CLIENT_SECRET?: string;
  }
}
