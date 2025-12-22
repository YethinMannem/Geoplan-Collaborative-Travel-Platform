# Environment Variables Template

**Copy these to your `.env` file in the `backend/` directory**

```bash
# ============================================================================
# ENVIRONMENT VARIABLES TEMPLATE
# ============================================================================
# Copy this to backend/.env and fill in all values
# NEVER commit .env to Git (it's in .gitignore)
# ============================================================================

# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/geoapp
# Format: postgresql://username:password@host:port/database

# Server Configuration
PORT=5000
HOST=localhost
ENVIRONMENT=development
# Options: development, production

# ============================================================================
# CRITICAL: Database Role Passwords
# ============================================================================
# These passwords are used for role-based database access
# Generate strong passwords for each role
# Use: python -c "import secrets; print(secrets.token_urlsafe(32))"

READONLY_USER_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD
APP_USER_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD
CURATOR_USER_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD
ANALYST_USER_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD
ADMIN_USER_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD

# ============================================================================
# CRITICAL: Secret Key
# ============================================================================
# Generate a random secret key for Flask sessions
# Use: python -c "import secrets; print(secrets.token_urlsafe(32))"
# MUST be set in production!

SECRET_KEY=CHANGE_THIS_TO_RANDOM_SECRET_KEY_32_CHARS_OR_MORE

# ============================================================================
# Redis Configuration (Optional for local dev, Required for production)
# ============================================================================
# For local development: redis://localhost:6379/0
# For production: Set by Fly.io automatically
# Used for: Token storage, Rate limiting, Caching

REDIS_URL=redis://localhost:6379/0

# ============================================================================
# Sentry Error Tracking (Optional, Recommended for production)
# ============================================================================
# Sign up at https://sentry.io
# Create a Flask project
# Get your DSN and set it here
# Only used when ENVIRONMENT=production

SENTRY_DSN=

# ============================================================================
# Connection Pool Configuration (Optional)
# ============================================================================
# Default: 10 connections
# Adjust based on your database capacity

DB_POOL_SIZE=10
DB_POOL_MAX_OVERFLOW=5

# ============================================================================
# Application Version (Optional)
# ============================================================================
# Used for Sentry release tracking

APP_VERSION=1.0.0
```

## Quick Setup

1. **Generate passwords**:
```bash
python -c "import secrets; print('READONLY_USER_PASSWORD=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('APP_USER_PASSWORD=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('CURATOR_USER_PASSWORD=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('ANALYST_USER_PASSWORD=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('ADMIN_USER_PASSWORD=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
```

2. **Copy to `.env`**:
```bash
cd backend
cp ../ENV_TEMPLATE.md .env
# Then edit .env and replace all CHANGE_THIS values
```

