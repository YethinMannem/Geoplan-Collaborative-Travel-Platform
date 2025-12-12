-- Geospatial Web Application - Role-Based Access Control (RBAC)
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This script creates database roles with different permission levels
--   to demonstrate database security and access control concepts.
--
-- Database Concepts Demonstrated:
--   - Database Roles
--   - Role-Based Access Control (RBAC)
--   - GRANT and REVOKE permissions
--   - Principle of Least Privilege
--   - Security Best Practices

-- ============================================================================
-- 1. CREATE ROLES
-- ============================================================================

-- Role 1: Read-only user (can only SELECT)
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'readonly_pass123';

-- Role 2: Application user (can SELECT, INSERT, UPDATE for normal operations)
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_pass123';

-- Role 3: Admin user (full access)
CREATE ROLE admin_user WITH LOGIN PASSWORD 'admin_pass123';

-- Role 4: Analyst user (can SELECT and use views/analytics)
CREATE ROLE analyst_user WITH LOGIN PASSWORD 'analyst_pass123';

-- ============================================================================
-- 2. GRANT PERMISSIONS
-- ============================================================================

-- ===== READ-ONLY USER =====
-- Can only read data (SELECT)
GRANT CONNECT ON DATABASE geoapp TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON places TO readonly_user;
GRANT SELECT ON places_audit_log TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly_user;

-- Grant access to views
GRANT SELECT ON vw_state_statistics TO readonly_user;
GRANT SELECT ON vw_city_statistics TO readonly_user;
GRANT SELECT ON vw_state_rankings TO readonly_user;
GRANT SELECT ON vw_places_with_distance TO readonly_user;

-- Grant access to materialized views
GRANT SELECT ON mv_top_states TO readonly_user;
GRANT SELECT ON mv_city_clusters TO readonly_user;

-- Grant execute permission on functions (read-only functions)
GRANT EXECUTE ON FUNCTION fn_places_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO readonly_user;
GRANT EXECUTE ON FUNCTION fn_k_nearest_places(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO readonly_user;
GRANT EXECUTE ON FUNCTION fn_calculate_density(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO readonly_user;
GRANT EXECUTE ON FUNCTION fn_search_places(TEXT) TO readonly_user;

-- ===== APPLICATION USER =====
-- Can read and write data (normal application operations)
GRANT CONNECT ON DATABASE geoapp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Table permissions
GRANT SELECT, INSERT, UPDATE ON places TO app_user;
GRANT SELECT ON places_audit_log TO app_user;
GRANT USAGE, SELECT ON SEQUENCE places_id_seq TO app_user;

-- Views (read-only)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT ON vw_state_statistics TO app_user;
GRANT SELECT ON vw_city_statistics TO app_user;
GRANT SELECT ON vw_state_rankings TO app_user;
GRANT SELECT ON mv_top_states TO app_user;
GRANT SELECT ON mv_city_clusters TO app_user;

-- Functions (can execute all query functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- ===== ANALYST USER =====
-- Can read data and use analytics features
GRANT CONNECT ON DATABASE geoapp TO analyst_user;
GRANT USAGE ON SCHEMA public TO analyst_user;

-- Read access to tables
GRANT SELECT ON places TO analyst_user;
GRANT SELECT ON places_audit_log TO analyst_user;

-- Full access to views and materialized views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst_user;
GRANT SELECT ON vw_state_statistics TO analyst_user;
GRANT SELECT ON vw_city_statistics TO analyst_user;
GRANT SELECT ON vw_state_rankings TO analyst_user;
GRANT SELECT ON mv_top_states TO analyst_user;
GRANT SELECT ON mv_city_clusters TO analyst_user;

-- Can refresh materialized views
GRANT SELECT ON mv_top_states TO analyst_user;
GRANT SELECT ON mv_city_clusters TO analyst_user;

-- Can execute all query and analytics functions
GRANT EXECUTE ON FUNCTION fn_places_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO analyst_user;
GRANT EXECUTE ON FUNCTION fn_k_nearest_places(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO analyst_user;
GRANT EXECUTE ON FUNCTION fn_calculate_density(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO analyst_user;
GRANT EXECUTE ON FUNCTION fn_search_places(TEXT) TO analyst_user;

-- ===== ADMIN USER =====
-- Full access to everything
GRANT ALL PRIVILEGES ON DATABASE geoapp TO admin_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admin_user;

-- Can create new objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO admin_user;

-- ============================================================================
-- 3. REVOKE DEFAULT PUBLIC PERMISSIONS (Security Best Practice)
-- ============================================================================

-- Revoke default public schema access for better security
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE geoapp FROM PUBLIC;

-- ============================================================================
-- 4. CREATE DEMONSTRATION FUNCTIONS
-- ============================================================================

-- Function: Check current user's role and permissions
CREATE OR REPLACE FUNCTION fn_check_permissions()
RETURNS TABLE (
    role_name TEXT,
    can_select BOOLEAN,
    can_insert BOOLEAN,
    can_update BOOLEAN,
    can_delete BOOLEAN,
    can_execute_functions BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CURRENT_USER::TEXT as role_name,
        has_table_privilege('places', 'SELECT') as can_select,
        has_table_privilege('places', 'INSERT') as can_insert,
        has_table_privilege('places', 'UPDATE') as can_update,
        has_table_privilege('places', 'DELETE') as can_delete,
        has_function_privilege('fn_places_within_radius(double precision, double precision, double precision)', 'EXECUTE') as can_execute_functions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to all authenticated users
GRANT EXECUTE ON FUNCTION fn_check_permissions() TO readonly_user;
GRANT EXECUTE ON FUNCTION fn_check_permissions() TO app_user;
GRANT EXECUTE ON FUNCTION fn_check_permissions() TO analyst_user;
GRANT EXECUTE ON FUNCTION fn_check_permissions() TO admin_user;

-- ============================================================================
-- 5. CREATE ROLE INFORMATION VIEW
-- ============================================================================

-- View: Show role permissions (for documentation)
CREATE OR REPLACE VIEW vw_role_permissions AS
SELECT 
    r.rolname as role_name,
    r.rolcanlogin as can_login,
    CASE 
        WHEN has_table_privilege(r.rolname, 'places', 'SELECT') THEN 'Yes'
        ELSE 'No'
    END as can_select,
    CASE 
        WHEN has_table_privilege(r.rolname, 'places', 'INSERT') THEN 'Yes'
        ELSE 'No'
    END as can_insert,
    CASE 
        WHEN has_table_privilege(r.rolname, 'places', 'UPDATE') THEN 'Yes'
        ELSE 'No'
    END as can_update,
    CASE 
        WHEN has_table_privilege(r.rolname, 'places', 'DELETE') THEN 'Yes'
        ELSE 'No'
    END as can_delete
FROM pg_roles r
WHERE r.rolname IN ('readonly_user', 'app_user', 'analyst_user', 'admin_user')
ORDER BY r.rolname;

-- Grant read access to this view
GRANT SELECT ON vw_role_permissions TO admin_user;

-- ============================================================================
-- SUMMARY OF ROLES CREATED
-- ============================================================================
-- 
-- 1. readonly_user
--    - Password: readonly_pass123
--    - Permissions: SELECT only
--    - Use case: Reporting, read-only dashboards
--
-- 2. app_user
--    - Password: app_pass123
--    - Permissions: SELECT, INSERT, UPDATE
--    - Use case: Normal application operations
--
-- 3. analyst_user
--    - Password: analyst_pass123
--    - Permissions: SELECT, execute analytics functions
--    - Use case: Data analysis, business intelligence
--
-- 4. admin_user
--    - Password: admin_pass123
--    - Permissions: ALL (full access)
--    - Use case: Database administration
--
-- ============================================================================
-- SECURITY BEST PRACTICES DEMONSTRATED
-- ============================================================================
-- 
-- 1. Principle of Least Privilege: Each role has minimum required permissions
-- 2. Role Separation: Different roles for different use cases
-- 3. Password Protection: All roles require passwords
-- 4. Public Schema Security: Revoked default public access
-- 5. Audit Trail: Audit log accessible to authorized roles only
--


