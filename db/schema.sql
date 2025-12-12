-- Geospatial Web Application - Database Schema
-- Course: CSCI 765 – Intro to Database Systems
-- Project: Geospatial Web Application
-- Student: Yethin Chandra Sai Mannem
-- Date: 2024
--
-- Description:
--   This schema defines the database structure for storing geospatial data
--   (brewery locations) with PostGIS extension for spatial operations.
--
-- Table: places
--   Stores point of interest (brewery) data with geographic coordinates
--   and PostGIS geometry column for spatial queries.
--
-- Index: idx_places_geom
--   GIST (Generalized Search Tree) spatial index for fast spatial queries

-- Enable PostGIS extension (run this first if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Stores POI (points of interest) with geometry indexed for fast spatial queries
CREATE TABLE IF NOT EXISTS places (
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

-- Spatial index for fast spatial queries
-- GIST index enables O(log n) query time for spatial operations
CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);