# Complete Features and Workflows - Geospatial Travel Platform

**Version:** 1.0  
**Date:** December 2024  
**Project:** Geospatial Collaborative Travel Platform

---

## 📋 Table of Contents

1. [Spatial Search Features](#1-spatial-search-features)
2. [User Authentication & Accounts](#2-user-authentication--accounts)
3. [Personal Lists Management](#3-personal-lists-management)
4. [Group Collaboration](#4-group-collaboration)
5. [Place Management](#5-place-management)
6. [Analytics & Statistics](#6-analytics--statistics)
7. [Data Export](#7-data-export)
8. [Advanced Database Features](#8-advanced-database-features)
9. [Role-Based Access Control](#9-role-based-access-control)
10. [Map Visualization](#10-map-visualization)

---

## 1. Spatial Search Features

### 1.1 Radius Search (Within Radius)

**Description:** Find all places within a specified radius (in kilometers) from a given point.

**API Endpoint:** `GET /within_radius`

**Parameters:**
- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `km` (optional): Radius in kilometers (default: 10, max: 1000)
- `state` (optional): Filter by state name (case-insensitive, partial match)
- `name` (optional): Filter by place name (case-insensitive, partial match)
- `place_type` (optional): Filter by place type (brewery, restaurant, hotel, tourist_place)

**Complete Workflow:**

1. **User Action:**
   - User opens the application
   - Clicks on "Search Controls" (left sidebar)
   - Selects "Radius Search" tab

2. **Input Coordinates:**
   - User enters latitude in "Latitude" field (e.g., 29.7604)
   - User enters longitude in "Longitude" field (e.g., -95.3698)
   - User can click "📍 Use Current Location" button to auto-fill coordinates
   - User sets radius in "Radius (km)" field (e.g., 25)
   - Optionally, user enters state filter (e.g., "Texas")
   - Optionally, user enters name filter (e.g., "Brewery")

3. **Execute Search:**
   - User clicks "Search Places" button
   - Frontend sends GET request: `/within_radius?lat=29.7604&lon=-95.3698&km=25&state=Texas`

4. **Backend Processing:**
   - Backend validates parameters (coordinate ranges, radius limits)
   - Executes PostGIS query using `ST_DWithin` function with geography casting
   - Query filters by state and name if provided
   - Calculates distance for each result using `ST_Distance`
   - Limits results to 2000 places
   - Returns JSON response with features array

5. **Frontend Display:**
   - Right sidebar displays results list with:
     - Place name
     - City, State, Country
     - Distance in kilometers
     - List status indicators (visited, wishlist, liked) if user logged in
     - Place type badge
   - Map displays markers for all results
   - Markers clustered automatically if 5+ markers
   - Info windows show place details when marker clicked

6. **Results Interaction:**
   - User can click on place in sidebar to center map on that place
   - User can click markers to see info window
   - User can add places to personal lists (if logged in)
   - User can export results (if authenticated)

**Database Query:**
```sql
SELECT id, name, city, state, country, lat, lon,
       ST_Distance(
           geom::geography,
           ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
       ) / 1000.0 as distance_km
FROM places
WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
    radius_km * 1000
)
AND (state ILIKE %state_filter% OR state_filter IS NULL)
AND (name ILIKE %name_filter% OR name_filter IS NULL)
ORDER BY distance_km
LIMIT 2000;
```

---

### 1.2 Nearest K Places (K-Nearest Neighbor)

**Description:** Find the K nearest places to a point using PostGIS KNN (K-Nearest Neighbor) query.

**API Endpoint:** `GET /nearest`

**Parameters:**
- `lat` (required): Latitude
- `lon` (required): Longitude
- `k` (optional): Number of results (default: 10, max: 100)
- `state` (optional): Filter by state
- `name` (optional): Filter by name
- `place_type` (optional): Filter by place type

**Complete Workflow:**

1. **User Action:**
   - User selects "Nearest K" tab in Search Controls
   - Enters latitude and longitude (or uses current location)
   - Sets K value (number of results, e.g., 10)
   - Optionally adds filters (state, name, place_type)

2. **Execute Search:**
   - User clicks "Search Places"
   - Frontend sends: `/nearest?lat=29.7604&lon=-95.3698&k=10`

3. **Backend Processing:**
   - Validates parameters
   - Uses PostGIS `<->` operator for efficient KNN query (faster than ST_Distance)
   - Filters by optional parameters
   - Calculates actual distance for each result
   - Returns up to K results

4. **Frontend Display:**
   - Results displayed in sidebar sorted by distance (nearest first)
   - Markers displayed on map
   - Distance shown for each result
   - User can interact with results same as radius search

**Database Query:**
```sql
SELECT id, name, city, state, country, lat, lon,
       ST_Distance(
           geom::geography,
           ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
       ) / 1000.0 as distance_km
FROM places
WHERE (state ILIKE %state_filter% OR state_filter IS NULL)
AND (name ILIKE %name_filter% OR name_filter IS NULL)
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)
LIMIT k;
```

---

### 1.3 Bounding Box Search

**Description:** Find all places within a bounding box (map viewport).

**API Endpoint:** `GET /within_bbox`

**Parameters:**
- `north` (required): Northern boundary latitude
- `south` (required): Southern boundary latitude
- `east` (required): Eastern boundary longitude
- `west` (required): Western boundary longitude
- `state` (optional): Filter by state
- `name` (optional): Filter by name
- `place_type` (optional): Filter by place type

**Complete Workflow:**

1. **User Action:**
   - User selects "Bounding Box" tab
   - Enters north, south, east, west coordinates
   - OR user can adjust map viewport and click "Use Current View"

2. **Execute Search:**
   - Frontend calculates bounding box from map bounds if using current view
   - Sends request: `/within_bbox?north=30.0&south=29.5&east=-95.0&west=-95.5`

3. **Backend Processing:**
   - Uses PostGIS `&&` operator for bounding box overlap
   - Creates envelope using `ST_MakeEnvelope`
   - Filters by optional parameters
   - Limits to 5000 results

4. **Frontend Display:**
   - All places in viewport displayed
   - Markers clustered for better performance
   - User can pan/zoom map and re-search

**Database Query:**
```sql
SELECT id, name, city, state, country, lat, lon
FROM places
WHERE geom && ST_MakeEnvelope(west, south, east, north, 4326)
AND (state ILIKE %state_filter% OR state_filter IS NULL)
AND (name ILIKE %name_filter% OR name_filter IS NULL)
LIMIT 5000;
```

---

### 1.4 Distance Matrix

**Description:** Calculate distance matrix between multiple points.

**API Endpoint:** `GET /distance_matrix`

**Parameters:**
- `points` (required): Semicolon-separated coordinates (format: "lat,lon;lat,lon;lat,lon")

**Complete Workflow:**

1. **User Action:**
   - User selects multiple places on map (or provides coordinates)
   - Coordinates formatted as: "29.7604,-95.3698;30.2672,-97.7431;32.7767,-96.7970"

2. **Execute Query:**
   - Frontend sends: `/distance_matrix?points=29.7604,-95.3698;30.2672,-97.7431`

3. **Backend Processing:**
   - Parses coordinate pairs
   - Calculates distance between all pairs using PostGIS
   - Returns matrix with distances in kilometers

4. **Frontend Display:**
   - Distance matrix displayed in sidebar
   - Shows distance from each point to all other points
   - Useful for trip planning and route optimization

**Response Format:**
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

## 2. User Authentication & Accounts

### 2.1 User Registration

**Description:** Create a new user account with email and password.

**API Endpoint:** `POST /api/users/register`

**Complete Workflow:**

1. **Access Registration:**
   - User clicks "Login" in navbar
   - Clicks "Register" tab in UserAuth component

2. **Fill Registration Form:**
   - Username: 3-50 characters (required)
   - Email: Valid email format (required, unique)
   - Password: Minimum length (required)
   - Confirm Password: Must match password (required)
   - User fills all fields

3. **Submit Registration:**
   - Frontend validates:
     - Username length and format
     - Email format
     - Password match
   - If valid, sends POST request to `/api/users/register`
   - Request body:
     ```json
     {
       "username": "newuser",
       "email": "user@example.com",
       "password": "password123",
       "confirmPassword": "password123"
     }
     ```

4. **Backend Processing:**
   - Validates input data (Marshmallow schema)
   - Checks if username or email already exists
   - Hashes password using bcrypt
   - Starts database transaction
   - Inserts user into `users` table
   - Creates initial empty lists (visited, wishlist, liked)
   - Commits transaction
   - Returns user object with user_id, username, email

5. **Frontend Response:**
   - Success message displayed
   - User automatically logged in
   - Token stored in localStorage
   - User redirected to main application

**Database Operation:**
```sql
BEGIN;
INSERT INTO users (username, email, password_hash)
VALUES (%s, %s, %s)
RETURNING user_id, username, email;
COMMIT;
```

---

### 2.2 User Login

**Description:** Authenticate user and create session.

**API Endpoint:** `POST /api/users/login`

**Complete Workflow:**

1. **Access Login:**
   - User clicks "Login" in navbar
   - Login tab is default view

2. **Enter Credentials:**
   - Username or email
   - Password
   - User fills fields

3. **Submit Login:**
   - Frontend sends POST request: `/api/users/login`
   - Request body:
     ```json
     {
       "username": "newuser",
       "password": "password123"
     }
     ```

4. **Backend Processing:**
   - Validates input
   - Queries database for user by username or email
   - If user not found, returns 401 error
   - Compares provided password with stored hash using bcrypt
   - If password incorrect, returns 401 error
   - Generates authentication token (JWT or session token)
   - Stores token in Redis (if available) or session storage
   - Creates session cookie
   - Returns token and user profile

5. **Frontend Response:**
   - Token stored in localStorage
   - User state updated (logged in)
   - User profile loaded
   - UI updates to show authenticated state
   - Personal lists become accessible

---

### 2.3 Get User Profile

**Description:** Retrieve current user's profile information.

**API Endpoint:** `GET /api/users/profile`

**Complete Workflow:**

1. **Trigger:**
   - Automatically called after login
   - User clicks on profile section
   - Component mounts and checks authentication

2. **Request:**
   - Frontend sends GET request with Authorization header
   - Header: `Authorization: Bearer <token>`

3. **Backend Processing:**
   - Validates token from request
   - Extracts user_id from token
   - Queries user table for profile
   - Returns user object (user_id, username, email, created_at)

4. **Frontend Display:**
   - Profile information displayed in UserPanel
   - Shows username, email, account creation date
   - Shows statistics (list counts)

---

### 2.4 User Statistics

**Description:** Get statistics about user's lists (counts, etc.).

**API Endpoint:** `GET /api/users/stats`

**Complete Workflow:**

1. **Trigger:**
   - User opens UserPanel
   - Component automatically fetches stats

2. **Request:**
   - GET `/api/users/stats` with authentication

3. **Backend Processing:**
   - Gets user_id from authenticated session
   - Counts records in each list table:
     - `user_visited_places`
     - `user_wishlist`
     - `user_liked_places`
   - Returns counts

4. **Frontend Display:**
   - Statistics displayed as cards or numbers:
     - Visited: X places
     - Wishlist: X places
     - Liked: X places
   - Clickable to view respective lists

---

## 3. Personal Lists Management

### 3.1 Visited Places List

#### 3.1.1 Add Place to Visited List

**API Endpoint:** `POST /api/user/visited`

**Complete Workflow:**

1. **User Action:**
   - User searches for places (radius, nearest, or bbox)
   - Results displayed in sidebar
   - User clicks "✓ Visited" button on a place card
   - OR user clicks marker on map and clicks "Add to Visited"

2. **Frontend Processing:**
   - Checks if user is logged in
   - If not logged in, shows login prompt
   - If logged in, sends POST request: `/api/user/visited`
   - Request body:
     ```json
     {
       "place_id": 123,
       "notes": "Great place! Visited in 2024",
       "visited_at": "2024-12-01T10:00:00Z"  // optional
     }
     ```

3. **Backend Processing:**
   - Validates authentication
   - Gets user_id from token
   - Checks if place exists
   - Checks if already in visited list (unique constraint)
   - If exists, updates notes/timestamp
   - If new, inserts into `user_visited_places` table
   - Returns success response

4. **Frontend Update:**
   - Button changes to active state (filled checkmark)
   - Place status indicator updates
   - If viewing visited list, list refreshes automatically
   - If in group, place automatically appears in group places

5. **Automatic Group Sync:**
   - Backend query for group places includes this place
   - No additional action needed from user
   - Place appears in all groups where user is a member

**Database Operation:**
```sql
INSERT INTO user_visited_places (user_id, place_id, notes, visited_at)
VALUES (%s, %s, %s, %s)
ON CONFLICT (user_id, place_id) 
DO UPDATE SET notes = EXCLUDED.notes, visited_at = EXCLUDED.visited_at;
```

#### 3.1.2 View Visited List

**API Endpoint:** `GET /api/user/visited`

**Complete Workflow:**

1. **User Action:**
   - User clicks "My Lists" in navbar or UserPanel
   - Selects "Visited" tab
   - OR clicks on visited count in statistics

2. **Request:**
   - GET `/api/user/visited`
   - Optional query params: `lat`, `lon` (for distance calculation)
   - Optional: `search` (filter by name/location)

3. **Backend Processing:**
   - Validates authentication
   - Gets user_id
   - Joins `user_visited_places` with `places` table
   - If lat/lon provided, calculates distance for each place
   - If search provided, filters by name/city/state
   - Orders by visited_at DESC (most recent first)
   - Returns list of places with metadata

4. **Frontend Display:**
   - List displayed in sidebar or main view
   - Each place shows:
     - Place name, city, state
     - Visit date/timestamp
     - Notes (if any)
     - Distance (if reference location provided)
   - User can remove places from list
   - User can search/filter the list
   - Places can be shown on map

#### 3.1.3 Remove from Visited List

**API Endpoint:** `DELETE /api/user/visited/<place_id>`

**Complete Workflow:**

1. **User Action:**
   - User views visited list
   - Clicks "Remove" or "×" button on a place
   - Confirms removal (if confirmation dialog)

2. **Request:**
   - DELETE `/api/user/visited/123`

3. **Backend Processing:**
   - Validates authentication
   - Deletes record from `user_visited_places`
   - Returns success

4. **Frontend Update:**
   - Place removed from list display
   - Button state changes (unchecked)
   - Statistics updated
   - If in group view, place removed from group (if no other members have it)

---

### 3.2 Wishlist Management

#### 3.2.1 Add Place to Wishlist

**API Endpoint:** `POST /api/user/wishlist`

**Complete Workflow:**

1. **User Action:**
   - User clicks "⭐ Wishlist" button on place card or marker

2. **Request:**
   - POST `/api/user/wishlist`
   - Body:
     ```json
     {
       "place_id": 123,
       "priority": 2,  // 1-3, default 1
       "notes": "Visit during happy hour"
     }
     ```

3. **Backend Processing:**
   - Validates priority (1-3)
   - Inserts/updates in `user_wishlist` table
   - Returns success

4. **Frontend Update:**
   - Button becomes active (filled star)
   - Priority can be displayed (⭐ = 1, ⭐⭐ = 2, ⭐⭐⭐ = 3)
   - Place appears in wishlist view
   - Automatically synced to groups

#### 3.2.2 View Wishlist

**API Endpoint:** `GET /api/user/wishlist`

**Complete Workflow:**

Similar to visited list, but:
- Orders by priority DESC, then added_at DESC
- Shows priority badges
- Allows filtering by priority
- Can calculate distances for trip planning

#### 3.2.3 Remove from Wishlist

**API Endpoint:** `DELETE /api/user/wishlist/<place_id>`

**Complete Workflow:**

Same as remove from visited list, but deletes from `user_wishlist` table.

---

### 3.3 Liked/Favorites List

#### 3.3.1 Add Place to Liked List

**API Endpoint:** `POST /api/user/liked`

**Complete Workflow:**

1. **User Action:**
   - User clicks "❤️ Liked" button

2. **Request:**
   - POST `/api/user/liked`
   - Body:
     ```json
     {
       "place_id": 123,
       "rating": 5,  // optional, 1-5
       "notes": "Amazing food!"
     }
     ```

3. **Backend Processing:**
   - Inserts/updates in `user_liked_places` table
   - Stores liked_at timestamp
   - Returns success

4. **Frontend Update:**
   - Heart icon becomes filled
   - Place appears in liked list
   - Synced to groups automatically

#### 3.3.2 View Liked List

**API Endpoint:** `GET /api/user/liked`

**Complete Workflow:**

Similar to other lists, ordered by liked_at DESC.

#### 3.3.3 Remove from Liked List

**API Endpoint:** `DELETE /api/user/liked/<place_id>`

**Complete Workflow:**

Same pattern as other list removals.

---

### 3.4 Get Place Status

**API Endpoint:** `GET /api/user/place-status/<place_id>`

**Description:** Check if a place is in any of user's lists.

**Complete Workflow:**

1. **Trigger:**
   - Automatically called when viewing search results
   - Called to update button states on place cards

2. **Request:**
   - GET `/api/user/place-status/123`

3. **Backend Processing:**
   - Checks all three list tables for user_id + place_id
   - Returns boolean flags:
     ```json
     {
       "visited": true,
       "in_wishlist": false,
       "liked": true
     }
     ```

4. **Frontend Usage:**
   - Updates button states on place cards
   - Shows which lists contain the place
   - Allows toggling list membership

---

## 4. Group Collaboration

### 4.1 Create Group

**API Endpoint:** `POST /api/groups`

**Complete Workflow:**

1. **User Action:**
   - User clicks "Groups" in navbar
   - Clicks "+ Create Group" button
   - Modal/form opens

2. **Fill Group Form:**
   - Group Name: 3-100 characters (required)
   - Description: Optional text
   - User fills form

3. **Submit:**
   - POST `/api/groups`
   - Body:
     ```json
     {
       "name": "Family Trip 2024",
       "description": "Planning our summer vacation"
     }
     ```

4. **Backend Processing:**
   - Validates name length
   - Gets user_id from authentication
   - Starts transaction
   - Inserts into `groups` table
   - Automatically adds creator as admin in `group_members` table
   - Commits transaction
   - Returns group object

5. **Frontend Update:**
   - Group appears in user's groups list
   - Success message shown
   - Modal closes
   - User can immediately add members

**Database Operation:**
```sql
BEGIN;
INSERT INTO groups (name, description, created_by)
VALUES (%s, %s, %s)
RETURNING group_id;
INSERT INTO group_members (group_id, user_id, role)
VALUES (%s, %s, 'admin');
COMMIT;
```

---

### 4.2 View User's Groups

**API Endpoint:** `GET /api/groups`

**Complete Workflow:**

1. **Trigger:**
   - User clicks "Groups" in navbar
   - Component mounts

2. **Request:**
   - GET `/api/groups` (authenticated)

3. **Backend Processing:**
   - Gets user_id from token
   - Joins `groups`, `group_members`, and `users` tables
   - Filters by user_id
   - Includes:
     - Group details (name, description, created_by)
     - User's role in group (admin/member)
     - Member count
     - Creator username
   - Orders by created_at DESC

4. **Frontend Display:**
   - List of group cards displayed
   - Each card shows:
     - Group name
     - Description
     - Member count
     - User's role badge
     - "View Details" button
     - "View Places" button
   - Empty state if no groups
   - "Create Group" button always visible

---

### 4.3 View Group Details

**API Endpoint:** `GET /api/groups/<group_id>`

**Complete Workflow:**

1. **User Action:**
   - User clicks "Details" on a group card

2. **Request:**
   - GET `/api/groups/1`

3. **Backend Processing:**
   - Validates user is a member (403 if not)
   - Gets group information
   - Gets all members with their roles
   - Returns group and members array

4. **Frontend Display:**
   - Modal or expanded view shows:
     - Group name and description
     - Creator information
     - Members list with:
       - Username
       - Role (admin/member)
       - Joined date
     - If user is admin:
       - "Add Member" form
       - Remove member buttons (for non-admins)

---

### 4.4 Add Group Member

**API Endpoint:** `POST /api/groups/<group_id>/members`

**Complete Workflow:**

1. **User Action:**
   - Admin user views group details
   - Enters username or email in "Add Member" form
   - Clicks "Add" button

2. **Request:**
   - POST `/api/groups/1/members`
   - Body:
     ```json
     {
       "username": "friend_username"
     }
     ```

3. **Backend Processing:**
   - Validates user is admin (403 if not)
   - Searches for user by username or email
   - Returns 404 if user not found
   - Checks if already a member (400 if exists)
   - Inserts into `group_members` with role='member'
   - Returns success with member info

4. **Frontend Update:**
   - Member appears in members list
   - Success message shown
   - Form clears
   - Member count updates

**Database Operation:**
```sql
-- Check admin
SELECT role FROM group_members WHERE group_id = %s AND user_id = %s;

-- Find user
SELECT user_id FROM users WHERE username = %s OR email = %s;

-- Add member
INSERT INTO group_members (group_id, user_id, role)
VALUES (%s, %s, 'member');
```

---

### 4.5 Remove Group Member

**API Endpoint:** `DELETE /api/groups/<group_id>/members/<member_id>`

**Complete Workflow:**

1. **User Action:**
   - Admin clicks "Remove" button next to member name
   - Confirmation dialog appears
   - User confirms

2. **Request:**
   - DELETE `/api/groups/1/members/5`

3. **Backend Processing:**
   - Validates user is admin
   - Prevents removing self (400 error)
   - Deletes from `group_members` table
   - Returns success

4. **Frontend Update:**
   - Member removed from list
   - Member count decreases
   - Success message shown

---

### 4.6 View Group Places

**API Endpoint:** `GET /api/groups/<group_id>/places`

**Complete Workflow:**

1. **User Action:**
   - User clicks "View Places" on group card
   - OR clicks "📍 View Group Places" in group details

2. **Request:**
   - GET `/api/groups/1/places`

3. **Backend Processing:**
   - Validates user is a member
   - Gets all member user_ids for the group
   - Queries for places that appear in ANY member's lists:
     - UNION of places from `user_visited_places`
     - UNION of places from `user_wishlist`
     - UNION of places from `user_liked_places`
   - For each place, gets member statuses:
     - Which members have it in visited
     - Which members have it in wishlist
     - Which members have it in liked
   - Returns places array with member statuses nested

4. **Frontend Display:**
   - GroupPlaces component shows:
     - Header with group name
     - Info box explaining automatic sync
     - Filters:
       - Place type filter (checkboxes: Brewery, Restaurant, Hotel, Tourist Place)
       - Member status filters (per member: Visited, Wishlist, Liked, None)
     - Places list with:
       - Place name, location
       - Place type badge
       - Member statuses section showing:
         - Username
         - Status badges (✓ Visited, ⭐ Wishlist, ❤️ Liked)
   - User can filter by place type
   - User can filter by member status (per member)
   - User can view places on map

**Database Query:**
```sql
-- Get places from all member lists
SELECT DISTINCT p.id, p.name, p.city, p.state, p.country, p.lat, p.lon
FROM places p
WHERE p.id IN (
    SELECT place_id FROM user_visited_places
    WHERE user_id IN (SELECT user_id FROM group_members WHERE group_id = %s)
    UNION
    SELECT place_id FROM user_wishlist
    WHERE user_id IN (SELECT user_id FROM group_members WHERE group_id = %s)
    UNION
    SELECT place_id FROM user_liked_places
    WHERE user_id IN (SELECT user_id FROM group_members WHERE group_id = %s)
);

-- For each place, get member statuses
SELECT u.user_id, u.username,
       CASE WHEN v.visit_id IS NOT NULL THEN TRUE ELSE FALSE END as visited,
       CASE WHEN w.wish_id IS NOT NULL THEN TRUE ELSE FALSE END as in_wishlist,
       CASE WHEN l.like_id IS NOT NULL THEN TRUE ELSE FALSE END as liked
FROM group_members gm
JOIN users u ON gm.user_id = u.user_id
LEFT JOIN user_visited_places v ON v.user_id = u.user_id AND v.place_id = %s
LEFT JOIN user_wishlist w ON w.user_id = u.user_id AND w.place_id = %s
LEFT JOIN user_liked_places l ON l.user_id = u.user_id AND l.place_id = %s
WHERE gm.group_id = %s;
```

---

### 4.7 Get Groups for a Place

**API Endpoint:** `GET /api/places/<place_id>/groups`

**Description:** Get all groups (where user is a member) that include this place.

**Complete Workflow:**

1. **Trigger:**
   - Called when viewing place details
   - Shows which groups contain this place

2. **Request:**
   - GET `/api/places/123/groups`

3. **Backend Processing:**
   - Gets user_id from authentication
   - Finds groups where:
     - User is a member
     - Place is in at least one member's list (any list type)
   - Returns groups array

4. **Frontend Display:**
   - Shows group badges or list
   - Can click to navigate to group
   - Useful for seeing collaboration context

---

## 5. Place Management

### 5.1 Add New Place

**API Endpoint:** `POST /places/add`

**Description:** Add a new place to the database (requires authentication, admin/app_user role for some fields).

**Complete Workflow:**

1. **User Action:**
   - User clicks "Add Place" button (if authenticated and has permission)
   - Form modal opens
   - OR user right-clicks on map to set location

2. **Fill Place Form:**
   - Name (required)
   - City (optional)
   - State (optional)
   - Country (default: US)
   - Latitude (required, -90 to 90)
   - Longitude (required, -180 to 180)
   - Place Type (dropdown: brewery, restaurant, hotel, tourist_place)
   - Type-specific data (varies by type):
     - Brewery: brewery_type, website, phone
     - Restaurant: cuisine_type, price_range, rating
     - Hotel: star_rating, amenities, check_in_time
     - Tourist: attraction_type, admission_fee, description

3. **Submit:**
   - POST `/places/add`
   - Body:
     ```json
     {
       "name": "New Brewery",
       "city": "Houston",
       "state": "Texas",
       "country": "US",
       "lat": 29.7604,
       "lon": -95.3698,
       "place_type": "brewery",
       "type_data": {
         "brewery_type": "micro",
         "website": "https://example.com"
       }
     }
     ```

4. **Backend Processing:**
   - Validates coordinates
   - Validates place type
   - Starts transaction
   - Inserts into `places` table (trigger automatically creates geometry)
   - If place_type provided, inserts into type-specific table (breweries, restaurants, etc.)
   - Sets created_by to user_id
   - Commits transaction
   - Returns place object

5. **Frontend Update:**
   - Success message shown
   - Place appears in search results
   - Map centers on new place
   - Form resets

**Database Operation:**
```sql
BEGIN;
INSERT INTO places (name, city, state, country, lat, lon, created_by)
VALUES (%s, %s, %s, %s, %s, %s, %s)
RETURNING id;

-- Trigger automatically sets geom column

INSERT INTO breweries (place_id, brewery_type, website)
VALUES (%s, %s, %s);
COMMIT;
```

---

### 5.2 Upload Places via CSV

**API Endpoint:** `POST /places/upload-csv`

**Description:** Bulk upload places from CSV file (admin only).

**Complete Workflow:**

1. **User Action:**
   - Admin user clicks "Upload CSV" button
   - File picker opens
   - User selects CSV file

2. **CSV Format:**
   - Columns: name, city, state, country, lat, lon, place_type, ...
   - Headers required
   - Encoding: UTF-8

3. **Submit:**
   - POST `/places/upload-csv`
   - Content-Type: multipart/form-data
   - Body: FormData with file

4. **Backend Processing:**
   - Validates admin role
   - Reads CSV file
   - Validates each row:
     - Required fields present
     - Coordinates valid
     - Place type valid
   - Batches inserts (for performance)
   - Uses transactions for each batch
   - Returns summary:
     - Total rows processed
     - Successfully inserted
     - Errors (with row numbers)

5. **Frontend Display:**
   - Upload progress indicator
   - Results summary shown:
     - ✅ X places added
     - ❌ Y errors
     - Error details if any

---

### 5.3 View My Added Places

**API Endpoint:** `GET /api/places/my-added`

**Complete Workflow:**

1. **User Action:**
   - User clicks "My Added Places" in user menu

2. **Request:**
   - GET `/api/places/my-added`

3. **Backend Processing:**
   - Gets user_id from authentication
   - Queries places where created_by = user_id
   - Orders by created_at DESC
   - Returns places list

4. **Frontend Display:**
   - List of places user created
   - Shows creation date
   - Can edit or delete (if permitted)

---

### 5.4 Update Place

**API Endpoint:** `PUT /api/places/<place_id>`

**Complete Workflow:**

1. **User Action:**
   - User views place details (in "My Added Places" or elsewhere)
   - Clicks "Edit" button

2. **Request:**
   - PUT `/api/places/123`
   - Body: Updated fields

3. **Backend Processing:**
   - Validates user can edit (admin or creator)
   - Updates places table
   - Updates type-specific table if place_type changed
   - Trigger updates geometry if coordinates changed
   - Returns updated place

4. **Frontend Update:**
   - Place information refreshed
   - Success message shown

---

### 5.5 Delete Place

**API Endpoint:** `DELETE /api/places/<place_id>`

**Complete Workflow:**

1. **User Action:**
   - User clicks "Delete" on a place they created
   - Confirmation dialog appears

2. **Request:**
   - DELETE `/api/places/123`

3. **Backend Processing:**
   - Validates user can delete (admin or creator)
   - Cascading deletes:
     - From type-specific table
     - From user lists (visited, wishlist, liked)
   - Deletes from places table
   - Returns success

4. **Frontend Update:**
   - Place removed from display
   - Success message shown

---

## 6. Analytics & Statistics

### 6.1 Database Statistics

**API Endpoint:** `GET /stats`

**Complete Workflow:**

1. **Trigger:**
   - Automatically loaded on app start
   - User clicks "Load Stats" button

2. **Request:**
   - GET `/stats`

3. **Backend Processing:**
   - Counts total places
   - Gets top states by count (with counts)
   - Calculates geographic bounds (min/max lat/lon)
   - Returns statistics object

4. **Frontend Display:**
   - Statistics card shows:
     - Total Places: X
     - Top States list (with counts)
     - Geographic bounds
   - Can be used for map initialization

**Response:**
```json
{
  "total_places": 1847,
  "top_states": [
    {"state": "California", "count": 197},
    {"state": "Texas", "count": 150}
  ],
  "bounds": {
    "min_lat": 24.5,
    "max_lat": 49.0,
    "min_lon": -125.0,
    "max_lon": -66.0
  }
}
```

---

### 6.2 State Analytics

**API Endpoint:** `GET /analytics/states`

**Complete Workflow:**

1. **Request:**
   - GET `/analytics/states`

2. **Backend Processing:**
   - Groups places by state
   - Calculates for each state:
     - Count of places
     - Average latitude
     - Average longitude
     - Min/max coordinates
   - Returns states array

3. **Frontend Display:**
   - Table or cards showing state statistics
   - Can visualize on map (centroid points)

---

### 6.3 Density Analysis

**API Endpoint:** `GET /analytics/density`

**Complete Workflow:**

1. **User Action:**
   - User sets a center point (lat/lon)
   - Sets radius (default: 100 km)
   - Clicks "Calculate Density"

2. **Request:**
   - GET `/analytics/density?lat=29.7604&lon=-95.3698&radius=100`

3. **Backend Processing:**
   - Counts places within radius using `ST_DWithin`
   - Calculates area: π * radius²
   - Calculates density: count / area * 1000 (per 1000 km²)
   - Returns density metrics

4. **Frontend Display:**
   - Density metrics shown:
     - Number of places
     - Area in km²
     - Density per 1000 km²
   - Can visualize with circle on map

**Response:**
```json
{
  "center": {"lat": 29.7604, "lon": -95.3698},
  "radius_km": 100,
  "count": 150,
  "area_km2": 31415.93,
  "density_per_1000_km2": 4.77
}
```

---

## 7. Data Export

### 7.1 Export to CSV

**API Endpoint:** `GET /export/csv`

**Complete Workflow:**

1. **User Action:**
   - User performs a search (gets results)
   - OR user views a list (visited, wishlist, etc.)
   - Clicks "Export CSV" button

2. **Request:**
   - GET `/export/csv?state=Texas&name=Brewery`
   - Optional filters applied

3. **Backend Processing:**
   - Applies filters to query
   - Fetches matching places
   - Generates CSV content with headers
   - Sets Content-Type: text/csv
   - Sets Content-Disposition: attachment; filename="places.csv"
   - Returns CSV data

4. **Frontend Handling:**
   - Browser downloads file automatically
   - File named "places.csv"
   - User can open in Excel, Google Sheets, etc.

**CSV Format:**
```csv
id,name,city,state,country,lat,lon
1,Brewery Name,Houston,Texas,US,29.7604,-95.3698
```

---

### 7.2 Export to GeoJSON

**API Endpoint:** `GET /export/geojson`

**Complete Workflow:**

1. **User Action:**
   - Similar to CSV export
   - Clicks "Export GeoJSON"

2. **Request:**
   - GET `/export/geojson?state=California`

3. **Backend Processing:**
   - Fetches places
   - Formats as GeoJSON FeatureCollection
   - Each place is a Feature with:
     - type: "Feature"
     - geometry: Point with coordinates [lon, lat]
     - properties: place attributes
   - Returns JSON

4. **Frontend Handling:**
   - Downloads "places.geojson"
   - Can be imported into:
     - GIS software (QGIS, ArcGIS)
     - Google Earth
     - Map visualization tools

**GeoJSON Format:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-95.3698, 29.7604]
      },
      "properties": {
        "id": 1,
        "name": "Brewery Name",
        "city": "Houston",
        "state": "Texas"
      }
    }
  ]
}
```

---

## 8. Advanced Database Features

### 8.1 Database Views

#### 8.1.1 State Statistics View

**API Endpoint:** `GET /views/state-statistics`

**Description:** Uses database view `vw_state_statistics` for aggregated statistics.

**Complete Workflow:**

1. **Request:**
   - GET `/views/state-statistics`

2. **Backend Processing:**
   - Queries `vw_state_statistics` view
   - View contains pre-aggregated data:
     - State
     - Brewery count
     - City count
     - Average coordinates
     - Min/max coordinates
   - Returns results

3. **Frontend Display:**
   - Statistics table
   - Demonstrates database view concept

**View Definition:**
```sql
CREATE VIEW vw_state_statistics AS
SELECT 
    state,
    COUNT(*) as brewery_count,
    COUNT(DISTINCT city) as city_count,
    AVG(lat) as avg_latitude,
    AVG(lon) as avg_longitude,
    MIN(lat) as min_latitude,
    MAX(lat) as max_latitude,
    MIN(lon) as min_longitude,
    MAX(lon) as max_longitude
FROM places
WHERE state IS NOT NULL
GROUP BY state
ORDER BY brewery_count DESC;
```

#### 8.1.2 City Statistics View

**API Endpoint:** `GET /views/city-statistics`

Similar workflow, uses `vw_city_statistics` view with optional state filter.

#### 8.1.3 State Rankings View

**API Endpoint:** `GET /views/state-rankings`

**Description:** Demonstrates window functions (ROW_NUMBER, RANK, DENSE_RANK, PERCENT_RANK).

**Complete Workflow:**

1. **Request:**
   - GET `/views/state-rankings`

2. **Backend Processing:**
   - Queries `vw_state_rankings` view
   - View uses window functions to calculate rankings
   - Returns rankings with multiple ranking methods

3. **Frontend Display:**
   - Rankings table showing:
     - State
     - Count
     - Row number
     - Rank (with ties)
     - Dense rank
     - Percent rank

---

### 8.2 Stored Functions

#### 8.2.1 Within Radius Function

**API Endpoint:** `GET /functions/within-radius`

**Description:** Uses stored function `fn_places_within_radius` instead of inline SQL.

**Complete Workflow:**

1. **Request:**
   - GET `/functions/within-radius?lat=29.7604&lon=-95.3698&km=25`

2. **Backend Processing:**
   - Calls stored function: `SELECT * FROM fn_places_within_radius(%s, %s, %s)`
   - Function encapsulates query logic
   - Returns results

3. **Benefits:**
   - Reusable query logic
   - Easier to maintain
   - Can be called from SQL scripts
   - Demonstrates stored function concept

#### 8.2.2 K-Nearest Function

**API Endpoint:** `GET /functions/k-nearest`

Uses `fn_k_nearest_places` stored function for KNN queries.

#### 8.2.3 Density Function

**API Endpoint:** `GET /functions/density`

Uses `fn_calculate_density` stored function for density calculations.

#### 8.2.4 Full-Text Search Function

**API Endpoint:** `GET /functions/search?q=search_term`

**Description:** Uses PostgreSQL full-text search with stored function `fn_search_places`.

**Complete Workflow:**

1. **Request:**
   - GET `/functions/search?q=brewery`

2. **Backend Processing:**
   - Calls `fn_search_places` function
   - Function uses:
     - `to_tsvector` to index text
     - `plainto_tsquery` to parse search term
     - `ts_rank` to rank results by relevance
   - Returns ranked results

3. **Frontend Display:**
   - Search results sorted by relevance
   - Highlights matching terms (if implemented)

---

### 8.3 Materialized Views

#### 8.3.1 Top States Materialized View

**API Endpoint:** `GET /materialized-views/top-states`

**Description:** Uses materialized view `mv_top_states` for cached results.

**Complete Workflow:**

1. **Request:**
   - GET `/materialized-views/top-states`

2. **Backend Processing:**
   - Queries materialized view (fast, pre-computed)
   - Returns cached results

3. **Refresh:**
   - POST `/materialized-views/refresh?view=mv_top_states`
   - Refreshes materialized view with current data

**Benefits:**
- Fast queries (pre-computed)
- Reduces load on database
- Trade-off: data may be stale until refresh

#### 8.3.2 City Clusters Materialized View

**API Endpoint:** `GET /materialized-views/city-clusters`

Uses `mv_city_clusters` with spatial aggregations (ST_Collect, ST_Centroid).

---

### 8.4 Query Optimization (EXPLAIN ANALYZE)

**API Endpoint:** `GET /optimization/explain?type=radius`

**Description:** Returns EXPLAIN ANALYZE output for queries (for optimization analysis).

**Complete Workflow:**

1. **Request:**
   - GET `/optimization/explain?type=radius&lat=29.7604&lon=-95.3698&km=25`

2. **Backend Processing:**
   - Executes EXPLAIN ANALYZE on query
   - Returns query plan with:
     - Index usage
     - Execution time
     - Row estimates
     - Cost estimates

3. **Usage:**
   - For developers/admins
   - Analyze query performance
   - Verify index usage
   - Optimize queries

---

### 8.5 Audit Logging

**API Endpoint:** `GET /audit/log`

**Description:** View audit log of changes to places table.

**Complete Workflow:**

1. **Request:**
   - GET `/audit/log?limit=100`

2. **Backend Processing:**
   - Queries `places_audit_log` table
   - Returns log entries with:
     - Action (INSERT, UPDATE, DELETE)
     - Timestamp
     - Old values (JSONB)
     - New values (JSONB)
     - Place ID

3. **Frontend Display:**
   - Audit log table
   - Shows change history
   - Can filter by action, date, place_id

**Trigger Implementation:**
- `trg_audit_places` trigger automatically logs all changes
- Trigger function `fn_audit_places` handles INSERT, UPDATE, DELETE

---

## 9. Role-Based Access Control

### 9.1 Role-Based Login

**API Endpoint:** `POST /auth/login`

**Description:** Login with database role credentials (different from user accounts).

**Complete Workflow:**

1. **User Action:**
   - User clicks "Role Login" (if available)
   - Selects role from dropdown (readonly_user, app_user, curator_user, analyst_user, admin_user)
   - Enters username and password for that role

2. **Request:**
   - POST `/auth/login`
   - Body:
     ```json
     {
       "username": "app_user",
       "password": "app_pass123",
       "role": "app_user"
     }
     ```

3. **Backend Processing:**
   - Validates credentials against database role
   - Creates session with role permissions
   - Returns role and token

4. **Frontend Display:**
   - UI adapts based on role permissions
   - Different capabilities available:
     - readonly_user: View only
     - app_user: View, add, update
     - curator_user: View, add, update, analytics
     - analyst_user: View, analytics
     - admin_user: Full access

---

### 9.2 Check Permissions

**API Endpoint:** `GET /security/permissions`

**Complete Workflow:**

1. **Request:**
   - GET `/security/permissions`

2. **Backend Processing:**
   - Gets current user's role
   - Returns permissions for that role

3. **Frontend Display:**
   - Permission details modal
   - Shows what user can/cannot do
   - Helps understand access levels

---

### 9.3 List All Roles

**API Endpoint:** `GET /security/roles`

**Complete Workflow:**

1. **Request:**
   - GET `/security/roles`

2. **Backend Processing:**
   - Queries database roles
   - Returns list with descriptions

3. **Frontend Display:**
   - Roles list with permissions
   - Educational/informational

---

## 10. Map Visualization

### 10.1 Google Maps Integration

**Complete Workflow:**

1. **Initialization:**
   - App loads Google Maps JavaScript API
   - Creates map instance with default center and zoom
   - Sets up map container

2. **Display Places:**
   - When search results loaded:
     - Creates markers for each place
     - Adds markers to map
     - If 5+ markers, uses MarkerClusterer for clustering
     - Sets marker click handlers

3. **Marker Clustering:**
   - MarkerClusterer library groups nearby markers
   - Shows cluster with count
   - Clicking cluster zooms in and expands
   - Improves performance and UX

4. **Info Windows:**
   - Click marker → Info window opens
   - Shows place details:
     - Name
     - Address
     - Distance (if reference point set)
     - List status buttons (if logged in)
     - Place type badge

5. **Map Interactions:**
   - Pan: User can drag map
   - Zoom: User can zoom in/out
   - Click: User can click map to set reference point
   - Right-click: User can add new place at location (if permitted)

---

### 10.2 Current Location Detection

**Complete Workflow:**

1. **User Action:**
   - User clicks "📍 Use Current Location" button

2. **Frontend Processing:**
   - Requests geolocation from browser
   - Browser prompts user for permission
   - User grants permission

3. **Location Obtained:**
   - Browser returns coordinates (lat, lon)
   - Frontend fills latitude/longitude fields
   - Map centers on current location
   - Search can be executed immediately

4. **Error Handling:**
   - If permission denied: Show error message
   - If geolocation unavailable: Show fallback message
   - If timeout: Show timeout message

---

### 10.3 Map Bounds for Bounding Box Search

**Complete Workflow:**

1. **User Action:**
   - User adjusts map viewport (pan/zoom)
   - User selects "Bounding Box" search type
   - User clicks "Use Current View"

2. **Frontend Processing:**
   - Gets map bounds using Google Maps API
   - Extracts:
     - North (max latitude)
     - South (min latitude)
     - East (max longitude)
     - West (min longitude)
   - Fills bounding box input fields

3. **Search Execution:**
   - User clicks "Search Places"
   - Search uses current map bounds
   - Results displayed on map

---

### 10.4 Distance Visualization

**Complete Workflow:**

1. **User Sets Reference Point:**
   - User clicks on map
   - OR user enters coordinates
   - Reference point marked on map

2. **Distance Calculation:**
   - For each result, distance calculated
   - Distance shown in sidebar list
   - Can be sorted by distance

3. **Circle Visualization (Optional):**
   - For radius search, circle drawn on map
   - Shows search radius visually
   - Helps user understand search area

---

## Summary of All Features

### Core Features (51 API Endpoints)

1. **Spatial Search (4 endpoints):**
   - Radius search
   - Nearest K search
   - Bounding box search
   - Distance matrix

2. **User Accounts (4 endpoints):**
   - Register
   - Login
   - Get profile
   - Get statistics

3. **Personal Lists (9 endpoints):**
   - Visited list (GET, POST, DELETE)
   - Wishlist (GET, POST, DELETE)
   - Liked list (GET, POST, DELETE)
   - Get place status

4. **Groups (6 endpoints):**
   - Create group
   - Get user's groups
   - Get group details
   - Add member
   - Remove member
   - Get group places
   - Get groups for place

5. **Place Management (5 endpoints):**
   - Add place
   - Upload CSV
   - Get my added places
   - Update place
   - Delete place

6. **Analytics (3 endpoints):**
   - Database statistics
   - State analytics
   - Density analysis

7. **Export (2 endpoints):**
   - Export CSV
   - Export GeoJSON

8. **Advanced DB Features (15 endpoints):**
   - Views (3)
   - Stored functions (4)
   - Materialized views (3)
   - Query optimization (1)
   - Audit logging (2)
   - Constraints list (1)
   - Concepts summary (1)

9. **Security (3 endpoints):**
   - Role-based login
   - Check permissions
   - List roles

10. **Utility (1 endpoint):**
    - Health check

### Frontend Features

- Interactive Google Maps with marker clustering
- Search controls with multiple query types
- Results sidebar with filtering and sorting
- User authentication UI (register/login)
- Personal lists management UI
- Groups management UI
- Group places visualization
- Place addition form
- CSV upload interface
- Statistics display
- Export functionality
- Error handling and user feedback
- Responsive design
- Current location detection
- Map interactions (pan, zoom, click)

### Database Features

- 20+ normalized tables
- PostGIS spatial extension
- GIST spatial indexes
- Foreign key constraints
- Check constraints
- Unique constraints
- Triggers (geometry update, audit logging)
- Views (3)
- Materialized views (2)
- Stored functions (4)
- Role-based access control (5 roles)
- Full-text search
- Transaction management
- Audit logging

---

**Total Features:** 51 API endpoints + Extensive frontend features + Advanced database capabilities

**Status:** Complete and fully functional

**Last Updated:** December 2024

