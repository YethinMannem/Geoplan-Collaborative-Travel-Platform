-- Geospatial Web Application - User Profile Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema adds user profile fields for account management:
--   - Display name (can be different from username)
--   - Profile photo URL
--   - Bio/description
--   - Additional profile information

-- ============================================================================
-- ALTER USERS TABLE - Add Profile Fields
-- ============================================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Add index for display_name searches
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);

-- Add comment
COMMENT ON COLUMN users.display_name IS 'User display name (can be different from username)';
COMMENT ON COLUMN users.profile_photo_url IS 'URL to user profile photo';
COMMENT ON COLUMN users.bio IS 'User biography/description';
COMMENT ON COLUMN users.location IS 'User location';
COMMENT ON COLUMN users.website IS 'User website URL';

