CREATE TABLE `oauth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`browser_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`intent` text NOT NULL,
	`next_path` text NOT NULL,
	`origin` text NOT NULL,
	`participant_id` text,
	`session_id` text,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_flows_expiry` ON `oauth_flows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `oauth_identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`participant_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_identity_subject` ON `oauth_identities` (`provider`,`subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_identity_participant` ON `oauth_identities` (`provider`,`participant_id`);