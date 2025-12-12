"""
Geospatial Web Application - ETL Pipeline for Restaurants and Hotels from OpenStreetMap

Course: CSCI 765 – Intro to Database Systems
Project: Geospatial Web Application
Student: Yethin Chandra Sai Mannem
Date: 2024

Description:
    This module implements an ETL (Extract, Transform, Load) pipeline for
    importing restaurant and hotel location data from OpenStreetMap Overpass API
    into PostgreSQL with PostGIS extension.
    
License:
    OpenStreetMap data is available under the Open Database License (ODbL)
    https://www.openstreetmap.org/copyright

Process:
    1. Extract: Query OpenStreetMap via Overpass API for restaurants and hotels
    2. Transform: Validate coordinates and clean data
    3. Load: Insert into PostgreSQL with PostGIS geometry and type-specific tables
"""

import os
import time
import requests
import psycopg
from dotenv import load_dotenv
import uuid

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/geoapp")

# Overpass API endpoint
OVERPASS_API = "https://overpass-api.de/api/interpreter"

# Query areas - focusing on major US cities for diversity
QUERY_AREAS = [
    {"name": "New York", "bbox": (40.4774, -74.2591, 40.9176, -73.7004)},
    {"name": "Los Angeles", "bbox": (33.7037, -118.6682, 34.3373, -118.1553)},
    {"name": "Chicago", "bbox": (41.6445, -87.9401, 42.0230, -87.5237)},
    {"name": "Houston", "bbox": (29.5236, -95.8197, 30.1104, -95.0142)},
    {"name": "San Francisco", "bbox": (37.6398, -122.6376, 37.9298, -122.2818)},
    {"name": "Miami", "bbox": (25.7096, -80.3197, 25.8559, -80.1274)},
    {"name": "Seattle", "bbox": (47.4814, -122.4597, 47.7341, -122.2244)},
    {"name": "Boston", "bbox": (42.2279, -71.1912, 42.3973, -70.8758)},
]

def check_postgis(cur):
    """Verify PostGIS extension is installed."""
    cur.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis');")
    if not cur.fetchone()[0]:
        raise RuntimeError("PostGIS extension is not installed. Run: CREATE EXTENSION postgis;")

def validate_coordinates(lat, lon):
    """Validate coordinate ranges."""
    if not (-90 <= lat <= 90):
        raise ValueError(f"Latitude {lat} out of range [-90, 90]")
    if not (-180 <= lon <= 180):
        raise ValueError(f"Lon {lon} out of range [-180, 180]")

def query_overpass(bbox, place_type):
    """
    Query Overpass API for restaurants or hotels in a bounding box.
    
    Args:
        bbox: Tuple of (south, west, north, east)
        place_type: 'restaurant' or 'hotel'
    
    Returns:
        List of features
    """
    south, west, north, east = bbox
    
    if place_type == 'restaurant':
        # Query for restaurants, cafes, fast_food, etc.
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"]({south},{west},{north},{east});
          node["amenity"="cafe"]({south},{west},{north},{east});
          node["amenity"="fast_food"]({south},{west},{north},{east});
          node["amenity"="bar"]({south},{west},{north},{east});
          way["amenity"="restaurant"]({south},{west},{north},{east});
          way["amenity"="cafe"]({south},{west},{north},{east});
          way["amenity"="fast_food"]({south},{west},{north},{east});
          way["amenity"="bar"]({south},{west},{north},{east});
          relation["amenity"="restaurant"]({south},{west},{north},{east});
          relation["amenity"="cafe"]({south},{west},{north},{east});
          relation["amenity"="fast_food"]({south},{west},{north},{east});
          relation["amenity"="bar"]({south},{west},{north},{east});
        );
        out center;
        """
    elif place_type == 'hotel':
        # Query for hotels, hostels, motels
        query = f"""
        [out:json][timeout:25];
        (
          node["tourism"="hotel"]({south},{west},{north},{east});
          node["tourism"="hostel"]({south},{west},{north},{east});
          node["tourism"="motel"]({south},{west},{north},{east});
          way["tourism"="hotel"]({south},{west},{north},{east});
          way["tourism"="hostel"]({south},{west},{north},{east});
          way["tourism"="motel"]({south},{west},{north},{east});
          relation["tourism"="hotel"]({south},{west},{north},{east});
          relation["tourism"="hostel"]({south},{west},{north},{east});
          relation["tourism"="motel"]({south},{west},{north},{east});
        );
        out center;
        """
    elif place_type == 'tourist_place':
        # Query for tourist attractions: museums, monuments, parks, landmarks
        query = f"""
        [out:json][timeout:25];
        (
          node["tourism"="attraction"]({south},{west},{north},{east});
          node["tourism"="museum"]({south},{west},{north},{east});
          node["historic"="monument"]({south},{west},{north},{east});
          node["leisure"="park"]({south},{west},{north},{east});
          way["tourism"="attraction"]({south},{west},{north},{east});
          way["tourism"="museum"]({south},{west},{north},{east});
          way["historic"="monument"]({south},{west},{north},{east});
          way["leisure"="park"]({south},{west},{north},{east});
          relation["tourism"="attraction"]({south},{west},{north},{east});
          relation["tourism"="museum"]({south},{west},{north},{east});
          relation["historic"="monument"]({south},{west},{north},{east});
          relation["leisure"="park"]({south},{west},{north},{east});
        );
        out center;
        """
    else:
        raise ValueError(f"Unknown place_type: {place_type}")
    
    try:
        print(f"  Querying {place_type} data from Overpass API...")
        response = requests.post(OVERPASS_API, data=query, timeout=60)
        response.raise_for_status()
        data = response.json()
        return data.get('elements', [])
    except Exception as e:
        print(f"  Error querying Overpass API: {e}")
        return []

def transform_osm_data(elements, place_type):
    """Transform OSM data to our schema format."""
    places = []
    
    for elem in elements:
        try:
            # Get coordinates (for nodes) or center (for ways/relations)
            if 'lat' in elem and 'lon' in elem:
                lat = float(elem['lat'])
                lon = float(elem['lon'])
            elif 'center' in elem:
                lat = float(elem['center']['lat'])
                lon = float(elem['center']['lon'])
            else:
                continue
            
            validate_coordinates(lat, lon)
            
            tags = elem.get('tags', {})
            name = tags.get('name', '').strip()
            if not name:
                continue  # Skip places without names
            
            # Get address info
            city = tags.get('addr:city') or tags.get('city', '').strip()
            state = tags.get('addr:state') or tags.get('state', '').strip()
            country = tags.get('addr:country') or tags.get('country', 'US')
            if country and len(country) > 2:
                # Convert full country name to code if needed
                country = 'US' if 'United States' in country or 'USA' in country else country[:2]
            street = tags.get('addr:street', '').strip()
            postal_code = tags.get('addr:postcode', '').strip()
            phone = tags.get('phone', '').strip()
            website = tags.get('website', '').strip()
            
            place = {
                'source_id': f"osm_{place_type}_{elem['type']}_{elem['id']}",
                'name': name,
                'city': city or None,
                'state': state or None,
                'country': country or 'US',
                'lat': lat,
                'lon': lon,
                'street': street or None,
                'postal_code': postal_code or None,
                'phone': phone or None,
                'website': website or None,
                'place_type': place_type,
            }
            
            # Add type-specific fields
            if place_type == 'restaurant':
                cuisine = tags.get('cuisine', '').strip()
                place['cuisine_type'] = cuisine or None
                # Try to infer price range from tags
                price_range = None
                if 'fee' in tags.get('payment', '').lower():
                    price_range = 4
                elif 'expensive' in tags.get('price_range', '').lower():
                    price_range = 4
                elif 'moderate' in tags.get('price_range', '').lower():
                    price_range = 2
                elif 'cheap' in tags.get('price_range', '').lower():
                    price_range = 1
                place['price_range'] = price_range
                
            elif place_type == 'hotel':
                stars = tags.get('stars', '').strip()
                star_rating = None
                if stars:
                    try:
                        star_rating = int(float(stars))
                        if star_rating < 1 or star_rating > 5:
                            star_rating = None
                    except:
                        pass
                place['star_rating'] = star_rating
                
                # Get amenities
                amenities = []
                amenity_tags = ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'parking', 'breakfast']
                for amenity in amenity_tags:
                    if tags.get(amenity, 'no').lower() == 'yes' or amenity in tags.get('amenity', '').lower():
                        amenities.append(amenity.capitalize())
                place['amenities'] = amenities if amenities else None
            
            places.append(place)
            
        except (ValueError, KeyError) as e:
            continue  # Skip invalid entries
    
    return places

def insert_places(cur, places):
    """Insert places into database."""
    inserted = 0
    skipped = 0
    
    for place in places:
        try:
            # Insert into places table
            cur.execute("""
                INSERT INTO places (source_id, name, city, state, country, lat, lon, geom)
                SELECT %s, %s, %s, %s, %s, %s, %s,
                       ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                WHERE NOT EXISTS (
                    SELECT 1 FROM places WHERE source_id = %s
                )
                RETURNING id;
            """, (
                place['source_id'],
                place['name'],
                place['city'],
                place['state'],
                place['country'],
                place['lat'],
                place['lon'],
                place['lon'],
                place['lat'],
                place['source_id']
            ))
            
            result = cur.fetchone()
            if not result:
                skipped += 1
                continue
            
            place_id = result[0]
            
            # Insert into type-specific table
            if place['place_type'] == 'restaurant':
                cur.execute("""
                    INSERT INTO restaurants (place_id, cuisine_type, price_range, rating, website, phone, street, postal_code)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (place_id) DO NOTHING;
                """, (
                    place_id,
                    place.get('cuisine_type'),
                    place.get('price_range'),
                    None,  # rating - not available from OSM
                    place.get('website'),
                    place.get('phone'),
                    place.get('street'),
                    place.get('postal_code')
                ))
            elif place['place_type'] == 'hotel':
                cur.execute("""
                    INSERT INTO hotels (place_id, star_rating, rating, price_per_night, amenities, website, phone, street, postal_code)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (place_id) DO NOTHING;
                """, (
                    place_id,
                    place.get('star_rating'),
                    None,  # rating - not available from OSM
                    None,  # price_per_night - not available from OSM
                    place.get('amenities'),
                    place.get('website'),
                    place.get('phone'),
                    place.get('street'),
                    place.get('postal_code')
                ))
            elif place['place_type'] == 'tourist_place':
                cur.execute("""
                    INSERT INTO tourist_places (place_id, place_type, rating, entry_fee, website, phone, street, postal_code, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (place_id) DO NOTHING;
                """, (
                    place_id,
                    place.get('tourist_type'),
                    place.get('rating'),
                    place.get('entry_fee'),
                    place.get('website'),
                    place.get('phone'),
                    place.get('street'),
                    place.get('postal_code'),
                    place.get('description')
                ))
            
            inserted += 1
            
        except Exception as e:
            print(f"  Error inserting {place.get('name', 'unknown')}: {e}")
            skipped += 1
            continue
    
    return inserted, skipped

def main():
    """Main ETL process."""
    print("🚀 OpenStreetMap Places ETL Pipeline")
    print("=" * 50)
    print("")
    print("License: OpenStreetMap data is available under ODbL")
    print("Source: https://www.openstreetmap.org/")
    print("")
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                check_postgis(cur)
                
                total_inserted = 0
                total_skipped = 0
                
                # Process restaurants
                print("📊 Processing RESTAURANTS...")
                print("-" * 50)
                for area in QUERY_AREAS:
                    print(f"  Area: {area['name']}")
                    elements = query_overpass(area['bbox'], 'restaurant')
                    print(f"    Found {len(elements)} OSM elements")
                    
                    places = transform_osm_data(elements, 'restaurant')
                    print(f"    Transformed to {len(places)} valid places")
                    
                    if places:
                        inserted, skipped = insert_places(cur, places)
                        conn.commit()
                        total_inserted += inserted
                        total_skipped += skipped
                        print(f"    Inserted: {inserted}, Skipped: {skipped}")
                    
                    # Rate limiting - be respectful to Overpass API
                    time.sleep(2)
                
                print("")
                
                # Process hotels
                print("🏨 Processing HOTELS...")
                print("-" * 50)
                for area in QUERY_AREAS:
                    print(f"  Area: {area['name']}")
                    elements = query_overpass(area['bbox'], 'hotel')
                    print(f"    Found {len(elements)} OSM elements")
                    
                    places = transform_osm_data(elements, 'hotel')
                    print(f"    Transformed to {len(places)} valid places")
                    
                    if places:
                        inserted, skipped = insert_places(cur, places)
                        conn.commit()
                        total_inserted += inserted
                        total_skipped += skipped
                        print(f"    Inserted: {inserted}, Skipped: {skipped}")
                    
                    # Rate limiting
                    time.sleep(2)
                
                print("")
                
                # Process tourist places (with smaller bboxes to avoid timeout)
                print("🗺️ Processing TOURIST PLACES...")
                print("-" * 50)
                # Use smaller subset to avoid timeouts
                tourist_areas = QUERY_AREAS[:4]  # Just first 4 cities
                for area in tourist_areas:
                    print(f"  Area: {area['name']}")
                    elements = query_overpass(area['bbox'], 'tourist_place')
                    print(f"    Found {len(elements)} OSM elements")
                    
                    places = transform_osm_data(elements, 'tourist_place')
                    print(f"    Transformed to {len(places)} valid places")
                    
                    if places:
                        inserted, skipped = insert_places(cur, places)
                        conn.commit()
                        total_inserted += inserted
                        total_skipped += skipped
                        print(f"    Inserted: {inserted}, Skipped: {skipped}")
                    
                    # Rate limiting
                    time.sleep(3)  # Longer delay for tourist places
                
                # Final statistics
                print("")
                print("=" * 50)
                print("✅ ETL Process Complete!")
                print(f"   Total Inserted: {total_inserted}")
                print(f"   Total Skipped: {total_skipped}")
                
                # Show counts
                cur.execute("SELECT COUNT(*) FROM restaurants;")
                restaurant_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM hotels;")
                hotel_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM tourist_places;")
                tourist_count = cur.fetchone()[0]
                
                print(f"   Restaurants in DB: {restaurant_count}")
                print(f"   Hotels in DB: {hotel_count}")
                print(f"   Tourist Places in DB: {tourist_count}")
                print(f"   Total Places: {restaurant_count + hotel_count + tourist_count}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    main()

