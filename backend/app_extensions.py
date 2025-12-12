"""
Geospatial Web Application - Flask API Extensions

Additional endpoints demonstrating advanced database concepts:
- Database Views
- Stored Functions
- Materialized Views
- Full-Text Search
- Query Optimization (EXPLAIN ANALYZE)
- Audit Logging
"""

from flask import request, jsonify
from app import app, get_conn
import json

# ============================================================================
# ENDPOINTS USING DATABASE VIEWS
# ============================================================================

@app.get("/views/state-statistics")
def view_state_statistics():
    """Get state statistics using database view."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM vw_state_statistics LIMIT 50;")
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                states = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "view_name": "vw_state_statistics",
            "concept": "Database Views",
            "description": "This endpoint uses a database view to retrieve aggregated state statistics",
            "states": states,
            "count": len(states)
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch state statistics", "details": str(e)}), 500

@app.get("/views/city-statistics")
def view_city_statistics():
    """Get city statistics using database view."""
    state_filter = request.args.get("state")
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if state_filter:
                    cur.execute(
                        "SELECT * FROM vw_city_statistics WHERE state ILIKE %s ORDER BY brewery_count DESC LIMIT 50;",
                        (f"%{state_filter}%",)
                    )
                else:
                    cur.execute("SELECT * FROM vw_city_statistics LIMIT 50;")
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                cities = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "view_name": "vw_city_statistics",
            "concept": "Database Views",
            "description": "This endpoint uses a database view to retrieve aggregated city statistics",
            "cities": cities,
            "count": len(cities)
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch city statistics", "details": str(e)}), 500

@app.get("/views/state-rankings")
def view_state_rankings():
    """Get state rankings using view with window functions."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM vw_state_rankings LIMIT 20;")
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                rankings = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "view_name": "vw_state_rankings",
            "concept": "Database Views with Window Functions",
            "description": "This endpoint demonstrates window functions (ROW_NUMBER, RANK, DENSE_RANK, PERCENT_RANK)",
            "rankings": rankings,
            "count": len(rankings)
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch state rankings", "details": str(e)}), 500

# ============================================================================
# ENDPOINTS USING STORED FUNCTIONS
# ============================================================================

@app.get("/functions/within-radius")
def function_within_radius():
    """Find places within radius using stored function."""
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
        km = float(request.args.get("km", 10))
    except (TypeError, ValueError):
        return jsonify({"error": "lat, lon, and km must be numbers"}), 400
    
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM fn_places_within_radius(%s, %s, %s);",
                    (lat, lon, km)
                )
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                places = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "function_name": "fn_places_within_radius",
            "concept": "Stored Functions",
            "description": "This endpoint uses a stored PostgreSQL function for reusable spatial queries",
            "features": places,
            "count": len(places)
        })
    except Exception as e:
        return jsonify({"error": "Failed to execute function", "details": str(e)}), 500

@app.get("/functions/k-nearest")
def function_k_nearest():
    """Find K nearest places using stored function."""
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
        k = int(request.args.get("k", 10))
    except (TypeError, ValueError):
        return jsonify({"error": "lat, lon, and k must be numbers"}), 400
    
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM fn_k_nearest_places(%s, %s, %s);",
                    (lat, lon, k)
                )
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                places = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "function_name": "fn_k_nearest_places",
            "concept": "Stored Functions",
            "description": "This endpoint uses a stored function with KNN (K-Nearest Neighbor) query",
            "features": places,
            "count": len(places)
        })
    except Exception as e:
        return jsonify({"error": "Failed to execute function", "details": str(e)}), 500

@app.get("/functions/density")
def function_density():
    """Calculate density using stored function."""
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
        radius = float(request.args.get("radius", 100))
    except (TypeError, ValueError):
        return jsonify({"error": "lat, lon, and radius must be numbers"}), 400
    
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM fn_calculate_density(%s, %s, %s);",
                    (lat, lon, radius)
                )
                columns = [desc[0] for desc in cur.description]
                row = cur.fetchone()
                if row:
                    result = dict(zip(columns, row))
                else:
                    result = {}
        return jsonify({
            "function_name": "fn_calculate_density",
            "concept": "Stored Functions",
            "description": "This endpoint uses a stored function to calculate spatial density metrics",
            "result": result
        })
    except Exception as e:
        return jsonify({"error": "Failed to calculate density", "details": str(e)}), 500

@app.get("/functions/search")
def function_search():
    """Search places using full-text search stored function."""
    search_term = request.args.get("q")
    if not search_term:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM fn_search_places(%s);",
                    (search_term,)
                )
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                places = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "function_name": "fn_search_places",
            "concept": "Stored Functions with Full-Text Search",
            "description": "This endpoint uses a stored function with PostgreSQL full-text search capabilities",
            "search_term": search_term,
            "features": places,
            "count": len(places)
        })
    except Exception as e:
        return jsonify({"error": "Search failed", "details": str(e)}), 500

# ============================================================================
# ENDPOINTS USING MATERIALIZED VIEWS
# ============================================================================

@app.get("/materialized-views/top-states")
def materialized_top_states():
    """Get top states from materialized view."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM mv_top_states;")
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                states = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "materialized_view": "mv_top_states",
            "concept": "Materialized Views",
            "description": "This endpoint uses a materialized view for fast access to pre-computed results",
            "states": states,
            "count": len(states),
            "note": "Refresh materialized view with: REFRESH MATERIALIZED VIEW mv_top_states;"
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch top states", "details": str(e)}), 500

@app.get("/materialized-views/city-clusters")
def materialized_city_clusters():
    """Get city clusters from materialized view."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        city,
                        state,
                        brewery_count,
                        ST_X(centroid) as centroid_lon,
                        ST_Y(centroid) as centroid_lat
                    FROM mv_city_clusters
                    ORDER BY brewery_count DESC
                    LIMIT 20;
                """)
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                clusters = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "materialized_view": "mv_city_clusters",
            "concept": "Materialized Views with Spatial Aggregations",
            "description": "This endpoint uses a materialized view with spatial aggregations (ST_Collect, ST_Centroid)",
            "clusters": clusters,
            "count": len(clusters)
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch city clusters", "details": str(e)}), 500

@app.post("/materialized-views/refresh")
def refresh_materialized_views():
    """Refresh all materialized views."""
    view_name = request.args.get("view")
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if view_name:
                    cur.execute(f"REFRESH MATERIALIZED VIEW {view_name};")
                    refreshed = [view_name]
                else:
                    cur.execute("REFRESH MATERIALIZED VIEW mv_top_states;")
                    cur.execute("REFRESH MATERIALIZED VIEW mv_city_clusters;")
                    refreshed = ["mv_top_states", "mv_city_clusters"]
                conn.commit()
        return jsonify({
            "concept": "Materialized View Refresh",
            "description": "Materialized views cache query results and need to be refreshed when data changes",
            "refreshed_views": refreshed,
            "status": "success"
        })
    except Exception as e:
        return jsonify({"error": "Failed to refresh materialized views", "details": str(e)}), 500

# ============================================================================
# QUERY OPTIMIZATION ENDPOINTS
# ============================================================================

@app.get("/optimization/explain")
def explain_query():
    """Get EXPLAIN ANALYZE output for a query."""
    query_type = request.args.get("type", "radius")
    
    queries = {
        "radius": """
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM places
            WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint(-95.3698, 29.7604), 4326)::geography,
                25000
            )
            LIMIT 100;
        """,
        "nearest": """
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM places
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(-95.3698, 29.7604), 4326)
            LIMIT 10;
        """,
        "bbox": """
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM places
            WHERE geom && ST_MakeEnvelope(-95.5, 29.5, -95.0, 30.0, 4326)
            LIMIT 100;
        """,
        "state": """
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM places
            WHERE state = 'Texas'
            LIMIT 100;
        """
    }
    
    if query_type not in queries:
        return jsonify({"error": f"Unknown query type: {query_type}"}), 400
    
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(queries[query_type])
                result = cur.fetchone()[0][0]  # EXPLAIN returns JSON array
        return jsonify({
            "concept": "Query Optimization with EXPLAIN ANALYZE",
            "description": "This endpoint demonstrates query plan analysis for performance optimization",
            "query_type": query_type,
            "explain_plan": result
        })
    except Exception as e:
        return jsonify({"error": "Failed to explain query", "details": str(e)}), 500

# ============================================================================
# AUDIT LOGGING ENDPOINTS
# ============================================================================

@app.get("/audit/log")
def audit_log():
    """Get audit log entries."""
    place_id = request.args.get("place_id", type=int)
    limit = request.args.get("limit", 50, type=int)
    
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if place_id:
                    cur.execute("""
                        SELECT * FROM places_audit_log
                        WHERE place_id = %s
                        ORDER BY changed_at DESC
                        LIMIT %s;
                    """, (place_id, limit))
                else:
                    cur.execute("""
                        SELECT * FROM places_audit_log
                        ORDER BY changed_at DESC
                        LIMIT %s;
                    """, (limit,))
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                logs = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "concept": "Audit Logging with Triggers",
            "description": "This endpoint shows audit logs automatically created by database triggers",
            "logs": logs,
            "count": len(logs)
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch audit log", "details": str(e)}), 500

@app.get("/audit/stats")
def audit_stats():
    """Get audit log statistics."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        action,
                        COUNT(*) as count,
                        MIN(changed_at) as first_action,
                        MAX(changed_at) as last_action
                    FROM places_audit_log
                    GROUP BY action
                    ORDER BY count DESC;
                """)
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                stats = [dict(zip(columns, row)) for row in rows]
                
                cur.execute("SELECT COUNT(*) FROM places_audit_log;")
                total = cur.fetchone()[0]
        return jsonify({
            "concept": "Audit Log Statistics",
            "description": "Statistics about database changes tracked by triggers",
            "statistics": stats,
            "total_audit_entries": total
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch audit stats", "details": str(e)}), 500

# ============================================================================
# DATABASE CONCEPTS SUMMARY ENDPOINT
# ============================================================================

@app.get("/concepts/summary")
def concepts_summary():
    """Get summary of all database concepts implemented."""
    return jsonify({
        "project": "Geospatial Web Application",
        "database_concepts": [
            {
                "concept": "Database Views",
                "description": "Virtual tables that represent stored queries",
                "examples": [
                    "vw_state_statistics",
                    "vw_city_statistics",
                    "vw_state_rankings"
                ],
                "endpoints": [
                    "/views/state-statistics",
                    "/views/city-statistics",
                    "/views/state-rankings"
                ]
            },
            {
                "concept": "Stored Functions",
                "description": "Reusable SQL functions that encapsulate business logic",
                "examples": [
                    "fn_places_within_radius",
                    "fn_k_nearest_places",
                    "fn_calculate_density",
                    "fn_search_places"
                ],
                "endpoints": [
                    "/functions/within-radius",
                    "/functions/k-nearest",
                    "/functions/density",
                    "/functions/search"
                ]
            },
            {
                "concept": "Materialized Views",
                "description": "Cached query results stored as physical tables",
                "examples": [
                    "mv_top_states",
                    "mv_city_clusters"
                ],
                "endpoints": [
                    "/materialized-views/top-states",
                    "/materialized-views/city-clusters",
                    "/materialized-views/refresh"
                ]
            },
            {
                "concept": "Indexes",
                "description": "Data structures that speed up queries",
                "types": [
                    "GIST (spatial index on geom)",
                    "B-tree (on state, city, name)",
                    "GIN (full-text search)",
                    "Unique (on source_id)"
                ]
            },
            {
                "concept": "Constraints",
                "description": "Rules that enforce data integrity",
                "examples": [
                    "Check constraints on lat/lon ranges",
                    "Unique constraint on source_id"
                ]
            },
            {
                "concept": "Triggers",
                "description": "Automated actions that execute on data changes",
                "examples": [
                    "trg_update_geometry (updates geom when lat/lon changes)",
                    "trg_audit_places (logs all changes)"
                ],
                "endpoints": [
                    "/audit/log",
                    "/audit/stats"
                ]
            },
            {
                "concept": "Full-Text Search",
                "description": "Advanced text search using GIN indexes",
                "implementation": "PostgreSQL to_tsvector and to_tsquery",
                "endpoint": "/functions/search"
            },
            {
                "concept": "Query Optimization",
                "description": "Analyzing query plans with EXPLAIN ANALYZE",
                "endpoint": "/optimization/explain"
            },
            {
                "concept": "Role-Based Access Control (RBAC)",
                "description": "Database roles with different permission levels for security",
                "examples": [
                    "readonly_user (SELECT only)",
                    "app_user (SELECT, INSERT, UPDATE)",
                    "analyst_user (SELECT + analytics)",
                    "admin_user (Full access)"
                ],
                "endpoints": [
                    "/security/permissions",
                    "/security/roles"
                ]
            }
        ],
        "total_concepts": 9,
        "total_new_endpoints": 17
    })

# ============================================================================
# ROLE-BASED ACCESS CONTROL ENDPOINTS
# ============================================================================

@app.get("/security/permissions")
def security_permissions():
    """Check current database user's permissions."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get current user
                cur.execute("SELECT CURRENT_USER, session_user;")
                current_user, session_user = cur.fetchone()
                
                # Check permissions directly
                cur.execute("""
                    SELECT 
                        CURRENT_USER::TEXT as role_name,
                        has_table_privilege('places', 'SELECT') as can_select,
                        has_table_privilege('places', 'INSERT') as can_insert,
                        has_table_privilege('places', 'UPDATE') as can_update,
                        has_table_privilege('places', 'DELETE') as can_delete,
                        has_function_privilege('fn_places_within_radius(double precision, double precision, double precision)', 'EXECUTE') as can_execute_functions;
                """)
                columns = [desc[0] for desc in cur.description]
                perm_row = cur.fetchone()
                permissions = dict(zip(columns, perm_row)) if perm_row else {}
                
                # Get role information
                cur.execute("""
                    SELECT 
                        rolname,
                        rolcanlogin,
                        rolcreaterole,
                        rolcreatedb
                    FROM pg_roles
                    WHERE rolname = CURRENT_USER;
                """)
                role_info = cur.fetchone()
                role_data = {
                    "role_name": role_info[0] if role_info else None,
                    "can_login": role_info[1] if role_info else False,
                    "can_create_roles": role_info[2] if role_info else False,
                    "can_create_databases": role_info[3] if role_info else False
                } if role_info else {}
        return jsonify({
            "concept": "Role-Based Access Control",
            "description": "This endpoint shows the current database user's role and permissions",
            "current_user": current_user,
            "session_user": session_user,
            "permissions": permissions,
            "role_info": role_data
        })
    except Exception as e:
        return jsonify({"error": "Failed to check permissions", "details": str(e)}), 500

@app.get("/constraints/list")
def constraints_list():
    """Get list of all database constraints."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get check constraints
                cur.execute("""
                    SELECT 
                        conname as constraint_name,
                        pg_get_constraintdef(oid) as constraint_definition,
                        conrelid::regclass::text as table_name
                    FROM pg_constraint
                    WHERE contype = 'c'
                    AND conrelid = 'places'::regclass
                    ORDER BY conname;
                """)
                check_constraints = [
                    {
                        "name": row[0],
                        "definition": row[1],
                        "table": row[2]
                    }
                    for row in cur.fetchall()
                ]
                
                # Get unique constraints (including unique indexes)
                cur.execute("""
                    SELECT 
                        conname as constraint_name,
                        pg_get_constraintdef(oid) as constraint_definition,
                        conrelid::regclass::text as table_name
                    FROM pg_constraint
                    WHERE contype = 'u'
                    AND conrelid = 'places'::regclass
                    ORDER BY conname;
                """)
                unique_constraints = [
                    {
                        "name": row[0],
                        "definition": row[1],
                        "table": row[2]
                    }
                    for row in cur.fetchall()
                ]
                
                # Also check for unique indexes (which act as constraints)
                cur.execute("""
                    SELECT 
                        indexname as constraint_name,
                        indexdef as constraint_definition,
                        tablename as table_name
                    FROM pg_indexes
                    WHERE tablename = 'places'
                    AND indexdef LIKE '%UNIQUE%'
                    ORDER BY indexname;
                """)
                unique_indexes = [
                    {
                        "name": row[0],
                        "definition": row[1],
                        "table": row[2],
                        "type": "unique_index"
                    }
                    for row in cur.fetchall()
                ]
                unique_constraints.extend(unique_indexes)
                
                # Get foreign key constraints (if any)
                cur.execute("""
                    SELECT 
                        conname as constraint_name,
                        pg_get_constraintdef(oid) as constraint_definition,
                        conrelid::regclass::text as table_name,
                        confrelid::regclass::text as referenced_table
                    FROM pg_constraint
                    WHERE contype = 'f'
                    AND conrelid = 'places'::regclass
                    ORDER BY conname;
                """)
                foreign_key_constraints = [
                    {
                        "name": row[0],
                        "definition": row[1],
                        "table": row[2],
                        "referenced_table": row[3]
                    }
                    for row in cur.fetchall()
                ]
                
                # Get primary key constraint
                cur.execute("""
                    SELECT 
                        conname as constraint_name,
                        pg_get_constraintdef(oid) as constraint_definition,
                        conrelid::regclass::text as table_name
                    FROM pg_constraint
                    WHERE contype = 'p'
                    AND conrelid = 'places'::regclass
                    ORDER BY conname;
                """)
                primary_key_constraints = [
                    {
                        "name": row[0],
                        "definition": row[1],
                        "table": row[2]
                    }
                    for row in cur.fetchall()
                ]
                
        return jsonify({
            "concept": "Database Constraints",
            "description": "Rules that enforce data integrity and validity",
            "table": "places",
            "constraints": {
                "primary_key": primary_key_constraints,
                "unique": unique_constraints,
                "check": check_constraints,
                "foreign_key": foreign_key_constraints
            },
            "summary": {
                "total_constraints": len(primary_key_constraints) + len(unique_constraints) + len(check_constraints) + len(foreign_key_constraints),
                "primary_keys": len(primary_key_constraints),
                "unique": len(unique_constraints),
                "check": len(check_constraints),
                "foreign_keys": len(foreign_key_constraints)
            }
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch constraints", "details": str(e)}), 500

@app.get("/security/roles")
def security_roles():
    """List all database roles and their permissions."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        r.rolname as role_name,
                        r.rolcanlogin as can_login,
                        CASE 
                            WHEN has_table_privilege(r.rolname, 'places', 'SELECT') THEN true
                            ELSE false
                        END as can_select,
                        CASE 
                            WHEN has_table_privilege(r.rolname, 'places', 'INSERT') THEN true
                            ELSE false
                        END as can_insert,
                        CASE 
                            WHEN has_table_privilege(r.rolname, 'places', 'UPDATE') THEN true
                            ELSE false
                        END as can_update,
                        CASE 
                            WHEN has_table_privilege(r.rolname, 'places', 'DELETE') THEN true
                            ELSE false
                        END as can_delete
                    FROM pg_roles r
                    WHERE r.rolname IN ('readonly_user', 'app_user', 'analyst_user', 'admin_user')
                    ORDER BY r.rolname;
                """)
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                roles = [dict(zip(columns, row)) for row in rows]
        return jsonify({
            "concept": "Role-Based Access Control (RBAC)",
            "description": "Database roles with different permission levels for security",
            "roles": roles,
            "count": len(roles),
            "security_concepts": [
                "Principle of Least Privilege",
                "Role Separation",
                "GRANT and REVOKE permissions",
                "Database security best practices"
            ]
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch roles", "details": str(e)}), 500

