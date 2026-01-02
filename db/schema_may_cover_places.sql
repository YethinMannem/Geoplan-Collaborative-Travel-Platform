-- Geospatial Web Application - May Cover Places Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema adds support for "may cover places" - places that users
--   might want to visit but haven't added to their main route yet.

-- ============================================================================
-- MAY_COVER_PLACES TABLE
-- Stores places that may be covered (potential places for the route)
-- ============================================================================
CREATE TABLE IF NOT EXISTS may_cover_places (
    may_cover_place_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,  -- Can be from group_routes or user_group_routes
    route_type VARCHAR(20) NOT NULL,  -- 'group' or 'user'
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_may_cover_route_type CHECK (route_type IN ('group', 'user')),
    CONSTRAINT fk_may_cover_places_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
    CONSTRAINT unique_may_cover_place_per_route UNIQUE (route_id, route_type, place_id)
);

CREATE INDEX IF NOT EXISTS idx_may_cover_places_route ON may_cover_places(route_id, route_type);
CREATE INDEX IF NOT EXISTS idx_may_cover_places_place ON may_cover_places(place_id);
COMMENT ON TABLE may_cover_places IS 'Places that may be covered (potential places for the route)';

