"""
Geospatial Web Application - ETL Pipeline

Course: CSCI 765 – Intro to Database Systems
Project: Geospatial Web Application
Student: Yethin Chandra Sai Mannem
Date: 2024

Description:
    This module implements an ETL (Extract, Transform, Load) pipeline for
    importing brewery location data from OpenBreweryDB API into PostgreSQL
    with PostGIS extension.
    
Process:
    1. Extract: Fetch data from OpenBreweryDB API
    2. Transform: Validate coordinates and clean data
    3. Load: Insert into PostgreSQL with PostGIS geometry
"""

import os
import time
import requests
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/geoapp")

API = "https://api.openbrewerydb.org/v1/breweries"
PER_PAGE = 200
MAX_PAGES = 10

INSERT_SQL = """
INSERT INTO places (source_id, name, city, state, country, lat, lon, geom)
VALUES (%s, %s, %s, %s, %s, %s, %s,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326))
ON CONFLICT DO NOTHING;
"""

def check_postgis(cur):
    """Verify PostGIS extension is installed."""
    cur.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis');")
    if not cur.fetchone()[0]:
        raise RuntimeError("PostGIS extension is not installed. Run: CREATE EXTENSION postgis;")

def validate_coordinates(lat, lon):
    """Validate coordinate ranges."""
    if not (-90 <= lat <= 90):
        return False
    if not (-180 <= lon <= 180):
        return False
    return True

def fetch_page(page: int, retries=3):
    """Fetch a page from the API with retry logic."""
    for attempt in range(retries):
        try:
            r = requests.get(API, params={"per_page": PER_PAGE, "page": page}, timeout=30)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt < retries - 1:
                print(f"  Retry {attempt + 1}/{retries} for page {page}...")
                time.sleep(1)
            else:
                print(f"  Failed to fetch page {page} after {retries} attempts: {e}")
                return None

def main():
    print("🚀 Starting ETL process...")
    print(f"📊 Target: {MAX_PAGES} pages × {PER_PAGE} records = up to {MAX_PAGES * PER_PAGE} records")
    
    try:
        conn = psycopg.connect(DATABASE_URL)
        conn.autocommit = True
    except psycopg.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        print(f"   Check your DATABASE_URL: {DATABASE_URL}")
        return

    with conn, conn.cursor() as cur:
        # Check PostGIS extension
        try:
            check_postgis(cur)
            print("✅ PostGIS extension found")
        except RuntimeError as e:
            print(f"❌ {e}")
            return
        
        # Check if table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'places'
            );
        """)
        if not cur.fetchone()[0]:
            print("❌ Table 'places' does not exist. Run db/schema.sql first.")
            return
        
        total_inserted = 0
        total_skipped = 0
        total_errors = 0
        
        for page in range(1, MAX_PAGES + 1):
            print(f"📄 Fetching page {page}/{MAX_PAGES}...", end=" ", flush=True)
            data = fetch_page(page)
            
            if not data:
                print("(empty or error)")
                break
            
            if not isinstance(data, list):
                print(f"(unexpected format: {type(data)})")
                break
            
            batch_inserted = 0
            batch_skipped = 0
            batch_errors = 0
            
            for b in data:
                lat = b.get("latitude")
                lon = b.get("longitude")
                
                # Skip if coordinates are missing
                if not lat or not lon:
                    batch_skipped += 1
                    continue
                
                try:
                    latf = float(lat)
                    lonf = float(lon)
                except (ValueError, TypeError):
                    batch_skipped += 1
                    continue
                
                # Validate coordinate ranges
                if not validate_coordinates(latf, lonf):
                    batch_skipped += 1
                    continue
                
                try:
                    cur.execute(
                        INSERT_SQL,
                        (
                            str(b.get("id", "")),
                            b.get("name"),
                            b.get("city"),
                            b.get("state"),
                            b.get("country") or "US",
                            latf,
                            lonf,
                            lonf,
                            latf,
                        ),
                    )
                    batch_inserted += 1
                except Exception as e:
                    batch_errors += 1
                    # Continue processing other records
            
            total_inserted += batch_inserted
            total_skipped += batch_skipped
            total_errors += batch_errors
            
            print(f"✓ Inserted: {batch_inserted}, Skipped: {batch_skipped}, Errors: {batch_errors}")
            
            # Rate limiting
            if page < MAX_PAGES:
                time.sleep(0.2)
        
        # Final summary
        print("\n" + "="*50)
        print("📊 ETL Summary:")
        print(f"  ✅ Total inserted: {total_inserted}")
        print(f"  ⏭️  Total skipped: {total_skipped}")
        print(f"  ❌ Total errors: {total_errors}")
        
        # Verify data
        cur.execute("SELECT COUNT(*) FROM places;")
        total_in_db = cur.fetchone()[0]
        print(f"  📦 Total records in database: {total_in_db}")
        print("="*50)

if __name__ == "__main__":
    main()
