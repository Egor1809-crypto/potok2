CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_sessions_token_hash` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_participant` ON `auth_sessions` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expires` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_by_participant_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_invites_code_hash` ON `team_invites` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_team_invites_workspace_expires` ON `team_invites` (`workspace_id`,`expires_at`);--> statement-breakpoint
DROP INDEX `idx_participants_workspace_singleton`;--> statement-breakpoint
ALTER TABLE `participants` ADD `login` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `password_salt` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `color` text DEFAULT '#6558E8' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `last_login_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_workspace_login` ON `participants` (`workspace_id`,`login`) WHERE "participants"."login" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_participants_workspace_status` ON `participants` (`workspace_id`,`status`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `created_by_participant_id` text REFERENCES participants(id);--> statement-breakpoint
ALTER TABLE `contacts` ADD `updated_by_participant_id` text REFERENCES participants(id);--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_creator` ON `contacts` (`workspace_id`,`created_by_participant_id`);