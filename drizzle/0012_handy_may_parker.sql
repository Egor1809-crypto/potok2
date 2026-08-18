CREATE INDEX `idx_contacts_workspace_status_updated` ON `contacts` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_updated` ON `contacts` (`workspace_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_city` ON `contacts` (`workspace_id`,`city`);--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_company_name` ON `contacts` (`workspace_id`,`company_name`);