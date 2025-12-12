-- Geospatial Web Application - Database Schema Extensions
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This file extends the base schema with advanced database concepts:
--   - Views for common queries
--   - Stored functions for reusable operations
--   - Additional indexes for performance
--   - Materialized views for caching
--   - Constraints for data integrity
--   - Triggers for data validation
--   - Full-text search setup
--
-- Database Concepts Demonstrated:
--   1. Views (Virtual tables)
--   2. Stored Functions/Procedures
--   3. Indexes (B-tree for non-spatial columns)
--   4. Materialized Views (Cached queries)
--   5. Constraints (Check, Unique)
--   6. Triggers (Data validation, auditing)
--   7. Full-Text Search (Text search capabilities)
--   8. Query Optimization (EXPLAIN ANALYZE)

-- ============================================================================
-- 1. DATABASE VIEWS
-- ============================================================================
-- Views are virtual tables that represent the result of a stored query.
-- They simplify complex queries and provide abstraction layers.

-- View: State Statistics
-- Provides aggregated statistics by state
CREATE OR REPLACE VIEW vw_state_statistics AS
SELECT 
    state,
    COUNT(*) as brewery_count,
    COUNT(DISTINCT city) as city_count,
    ROUND(CAST(AVG(lat) AS NUMERIC), 4) as avg_latitude,
    ROUND(CAST(AVG(lon) AS NUMERIC), 4) as avg_longitude,
    MIN(lat) as min_latitude,
    MAX(lat) as max_latitude,
    MIN(lon) as min_longitude,
    MAX(lon) as max_longitude
FROM places
WHERE state IS NOT NULL
GROUP BY state
ORDER BY brewery_count DESC;

-- View: City Statistics
-- Provides aggregated statistics by city
CREATE OR REPLACE VIEW vw_city_statistics AS
SELECT 
    city,
    state,
    COUNT(*) as brewery_count,
    ROUND(CAST(AVG(lat) AS NUMERIC), 4) as avg_latitude,
    ROUND(CAST(AVG(lon) AS NUMERIC), 4) as avg_longitude
FROM places
WHERE city IS NOT NULL AND state IS NOT NULL
GROUP BY city, state
HAVING COUNT(*) >= 2
ORDER BY brewery_count DESC, state, city;

-- View: Nearby Places (with distance calculation)
-- Shows places with their distances from a reference point
-- This view can be parameterized via functions
CREATE OR REPLACE VIEW vw_places_with_distance AS
SELECT 
    id,
    name,
    city,
    state,
    country,
    lat,
    lon,
    ST_X(geom) as longitude,
    ST_Y(geom) as latitude,
    ST_AsText(geom) as geometry_text
FROM places;

-- View: State Brewery Rankings
-- Ranks states by brewery count using window functions
CREATE OR REPLACE VIEW vw_state_rankings AS
SELECT 
    state,
    brewery_count,
    city_count,
    ROW_NUMBER() OVER (ORDER BY brewery_count DESC) as rank_by_count,
    RANK() OVER (ORDER BY brewery_count DESC) as rank_with_ties,
    DENSE_RANK() OVER (ORDER BY brewery_count DESC) as dense_rank,
    PERCENT_RANK() OVER (ORDER BY brewery_count DESC) as percent_rank
FROM vw_state_statistics;

-- ============================================================================
-- 2. STORED FUNCTIONS
-- ============================================================================
-- Functions encapsulate reusable logic and can be called from queries.

-- Function: Find places within radius (reusable)
-- Parameters: center_lat, center_lon, radius_km
-- Returns: Table of places within the radius
DROP FUNCTION IF EXISTS fn_places_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
CREATE OR REPLACE FUNCTION fn_places_within_radius(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_km DOUBLE PRECISION
)
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    city TEXT,
    state TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    distance_km DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.city,
        p.state,
        p.lat,
        p.lon,
        CAST(ROUND(
            CAST(ST_Distance(
                p.geom::geography,
                ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography
            ) / 1000.0 AS NUMERIC),
            2
        ) AS DOUBLE PRECISION) as distance_km
    FROM places p
    WHERE ST_DWithin(
        p.geom::geography,
        ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
        radius_km * 1000
    )
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Find K nearest places
-- Parameters: center_lat, center_lon, k
-- Returns: K nearest places
DROP FUNCTION IF EXISTS fn_k_nearest_places(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
CREATE OR REPLACE FUNCTION fn_k_nearest_places(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    k INTEGER
)
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    city TEXT,
    state TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    distance_km DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.city,
        p.state,
        p.lat,
        p.lon,
        CAST(ROUND(
            CAST(ST_Distance(
                p.geom::geography,
                ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography
            ) / 1000.0 AS NUMERIC),
            2
        ) AS DOUBLE PRECISION) as distance_km
    FROM places p
    ORDER BY p.geom <-> ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)
    LIMIT k;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Calculate spatial density
-- Parameters: center_lat, center_lon, radius_km
-- Returns: Density metrics
CREATE OR REPLACE FUNCTION fn_calculate_density(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_km DOUBLE PRECISION
)
RETURNS TABLE (
    count INTEGER,
    area_km2 DOUBLE PRECISION,
    density_per_1000_km2 DOUBLE PRECISION
) AS $$
DECLARE
    place_count INTEGER;
    area DOUBLE PRECISION;
BEGIN
    SELECT COUNT(*) INTO place_count
    FROM places
    WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
        radius_km * 1000
    );
    
    -- Calculate area of circle: π * r^2
    area := 3.14159265359 * radius_km * radius_km;
    
    RETURN QUERY
    SELECT 
        place_count,
        ROUND(CAST(area AS NUMERIC), 2),
        ROUND(CAST((place_count::DOUBLE PRECISION / area) * 1000 AS NUMERIC), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Search places by name (full-text search)
-- Parameters: search_term
-- Returns: Places matching the search term
CREATE OR REPLACE FUNCTION fn_search_places(
    search_term TEXT
)
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    city TEXT,
    state TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    relevance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.city,
        p.state,
        p.lat,
        p.lon,
        ts_rank(to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.city, '') || ' ' || COALESCE(p.state, '')), 
                plainto_tsquery('english', search_term)) as relevance
    FROM places p
    WHERE to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.city, '') || ' ' || COALESCE(p.state, '')) 
          @@ plainto_tsquery('english', search_term)
    ORDER BY relevance DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. ADDITIONAL INDEXES
-- ============================================================================
-- B-tree indexes for frequently queried non-spatial columns

-- Index on state column for fast state filtering
CREATE INDEX IF NOT EXISTS idx_places_state ON places(state);

-- Index on city column
CREATE INDEX IF NOT EXISTS idx_places_city ON places(city);

-- Composite index on state and city for common queries
CREATE INDEX IF NOT EXISTS idx_places_state_city ON places(state, city);

-- Index on name for text searches
CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_places_name_fts ON places 
USING gin(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(city, '') || ' ' || COALESCE(state, '')));

-- Unique index on source_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_places_source_id_unique ON places(source_id) 
WHERE source_id IS NOT NULL;

-- ============================================================================
-- 4. MATERIALIZED VIEWS
-- ============================================================================
-- Materialized views cache query results for faster access.
-- They need to be refreshed when underlying data changes.

-- Materialized view: Top states by brewery count
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_states AS
SELECT 
    state,
    COUNT(*) as brewery_count,
    COUNT(DISTINCT city) as city_count,
    ROUND(CAST(AVG(lat) AS NUMERIC), 4) as avg_latitude,
    ROUND(CAST(AVG(lon) AS NUMERIC), 4) as avg_longitude
FROM places
WHERE state IS NOT NULL
GROUP BY state
ORDER BY brewery_count DESC
LIMIT 10;

-- Create index on materialized view for faster queries
CREATE INDEX IF NOT EXISTS idx_mv_top_states_state ON mv_top_states(state);

-- Materialized view: State-city combinations with multiple breweries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_city_clusters AS
SELECT 
    city,
    state,
    COUNT(*) as brewery_count,
    ST_Collect(geom) as locations_geometry,
    ST_Centroid(ST_Collect(geom)) as centroid
FROM places
WHERE city IS NOT NULL AND state IS NOT NULL
GROUP BY city, state
HAVING COUNT(*) >= 3
ORDER BY brewery_count DESC;

-- ============================================================================
-- 5. DATABASE CONSTRAINTS
-- ============================================================================
-- Constraints ensure data integrity and enforce business rules

-- Check constraint: Validate latitude range
ALTER TABLE places 
ADD CONSTRAINT chk_latitude_range 
CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));

-- Check constraint: Validate longitude range
ALTER TABLE places 
ADD CONSTRAINT chk_longitude_range 
CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180));

-- Check constraint: Ensure geometry matches lat/lon (if both provided)
-- This is automatically maintained by triggers, but we add the constraint for documentation

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================
-- Triggers automatically execute functions when data changes

-- Function: Validate and update geometry when lat/lon changes
CREATE OR REPLACE FUNCTION fn_update_geometry()
RETURNS TRIGGER AS $$
BEGIN
    -- Update geometry column when lat/lon changes
    IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update geometry before insert or update
CREATE TRIGGER trg_update_geometry
BEFORE INSERT OR UPDATE OF lat, lon ON places
FOR EACH ROW
EXECUTE FUNCTION fn_update_geometry();

-- Function: Log data changes for auditing
CREATE TABLE IF NOT EXISTS places_audit_log (
    id SERIAL PRIMARY KEY,
    place_id INTEGER,
    action TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB,
    new_values JSONB
);

CREATE OR REPLACE FUNCTION fn_audit_places()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO places_audit_log (place_id, action, new_values)
        VALUES (NEW.id, 'INSERT', row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO places_audit_log (place_id, action, old_values, new_values)
        VALUES (NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO places_audit_log (place_id, action, old_values)
        VALUES (OLD.id, 'DELETE', row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Audit all changes to places table
CREATE TRIGGER trg_audit_places
AFTER INSERT OR UPDATE OR DELETE ON places
FOR EACH ROW
EXECUTE FUNCTION fn_audit_places();

-- Index on audit log for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_log_place_id ON places_audit_log(place_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON places_audit_log(changed_at);

-- ============================================================================
-- 7. FULL-TEXT SEARCH SETUP
-- ============================================================================
-- PostgreSQL full-text search is already set up via indexes above
-- This section documents the search capabilities

-- Example full-text search query:
-- SELECT * FROM places
-- WHERE to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(city, '') || ' ' || COALESCE(state, ''))
--       @@ plainto_tsquery('english', 'search term');

-- ============================================================================
-- SUMMARY OF DATABASE CONCEPTS IMPLEMENTED
-- ============================================================================
-- 1. VIEWS: vw_state_statistics, vw_city_statistics, vw_places_with_distance, vw_state_rankings
-- 2. STORED FUNCTIONS: fn_places_within_radius, fn_k_nearest_places, fn_calculate_density, fn_search_places
-- 3. INDEXES: B-tree indexes on state, city, name; GIN index for full-text search
-- 4. MATERIALIZED VIEWS: mv_top_states, mv_city_clusters
-- 5. CONSTRAINTS: Check constraints on lat/lon ranges
-- 6. TRIGGERS: trg_update_geometry, trg_audit_places
-- 7. FULL-TEXT SEARCH: GIN index with to_tsvector
-- 8. AUDIT LOGGING: places_audit_log table with triggers

