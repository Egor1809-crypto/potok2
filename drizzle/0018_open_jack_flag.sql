CREATE TABLE `communication_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communication_audit_entity` ON `communication_audit` (`workspace_id`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `communication_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`channel` text NOT NULL,
	`purpose` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`obtained_at` text NOT NULL,
	`expires_at` text,
	`version` text NOT NULL,
	`statement` text NOT NULL,
	`operator` text NOT NULL,
	`digest` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_consent_endpoint_date` ON `communication_consents` (`workspace_id`,`endpoint`,`channel`,`purpose`,`created_at`);--> statement-breakpoint
CREATE TABLE `communication_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`channel` text NOT NULL,
	`reason` text NOT NULL,
	`until_at` text,
	`active` integer DEFAULT 1 NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_hold_endpoint` ON `communication_holds` (`workspace_id`,`endpoint`,`channel`,`active`);--> statement-breakpoint
CREATE TABLE `communication_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`campaign_id` text,
	`external_id` text NOT NULL,
	`sender` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`confidence` integer NOT NULL,
	`classifier` text NOT NULL,
	`quote` text NOT NULL,
	`suggested_date` text,
	`suggested_action` text,
	`received_at` text NOT NULL,
	`actor_id` text NOT NULL,
	`reviewed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_message_external` ON `communication_messages` (`workspace_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_message_received` ON `communication_messages` (`workspace_id`,`received_at`);--> statement-breakpoint
CREATE TABLE `communication_policy` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`window_days` integer DEFAULT 14 NOT NULL,
	`contact_limit` integer DEFAULT 9 NOT NULL,
	`company_limit` integer DEFAULT 3 NOT NULL,
	`auto_tasks` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`actor_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communication_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`message_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`assigned_to` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_message` ON `communication_tasks` (`workspace_id`,`message_id`);--> statement-breakpoint
CREATE TABLE `communication_touches` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`company_key` text NOT NULL,
	`channel` text NOT NULL,
	`campaign_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_touches_endpoint_time` ON `communication_touches` (`workspace_id`,`endpoint`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_touches_company_time` ON `communication_touches` (`workspace_id`,`company_key`,`occurred_at`);