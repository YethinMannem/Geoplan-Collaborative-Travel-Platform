-- Populate tourist_type (place_type) in tourist_places table
-- This script categorizes tourist places based on their names and descriptions
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024

-- Update tourist places based on name patterns
-- Parks
UPDATE tourist_places tp
SET place_type = 'Park'
FROM places p
WHERE tp.place_id = p.id
  AND tp.place_type IS NULL
  AND (
    LOWER(p.name) LIKE '%park%' OR
    LOWER(p.name) LIKE '%garden%' OR
    LOWER(p.name) LIKE '%plaza%' OR
    LOWER(p.name) LIKE '%square%' OR
    LOWER(p.name) LIKE '%green%' OR
    LOWER(p.name) LIKE '%commons%' OR
    LOWER(p.name) LIKE '%recreation%' OR
    LOWER(p.name) LIKE '%playground%'
  );

-- Museums
UPDATE tourist_places tp
SET place_type = 'Museum'
FROM places p
WHERE tp.place_id = p.id
  AND tp.place_type IS NULL
  AND (
    LOWER(p.name) LIKE '%museum%' OR
    LOWER(p.name) LIKE '%gallery%' OR
    LOWER(p.name) LIKE '%exhibit%' OR
    LOWER(p.name) LIKE '%collection%' OR
    LOWER(p.name) LIKE '%hall of fame%'
  );

-- Monuments and Memorials
UPDATE tourist_places tp
SET place_type = 'Monument'
FROM places p
WHERE tp.place_id = p.id
  AND tp.place_type IS NULL
  AND (
    LOWER(p.name) LIKE '%monument%' OR
    LOWER(p.name) LIKE '%memorial%' OR
    LOWER(p.name) LIKE '%statue%' OR
    LOWER(p.name) LIKE '%memorial%' OR
    LOWER(p.name) LIKE '%obelisk%' OR
    LOWER(p.name) LIKE '%shrine%'
  );

-- Beaches
UPDATE tourist_places tp
SET place_type = 'Beach'
FROM places p
WHERE tp.place_id = p.id
  AND tp.place_type IS NULL
  AND (
    LOWER(p.name) LIKE '%beach%' OR
    LOWER(p.name) LIKE '%shore%' OR
    LOWER(p.name) LIKE '%coast%'
  );

-- Landmarks
UPDATE tourist_places tp
SET place_type = 'Landmark'
FROM places p
WHERE tp.place_id = p.id
  AND tp.place_type IS NULL
  AND (
    LOWER(p.name) LIKE '%tower%' OR
    LOWER(p.name) LIKE '%bridge%' OR
    LOWER(p.name) LIKE '%building%' OR
    LOWER(p.name) LIKE '%center%' OR
    LOWER(p.name) LIKE '%centre%' OR
    LOWER(p.name) LIKE '%plaza%' OR
    LOWER(p.name) LIKE '%district%'
  );

-- Attractions (catch-all for remaining places)
-- This should be run last to categorize anything that doesn't match above patterns
UPDATE tourist_places tp
SET place_type = 'Attraction'
FROM places p
WHERE tp.place_id = p.id
  AND tp.place_type IS NULL;

-- Verify the updates
SELECT 
    place_type,
    COUNT(*) as count
FROM tourist_places
GROUP BY place_type
ORDER BY count DESC;

