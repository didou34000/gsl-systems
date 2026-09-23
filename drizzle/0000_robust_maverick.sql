CREATE TABLE `selections` (
	`owner_id` text NOT NULL,
	`product_id` text NOT NULL,
	PRIMARY KEY(`owner_id`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `sourcing_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_owner_created` ON `sourcing_drafts` (`owner_id`,`created_at`);