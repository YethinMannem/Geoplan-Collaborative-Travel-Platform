-- Geospatial Web Application - Scalable Database Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema implements a highly scalable, normalized database design
--   with proper foreign key relationships and extensibility in mind.
--
-- Design Principles:
--   1. Normalization (3NF) - Eliminate redundancy
--   2. Referential Integrity - Enforce relationships
--   3. Scalability - Support growth without major changes
--   4. Extensibility - Easy to add new features
--   5. Performance - Proper indexes on FK columns
--
-- Tables:
--   1. countries (PK: country_code)
--   2. regions/states (PK: region_id, FK: country_code)
--   3. cities (PK: city_id, FK: region_id)
--   4. places (PK: place_id, FK: city_id, FK: region_id)
--   5. place_types (PK: type_id) - Categories/types of places
--   6. place_type_assignments (PK: assignment_id, FK: place_id, FK: type_id)
--   7. place_ratings (PK: rating_id, FK: place_id) - For future ratings/reviews
--   8. audit_log (PK: log_id, FK: place_id) - Centralized audit logging
--
-- Total: 8 tables (exceeds minimum of 5)

-- ============================================================================
-- 1. COUNTRIES TABLE (Root Level - No Dependencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS countries (
    country_code VARCHAR(2) PRIMARY KEY,           -- ISO 3166-1 alpha-2 code (e.g., 'US', 'CA')
    country_name VARCHAR(100) NOT NULL UNIQUE,     -- Full country name
    continent VARCHAR(50),                          -- Continent name
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_country_code_format CHECK (LENGTH(country_code) = 2 AND UPPER(country_code) = country_code)
);

CREATE INDEX IF NOT EXISTS idx_countries_name ON countries(country_name);
COMMENT ON TABLE countries IS 'Master table for all countries - root of geographic hierarchy';

-- ============================================================================
-- 2. REGIONS/STATES TABLE (Depends on Countries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS regions (
    region_id SERIAL PRIMARY KEY,
    region_code VARCHAR(10) NOT NULL,              -- State/Province code (e.g., 'CA', 'TX', 'ON')
    region_name VARCHAR(100) NOT NULL,             -- Full region name
    country_code VARCHAR(2) NOT NULL,              -- FK to countries
    region_type VARCHAR(50) DEFAULT 'state',       -- 'state', 'province', 'territory', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key to countries
    CONSTRAINT fk_regions_country 
        FOREIGN KEY (country_code) 
        REFERENCES countries(country_code)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    -- Unique constraint: same region code can exist in different countries
    CONSTRAINT uk_region_code_country 
        UNIQUE (region_code, country_code),
    
    CONSTRAINT chk_region_code_not_empty CHECK (LENGTH(TRIM(region_code)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_regions_country ON regions(country_code);
CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(region_code);
CREATE INDEX IF NOT EXISTS idx_regions_name ON regions(region_name);
COMMENT ON TABLE regions IS 'States, provinces, or territories - depends on countries';

-- ============================================================================
-- 3. CITIES TABLE (Depends on Regions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cities (
    city_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL,
    region_id INTEGER NOT NULL,                    -- FK to regions
    country_code VARCHAR(2) NOT NULL,              -- Denormalized for performance (can be derived)
    population INTEGER,                             -- Optional: population data
    timezone VARCHAR(50),                          -- Optional: timezone
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key to regions
    CONSTRAINT fk_cities_region 
        FOREIGN KEY (region_id) 
        REFERENCES regions(region_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    -- Foreign Key to countries (denormalized for query performance)
    CONSTRAINT fk_cities_country 
        FOREIGN KEY (country_code) 
        REFERENCES countries(country_code)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    -- Unique constraint: same city name can exist in different regions
    CONSTRAINT uk_city_region 
        UNIQUE (city_name, region_id),
    
    CONSTRAINT chk_city_name_not_empty CHECK (LENGTH(TRIM(city_name)) > 0),
    CONSTRAINT chk_population_positive CHECK (population IS NULL OR population >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cities_region ON cities(region_id);
CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country_code);
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(city_name);
COMMENT ON TABLE cities IS 'Cities - depends on regions and countries';

-- ============================================================================
-- 4. PLACE TYPES TABLE (Independent - For Categorization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS place_types (
    type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,         -- e.g., 'Microbrewery', 'Brewpub', 'Taproom'
    type_description TEXT,
    category VARCHAR(50),                          -- e.g., 'Brewery', 'Restaurant', 'Bar'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_type_name_not_empty CHECK (LENGTH(TRIM(type_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_place_types_category ON place_types(category);
CREATE INDEX IF NOT EXISTS idx_place_types_active ON place_types(is_active);
COMMENT ON TABLE place_types IS 'Categorization system for places - independent table';

-- ============================================================================
-- 5. PLACES TABLE (Main Entity - Depends on Cities and Regions)
-- ============================================================================
-- Note: This ALTERs the existing places table to add FK columns
-- The existing places table has 'id' as PK, we'll keep that and add FKs

-- First, ensure we have the basic structure (if places doesn't exist yet)
-- Note: Places table already exists from base schema (db/schema.sql)
-- We'll use ALTER statements to add FK columns (see schema_scalable_alter.sql)
-- This section is commented out to avoid conflicts with existing table

-- The existing places table structure is:
--   id SERIAL PRIMARY KEY
--   source_id TEXT
--   name TEXT
--   city TEXT
--   state TEXT  
--   country TEXT
--   lat DOUBLE PRECISION
--   lon DOUBLE PRECISION
--   geom geometry(Point, 4326)

-- Foreign key columns will be added via ALTER statements (schema_scalable_alter.sql)

-- Spatial index for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);

-- Indexes on foreign keys for join performance
CREATE INDEX IF NOT EXISTS idx_places_city ON places(city_id);
CREATE INDEX IF NOT EXISTS idx_places_region ON places(region_id);
CREATE INDEX IF NOT EXISTS idx_places_country ON places(country_code);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);
CREATE INDEX IF NOT EXISTS idx_places_source_id ON places(source_id);
CREATE INDEX IF NOT EXISTS idx_places_active ON places(is_active);
CREATE INDEX IF NOT EXISTS idx_places_coords ON places(latitude, longitude);

COMMENT ON TABLE places IS 'Main table for places/breweries - depends on cities, regions, and countries';

-- ============================================================================
-- 6. PLACE TYPE ASSIGNMENTS (Junction Table - Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS place_type_assignments (
    assignment_id SERIAL PRIMARY KEY,
    place_id INTEGER NOT NULL,
    type_id INTEGER NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,              -- Mark primary type
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(100),                      -- Optional: who/what assigned this
    
    -- Composite unique constraint: place can have same type only once
    CONSTRAINT uk_place_type UNIQUE (place_id, type_id),
    
    -- Foreign Keys
    CONSTRAINT fk_place_type_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id)                      -- Use existing 'id' column
        ON DELETE CASCADE,                         -- If place deleted, remove assignments
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_place_type_type 
        FOREIGN KEY (type_id) 
        REFERENCES place_types(type_id)
        ON DELETE CASCADE                          -- If type deleted, remove assignments
        ON UPDATE CASCADE,
    
    -- Ensure only one primary type per place
    CONSTRAINT chk_primary_type CHECK (
        is_primary = FALSE OR 
        (SELECT COUNT(*) FROM place_type_assignments 
         WHERE place_id = place_type_assignments.place_id AND is_primary = TRUE) <= 1
    )
);

CREATE INDEX IF NOT EXISTS idx_place_type_place ON place_type_assignments(place_id);
CREATE INDEX IF NOT EXISTS idx_place_type_type ON place_type_assignments(type_id);
CREATE INDEX IF NOT EXISTS idx_place_type_primary ON place_type_assignments(place_id, is_primary) 
    WHERE is_primary = TRUE;

COMMENT ON TABLE place_type_assignments IS 'Junction table: places can have multiple types';

-- ============================================================================
-- 7. PLACE RATINGS TABLE (For Future Features - Reviews/Ratings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS place_ratings (
    rating_id SERIAL PRIMARY KEY,
    place_id INTEGER NOT NULL,
    user_id VARCHAR(100),                          -- Optional: for future user system
    rating_value INTEGER NOT NULL,                 -- 1-5 stars
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key
    CONSTRAINT fk_ratings_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id)                      -- Use existing 'id' column
        ON DELETE CASCADE                          -- If place deleted, remove ratings
        ON UPDATE CASCADE,
    
    -- Check constraints
    CONSTRAINT chk_rating_value CHECK (rating_value >= 1 AND rating_value <= 5),
    CONSTRAINT chk_unique_user_rating CHECK (
        user_id IS NULL OR 
        NOT EXISTS (
            SELECT 1 FROM place_ratings pr2 
            WHERE pr2.place_id = place_ratings.place_id 
              AND pr2.user_id = place_ratings.user_id
              AND pr2.rating_id != place_ratings.rating_id
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_ratings_place ON place_ratings(place_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON place_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_value ON place_ratings(rating_value);
CREATE INDEX IF NOT EXISTS idx_ratings_created ON place_ratings(created_at);

COMMENT ON TABLE place_ratings IS 'Ratings and reviews for places - extensible for future features';

-- ============================================================================
-- 8. AUDIT LOG TABLE (Centralized Logging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,              -- Which table was modified
    record_id INTEGER,                             -- ID of the modified record
    action VARCHAR(20) NOT NULL,                   -- 'INSERT', 'UPDATE', 'DELETE'
    user_id VARCHAR(100),                          -- Optional: who made the change
    old_values JSONB,                              -- Previous values (for UPDATE/DELETE)
    new_values JSONB,                              -- New values (for INSERT/UPDATE)
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,                               -- Optional: IP address
    user_agent TEXT,                               -- Optional: user agent
    
    CONSTRAINT chk_action_valid CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

COMMENT ON TABLE audit_log IS 'Centralized audit logging for all table changes';

-- ============================================================================
-- SUMMARY OF TABLES AND RELATIONSHIPS
-- ============================================================================
-- 
-- Table Hierarchy:
--   countries (root)
--     ├── regions (FK: country_code)
--     │   └── cities (FK: region_id, country_code)
--     │       └── places (FK: city_id, region_id, country_code)
--     └── places (FK: country_code, region_id)
--
-- Independent Tables:
--   place_types (no dependencies)
--
-- Junction Tables:
--   place_type_assignments (FK: place_id, type_id)
--
-- Feature Tables:
--   place_ratings (FK: place_id) - for future features
--
-- Utility Tables:
--   audit_log (references all tables via table_name + record_id)
--
-- Total: 8 tables with proper relationships
--
-- ============================================================================

