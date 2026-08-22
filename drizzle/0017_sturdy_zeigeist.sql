CREATE TABLE `presentation_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_presentation_favorites_workspace_item` ON `presentation_favorites` (`workspace_id`,`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_presentation_favorites_workspace_created` ON `presentation_favorites` (`workspace_id`,`created_at`);