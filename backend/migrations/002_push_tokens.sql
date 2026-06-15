-- Add Expo push token column to users table for mobile push notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
