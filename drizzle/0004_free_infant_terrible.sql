CREATE TABLE `ai_idempotency` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`operation` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`asset_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `email_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_ai_idempotency_workspace_operation_created` ON `ai_idempotency` (`workspace_id`,`operation`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope` text NOT NULL,
	`window_started_at` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_request_limits_workspace_scope` ON `ai_request_limits` (`workspace_id`,`scope`);--> statement-breakpoint
CREATE TABLE `presentation_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`theme_id` text NOT NULL,
	`accent_color` text NOT NULL,
	`background_color` text NOT NULL,
	`text_color` text NOT NULL,
	`slides` text DEFAULT '[]' NOT NULL,
	`source_type` text DEFAULT 'blank' NOT NULL,
	`source_email_template_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_email_template_id`) REFERENCES `email_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_presentation_projects_workspace_updated` ON `presentation_projects` (`workspace_id`,`updated_at`);