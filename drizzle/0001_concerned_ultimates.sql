CREATE TABLE `business_products` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`moq` text NOT NULL,
	`price_cents` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published` text DEFAULT 'no' NOT NULL,
	`revision` text NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_products_org` ON `business_products` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_products_public` ON `business_products` (`published`,`status`);--> statement-breakpoint
CREATE TABLE `document_registers` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`product_id` text,
	`label` text NOT NULL,
	`reference` text NOT NULL,
	`issuer` text NOT NULL,
	`scope` text NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`revision` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `business_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_org` ON `document_registers` (`org_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_members_org` ON `memberships` (`org_id`);--> statement-breakpoint
CREATE TABLE `business_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_org_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `business_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_thread` ON `business_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `business_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`supplier_org_id` text NOT NULL,
	`amount_cents` text NOT NULL,
	`lead_days` text NOT NULL,
	`terms` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `business_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_offers_thread` ON `business_offers` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published` text DEFAULT 'no' NOT NULL,
	`revision` text NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_review_target` ON `review_events` (`target_id`);--> statement-breakpoint
CREATE TABLE `reviewers` (
	`user_id` text PRIMARY KEY NOT NULL,
	`granted_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rfqs` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_org_id` text NOT NULL,
	`title` text NOT NULL,
	`quantity` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`revision` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`buyer_org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rfqs_buyer` ON `rfqs` (`buyer_org_id`);--> statement-breakpoint
CREATE TABLE `business_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`rfq_id` text NOT NULL,
	`supplier_org_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_threads_supplier` ON `business_threads` (`supplier_org_id`);--> statement-breakpoint
CREATE INDEX `idx_threads_rfq` ON `business_threads` (`rfq_id`);