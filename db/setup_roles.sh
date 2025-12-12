#!/bin/bash

# Geospatial Web Application - Setup Database Roles
# Course: CSCI 765 – Intro to Database Systems
# Project: Geospatial Web Application
# Student: Yethin Chandra Sai Mannem
# Date: 2024

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Database connection settings
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-geoapp}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Roles Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if database exists
echo -e "${YELLOW}Checking database connection...${NC}"
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to database '$DB_NAME'${NC}"
    echo "Please ensure:"
    echo "  1. PostgreSQL is running"
    echo "  2. Database '$DB_NAME' exists"
    echo "  3. User '$DB_USER' has access"
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"
echo ""

# Apply roles SQL
echo -e "${YELLOW}Creating database roles and permissions...${NC}"
echo -e "${BLUE}This will create:${NC}"
echo "  • readonly_user (SELECT only)"
echo "  • app_user (SELECT, INSERT, UPDATE)"
echo "  • analyst_user (SELECT + analytics)"
echo "  • admin_user (Full access)"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${YELLOW}Applying roles and permissions...${NC}"

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/roles_and_permissions.sql"; then
    echo -e "${GREEN}✅ Roles and permissions created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create roles${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Database Roles Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Created Roles:${NC}"
echo ""
echo "1. readonly_user"
echo "   Password: readonly_pass123"
echo "   Permissions: SELECT only"
echo "   Connection: psql -h $DB_HOST -p $DB_PORT -U readonly_user -d $DB_NAME"
echo ""
echo "2. app_user"
echo "   Password: app_pass123"
echo "   Permissions: SELECT, INSERT, UPDATE"
echo "   Connection: psql -h $DB_HOST -p $DB_PORT -U app_user -d $DB_NAME"
echo ""
echo "3. analyst_user"
echo "   Password: analyst_pass123"
echo "   Permissions: SELECT + analytics functions"
echo "   Connection: psql -h $DB_HOST -p $DB_PORT -U analyst_user -d $DB_NAME"
echo ""
echo "4. admin_user"
echo "   Password: admin_pass123"
echo "   Permissions: ALL (full access)"
echo "   Connection: psql -h $DB_HOST -p $DB_PORT -U admin_user -d $DB_NAME"
echo ""
echo ""
echo -e "${BLUE}Security Concepts Demonstrated:${NC}"
echo "  ✅ Role-Based Access Control (RBAC)"
echo "  ✅ Principle of Least Privilege"
echo "  ✅ GRANT and REVOKE permissions"
echo "  ✅ Database security best practices"
echo ""


