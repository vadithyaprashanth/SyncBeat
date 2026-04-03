-- Run this in MySQL Workbench
-- Adds block + deactivation columns to users table

ALTER TABLE syncbeat.users ADD COLUMN is_blocked TINYINT(1) DEFAULT 0 AFTER role;
ALTER TABLE syncbeat.users ADD COLUMN block_reason VARCHAR(255) DEFAULT NULL AFTER is_blocked;
ALTER TABLE syncbeat.users ADD COLUMN blocked_at TIMESTAMP NULL DEFAULT NULL AFTER block_reason;
ALTER TABLE syncbeat.users ADD COLUMN deactivated_until TIMESTAMP NULL DEFAULT NULL AFTER blocked_at;