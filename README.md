# Geospatial Web Application

**CSCI 765 – Intro to Database Systems**  
**Project by: Yethin Chandra Sai Mannem**

A full-stack geospatial web application that demonstrates PostgreSQL/PostGIS integration with a Python Flask backend and Google Maps JavaScript frontend. The application stores real-world geospatial data (brewery locations) and enables spatial queries including radius searches, nearest neighbor queries, and bounding box queries.

---

## 🎯 Project Overview

This application showcases:
- **Database Design**: PostgreSQL with PostGIS extension for geospatial data storage
- **Spatial Indexing**: GIST indexes for fast spatial queries
- **REST API**: Flask backend with multiple spatial query endpoints
- **Interactive Visualization**: Google Maps frontend with marker clustering and filtering
- **ETL Pipeline**: Automated data loading from OpenBreweryDB API

---

## 🏗️ Architecture

```
┌─────────────┐     HTTP/REST     ┌──────────────┐     SQL/PostGIS     ┌─────────────┐
│   Frontend  │ ◄───────────────► │   Flask API  │ ◄─────────────────► │ PostgreSQL  │
│ Google Maps │                    │   (Python)   │                    │  + PostGIS  │
└─────────────┘                    └──────────────┘                    └─────────────┘
                                           │
                                           │ HTTP
                                           ▼
                                  ┌──────────────┐
                                  │ OpenBreweryDB│
                                  │     API      │
                                  └──────────────┘
```

---

## 📋 Prerequisites

- **PostgreSQL 16+** with PostGIS extension
- **Python 3.8+**
- **Google Maps JavaScript API Key** ([Get one here](https://console.cloud.google.com/google/maps-apis))
- **Homebrew** (for macOS installation)

---

## 🚀 Setup Instructions

### 1. Database Setup

#### Install PostgreSQL and PostGIS (macOS)
```bash
# Install via Homebrew
brew install postgresql@16 postgis

# Start PostgreSQL service
brew services start postgresql@16

# Create database user (if needed)
createuser -s $(whoami)
```

#### Create Database and Enable PostGIS
```bash
# Create database
createdb geoapp

# Enable PostGIS extension
psql -d geoapp -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Create schema
psql -d geoapp -f db/schema.sql
```

Alternatively, use the automated setup script:
```bash
chmod +x db/setup_database.sh
./db/setup_database.sh
```

### 2. Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment
Create a `.env` file in the `backend` directory:
```env
DATABASE_URL=postgresql://your_username@localhost:5432/geoapp
PORT=5000
HOST=127.0.0.1
```

**Note**: Adjust `DATABASE_URL` if you have a password or different connection settings.

#### Load Data
```bash
python etl_openbrewerydb.py
```

This will:
- Fetch brewery data from OpenBreweryDB API
- Validate coordinates
- Insert into PostgreSQL with PostGIS geometry
- Display progress and summary

#### Start Flask Server
```bash
python app.py
```

The API will be available at `http://127.0.0.1:5000`

### 3. Frontend Setup

#### Configure Google Maps API Key
1. Open `frontend/index.html`
2. Replace `YOUR_API_KEY` with your actual Google Maps JavaScript API key:
```html
<script async src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&callback=initMapWithClustering&libraries=geometry"></script>
```

#### Open in Browser
Simply open `frontend/index.html` in your web browser. The Flask API must be running for the frontend to work.

---

## 📡 API Endpoints

### Health Check
```http
GET /health
```
Returns API status and database connection status.

**Response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

### Within Radius
```http
GET /within_radius?lat=29.7604&lon=-95.3698&km=25&state=Texas&name=Brewery
```
Find all places within a radius (in kilometers) of a point.

**Parameters:**
- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `km` (optional): Radius in kilometers (default: 10, max: 1000)
- `state` (optional): Filter by state name (case-insensitive, partial match)
- `name` (optional): Filter by name (case-insensitive, partial match)

**Response:**
```json
{
  "features": [
    {
      "id": 1,
      "name": "Brewery Name",
      "city": "Houston",
      "state": "Texas",
      "country": "US",
      "lat": 29.7604,
      "lon": -95.3698
    }
  ],
  "count": 1
}
```

### Nearest K
```http
GET /nearest?lat=29.7604&lon=-95.3698&k=10&state=Texas
```
Find the K nearest places to a point using PostGIS KNN (K-Nearest Neighbor) query.

**Parameters:**
- `lat` (required): Latitude
- `lon` (required): Longitude
- `k` (optional): Number of results (default: 10, max: 100)
- `state` (optional): Filter by state
- `name` (optional): Filter by name

**Response:**
```json
{
  "features": [
    {
      "id": 1,
      "name": "Brewery Name",
      "city": "Houston",
      "state": "Texas",
      "country": "US",
      "lat": 29.7604,
      "lon": -95.3698,
      "distance_km": 2.5
    }
  ],
  "count": 1
}
```

### Within Bounding Box
```http
GET /within_bbox?north=30.0&south=29.5&east=-95.0&west=-95.5&state=Texas
```
Find all places within a bounding box (map viewport).

**Parameters:**
- `north` (required): Northern boundary latitude
- `south` (required): Southern boundary latitude
- `east` (required): Eastern boundary longitude
- `west` (required): Western boundary longitude
- `state` (optional): Filter by state
- `name` (optional): Filter by name

### Statistics
```http
GET /stats
```
Get database statistics including total count, top states, and geographic bounds.

**Response:**
```json
{
  "total_places": 2000,
  "top_states": [
    {"state": "California", "count": 500},
    {"state": "Texas", "count": 300}
  ],
  "bounds": {
    "min_lat": 24.0,
    "max_lat": 49.0,
    "min_lon": -125.0,
    "max_lon": -66.0
  }
}
```

### Export CSV
```http
GET /export/csv?state=Texas&name=Brewery
```
Export places data as CSV file.

**Parameters:**
- `state` (optional): Filter by state
- `name` (optional): Filter by name

**Response:** CSV file download

### Export GeoJSON
```http
GET /export/geojson?state=California
```
Export places data as GeoJSON format.

**Parameters:**
- `state` (optional): Filter by state
- `name` (optional): Filter by name

**Response:** GeoJSON FeatureCollection

### State Analytics
```http
GET /analytics/states
```
Get analytics by state including counts and average coordinates.

**Response:**
```json
{
  "states": [
    {
      "state": "California",
      "count": 197,
      "avg_lat": 35.2533,
      "avg_lon": -119.2621
    }
  ],
  "total": 50
}
```

### Density Analysis
```http
GET /analytics/density?lat=29.7604&lon=-95.3698&radius=100
```
Calculate spatial density of places in a radius.

**Parameters:**
- `lat` (required): Center latitude
- `lon` (required): Center longitude
- `radius` (optional): Radius in kilometers (default: 100)

**Response:**
```json
{
  "center": {"lat": 29.7604, "lon": -95.3698},
  "radius_km": 100,
  "count": 150,
  "density_per_1000_km2": 4.77
}
```

### Distance Matrix
```http
GET /distance_matrix?points=lat1,lon1;lat2,lon2;lat3,lon3
```
Calculate distance matrix between multiple points.

**Parameters:**
- `points` (required): Semicolon-separated list of coordinates (format: "lat,lon;lat,lon")

**Response:**
```json
{
  "matrix": [
    {
      "point": {"lat": 29.7604, "lon": -95.3698},
      "distances": [0, 250.5, 380.2]
    }
  ],
  "units": "kilometers"
}
```

---

## 🗄️ Database Schema

### Table: `places`
```sql
CREATE TABLE places (
    id SERIAL PRIMARY KEY,
    source_id TEXT,
    name TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    geom geometry(Point, 4326)  -- PostGIS geometry column (WGS84)
);

CREATE INDEX idx_places_geom ON places USING GIST (geom);  -- Spatial index
```

### Key Features
- **Spatial Column**: `geom` stores points in WGS84 (SRID 4326)
- **GIST Index**: Enables fast spatial queries
- **Dual Storage**: Both `lat/lon` columns and `geom` for flexibility

---

## 🔍 Spatial Queries

### Radius Search (ST_DWithin)
Uses geography casting for accurate distance calculations:
```sql
SELECT * FROM places
WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    radius_km * 1000
);
```

### Nearest Neighbor (KNN)
Uses PostGIS `<->` operator for efficient KNN queries:
```sql
SELECT * FROM places
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)
LIMIT k;
```

### Bounding Box
Uses bounding box operator for fast filtering:
```sql
SELECT * FROM places
WHERE geom && ST_MakeEnvelope(west, south, east, north, 4326);
```

---

## 🎨 Frontend Features

### Query Types
1. **Radius Search**: Find all places within a radius
2. **Nearest K**: Find K nearest places
3. **Bounding Box**: Find places in a map window

### Interactive Features
- **Marker Clustering**: Automatic clustering for 5+ markers
- **Info Windows**: Click markers to see details
- **Results Sidebar**: List of results with distance information
- **Filters**: Filter by state or name
- **Stats Display**: Database statistics
- **Error Handling**: User-friendly error messages
- **Responsive Design**: Works on desktop and mobile

### Controls
- **Search Button**: Execute query
- **Load Stats**: Refresh database statistics
- **Query Type Tabs**: Switch between radius, nearest, and bbox
- **Filter Inputs**: Optional state and name filters

---

## 🧪 Testing

### Test Database Connection
```bash
curl http://127.0.0.1:5000/health
```

### Test Radius Query
```bash
curl "http://127.0.0.1:5000/within_radius?lat=29.7604&lon=-95.3698&km=25"
```

### Test Nearest Query
```bash
curl "http://127.0.0.1:5000/nearest?lat=29.7604&lon=-95.3698&k=10"
```

### Test Stats
```bash
curl http://127.0.0.1:5000/stats
```

---

## 📊 Performance Considerations

### Spatial Indexing
- GIST index on `geom` column enables fast spatial queries
- Index usage verified with `EXPLAIN ANALYZE`

### Query Limits
- Radius query: Limited to 2000 results
- Bounding box: Limited to 5000 results
- Nearest K: Limited to 100 results

### Optimization Tips
1. Use `ST_DWithin` with geography for accurate distances
2. Use `<->` operator for KNN queries (faster than `ST_Distance`)
3. Use bounding box operator `&&` for initial filtering
4. Consider pagination for large result sets

---

## 🐛 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `brew services list`
- Check DATABASE_URL in `.env` file
- Test connection: `psql -d geoapp -c "SELECT 1;"`

### PostGIS Not Found
```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify installation
SELECT PostGIS_version();
```

### No Results in Frontend
- Verify Flask API is running
- Check browser console for errors
- Verify Google Maps API key is valid
- Check CORS settings (should be enabled)

### ETL Script Fails
- Check internet connection (requires OpenBreweryDB API)
- Verify database connection
- Check PostGIS extension is installed
- Review error messages in console

---

## 📈 Future Enhancements

### Short-Term
- [ ] Pagination for large result sets
- [ ] Heatmap visualization
- [ ] Export results to CSV/GeoJSON
- [ ] User authentication
- [ ] Save favorite searches

### Long-Term
- [ ] Deployment to cloud (Render, Heroku, AWS)
- [ ] Advanced spatial analytics (buffers, intersections)
- [ ] Real-time data updates
- [ ] Multi-dataset support
- [ ] Mobile app (React Native)

---

## 🚀 Production Readiness Review

**⚠️ IMPORTANT**: This project was built as an academic demonstration. For real-world production use, significant improvements are needed.

### 📋 Production Readiness Documents

If you're planning to deploy this application for real users, please review:

1. **[ENTREPRENEUR_REVIEW_SUMMARY.md](ENTREPRENEUR_REVIEW_SUMMARY.md)** ⭐ **START HERE**
   - Executive summary of critical issues
   - Top 5 must-fix items
   - Quick action plan

2. **[IMPLEMENTATION_GUIDE_BEST_FREE.md](IMPLEMENTATION_GUIDE_BEST_FREE.md)** 🚀 **START HERE - STEP-BY-STEP GUIDE**
   - Complete implementation guide for best free stack
   - Fly.io + Supabase + Cloudflare Pages setup
   - Step-by-step instructions with code examples
   - Troubleshooting and verification checklist
   - **This is the guide to follow!**

3. **[BRUTAL_HONEST_REVIEW.md](BRUTAL_HONEST_REVIEW.md)** 🔥 **WHY THIS STACK IS BEST**
   - Brutally honest comparison of all free tiers
   - What's actually best vs. what's easiest
   - Real limitations and hidden costs
   - Why Fly.io + Supabase + Cloudflare is better

4. **[ACTUALLY_BEST_FREE_STACK.md](ACTUALLY_BEST_FREE_STACK.md)** 🏆 **DETAILED EXPLANATION**
   - Why Fly.io is better than Railway
   - Why Supabase is better than Railway DB
   - Why Cloudflare Pages is better than Vercel
   - Complete comparison tables

5. **[BEST_FREE_STACK.md](BEST_FREE_STACK.md)** ⚡ **ALTERNATIVE: EASIEST (Railway)**
   - Easiest free tier stack (Railway + Vercel + Sentry)
   - Good for quick prototypes
   - ⚠️ Note: Railway uses credit system (unpredictable)

3. **[FREE_TIER_IMPLEMENTATION.md](FREE_TIER_IMPLEMENTATION.md)** 💰 **ALL FREE OPTIONS**
   - Complete free tier alternatives
   - Multiple hosting options compared
   - Self-hosted options
   - Free tier limits explained

3. **[PRODUCTION_READINESS_ASSESSMENT.md](PRODUCTION_READINESS_ASSESSMENT.md)**
   - Comprehensive review of all issues
   - Security vulnerabilities
   - Scalability concerns
   - Reliability gaps
   - Detailed priority matrix

4. **[CRITICAL_FIXES_IMPLEMENTATION.md](CRITICAL_FIXES_IMPLEMENTATION.md)**
   - Step-by-step code fixes
   - Copy-paste ready solutions
   - Implementation examples

5. **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)**
   - Trackable checklist
   - Progress monitoring
   - Pre-launch verification

### 🔴 Critical Issues to Address

Before deploying to production, you **MUST** fix:

1. **Security**: Remove hardcoded passwords, implement proper token storage, add rate limiting
2. **Reliability**: Set up automated backups, add connection pooling, implement caching
3. **Monitoring**: Add structured logging, error tracking, application metrics
4. **Testing**: Write automated tests, set up CI/CD pipeline
5. **Infrastructure**: Dockerize application, set up staging environment

**Estimated Time to Production**: 4-6 weeks of focused development

---

## 📚 Technologies Used

- **Backend**: Python 3.8+, Flask 3.0.0, psycopg 3.2.12
- **Database**: PostgreSQL 16+, PostGIS 3.3+
- **Frontend**: HTML5, JavaScript, Google Maps JavaScript API
- **ETL**: Python, requests library
- **Spatial Operations**: PostGIS spatial functions

---

## 📝 License

This project is created for educational purposes as part of CSCI 765 – Intro to Database Systems.

---

## 👤 Author

**Yethin Chandra Sai Mannem**  
**Course**: CSCI 765 – Intro to Database Systems  
**University Project** - 2024

---

## 📚 Additional Documentation

### Academic Documentation
- **[PROJECT_REPORT.md](PROJECT_REPORT.md)** - Detailed project report with analysis
- **[CODE_DOCUMENTATION.md](CODE_DOCUMENTATION.md)** - Comprehensive code documentation
- **[QUERIES.md](QUERIES.md)** - Spatial queries documentation and examples
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Database setup guide
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide
- **[SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md)** - Submission checklist
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Project structure and file descriptions

### Production Readiness (For Real-World Deployment)
- **[ENTREPRENEUR_REVIEW_SUMMARY.md](ENTREPRENEUR_REVIEW_SUMMARY.md)** ⭐ - Executive summary and quick start
- **[BRUTAL_HONEST_REVIEW.md](BRUTAL_HONEST_REVIEW.md)** 🔥 - **READ THIS FIRST**: Brutally honest comparison - no BS
- **[ACTUALLY_BEST_FREE_STACK.md](ACTUALLY_BEST_FREE_STACK.md)** 🏆 - **BEST FREE TIER**: Fly.io + Supabase + Cloudflare (better than Railway)
- **[BEST_FREE_STACK.md](BEST_FREE_STACK.md)** ⚡ - Easiest setup (Railway + Vercel) - Good for quick start only
- **[FREE_TIER_IMPLEMENTATION.md](FREE_TIER_IMPLEMENTATION.md)** 💰 - All free tier options and alternatives
- **[PRODUCTION_READINESS_ASSESSMENT.md](PRODUCTION_READINESS_ASSESSMENT.md)** - Comprehensive production review
- **[CRITICAL_FIXES_IMPLEMENTATION.md](CRITICAL_FIXES_IMPLEMENTATION.md)** - Step-by-step code fixes
- **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** - Trackable production readiness checklist
- **[COMPLETE_FEATURES_AND_WORKFLOWS.md](COMPLETE_FEATURES_AND_WORKFLOWS.md)** - Complete documentation of all features and workflows

---

## 🙏 Acknowledgments

- **OpenBreweryDB API** for providing brewery data
- **PostGIS project** for spatial database capabilities
- **Google Maps Platform** for mapping visualization
- **PostgreSQL** for robust database management
- **Flask** for web framework

---

## 📞 Support

For issues or questions, please check:
1. Database connection and PostGIS setup (see [DATABASE_SETUP.md](DATABASE_SETUP.md))
2. Flask API logs for errors
3. Browser console for frontend errors
4. This README for common solutions
5. Project documentation files for detailed information

---

## 🎓 Academic Submission

This project is submitted as part of CSCI 765 – Intro to Database Systems course requirements.

### Project Components
- ✅ Database design and implementation
- ✅ Spatial data types and operations
- ✅ Spatial indexing and optimization
- ✅ RESTful API development
- ✅ Web interface development
- ✅ Comprehensive documentation

### Key Achievements
- ✅ Implemented spatial database with PostGIS
- ✅ Created optimized spatial queries
- ✅ Developed RESTful API with multiple endpoints
- ✅ Built interactive web interface
- ✅ Implemented ETL pipeline
- ✅ Comprehensive documentation and reporting

---

**Last Updated**: 2024  
**Version**: 1.0  
**Status**: Complete and Ready for Submission
