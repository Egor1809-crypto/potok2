CREATE TABLE `campaign_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`campaign_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_events_workspace_occurred` ON `campaign_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_campaign_events_campaign_occurred` ON `campaign_events` (`campaign_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`name` text NOT NULL,
	`audience_type` text NOT NULL,
	`audience_label` text DEFAULT '' NOT NULL,
	`segment_id` text,
	`contact_ids` text DEFAULT '[]' NOT NULL,
	`template_id` text,
	`sender_name` text DEFAULT '' NOT NULL,
	`sender_email` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`preview_text` text DEFAULT '' NOT NULL,
	`email_body_text` text DEFAULT '' NOT NULL,
	`messenger_message` text DEFAULT '' NOT NULL,
	`delivery_channels` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`status_reason` text DEFAULT 'Черновик сохранён' NOT NULL,
	`scheduled_at` text,
	`sent_at` text,
	`metrics` text DEFAULT '{"recipients":0,"sent":0,"delivered":0,"opened":0,"clicked":0,"replies":0,"bounced":0,"unsubscribed":0}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_workspace_status_updated` ON `campaigns` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_segment` ON `campaigns` (`segment_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`company_id` text,
	`company_name` text DEFAULT '' NOT NULL,
	`job_title` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Client' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`country` text DEFAULT 'Россия' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`engagement_score` integer DEFAULT 0 NOT NULL,
	`avatar_color` text DEFAULT '#6558E8' NOT NULL,
	`email_consent` integer DEFAULT false NOT NULL,
	`telegram_chat_id` text,
	`telegram_consent` integer DEFAULT false NOT NULL,
	`vk_user_id` text,
	`vk_consent` integer DEFAULT false NOT NULL,
	`last_contacted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_workspace_email` ON `contacts` (`workspace_id`,`email`) WHERE "contacts"."email" <> '';--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_status` ON `contacts` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_company` ON `contacts` (`workspace_id`,`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_workspace_telegram` ON `contacts` (`workspace_id`,`telegram_chat_id`) WHERE "contacts"."telegram_chat_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_workspace_vk` ON `contacts` (`workspace_id`,`vk_user_id`) WHERE "contacts"."vk_user_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `delivery_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`channel` text NOT NULL,
	`provider_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`eligible_count` integer DEFAULT 0 NOT NULL,
	`blocked_count` integer DEFAULT 0 NOT NULL,
	`status_reason` text DEFAULT 'План не проверен' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_plans_campaign_channel` ON `delivery_plans` (`campaign_id`,`channel`);--> statement-breakpoint
CREATE INDEX `idx_delivery_plans_provider` ON `delivery_plans` (`provider_id`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`public_config` text DEFAULT '{}' NOT NULL,
	`last_checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integrations_workspace_provider` ON `integrations` (`workspace_id`,`provider_id`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`auth_user_id` text,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_workspace_singleton` ON `participants` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `segments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`rules` text DEFAULT '[]' NOT NULL,
	`color` text DEFAULT '#6558E8' NOT NULL,
	`is_dynamic` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_segments_workspace_name` ON `segments` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `system_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company_name` text NOT NULL,
	`timezone` text DEFAULT 'Europe/Moscow' NOT NULL,
	`default_sender_name` text DEFAULT '' NOT NULL,
	`default_sender_email` text DEFAULT '' NOT NULL,
	`reply_to_email` text DEFAULT '' NOT NULL,
	`signature` text DEFAULT '' NOT NULL,
	`require_consent` integer DEFAULT true NOT NULL,
	`notify_campaign_complete` integer DEFAULT true NOT NULL,
	`notify_blocked_campaign` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
