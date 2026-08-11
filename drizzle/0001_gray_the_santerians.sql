CREATE TABLE `campaign_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`version` integer NOT NULL,
	`content_hash` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_campaign_versions_number` ON `campaign_versions` (`campaign_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_campaign_versions_hash` ON `campaign_versions` (`campaign_id`,`content_hash`);--> statement-breakpoint
CREATE TABLE `delivery_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`campaign_version_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`ambiguous_count` integer DEFAULT 0 NOT NULL,
	`manual_count` integer DEFAULT 0 NOT NULL,
	`provider_external_ids` text DEFAULT '{}' NOT NULL,
	`status_message` text DEFAULT 'Задание создано.' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_version_id`) REFERENCES `campaign_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_jobs_idempotency` ON `delivery_jobs` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_jobs_version` ON `delivery_jobs` (`campaign_version_id`);--> statement-breakpoint
CREATE INDEX `idx_delivery_jobs_campaign_created` ON `delivery_jobs` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `delivery_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`campaign_version_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`channel` text NOT NULL,
	`provider_id` text NOT NULL,
	`recipient_endpoint` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`status_message` text DEFAULT 'Ожидает обработки.' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `delivery_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_version_id`) REFERENCES `campaign_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_outbox_idempotency` ON `delivery_outbox` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_delivery_outbox_job_status` ON `delivery_outbox` (`job_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_delivery_outbox_campaign_channel` ON `delivery_outbox` (`campaign_id`,`channel`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `email_body_html` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `email_builder_document` text DEFAULT 'null';--> statement-breakpoint
ALTER TABLE `campaigns` ADD `ready_version_id` text;--> statement-breakpoint
ALTER TABLE `integrations` ADD `check_status` text DEFAULT 'disconnected' NOT NULL;--> statement-breakpoint
ALTER TABLE `integrations` ADD `check_message` text DEFAULT 'Подключение ещё не проверено.' NOT NULL;