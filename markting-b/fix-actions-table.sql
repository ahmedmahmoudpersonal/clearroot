-- Fix actions table by adding missing columns
-- Run this script on your PostgreSQL database

-- Add missing columns to actions table
ALTER TABLE actions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'start';
ALTER TABLE actions ADD COLUMN IF NOT EXISTS process_name VARCHAR(255);
ALTER TABLE actions ADD COLUMN IF NOT EXISTS message VARCHAR(1000);
ALTER TABLE actions ADD COLUMN IF NOT EXISTS excel_link VARCHAR(500);
ALTER TABLE actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to have timestamps if they don't exist
UPDATE actions SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE actions SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
