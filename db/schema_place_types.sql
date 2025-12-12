-- Geospatial Web Application - Place Types Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema extends the places table with separate tables for different
--   place types (breweries, restaurants, tourist_places, hotels) linked via
--   foreign keys, demonstrating database normalization and referential integrity.

-- Enable PostGIS extension (run this first if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Base places table with common attributes and spatial data
-- This table stores all geospatial information shared across all place types

-- First, ensure places table exists (may already exist from old schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'places') THEN
        CREATE TABLE places (
            id SERIAL PRIMARY KEY,
            source_id TEXT,
            name TEXT,
            city TEXT,
            state TEXT,
            country TEXT,
            lat DOUBLE PRECISION,
            lon DOUBLE PRECISION,
            geom geometry(Point, 4326)
        );
    END IF;
END $$;

-- Add new columns if they don't exist
ALTER TABLE places 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows
UPDATE places SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE places SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
UPDATE places SET country = 'United States' WHERE country IS NULL;

-- Add constraints if they don't exist
DO $$
BEGIN
    -- Add NOT NULL constraints carefully (only if no NULLs exist)
    IF NOT EXISTS (SELECT 1 FROM places WHERE name IS NULL) THEN
        ALTER TABLE places ALTER COLUMN name SET NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM places WHERE lat IS NULL) THEN
        ALTER TABLE places ALTER COLUMN lat SET NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM places WHERE lon IS NULL) THEN
        ALTER TABLE places ALTER COLUMN lon SET NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM places WHERE geom IS NULL) THEN
        ALTER TABLE places ALTER COLUMN geom SET NOT NULL;
    END IF;
    
    -- Add coordinate check constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_coordinates') THEN
        ALTER TABLE places ADD CONSTRAINT chk_coordinates CHECK (
            lat >= -90 AND lat <= 90 AND 
            lon >= -180 AND lon <= 180
        );
    END IF;
    
    -- Add unique constraint on source_id if possible
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'places_source_id_key') THEN
        BEGIN
            ALTER TABLE places ADD CONSTRAINT places_source_id_key UNIQUE (source_id);
        EXCEPTION
            WHEN duplicate_table THEN
                NULL;
            WHEN OTHERS THEN
                NULL; -- Skip if duplicates exist
        END;
    END IF;
END $$;

-- Spatial index for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_places_city_state ON places (city, state);
CREATE INDEX IF NOT EXISTS idx_places_country ON places (country);

-- Breweries table - specific attributes for breweries
CREATE TABLE IF NOT EXISTS breweries (
    place_id INTEGER PRIMARY KEY,
    brewery_type TEXT,  -- e.g., 'micro', 'nano', 'regional', 'brewpub'
    website TEXT,
    phone TEXT,
    street TEXT,
    postal_code TEXT,
    -- Foreign key constraint with ON DELETE CASCADE
    CONSTRAINT fk_brewery_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Restaurants table - specific attributes for restaurants
CREATE TABLE IF NOT EXISTS restaurants (
    place_id INTEGER PRIMARY KEY,
    cuisine_type TEXT,  -- e.g., 'Italian', 'Mexican', 'American', 'Asian'
    price_range INTEGER CHECK (price_range >= 1 AND price_range <= 4),  -- 1-4 scale
    rating DECIMAL(3, 2) CHECK (rating >= 0 AND rating <= 5),  -- 0-5 scale
    website TEXT,
    phone TEXT,
    street TEXT,
    postal_code TEXT,
    hours_of_operation TEXT,  -- e.g., 'Mon-Fri: 11AM-10PM'
    -- Foreign key constraint
    CONSTRAINT fk_restaurant_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Tourist places table - specific attributes for tourist attractions
CREATE TABLE IF NOT EXISTS tourist_places (
    place_id INTEGER PRIMARY KEY,
    place_type TEXT,  -- e.g., 'Museum', 'Park', 'Monument', 'Beach', 'Landmark'
    rating DECIMAL(3, 2) CHECK (rating >= 0 AND rating <= 5),
    entry_fee DECIMAL(10, 2),  -- Entry fee in local currency
    website TEXT,
    phone TEXT,
    street TEXT,
    postal_code TEXT,
    description TEXT,
    -- Foreign key constraint
    CONSTRAINT fk_tourist_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Hotels table - specific attributes for hotels
CREATE TABLE IF NOT EXISTS hotels (
    place_id INTEGER PRIMARY KEY,
    star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
    rating DECIMAL(3, 2) CHECK (rating >= 0 AND rating <= 5),
    price_per_night DECIMAL(10, 2),
    amenities TEXT[],  -- Array of amenities, e.g., {'WiFi', 'Pool', 'Gym', 'Spa'}
    website TEXT,
    phone TEXT,
    street TEXT,
    postal_code TEXT,
    check_in_time TIME,
    check_out_time TIME,
    -- Foreign key constraint
    CONSTRAINT fk_hotel_place 
        FOREIGN KEY (place_id) 
        REFERENCES places(id) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Indexes on foreign keys for faster joins
CREATE INDEX IF NOT EXISTS idx_breweries_place_id ON breweries(place_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_place_id ON restaurants(place_id);
CREATE INDEX IF NOT EXISTS idx_tourist_places_place_id ON tourist_places(place_id);
CREATE INDEX IF NOT EXISTS idx_hotels_place_id ON hotels(place_id);

-- Indexes for common queries on type-specific tables
CREATE INDEX IF NOT EXISTS idx_breweries_type ON breweries(brewery_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_price_range ON restaurants(price_range);
CREATE INDEX IF NOT EXISTS idx_tourist_places_type ON tourist_places(place_type);
CREATE INDEX IF NOT EXISTS idx_hotels_star_rating ON hotels(star_rating);

-- View to combine all places with their type information
-- This view makes it easy to query all places with their types
CREATE OR REPLACE VIEW places_with_types AS
SELECT 
    p.id,
    p.source_id,
    p.name,
    p.city,
    p.state,
    p.country,
    p.lat,
    p.lon,
    p.geom,
    p.created_at,
    p.updated_at,
    CASE 
        WHEN b.place_id IS NOT NULL THEN 'brewery'
        WHEN r.place_id IS NOT NULL THEN 'restaurant'
        WHEN t.place_id IS NOT NULL THEN 'tourist_place'
        WHEN h.place_id IS NOT NULL THEN 'hotel'
        ELSE 'unknown'
    END AS place_type,
    -- Brewery-specific fields
    b.brewery_type,
    b.website AS brewery_website,
    b.phone AS brewery_phone,
    -- Restaurant-specific fields
    r.cuisine_type,
    r.price_range,
    r.rating AS restaurant_rating,
    r.website AS restaurant_website,
    r.hours_of_operation,
    -- Tourist place-specific fields
    t.place_type AS tourist_type,
    t.rating AS tourist_rating,
    t.entry_fee,
    t.description,
    -- Hotel-specific fields
    h.star_rating,
    h.rating AS hotel_rating,
    h.price_per_night,
    h.amenities
FROM places p
LEFT JOIN breweries b ON p.id = b.place_id
LEFT JOIN restaurants r ON p.id = r.place_id
LEFT JOIN tourist_places t ON p.id = t.place_id
LEFT JOIN hotels h ON p.id = h.place_id;

-- Function to get place type for a given place_id
CREATE OR REPLACE FUNCTION get_place_type(place_id_param INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM breweries WHERE place_id = place_id_param) THEN
        RETURN 'brewery';
    ELSIF EXISTS (SELECT 1 FROM restaurants WHERE place_id = place_id_param) THEN
        RETURN 'restaurant';
    ELSIF EXISTS (SELECT 1 FROM tourist_places WHERE place_id = place_id_param) THEN
        RETURN 'tourist_place';
    ELSIF EXISTS (SELECT 1 FROM hotels WHERE place_id = place_id_param) THEN
        RETURN 'hotel';
    ELSE
        RETURN 'unknown';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_places_updated_at
    BEFORE UPDATE ON places
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE places IS 'Base table storing all geospatial point data shared across all place types';
COMMENT ON TABLE breweries IS 'Brewery-specific attributes linked to places via foreign key';
COMMENT ON TABLE restaurants IS 'Restaurant-specific attributes linked to places via foreign key';
COMMENT ON TABLE tourist_places IS 'Tourist attraction-specific attributes linked to places via foreign key';
COMMENT ON TABLE hotels IS 'Hotel-specific attributes linked to places via foreign key';
COMMENT ON VIEW places_with_types IS 'Unified view of all places with their type information and type-specific attributes';
COMMENT ON FUNCTION get_place_type(INTEGER) IS 'Returns the type of a place based on which type-specific table it exists in';

