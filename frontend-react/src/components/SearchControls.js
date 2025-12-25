import React, { useState } from 'react';

// Icon components for place types (Heroicons-style outline icons)
const BreweryIcon = ({ isActive }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#6366f1' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v6m6-6v6M5 8h14a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z" />
    <path d="M9 14h6" />
  </svg>
);

const RestaurantIcon = ({ isActive }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#6366f1' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z" />
    <path d="M21 15v7" />
  </svg>
);

const TouristPlaceIcon = ({ isActive }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#6366f1' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HotelIcon = ({ isActive }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#6366f1' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v0" />
    <path d="M9 12v0" />
    <path d="M9 15v0" />
    <path d="M9 18v0" />
  </svg>
);

// Place type configuration
const PLACE_TYPES = [
  { value: 'brewery', label: 'Brewery', Icon: BreweryIcon, color: '#8B4513', bgColor: '#F5E6D3' },
  { value: 'restaurant', label: 'Restaurant', Icon: RestaurantIcon, color: '#FF6B6B', bgColor: '#FFE5E5' },
  { value: 'tourist_place', label: 'Tourist Place', Icon: TouristPlaceIcon, color: '#4ECDC4', bgColor: '#E0F7F5' },
  { value: 'hotel', label: 'Hotel', Icon: HotelIcon, color: '#95E1D3', bgColor: '#E8F8F5' },
];

// US States with approximate center coordinates
const US_STATES = [
  { code: 'AL', name: 'Alabama', lat: 32.806671, lon: -86.791130 },
  { code: 'AK', name: 'Alaska', lat: 61.370716, lon: -152.404419 },
  { code: 'AZ', name: 'Arizona', lat: 33.729759, lon: -111.431221 },
  { code: 'AR', name: 'Arkansas', lat: 34.969704, lon: -92.373123 },
  { code: 'CA', name: 'California', lat: 36.116203, lon: -119.681564 },
  { code: 'CO', name: 'Colorado', lat: 39.059811, lon: -105.311104 },
  { code: 'CT', name: 'Connecticut', lat: 41.597782, lon: -72.755371 },
  { code: 'DE', name: 'Delaware', lat: 39.318523, lon: -75.507141 },
  { code: 'FL', name: 'Florida', lat: 27.766279, lon: -81.686783 },
  { code: 'GA', name: 'Georgia', lat: 33.040619, lon: -83.643074 },
  { code: 'HI', name: 'Hawaii', lat: 21.094318, lon: -157.498337 },
  { code: 'ID', name: 'Idaho', lat: 44.240459, lon: -114.478828 },
  { code: 'IL', name: 'Illinois', lat: 40.349457, lon: -88.986137 },
  { code: 'IN', name: 'Indiana', lat: 39.849426, lon: -86.258278 },
  { code: 'IA', name: 'Iowa', lat: 42.011539, lon: -93.210526 },
  { code: 'KS', name: 'Kansas', lat: 38.526600, lon: -96.726486 },
  { code: 'KY', name: 'Kentucky', lat: 37.668140, lon: -84.670067 },
  { code: 'LA', name: 'Louisiana', lat: 31.169546, lon: -91.867805 },
  { code: 'ME', name: 'Maine', lat: 44.323535, lon: -69.765261 },
  { code: 'MD', name: 'Maryland', lat: 39.063946, lon: -76.802101 },
  { code: 'MA', name: 'Massachusetts', lat: 42.230171, lon: -71.530106 },
  { code: 'MI', name: 'Michigan', lat: 43.326618, lon: -84.536095 },
  { code: 'MN', name: 'Minnesota', lat: 45.694454, lon: -93.900192 },
  { code: 'MS', name: 'Mississippi', lat: 32.741646, lon: -89.678696 },
  { code: 'MO', name: 'Missouri', lat: 38.456085, lon: -92.288368 },
  { code: 'MT', name: 'Montana', lat: 46.921925, lon: -110.454353 },
  { code: 'NE', name: 'Nebraska', lat: 41.125370, lon: -98.268082 },
  { code: 'NV', name: 'Nevada', lat: 38.313515, lon: -117.055374 },
  { code: 'NH', name: 'New Hampshire', lat: 43.452492, lon: -71.563896 },
  { code: 'NJ', name: 'New Jersey', lat: 40.298904, lon: -74.521011 },
  { code: 'NM', name: 'New Mexico', lat: 34.840515, lon: -106.248482 },
  { code: 'NY', name: 'New York', lat: 42.165726, lon: -74.948051 },
  { code: 'NC', name: 'North Carolina', lat: 35.630066, lon: -79.806419 },
  { code: 'ND', name: 'North Dakota', lat: 47.528912, lon: -99.784012 },
  { code: 'OH', name: 'Ohio', lat: 40.388783, lon: -82.764915 },
  { code: 'OK', name: 'Oklahoma', lat: 35.565342, lon: -96.928917 },
  { code: 'OR', name: 'Oregon', lat: 44.572021, lon: -122.070938 },
  { code: 'PA', name: 'Pennsylvania', lat: 40.590752, lon: -77.209755 },
  { code: 'RI', name: 'Rhode Island', lat: 41.680893, lon: -71.51178 },
  { code: 'SC', name: 'South Carolina', lat: 33.856892, lon: -80.945007 },
  { code: 'SD', name: 'South Dakota', lat: 44.299782, lon: -99.438828 },
  { code: 'TN', name: 'Tennessee', lat: 35.747845, lon: -86.692345 },
  { code: 'TX', name: 'Texas', lat: 31.054487, lon: -97.563461 },
  { code: 'UT', name: 'Utah', lat: 40.150032, lon: -111.862434 },
  { code: 'VT', name: 'Vermont', lat: 44.045876, lon: -72.710686 },
  { code: 'VA', name: 'Virginia', lat: 37.769337, lon: -78.169968 },
  { code: 'WA', name: 'Washington', lat: 47.400902, lon: -121.490494 },
  { code: 'WV', name: 'West Virginia', lat: 38.491226, lon: -80.954453 },
  { code: 'WI', name: 'Wisconsin', lat: 44.268543, lon: -89.616508 },
  { code: 'WY', name: 'Wyoming', lat: 42.755966, lon: -107.302490 },
];

function SearchControls({ onSearch, loading, map }) {
  const [queryType, setQueryType] = useState('radius');
  const [selectedState, setSelectedState] = useState(null);
  const [km, setKm] = useState('25');
  const [k, setK] = useState('10');
  const [placeTypeFilter, setPlaceTypeFilter] = useState([]);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Handle state selection
  const handleStateChange = (e) => {
    const stateCode = e.target.value;
    if (stateCode) {
      const state = US_STATES.find(s => s.code === stateCode);
      if (state) {
        setSelectedState(state);
        // Center map on selected state
        if (map && typeof map.setCenter === 'function') {
          try {
            map.setCenter({ lat: state.lat, lng: state.lon });
            map.setZoom(7);
          } catch (mapError) {
            console.warn('Could not center map:', mapError);
          }
        }
      }
    } else {
      setSelectedState(null);
    }
  };

  const clearLocation = () => {
    setSelectedState(null);
  };

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not available in your browser');
      return;
    }

    setGettingLocation(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      // Find the closest state to user's location
      let closestState = null;
      let minDistance = Infinity;
      
      US_STATES.forEach(state => {
        const distance = Math.sqrt(
          Math.pow(lat - state.lat, 2) + Math.pow(lon - state.lon, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestState = state;
        }
      });
      
      if (closestState) {
        setSelectedState(closestState);
        // Center map on user's location
        if (map && typeof map.setCenter === 'function') {
          try {
            map.setCenter({ lat, lng: lon });
            map.setZoom(10);
          } catch (mapError) {
            console.warn('Could not center map:', mapError);
          }
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Failed to get your location. Please try again or select a state.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!selectedState) {
      alert('Please select a state first');
      return;
    }

    const searchParams = {
      type: queryType,
      lat: selectedState.lat,
      lon: selectedState.lon,
      state: selectedState.name, // Send state name to backend for filtering
      ...(queryType === 'radius' ? { km: parseFloat(km) || 25 } : { k: parseInt(k) || 10 }),
      ...(placeTypeFilter.length > 0 && { place_type: placeTypeFilter[0] }),
    };

    onSearch(searchParams);
  };

  const togglePlaceType = (type) => {
    setPlaceTypeFilter(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [type]
    );
  };

  const hasLocation = !!selectedState;

  return (
    <div className="controls">
      <h3 style={{ 
        marginBottom: '24px',
        fontSize: '1.75rem',
        fontWeight: '800',
        color: '#1f2937',
        letterSpacing: '-0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ color: '#1f2937' }}>Find Places</span>
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Location Selection - Primary Action */}
        <div className="form-group" style={{ 
          marginBottom: '32px',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 16px rgba(31, 38, 135, 0.12)'
        }}>
          <label style={{ 
            fontSize: '0.9375rem', 
            fontWeight: '600', 
            color: '#1f2937',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.125rem' }}>📍</span>
            <span style={{ color: '#1f2937' }}>Where to search?</span>
          </label>

          {/* Use My Location Button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={gettingLocation}
            style={{
              width: '100%',
              padding: '14px 18px',
              fontSize: '0.9375rem',
              fontWeight: '800',
              background: gettingLocation 
                ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: gettingLocation ? 'not-allowed' : 'pointer',
              boxShadow: gettingLocation 
                ? 'none' 
                : '0 4px 12px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onMouseEnter={(e) => {
              if (!gettingLocation) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!gettingLocation) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
              }
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>
              {gettingLocation ? '⏳' : '📍'}
            </span>
            <span>{gettingLocation ? 'Getting Location...' : 'Use My Location'}</span>
          </button>

          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '20px 0',
            gap: '12px'
          }}>
            <div style={{
              flex: 1,
              height: '1px',
              background: 'rgba(0, 0, 0, 0.1)'
            }}></div>
            <span style={{
              fontSize: '0.8125rem',
              fontWeight: '600',
              color: '#6b7280',
              padding: '0 8px'
            }}>OR</span>
            <div style={{
              flex: 1,
              height: '1px',
              background: 'rgba(0, 0, 0, 0.1)'
            }}></div>
          </div>

          {/* State Selection Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedState?.code || ''}
              onChange={handleStateChange}
              style={{
                width: '100%',
                padding: '14px 16px',
                paddingRight: hasLocation ? '50px' : '16px',
                fontSize: '0.9375rem',
                fontWeight: '600',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: '#1f2937',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: hasLocation 
                  ? 'none'
                  : 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236366f1\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(99, 102, 241, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                e.target.style.background = 'rgba(255, 255, 255, 0.7)';
                e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
            >
              <option value="">Select a state...</option>
              {US_STATES.map(state => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
            {hasLocation && (
        <button
          type="button"
                onClick={clearLocation}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: '700',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#dc2626';
                  e.target.style.transform = 'translateY(-50%) scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ef4444';
                  e.target.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                ✕
        </button>
            )}
          </div>

          {/* Selected State Info */}
          {hasLocation && selectedState && (
            <div style={{
              padding: '16px 18px',
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '12px',
              marginTop: '16px',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              fontSize: '0.875rem',
              fontWeight: '600',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: 'white',
                  fontWeight: '800',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
                }}>
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: '800', 
                    color: '#000000',
                    fontSize: '1rem',
                    marginBottom: '4px',
                    lineHeight: '1.4'
                  }}>
                    {selectedState.name}
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem', 
                    color: '#000000',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '600'
                  }}>
                    {selectedState.lat.toFixed(4)}, {selectedState.lon.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Type Toggle */}
        <div className="form-group" style={{ marginBottom: '32px' }}>
          <label style={{ 
            fontSize: '0.9375rem', 
            fontWeight: '600', 
            color: '#1f2937',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.125rem' }}>🔎</span>
            <span style={{ color: '#1f2937' }}>Search type</span>
          </label>
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}>
        <button
          type="button"
              onClick={() => setQueryType('radius')}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: '800',
                background: queryType === 'radius' 
                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)' 
                  : 'transparent',
                color: queryType === 'radius' ? 'white' : '#000000',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: queryType === 'radius' ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none'
              }}
            >
              Within Radius
        </button>
        <button
          type="button"
              onClick={() => setQueryType('nearest')}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: '800',
                background: queryType === 'nearest' 
                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)' 
                  : 'transparent',
                color: queryType === 'nearest' ? 'white' : '#000000',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: queryType === 'nearest' ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none'
              }}
            >
              Nearest Places
        </button>
      </div>
            </div>

        {/* Search Radius or Number of Results */}
        {queryType === 'radius' ? (
          <div className="form-group" style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ 
                fontSize: '0.9375rem', 
                fontWeight: '600', 
                color: '#1f2937'
              }}>
                Search radius
              </span>
              <span style={{ 
                fontSize: '0.8125rem', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                (km)
              </span>
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <input
                type="range"
                min="1"
                max="100"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                style={{ 
                  flex: 1,
                  height: '8px',
                  borderRadius: '4px',
                  background: '#e5e7eb',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <input
                type="number"
                min="1"
                max="100"
                value={km}
                onChange={(e) => {
                  const val = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                  setKm(val.toString());
                }}
                style={{ 
                  width: '70px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '0.9375rem',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#1f2937',
                  marginTop: '0'
                }}
              />
            </div>
            <div style={{ 
              fontSize: '0.8125rem', 
              color: '#6b7280', 
              marginTop: '10px',
              textAlign: 'center',
              fontWeight: '500',
              background: 'rgba(99, 102, 241, 0.08)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              boxShadow: 'none'
            }}>
              {km} km radius • ~{Math.round(parseFloat(km) * 0.621371)} miles
            </div>
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: '32px' }}>
            <label style={{
              fontSize: '0.9375rem', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '12px',
              display: 'block'
            }}>
              Number of results
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <input
                type="range"
                min="1"
                max="50"
                value={k}
                onChange={(e) => setK(e.target.value)}
                style={{ 
                  flex: 1,
                  height: '8px',
                  borderRadius: '4px',
                  background: '#e5e7eb',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <input
                type="number"
                min="1"
                max="100"
                value={k}
                onChange={(e) => {
                  const val = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                  setK(val.toString());
                }}
                style={{ 
                  width: '70px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '0.9375rem',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#1f2937',
                  marginTop: '0'
                }}
              />
            </div>
            <div style={{ 
              fontSize: '0.8125rem', 
              color: '#6b7280', 
              marginTop: '10px',
              textAlign: 'center',
              fontWeight: '500',
              background: 'rgba(99, 102, 241, 0.08)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              boxShadow: 'none'
            }}>
              Show {k} nearest {parseInt(k) === 1 ? 'place' : 'places'}
            </div>
            </div>
        )}

        {/* Place Type Filters - Optional */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label style={{ 
            fontSize: '0.9375rem', 
            fontWeight: '600', 
            color: '#1f2937',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.125rem' }}>🏷️</span>
            <span style={{ color: '#1f2937' }}>Filter by type</span>
            <span style={{ 
              fontSize: '0.8125rem', 
              fontWeight: '500',
              color: '#6b7280',
              marginLeft: '4px'
            }}>
              (optional)
            </span>
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '10px'
          }}>
            {PLACE_TYPES.map(type => {
              const isSelected = placeTypeFilter.includes(type.value);
              const IconComponent = type.Icon;
              
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => togglePlaceType(type.value)}
                  style={{
                    padding: '14px 12px',
                    background: isSelected 
                      ? `rgba(255, 255, 255, 0.8)` 
                      : 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: `1px solid ${isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.4)'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isSelected 
                      ? '0 4px 16px rgba(99, 102, 241, 0.2)' 
                      : '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.7)';
                      e.target.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.5)';
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                    }
                  }}
                >
                  <IconComponent isActive={isSelected} />
                  <span style={{ 
                    fontSize: '0.875rem',
                    textAlign: 'center',
                    lineHeight: '1.3',
                    fontWeight: isSelected ? '600' : '500',
                    color: isSelected ? '#6366f1' : '#6b7280',
                    transition: 'all 0.2s ease'
                  }}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Search Button */}
            <button
          type="submit" 
          disabled={loading || !hasLocation}
              style={{
            width: '100%',
            padding: '18px',
            fontSize: '1rem',
            fontWeight: '800',
            background: (!hasLocation || loading) 
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
                border: 'none',
            borderRadius: '14px',
            cursor: (!hasLocation || loading) ? 'not-allowed' : 'pointer',
            boxShadow: (!hasLocation || loading) 
              ? 'none' 
              : '0 6px 20px rgba(99, 102, 241, 0.5)',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
                marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (hasLocation && !loading) {
              e.target.style.transform = 'translateY(-3px)';
              e.target.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasLocation && !loading) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
            }
          }}
        >
          {loading ? (
            <>
              <span style={{ fontSize: '1.25rem', animation: 'pulse 1.5s ease-in-out infinite' }}>⏳</span>
              <span style={{ fontWeight: '800', fontSize: '1rem', color: 'white' }}>Searching...</span>
            </>
          ) : hasLocation ? (
            <>
              <span style={{ fontSize: '1.25rem' }}>🔍</span>
              <span style={{ fontWeight: '800', fontSize: '1rem', color: 'white' }}>Search Places</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.25rem' }}>📍</span>
              <span style={{ fontWeight: '800', fontSize: '1rem', color: 'white' }}>Select Location First</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default SearchControls;
