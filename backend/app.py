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
import logging
import sys
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from marshmallow import ValidationError
from dotenv import load_dotenv
import psycopg
from psycopg_pool import ConnectionPool
from token_storage import get_token_storage
from cache import cached, invalidate_cache
from schemas import (
    RadiusSearchSchema,
    NearestSearchSchema,
    BoundingBoxSchema,
    AddPlaceSchema,
    LoginSchema,
    AnalyticsDensitySchema,
    DistanceMatrixSchema,
    ExportSchema
)

# CRITICAL FIX: Structured logging for production monitoring
try:
    from pythonjsonlogger import jsonlogger
    JSON_LOGGING_AVAILABLE = True
except ImportError:
    JSON_LOGGING_AVAILABLE = False
    print("⚠️  python-json-logger not installed. Using basic logging.")

# CRITICAL FIX: Error tracking with Sentry (only in production)
try:
    import sentry_sdk
    from sentry_sdk.integrations.flask import FlaskIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
    print("⚠️  sentry-sdk not installed. Error tracking disabled.")

load_dotenv()
BASE_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/geoapp")

app = Flask(__name__)
# CRITICAL SECURITY FIX: Secret key must be set in production
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

# Validate secret key in production
if os.getenv("ENVIRONMENT") == "production":
    if not app.secret_key or app.secret_key == "dev-secret-key-change-in-production":
        raise ValueError(
            "CRITICAL: SECRET_KEY must be set in .env file and must not be the default value. "
            "Generate a random 32+ character string. "
            "Run: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
        )

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
# Note: We handle OPTIONS manually in before_request, but Flask-CORS provides fallback
CORS(app, 
     supports_credentials=True,
     origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],
     allow_headers=["Content-Type", "Authorization", "X-User-Role", "X-Auth-Token"],  # Allow token headers
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type"],
     resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"]}},
     automatic_options=False)  # Disable automatic OPTIONS handling - we handle it manually

# CRITICAL SECURITY FIX: Rate limiting to prevent DDoS and brute force attacks
# Uses Redis if available, falls back to in-memory (dev only)
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Test Redis connection first
try:
    import redis
    test_redis = redis.from_url(redis_url)
    test_redis.ping()  # Test connection
    test_redis.close()
    redis_available = True
except Exception as e:
    app.logger.warning(f"⚠️  Redis not available: {e}")
    app.logger.warning("⚠️  Using in-memory rate limiting (NOT for production!)")
    redis_available = False

if redis_available:
    try:
        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            default_limits=["200 per day", "50 per hour"],
            storage_uri=redis_url,
            strategy="fixed-window",
            swallow_errors=True  # Don't crash if Redis fails during request
        )
        app.logger.info("✅ Rate limiting initialized with Redis")
    except Exception as e:
        app.logger.warning(f"⚠️  Failed to initialize Redis rate limiting: {e}")
        app.logger.warning("⚠️  Falling back to in-memory rate limiting")
        redis_available = False

if not redis_available:
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",  # In-memory fallback
        swallow_errors=True
    )

# CRITICAL FIX: Configure structured logging for production monitoring
if JSON_LOGGING_AVAILABLE:
    # Use JSON logging for structured output (easier to parse in production)
    log_handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    log_handler.setFormatter(formatter)
    app.logger.addHandler(log_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info("Structured logging initialized", extra={
        "component": "logging",
        "format": "json"
    })
else:
    # Fallback to basic logging
    app.logger.setLevel(logging.INFO)
    app.logger.warning("Using basic logging (install python-json-logger for structured logs)")

# CRITICAL FIX: Initialize Sentry error tracking (only in production)
if SENTRY_AVAILABLE and os.getenv("ENVIRONMENT") == "production":
    sentry_dsn = os.getenv("SENTRY_DSN")
    if sentry_dsn:
        try:
            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[FlaskIntegration()],
                traces_sample_rate=0.1,  # Sample 10% of transactions for performance monitoring
                environment=os.getenv("ENVIRONMENT", "production"),
                # Set release version if available
                release=os.getenv("APP_VERSION", None),
                # Don't send sensitive data
                send_default_pii=False,
                # Ignore common non-critical errors
                ignore_errors=[KeyboardInterrupt]
            )
            app.logger.info("✅ Sentry error tracking initialized", extra={
                "component": "error_tracking",
                "service": "sentry"
            })
        except Exception as e:
            app.logger.error(f"Failed to initialize Sentry: {e}")
    else:
        app.logger.warning("SENTRY_DSN not set - error tracking disabled")
elif not SENTRY_AVAILABLE:
    app.logger.info("Sentry not available (install sentry-sdk for error tracking)")

# Add request context to all logs
@app.before_request
def handle_options_request():
    """Handle OPTIONS requests globally before any other processing."""
    if request.method == 'OPTIONS':
        try:
            # Create response with proper CORS headers
            response = jsonify({})
            origin = request.headers.get('Origin', 'http://localhost:3000')
            # Only allow known origins
            allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"]
            if origin in allowed_origins:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token, X-User-Role')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.headers.add('Access-Control-Max-Age', '3600')
            return response
        except Exception as e:
            # If anything fails, return a simple response
            app.logger.error(f"Error in OPTIONS handler: {e}", exc_info=True)
            from flask import Response
            resp = Response(status=200)
            resp.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            resp.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            resp.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
            resp.headers.add('Access-Control-Allow-Credentials', 'true')
            return resp

@app.before_request
def log_request_info():
    """Add request context to logs."""
    # Skip logging for OPTIONS requests (already handled above)
    if request.method == 'OPTIONS':
        return
    
    if JSON_LOGGING_AVAILABLE:
        app.logger.info("Request received", extra={
            "method": request.method,
            "path": request.path,
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", "Unknown")[:100]  # Limit length
        })

# Define role-based database connection strings
# CRITICAL SECURITY FIX: Passwords now come from environment variables
# Never hardcode passwords in source code!
DB_ROLES = {
    "readonly_user": {
        "username": "readonly_user",
        "password": os.getenv("READONLY_USER_PASSWORD", ""),  # From .env file
        "permissions": ["SELECT"]
    },
    "app_user": {
        "username": "app_user",
        "password": os.getenv("APP_USER_PASSWORD", ""),  # From .env file
        "permissions": ["SELECT", "INSERT", "UPDATE"]
    },
    "curator_user": {
        "username": "curator_user",
        "password": os.getenv("CURATOR_USER_PASSWORD", ""),  # From .env file
        "permissions": ["SELECT", "INSERT", "UPDATE", "ANALYTICS"]
    },
    "analyst_user": {
        "username": "analyst_user",
        "password": os.getenv("ANALYST_USER_PASSWORD", ""),  # From .env file
        "permissions": ["SELECT", "ANALYTICS"]
    },
    "admin_user": {
        "username": "admin_user",
        "password": os.getenv("ADMIN_USER_PASSWORD", ""),  # From .env file
        "permissions": ["ALL"]
    }
}

# Validate that passwords are set (only in production)
# In development, we allow empty passwords for local testing
if os.getenv("ENVIRONMENT") == "production":
    for role_name, role_info in DB_ROLES.items():
        if not role_info["password"]:
            raise ValueError(
                f"CRITICAL: Missing password for role '{role_name}'. "
                f"Set {role_name.upper()}_PASSWORD in .env file. "
                f"Never deploy without passwords set!"
            )

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

# CRITICAL FIX: Using Redis for token storage (scalable, persistent)
# Falls back to in-memory only if Redis unavailable (dev only, NOT for production)

def generate_token(username, user_id=None):
    """Generate a token and store in Redis (or in-memory fallback for dev)."""
    secret = app.secret_key
    timestamp = str(time.time())
    token_string = f"{username}:{timestamp}:{secret}"
    token = hashlib.sha256(token_string.encode()).hexdigest()
    
    # Store in Redis (or fallback)
    storage = get_token_storage()
    storage.store_token(token, username, user_id)
    
    return token

def get_user_id_from_request():
    """Get user_id from token (for personal lists)."""
    token = request.headers.get('X-Auth-Token') or (request.headers.get('Authorization', '').replace('Bearer ', '').strip())
    if not token:
        return None
    
    storage = get_token_storage()
    token_data = storage.get_token_data(token)
    return token_data.get("user_id") if token_data else None

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
    """Validate token from Redis (or in-memory fallback) and return user role if valid."""
    if not token:
        app.logger.warning(f"validate_token: No token provided")
        return None
    
    storage = get_token_storage()
    token_data = storage.get_token_data(token)
    
    if not token_data:
        app.logger.warning(f"validate_token: Token not found or expired")
        return None
    
    app.logger.info(f"validate_token: Token valid, role: {token_data.get('user_role')}")
    return token_data.get("user_role")

def get_user_role_from_request():
    """Get user role from either session, token, or header."""
    # Handle case where we're outside request context (e.g., during testing)
    from flask import has_request_context
    if not has_request_context():
        return None
    
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

# CRITICAL FIX: Connection pooling for better performance and scalability
# Instead of creating new connection per request, reuse connections from pool
_pools = {}  # Cache of connection pools by database URL

class PooledConnection:
    """Wrapper to automatically return connection to pool when used as context manager."""
    def __init__(self, conn, pool):
        self.conn = conn
        self.pool = pool
    
    def __enter__(self):
        return self.conn
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Return connection to pool
        self.pool.putconn(self.conn)
        return False  # Don't suppress exceptions
    
    def __getattr__(self, name):
        # Delegate all other attributes to the connection
        return getattr(self.conn, name)

def get_pool(db_url):
    """Get or create connection pool for a database URL."""
    if db_url not in _pools:
        pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        
        try:
            pool = ConnectionPool(
                db_url,
                min_size=2,
                max_size=pool_size,
                max_waiting=10,
                max_idle=300,  # 5 minutes
                reconnect_timeout=60,
                open=False  # Don't open immediately
            )
            pool.open()
            _pools[db_url] = pool
            app.logger.info(f"✅ Created connection pool (size: {pool_size})")
        except Exception as e:
            app.logger.error(f"Failed to create connection pool: {e}")
            raise
    
    return _pools[db_url]

def get_conn():
    """Get database connection from pool. Uses role-based connection if user is logged in.
    
    Returns a PooledConnection that automatically returns to pool when used as context manager.
    """
    try:
        user_role = get_user_role_from_request()
        if user_role:
            role_db_url = get_database_url_for_role(user_role)
            pool = get_pool(role_db_url)
        else:
            pool = get_pool(BASE_DATABASE_URL)
        
        # Get connection from pool and wrap it
        conn = pool.getconn()
        return PooledConnection(conn, pool)
    except psycopg.OperationalError as e:
        app.logger.error(f"Database connection error: {e}")
        raise
    except Exception as e:
        app.logger.error(f"Connection pool error: {e}")
        # Fallback to direct connection if pool fails
        app.logger.warning("Falling back to direct connection (pool unavailable)")
        try:
            user_role = get_user_role_from_request()
            if user_role:
                role_db_url = get_database_url_for_role(user_role)
                return psycopg.connect(role_db_url)
            else:
                return psycopg.connect(BASE_DATABASE_URL)
        except Exception as fallback_error:
            app.logger.error(f"Fallback connection also failed: {fallback_error}")
            raise

def get_admin_conn():
    """Get database connection with admin privileges from pool.
    
    Tries admin_user first, falls back to BASE_DATABASE_URL if admin_user
    doesn't exist or authentication fails (for local development).
    """
    try:
        # Try admin_user role first (if configured)
        if "admin_user" in DB_ROLES and DB_ROLES["admin_user"].get("password"):
            try:
                role_db_url = get_database_url_for_role("admin_user")
                # Test connection first before getting from pool
                test_conn = psycopg.connect(role_db_url)
                test_conn.close()
                # If test succeeds, use the pool
                pool = get_pool(role_db_url)
                conn = pool.getconn()
                return PooledConnection(conn, pool)
            except (psycopg.OperationalError, psycopg.Error) as e:
                app.logger.warning(f"⚠️  Admin user connection failed: {e}")
                app.logger.warning("⚠️  Falling back to base database connection")
                # Fall through to base connection
        else:
            app.logger.info("ℹ️  Admin user not configured, using base connection")
        
        # Fallback to base URL (postgres user) - works for local development
        pool = get_pool(BASE_DATABASE_URL)
        conn = pool.getconn()
        return PooledConnection(conn, pool)
    except Exception as e:
        app.logger.error(f"Admin connection pool error: {e}")
        # Fallback to direct connection
        app.logger.warning("Falling back to direct admin connection")
        try:
            if "admin_user" in DB_ROLES and DB_ROLES["admin_user"].get("password"):
                role_db_url = get_database_url_for_role("admin_user")
                return psycopg.connect(role_db_url)
        except Exception:
            pass  # Fall through to base connection
        
        # Always fallback to base connection
        return psycopg.connect(BASE_DATABASE_URL)

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
@limiter.limit("30 per minute")  # Prevent DDoS on search endpoints
def within_radius():
    """Find all places within a radius of a point."""
    # CRITICAL FIX: Validate input using schema
    schema = RadiusSearchSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    # Extract validated data
    lat = data["lat"]
    lon = data["lon"]
    km = data["km"]
    state_filter = data.get("state")
    name_filter = data.get("name")
    place_type_filter = data.get("place_type")
    place_types = None
    if place_type_filter:
        place_types = [t.strip() for t in place_type_filter.split(",") if t.strip()]
    
    # When a state is selected, use a minimum radius of 500km to ensure we get results
    # Large states like Texas, California need a larger radius to cover the state
    if state_filter and km < 500:
        km = 500
        app.logger.info(f"State filter active: expanded radius to {km}km to ensure state-wide results")
    
    # Use places_with_types view and join with type-specific tables to get ratings and additional info
    sql = """
    SELECT 
        p.id, p.name, p.city, p.state, p.country, p.lat, p.lon, p.place_type,
        COALESCE(r.rating, tp.rating, h.rating) as rating,
        COALESCE(r.phone, tp.phone, h.phone, b.phone) as phone,
        COALESCE(r.website, tp.website, h.website, b.website) as website,
        r.cuisine_type, r.price_range,
        r.hours_of_operation,
        r.dietary_options,
        r.outdoor_seating,
        r.delivery,
        r.takeout,
        r.reservations,
        tp.entry_fee, tp.description,
        tp.place_type as tourist_type,
        tp.family_friendly,
        tp.accessibility,
        tp.pet_friendly,
        tp.guided_tours,
        tp.hours_of_operation as tourist_hours,
        h.star_rating, h.price_per_night,
        b.brewery_type,
        COALESCE(r.street, tp.street, h.street, b.street) as street,
        COALESCE(r.postal_code, tp.postal_code, h.postal_code, b.postal_code) as postal_code
    FROM places_with_types p
    LEFT JOIN restaurants r ON p.id = r.place_id AND p.place_type = 'restaurant'
    LEFT JOIN tourist_places tp ON p.id = tp.place_id AND p.place_type = 'tourist_place'
    LEFT JOIN hotels h ON p.id = h.place_id AND p.place_type = 'hotel'
    LEFT JOIN breweries b ON p.id = b.place_id AND p.place_type = 'brewery'
    WHERE ST_DWithin(
        p.geom::geography,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
        %s * 1000
    )
    """
    params = [lon, lat, km]
    
    # Filter by place type(s)
    if place_types:
        sql += " AND p.place_type = ANY(%s)"
        params.append(place_types)
    
    if state_filter:
        # When state is specified, prioritize state filter over radius constraint
        # This ensures users get results when searching within a state
        # Handle both full state names and abbreviations (e.g., "Texas" or "TX")
        state_lower = state_filter.lower().strip()
        # Common state name to abbreviation mapping
        state_to_abbrev = {
            "texas": "TX", "california": "CA", "new york": "NY", "florida": "FL",
            "illinois": "IL", "pennsylvania": "PA", "ohio": "OH", "georgia": "GA",
            "north carolina": "NC", "michigan": "MI", "new jersey": "NJ",
            "virginia": "VA", "washington": "WA", "arizona": "AZ", "massachusetts": "MA",
            "tennessee": "TN", "indiana": "IN", "missouri": "MO", "maryland": "MD",
            "wisconsin": "WI", "colorado": "CO", "minnesota": "MN", "south carolina": "SC",
            "alabama": "AL", "louisiana": "LA", "kentucky": "KY", "oregon": "OR",
            "oklahoma": "OK", "connecticut": "CT", "utah": "UT", "iowa": "IA",
            "nevada": "NV", "arkansas": "AR", "mississippi": "MS", "kansas": "KS",
            "new mexico": "NM", "nebraska": "NE", "west virginia": "WV", "idaho": "ID",
            "hawaii": "HI", "new hampshire": "NH", "maine": "ME", "montana": "MT",
            "rhode island": "RI", "delaware": "DE", "south dakota": "SD", "north dakota": "ND",
            "alaska": "AK", "vermont": "VT", "wyoming": "WY", "district of columbia": "DC"
        }
        abbrev = state_to_abbrev.get(state_lower)
        if abbrev:
            sql += " AND (p.state ILIKE %s OR p.state ILIKE %s)"
            params.append(f"%{state_filter}%")
            params.append(f"%{abbrev}%")
        elif len(state_filter) == 2:
            # If it's already a 2-letter code, search for it as-is
            sql += " AND (p.state ILIKE %s OR p.state ILIKE %s)"
            params.append(f"%{state_filter}%")
            params.append(f"%{state_filter.upper()}%")
        else:
            # Fallback: try first 2 letters as abbreviation
            sql += " AND (p.state ILIKE %s OR p.state ILIKE %s)"
            params.append(f"%{state_filter}%")
            params.append(f"%{state_filter[:2].upper()}%")
    
    if name_filter:
        sql += " AND p.name ILIKE %s"
        params.append(f"%{name_filter}%")
    
    sql += " ORDER BY ST_Distance(p.geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) LIMIT 2000;"
    params.extend([lon, lat])

    try:
        user_id = get_user_id_from_request()
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            features = []
            for r in rows:
                # Generate a simple description if none exists
                # Note: description is at index 20, tourist_type is at index 21
                description = r[20] if len(r) > 20 and r[20] else None
                place_type = r[7] if len(r) > 7 else "unknown"
                
                if not description or (isinstance(description, str) and not description.strip()):
                    # Create a basic description based on place type
                    if place_type == 'brewery':
                        brewery_type = r[23] if len(r) > 23 and r[23] else 'brewery'
                        brewery_type_display = brewery_type.replace('_', ' ').title() if brewery_type else 'Brewery'
                        description = f"{brewery_type_display} located in {r[2]}, {r[3]}"
                    elif place_type == 'restaurant':
                        cuisine = r[11] if len(r) > 11 and r[11] else 'restaurant'
                        cuisine_display = cuisine.replace('_', ' ').title() if cuisine else 'Restaurant'
                        description = f"{cuisine_display} restaurant in {r[2]}, {r[3]}"
                    elif place_type == 'tourist_place':
                        description = f"Tourist attraction in {r[2]}, {r[3]}"
                    elif place_type == 'hotel':
                        stars = r[21] if len(r) > 21 and r[21] else None
                        star_text = f"{stars}-star " if stars else ""
                        description = f"{star_text}Hotel in {r[2]}, {r[3]}"
                    else:
                        description = f"Place in {r[2]}, {r[3]}"
                
                # Handle rating - filter out 0 or negative values
                rating = r[8] if len(r) > 8 else None
                rating_value = None
                if rating is not None:
                    try:
                        rating_float = float(rating)
                        if rating_float > 0:
                            rating_value = rating_float
                    except (ValueError, TypeError):
                        pass
                
                # Generate mock rating and review count for demonstration if no rating exists
                # This is acceptable for demo/educational purposes since OpenStreetMap doesn't provide ratings
                review_count = None
                if rating_value is None and place_type in ['restaurant', 'tourist_place', 'hotel']:
                    # Generate a consistent mock rating based on place ID (so it's stable across searches)
                    # Range: 3.5 to 4.8 (realistic restaurant rating range)
                    import hashlib
                    place_id_str = str(r[0])
                    hash_value = int(hashlib.md5(place_id_str.encode()).hexdigest()[:8], 16)
                    mock_rating = 3.5 + (hash_value % 130) / 100.0  # 3.5 to 4.8
                    rating_value = round(mock_rating, 1)
                    # Generate mock review count (consistent based on place ID)
                    # Range: 50 to 2000 reviews (realistic range)
                    review_count = 50 + (hash_value % 1950)  # 50 to 2000
                elif rating_value is not None:
                    # If we have a real rating, generate a review count too
                    import hashlib
                    place_id_str = str(r[0])
                    hash_value = int(hashlib.md5(place_id_str.encode()).hexdigest()[:8], 16)
                    review_count = 50 + (hash_value % 1950)  # 50 to 2000
                
                # Extract restaurant-specific fields
                hours_of_operation = r[13] if len(r) > 13 else None
                dietary_options = r[14] if len(r) > 14 else None
                outdoor_seating = r[15] if len(r) > 15 else None
                delivery = r[16] if len(r) > 16 else None
                takeout = r[17] if len(r) > 17 else None
                reservations = r[18] if len(r) > 18 else None
                
                features.append({
                    "id": r[0],
                    "name": r[1],
                    "city": r[2],
                    "state": r[3],
                    "country": r[4],
                    "lat": r[5],
                    "lon": r[6],
                    "place_type": place_type,
                    "rating": rating_value,
                    "review_count": review_count,
                    "phone": r[9] if len(r) > 9 else None,
                    "website": r[10] if len(r) > 10 else None,
                    "cuisine_type": r[11] if len(r) > 11 else None,
                    "price_range": r[12] if len(r) > 12 else None,
                    "hours_of_operation": hours_of_operation,
                    "dietary_options": dietary_options if isinstance(dietary_options, list) else (dietary_options if dietary_options else []),
                    "outdoor_seating": outdoor_seating if outdoor_seating is not None else False,
                    "delivery": delivery if delivery is not None else False,
                    "takeout": takeout if takeout is not None else False,
                    "reservations": reservations if reservations is not None else False,
                    "entry_fee": float(r[19]) if len(r) > 19 and r[19] is not None else None,
                    "tourist_type": r[21] if len(r) > 21 else None,
                    "family_friendly": bool(r[22]) if len(r) > 22 and r[22] is not None else False,
                    "accessibility": bool(r[23]) if len(r) > 23 and r[23] is not None else False,
                    "pet_friendly": bool(r[24]) if len(r) > 24 and r[24] is not None else False,
                    "guided_tours": bool(r[25]) if len(r) > 25 and r[25] is not None else False,
                    "tourist_hours": r[26] if len(r) > 26 else None,
                    "description": description,  # description is at index 20
                    "star_rating": r[27] if len(r) > 27 else None,
                    "price_per_night": float(r[28]) if len(r) > 28 and r[28] is not None else None,
                    "brewery_type": r[29] if len(r) > 29 else None,
                    "street": r[30] if len(r) > 30 else None,
                    "postal_code": r[31] if len(r) > 31 else None,
                })
            
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
@limiter.limit("30 per minute")  # Prevent DDoS on search endpoints
def within_bbox():
    """Find all places within a bounding box."""
    # CRITICAL FIX: Validate input using schema
    schema = BoundingBoxSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    # Extract validated data (already validated by schema, including bbox logic)
    north = data["north"]
    south = data["south"]
    east = data["east"]
    west = data["west"]
    state_filter = data.get("state")
    name_filter = data.get("name")
    place_type_filter = data.get("place_type")
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
@limiter.limit("30 per minute")  # Prevent DDoS on search endpoints
def nearest():
    """Find K nearest places to a point using PostGIS KNN."""
    # CRITICAL FIX: Validate input using schema
    schema = NearestSearchSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    # Extract validated data (already validated by schema)
    lat = data["lat"]
    lon = data["lon"]
    k = data["k"]
    state_filter = data.get("state")
    name_filter = data.get("name")
    place_type_filter = data.get("place_type")
    
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
@cached(ttl=300, key_prefix="stats")  # Cache for 5 minutes
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
@limiter.limit("10 per hour")  # Limit exports (heavy operation)
def export_csv():
    """Export places data as CSV."""
    # CRITICAL FIX: Validate input using schema
    schema = ExportSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    state_filter = data.get("state")
    name_filter = data.get("name")
    limit = data.get("limit", 10000)
    
    try:
        
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
@limiter.limit("10 per hour")  # Limit exports (heavy operation)
def export_geojson():
    """Export places data as GeoJSON."""
    # CRITICAL FIX: Validate input using schema
    schema = ExportSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    state_filter = data.get("state")
    name_filter = data.get("name")
    limit = data.get("limit", 10000)
    
    try:
        
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
        
        sql += f" ORDER BY id LIMIT {limit};"
        
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
@cached(ttl=600, key_prefix="analytics")  # Cache for 10 minutes
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
@limiter.limit("10 per minute")  # Limit expensive calculations
def distance_matrix():
    """Calculate distance matrix between multiple points."""
    # CRITICAL FIX: Validate input using schema
    schema = DistanceMatrixSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    points = data["points"]
    
    try:
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
@cached(ttl=300, key_prefix="analytics")  # Cache for 5 minutes
def analytics_density():
    """Get spatial density analysis."""
    # CRITICAL FIX: Validate input using schema
    schema = AnalyticsDensitySchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    # Extract validated data
    lat = data["lat"]
    lon = data["lon"]
    radius = data["radius"]
    
    try:
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

@app.route("/auth/login", methods=['POST', 'OPTIONS'])
@limiter.limit("5 per minute")  # Prevent brute force attacks
def login():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    """Login endpoint with role-based authentication."""
    # CRITICAL FIX: Validate input using schema
    schema = LoginSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({
            "error": "Invalid input",
            "details": err.messages
        }), 400
    
    username = data["username"]
    password = data["password"]
    
    if username not in DB_ROLES:
        return jsonify({"error": "Invalid username or password"}), 401
    
    role_info = DB_ROLES[username]
    
    if password != role_info["password"]:
        return jsonify({"error": "Invalid username or password"}), 401
    
    # Test database connection (use base connection if role-based fails)
    try:
        role_db_url = get_database_url_for_role(username)
        test_conn = psycopg.connect(role_db_url)
        test_conn.close()
    except Exception as e:
        # Fallback: Try base connection (for development when role users don't exist)
        app.logger.warning(f"Role-based connection failed for {username}, trying base connection: {e}")
        try:
            test_conn = psycopg.connect(BASE_DATABASE_URL)
            test_conn.close()
            app.logger.info(f"Using base database connection for {username} (role users not configured)")
        except Exception as base_error:
            return jsonify({"error": f"Database connection failed: {str(base_error)}"}), 500
    
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

@app.route("/auth/logout", methods=['POST', 'OPTIONS'])
def logout():
    """Logout endpoint."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.route("/auth/check", methods=['GET', 'OPTIONS'])
def check_auth():
    """Check current authentication status."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
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

@app.route("/auth/roles", methods=['GET', 'OPTIONS'])
def list_roles():
    """List available roles and their permissions (for demo purposes)."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
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
@limiter.limit("10 per hour")  # Limit location additions
def add_place():
    """Add a new place to the database. Requires INSERT permission (admin_user or app_user)."""
    try:
        # Check authentication using token or session
        role = get_user_role_from_request()
        
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
        
        # CRITICAL FIX: Validate input using schema
        schema = AddPlaceSchema()
        try:
            data = schema.load(request.get_json() or {})
        except ValidationError as err:
            return jsonify({
                "error": "Invalid input",
                "details": err.messages
            }), 400
        
        # Extract validated data
        name = data["name"]
        city = data.get("city", "")
        state = data.get("state", "")
        country = data.get("country", "US")
        lat = data["lat"]
        lon = data["lon"]
        place_type = data.get("place_type", "brewery")
        type_specific_data = data.get("type_data", {})
        
        # Coordinates already validated by schema, but double-check
        try:
            validate_coordinates(lat, lon)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        
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
                    
                    # CRITICAL FIX: Invalidate cache when data changes
                    invalidate_cache("stats")
                    invalidate_cache("analytics")
                    
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
@limiter.limit("5 per hour")  # Limit CSV uploads (heavy operation)
def upload_csv():
    """Bulk upload places from CSV file. Admin only."""
    try:
        # Get user role using unified authentication method
        user_role = get_user_role_from_request()
        
        # Fallback: Check FormData field (for file uploads)
        if not user_role:
            user_role_field = request.form.get('user_role')
            if user_role_field and user_role_field in DB_ROLES:
                user_role = user_role_field
        
        # Check authentication
        if not user_role:
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
    except Exception as e:
        app.logger.error(f"Error in upload_csv endpoint: {e}")
        return jsonify({
            "error": "Failed to process request",
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
@limiter.limit("5 per minute")  # Prevent brute force on user login
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

@app.route("/api/groups", methods=['POST', 'OPTIONS'])
def create_group():
    """Create a new group."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
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

@app.route("/api/groups", methods=['GET', 'OPTIONS'])
def get_user_groups():
    """Get all groups the current user belongs to."""
    if request.method == 'OPTIONS':
        # CORS preflight - Flask-CORS should handle this, but explicit handling for safety
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
    user_id = get_user_id_from_request()
    if not user_id:
        app.logger.warning(f"Groups request without authentication. Headers: {dict(request.headers)}")
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
            
            app.logger.info(f"Successfully retrieved {len(groups)} groups for user {user_id}")
            return jsonify({"success": True, "groups": groups}), 200
            
    except Exception as e:
        app.logger.error(f"Error getting groups for user {user_id}: {e}", exc_info=True)
        import traceback
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to get groups", "details": str(e)}), 500

@app.route("/api/groups/<int:group_id>", methods=['GET', 'OPTIONS'])
def get_group_details(group_id):
    """Get group details including members."""
    if request.method == 'OPTIONS':
        # CORS preflight - Flask-CORS should handle this, but explicit handling for safety
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
    user_id = get_user_id_from_request()
    if not user_id:
        app.logger.warning(f"Group details request without authentication for group {group_id}. Headers: {dict(request.headers)}")
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
                app.logger.warning(f"User {user_id} attempted to access group {group_id} but is not a member")
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
                app.logger.warning(f"Group {group_id} not found")
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
            
            app.logger.info(f"Successfully retrieved details for group {group_id} with {len(members)} members")
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
        app.logger.error(f"Error getting group details for group {group_id}: {e}", exc_info=True)
        import traceback
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to get group details", "details": str(e)}), 500

@app.route("/api/groups/<int:group_id>/members", methods=['POST', 'OPTIONS'])
def add_group_member(group_id):
    """Add a member to a group by username or email."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        identifier = data.get("username", "").strip() or data.get("email", "").strip()
        
        if not identifier:
            return jsonify({"error": "Username or email is required"}), 400
        
        with get_conn() as conn, conn.cursor() as cur:
            # Check if current user is admin
            cur.execute("""
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            membership = cur.fetchone()
            
            if not membership or membership[0] != 'admin':
                return jsonify({"error": "Only group admins can add members"}), 403
            
            # Find user by username or email
            cur.execute("""
                SELECT user_id, username, email FROM users 
                WHERE username = %s OR email = %s
            """, (identifier, identifier))
            new_member = cur.fetchone()
            
            if not new_member:
                return jsonify({"error": f"User not found with username/email: {identifier}"}), 404
            
            new_member_id, member_username, member_email = new_member
            
            # Check if already a member
            cur.execute("""
                SELECT user_id FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, new_member_id))
            
            if cur.fetchone():
                return jsonify({"error": f"User {member_username} is already a member"}), 400
            
            # Add member
            cur.execute("""
                INSERT INTO group_members (group_id, user_id, role)
                VALUES (%s, %s, 'member')
            """, (group_id, new_member_id))
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": f"User {member_username} added to group",
                "member": {
                    "user_id": new_member_id,
                    "username": member_username,
                    "email": member_email
                }
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error adding group member: {e}")
        return jsonify({"error": "Failed to add member", "details": str(e)}), 500

@app.route("/api/groups/<int:group_id>/members/<int:member_id>", methods=['DELETE', 'OPTIONS'])
def remove_group_member(group_id, member_id):
    """Remove a member from a group."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
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

@app.route("/api/groups/<int:group_id>/places", methods=['GET', 'OPTIONS'])
def get_group_places(group_id):
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
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
            
            # First, get all group member user IDs for debugging
            cur.execute("""
                SELECT gm.user_id, u.username FROM group_members gm
                JOIN users u ON gm.user_id = u.user_id
                WHERE gm.group_id = %s
            """, (group_id,))
            group_members_list = cur.fetchall()
            member_ids = [row[0] for row in group_members_list]
            app.logger.info(f"Group {group_id} has {len(member_ids)} members: {[row[1] for row in group_members_list]}")
            
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
            app.logger.info(f"Found {len(places_data)} places in group {group_id} from member lists")
            
            for member_id, member_username in group_members_list:
                cur.execute("""
                    SELECT COUNT(*) FROM user_visited_places WHERE user_id = %s
                    UNION ALL
                    SELECT COUNT(*) FROM user_wishlist WHERE user_id = %s
                    UNION ALL
                    SELECT COUNT(*) FROM user_liked_places WHERE user_id = %s
                """, (member_id, member_id, member_id))
                counts = cur.fetchall()
                visited_count = counts[0][0] if len(counts) > 0 else 0
                wishlist_count = counts[1][0] if len(counts) > 1 else 0
                liked_count = counts[2][0] if len(counts) > 2 else 0
                app.logger.info(f"Member {member_username} (ID: {member_id}) has: {visited_count} visited, {wishlist_count} wishlist, {liked_count} liked")
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
# GROUP ROUTES ENDPOINTS
# ============================================================================

@app.route("/api/groups/<int:group_id>/route", methods=['GET', 'OPTIONS'])
def get_group_route(group_id):
    """Get route for a group (user customization if exists, otherwise group default)."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
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
            
            # Try to get user-customized route first
            # Handle case where route tables don't exist yet (return empty route)
            route_id = None
            route_type = None
            user_route = None
            
            try:
                cur.execute("""
                    SELECT route_id FROM user_group_routes
                    WHERE group_id = %s AND user_id = %s
                """, (group_id, user_id))
                user_route = cur.fetchone()
            except Exception as e:
                # Check if it's a table doesn't exist error
                error_msg = str(e).lower()
                if 'does not exist' in error_msg or 'undefined_table' in error_msg or 'relation' in error_msg:
                    # Route tables don't exist yet - return empty route
                    return jsonify({
                        "success": True,
                        "route_id": None,
                        "route_type": None,
                        "places": []
                    }), 200
                # Otherwise, re-raise the error
                raise
            
            if user_route:
                route_id = user_route[0]
                route_type = 'user'
            else:
                # Fall back to group default route
                try:
                    cur.execute("""
                        SELECT route_id FROM group_routes
                        WHERE group_id = %s
                    """, (group_id,))
                    group_route = cur.fetchone()
                except Exception as e:
                    # Check if it's a table doesn't exist error
                    error_msg = str(e).lower()
                    if 'does not exist' in error_msg or 'undefined_table' in error_msg or 'relation' in error_msg:
                        # Route tables don't exist yet - return empty route
                        return jsonify({
                            "success": True,
                            "route_id": None,
                            "route_type": None,
                            "places": []
                        }), 200
                    # Otherwise, re-raise the error
                    raise
                
                if group_route:
                    route_id = group_route[0]
                    route_type = 'group'
            
            if not route_id:
                return jsonify({
                    "success": True,
                    "route_id": None,
                    "route_type": None,
                    "places": []
                }), 200
            
            # Get places in route ordered by order_index
            cur.execute("""
                SELECT rp.route_place_id, rp.place_id, rp.order_index,
                       p.name, p.city, p.state, p.country, p.lat, p.lon,
                       COALESCE(pwt.place_type, 'unknown') as place_type
                FROM route_places rp
                JOIN places p ON rp.place_id = p.id
                LEFT JOIN places_with_types pwt ON p.id = pwt.id
                WHERE rp.route_id = %s AND rp.route_type = %s
                ORDER BY rp.order_index ASC
            """, (route_id, route_type))
            
            places = []
            for row in cur.fetchall():
                places.append({
                    "route_place_id": row[0],
                    "place_id": row[1],
                    "order_index": row[2],
                    "name": row[3],
                    "city": row[4],
                    "state": row[5],
                    "country": row[6],
                    "lat": float(row[7]) if row[7] else None,
                    "lon": float(row[8]) if row[8] else None,
                    "place_type": row[9]
                })
            
            return jsonify({
                "success": True,
                "route_id": route_id,
                "route_type": route_type,
                "places": places
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting route for group {group_id}: {e}")
        return jsonify({"error": "Failed to get route", "details": str(e)}), 500

@app.route("/api/groups/<int:group_id>/route", methods=['POST', 'PUT', 'OPTIONS'])
def save_group_route(group_id):
    """Save route for a group (group default or user customization).
    POST: Save as group default (admin only)
    PUT: Save as user customization
    """
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        places = data.get("places", [])  # Array of {place_id, order_index}
        
        if not isinstance(places, list):
            return jsonify({"error": "places must be an array"}), 400
        
        with get_conn() as conn, conn.cursor() as cur:
            # Check if user is a member
            cur.execute("""
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            membership = cur.fetchone()
            
            if not membership:
                return jsonify({"error": "You are not a member of this group"}), 403
            
            route_type = None
            route_id = None
            
            if request.method == 'POST':
                # Save as group default (admin only)
                if membership[0] != 'admin':
                    return jsonify({"error": "Only group admins can save group default routes"}), 403
                
                route_type = 'group'
                
                # Get or create group route
                cur.execute("""
                    SELECT route_id FROM group_routes
                    WHERE group_id = %s
                """, (group_id,))
                existing = cur.fetchone()
                
                if existing:
                    route_id = existing[0]
                    # Update updated_at
                    cur.execute("""
                        UPDATE group_routes SET updated_at = CURRENT_TIMESTAMP
                        WHERE route_id = %s
                    """, (route_id,))
                else:
                    cur.execute("""
                        INSERT INTO group_routes (group_id, created_by)
                        VALUES (%s, %s)
                        RETURNING route_id
                    """, (group_id, user_id))
                    route_id = cur.fetchone()[0]
            
            elif request.method == 'PUT':
                # Save as user customization
                route_type = 'user'
                
                # Get or create user route
                cur.execute("""
                    SELECT route_id FROM user_group_routes
                    WHERE group_id = %s AND user_id = %s
                """, (group_id, user_id))
                existing = cur.fetchone()
                
                if existing:
                    route_id = existing[0]
                    # Update updated_at
                    cur.execute("""
                        UPDATE user_group_routes SET updated_at = CURRENT_TIMESTAMP
                        WHERE route_id = %s
                    """, (route_id,))
                else:
                    cur.execute("""
                        INSERT INTO user_group_routes (group_id, user_id)
                        VALUES (%s, %s)
                        RETURNING route_id
                    """, (group_id, user_id))
                    route_id = cur.fetchone()[0]
            
            # Delete existing route places
            cur.execute("""
                DELETE FROM route_places
                WHERE route_id = %s AND route_type = %s
            """, (route_id, route_type))
            
            # Insert new route places
            for idx, place_data in enumerate(places):
                place_id = place_data.get("place_id")
                order_index = place_data.get("order_index", idx)
                
                if not place_id:
                    continue
                
                # Verify place exists
                cur.execute("SELECT id FROM places WHERE id = %s", (place_id,))
                if not cur.fetchone():
                    continue
                
                cur.execute("""
                    INSERT INTO route_places (route_id, route_type, place_id, order_index)
                    VALUES (%s, %s, %s, %s)
                """, (route_id, route_type, place_id, order_index))
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "route_id": route_id,
                "route_type": route_type,
                "message": "Route saved successfully"
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error saving route for group {group_id}: {e}")
        return jsonify({"error": "Failed to save route", "details": str(e)}), 500

@app.route("/api/groups/<int:group_id>/route/places/<int:place_id>", methods=['DELETE', 'OPTIONS'])
def remove_route_place(group_id, place_id):
    """Remove a place from the current user's route (user customization only)."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
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
            
            # Get user route (must be user customization, not group default)
            cur.execute("""
                SELECT route_id FROM user_group_routes
                WHERE group_id = %s AND user_id = %s
            """, (group_id, user_id))
            user_route = cur.fetchone()
            
            if not user_route:
                return jsonify({"error": "No user route found"}), 404
            
            route_id = user_route[0]
            
            # Delete the place from route
            cur.execute("""
                DELETE FROM route_places
                WHERE route_id = %s AND route_type = 'user' AND place_id = %s
            """, (route_id, place_id))
            
            # Reorder remaining places
            cur.execute("""
                SELECT route_place_id FROM route_places
                WHERE route_id = %s AND route_type = 'user'
                ORDER BY order_index ASC
            """, (route_id,))
            
            remaining_ids = [row[0] for row in cur.fetchall()]
            
            for idx, rp_id in enumerate(remaining_ids):
                cur.execute("""
                    UPDATE route_places SET order_index = %s
                    WHERE route_place_id = %s
                """, (idx, rp_id))
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": "Place removed from route"
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error removing place from route: {e}")
        return jsonify({"error": "Failed to remove place from route", "details": str(e)}), 500

@app.get("/api/places/<int:place_id>/groups")
def get_place_groups(place_id):
    """Get all groups that include this place (where current user is a member)."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # Get groups where:
            # 1. User is a member
            # 2. Place is in at least one member's list (visited, wishlist, or liked)
            cur.execute("""
                SELECT DISTINCT g.group_id, g.name, g.description, gm.role as your_role
                FROM groups g
                JOIN group_members gm ON g.group_id = gm.group_id
                WHERE gm.user_id = %s
                AND g.group_id IN (
                    SELECT DISTINCT gm2.group_id
                    FROM group_members gm2
                    WHERE gm2.user_id IN (
                        SELECT user_id FROM user_visited_places WHERE place_id = %s
                        UNION
                        SELECT user_id FROM user_wishlist WHERE place_id = %s
                        UNION
                        SELECT user_id FROM user_liked_places WHERE place_id = %s
                    )
                )
                ORDER BY g.name
            """, (user_id, place_id, place_id, place_id))
            
            groups = []
            for row in cur.fetchall():
                groups.append({
                    "group_id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "your_role": row[3]
                })
            
            return jsonify({
                "success": True,
                "place_id": place_id,
                "groups": groups
            }), 200
            
    except Exception as e:
        app.logger.error(f"Error getting place groups: {e}")
        return jsonify({"error": "Failed to get place groups", "details": str(e)}), 500

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

# CRITICAL FIX: Global error handlers with Sentry integration
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    if SENTRY_AVAILABLE:
        sentry_sdk.capture_message(f"404 Not Found: {request.path}", level="warning")
    return jsonify({"error": "Endpoint not found", "path": request.path}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors - Sentry automatically captures these."""
    # Skip error handling for OPTIONS requests
    if request.method == 'OPTIONS':
        from flask import Response
        resp = Response(status=200)
        resp.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        resp.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        resp.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        resp.headers.add('Access-Control-Allow-Credentials', 'true')
        return resp
    
    app.logger.error(f"Internal server error: {error}", exc_info=True, extra={
        "path": request.path,
        "method": request.method,
        "ip": request.remote_addr
    })
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    """Global exception handler - catches all unhandled exceptions."""
    from flask import has_request_context
    # Skip error handling for OPTIONS requests - return proper CORS response
    if has_request_context() and request.method == 'OPTIONS':
        from flask import Response
        resp = Response(status=200)
        resp.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        resp.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        resp.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        resp.headers.add('Access-Control-Allow-Credentials', 'true')
        return resp
    
    # Log the error
    import traceback
    error_trace = traceback.format_exc()
    app.logger.error(f"Unhandled exception: {e}", exc_info=True, extra={
        "path": request.path if has_request_context() else "unknown",
        "method": request.method if has_request_context() else "unknown",
        "ip": request.remote_addr if has_request_context() else "unknown"
    })
    app.logger.error(f"Traceback: {error_trace}")
    
    # Send to Sentry (if available)
    if SENTRY_AVAILABLE:
        sentry_sdk.capture_exception(e)
    
    # Return error response with more details in development
    is_dev = os.getenv("ENVIRONMENT", "development") == "development"
    error_response = {
        "error": "An unexpected error occurred",
        "message": str(e) if is_dev else "Internal server error"
    }
    if is_dev:
        error_response["traceback"] = error_trace.split('\n')[-5:]  # Last 5 lines
    
    return jsonify(error_response), 500

# Import extension endpoints (after app is created)
try:
    from app_extensions import *
except ImportError:
    pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "localhost")  # Use localhost instead of 127.0.0.1 for cookie compatibility
    app.run(host=host, port=port, debug=True)
