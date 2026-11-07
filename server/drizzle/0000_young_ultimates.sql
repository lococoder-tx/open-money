CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`mask` text,
	`type` text NOT NULL,
	`subtype` text,
	`current_balance` real,
	`available_balance` real,
	`currency` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `balance_snapshots` (
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`balance` real NOT NULL,
	PRIMARY KEY(`account_id`, `date`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`category` text PRIMARY KEY NOT NULL,
	`monthly_limit` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`account_id` text NOT NULL,
	`security_id` text NOT NULL,
	`name` text NOT NULL,
	`ticker` text,
	`type` text,
	`quantity` real NOT NULL,
	`price` real NOT NULL,
	`value` real NOT NULL,
	`cost_basis` real,
	PRIMARY KEY(`account_id`, `security_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token_enc` text NOT NULL,
	`institution_name` text NOT NULL,
	`products` text DEFAULT '[]' NOT NULL,
	`cursor` text,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`last_synced_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`account_id` text NOT NULL,
	`direction` text NOT NULL,
	`name` text NOT NULL,
	`merchant_name` text,
	`category` text NOT NULL,
	`frequency` text NOT NULL,
	`average_amount` real NOT NULL,
	`last_amount` real NOT NULL,
	`last_date` text NOT NULL,
	`next_date` text,
	`is_active` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`merchant_name` text,
	`logo_url` text,
	`plaid_category` text NOT NULL,
	`user_category` text,
	`pending` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactions_date` ON `transactions` (`date`);