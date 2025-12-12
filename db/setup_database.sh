#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Geospatial Web App - Database Setup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql >/dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not installed.${NC}"
    echo "Install it with: brew install postgresql@16 postgis"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL found${NC}"

# Detect PostgreSQL version and path
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
echo "PostgreSQL version: $PG_VERSION"

# Try to find PostgreSQL service
PG_SERVICE=""
if command -v brew >/dev/null 2>&1; then
    # Check for common PostgreSQL versions
    for version in 18 16 15 14; do
        if brew services list | grep -q "postgresql@${version}"; then
            PG_SERVICE="postgresql@${version}"
            break
        fi
    done
fi

# Start PostgreSQL if not running
if [ -n "$PG_SERVICE" ]; then
    echo "Starting PostgreSQL service: $PG_SERVICE"
    brew services start "$PG_SERVICE" || true
    sleep 2
else
    echo -e "${YELLOW}⚠️  PostgreSQL service not found in brew services${NC}"
    echo "Attempting to start PostgreSQL manually..."
    
    # Try to start PostgreSQL directly
    if [ -d "/opt/homebrew/opt/postgresql@${PG_VERSION}" ]; then
        /opt/homebrew/opt/postgresql@${PG_VERSION}/bin/pg_ctl -D /opt/homebrew/var/postgresql@${PG_VERSION} start || true
    elif [ -d "/usr/local/opt/postgresql@${PG_VERSION}" ]; then
        /usr/local/opt/postgresql@${PG_VERSION}/bin/pg_ctl -D /usr/local/var/postgresql@${PG_VERSION} start || true
    fi
    sleep 2
fi

# Check if PostgreSQL is running
if ! pg_isready >/dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running.${NC}"
    echo "Please start PostgreSQL manually:"
    echo "  brew services start postgresql@16"
    echo "  or"
    echo "  pg_ctl -D /opt/homebrew/var/postgresql@16 start"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Database connection settings
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${PGPASSWORD:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Check if password is set
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  PGPASSWORD environment variable not set${NC}"
    echo "Please set it with: export PGPASSWORD=yourpassword"
    echo "Or provide it when running: PGPASSWORD=yourpassword ./setup_database.sh"
    exit 1
fi

# Set password for psql commands
export PGPASSWORD="$DB_PASSWORD"

echo "Database configuration:"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Test connection
echo "Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Can connect to PostgreSQL${NC}"
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    echo ""
    echo "Please check:"
    echo "  1. PostgreSQL is running: pg_isready"
    echo "  2. User 'postgres' exists and password is correct"
    echo "  3. Database server is listening on port $DB_PORT"
    echo ""
    echo "You can set PGPASSWORD environment variable:"
    echo "  export PGPASSWORD=yourpassword"
    echo "  Then run this script again"
    exit 1
fi

# Create database
echo "Creating database 'geoapp'..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" geoapp 2>/dev/null && echo -e "${GREEN}✅ Database 'geoapp' created${NC}" || echo -e "${YELLOW}⚠️  Database 'geoapp' might already exist${NC}"

# Enable PostGIS extension
echo "Enabling PostGIS extension..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostGIS extension enabled${NC}"
else
    echo -e "${RED}❌ Failed to enable PostGIS extension${NC}"
    echo "You may need to install PostGIS: brew install postgis"
    exit 1
fi

# Verify PostGIS version
POSTGIS_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -t -c "SELECT PostGIS_version();" | xargs)
echo "PostGIS version: $POSTGIS_VERSION"

# Create schema
echo "Creating database schema..."
SCHEMA_PATH="db/schema.sql"
if [ ! -f "$SCHEMA_PATH" ]; then
    # Try relative path from project root
    SCHEMA_PATH="../db/schema.sql"
fi

if [ -f "$SCHEMA_PATH" ]; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -f "$SCHEMA_PATH" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Schema created${NC}"
    else
        echo -e "${YELLOW}⚠️  Schema might already exist${NC}"
    fi
else
    echo -e "${RED}❌ Schema file not found: db/schema.sql${NC}"
    echo "Looking for schema file in: $(pwd)"
    exit 1
fi

# Verify table exists
echo "Verifying table 'places'..."
TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -t -c "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'places');" | xargs)
if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Table 'places' exists${NC}"
else
    echo -e "${RED}❌ Table 'places' does not exist${NC}"
    exit 1
fi

# Check if spatial index exists
echo "Verifying spatial index..."
INDEX_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -t -c "SELECT EXISTS(SELECT FROM pg_indexes WHERE indexname = 'idx_places_geom');" | xargs)
if [ "$INDEX_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Spatial index exists${NC}"
else
    echo -e "${YELLOW}⚠️  Spatial index not found, creating it...${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -c "CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);" >/dev/null 2>&1
    echo -e "${GREEN}✅ Spatial index created${NC}"
fi

# Test connection
echo "Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

# Get record count
RECORD_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d geoapp -t -c "SELECT COUNT(*) FROM places;" | xargs)
echo "Records in 'places' table: $RECORD_COUNT"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Database setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Database User: $DB_USER"
# URL encode the password (replace @ with %40)
ENCODED_PASSWORD=$(echo "$DB_PASSWORD" | sed 's/@/%40/g')
echo "Database URL: postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/geoapp"
echo ""
echo "Creating backend/.env file..."

# Create .env file with URL-encoded password
cat > backend/.env << EOF
DATABASE_URL=postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/geoapp
PORT=5000
HOST=127.0.0.1
EOF

echo -e "${GREEN}✅ Environment file created: backend/.env${NC}"
echo ""
echo "Next steps:"
echo "1. Create virtual environment: cd backend && python3 -m venv venv && source venv/bin/activate"
echo "2. Install dependencies: pip install -r requirements.txt"
echo "3. Load data: python etl_openbrewerydb.py"
echo "4. Start Flask server: python app.py"
echo "5. Test API: curl http://127.0.0.1:5000/health"
echo ""

