-- Geospatial Web Application - User Lists Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema adds user account management and personal lists functionality
--   to the geospatial application. Users can save places to personal lists:
--   - Visited (places they've been to)
--   - Wishlist (places they want to visit)
--   - Liked/Favorites (places they liked)
--
-- Tables:
--   1. users - User accounts
--   2. user_visited_places - Visited list
--   3. user_wishlist - Places to visit later
--   4. user_liked_places - Favorites/liked places

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_username_length CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 50),
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
COMMENT ON TABLE users IS 'User accounts for personalized lists';

-- ============================================================================
-- 2. USER_VISITED_PLACES (Places user has been to)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_visited_places (
    visit_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    UNIQUE(user_id, place_id),
    CONSTRAINT fk_user_visited FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_place_visited FOREIGN KEY (place_id) REFERENCES places(id)
);

CREATE INDEX IF NOT EXISTS idx_visited_user ON user_visited_places(user_id);
CREATE INDEX IF NOT EXISTS idx_visited_place ON user_visited_places(place_id);
CREATE INDEX IF NOT EXISTS idx_visited_date ON user_visited_places(visited_at DESC);
COMMENT ON TABLE user_visited_places IS 'Track places users have visited';

-- ============================================================================
-- 3. USER_WISHLIST (Places user wants to visit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_wishlist (
    wish_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1,  -- 1=normal, 2=high, 3=urgent
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,  -- Optional: "Visit during happy hour"
    
    UNIQUE(user_id, place_id),
    CONSTRAINT chk_priority_range CHECK (priority >= 1 AND priority <= 3),
    CONSTRAINT fk_user_wish FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_place_wish FOREIGN KEY (place_id) REFERENCES places(id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON user_wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_place ON user_wishlist(place_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_priority ON user_wishlist(priority DESC, added_at DESC);
COMMENT ON TABLE user_wishlist IS 'Places users want to visit (wishlist)';

-- ============================================================================
-- 4. USER_LIKED_PLACES (Favorites - places user liked)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_liked_places (
    like_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rating INTEGER,  -- Optional: 1-5 stars (can be NULL)
    notes TEXT,  -- Optional review/notes
    
    UNIQUE(user_id, place_id),
    CONSTRAINT chk_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT fk_user_liked FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_place_liked FOREIGN KEY (place_id) REFERENCES places(id)
);

CREATE INDEX IF NOT EXISTS idx_liked_user ON user_liked_places(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_place ON user_liked_places(place_id);
CREATE INDEX IF NOT EXISTS idx_liked_date ON user_liked_places(liked_at DESC);
COMMENT ON TABLE user_liked_places IS 'Places users have liked/favorited';

-- ============================================================================
-- Helper View: User Place Status (shows if place is in any list)
-- ============================================================================
CREATE OR REPLACE VIEW user_place_status AS
SELECT 
    u.user_id,
    p.id as place_id,
    CASE WHEN v.visit_id IS NOT NULL THEN TRUE ELSE FALSE END as is_visited,
    CASE WHEN w.wish_id IS NOT NULL THEN TRUE ELSE FALSE END as in_wishlist,
    CASE WHEN l.like_id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked,
    v.visited_at,
    w.added_at as wishlist_added_at,
    w.priority as wishlist_priority,
    l.liked_at,
    l.rating
FROM users u
CROSS JOIN places p
LEFT JOIN user_visited_places v ON v.user_id = u.user_id AND v.place_id = p.id
LEFT JOIN user_wishlist w ON w.user_id = u.user_id AND w.place_id = p.id
LEFT JOIN user_liked_places l ON l.user_id = u.user_id AND l.place_id = p.id;

COMMENT ON VIEW user_place_status IS 'Shows status of each place for each user (visited, wishlist, liked)';

