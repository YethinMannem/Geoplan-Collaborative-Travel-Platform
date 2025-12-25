# 🔧 CRITICAL FIXES - Implementation Guide

This document provides **actionable code** to fix the most critical production issues.

---

## 1. 🔐 SECURITY FIXES

### Fix 1.1: Remove Hardcoded Passwords

**Current Problem** (app.py lines 65-91):
```python
DB_ROLES = {
    "readonly_user": {
        "username": "readonly_user",
        "password": "readonly_pass123",  # ❌ HARDCODED!
    },
    ...
}
```

**Solution**: Use environment variables

**Step 1**: Create `.env.example` (commit this):
```env
# Database Configuration
DATABASE_URL=postgresql://postgres@localhost:5432/geoapp

# Role-based Database Credentials
READONLY_USER_PASSWORD=your_secure_password_here
APP_USER_PASSWORD=your_secure_password_here
CURATOR_USER_PASSWORD=your_secure_password_here
ANALYST_USER_PASSWORD=your_secure_password_here
ADMIN_USER_PASSWORD=your_secure_password_here

# Application Security
SECRET_KEY=generate-a-random-32-char-string-here
SESSION_SECRET=another-random-string-here

# Redis (for token storage)
REDIS_URL=redis://localhost:6379/0

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000
```

**Step 2**: Update `app.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv()

# Get passwords from environment
DB_ROLES = {
    "readonly_user": {
        "username": "readonly_user",
        "password": os.getenv("READONLY_USER_PASSWORD", ""),  # ✅ From env
        "permissions": ["SELECT"]
    },
    "app_user": {
        "username": "app_user",
        "password": os.getenv("APP_USER_PASSWORD", ""),
        "permissions": ["SELECT", "INSERT", "UPDATE"]
    },
    "curator_user": {
        "username": "curator_user",
        "password": os.getenv("CURATOR_USER_PASSWORD", ""),
        "permissions": ["SELECT", "INSERT", "UPDATE", "ANALYTICS"]
    },
    "analyst_user": {
        "username": "analyst_user",
        "password": os.getenv("ANALYST_USER_PASSWORD", ""),
        "permissions": ["SELECT", "ANALYTICS"]
    },
    "admin_user": {
        "username": "admin_user",
        "password": os.getenv("ADMIN_USER_PASSWORD", ""),
        "permissions": ["ALL"]
    }
}

# Validate that passwords are set
for role_name, role_info in DB_ROLES.items():
    if not role_info["password"]:
        raise ValueError(f"Missing password for role {role_name}. Set {role_name.upper()}_PASSWORD in .env")

# Strong secret key
app.secret_key = os.getenv("SECRET_KEY")
if not app.secret_key or app.secret_key == "dev-secret-key-change-in-production":
    raise ValueError("SECRET_KEY must be set in .env and must not be the default value")
```

**Step 3**: Add `.env` to `.gitignore`:
```
.env
*.env
!.env.example
```

---

### Fix 1.2: Replace In-Memory Token Storage with Redis

**Current Problem** (app.py line 117):
```python
TOKEN_STORAGE = {}  # ❌ Lost on restart, doesn't scale
```

**Solution**: Use Redis

**Step 1**: Install Redis client:
```bash
pip install redis
```

**Step 2**: Update `requirements.txt`:
```
redis==5.0.1
```

**Step 3**: Create `backend/token_storage.py`:
```python
"""Redis-based token storage for scalable authentication."""
import redis
import json
import time
import os
from typing import Optional, Dict

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
TOKEN_TTL = 1800  # 30 minutes

class TokenStorage:
    def __init__(self):
        try:
            self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            # Test connection
            self.redis_client.ping()
        except redis.ConnectionError:
            raise RuntimeError(f"Failed to connect to Redis at {REDIS_URL}. Is Redis running?")
    
    def store_token(self, token: str, user_role: str, user_id: Optional[int] = None) -> None:
        """Store token with expiration."""
        token_data = {
            "user_role": user_role,
            "user_id": user_id,
            "created_at": time.time()
        }
        self.redis_client.setex(
            f"token:{token}",
            TOKEN_TTL,
            json.dumps(token_data)
        )
    
    def get_token_data(self, token: str) -> Optional[Dict]:
        """Get token data if valid."""
        if not token:
            return None
        
        data = self.redis_client.get(f"token:{token}")
        if not data:
            return None
        
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return None
    
    def delete_token(self, token: str) -> None:
        """Delete token."""
        self.redis_client.delete(f"token:{token}")
    
    def extend_token(self, token: str, additional_seconds: int = 1800) -> bool:
        """Extend token expiration."""
        return bool(self.redis_client.expire(f"token:{token}", additional_seconds))

# Global instance
_token_storage = None

def get_token_storage() -> TokenStorage:
    """Get or create token storage instance."""
    global _token_storage
    if _token_storage is None:
        _token_storage = TokenStorage()
    return _token_storage
```

**Step 4**: Update `app.py`:
```python
from token_storage import get_token_storage

# Replace TOKEN_STORAGE usage
def generate_token(username, user_id=None):
    """Generate a token and store in Redis."""
    secret = app.secret_key
    timestamp = str(time.time())
    token_string = f"{username}:{timestamp}:{secret}"
    token = hashlib.sha256(token_string.encode()).hexdigest()
    
    # Store in Redis
    storage = get_token_storage()
    storage.store_token(token, username, user_id)
    
    return token

def validate_token(token):
    """Validate token from Redis."""
    if not token:
        return None
    
    storage = get_token_storage()
    token_data = storage.get_token_data(token)
    
    if not token_data:
        return None
    
    return token_data.get("user_role")

def get_user_id_from_request():
    """Get user_id from token."""
    token = request.headers.get('X-Auth-Token') or (
        request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    )
    if not token:
        return None
    
    storage = get_token_storage()
    token_data = storage.get_token_data(token)
    return token_data.get("user_id") if token_data else None
```

---

### Fix 1.3: Add Rate Limiting

**Step 1**: Install Flask-Limiter:
```bash
pip install Flask-Limiter
```

**Step 2**: Update `requirements.txt`:
```
Flask-Limiter==3.5.0
```

**Step 3**: Update `app.py`:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,  # Rate limit by IP
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)

# Apply to specific endpoints
@app.get("/within_radius")
@limiter.limit("30 per minute")  # 30 searches per minute
def within_radius():
    ...

@app.get("/nearest")
@limiter.limit("30 per minute")
def nearest():
    ...

@app.post("/auth/login")
@limiter.limit("5 per minute")  # Prevent brute force
def login():
    ...

@app.post("/places/add")
@limiter.limit("10 per hour")  # Limit location additions
def add_place():
    ...
```

---

### Fix 1.4: Add Input Validation

**Step 1**: Install marshmallow:
```bash
pip install marshmallow
```

**Step 2**: Create `backend/schemas.py`:
```python
"""Request validation schemas."""
from marshmallow import Schema, fields, validate, ValidationError

class RadiusSearchSchema(Schema):
    lat = fields.Float(required=True, validate=validate.Range(min=-90, max=90))
    lon = fields.Float(required=True, validate=validate.Range(min=-180, max=180))
    km = fields.Float(missing=10, validate=validate.Range(min=0.1, max=1000))
    state = fields.Str(missing=None, validate=validate.Length(max=100))
    name = fields.Str(missing=None, validate=validate.Length(max=200))

class NearestSearchSchema(Schema):
    lat = fields.Float(required=True, validate=validate.Range(min=-90, max=90))
    lon = fields.Float(required=True, validate=validate.Range(min=-180, max=180))
    k = fields.Int(missing=10, validate=validate.Range(min=1, max=100))
    state = fields.Str(missing=None, validate=validate.Length(max=100))
    name = fields.Str(missing=None, validate=validate.Length(max=200))

class AddPlaceSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    city = fields.Str(missing="", validate=validate.Length(max=100))
    state = fields.Str(missing="", validate=validate.Length(max=100))
    country = fields.Str(missing="US", validate=validate.Length(max=2))
    lat = fields.Float(required=True, validate=validate.Range(min=-90, max=90))
    lon = fields.Float(required=True, validate=validate.Range(min=-180, max=180))
    place_type = fields.Str(missing="brewery", validate=validate.OneOf([
        "brewery", "restaurant", "tourist_place", "hotel"
    ]))
```

**Step 3**: Update endpoints in `app.py`:
```python
from schemas import RadiusSearchSchema, NearestSearchSchema, AddPlaceSchema

@app.get("/within_radius")
@limiter.limit("30 per minute")
def within_radius():
    """Find places within radius with validation."""
    schema = RadiusSearchSchema()
    try:
        data = schema.load(request.args)
    except ValidationError as err:
        return jsonify({"error": "Invalid input", "details": err.messages}), 400
    
    # Use validated data
    lat = data["lat"]
    lon = data["lon"]
    km = data["km"]
    ...
```

---

## 2. 🚀 SCALABILITY FIXES

### Fix 2.1: Add Connection Pooling

**Step 1**: Install psycopg pool:
```bash
pip install psycopg[binary,pool]
```

**Step 2**: Update `app.py`:
```python
from psycopg_pool import ConnectionPool

# Create connection pool
_pool = None

def get_pool():
    """Get or create connection pool."""
    global _pool
    if _pool is None:
        pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        max_overflow = int(os.getenv("DB_POOL_MAX_OVERFLOW", "5"))
        
        user_role = get_user_role_from_request()
        if user_role:
            db_url = get_database_url_for_role(user_role)
        else:
            db_url = BASE_DATABASE_URL
        
        _pool = ConnectionPool(
            db_url,
            min_size=2,
            max_size=pool_size,
            max_waiting=10,
            max_idle=300,  # 5 minutes
            reconnect_timeout=60
        )
    return _pool

def get_conn():
    """Get connection from pool."""
    pool = get_pool()
    return pool.getconn()

# Update all database operations to use pool
@app.get("/health")
def health():
    try:
        pool = get_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "database": "disconnected", "error": str(e)}), 503
```

---

### Fix 2.2: Add Caching Layer

**Step 1**: Create `backend/cache.py`:
```python
"""Redis caching utilities."""
import redis
import json
import hashlib
import os
from functools import wraps

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_cache_client = None

def get_cache():
    """Get Redis cache client."""
    global _cache_client
    if _cache_client is None:
        _cache_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _cache_client

def cache_key(*args, **kwargs):
    """Generate cache key from arguments."""
    key_string = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
    return hashlib.md5(key_string.encode()).hexdigest()

def cached(ttl=300):
    """Decorator to cache function results."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_cache()
            key = f"cache:{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cached_value = cache.get(key)
            if cached_value:
                return json.loads(cached_value)
            
            # Compute and cache
            result = func(*args, **kwargs)
            cache.setex(key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator
```

**Step 2**: Use caching in `app.py`:
```python
from cache import cached

@app.get("/stats")
@cached(ttl=300)  # Cache for 5 minutes
def stats():
    """Get database statistics (cached)."""
    ...
```

---

### Fix 2.3: Add Pagination

**Update `app.py`**:
```python
@app.get("/within_bbox")
@limiter.limit("30 per minute")
def within_bbox():
    """Find places in bounding box with pagination."""
    # Get pagination params
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 100)), 500)  # Max 500 per page
    offset = (page - 1) * per_page
    
    # ... existing bbox validation ...
    
    # Update SQL with pagination
    sql = """
        SELECT id, name, city, state, country, lat, lon
        FROM places
        WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
    """
    params = [west, south, east, north]
    
    # Add filters...
    
    # Get total count
    count_sql = f"SELECT COUNT(*) FROM ({sql}) AS filtered"
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(count_sql, params)
        total = cur.fetchone()[0]
    
    # Get paginated results
    sql += f" ORDER BY id LIMIT %s OFFSET %s"
    params.extend([per_page, offset])
    
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        results = cur.fetchall()
    
    return jsonify({
        "features": [format_place(row) for row in results],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page
        }
    })
```

---

## 3. 📊 MONITORING & LOGGING

### Fix 3.1: Structured Logging

**Step 1**: Install python-json-logger:
```bash
pip install python-json-logger
```

**Step 2**: Update `app.py`:
```python
import logging
from pythonjsonlogger import jsonlogger

# Configure structured logging
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    '%(asctime)s %(name)s %(levelname)s %(message)s'
)
logHandler.setFormatter(formatter)
app.logger.addHandler(logHandler)
app.logger.setLevel(logging.INFO)

# Use structured logging
@app.get("/within_radius")
def within_radius():
    app.logger.info("radius_search", extra={
        "lat": lat,
        "lon": lon,
        "km": km,
        "ip": request.remote_addr,
        "user_agent": request.headers.get("User-Agent")
    })
    ...
```

---

### Fix 3.2: Add Error Tracking (Sentry)

**Step 1**: Install Sentry:
```bash
pip install sentry-sdk[flask]
```

**Step 2**: Update `app.py`:
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

# Initialize Sentry (only in production)
if os.getenv("ENVIRONMENT") == "production":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[FlaskIntegration()],
        traces_sample_rate=0.1,
        environment="production"
    )
```

---

## 4. 🐳 DOCKER SETUP

### Fix 4.1: Dockerize Application

**Create `Dockerfile`**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ .

# Expose port
EXPOSE 5000

# Run application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

**Create `docker-compose.yml`**:
```yaml
version: '3.8'

services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: geoapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@db:5432/geoapp
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
    ports:
      - "5000:5000"
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app

volumes:
  postgres_data:
```

---

## 5. ✅ TESTING

### Fix 5.1: Add Unit Tests

**Create `backend/tests/` directory and `test_api.py`**:
```python
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """Test health endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'

def test_within_radius_validation(client):
    """Test radius search validation."""
    # Missing required params
    response = client.get('/within_radius')
    assert response.status_code == 400
    
    # Invalid lat
    response = client.get('/within_radius?lat=100&lon=0')
    assert response.status_code == 400
    
    # Valid request
    response = client.get('/within_radius?lat=29.76&lon=-95.37&km=10')
    assert response.status_code == 200
```

**Run tests**:
```bash
pip install pytest pytest-cov
pytest backend/tests/ -v --cov=backend --cov-report=html
```

---

## 📝 NEXT STEPS

1. **Week 1**: Implement security fixes (secrets, Redis, rate limiting)
2. **Week 2**: Add connection pooling, caching, structured logging
3. **Week 3**: Dockerize, add tests, set up CI/CD
4. **Week 4**: Add pagination, improve error handling, performance tuning

---

**Remember**: These fixes are the **minimum** for production. Continue iterating based on user feedback and monitoring data.


