"""
Geospatial Web Application - Flask API Server

Course: CSCI 765 – Intro to Database Systems
Project: Geospatial Web Application
Student: Yethin Chandra Sai Mannem
Date: 2024

Description: 
    This module provides a RESTful API for spatial queries on geospatial data.
    It integrates PostgreSQL with PostGIS extension for spatial operations.
    
Endpoints:
    - GET /health: Health check and database connection status
    - GET /within_radius: Find places within a radius
    - GET /nearest: Find K nearest places
    - GET /within_bbox: Find places in a bounding box
    - GET /stats: Get database statistics
    - GET /export/csv: Export places as CSV
    - GET /export/geojson: Export places as GeoJSON
    - GET /analytics/states: Get state analytics
    - GET /analytics/density: Calculate spatial density
    - GET /distance_matrix: Calculate distance matrix
    - POST /places/add: Add a new location (admin/app_user only)
"""

import os
import csv
import io
import uuid
import hashlib
import time
import bcrypt
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import psycopg

load_dotenv()
BASE_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/geoapp")

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

# Configure session cookies for localhost development
# Note: localhost:3000 and localhost:5000 are different origins (different ports)
# So we need SameSite='None' for cross-origin cookie sending, but browsers allow Secure=False for localhost
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Required for cross-origin (different ports = different origins)
app.config['SESSION_COOKIE_SECURE'] = False  # Browsers allow False for localhost even with SameSite=None
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_DOMAIN'] = None  # Don't set domain - allows localhost
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes

# Configure CORS to allow credentials - must specify origins (not "*") when using credentials
CORS(app, 
     supports_credentials=True,
     origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],
     allow_headers=["Content-Type", "Authorization", "X-User-Role", "X-Auth-Token"],  # Allow token headers
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type"],
     resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"]}})

# Define role-based database connection strings
DB_ROLES = {
    "readonly_user": {
        "username": "readonly_user",
        "password": "readonly_pass123",
        "permissions": ["SELECT"]
    },
    "app_user": {
        "username": "app_user",
        "password": "app_pass123",
        "permissions": ["SELECT", "INSERT", "UPDATE"]
    },
    "curator_user": {
        "username": "curator_user",
        "password": "curator_pass123",
        "permissions": ["SELECT", "INSERT", "UPDATE", "ANALYTICS"]
    },
    "analyst_user": {
        "username": "analyst_user",
        "password": "analyst_pass123",
        "permissions": ["SELECT", "ANALYTICS"]
    },
    "admin_user": {
        "username": "admin_user",
        "password": "admin_pass123",
        "permissions": ["ALL"]
    }
}

def get_database_url_for_role(role_name):
    """Construct database URL for a specific role."""
    if role_name not in DB_ROLES:
        return BASE_DATABASE_URL
    
    role_info = DB_ROLES[role_name]
    
    try:
        url_part = BASE_DATABASE_URL.replace("postgresql://", "")
        
        if "@" in url_part:
            _, host_db = url_part.split("@", 1)
        else:
            host_db = "localhost:5432/geoapp"
        
        if "/" not in host_db:
            host_db = host_db + "/geoapp"
        
        return f"postgresql://{role_info['username']}:{role_info['password']}@{host_db}"
    except Exception as e:
        app.logger.error(f"Error constructing database URL for role {role_name}: {e}")
        return f"postgresql://{role_info['username']}:{role_info['password']}@localhost:5432/geoapp"

# Simple token storage (in production, use Redis or database)
TOKEN_STORAGE = {}  # {token: {"user_role": "...", "user_id": ..., "expires_at": timestamp}}

def generate_token(username, user_id=None):
    """Generate a simple token for the user."""
    secret = app.secret_key
    timestamp = str(time.time())
    token_string = f"{username}:{timestamp}:{secret}"
    token = hashlib.sha256(token_string.encode()).hexdigest()
    # Store token with expiration (30 minutes)
    TOKEN_STORAGE[token] = {
        "user_role": username,
        "user_id": user_id,  # For personal lists (None for role-based auth)
        "expires_at": time.time() + 1800  # 30 minutes
    }
    return token

def get_user_id_from_request():
    """Get user_id from token (for personal lists)."""
    token = request.headers.get('X-Auth-Token') or (request.headers.get('Authorization', '').replace('Bearer ', '').strip())
    if token and token in TOKEN_STORAGE:
        return TOKEN_STORAGE[token].get('user_id')
    return None

def get_places_list_status(user_id, place_ids):
    """Get list status (visited, wishlist, liked) for multiple places.
    Returns dict: {place_id: {"visited": bool, "in_wishlist": bool, "liked": bool}}
    """
    if not user_id or not place_ids:
        return {}
    
    try:
        place_ids_list = list(place_ids)
        with get_conn() as conn, conn.cursor() as cur:
            # Get visited
            cur.execute("""
                SELECT place_id FROM user_visited_places 
                WHERE user_id = %s AND place_id = ANY(%s)
            """, (user_id, place_ids_list))
            visited_ids = {row[0] for row in cur.fetchall()}
            
            # Get wishlist
            cur.execute("""
                SELECT place_id FROM user_wishlist 
                WHERE user_id = %s AND place_id = ANY(%s)
            """, (user_id, place_ids_list))
            wishlist_ids = {row[0] for row in cur.fetchall()}
            
            # Get liked
            cur.execute("""
                SELECT place_id FROM user_liked_places 
                WHERE user_id = %s AND place_id = ANY(%s)
            """, (user_id, place_ids_list))
            liked_ids = {row[0] for row in cur.fetchall()}
            
            # Build result dict
            status = {}
            for pid in place_ids_list:
                status[pid] = {
                    "visited": pid in visited_ids,
                    "in_wishlist": pid in wishlist_ids,
                    "liked": pid in liked_ids
                }
            
            return status
    except Exception as e:
        app.logger.error(f"Error getting list status: {e}")
        return {}

def validate_token(token):
    """Validate a token and return the user role if valid."""
    if not token:
        app.logger.warning(f"validate_token: No token provided")
        return None
    
    # Debug: log token validation attempt
    token_short = token[:20] + "..." if len(token) > 20 else token
    app.logger.info(f"validate_token: Checking token {token_short} (length: {len(token)})")
    app.logger.info(f"validate_token: TOKEN_STORAGE has {len(TOKEN_STORAGE)} tokens")
    
    if token not in TOKEN_STORAGE:
        # Debug: show what tokens we have
        if TOKEN_STORAGE:
            stored_tokens = [t[:20] + "..." for t in list(TOKEN_STORAGE.keys())[:3]]
            app.logger.warning(f"validate_token: Token not found. Sample stored tokens: {stored_tokens}")
        else:
            app.logger.warning(f"validate_token: TOKEN_STORAGE is empty!")
        return None
    
    token_data = TOKEN_STORAGE[token]
    
    # Check expiration
    if time.time() > token_data["expires_at"]:
        app.logger.warning(f"validate_token: Token expired")
        del TOKEN_STORAGE[token]
        return None
    
    app.logger.info(f"validate_token: Token valid, role: {token_data['user_role']}")
    return token_data["user_role"]

def get_user_role_from_request():
    """Get user role from either session, token, or header."""
    # Method 1: Check Authorization header (Bearer token)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()  # Remove 'Bearer ' prefix and trim
        if token:
            user_role = validate_token(token)
            if user_role:
                app.logger.info(f"get_user_role_from_request: Authenticated via Authorization header")
                return user_role
    
    # Method 2: Check X-Auth-Token header
    token = request.headers.get('X-Auth-Token')
    if token:
        token = token.strip()  # Trim whitespace
        user_role = validate_token(token)
        if user_role:
            app.logger.info(f"get_user_role_from_request: Authenticated via X-Auth-Token header")
            return user_role
    
    # Method 3: Check session cookie (fallback)
    if 'user_role' in session:
        app.logger.info(f"get_user_role_from_request: Authenticated via session cookie")
        return session.get('user_role')
    
    app.logger.warning(f"get_user_role_from_request: No authentication found")
    return None

def get_conn():
    """Get database connection with error handling. Uses role-based connection if user is logged in."""
    try:
        user_role = get_user_role_from_request()
        if user_role:
            role_db_url = get_database_url_for_role(user_role)
            return psycopg.connect(role_db_url)
        else:
            return psycopg.connect(BASE_DATABASE_URL)
    except psycopg.OperationalError as e:
        app.logger.error(f"Database connection error: {e}")
        raise

def get_admin_conn():
    """Get database connection with admin privileges (for operations requiring elevated permissions)."""
    try:
        # Use admin_user role which has full permissions
        if "admin_user" in DB_ROLES:
            role_db_url = get_database_url_for_role("admin_user")
            return psycopg.connect(role_db_url)
        else:
            # Fallback to base URL (postgres user)
            return psycopg.connect(BASE_DATABASE_URL)
    except psycopg.OperationalError as e:
        app.logger.error(f"Admin database connection error: {e}")
        raise

def validate_coordinates(lat, lon):
    """Validate latitude and longitude ranges."""
    if not (-90 <= lat <= 90):
        raise ValueError("Latitude must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise ValueError("Longitude must be between -180 and 180")
    return True

def validate_bbox(north, south, east, west):
    """Validate bounding box coordinates."""
    validate_coordinates(north, west)
    validate_coordinates(south, east)
    if north <= south:
        raise ValueError("North must be greater than south")
    if east <= west:
        raise ValueError("East must be greater than west")
    return True

@app.get("/health")
def health():
    """Health check endpoint that also tests database connection."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "database": "disconnected", "error": str(e)}), 503

@app.get("/within_radius")
def within_radius():
    """Find all places within a radius of a point."""
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
        km = float(request.args.get("km", 10))
        state_filter = request.args.get("state")
        name_filter = request.args.get("name")
    except (TypeError, ValueError) as e:
        return jsonify({"error": "lat, lon, and km must be numbers", "details": str(e)}), 400
    
    try:
        validate_coordinates(lat, lon)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    
    if km <= 0 or km > 1000:
        return jsonify({"error": "km must be between 0 and 1000"}), 400

    # Get place type filter (can be multiple: brewery,restaurant,tourist_place,hotel)
    place_type_filter = request.args.get("place_type")  # Comma-separated list
    place_types = None
    if place_type_filter:
        place_types = [t.strip() for t in place_type_filter.split(",") if t.strip()]
    
    # Use places_with_types view to get place_type information
    sql = """
    SELECT id, name, city, state, country, lat, lon, place_type
    FROM places_with_types
    WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
        %s * 1000
    )
    """
    params = [lon, lat, km]
    
    # Filter by place type(s)
    if place_types:
        sql += " AND place_type = ANY(%s)"
        params.append(place_types)
    
    if state_filter:
        sql += " AND state ILIKE %s"
        params.append(f"%{state_filter}%")
    
    if name_filter:
        sql += " AND name ILIKE %s"
        params.append(f"%{name_filter}%")
    
    sql += " ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) LIMIT 2000;"
    params.extend([lon, lat])

    try:
        user_id = get_user_id_from_request()
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            features = [
                {
                    "id": r[0],
                    "name": r[1],
                    "city": r[2],
                    "state": r[3],
                    "country": r[4],
                    "lat": r[5],
                    "lon": r[6],
                    "place_type": r[7] if len(r) > 7 else "unknown",
                }
                for r in rows
            ]
            
            # Add list status if user is authenticated
            if user_id and features:
                place_ids = [f["id"] for f in features]
                list_status = get_places_list_status(user_id, place_ids)
                for feature in features:
                    status = list_status.get(feature["id"], {})
                    feature["list_status"] = {
                        "visited": status.get("visited", False),
                        "in_wishlist": status.get("in_wishlist", False),
                        "liked": status.get("liked", False)
                    }
            
        return jsonify({"features": features, "count": len(features)})
    except Exception as e:
        app.logger.error(f"Error in within_radius: {e}")
        return jsonify({"error": "Database query failed", "details": str(e)}), 500

@app.get("/within_bbox")
def within_bbox():
    """Find all places within a bounding box."""
    try:
        north = float(request.args.get("north"))
        south = float(request.args.get("south"))
        east = float(request.args.get("east"))
        west = float(request.args.get("west"))
        state_filter = request.args.get("state")
        name_filter = request.args.get("name")
    except (TypeError, ValueError) as e:
        return jsonify({"error": "north, south, east, west must be numbers", "details": str(e)}), 400
    
    try:
        validate_bbox(north, south, east, west)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Get place type filter
    place_type_filter = request.args.get("place_type")
    place_types = None
    if place_type_filter:
        place_types = [t.strip() for t in place_type_filter.split(",") if t.strip()]

    sql = """
    SELECT id, name, city, state, country, lat, lon, place_type
    FROM places_with_types
    WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
    """
    params = [west, south, east, north]
    
    # Filter by place type(s)
    if place_types:
        sql += " AND place_type = ANY(%s)"
        params.append(place_types)
    
    if state_filter:
        sql += " AND state ILIKE %s"
        params.append(f"%{state_filter}%")
    
    if name_filter:
        sql += " AND name ILIKE %s"
        params.append(f"%{name_filter}%")
    
    sql += " LIMIT 5000;"

    try:
        user_id = get_user_id_from_request()
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            features = [
                {
                    "id": r[0],
                    "name": r[1],
                    "city": r[2],
                    "state": r[3],
                    "country": r[4],
                    "lat": r[5],
                    "lon": r[6],
                    "place_type": r[7] if len(r) > 7 else "unknown",
                }
                for r in rows
            ]
            
            # Add list status if user is authenticated
            if user_id and features:
                place_ids = [f["id"] for f in features]
                list_status = get_places_list_status(user_id, place_ids)
                for feature in features:
                    status = list_status.get(feature["id"], {})
                    feature["list_status"] = {
                        "visited": status.get("visited", False),
                        "in_wishlist": status.get("in_wishlist", False),
                        "liked": status.get("liked", False)
                    }
            
        return jsonify({"features": features, "count": len(features)})
    except Exception as e:
        app.logger.error(f"Error in within_bbox: {e}")
        return jsonify({"error": "Database query failed", "details": str(e)}), 500

@app.get("/nearest")
def nearest():
    """Find K nearest places to a point using PostGIS KNN."""
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
        k = int(request.args.get("k", 10))
        state_filter = request.args.get("state")
        name_filter = request.args.get("name")
    except (TypeError, ValueError) as e:
        return jsonify({"error": "lat, lon must be numbers and k must be an integer", "details": str(e)}), 400
    
    try:
        validate_coordinates(lat, lon)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    
    if k <= 0 or k > 100:
        return jsonify({"error": "k must be between 1 and 100"}), 400

    # Get place type filter
    place_type_filter = request.args.get("place_type")
    place_types = None
    if place_type_filter:
        place_types = [t.strip() for t in place_type_filter.split(",") if t.strip()]
    
    sql = """
    SELECT id, name, city, state, country, lat, lon, place_type,
           ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) / 1000.0 AS distance_km
    FROM places_with_types
    WHERE 1=1
    """
    params = [lon, lat]
    
    # Filter by place type(s)
    if place_types:
        sql += " AND place_type = ANY(%s)"
        params.append(place_types)
    
    if state_filter:
        sql += " AND state ILIKE %s"
        params.append(f"%{state_filter}%")
    
    if name_filter:
        sql += " AND name ILIKE %s"
        params.append(f"%{name_filter}%")
    
    sql += " ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT %s;"
    params.extend([lon, lat, k])

    try:
        user_id = get_user_id_from_request()
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            features = [
                {
                    "id": r[0],
                    "name": r[1],
                    "city": r[2],
                    "state": r[3],
                    "country": r[4],
                    "lat": r[5],
                    "lon": r[6],
                    "place_type": r[7] if len(r) > 7 else "unknown",
                    "distance_km": round(r[8], 2) if len(r) > 8 and r[8] else None,
                }
                for r in rows
            ]
            
            # Add list status if user is authenticated
            if user_id and features:
                place_ids = [f["id"] for f in features]
                list_status = get_places_list_status(user_id, place_ids)
                for feature in features:
                    status = list_status.get(feature["id"], {})
                    feature["list_status"] = {
                        "visited": status.get("visited", False),
                        "in_wishlist": status.get("in_wishlist", False),
                        "liked": status.get("liked", False)
                    }
            
        return jsonify({"features": features, "count": len(features)})
    except Exception as e:
        app.logger.error(f"Error in nearest: {e}")
        return jsonify({"error": "Database query failed", "details": str(e)}), 500

@app.get("/stats")
def stats():
    """Get statistics about the database."""
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM places;")
            total_count = cur.fetchone()[0]
            
            cur.execute("""
                SELECT state, COUNT(*) as count 
                FROM places 
                WHERE state IS NOT NULL 
                GROUP BY state 
                ORDER BY count DESC 
                LIMIT 10;
            """)
            top_states = [{"state": r[0], "count": r[1]} for r in cur.fetchall()]
            
            cur.execute("""
                SELECT 
                    MIN(lat) as min_lat, MAX(lat) as max_lat,
                    MIN(lon) as min_lon, MAX(lon) as max_lon
                FROM places;
            """)
            bounds = cur.fetchone()
            
        return jsonify({
            "total_places": total_count,
            "top_states": top_states,
            "bounds": {
                "min_lat": bounds[0],
                "max_lat": bounds[1],
                "min_lon": bounds[2],
                "max_lon": bounds[3],
            }
        })
    except Exception as e:
        app.logger.error(f"Error in stats: {e}")
        return jsonify({"error": "Database query failed", "details": str(e)}), 500

@app.get("/export/csv")
def export_csv():
    """Export places data as CSV."""
    try:
        state_filter = request.args.get("state")
        name_filter = request.args.get("name")
        
        sql = "SELECT id, name, city, state, country, lat, lon FROM places WHERE 1=1"
        params = []
        
        if state_filter:
            sql += " AND state ILIKE %s"
            params.append(f"%{state_filter}%")
        
        if name_filter:
            sql += " AND name ILIKE %s"
            params.append(f"%{name_filter}%")
        
        sql += " ORDER BY id;"
        
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['id', 'name', 'city', 'state', 'country', 'lat', 'lon'])
            writer.writerows(rows)
            
            from flask import Response
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=places.csv'}
            )
    except Exception as e:
        app.logger.error(f"Error in export_csv: {e}")
        return jsonify({"error": "Export failed", "details": str(e)}), 500

@app.get("/export/geojson")
def export_geojson():
    """Export places data as GeoJSON."""
    try:
        state_filter = request.args.get("state")
        name_filter = request.args.get("name")
        
        sql = """
        SELECT id, name, city, state, country, lat, lon,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM places
        WHERE 1=1
        """
        params = []
        
        if state_filter:
            sql += " AND state ILIKE %s"
            params.append(f"%{state_filter}%")
        
        if name_filter:
            sql += " AND name ILIKE %s"
            params.append(f"%{name_filter}%")
        
        sql += " ORDER BY id;"
        
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            
            features = []
            for r in rows:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "id": r[0],
                        "name": r[1],
                        "city": r[2],
                        "state": r[3],
                        "country": r[4],
                        "lat": r[5],
                        "lon": r[6]
                    },
                    "geometry": r[7]
                })
            
            geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            
            return jsonify(geojson)
    except Exception as e:
        app.logger.error(f"Error in export_geojson: {e}")
        return jsonify({"error": "Export failed", "details": str(e)}), 500

@app.get("/analytics/states")
def analytics_states():
    """Get analytics by state."""
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("""
                SELECT state, COUNT(*) as count,
                       AVG(lat) as avg_lat, AVG(lon) as avg_lon
                FROM places
                WHERE state IS NOT NULL
                GROUP BY state
                ORDER BY count DESC;
            """)
            rows = cur.fetchall()
            analytics = [
                {
                    "state": r[0],
                    "count": r[1],
                    "avg_lat": round(float(r[2]), 4) if r[2] else None,
                    "avg_lon": round(float(r[3]), 4) if r[3] else None
                }
                for r in rows
            ]
        return jsonify({"states": analytics, "total": len(analytics)})
    except Exception as e:
        app.logger.error(f"Error in analytics_states: {e}")
        return jsonify({"error": "Analytics failed", "details": str(e)}), 500

@app.get("/distance_matrix")
def distance_matrix():
    """Calculate distance matrix between multiple points."""
    try:
        points = request.args.get("points")
        if not points:
            return jsonify({"error": "points parameter required"}), 400
        
        point_list = [p.split(",") for p in points.split(";")]
        if len(point_list) < 2:
            return jsonify({"error": "At least 2 points required"}), 400
        
        results = []
        for i, p1 in enumerate(point_list):
            try:
                lat1, lon1 = float(p1[0]), float(p1[1])
                validate_coordinates(lat1, lon1)
            except (ValueError, IndexError):
                return jsonify({"error": f"Invalid coordinates at point {i+1}"}), 400
            
            row = []
            for j, p2 in enumerate(point_list):
                try:
                    lat2, lon2 = float(p2[0]), float(p2[1])
                    validate_coordinates(lat2, lon2)
                except (ValueError, IndexError):
                    return jsonify({"error": f"Invalid coordinates at point {j+1}"}), 400
                
                with get_conn() as conn, conn.cursor() as cur:
                    cur.execute("""
                        SELECT ST_Distance(
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                        ) / 1000.0;
                    """, (lon1, lat1, lon2, lat2))
                    distance = cur.fetchone()[0]
                    row.append(round(float(distance), 2) if distance else None)
            
            results.append({
                "point": {"lat": lat1, "lon": lon1},
                "distances": row
            })
        
        return jsonify({"matrix": results, "units": "kilometers"})
    except Exception as e:
        app.logger.error(f"Error in distance_matrix: {e}")
        return jsonify({"error": "Distance matrix calculation failed", "details": str(e)}), 500

@app.get("/analytics/density")
def analytics_density():
    """Get spatial density analysis."""
    try:
        lat = float(request.args.get("lat", 0))
        lon = float(request.args.get("lon", 0))
        radius = float(request.args.get("radius", 100))
        
        validate_coordinates(lat, lon)
        
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) 
                FROM places
                WHERE ST_DWithin(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                    %s * 1000
                );
            """, (lon, lat, radius))
            count = cur.fetchone()[0]
            
            area_km2 = 3.14159 * radius * radius
            density = (count / area_km2 * 1000) if area_km2 > 0 else 0
        
        return jsonify({
            "center": {"lat": lat, "lon": lon},
            "radius_km": radius,
            "count": count,
            "density_per_1000_km2": round(density, 2)
        })
    except Exception as e:
        app.logger.error(f"Error in analytics_density: {e}")
        return jsonify({"error": "Density analysis failed", "details": str(e)}), 500

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.post("/auth/login")
def login():
    """Login endpoint with role-based authentication."""
    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        
        if username not in DB_ROLES:
            return jsonify({"error": "Invalid username or password"}), 401
        
        role_info = DB_ROLES[username]
        
        if password != role_info["password"]:
            return jsonify({"error": "Invalid username or password"}), 401
        
        try:
            role_db_url = get_database_url_for_role(username)
            test_conn = psycopg.connect(role_db_url)
            test_conn.close()
        except Exception as e:
            return jsonify({"error": f"Database connection failed: {str(e)}"}), 500
        
        session['user_role'] = username
        session['permissions'] = role_info["permissions"]
        session.permanent = True  # Make session permanent
        
        # Generate token for frontend (more reliable than cookies)
        token = generate_token(username)
        
        app.logger.info(f"Login successful for {username}")
        app.logger.info(f"Token generated: {token[:20]}... (length: {len(token)})")
        
        return jsonify({
            "success": True,
            "role": username,
            "user_role": username,
            "permissions": role_info["permissions"],
            "message": f"Logged in as {username}",
            "token": token,  # Send token to frontend - IMPORTANT!
            "session_id": session.get('_id', 'unknown')
        })
    except Exception as e:
        app.logger.error(f"Login error: {e}")
        return jsonify({"error": "Login failed", "details": str(e)}), 500

@app.post("/auth/logout")
def logout():
    """Logout endpoint."""
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.get("/auth/check")
def check_auth():
    """Check current authentication status."""
    user_role = get_user_role_from_request()
    
    if user_role:
        role_info = DB_ROLES.get(user_role, {})
        return jsonify({
            "authenticated": True,
            "role": user_role,
            "user_role": user_role,
            "permissions": role_info.get("permissions", [])
        })
    else:
        return jsonify({
            "authenticated": False,
            "available_roles": list(DB_ROLES.keys())
        })

@app.get("/auth/roles")
def list_roles():
    """List available roles and their permissions (for demo purposes)."""
    roles_info = {}
    for role_name, role_data in DB_ROLES.items():
        roles_info[role_name] = {
            "permissions": role_data["permissions"],
            "description": get_role_description(role_name)
        }
    return jsonify({
        "available_roles": roles_info,
        "note": "This endpoint shows available roles for demonstration. In production, this would be restricted."
    })

def get_role_description(role_name):
    """Get description for a role."""
    descriptions = {
        "readonly_user": "Can only read data (SELECT queries)",
        "app_user": "Can read and write data (SELECT, INSERT, UPDATE)",
        "analyst_user": "Can read data and use analytics features",
        "admin_user": "Full access to all database operations"
    }
    return descriptions.get(role_name, "Unknown role")

# ============================================================================
# ADMIN FEATURES - ADD LOCATION
# ============================================================================

@app.post("/places/add")
def add_place():
    """Add a new place to the database. Requires INSERT permission (admin_user or app_user)."""
    try:
        # Debug: Log all headers to see what we're receiving
        auth_header = request.headers.get('Authorization', 'NOT_FOUND')
        x_token = request.headers.get('X-Auth-Token', 'NOT_FOUND')
        app.logger.info(f"Add Place - Authorization: {auth_header[:50] if auth_header != 'NOT_FOUND' else 'NOT_FOUND'}")
        app.logger.info(f"Add Place - X-Auth-Token: {x_token[:50] if x_token != 'NOT_FOUND' else 'NOT_FOUND'}")
        app.logger.info(f"Add Place - All headers: {list(request.headers.keys())}")
        
        # Check authentication using token or session
        role = get_user_role_from_request()
        
        app.logger.info(f"Add Place - Detected role: {role}")
        
        if not role:
            app.logger.warning(f"No authentication found for /places/add")
            return jsonify({"error": "Not authenticated", "message": "Please login first"}), 401
        
        # Check if user has INSERT permission
        # Admin, curator, and regular users can add places
        if role not in ['admin_user', 'app_user', 'curator_user']:
            return jsonify({
                "error": "Permission denied",
                "message": f"User '{role}' does not have permission to add locations. Only admin_user, curator_user, and app_user can add locations.",
                "required_role": "admin_user, curator_user, or app_user",
                "current_role": role
            }), 403
        
        # Get data from request
        data = request.get_json()
        name = data.get("name")
        city = data.get("city", "")
        state = data.get("state", "")
        country = data.get("country", "US")
        lat = data.get("lat")
        lon = data.get("lon")
        place_type = data.get("place_type", "brewery")  # Default to brewery
        type_specific_data = data.get("type_data", {})  # Type-specific attributes
        
        # Validate required fields
        if not name:
            return jsonify({"error": "Name is required"}), 400
        
        if lat is None or lon is None:
            return jsonify({"error": "Latitude and longitude are required"}), 400
        
        # Validate place_type
        valid_types = ['brewery', 'restaurant', 'tourist_place', 'hotel']
        if place_type not in valid_types:
            return jsonify({"error": f"Invalid place_type. Must be one of: {', '.join(valid_types)}"}), 400
        
        try:
            lat = float(lat)
            lon = float(lon)
            validate_coordinates(lat, lon)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid coordinates: {str(e)}"}), 400
        
        # Insert into database
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get user_id for created_by tracking
                    user_id = get_user_id_from_request()
                    
                    # Generate a unique source_id
                    import uuid
                    source_id = f"manual_{uuid.uuid4().hex[:12]}"
                    
                    # Insert into places table (with created_by tracking)
                    cur.execute("""
                        INSERT INTO places (source_id, name, city, state, country, lat, lon, geom, created_by)
                        VALUES (%s, %s, %s, %s, %s, %s, %s,
                                ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
                        RETURNING id, name, city, state, country, lat, lon;
                    """, (source_id, name, city, state, country, lat, lon, lon, lat, user_id))
                    
                    row = cur.fetchone()
                    place_id = row[0]
                    
                    # Insert into type-specific table based on place_type
                    if place_type == 'brewery':
                        brewery_type = type_specific_data.get('brewery_type', 'micro')
                        cur.execute("""
                            INSERT INTO breweries (place_id, brewery_type, website, phone, street, postal_code)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            place_id,
                            brewery_type,
                            type_specific_data.get('website'),
                            type_specific_data.get('phone'),
                            type_specific_data.get('street'),
                            type_specific_data.get('postal_code')
                        ))
                    elif place_type == 'restaurant':
                        cur.execute("""
                            INSERT INTO restaurants (place_id, cuisine_type, price_range, rating, website, phone, street, postal_code, hours_of_operation)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            place_id,
                            type_specific_data.get('cuisine_type'),
                            type_specific_data.get('price_range'),
                            type_specific_data.get('rating'),
                            type_specific_data.get('website'),
                            type_specific_data.get('phone'),
                            type_specific_data.get('street'),
                            type_specific_data.get('postal_code'),
                            type_specific_data.get('hours_of_operation')
                        ))
                    elif place_type == 'tourist_place':
                        cur.execute("""
                            INSERT INTO tourist_places (place_id, place_type, rating, entry_fee, website, phone, street, postal_code, description)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            place_id,
                            type_specific_data.get('place_type'),
                            type_specific_data.get('rating'),
                            type_specific_data.get('entry_fee'),
                            type_specific_data.get('website'),
                            type_specific_data.get('phone'),
                            type_specific_data.get('street'),
                            type_specific_data.get('postal_code'),
                            type_specific_data.get('description')
                        ))
                    elif place_type == 'hotel':
                        amenities = type_specific_data.get('amenities', [])
                        if isinstance(amenities, str):
                            amenities = [a.strip() for a in amenities.split(',')]
                        cur.execute("""
                            INSERT INTO hotels (place_id, star_rating, rating, price_per_night, amenities, website, phone, street, postal_code, check_in_time, check_out_time)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            place_id,
                            type_specific_data.get('star_rating'),
                            type_specific_data.get('rating'),
                            type_specific_data.get('price_per_night'),
                            amenities,
                            type_specific_data.get('website'),
                            type_specific_data.get('phone'),
                            type_specific_data.get('street'),
                            type_specific_data.get('postal_code'),
                            type_specific_data.get('check_in_time'),
                            type_specific_data.get('check_out_time')
                        ))
                    
                    conn.commit()
                    
                    new_place = {
                        "id": place_id,
                        "name": row[1],
                        "city": row[2],
                        "state": row[3],
                        "country": row[4],
                        "lat": float(row[5]),
                        "lon": float(row[6]),
                        "place_type": place_type
                    }
            
            return jsonify({
                "success": True,
                "message": "Location added successfully",
                "place": new_place,
                "role": role
            }), 201
            
        except psycopg.errors.InsufficientPrivilege as e:
            # Database-level permission error
            return jsonify({
                "error": "Database permission denied",
                "message": f"User '{role}' does not have INSERT permission. Database rejected the operation.",
                "details": str(e)
            }), 403
        except Exception as e:
            app.logger.error(f"Error adding place: {e}")
            return jsonify({"error": "Failed to add location", "details": str(e)}), 500
            
    except Exception as e:
        app.logger.error(f"Error in add_place: {e}")
        return jsonify({"error": "Failed to add location", "details": str(e)}), 500

@app.post("/places/upload-csv")
def upload_csv():
    """Bulk upload places from CSV file. Admin only."""
    # Debug: Log headers to see what we're receiving
    auth_header = request.headers.get('Authorization', 'NOT_FOUND')
    x_token = request.headers.get('X-Auth-Token', 'NOT_FOUND')
    
    # Log full tokens (for debugging)
    if auth_header != 'NOT_FOUND':
        token_from_auth = auth_header[7:].strip() if auth_header.startswith('Bearer ') else auth_header
        app.logger.info(f"CSV Upload - Authorization token (full, length {len(token_from_auth)}): {token_from_auth}")
    else:
        app.logger.info(f"CSV Upload - Authorization: NOT_FOUND")
    
    if x_token != 'NOT_FOUND':
        app.logger.info(f"CSV Upload - X-Auth-Token (full, length {len(x_token)}): {x_token}")
    else:
        app.logger.info(f"CSV Upload - X-Auth-Token: NOT_FOUND")
    
    app.logger.info(f"CSV Upload - TOKEN_STORAGE has {len(TOKEN_STORAGE)} tokens")
    if TOKEN_STORAGE:
        sample_token = list(TOKEN_STORAGE.keys())[0]
        app.logger.info(f"CSV Upload - Sample stored token (length {len(sample_token)}): {sample_token[:30]}...")
    
    # Get user role using unified authentication method
    user_role = get_user_role_from_request()
    
    app.logger.info(f"CSV Upload - Detected role: {user_role}")
    
    # Fallback: Check FormData field (for file uploads)
    if not user_role:
        user_role_field = request.form.get('user_role')
        if user_role_field and user_role_field in DB_ROLES:
            user_role = user_role_field
            app.logger.info(f"CSV Upload - Authenticated via FormData field: {user_role}")
    
    # If still no authentication found
    if not user_role:
        app.logger.warning(f"CSV Upload - No authentication found.")
        return jsonify({
            "error": "Not authenticated", 
            "message": "Please login first, then try uploading."
        }), 401
    
    # Only admin_user can bulk upload
    if user_role != 'admin_user':
            return jsonify({
                "error": "Permission denied",
                "message": "Only admin_user can bulk upload CSV files.",
                "required_role": "admin_user",
                "current_role": user_role
            }), 403
    
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({"error": "No file provided. Please upload a CSV file."}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not file.filename.lower().endswith('.csv'):
        return jsonify({"error": "File must be a CSV file"}), 400
    
    try:
        # Read CSV file
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        # Expected CSV columns
        required_columns = ['name', 'lat', 'lon']
        
        # Validate headers
        if not csv_reader.fieldnames:
            return jsonify({"error": "CSV file is empty or invalid"}), 400
        
        # Check required columns (case-insensitive)
        headers_lower = [h.lower().strip() if h else '' for h in csv_reader.fieldnames]
        missing = [col for col in required_columns if col.lower() not in headers_lower]
        
        if missing:
            return jsonify({
                "error": f"Missing required columns: {', '.join(missing)}",
                "required": required_columns,
                "found": list(csv_reader.fieldnames)
            }), 400
        
        # Process rows
        inserted_count = 0
        skipped_count = 0
        errors = []
        
        with get_conn() as conn:
            with conn.cursor() as cur:
                for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
                    try:
                        # Map CSV columns (case-insensitive)
                        row_dict = {k.lower().strip() if k else '': v for k, v in row.items() if k}
                        
                        name = row_dict.get('name', '').strip()
                        lat_str = row_dict.get('lat', '').strip()
                        lon_str = row_dict.get('lon', '').strip()
                        city = row_dict.get('city', '').strip()
                        state = row_dict.get('state', '').strip()
                        country = row_dict.get('country', 'US').strip() or 'US'
                        source_id = row_dict.get('source_id', '').strip()
                        place_type = row_dict.get('place_type', 'brewery').strip().lower()
                        
                        # Validate place_type
                        valid_types = ['brewery', 'restaurant', 'tourist_place', 'hotel']
                        if place_type not in valid_types:
                            errors.append(f"Row {row_num}: Invalid place_type '{place_type}'. Must be one of: {', '.join(valid_types)}")
                            skipped_count += 1
                            continue
                        
                        # Validate required fields
                        if not name:
                            errors.append(f"Row {row_num}: Name is required")
                            skipped_count += 1
                            continue
                        
                        if not lat_str or not lon_str:
                            errors.append(f"Row {row_num}: Latitude and longitude are required")
                            skipped_count += 1
                            continue
                        
                        # Parse coordinates
                        try:
                            lat = float(lat_str)
                            lon = float(lon_str)
                            validate_coordinates(lat, lon)
                        except (ValueError, TypeError) as e:
                            errors.append(f"Row {row_num}: Invalid coordinates - {str(e)}")
                            skipped_count += 1
                            continue
                        
                        # Generate source_id if not provided
                        if not source_id:
                            source_id = f"csv_{uuid.uuid4().hex[:12]}"
                        
                        # Insert into database
                        try:
                            # Get user_id for created_by tracking (admin who uploaded CSV)
                            user_id = get_user_id_from_request()
                            
                            # Insert into places table (with created_by tracking)
                            cur.execute("""
                                INSERT INTO places (source_id, name, city, state, country, lat, lon, geom, created_by)
                                SELECT %s, %s, %s, %s, %s, %s, %s,
                                       ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM places WHERE source_id = %s
                                )
                                RETURNING id;
                            """, (source_id, name, city, state, country, lat, lon, lon, lat, user_id, source_id))
                            
                            result = cur.fetchone()
                            if result:
                                place_id = result[0]
                                
                                # Insert into type-specific table
                                if place_type == 'brewery':
                                    brewery_type = row_dict.get('brewery_type', 'micro').strip() or 'micro'
                                    cur.execute("""
                                        INSERT INTO breweries (place_id, brewery_type, website, phone, street, postal_code)
                                        VALUES (%s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (place_id) DO NOTHING
                                    """, (
                                        place_id,
                                        brewery_type,
                                        row_dict.get('website', '').strip() or None,
                                        row_dict.get('phone', '').strip() or None,
                                        row_dict.get('street', '').strip() or None,
                                        row_dict.get('postal_code', '').strip() or None
                                    ))
                                elif place_type == 'restaurant':
                                    cur.execute("""
                                        INSERT INTO restaurants (place_id, cuisine_type, price_range, rating, website, phone, street, postal_code, hours_of_operation)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (place_id) DO NOTHING
                                    """, (
                                        place_id,
                                        row_dict.get('cuisine_type', '').strip() or None,
                                        int(row_dict.get('price_range', 0)) if row_dict.get('price_range', '').strip() else None,
                                        float(row_dict.get('rating', 0)) if row_dict.get('rating', '').strip() else None,
                                        row_dict.get('website', '').strip() or None,
                                        row_dict.get('phone', '').strip() or None,
                                        row_dict.get('street', '').strip() or None,
                                        row_dict.get('postal_code', '').strip() or None,
                                        row_dict.get('hours_of_operation', '').strip() or None
                                    ))
                                elif place_type == 'tourist_place':
                                    cur.execute("""
                                        INSERT INTO tourist_places (place_id, place_type, rating, entry_fee, website, phone, street, postal_code, description)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (place_id) DO NOTHING
                                    """, (
                                        place_id,
                                        row_dict.get('tourist_type', '').strip() or None,
                                        float(row_dict.get('rating', 0)) if row_dict.get('rating', '').strip() else None,
                                        float(row_dict.get('entry_fee', 0)) if row_dict.get('entry_fee', '').strip() else None,
                                        row_dict.get('website', '').strip() or None,
                                        row_dict.get('phone', '').strip() or None,
                                        row_dict.get('street', '').strip() or None,
                                        row_dict.get('postal_code', '').strip() or None,
                                        row_dict.get('description', '').strip() or None
                                    ))
                                elif place_type == 'hotel':
                                    amenities_str = row_dict.get('amenities', '').strip()
                                    amenities = [a.strip() for a in amenities_str.split(',')] if amenities_str else []
                                    cur.execute("""
                                        INSERT INTO hotels (place_id, star_rating, rating, price_per_night, amenities, website, phone, street, postal_code, check_in_time, check_out_time)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (place_id) DO NOTHING
                                    """, (
                                        place_id,
                                        int(row_dict.get('star_rating', 0)) if row_dict.get('star_rating', '').strip() else None,
                                        float(row_dict.get('rating', 0)) if row_dict.get('rating', '').strip() else None,
                                        float(row_dict.get('price_per_night', 0)) if row_dict.get('price_per_night', '').strip() else None,
                                        amenities if amenities else None,
                                        row_dict.get('website', '').strip() or None,
                                        row_dict.get('phone', '').strip() or None,
                                        row_dict.get('street', '').strip() or None,
                                        row_dict.get('postal_code', '').strip() or None,
                                        row_dict.get('check_in_time', '').strip() or None,
                                        row_dict.get('check_out_time', '').strip() or None
                                    ))
                                
                                inserted_count += 1
                            else:
                                skipped_count += 1
                                errors.append(f"Row {row_num}: Duplicate source_id '{source_id}' - skipped")
                        
                        except psycopg.Error as e:
                            errors.append(f"Row {row_num}: Database error - {str(e)}")
                            skipped_count += 1
                            continue
                    
                    except Exception as e:
                        errors.append(f"Row {row_num}: Unexpected error - {str(e)}")
                        skipped_count += 1
                        continue
                
                conn.commit()
        
        return jsonify({
            "success": True,
            "message": f"CSV upload completed",
            "summary": {
                "inserted": inserted_count,
                "skipped": skipped_count,
                "total_rows": inserted_count + skipped_count
            },
            "errors": errors[:20],  # Limit to first 20 errors
            "error_count": len(errors)
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error in CSV upload: {e}")
        return jsonify({
            "error": "Failed to process CSV file",
            "details": str(e)
        }), 500

# ============================================================================
# USER ACCOUNTS & PERSONAL LISTS ENDPOINTS
# ============================================================================

@app.post("/api/users/register")
def register_user():
    """Register a new user account for personal lists."""
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")
        
        if not username or not email or not password:
            return jsonify({"error": "Username, email, and password required"}), 400
        
        if len(username) < 3 or len(username) > 50:
            return jsonify({"error": "Username must be 3-50 characters"}), 400
        
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Use admin connection for registration (requires INSERT permission on users table)
        with get_admin_conn() as conn, conn.cursor() as cur:
            # Check if username or email already exists
            cur.execute("SELECT user_id FROM users WHERE username = %s OR email = %s", (username, email))
            if cur.fetchone():
                return jsonify({"error": "Username or email already exists"}), 400
            
            # Create user
            cur.execute("""
                INSERT INTO users (username, email, password_hash)
                VALUES (%s, %s, %s)
                RETURNING user_id, username, email, created_at
            """, (username, email, password_hash))
            
            user_data = cur.fetchone()
            conn.commit()
            
            return jsonify({
                "success": True,
                "user": {
                    "user_id": user_data[0],
                    "username": user_data[1],
                    "email": user_data[2],
                    "created_at": user_data[3].isoformat() if user_data[3] else None
                },
                "message": "User registered successfully"
            }), 201
            
    except psycopg.errors.UniqueViolation:
        return jsonify({"error": "Username or email already exists"}), 400
    except Exception as e:
        app.logger.error(f"Registration error: {e}")
        return jsonify({"error": "Registration failed", "details": str(e)}), 500

@app.post("/api/users/login")
def login_user():
    """Login with user account (separate from role-based auth)."""
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "")
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT user_id, username, email, password_hash FROM users WHERE username = %s", (username,))
            user = cur.fetchone()
            
            if not user:
                return jsonify({"error": "Invalid username or password"}), 401
            
            user_id, db_username, email, password_hash = user
            
            # Verify password
            if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                return jsonify({"error": "Invalid username or password"}), 401
            
            # Generate token with user_id
            token = generate_token(db_username, user_id=user_id)
            
            return jsonify({
                "success": True,
                "token": token,
                "user": {
                    "user_id": user_id,
                    "username": db_username,
                    "email": email
                },
                "message": "Login successful"
            }), 200
            
    except Exception as e:
        app.logger.error(f"User login error: {e}")
        return jsonify({"error": "Login failed", "details": str(e)}), 500

@app.get("/api/users/profile")
def get_user_profile():
    """Get current user profile and list statistics."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # Get user info
            cur.execute("SELECT user_id, username, email, created_at FROM users WHERE user_id = %s", (user_id,))
            user = cur.fetchone()
            
            if not user:
                return jsonify({"error": "User not found"}), 404
            
            # Get list counts
            cur.execute("SELECT COUNT(*) FROM user_visited_places WHERE user_id = %s", (user_id,))
            visited_count = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM user_wishlist WHERE user_id = %s", (user_id,))
            wishlist_count = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM user_liked_places WHERE user_id = %s", (user_id,))
            liked_count = cur.fetchone()[0]
            
            return jsonify({
                "user": {
                    "user_id": user[0],
                    "username": user[1],
                    "email": user[2],
                    "created_at": user[3].isoformat() if user[3] else None
                },
                "statistics": {
                    "visited_count": visited_count,
                    "wishlist_count": wishlist_count,
                    "liked_count": liked_count
                }
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting profile: {e}")
        return jsonify({"error": "Failed to get profile", "details": str(e)}), 500

@app.get("/api/users/stats")
def get_users_stats():
    """Get statistics about registered users (public endpoint)."""
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # Get total users
            cur.execute("SELECT COUNT(*) FROM users")
            total_users = cur.fetchone()[0]
            
            # Get users with list activity
            cur.execute("""
                SELECT COUNT(DISTINCT user_id) 
                FROM (
                    SELECT user_id FROM user_visited_places
                    UNION
                    SELECT user_id FROM user_wishlist
                    UNION
                    SELECT user_id FROM user_liked_places
                ) active_users
            """)
            active_users = cur.fetchone()[0]
            
            # Get total list entries
            cur.execute("SELECT COUNT(*) FROM user_visited_places")
            total_visited = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM user_wishlist")
            total_wishlist = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM user_liked_places")
            total_liked = cur.fetchone()[0]
            
            return jsonify({
                "total_users": total_users,
                "active_users": active_users,
                "total_list_entries": {
                    "visited": total_visited,
                    "wishlist": total_wishlist,
                    "liked": total_liked
                }
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting users stats: {e}")
        return jsonify({"error": "Failed to get users stats", "details": str(e)}), 500

# ============================================================================
# VISITED LIST ENDPOINTS
# ============================================================================

@app.get("/api/user/visited")
def get_visited_list():
    """Get all places user has visited. Optional: ?lat=X&lon=Y to calculate distances."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    # Get reference location for distance calculation (optional)
    ref_lat = request.args.get("lat", type=float)
    ref_lon = request.args.get("lon", type=float)
    calculate_distance = ref_lat is not None and ref_lon is not None
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            if calculate_distance:
                # Use PostGIS to calculate distance in kilometers
                ref_point = f"ST_SetSRID(ST_MakePoint({ref_lon}, {ref_lat}), 4326)"
                cur.execute(f"""
                    SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon,
                           v.visited_at, v.notes,
                           ST_Distance(
                               ST_Transform(p.geom, 3857),
                               ST_Transform({ref_point}, 3857)
                           ) / 1000.0 as distance_km
                    FROM user_visited_places v
                    JOIN places p ON v.place_id = p.id
                    WHERE v.user_id = %s
                    ORDER BY distance_km ASC, v.visited_at DESC
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon,
                           v.visited_at, v.notes,
                           NULL as distance_km
                    FROM user_visited_places v
                    JOIN places p ON v.place_id = p.id
                    WHERE v.user_id = %s
                    ORDER BY v.visited_at DESC
                """, (user_id,))
            
            places = []
            for row in cur.fetchall():
                place_data = {
                    "id": row[0],
                    "name": row[1],
                    "city": row[2],
                    "state": row[3],
                    "country": row[4],
                    "lat": float(row[5]) if row[5] else None,
                    "lon": float(row[6]) if row[6] else None,
                    "visited_at": row[7].isoformat() if row[7] else None,
                    "notes": row[8]
                }
                if calculate_distance and row[9] is not None:
                    place_data["distance_km"] = round(float(row[9]), 2)
                
                places.append(place_data)
            
            return jsonify({
                "success": True, 
                "places": places, 
                "count": len(places),
                "reference_location": {"lat": ref_lat, "lon": ref_lon} if calculate_distance else None
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting visited list: {e}")
        return jsonify({"error": "Failed to get visited list", "details": str(e)}), 500

@app.post("/api/user/visited")
def add_to_visited():
    """Mark a place as visited."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        place_id = data.get("place_id")
        notes = data.get("notes", "").strip()
        
        if not place_id:
            return jsonify({"error": "place_id required"}), 400
        
        with get_conn() as conn, conn.cursor() as cur:
            # Check if place exists
            cur.execute("SELECT id FROM places WHERE id = %s", (place_id,))
            if not cur.fetchone():
                return jsonify({"error": "Place not found"}), 404
            
            # Add to visited (or update if exists)
            cur.execute("""
                INSERT INTO user_visited_places (user_id, place_id, notes)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, place_id)
                DO UPDATE SET notes = EXCLUDED.notes, visited_at = CURRENT_TIMESTAMP
                RETURNING visit_id, visited_at
            """, (user_id, place_id, notes))
            
            result = cur.fetchone()
            conn.commit()
            
            return jsonify({
                "success": True,
                "visit_id": result[0],
                "visited_at": result[1].isoformat() if result[1] else None,
                "message": "Place marked as visited"
            }), 201
            
    except Exception as e:
        app.logger.error(f"Error adding to visited: {e}")
        return jsonify({"error": "Failed to add to visited", "details": str(e)}), 500

@app.delete("/api/user/visited/<int:place_id>")
def remove_from_visited(place_id):
    """Remove a place from visited list."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM user_visited_places WHERE user_id = %s AND place_id = %s", (user_id, place_id))
            conn.commit()
            
            return jsonify({"success": True, "message": "Removed from visited list"}), 200
            
    except Exception as e:
        app.logger.error(f"Error removing from visited: {e}")
        return jsonify({"error": "Failed to remove from visited", "details": str(e)}), 500

# ============================================================================
# WISHLIST ENDPOINTS
# ============================================================================

@app.get("/api/user/wishlist")
def get_wishlist():
    """Get user's wishlist. Optional: ?lat=X&lon=Y to calculate distances."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    # Get reference location for distance calculation (optional)
    ref_lat = request.args.get("lat", type=float)
    ref_lon = request.args.get("lon", type=float)
    calculate_distance = ref_lat is not None and ref_lon is not None
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            if calculate_distance:
                # Use PostGIS to calculate distance in kilometers
                ref_point = f"ST_SetSRID(ST_MakePoint({ref_lon}, {ref_lat}), 4326)"
                cur.execute(f"""
                    SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon,
                           w.priority, w.added_at, w.notes,
                           ST_Distance(
                               ST_Transform(p.geom, 3857),
                               ST_Transform({ref_point}, 3857)
                           ) / 1000.0 as distance_km
                    FROM user_wishlist w
                    JOIN places p ON w.place_id = p.id
                    WHERE w.user_id = %s
                    ORDER BY distance_km ASC, w.priority DESC, w.added_at DESC
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon,
                           w.priority, w.added_at, w.notes,
                           NULL as distance_km
                    FROM user_wishlist w
                    JOIN places p ON w.place_id = p.id
                    WHERE w.user_id = %s
                    ORDER BY w.priority DESC, w.added_at DESC
                """, (user_id,))
            
            places = []
            for row in cur.fetchall():
                place_data = {
                    "id": row[0],
                    "name": row[1],
                    "city": row[2],
                    "state": row[3],
                    "country": row[4],
                    "lat": float(row[5]) if row[5] else None,
                    "lon": float(row[6]) if row[6] else None,
                    "priority": row[7],
                    "added_at": row[8].isoformat() if row[8] else None,
                    "notes": row[9]
                }
                if calculate_distance and row[10] is not None:
                    place_data["distance_km"] = round(float(row[10]), 2)
                
                places.append(place_data)
            
            return jsonify({
                "success": True, 
                "places": places, 
                "count": len(places),
                "reference_location": {"lat": ref_lat, "lon": ref_lon} if calculate_distance else None
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting wishlist: {e}")
        return jsonify({"error": "Failed to get wishlist", "details": str(e)}), 500

@app.post("/api/user/wishlist")
def add_to_wishlist():
    """Add a place to wishlist."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        place_id = data.get("place_id")
        priority = data.get("priority", 1)
        notes = data.get("notes", "").strip()
        
        if not place_id:
            return jsonify({"error": "place_id required"}), 400
        
        if priority < 1 or priority > 3:
            priority = 1
        
        with get_conn() as conn, conn.cursor() as cur:
            # Check if place exists
            cur.execute("SELECT id FROM places WHERE id = %s", (place_id,))
            if not cur.fetchone():
                return jsonify({"error": "Place not found"}), 404
            
            # Add to wishlist
            cur.execute("""
                INSERT INTO user_wishlist (user_id, place_id, priority, notes)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, place_id)
                DO UPDATE SET priority = EXCLUDED.priority, notes = EXCLUDED.notes
                RETURNING wish_id, added_at
            """, (user_id, place_id, priority, notes))
            
            result = cur.fetchone()
            conn.commit()
            
            return jsonify({
                "success": True,
                "wish_id": result[0],
                "added_at": result[1].isoformat() if result[1] else None,
                "message": "Added to wishlist"
            }), 201
            
    except Exception as e:
        app.logger.error(f"Error adding to wishlist: {e}")
        return jsonify({"error": "Failed to add to wishlist", "details": str(e)}), 500

@app.delete("/api/user/wishlist/<int:place_id>")
def remove_from_wishlist(place_id):
    """Remove a place from wishlist."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM user_wishlist WHERE user_id = %s AND place_id = %s", (user_id, place_id))
            conn.commit()
            
            return jsonify({"success": True, "message": "Removed from wishlist"}), 200
            
    except Exception as e:
        app.logger.error(f"Error removing from wishlist: {e}")
        return jsonify({"error": "Failed to remove from wishlist", "details": str(e)}), 500

# ============================================================================
# LIKED/FAVORITES ENDPOINTS
# ============================================================================

@app.get("/api/user/liked")
def get_liked_list():
    """Get all places user has liked. Optional: ?lat=X&lon=Y to calculate distances."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    # Get reference location for distance calculation (optional)
    ref_lat = request.args.get("lat", type=float)
    ref_lon = request.args.get("lon", type=float)
    calculate_distance = ref_lat is not None and ref_lon is not None
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            if calculate_distance:
                # Use PostGIS to calculate distance in kilometers
                ref_point = f"ST_SetSRID(ST_MakePoint({ref_lon}, {ref_lat}), 4326)"
                cur.execute(f"""
                    SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon,
                           l.rating, l.liked_at, l.notes,
                           ST_Distance(
                               ST_Transform(p.geom, 3857),
                               ST_Transform({ref_point}, 3857)
                           ) / 1000.0 as distance_km
                    FROM user_liked_places l
                    JOIN places p ON l.place_id = p.id
                    WHERE l.user_id = %s
                    ORDER BY distance_km ASC, l.liked_at DESC
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon,
                           l.rating, l.liked_at, l.notes,
                           NULL as distance_km
                    FROM user_liked_places l
                    JOIN places p ON l.place_id = p.id
                    WHERE l.user_id = %s
                    ORDER BY l.liked_at DESC
                """, (user_id,))
            
            places = []
            for row in cur.fetchall():
                place_data = {
                    "id": row[0],
                    "name": row[1],
                    "city": row[2],
                    "state": row[3],
                    "country": row[4],
                    "lat": float(row[5]) if row[5] else None,
                    "lon": float(row[6]) if row[6] else None,
                    "rating": row[7],
                    "liked_at": row[8].isoformat() if row[8] else None,
                    "notes": row[9]
                }
                if calculate_distance and row[10] is not None:
                    place_data["distance_km"] = round(float(row[10]), 2)
                
                places.append(place_data)
            
            return jsonify({
                "success": True, 
                "places": places, 
                "count": len(places),
                "reference_location": {"lat": ref_lat, "lon": ref_lon} if calculate_distance else None
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting liked list: {e}")
        return jsonify({"error": "Failed to get liked list", "details": str(e)}), 500

@app.post("/api/user/liked")
def add_to_liked():
    """Like a place (add to favorites)."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        place_id = data.get("place_id")
        rating = data.get("rating")  # Optional: 1-5 stars
        notes = data.get("notes", "").strip()
        
        if not place_id:
            return jsonify({"error": "place_id required"}), 400
        
        if rating and (rating < 1 or rating > 5):
            rating = None
        
        with get_conn() as conn, conn.cursor() as cur:
            # Check if place exists
            cur.execute("SELECT id FROM places WHERE id = %s", (place_id,))
            if not cur.fetchone():
                return jsonify({"error": "Place not found"}), 404
            
            # Add to liked
            cur.execute("""
                INSERT INTO user_liked_places (user_id, place_id, rating, notes)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, place_id)
                DO UPDATE SET rating = COALESCE(EXCLUDED.rating, user_liked_places.rating),
                              notes = EXCLUDED.notes
                RETURNING like_id, liked_at
            """, (user_id, place_id, rating, notes))
            
            result = cur.fetchone()
            conn.commit()
            
            return jsonify({
                "success": True,
                "like_id": result[0],
                "liked_at": result[1].isoformat() if result[1] else None,
                "message": "Place liked"
            }), 201
            
    except Exception as e:
        app.logger.error(f"Error adding to liked: {e}")
        return jsonify({"error": "Failed to like place", "details": str(e)}), 500

@app.delete("/api/user/liked/<int:place_id>")
def remove_from_liked(place_id):
    """Remove a place from liked list."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM user_liked_places WHERE user_id = %s AND place_id = %s", (user_id, place_id))
            conn.commit()
            
            return jsonify({"success": True, "message": "Removed from liked list"}), 200
            
    except Exception as e:
        app.logger.error(f"Error removing from liked: {e}")
        return jsonify({"error": "Failed to remove from liked", "details": str(e)}), 500

# ============================================================================
# GET LIST STATUS FOR PLACES
# ============================================================================

@app.get("/api/user/place-status/<int:place_id>")
def get_place_status(place_id):
    """Get list status for a specific place (visited, wishlist, liked)."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({
            "visited": False,
            "in_wishlist": False,
            "liked": False
        }), 200  # Return defaults if not authenticated
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM user_visited_places WHERE user_id = %s AND place_id = %s) > 0 as is_visited,
                    (SELECT COUNT(*) FROM user_wishlist WHERE user_id = %s AND place_id = %s) > 0 as in_wishlist,
                    (SELECT COUNT(*) FROM user_liked_places WHERE user_id = %s AND place_id = %s) > 0 as is_liked
            """, (user_id, place_id, user_id, place_id, user_id, place_id))
            
            result = cur.fetchone()
            
            return jsonify({
                "visited": result[0] if result else False,
                "in_wishlist": result[1] if result else False,
                "liked": result[2] if result else False
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting place status: {e}")
        return jsonify({
            "visited": False,
            "in_wishlist": False,
            "liked": False,
            "error": str(e)
        }), 200  # Return defaults on error

# ============================================================================
# GROUPS ENDPOINTS
# ============================================================================

@app.post("/api/groups")
def create_group():
    """Create a new group."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        name = data.get("name", "").strip()
        description = data.get("description", "").strip()
        
        if not name or len(name) < 3:
            return jsonify({"error": "Group name must be at least 3 characters"}), 400
        
        with get_conn() as conn, conn.cursor() as cur:
            # Create group
            cur.execute("""
                INSERT INTO groups (name, description, created_by)
                VALUES (%s, %s, %s)
                RETURNING group_id, name, description, created_by, created_at
            """, (name, description, user_id))
            
            group_data = cur.fetchone()
            group_id = group_data[0]
            
            # Add creator as admin member
            cur.execute("""
                INSERT INTO group_members (group_id, user_id, role)
                VALUES (%s, %s, 'admin')
            """, (group_id, user_id))
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "group": {
                    "group_id": group_id,
                    "name": group_data[1],
                    "description": group_data[2],
                    "created_by": group_data[3],
                    "created_at": group_data[4].isoformat() if group_data[4] else None
                },
                "message": "Group created successfully"
            }), 201
            
    except Exception as e:
        app.logger.error(f"Error creating group: {e}")
        return jsonify({"error": "Failed to create group", "details": str(e)}), 500

@app.get("/api/groups")
def get_user_groups():
    """Get all groups the current user belongs to."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("""
                SELECT g.group_id, g.name, g.description, g.created_by, g.created_at,
                       u.username as creator_username,
                       gm.role, gm.joined_at,
                       (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id) as member_count
                FROM groups g
                JOIN group_members gm ON g.group_id = gm.group_id
                JOIN users u ON g.created_by = u.user_id
                WHERE gm.user_id = %s
                ORDER BY g.created_at DESC
            """, (user_id,))
            
            groups = []
            for row in cur.fetchall():
                groups.append({
                    "group_id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "created_by": row[3],
                    "created_at": row[4].isoformat() if row[4] else None,
                    "creator_username": row[5],
                    "your_role": row[6],
                    "joined_at": row[7].isoformat() if row[7] else None,
                    "member_count": row[8]
                })
            
            return jsonify({"success": True, "groups": groups}), 200
            
    except Exception as e:
        app.logger.error(f"Error getting groups: {e}")
        return jsonify({"error": "Failed to get groups", "details": str(e)}), 500

@app.get("/api/groups/<int:group_id>")
def get_group_details(group_id):
    """Get group details including members."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # Check if user is a member
            cur.execute("""
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            membership = cur.fetchone()
            
            if not membership:
                return jsonify({"error": "You are not a member of this group"}), 403
            
            # Get group info
            cur.execute("""
                SELECT g.group_id, g.name, g.description, g.created_by, g.created_at,
                       u.username as creator_username
                FROM groups g
                JOIN users u ON g.created_by = u.user_id
                WHERE g.group_id = %s
            """, (group_id,))
            
            group_row = cur.fetchone()
            if not group_row:
                return jsonify({"error": "Group not found"}), 404
            
            # Get members
            cur.execute("""
                SELECT u.user_id, u.username, u.email, gm.role, gm.joined_at
                FROM group_members gm
                JOIN users u ON gm.user_id = u.user_id
                WHERE gm.group_id = %s
                ORDER BY gm.role DESC, gm.joined_at ASC
            """, (group_id,))
            
            members = []
            for row in cur.fetchall():
                members.append({
                    "user_id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "role": row[3],
                    "joined_at": row[4].isoformat() if row[4] else None
                })
            
            return jsonify({
                "success": True,
                "group": {
                    "group_id": group_row[0],
                    "name": group_row[1],
                    "description": group_row[2],
                    "created_by": group_row[3],
                    "created_at": group_row[4].isoformat() if group_row[4] else None,
                    "creator_username": group_row[5],
                    "your_role": membership[0]
                },
                "members": members
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting group details: {e}")
        return jsonify({"error": "Failed to get group details", "details": str(e)}), 500

@app.post("/api/groups/<int:group_id>/members")
def add_group_member(group_id):
    """Add a member to a group by username."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        
        if not username:
            return jsonify({"error": "Username is required"}), 400
        
        with get_conn() as conn, conn.cursor() as cur:
            # Check if current user is admin
            cur.execute("""
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            membership = cur.fetchone()
            
            if not membership or membership[0] != 'admin':
                return jsonify({"error": "Only group admins can add members"}), 403
            
            # Find user by username
            cur.execute("SELECT user_id FROM users WHERE username = %s", (username,))
            new_member = cur.fetchone()
            
            if not new_member:
                return jsonify({"error": "User not found"}), 404
            
            new_member_id = new_member[0]
            
            # Check if already a member
            cur.execute("""
                SELECT user_id FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, new_member_id))
            
            if cur.fetchone():
                return jsonify({"error": "User is already a member"}), 400
            
            # Add member
            cur.execute("""
                INSERT INTO group_members (group_id, user_id, role)
                VALUES (%s, %s, 'member')
            """, (group_id, new_member_id))
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": f"User {username} added to group"
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error adding group member: {e}")
        return jsonify({"error": "Failed to add member", "details": str(e)}), 500

@app.delete("/api/groups/<int:group_id>/members/<int:member_id>")
def remove_group_member(group_id, member_id):
    """Remove a member from a group."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # Check if current user is admin
            cur.execute("""
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            membership = cur.fetchone()
            
            if not membership or membership[0] != 'admin':
                return jsonify({"error": "Only group admins can remove members"}), 403
            
            # Can't remove yourself
            if member_id == user_id:
                return jsonify({"error": "Cannot remove yourself from group"}), 400
            
            # Remove member
            cur.execute("""
                DELETE FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, member_id))
            
            if cur.rowcount == 0:
                return jsonify({"error": "Member not found in group"}), 404
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": "Member removed from group"
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error removing group member: {e}")
        return jsonify({"error": "Failed to remove member", "details": str(e)}), 500

@app.get("/api/groups/<int:group_id>/places")
def get_group_places(group_id):
    """Get all places with member list statuses for a group."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # Check if user is a member
            cur.execute("""
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            membership = cur.fetchone()
            
            if not membership:
                return jsonify({"error": "You are not a member of this group"}), 403
            
            # Get all places with member statuses
            # We'll get places that at least one member has in their lists, plus all places
            # For now, let's get places from search results or all places
            # The frontend will filter by group member lists
            
            # Get unique places from all group members' lists (with place_type)
            cur.execute("""
                SELECT DISTINCT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon, pwt.place_type
                FROM places p
                LEFT JOIN places_with_types pwt ON p.id = pwt.id
                WHERE p.id IN (
                    SELECT DISTINCT place_id FROM user_visited_places
                    WHERE user_id IN (SELECT user_id FROM group_members WHERE group_id = %s)
                    UNION
                    SELECT DISTINCT place_id FROM user_wishlist
                    WHERE user_id IN (SELECT user_id FROM group_members WHERE group_id = %s)
                    UNION
                    SELECT DISTINCT place_id FROM user_liked_places
                    WHERE user_id IN (SELECT user_id FROM group_members WHERE group_id = %s)
                )
                ORDER BY p.name
            """, (group_id, group_id, group_id))
            
            places_data = cur.fetchall()
            places = []
            
            for place_row in places_data:
                place_id = place_row[0]
                
                # Get member statuses for this place
                cur.execute("""
                    SELECT 
                        u.user_id,
                        u.username,
                        CASE WHEN v.visit_id IS NOT NULL THEN TRUE ELSE FALSE END as visited,
                        CASE WHEN w.wish_id IS NOT NULL THEN TRUE ELSE FALSE END as in_wishlist,
                        CASE WHEN l.like_id IS NOT NULL THEN TRUE ELSE FALSE END as liked
                    FROM group_members gm
                    JOIN users u ON gm.user_id = u.user_id
                    LEFT JOIN user_visited_places v ON v.user_id = u.user_id AND v.place_id = %s
                    LEFT JOIN user_wishlist w ON w.user_id = u.user_id AND w.place_id = %s
                    LEFT JOIN user_liked_places l ON l.user_id = u.user_id AND l.place_id = %s
                    WHERE gm.group_id = %s
                    ORDER BY u.username
                """, (place_id, place_id, place_id, group_id))
                
                members = []
                for member_row in cur.fetchall():
                    members.append({
                        "user_id": member_row[0],
                        "username": member_row[1],
                        "visited": member_row[2],
                        "in_wishlist": member_row[3],
                        "liked": member_row[4]
                    })
                
                places.append({
                    "id": place_id,
                    "name": place_row[1],
                    "city": place_row[2],
                    "state": place_row[3],
                    "country": place_row[4],
                    "lat": float(place_row[5]) if place_row[5] else None,
                    "lon": float(place_row[6]) if place_row[6] else None,
                    "place_type": place_row[7] if len(place_row) > 7 and place_row[7] else "unknown",
                    "members": members
                })
            
            return jsonify({
                "success": True,
                "group_id": group_id,
                "places": places
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting group places: {e}")
        return jsonify({"error": "Failed to get group places", "details": str(e)}), 500

# ============================================================================
# MY ADDED PLACES & PLACE MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/places/my-added")
def get_my_added_places():
    """Get places added by the current user. Requires authentication."""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Not authenticated", "message": "Please login first"}), 401
        
        with get_conn() as conn, conn.cursor() as cur:
            # Get places created by this user
            cur.execute("""
                SELECT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon, 
                       pwt.place_type, p.created_at, p.updated_at
                FROM places p
                LEFT JOIN places_with_types pwt ON p.id = pwt.id
                WHERE p.created_by = %s
                ORDER BY p.created_at DESC
            """, (user_id,))
            
            rows = cur.fetchall()
            places = []
            for row in rows:
                places.append({
                    "id": row[0],
                    "name": row[1],
                    "city": row[2],
                    "state": row[3],
                    "country": row[4],
                    "lat": float(row[5]) if row[5] else None,
                    "lon": float(row[6]) if row[6] else None,
                    "place_type": row[7] if row[7] else "unknown",
                    "created_at": row[8].isoformat() if row[8] else None,
                    "updated_at": row[9].isoformat() if row[9] else None
                })
            
            # Get count
            cur.execute("SELECT COUNT(*) FROM places WHERE created_by = %s", (user_id,))
            count = cur.fetchone()[0]
            
            return jsonify({
                "success": True,
                "places": places,
                "count": count
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting my added places: {e}")
        return jsonify({"error": "Failed to get places", "details": str(e)}), 500

@app.put("/api/places/<int:place_id>")
def update_place(place_id):
    """Update a place. Admin can edit any, curator can edit own places."""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Not authenticated", "message": "Please login first"}), 401
        
        role = get_user_role_from_request()
        
        # Check permissions: admin can edit any, curator/user can only edit their own
        if role not in ['admin_user', 'curator_user', 'app_user']:
            return jsonify({
                "error": "Permission denied",
                "message": "You don't have permission to edit places"
            }), 403
        
        # Check if user owns the place (for non-admin users)
        if role != 'admin_user':
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute("SELECT created_by FROM places WHERE id = %s", (place_id,))
                result = cur.fetchone()
                if not result:
                    return jsonify({"error": "Place not found"}), 404
                
                place_creator = result[0]
                if place_creator != user_id:
                    return jsonify({
                        "error": "Permission denied",
                        "message": "You can only edit places you created"
                    }), 403
        
        # Get update data
        data = request.get_json()
        
        # Update place (only certain fields allowed)
        updates = []
        params = []
        
        if 'name' in data and data['name']:
            updates.append("name = %s")
            params.append(data['name'])
        
        if 'city' in data:
            updates.append("city = %s")
            params.append(data.get('city', ''))
        
        if 'state' in data:
            updates.append("state = %s")
            params.append(data.get('state', ''))
        
        if 'country' in data:
            updates.append("country = %s")
            params.append(data.get('country', 'US'))
        
        if 'lat' in data and 'lon' in data:
            try:
                lat = float(data['lat'])
                lon = float(data['lon'])
                validate_coordinates(lat, lon)
                updates.append("lat = %s")
                updates.append("lon = %s")
                updates.append("geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)")
                params.extend([lat, lon, lon, lat])
            except (ValueError, TypeError) as e:
                return jsonify({"error": f"Invalid coordinates: {str(e)}"}), 400
        
        if not updates:
            return jsonify({"error": "No valid fields to update"}), 400
        
        # Add updated_at
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(place_id)
        
        with get_conn() as conn, conn.cursor() as cur:
            sql = f"UPDATE places SET {', '.join(updates)} WHERE id = %s RETURNING id, name, city, state, country, lat, lon, updated_at"
            cur.execute(sql, params)
            result = cur.fetchone()
            
            if not result:
                return jsonify({"error": "Place not found"}), 404
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": "Place updated successfully",
                "place": {
                    "id": result[0],
                    "name": result[1],
                    "city": result[2],
                    "state": result[3],
                    "country": result[4],
                    "lat": float(result[5]) if result[5] else None,
                    "lon": float(result[6]) if result[6] else None,
                    "updated_at": result[7].isoformat() if result[7] else None
                }
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error updating place: {e}")
        return jsonify({"error": "Failed to update place", "details": str(e)}), 500

@app.delete("/api/places/<int:place_id>")
def delete_place(place_id):
    """Delete a place. Admin can delete any, curator can delete own places."""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Not authenticated", "message": "Please login first"}), 401
        
        role = get_user_role_from_request()
        
        # Only admin and curator can delete
        if role not in ['admin_user', 'curator_user']:
            return jsonify({
                "error": "Permission denied",
                "message": "Only admin and curator users can delete places"
            }), 403
        
        # Check if user owns the place (for curator)
        if role == 'curator_user':
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute("SELECT created_by FROM places WHERE id = %s", (place_id,))
                result = cur.fetchone()
                if not result:
                    return jsonify({"error": "Place not found"}), 404
                
                place_creator = result[0]
                if place_creator != user_id:
                    return jsonify({
                        "error": "Permission denied",
                        "message": "You can only delete places you created"
                    }), 403
        
        # Delete place (CASCADE will handle type-specific tables)
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM places WHERE id = %s RETURNING id, name", (place_id,))
            result = cur.fetchone()
            
            if not result:
                return jsonify({"error": "Place not found"}), 404
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": f"Place '{result[1]}' deleted successfully"
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error deleting place: {e}")
        return jsonify({"error": "Failed to delete place", "details": str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# Import extension endpoints (after app is created)
try:
    from app_extensions import *
except ImportError:
    pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "localhost")  # Use localhost instead of 127.0.0.1 for cookie compatibility
    app.run(host=host, port=port, debug=True)
