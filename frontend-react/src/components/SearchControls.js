import React, { useState } from 'react';

function SearchControls({ onSearch, onLoadStats, onLoadAnalytics, onLoadDensity, loading }) {
  const [queryType, setQueryType] = useState('radius');
  const [lat, setLat] = useState('29.7604');
  const [lon, setLon] = useState('-95.3698');
  const [km, setKm] = useState('25');
  const [k, setK] = useState('10');
  const [north, setNorth] = useState('30.0');
  const [south, setSouth] = useState('29.5');
  const [east, setEast] = useState('-95.0');
  const [west, setWest] = useState('-95.5');
  const [stateFilter, setStateFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [placeTypeFilter, setPlaceTypeFilter] = useState([]); // Array of selected place types

  const handleSubmit = (e) => {
    e.preventDefault();

    const searchParams = {
      type: queryType,
      state: stateFilter.trim() || undefined,
      name: nameFilter.trim() || undefined,
      place_type: placeTypeFilter.length > 0 ? placeTypeFilter.join(',') : undefined,
    };

    if (queryType === 'radius') {
      const latVal = parseFloat(lat);
      const lonVal = parseFloat(lon);
      const kmVal = parseFloat(km);
      
      if (isNaN(latVal) || isNaN(lonVal) || isNaN(kmVal)) {
        alert('Please enter valid numbers for latitude, longitude, and radius');
        return;
      }
      
      searchParams.lat = latVal;
      searchParams.lon = lonVal;
      searchParams.km = kmVal;
    } else if (queryType === 'nearest') {
      const latVal = parseFloat(lat);
      const lonVal = parseFloat(lon);
      const kVal = parseInt(k);
      
      if (isNaN(latVal) || isNaN(lonVal) || isNaN(kVal)) {
        alert('Please enter valid numbers for latitude, longitude, and K');
        return;
      }
      
      searchParams.lat = latVal;
      searchParams.lon = lonVal;
      searchParams.k = kVal;
    } else if (queryType === 'bbox') {
      const northVal = parseFloat(north);
      const southVal = parseFloat(south);
      const eastVal = parseFloat(east);
      const westVal = parseFloat(west);
      
      if (isNaN(northVal) || isNaN(southVal) || isNaN(eastVal) || isNaN(westVal)) {
        alert('Please enter valid numbers for all bounding box coordinates');
        return;
      }
      
      searchParams.north = northVal;
      searchParams.south = southVal;
      searchParams.east = eastVal;
      searchParams.west = westVal;
    }

    // Always trigger search with new parameters
    onSearch(searchParams);
  };

  return (
    <div className="controls">
      <h3>🔍 Search Options</h3>

      <div className="query-tabs">
        <button
          type="button"
          className={queryType === 'radius' ? 'active' : ''}
          onClick={() => setQueryType('radius')}
        >
          Radius
        </button>
        <button
          type="button"
          className={queryType === 'nearest' ? 'active' : ''}
          onClick={() => setQueryType('nearest')}
        >
          Nearest K
        </button>
        <button
          type="button"
          className={queryType === 'bbox' ? 'active' : ''}
          onClick={() => setQueryType('bbox')}
        >
          Bounding Box
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {queryType === 'radius' && (
          <>
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Radius (km)</label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                required
              />
            </div>
          </>
        )}

        {queryType === 'nearest' && (
          <>
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Number of Results (K)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={k}
                onChange={(e) => setK(e.target.value)}
                required
              />
            </div>
          </>
        )}

        {queryType === 'bbox' && (
          <>
            <div className="form-group">
              <label>North</label>
              <input
                type="number"
                step="any"
                value={north}
                onChange={(e) => setNorth(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>South</label>
              <input
                type="number"
                step="any"
                value={south}
                onChange={(e) => setSouth(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>East</label>
              <input
                type="number"
                step="any"
                value={east}
                onChange={(e) => setEast(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>West</label>
              <input
                type="number"
                step="any"
                value={west}
                onChange={(e) => setWest(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label>Filter by State (optional)</label>
          <input
            type="text"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            placeholder="e.g., Texas"
          />
        </div>

        <div className="form-group">
          <label>Filter by Name (optional)</label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="e.g., Brewery"
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.95em', fontWeight: '500', color: '#333' }}>
            Place Type (optional)
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '8px', 
            marginBottom: '4px',
            width: '100%'
          }}>
            {['brewery', 'restaurant', 'tourist_place', 'hotel'].map(type => {
              const labelText = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
              const isSelected = placeTypeFilter.includes(type);
              return (
                <label
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: '500',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? '#4a90e2' : '#f0f0f0',
                    color: isSelected ? 'white' : '#333',
                    transition: 'all 0.2s',
                    border: '1px solid #ddd',
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '36px'
                  }}
                  title={labelText}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPlaceTypeFilter([...placeTypeFilter, type]);
                      } else {
                        setPlaceTypeFilter(placeTypeFilter.filter(t => t !== type));
                      }
                    }}
                    style={{ 
                      marginRight: '8px', 
                      cursor: 'pointer', 
                      flexShrink: 0,
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <span style={{ 
                    userSelect: 'none', 
                    whiteSpace: 'nowrap', 
                    overflow: 'visible', 
                    color: isSelected ? 'white' : '#333',
                    fontWeight: '500',
                    fontSize: '0.9em',
                    lineHeight: '1.2'
                  }}>{labelText}</span>
                </label>
              );
            })}
          </div>
          {placeTypeFilter.length > 0 && (
            <button
              type="button"
              onClick={() => setPlaceTypeFilter([])}
              style={{
                fontSize: '0.85em',
                fontWeight: '600',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#ff6b6b',
                color: 'white',
                cursor: 'pointer',
                marginTop: '8px',
                width: '100%'
              }}
            >
              Clear All
            </button>
          )}
          <small style={{ color: '#666', fontSize: '0.75em', display: 'block', marginTop: '4px' }}>
            Select one or more types, or leave empty to show all
          </small>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <button
        type="button"
        className="secondary"
        onClick={onLoadStats}
        style={{ marginTop: '8px' }}
      >
        Load Stats
      </button>

      <button
        type="button"
        className="orange"
        onClick={onLoadAnalytics}
        style={{ marginTop: '8px' }}
      >
        State Analytics
      </button>

      <button
        type="button"
        className="purple"
        onClick={() => onLoadDensity({ lat: parseFloat(lat) || 29.7604, lon: parseFloat(lon) || -95.3698, km: parseFloat(km) || 100 })}
        style={{ marginTop: '8px' }}
      >
        Density Analysis
      </button>
    </div>
  );
}

export default SearchControls;

