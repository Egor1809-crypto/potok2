CREATE TABLE `registration_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`version` text NOT NULL,
	`statement` text NOT NULL,
	`method` text NOT NULL,
	`accepted_at` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_registration_consents_participant` ON `registration_consents` (`participant_id`,`accepted_at`);--> statement-breakpoint
ALTER TABLE `oauth_flows` ADD `consent_version` text;--> statement-breakpoint
ALTER TABLE `oauth_flows` ADD `consent_accepted_at` text;