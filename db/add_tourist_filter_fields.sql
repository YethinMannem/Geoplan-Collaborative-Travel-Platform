-- Add new columns to tourist_places table for enhanced filtering
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024

-- Add family_friendly column (boolean)
ALTER TABLE tourist_places 
    ADD COLUMN IF NOT EXISTS family_friendly BOOLEAN DEFAULT FALSE;

-- Add accessibility column (boolean) - wheelchair accessible, accessible facilities
ALTER TABLE tourist_places 
    ADD COLUMN IF NOT EXISTS accessibility BOOLEAN DEFAULT FALSE;

-- Add pet_friendly column (boolean)
ALTER TABLE tourist_places 
    ADD COLUMN IF NOT EXISTS pet_friendly BOOLEAN DEFAULT FALSE;

-- Add guided_tours column (boolean)
ALTER TABLE tourist_places 
    ADD COLUMN IF NOT EXISTS guided_tours BOOLEAN DEFAULT FALSE;

-- Add hours_of_operation column (text) - for "Open Now" filter
ALTER TABLE tourist_places 
    ADD COLUMN IF NOT EXISTS hours_of_operation TEXT;

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_tourist_places_family_friendly ON tourist_places (family_friendly);
CREATE INDEX IF NOT EXISTS idx_tourist_places_accessibility ON tourist_places (accessibility);
CREATE INDEX IF NOT EXISTS idx_tourist_places_pet_friendly ON tourist_places (pet_friendly);
CREATE INDEX IF NOT EXISTS idx_tourist_places_guided_tours ON tourist_places (guided_tours);
CREATE INDEX IF NOT EXISTS idx_tourist_places_hours_of_operation ON tourist_places (hours_of_operation) WHERE hours_of_operation IS NOT NULL;

-- Update existing tourist place entries with default values for new boolean columns
UPDATE tourist_places SET family_friendly = FALSE WHERE family_friendly IS NULL;
UPDATE tourist_places SET accessibility = FALSE WHERE accessibility IS NULL;
UPDATE tourist_places SET pet_friendly = FALSE WHERE pet_friendly IS NULL;
UPDATE tourist_places SET guided_tours = FALSE WHERE guided_tours IS NULL;

-- Comments for documentation
COMMENT ON COLUMN tourist_places.family_friendly IS 'Whether the tourist place is suitable for children and families';
COMMENT ON COLUMN tourist_places.accessibility IS 'Whether the tourist place is wheelchair accessible or has accessible facilities';
COMMENT ON COLUMN tourist_places.pet_friendly IS 'Whether the tourist place allows pets/dogs';
COMMENT ON COLUMN tourist_places.guided_tours IS 'Whether the tourist place offers guided tours';
COMMENT ON COLUMN tourist_places.hours_of_operation IS 'Operating hours for the tourist place (for Open Now filter)';


