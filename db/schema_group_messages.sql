-- Geospatial Web Application - Group Messages Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema adds group messaging functionality to allow group members
--   to communicate with each other within a group.

-- Create group_messages table
CREATE TABLE IF NOT EXISTS group_messages (
    message_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited BOOLEAN DEFAULT FALSE,
    
    -- Ensure message text is not empty
    CONSTRAINT chk_message_text_not_empty CHECK (LENGTH(TRIM(message_text)) > 0),
    CONSTRAINT chk_message_text_length CHECK (LENGTH(message_text) <= 5000)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_user_id ON group_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created ON group_messages(group_id, created_at DESC);

-- Add comments
COMMENT ON TABLE group_messages IS 'Messages sent by users within groups';
COMMENT ON COLUMN group_messages.message_id IS 'Unique identifier for each message';
COMMENT ON COLUMN group_messages.group_id IS 'The group this message belongs to';
COMMENT ON COLUMN group_messages.user_id IS 'The user who sent the message';
COMMENT ON COLUMN group_messages.message_text IS 'The message content (max 5000 characters)';
COMMENT ON COLUMN group_messages.created_at IS 'When the message was created';
COMMENT ON COLUMN group_messages.updated_at IS 'When the message was last updated';
COMMENT ON COLUMN group_messages.edited IS 'Whether the message has been edited';

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_group_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.edited = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_messages_updated_at
    BEFORE UPDATE ON group_messages
    FOR EACH ROW
    WHEN (OLD.message_text IS DISTINCT FROM NEW.message_text)
    EXECUTE FUNCTION update_group_messages_updated_at();

