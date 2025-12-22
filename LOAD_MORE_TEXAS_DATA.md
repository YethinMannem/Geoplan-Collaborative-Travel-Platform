# Load More Texas Data

## Problem
Currently, all restaurant data in Texas is clustered around Houston (255km from the Texas center). When searching from the Texas center with a 100km radius, no results are found because all the data is in Houston.

## Solution
The ETL script has been updated to include more Texas cities:
- Dallas
- Austin  
- San Antonio
- Fort Worth
- El Paso

## How to Load More Data

Run the ETL script to load data from these additional Texas cities:

```bash
cd backend
python etl_osm_places.py
```

This will:
1. Query OpenStreetMap for restaurants, hotels, and tourist places in all cities (including the new Texas cities)
2. Insert the data into your database
3. Show progress and final counts

**Note**: The script includes rate limiting to be respectful to the Overpass API. The process may take 10-15 minutes to complete.

## Expected Results
After running the ETL script, you should have:
- Restaurants distributed across Texas (not just Houston)
- Better coverage when searching from the Texas center
- Results within 100km radius searches

## Verification
After loading, you can verify the data distribution:

```sql
SELECT city, COUNT(*) 
FROM places_with_types 
WHERE place_type = 'restaurant' 
  AND (state ILIKE '%Texas%' OR state ILIKE '%TX%')
GROUP BY city 
ORDER BY COUNT(*) DESC;
```

You should see restaurants in Dallas, Austin, San Antonio, Fort Worth, and El Paso in addition to Houston.

