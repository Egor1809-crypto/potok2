CREATE TABLE `email_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`preview_text` text DEFAULT '' NOT NULL,
	`builder_document` text NOT NULL,
	`email_body_html` text NOT NULL,
	`email_body_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_templates_workspace_name_key` ON `email_templates` (`workspace_id`,`name_key`);--> statement-breakpoint
CREATE INDEX `idx_email_templates_workspace_updated` ON `email_templates` (`workspace_id`,`updated_at`);