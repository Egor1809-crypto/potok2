CREATE TABLE `telegram_connections` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_token` text NOT NULL,
	`webhook_id` text NOT NULL,
	`webhook_secret_hash` text NOT NULL,
	`webhook_url` text NOT NULL,
	`state` text NOT NULL,
	`operation_id` text NOT NULL,
	`operator` text NOT NULL,
	`last_received_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telegram_webhook` ON `telegram_connections` (`webhook_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telegram_bot` ON `telegram_connections` (`bot_id`);--> statement-breakpoint
CREATE TABLE `telegram_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`status` text NOT NULL,
	`pending_nonce` text DEFAULT '' NOT NULL,
	`event_at` integer NOT NULL,
	`update_id` integer NOT NULL,
	`event_nonce` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telegram_subscriber` ON `telegram_subscribers` (`workspace_id`,`bot_id`,`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_telegram_subscriber_status` ON `telegram_subscribers` (`workspace_id`,`bot_id`,`status`);--> statement-breakpoint
CREATE TABLE `telegram_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`created_at` text NOT NULL
);
