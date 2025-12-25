-- Add new columns to restaurants table for enhanced filtering
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024

-- Add dietary_options column (JSONB array for multiple dietary restrictions)
-- Examples: ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'keto-friendly']
ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS dietary_options TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add outdoor_seating column (boolean)
ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS outdoor_seating BOOLEAN DEFAULT FALSE;

-- Add delivery column (boolean) - if not exists
ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS delivery BOOLEAN DEFAULT FALSE;

-- Add takeout column (boolean) - if not exists
ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS takeout BOOLEAN DEFAULT FALSE;

-- Add reservations column (boolean) - if not exists
ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS reservations BOOLEAN DEFAULT FALSE;

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_dietary_options ON restaurants USING GIN (dietary_options);
CREATE INDEX IF NOT EXISTS idx_restaurants_outdoor_seating ON restaurants (outdoor_seating);
CREATE INDEX IF NOT EXISTS idx_restaurants_delivery ON restaurants (delivery);
CREATE INDEX IF NOT EXISTS idx_restaurants_takeout ON restaurants (takeout);
CREATE INDEX IF NOT EXISTS idx_restaurants_reservations ON restaurants (reservations);

-- Comments for documentation
COMMENT ON COLUMN restaurants.dietary_options IS 'Array of dietary options: vegetarian, vegan, gluten-free, halal, kosher, keto-friendly';
COMMENT ON COLUMN restaurants.outdoor_seating IS 'Whether the restaurant has outdoor seating (patio, terrace, sidewalk)';
COMMENT ON COLUMN restaurants.delivery IS 'Whether the restaurant offers delivery service';
COMMENT ON COLUMN restaurants.takeout IS 'Whether the restaurant offers takeout service';
COMMENT ON COLUMN restaurants.reservations IS 'Whether the restaurant accepts reservations';

