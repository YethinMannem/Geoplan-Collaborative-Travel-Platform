-- Geospatial Web Application - Groups Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema adds group functionality where users can create groups
--   and see which group members have places in their lists (visited, wishlist, liked)

-- ============================================================================
-- 1. GROUPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
    group_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_group_name_length CHECK (LENGTH(name) >= 3 AND LENGTH(name) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
COMMENT ON TABLE groups IS 'User groups for sharing place lists';

-- ============================================================================
-- 2. GROUP_MEMBERS TABLE (Many-to-Many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(20) DEFAULT 'member',  -- 'admin', 'member'
    
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT chk_member_role CHECK (role IN ('admin', 'member')),
    CONSTRAINT fk_group_member_group FOREIGN KEY (group_id) REFERENCES groups(group_id),
    CONSTRAINT fk_group_member_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
COMMENT ON TABLE group_members IS 'Membership of users in groups';

-- ============================================================================
-- Helper View: Group Places with Member Status
-- Shows all places and which group members have them in their lists
-- ============================================================================
CREATE OR REPLACE VIEW group_places_member_status AS
SELECT 
    g.group_id,
    g.name as group_name,
    p.id as place_id,
    p.name as place_name,
    p.city,
    p.state,
    p.country,
    p.lat,
    p.lon,
    u.user_id as member_id,
    u.username as member_username,
    CASE WHEN v.visit_id IS NOT NULL THEN TRUE ELSE FALSE END as member_visited,
    CASE WHEN w.wish_id IS NOT NULL THEN TRUE ELSE FALSE END as member_in_wishlist,
    CASE WHEN l.like_id IS NOT NULL THEN TRUE ELSE FALSE END as member_liked,
    v.visited_at,
    w.added_at as wishlist_added_at,
    l.liked_at
FROM groups g
CROSS JOIN places p
CROSS JOIN group_members gm
JOIN users u ON gm.user_id = u.user_id
LEFT JOIN user_visited_places v ON v.user_id = u.user_id AND v.place_id = p.id
LEFT JOIN user_wishlist w ON w.user_id = u.user_id AND w.place_id = p.id
LEFT JOIN user_liked_places l ON l.user_id = u.user_id AND l.place_id = p.id
WHERE gm.group_id = g.group_id;

COMMENT ON VIEW group_places_member_status IS 'Shows places and member list statuses for each group';

