CREATE TABLE `team_access_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_access_events_workspace_created` ON `team_access_events` (`workspace_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `participants` ADD `role` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `access_scope` text DEFAULT '{"all":false,"baseIds":[],"groupTags":[]}' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `role` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `access_scope` text DEFAULT '{"all":false,"baseIds":[],"groupTags":[]}' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `label` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `target_participant_id` text;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `revoked_at` text;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `accepted_participant_id` text;--> statement-breakpoint
ALTER TABLE `team_invites` ADD `claim_nonce` text;