-- Geospatial Web Application - Route Planner Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema adds route planning functionality where users can create
--   custom routes within groups, with support for both group default routes
--   and user-customized routes.

-- ============================================================================
-- 1. GROUP_ROUTES TABLE
-- Stores group-level default routes
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_routes (
    route_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_group_default_route UNIQUE (group_id)
);

CREATE INDEX IF NOT EXISTS idx_group_routes_group ON group_routes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_routes_created_by ON group_routes(created_by);
COMMENT ON TABLE group_routes IS 'Default routes for groups (one per group)';

-- ============================================================================
-- 2. USER_GROUP_ROUTES TABLE
-- Stores user-customized routes for groups (overrides group default)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_group_routes (
    route_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_group_route UNIQUE (group_id, user_id),
    CONSTRAINT fk_user_group_route_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_group_route_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_group_routes_group ON user_group_routes(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_routes_user ON user_group_routes(user_id);
COMMENT ON TABLE user_group_routes IS 'User-customized routes for groups (one per user per group)';

-- ============================================================================
-- 3. ROUTE_PLACES TABLE
-- Stores places in routes with their order/index
-- ============================================================================
CREATE TABLE IF NOT EXISTS route_places (
    route_place_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,  -- Can be from group_routes or user_group_routes
    route_type VARCHAR(20) NOT NULL,  -- 'group' or 'user'
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,  -- Order in the route (0, 1, 2, ...)
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_route_type CHECK (route_type IN ('group', 'user')),
    CONSTRAINT fk_route_places_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_route_places_route ON route_places(route_id, route_type);
CREATE INDEX IF NOT EXISTS idx_route_places_place ON route_places(place_id);
CREATE INDEX IF NOT EXISTS idx_route_places_order ON route_places(route_id, route_type, order_index);
COMMENT ON TABLE route_places IS 'Places in routes with order/index';

-- ============================================================================
-- Trigger: Update updated_at timestamp on route changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_group_route_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE group_routes SET updated_at = CURRENT_TIMESTAMP 
        WHERE route_id = OLD.route_id;
        RETURN OLD;
    ELSE
        UPDATE group_routes SET updated_at = CURRENT_TIMESTAMP 
        WHERE route_id = NEW.route_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_route_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE user_group_routes SET updated_at = CURRENT_TIMESTAMP 
        WHERE route_id = OLD.route_id;
        RETURN OLD;
    ELSE
        UPDATE user_group_routes SET updated_at = CURRENT_TIMESTAMP 
        WHERE route_id = NEW.route_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger on route_places insert/update/delete for group routes
CREATE TRIGGER trg_update_group_route_timestamp_insert_update
AFTER INSERT OR UPDATE ON route_places
FOR EACH ROW
WHEN (NEW.route_type = 'group')
EXECUTE FUNCTION update_group_route_timestamp();

CREATE TRIGGER trg_update_group_route_timestamp_delete
AFTER DELETE ON route_places
FOR EACH ROW
WHEN (OLD.route_type = 'group')
EXECUTE FUNCTION update_group_route_timestamp();

-- Trigger on route_places insert/update/delete for user routes
CREATE TRIGGER trg_update_user_route_timestamp_insert_update
AFTER INSERT OR UPDATE ON route_places
FOR EACH ROW
WHEN (NEW.route_type = 'user')
EXECUTE FUNCTION update_user_route_timestamp();

CREATE TRIGGER trg_update_user_route_timestamp_delete
AFTER DELETE ON route_places
FOR EACH ROW
WHEN (OLD.route_type = 'user')
EXECUTE FUNCTION update_user_route_timestamp();

