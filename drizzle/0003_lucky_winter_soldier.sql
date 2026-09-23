CREATE TABLE `business_bookmarks` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`),
	FOREIGN KEY (`product_id`) REFERENCES `business_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `business_files` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`rfq_id` text,
	`product_id` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` text NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_files_rfq` ON `business_files` (`rfq_id`);--> statement-breakpoint
CREATE INDEX `idx_files_product` ON `business_files` (`product_id`);--> statement-breakpoint
CREATE TABLE `business_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `business_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `declared_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`buyer_org_id` text NOT NULL,
	`reference` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `business_offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thread_id`) REFERENCES `business_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_orders_thread` ON `declared_orders` (`thread_id`);--> statement-breakpoint
ALTER TABLE `business_products` ADD `kind` text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_products` ADD `process` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_products` ADD `materials` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_products` ADD `equipment` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_products` ADD `dimensions` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_products` ADD `volumes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfqs` ADD `mode` text DEFAULT 'autonomous' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfqs` ADD `assistance_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfqs` ADD `assistance_note` text DEFAULT '' NOT NULL;