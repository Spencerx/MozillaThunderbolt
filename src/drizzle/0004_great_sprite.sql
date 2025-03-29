ALTER TABLE `todos` ADD `email_message_id` text REFERENCES email_messages(id);--> statement-breakpoint
CREATE UNIQUE INDEX `todos_email_message_id_unique` ON `todos` (`email_message_id`);--> statement-breakpoint
ALTER TABLE `todos` DROP COLUMN `imap_id`;