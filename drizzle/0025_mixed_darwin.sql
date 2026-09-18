CREATE TABLE `vk_workspace_delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`outbox_id` text NOT NULL,
	`job_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`attempt` integer NOT NULL,
	`status` text NOT NULL,
	`provider_response` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outbox_id`) REFERENCES `delivery_outbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vk_workspace_attempts_outbox` ON `vk_workspace_delivery_attempts` (`outbox_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_vk_workspace_attempts_account_time` ON `vk_workspace_delivery_attempts` (`workspace_id`,`account_id`,`completed_at`);