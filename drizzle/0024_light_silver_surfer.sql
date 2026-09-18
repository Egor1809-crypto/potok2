CREATE TABLE `vk_workspace_account_state` (
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`day_key` text DEFAULT '' NOT NULL,
	`day_count` integer DEFAULT 0 NOT NULL,
	`hour_key` text DEFAULT '' NOT NULL,
	`hour_count` integer DEFAULT 0 NOT NULL,
	`consecutive_serious_errors` integer DEFAULT 0 NOT NULL,
	`paused_until` text,
	`pause_reason` text DEFAULT '' NOT NULL,
	`last_success_at` text,
	`last_error_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vk_workspace_account_state` ON `vk_workspace_account_state` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_vk_workspace_account_pause` ON `vk_workspace_account_state` (`workspace_id`,`paused_until`);--> statement-breakpoint
ALTER TABLE `delivery_outbox` ADD `account_id` text;--> statement-breakpoint
ALTER TABLE `delivery_outbox` ADD `next_attempt_at` text;--> statement-breakpoint
ALTER TABLE `delivery_outbox` ADD `last_attempt_at` text;--> statement-breakpoint
ALTER TABLE `delivery_outbox` ADD `accepted_at` text;--> statement-breakpoint
ALTER TABLE `delivery_outbox` ADD `last_error` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `delivery_outbox` ADD `priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_delivery_outbox_provider_status_next` ON `delivery_outbox` (`provider_id`,`status`,`next_attempt_at`);