-- Geospatial Web Application - Foreign Key and Primary Key Constraints
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This file adds normalized tables with Primary Key (PK) and Foreign Key (FK)
--   constraints to demonstrate database normalization and referential integrity.
--
-- Database Concepts Demonstrated:
--   1. Primary Key Constraints (PK)
--   2. Foreign Key Constraints (FK)
--   3. Referential Integrity
--   4. Database Normalization (1NF, 2NF)
--   5. Cascade Delete/Restrict behaviors
--   6. Unique Constraints
--
-- Table Relationships:
--   states (PK: state_code) 
--     ↑
--     │ (FK: state_code)
--     │
--   cities (PK: city_id, FK: state_code)
--     ↑
--     │ (FK: city_id)
--     │
--   places (FK: city_id, FK: state_code)

-- ============================================================================
-- 1. STATES TABLE (Referenced Table - Parent)
-- ============================================================================
-- Stores unique state information with primary key constraint

CREATE TABLE IF NOT EXISTS states (
    state_code VARCHAR(2) PRIMARY KEY,              -- Primary Key: 2-letter state code (e.g., 'CA', 'TX')
    state_name VARCHAR(100) NOT NULL UNIQUE,        -- Unique constraint: State full name
    country VARCHAR(2) DEFAULT 'US' NOT NULL,       -- Country code (mostly US)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Audit field
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Audit field
    
    -- Constraints
    CONSTRAINT chk_state_code_format CHECK (LENGTH(state_code) = 2 AND UPPER(state_code) = state_code),
    CONSTRAINT chk_country_format CHECK (LENGTH(country) = 2 AND UPPER(country) = country)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_states_name ON states(state_name);
CREATE INDEX IF NOT EXISTS idx_states_country ON states(country);

COMMENT ON TABLE states IS 'Stores state/province information with primary key constraint';
COMMENT ON COLUMN states.state_code IS 'Primary Key: 2-letter uppercase state code (e.g., CA, TX, NY)';
COMMENT ON COLUMN states.state_name IS 'Full state name with unique constraint';

-- ============================================================================
-- 2. CITIES TABLE (Referenced Table - Parent, References States)
-- ============================================================================
-- Stores unique city information with composite uniqueness and foreign key

CREATE TABLE IF NOT EXISTS cities (
    city_id SERIAL PRIMARY KEY,                     -- Primary Key: Auto-incrementing ID
    city_name VARCHAR(100) NOT NULL,                -- City name
    state_code VARCHAR(2) NOT NULL,                 -- Foreign Key to states
    country VARCHAR(2) DEFAULT 'US' NOT NULL,       -- Country code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Audit field
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Audit field
    
    -- Foreign Key Constraint: References states table
    CONSTRAINT fk_cities_state 
        FOREIGN KEY (state_code) 
        REFERENCES states(state_code)
        ON DELETE RESTRICT        -- Prevent deletion if cities exist
        ON UPDATE CASCADE,        -- Update city state_code if states.state_code changes
    
    -- Unique Constraint: Same city name can exist in different states
    CONSTRAINT uk_city_state_country 
        UNIQUE (city_name, state_code, country),
    
    -- Check constraints
    CONSTRAINT chk_city_name_not_empty CHECK (LENGTH(TRIM(city_name)) > 0)
);

-- Indexes for faster lookups and FK performance
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(city_name);
CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state_code);  -- Important for FK joins
CREATE INDEX IF NOT EXISTS idx_cities_state_name ON cities(state_code, city_name);

COMMENT ON TABLE cities IS 'Stores city information with foreign key to states table';
COMMENT ON COLUMN cities.city_id IS 'Primary Key: Auto-incrementing unique identifier';
COMMENT ON COLUMN cities.state_code IS 'Foreign Key: References states(state_code)';

-- ============================================================================
-- 3. UPDATE PLACES TABLE WITH FOREIGN KEYS
-- ============================================================================
-- Add foreign key columns and constraints to existing places table

-- Step 1: Add new columns for foreign keys (nullable initially for migration)
ALTER TABLE places 
    ADD COLUMN IF NOT EXISTS city_id INTEGER,
    ADD COLUMN IF NOT EXISTS state_code_fk VARCHAR(2);

-- Step 2: Create foreign key constraints
-- Foreign Key: city_id references cities
ALTER TABLE places
    DROP CONSTRAINT IF EXISTS fk_places_city,
    ADD CONSTRAINT fk_places_city 
        FOREIGN KEY (city_id) 
        REFERENCES cities(city_id)
        ON DELETE SET NULL          -- If city deleted, set city_id to NULL (soft delete)
        ON UPDATE CASCADE;          -- If city_id changes, update places

-- Foreign Key: state_code_fk references states
ALTER TABLE places
    DROP CONSTRAINT IF EXISTS fk_places_state,
    ADD CONSTRAINT fk_places_state 
        FOREIGN KEY (state_code_fk) 
        REFERENCES states(state_code)
        ON DELETE RESTRICT          -- Prevent deletion if places exist in that state
        ON UPDATE CASCADE;          -- If state_code changes, update places

-- Step 3: Create indexes on foreign key columns for join performance
CREATE INDEX IF NOT EXISTS idx_places_city_id ON places(city_id);
CREATE INDEX IF NOT EXISTS idx_places_state_code_fk ON places(state_code_fk);

-- Step 4: Add unique constraint on source_id (if it should be unique)
ALTER TABLE places
    DROP CONSTRAINT IF EXISTS uk_places_source_id,
    ADD CONSTRAINT uk_places_source_id 
        UNIQUE (source_id);

COMMENT ON TABLE places IS 'Stores brewery locations with foreign keys to cities and states tables';
COMMENT ON COLUMN places.city_id IS 'Foreign Key: References cities(city_id)';
COMMENT ON COLUMN places.state_code_fk IS 'Foreign Key: References states(state_code)';

-- ============================================================================
-- 4. ADDITIONAL CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Check constraint: Ensure coordinates are within valid ranges
ALTER TABLE places
    DROP CONSTRAINT IF EXISTS chk_lat_range,
    ADD CONSTRAINT chk_lat_range 
        CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));

ALTER TABLE places
    DROP CONSTRAINT IF EXISTS chk_lon_range,
    ADD CONSTRAINT chk_lon_range 
        CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180));

-- Check constraint: Ensure geometry matches lat/lon if both exist
ALTER TABLE places
    DROP CONSTRAINT IF EXISTS chk_geom_coords_match,
    ADD CONSTRAINT chk_geom_coords_match 
        CHECK (
            geom IS NULL OR 
            lat IS NULL OR 
            lon IS NULL OR
            (ABS(ST_X(geom) - lon) < 0.0001 AND ABS(ST_Y(geom) - lat) < 0.0001)
        );

-- ============================================================================
-- 5. CREATE JUNCTION TABLE FOR MANY-TO-MANY RELATIONSHIP (Optional)
-- ============================================================================
-- Example: Places can have multiple categories/tags

CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,                 -- Primary Key
    category_name VARCHAR(50) NOT NULL UNIQUE,      -- Unique constraint
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS place_categories (
    place_id INTEGER NOT NULL,                      -- Foreign Key to places
    category_id INTEGER NOT NULL,                   -- Foreign Key to categories
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite Primary Key
    CONSTRAINT pk_place_categories 
        PRIMARY KEY (place_id, category_id),
    
    -- Foreign Keys
    CONSTRAINT fk_place_categories_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id)
        ON DELETE CASCADE,          -- If place deleted, delete all category associations
    
    CONSTRAINT fk_place_categories_category 
        FOREIGN KEY (category_id) 
        REFERENCES categories(category_id)
        ON DELETE CASCADE           -- If category deleted, delete all associations
);

-- Indexes for junction table
CREATE INDEX IF NOT EXISTS idx_place_categories_place ON place_categories(place_id);
CREATE INDEX IF NOT EXISTS idx_place_categories_category ON place_categories(category_id);

COMMENT ON TABLE place_categories IS 'Junction table for many-to-many relationship between places and categories';
COMMENT ON COLUMN place_categories.place_id IS 'Foreign Key: References places(id)';
COMMENT ON COLUMN place_categories.category_id IS 'Foreign Key: References categories(category_id)';

-- ============================================================================
-- 6. SUMMARY OF CONSTRAINTS ADDED
-- ============================================================================
-- Primary Keys (PK):
--   - states.state_code (PK)
--   - cities.city_id (PK)
--   - places.id (PK - already existed)
--   - categories.category_id (PK)
--   - place_categories(place_id, category_id) (Composite PK)
--
-- Foreign Keys (FK):
--   - cities.state_code → states.state_code
--   - places.city_id → cities.city_id
--   - places.state_code_fk → states.state_code
--   - place_categories.place_id → places.id
--   - place_categories.category_id → categories.category_id
--
-- Unique Constraints:
--   - states.state_name (UNIQUE)
--   - cities(city_name, state_code, country) (Composite UNIQUE)
--   - places.source_id (UNIQUE)
--   - categories.category_name (UNIQUE)
--
-- Check Constraints:
--   - states: state_code format, country format
--   - cities: city_name not empty
--   - places: lat/lon ranges, geometry matches coordinates
--
-- Cascade Behaviors:
--   - ON DELETE RESTRICT: Prevent deletion if child records exist (states, cities)
--   - ON DELETE SET NULL: Set FK to NULL if parent deleted (places.city_id)
--   - ON DELETE CASCADE: Delete child records if parent deleted (place_categories)
--   - ON UPDATE CASCADE: Update FK if parent PK changes (all FK constraints)


