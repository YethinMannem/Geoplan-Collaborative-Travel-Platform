import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, InfoWindow } from '@react-google-maps/api';
import SearchControls from './components/SearchControls';
import ResultsSidebar from './components/ResultsSidebar';
import Login from './components/Login';
import UserAuth from './components/UserAuth';
import Groups from './components/Groups';
import GroupPlaces from './components/GroupPlaces';
import { getUserProfile, getVisitedList, getWishlist, getLikedList } from './services/userListsApi';
import { searchPlaces, getStats, getStateAnalytics, getDensityAnalysis, exportData, checkPermissions, addPlace, uploadCSV, setAuthToken, getAuthToken } from './services/api';
import './App.css';

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 29.7604,
  lng: -95.3698
};

const defaultZoom = 9;

function App() {
  // Authentication state (Role-based)
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // User account state (Personal Lists)
  const [userAccount, setUserAccount] = useState(null);
  const [showUserAuth, setShowUserAuth] = useState(false);
  const [userAuthKey, setUserAuthKey] = useState(0);
  const [activeListView, setActiveListView] = useState(null); // 'visited', 'wishlist', 'liked', or null
  const [referenceLocation, setReferenceLocation] = useState(null); // {lat, lon} for distance calculation
  const [listSearchQuery, setListSearchQuery] = useState(''); // Search filter for personal lists
  const [allListResults, setAllListResults] = useState([]); // Store all results before filtering
  
  // Groups state
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  
  // User header card toggle
  const [showUserHeader, setShowUserHeader] = useState(true);

  // Sidebar toggles
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);  // Search Options
  const [showRightSidebar, setShowRightSidebar] = useState(true); // Results & Analytics

  // Group places display on map
  const [groupPlacesMode, setGroupPlacesMode] = useState(false);

  // Map and data state
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [density, setDensity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryInfo, setQueryInfo] = useState('');
  const [permissionDetails, setPermissionDetails] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationCoords, setNewLocationCoords] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocationData, setNewLocationData] = useState({ 
    name: '', 
    city: '', 
    state: '', 
    country: 'US',
    place_type: 'brewery',
    type_data: {}
  });
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [csvUploadResult, setCsvUploadResult] = useState(null);
  const fileInputRef = useRef(null);
  const clustererRef = useRef(null);
  const markerClustererLibRef = useRef(null);
  const googleMarkersRef = useRef([]);

  // Clear markers function (must be defined before useEffects that use it)
  const clearAllMarkers = React.useCallback(() => {
    // Clear all existing markers
    googleMarkersRef.current.forEach(marker => {
      if (marker) {
        marker.setMap(null);
        if (window.google && window.google.maps) {
          window.google.maps.event.clearInstanceListeners(marker);
        }
      }
    });
    googleMarkersRef.current = [];

    // Clear clusterer if it exists
    if (clustererRef.current) {
      try {
        clustererRef.current.clearMarkers();
      } catch (e) {
        console.warn('Error clearing clusterer:', e);
      }
      clustererRef.current = null;
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
    checkUserAuth();
  }, []);

  // Load stats after authentication
  useEffect(() => {
    if (authenticated) {
      loadStats();
    }
  }, [authenticated]);

  // Load MarkerClusterer library
  useEffect(() => {
    if (window.google && !markerClustererLibRef.current) {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="markerclusterer"]');
      if (existingScript) {
        if (window.markerClusterer) {
          markerClustererLibRef.current = window.markerClusterer;
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
      script.onload = () => {
        markerClustererLibRef.current = window.markerClusterer;
      };
      script.onerror = () => {
        console.warn('MarkerClusterer library failed to load');
      };
      document.head.appendChild(script);
    }
  }, []);

  // Helper function to filter list results by search query
  const filterListResults = (places, searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) {
      return places;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return places.filter(place => {
      const name = (place.name || '').toLowerCase();
      const city = (place.city || '').toLowerCase();
      const state = (place.state || '').toLowerCase();
      const country = (place.country || '').toLowerCase();
      
      return name.includes(query) || 
             city.includes(query) || 
             state.includes(query) || 
             country.includes(query);
    });
  };

  // Helper functions (defined after hooks)
  const checkAuth = async () => {
    try {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Auth-Token'] = token;
        console.log('🔑 Auth check - Token found, sending in headers');
      } else {
        console.log('⚠️ Auth check - No token found in localStorage');
      }

      const response = await fetch(`${API_BASE}/auth/check`, {
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Auth check failed: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.authenticated) {
        console.log('✅ Auth check - Authenticated as:', data.role);
        setAuthenticated(true);
        setUserRole(data.role);
        setUserPermissions(data.permissions || []);
      } else {
        console.log('❌ Auth check - Not authenticated');
        setAuthenticated(false);
        // Clear token if auth check fails
        setAuthToken(null);
      }
    } catch (err) {
      console.error('❌ Auth check error:', err);
      setAuthenticated(false);
      setAuthToken(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (loginData) => {
    setAuthenticated(true);
    setUserRole(loginData.role);
    setUserPermissions(loginData.permissions || []);
  };

  // Check user account authentication (for personal lists)
  const checkUserAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    try {
      const profile = await getUserProfile();
      setUserAccount(profile.user);
    } catch (err) {
      // Token might be expired, invalid, or for role-based auth only
      setUserAccount(null);
    }
  };

  const handleUserLoginSuccess = async (loginData) => {
    setUserAccount(loginData.user);
    setShowUserAuth(false);
    // Refresh search results to show list status
    if (results.length > 0) {
      // Re-trigger search to get list status
      // The search function will automatically include list status now
    }
  };

  const handleUserLogout = () => {
    setAuthToken(null);
    setUserAccount(null);
    setActiveListView(null);
    // Refresh results to remove list status
    if (results.length > 0) {
      setResults(results.map(r => {
        const { list_status, ...rest } = r;
        return rest;
      }));
    }
  };

  // Load and display a personal list
  const loadPersonalList = async (listType, refLat = null, refLon = null) => {
    if (!userAccount) {
      setUserAuthKey(prev => prev + 1);
      setShowUserAuth(true);
      return;
    }

    setLoading(true);
    setError(null);
    setActiveListView(listType);
    
    try {
      let response;
      if (listType === 'visited') {
        response = await getVisitedList(refLat, refLon);
      } else if (listType === 'wishlist') {
        response = await getWishlist(refLat, refLon);
      } else if (listType === 'liked') {
        response = await getLikedList(refLat, refLon);
      }

      // Extract places array from response (backend returns {success: true, places: [...], count: N})
      // Handle both response formats: {places: [...]} or direct array
      let places = [];
      if (Array.isArray(response)) {
        places = response;
      } else if (response && Array.isArray(response.places)) {
        places = response.places;
      } else if (response && response.success && Array.isArray(response.places)) {
        places = response.places;
      } else {
        console.error(`Unexpected response format for ${listType}:`, response);
        throw new Error(`Invalid response format: expected array or {places: [...]}, got ${typeof response}`);
      }

      // Format places to match search results format
      const formattedPlaces = places.map(p => ({
        id: p.id,
        name: p.name,
        city: p.city,
        state: p.state,
        country: p.country,
        lat: p.lat,
        lon: p.lon,
        distance_km: p.distance_km, // Include distance if calculated
        list_status: {
          visited: listType === 'visited',
          wishlist: listType === 'wishlist',
          liked: listType === 'liked'
        }
      }));
      
      // Store reference location if used
      if (refLat !== null && refLon !== null) {
        setReferenceLocation({ lat: refLat, lon: refLon });
      }

      // Store all results and apply current search filter
      setAllListResults(formattedPlaces);
      const filteredPlaces = filterListResults(formattedPlaces, listSearchQuery);
      setResults(filteredPlaces);
      
      let queryText = `${listType.charAt(0).toUpperCase() + listType.slice(1)} List (${formattedPlaces.length} places)`;
      if (refLat !== null && refLon !== null) {
        queryText += ` • Distance from (${refLat.toFixed(4)}, ${refLon.toFixed(4)})`;
      }
      if (listSearchQuery) {
        queryText += ` • Filtered: ${filteredPlaces.length} shown`;
      }
      setQueryInfo(queryText);
      
      // Create marker data (markers will be updated automatically by useEffect)
      const newMarkers = formattedPlaces.map((place, index) => ({
        id: place.id || `place-${index}-${Date.now()}-${Math.random()}`,
        position: { 
          lat: parseFloat(place.lat), 
          lng: parseFloat(place.lon) 
        },
        place: {
          ...place,
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
        },
      }));
      
      setMarkers(newMarkers);
    } catch (err) {
      console.error(`Error loading ${listType} list:`, err);
      setError(`Failed to load ${listType} list: ${err.message}`);
      setResults([]);
      setAllListResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Apply search filter when search query changes for personal lists
  useEffect(() => {
    if (activeListView && allListResults.length > 0) {
      const filtered = filterListResults(allListResults, listSearchQuery);
      setResults(filtered);
      
      // Update markers to match filtered results
      const filteredMarkers = filtered.map((place, index) => ({
        id: place.id || `place-${index}-${Date.now()}-${Math.random()}`,
        position: { 
          lat: parseFloat(place.lat), 
          lng: parseFloat(place.lon) 
        },
        place: {
          ...place,
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
        },
      }));
      setMarkers(filteredMarkers);
      
      // Update query info with filter status
      const listType = activeListView;
      let queryText = `${listType.charAt(0).toUpperCase() + listType.slice(1)} List (${allListResults.length} places)`;
      if (referenceLocation) {
        queryText += ` • Distance from (${referenceLocation.lat.toFixed(4)}, ${referenceLocation.lon.toFixed(4)})`;
      }
      if (listSearchQuery) {
        queryText += ` • Filtered: ${filtered.length} shown`;
      }
      setQueryInfo(queryText);
    }
  }, [listSearchQuery, activeListView, allListResults, referenceLocation]);

  // Get user's current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(`Error getting location: ${error.message}`));
        }
      );
    });
  };

  // Load list with current location
  const loadListWithCurrentLocation = async (listType) => {
    try {
      const location = await getCurrentLocation();
      await loadPersonalList(listType, location.lat, location.lon);
    } catch (error) {
      alert(`Could not get your location: ${error.message}`);
      // Fallback to loading without distance
      await loadPersonalList(listType);
    }
  };


  // Reset to normal search mode
  const resetToSearchMode = () => {
    setActiveListView(null);
    setReferenceLocation(null);
    setActiveListView(null);
    setResults([]);
    clearAllMarkers();
    setQueryInfo('');
    if (map) {
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);
    }
  };

  const handleLogout = async () => {
    try {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Auth-Token'] = token;
      }

      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      
      // Clear token from localStorage
      setAuthToken(null);
      setAuthenticated(false);
      setUserRole(null);
      setUserPermissions([]);
      setResults([]);
      setMarkers([]);
      setStats(null);
      setAnalytics(null);
      setDensity(null);
      clearAllMarkers();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStats();
      setStats(data);
      console.log('Stats loaded:', data); // Debug log
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissionDetails = async () => {
    try {
      const data = await checkPermissions();
      setPermissionDetails(data);
      setShowPermissions(true);
    } catch (err) {
      setError('Failed to check permissions');
      console.error(err);
    }
  };

  const handleEnableAddMode = () => {
    setAddingLocation(true);
    setError(null);
  };

  const handleMapClick = (e) => {
    if (addingLocation && e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setNewLocationCoords({ lat, lon: lng });
      setShowAddForm(true);
      setAddingLocation(false);
    }
  };

  const handleAddLocationSubmit = async (e) => {
    e.preventDefault();
    if (!newLocationCoords || !newLocationData.name) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const placeData = {
        name: newLocationData.name,
        city: newLocationData.city || '',
        state: newLocationData.state || '',
        country: newLocationData.country || 'US',
        lat: newLocationCoords.lat,
        lon: newLocationCoords.lon,
        place_type: newLocationData.place_type || 'brewery',
        type_data: newLocationData.type_data || {}
      };

      const result = await addPlace(placeData);
      
      if (result.success && result.place) {
        // Add the new location to the map
        const newMarker = {
          id: result.place.id,
          position: { lat: result.place.lat, lng: result.place.lon },
          place: result.place
        };
        setMarkers([...markers, newMarker]);
        setResults([...results, result.place]);
        
        // Close form and reset
        setShowAddForm(false);
        setNewLocationCoords(null);
        setNewLocationData({ name: '', city: '', state: '', country: 'US', place_type: 'brewery', type_data: {} });
        setError(null);
        
        // Reload stats
        loadStats();
      }
    } catch (err) {
      let errorMessage = err.message || 'Failed to add location.';
      if (errorMessage.includes('401') || errorMessage.includes('Not authenticated')) {
        errorMessage = 'Session expired. Please logout and login again, then try adding the location.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Permission denied')) {
        errorMessage = 'You do not have permission to add locations. Only admin_user and app_user can add locations.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setAddingLocation(false);
    setShowAddForm(false);
    setNewLocationCoords(null);
    setNewLocationData({ name: '', city: '', state: '', country: 'US', place_type: 'brewery', type_data: {} });
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingCSV(true);
    setError(null);
    setCsvUploadResult(null);

    try {
      const result = await uploadCSV(file);
      setCsvUploadResult(result);
      
      // Reload stats and refresh map
      await loadStats();
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Show success message
      if (result.summary && result.summary.inserted > 0) {
        alert(`✅ Successfully uploaded ${result.summary.inserted} locations from CSV!`);
      }
    } catch (err) {
      let errorMessage = err.message || 'Failed to upload CSV file.';
      if (errorMessage.includes('401') || errorMessage.includes('Not authenticated')) {
        errorMessage = 'Session expired. Please logout and login again.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Permission denied')) {
        errorMessage = 'Only admin_user can upload CSV files.';
      }
      setError(errorMessage);
    } finally {
      setUploadingCSV(false);
    }
  };

  // Update marker clustering when markers change
  useEffect(() => {
    if (!map || !window.google || !window.google.maps) {
      return;
    }

    // Always clear existing markers first - do this synchronously
    clearAllMarkers();

    // Only create markers if we have data
    if (markers.length === 0) {
      return;
    }

    // Use a small delay to ensure cleanup is complete
    const timeoutId = setTimeout(() => {
      // Create new markers
      const newGoogleMarkers = markers.map(m => {
        const marker = new window.google.maps.Marker({
          position: { lat: m.position.lat, lng: m.position.lng },
          title: m.place.name || 'Unknown',
          map: null, // Don't add to map directly yet
        });

        marker.addListener('click', () => {
          setSelectedPlace(m.place);
          if (map) {
            map.setCenter({ lat: m.position.lat, lng: m.position.lng });
            map.setZoom(15);
          }
        });

        return marker;
      });

      googleMarkersRef.current = newGoogleMarkers;

      // Use clustering only if 5+ markers and library is available
      if (markers.length >= 5 && markerClustererLibRef.current) {
        try {
          clustererRef.current = new markerClustererLibRef.current.MarkerClusterer({
            map: map,
            markers: newGoogleMarkers,
          });
        } catch (e) {
          console.warn('Error creating clusterer, showing markers directly:', e);
          // Fallback to showing markers directly
          newGoogleMarkers.forEach(marker => {
            marker.setMap(map);
          });
        }
      } else {
        // Show markers directly on map
        newGoogleMarkers.forEach(marker => {
          marker.setMap(map);
        });
      }

      // Fit bounds to show all markers
      if (newGoogleMarkers.length > 0) {
        setTimeout(() => {
          if (map && newGoogleMarkers.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            newGoogleMarkers.forEach(marker => {
              if (marker && marker.getPosition) {
                bounds.extend(marker.getPosition());
              }
            });
            
            if (!bounds.isEmpty()) {
              map.fitBounds(bounds);

              // Don't zoom in too much for single marker
              if (newGoogleMarkers.length === 1) {
                setTimeout(() => {
                  if (map.getZoom() > 15) {
                    map.setZoom(12);
                  }
                }, 100);
              }
            }
          }
        }, 100);
      }
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      clearAllMarkers();
    };
  }, [markers, map, clearAllMarkers]);

  const handleSearch = async (searchParams) => {
    setLoading(true);
    setError(null);
    setActiveListView(null); // Reset list view when doing a new search
    setReferenceLocation(null); // Clear reference location
    setSelectedPlace(null);

    // Force clear markers immediately
    clearAllMarkers();
    setMarkers([]);
    setResults([]);

    try {
      const data = await searchPlaces(searchParams);
      const features = data.features || [];
      
      setResults(features);
      setQueryInfo(data.query_info || '');

      // Create marker data with unique IDs
      const newMarkers = features.map((place, index) => ({
        id: place.id || `place-${index}-${Date.now()}-${Math.random()}`,
        position: { 
          lat: parseFloat(place.lat), 
          lng: parseFloat(place.lon) 
        },
        place: {
          ...place,
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
        },
      }));

      // Set new markers - this will trigger useEffect
      setMarkers(newMarkers);

      // Auto-load density analysis for radius and nearest queries
      if (searchParams.type === 'radius' || searchParams.type === 'nearest') {
        setTimeout(() => loadDensityAnalysis(searchParams), 500);
      }
    } catch (err) {
      setError(err.message || 'Failed to search. Make sure the Flask API is running.');
      setResults([]);
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStateAnalytics = async () => {
    try {
      const data = await getStateAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError('Failed to load analytics');
      console.error(err);
    }
  };

  const loadDensityAnalysis = async (searchParams) => {
    try {
      const lat = searchParams?.lat || defaultCenter.lat;
      const lon = searchParams?.lon || defaultCenter.lng;
      const radius = searchParams?.km || 100;

      const data = await getDensityAnalysis(lat, lon, radius);
      setDensity(data);
    } catch (err) {
      console.error('Failed to load density analysis:', err);
    }
  };

  const handleExport = async (format) => {
    try {
      await exportData(format);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  const handleMarkerClick = (place) => {
    setSelectedPlace(place);
    if (map) {
      map.setCenter({ lat: place.lat, lng: place.lon });
      map.setZoom(15);
    }
  };

  const onMapLoad = (mapInstance) => {
    setMap(mapInstance);
  };

  const onMapUnmount = () => {
    clearAllMarkers();
    setMap(null);
  };

  // Conditional returns AFTER all hooks
  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Checking authentication...</div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      {/* Toggle button for user header - Icon only */}
      <button
        onClick={() => setShowUserHeader(!showUserHeader)}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 2001,
          width: '32px',
          height: '32px',
          background: showUserHeader ? '#f5f5f5' : '#2196F3',
          color: showUserHeader ? '#666' : 'white',
          border: '1px solid #ddd',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
          fontWeight: '300'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = showUserHeader ? '#f44336' : '#1976D2';
          e.target.style.color = 'white';
          e.target.style.borderColor = showUserHeader ? '#f44336' : '#1976D2';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = showUserHeader ? '#f5f5f5' : '#2196F3';
          e.target.style.color = showUserHeader ? '#666' : 'white';
          e.target.style.borderColor = '#ddd';
          e.target.style.transform = 'scale(1)';
        }}
        title={showUserHeader ? 'Hide user info' : 'Show user info'}
      >
        {showUserHeader ? '×' : '👤'}
      </button>

      {/* User Info Header */}
      {showUserHeader && (
        <div className="user-header">
        <div className="user-info">
          <span className="user-role-badge">👤 {userRole}</span>
          <span className="user-permissions">
            Permissions: {userPermissions.join(', ')}
          </span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            <button 
              onClick={loadPermissionDetails}
              style={{ 
                padding: '6px 12px', 
                fontSize: '12px', 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(102, 126, 234, 0.2)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.2)';
              }}
            >
              🔒 Test Permissions
            </button>
            {(userRole === 'admin_user' || userRole === 'app_user') && (
              <button
                onClick={handleEnableAddMode}
                disabled={addingLocation || loading}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: addingLocation ? '#ff9800' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: addingLocation ? 'crosshair' : 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: '500',
                  boxShadow: addingLocation ? '0 2px 4px rgba(255, 152, 0, 0.2)' : '0 2px 4px rgba(16, 185, 129, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!addingLocation && !loading) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = addingLocation ? '0 2px 4px rgba(255, 152, 0, 0.2)' : '0 2px 4px rgba(16, 185, 129, 0.2)';
                }}
              >
                {addingLocation ? '📍 Click Map' : '➕ Add Location'}
              </button>
            )}
            {userRole === 'admin_user' && (
              <label
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: uploadingCSV ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploadingCSV ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  fontWeight: '500',
                  boxShadow: uploadingCSV ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!uploadingCSV) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = uploadingCSV ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.2)';
                }}
              >
                {uploadingCSV ? '📤 Uploading...' : '📁 Upload CSV'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={uploadingCSV}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '12px', 
          alignItems: 'flex-start',
          minWidth: '160px'
        }}>
          {userAccount ? (
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '8px',
                width: '100%',
                border: '1px solid #e2e8f0'
              }}>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                  👤 {userAccount.username}
                </span>
              </div>
              {(activeListView || groupPlacesMode) ? (
                <button 
                  onClick={() => {
                    setGroupPlacesMode(false);
                    resetToSearchMode();
                  }}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    background: '#64748b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    width: '100%',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#475569';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#64748b';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  🔍 Browse All
                </button>
              ) : (
                <>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    width: '100%'
                  }}>
                    <button
                      onClick={() => loadPersonalList('visited')}
                      disabled={loading}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        background: activeListView === 'visited' 
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                          : '#f0fdf4',
                        color: activeListView === 'visited' ? 'white' : '#000000',
                        border: `2px solid ${activeListView === 'visited' ? '#10b981' : '#bbf7d0'}`,
                        borderRadius: '10px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: activeListView === 'visited' 
                          ? '0 2px 8px rgba(16, 185, 129, 0.3)' 
                          : '0 1px 2px rgba(0, 0, 0, 0.05)',
                        opacity: loading ? 0.6 : 1,
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading && activeListView !== 'visited') {
                          e.target.style.background = '#dcfce7';
                          e.target.style.borderColor = '#86efac';
                          e.target.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeListView !== 'visited') {
                          e.target.style.background = '#f0fdf4';
                          e.target.style.borderColor = '#bbf7d0';
                          e.target.style.transform = 'translateX(0)';
                        }
                      }}
                      title="Show visited places"
                    >
                      <span style={{ color: activeListView === 'visited' ? 'white' : '#000000' }}>✓ Visited</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadListWithCurrentLocation('visited');
                        }}
                        disabled={loading}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          background: activeListView === 'visited' ? 'rgba(255,255,255,0.2)' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Calculate distance from current location"
                      >
                        📍
                      </button>
                    </button>
                    <button
                      onClick={() => {
                        setListSearchQuery(''); // Clear search when switching lists
                        loadPersonalList('wishlist');
                      }}
                      disabled={loading}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        background: activeListView === 'wishlist' 
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                          : '#fffbeb',
                        color: activeListView === 'wishlist' ? 'white' : '#000000',
                        border: `2px solid ${activeListView === 'wishlist' ? '#f59e0b' : '#fde68a'}`,
                        borderRadius: '10px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: activeListView === 'wishlist' 
                          ? '0 2px 8px rgba(245, 158, 11, 0.3)' 
                          : '0 1px 2px rgba(0, 0, 0, 0.05)',
                        opacity: loading ? 0.6 : 1,
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading && activeListView !== 'wishlist') {
                          e.target.style.background = '#fef3c7';
                          e.target.style.borderColor = '#fcd34d';
                          e.target.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeListView !== 'wishlist') {
                          e.target.style.background = '#fffbeb';
                          e.target.style.borderColor = '#fde68a';
                          e.target.style.transform = 'translateX(0)';
                        }
                      }}
                      title="Show wishlist"
                    >
                      <span style={{ color: activeListView === 'wishlist' ? 'white' : '#000000' }}>★ Wishlist</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadListWithCurrentLocation('wishlist');
                        }}
                        disabled={loading}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          background: activeListView === 'wishlist' ? 'rgba(255,255,255,0.2)' : '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Calculate distance from current location"
                      >
                        📍
                      </button>
                    </button>
                    <button
                      onClick={() => {
                        setListSearchQuery(''); // Clear search when switching lists
                        loadPersonalList('liked');
                      }}
                      disabled={loading}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        background: activeListView === 'liked' 
                          ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' 
                          : '#fdf2f8',
                        color: activeListView === 'liked' ? 'white' : '#000000',
                        border: `2px solid ${activeListView === 'liked' ? '#ec4899' : '#fbcfe8'}`,
                        borderRadius: '10px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: activeListView === 'liked' 
                          ? '0 2px 8px rgba(236, 72, 153, 0.3)' 
                          : '0 1px 2px rgba(0, 0, 0, 0.05)',
                        opacity: loading ? 0.6 : 1,
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading && activeListView !== 'liked') {
                          e.target.style.background = '#fce7f3';
                          e.target.style.borderColor = '#f9a8d4';
                          e.target.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeListView !== 'liked') {
                          e.target.style.background = '#fdf2f8';
                          e.target.style.borderColor = '#fbcfe8';
                          e.target.style.transform = 'translateX(0)';
                        }
                      }}
                      title="Show liked places"
                    >
                      <span style={{ color: activeListView === 'liked' ? 'white' : '#000000' }}>❤️ Liked</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadListWithCurrentLocation('liked');
                        }}
                        disabled={loading}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          background: activeListView === 'liked' ? 'rgba(255,255,255,0.2)' : '#ec4899',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Calculate distance from current location"
                      >
                        📍
                      </button>
                    </button>
                  </div>
                </>
              )}
              <button 
                onClick={() => {
                  setShowGroups(true);
                  setActiveListView(null);
                  setSelectedGroupId(null);
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                👥 Groups
              </button>
              <button 
                onClick={handleUserLogout}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Logout Lists
              </button>
            </>
          ) : (
              <button 
                onClick={() => {
                  setUserAuthKey(prev => prev + 1);
                  setShowUserAuth(true);
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                👤 Personal Lists
              </button>
          )}
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
      )}

      {/* User Auth Modal for Personal Lists */}
      {showUserAuth && (
        <UserAuth
          key={userAuthKey}
          onLoginSuccess={handleUserLoginSuccess}
          onCancel={() => {
            setShowUserAuth(false);
            setUserAuthKey(prev => prev + 1); // Force remount on next open
          }}
        />
      )}

      {/* Groups Modal */}
      {showGroups && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '0',
            maxWidth: '90%',
            width: selectedGroupId ? '900px' : '650px',
            maxHeight: '90vh',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <button
              onClick={() => {
                setShowGroups(false);
                setSelectedGroupId(null);
                setGroupPlacesMode(false);
                resetToSearchMode();
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 1001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                lineHeight: '1',
                padding: '0',
                transition: 'all 0.2s',
                fontWeight: '300'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f44336';
                e.target.style.color = 'white';
                e.target.style.borderColor = '#f44336';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f5f5f5';
                e.target.style.color = '#666';
                e.target.style.borderColor = '#ddd';
              }}
              title="Close"
            >
              ×
            </button>
            {selectedGroupId ? (
              <GroupPlaces
                groupId={selectedGroupId}
                onBack={() => {
                  setSelectedGroupId(null);
                  setGroupPlacesMode(false);
                  resetToSearchMode();
                }}
                isShownOnMap={groupPlacesMode}
                onShowOnMap={(places, groupName) => {
                  if (!places || places.length === 0) {
                    // Hide from map
                    setGroupPlacesMode(false);
                    resetToSearchMode();
                  } else {
                    // Display places on map
                    setGroupPlacesMode(true);
                    setResults(places);
                    setQueryInfo(`Group Places: ${groupName} (${places.length} places)`);
                    
                    // Create markers
                    const newMarkers = places.map((place, index) => ({
                      id: place.id || `group-place-${index}-${Date.now()}-${Math.random()}`,
                      position: { 
                        lat: place.lat, 
                        lng: place.lon 
                      },
                      place: place,
                    }));
                    setMarkers(newMarkers);
                    
                    // Fit map to bounds
                    if (map && newMarkers.length > 0) {
                      const bounds = new window.google.maps.LatLngBounds();
                      newMarkers.forEach(marker => {
                        bounds.extend(marker.position);
                      });
                      map.fitBounds(bounds);
                    }
                    // Close groups modal when showing on map
                    setShowGroups(false);
                    setSelectedGroupId(null);
                  }
                }}
              />
            ) : (
              <Groups
                onViewGroupPlaces={(groupId) => setSelectedGroupId(groupId)}
              />
            )}
          </div>
        </div>
      )}

      {/* Permission Details Modal */}
      {showPermissions && permissionDetails && (
        <div 
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 3000,
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}
        >
          <button
            onClick={() => setShowPermissions(false)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              background: '#f5f5f5',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              lineHeight: '1',
              padding: '0',
              transition: 'all 0.2s',
              fontWeight: '300'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f44336';
              e.target.style.color = 'white';
              e.target.style.borderColor = '#f44336';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#f5f5f5';
              e.target.style.color = '#666';
              e.target.style.borderColor = '#ddd';
            }}
            title="Close"
          >
            ×
          </button>
          <h3 style={{ marginTop: 0, paddingRight: '40px' }}>🔐 Database Permissions</h3>
          <p><strong>Current User:</strong> {permissionDetails.current_user}</p>
          {permissionDetails.permissions && (
            <div>
              <h4>Table Permissions:</h4>
              <ul>
                <li>SELECT: {permissionDetails.permissions.can_select ? '✅ Yes' : '❌ No'}</li>
                <li>INSERT: {permissionDetails.permissions.can_insert ? '✅ Yes' : '❌ No'}</li>
                <li>UPDATE: {permissionDetails.permissions.can_update ? '✅ Yes' : '❌ No'}</li>
                <li>DELETE: {permissionDetails.permissions.can_delete ? '✅ Yes' : '❌ No'}</li>
              </ul>
            </div>
          )}
          <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
            <strong>💡 Note:</strong> The app only uses SELECT queries (read), which is why both roles can use it. 
            {permissionDetails.permissions && !permissionDetails.permissions.can_insert && (
              <div style={{ marginTop: '8px', color: '#d32f2f' }}>
                ⚠️ This user would be <strong>blocked</strong> from INSERT/UPDATE/DELETE operations by the database!
              </div>
            )}
            {permissionDetails.permissions && permissionDetails.permissions.can_insert && (
              <div style={{ marginTop: '8px', color: '#388e3c' }}>
                ✅ This user has full access and can perform all operations!
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Upload Result Modal */}
      {csvUploadResult && (
        <div 
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 3000,
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}
        >
          <button
            onClick={() => setCsvUploadResult(null)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              background: '#f5f5f5',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              lineHeight: '1',
              padding: '0',
              transition: 'all 0.2s',
              fontWeight: '300'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f44336';
              e.target.style.color = 'white';
              e.target.style.borderColor = '#f44336';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#f5f5f5';
              e.target.style.color = '#666';
              e.target.style.borderColor = '#ddd';
            }}
            title="Close"
          >
            ×
          </button>
          <h3 style={{ marginTop: 0, paddingRight: '40px' }}>📁 CSV Upload Results</h3>
          {csvUploadResult.summary && (
            <div>
              <p><strong>✅ Inserted:</strong> {csvUploadResult.summary.inserted}</p>
              <p><strong>⏭️ Skipped:</strong> {csvUploadResult.summary.skipped}</p>
              <p><strong>📊 Total Rows:</strong> {csvUploadResult.summary.total_rows}</p>
            </div>
          )}
          {csvUploadResult.errors && csvUploadResult.errors.length > 0 && (
            <div style={{ marginTop: '15px' }}>
              <strong>⚠️ Errors ({csvUploadResult.error_count}):</strong>
              <ul style={{ maxHeight: '200px', overflow: 'auto', fontSize: '12px' }}>
                {csvUploadResult.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Cancel Add Location Button (shown when in add mode) */}
      {addingLocation && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '10px',
          zIndex: 2000,
          background: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <span style={{ marginRight: '8px', fontSize: '13px' }}>📍 Click on map to set location</span>
          <button
            onClick={handleCancelAdd}
            style={{
              padding: '4px 8px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Add Location Form Modal */}
      {showAddForm && newLocationCoords && (
        <div 
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 3000,
            minWidth: '400px',
            maxWidth: '500px'
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>➕ Add New Location</h3>
          
          <div style={{ marginBottom: '12px', padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px' }}>
            <strong>Coordinates:</strong> {newLocationCoords.lat.toFixed(6)}, {newLocationCoords.lon.toFixed(6)}
          </div>

          <form onSubmit={handleAddLocationSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Name * <span style={{ color: '#666', fontSize: '12px' }}>(Required)</span>
              </label>
              <input
                type="text"
                value={newLocationData.name}
                onChange={(e) => setNewLocationData({...newLocationData, name: e.target.value})}
                required
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="e.g., New Place Name"
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                City
              </label>
              <input
                type="text"
                value={newLocationData.city}
                onChange={(e) => setNewLocationData({...newLocationData, city: e.target.value})}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="e.g., Houston"
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                State
              </label>
              <input
                type="text"
                value={newLocationData.state}
                onChange={(e) => setNewLocationData({...newLocationData, state: e.target.value})}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="e.g., Texas"
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Country
              </label>
              <input
                type="text"
                value={newLocationData.country}
                onChange={(e) => setNewLocationData({...newLocationData, country: e.target.value})}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="e.g., US"
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Place Type *
              </label>
              <select
                value={newLocationData.place_type}
                onChange={(e) => setNewLocationData({
                  ...newLocationData, 
                  place_type: e.target.value,
                  type_data: {} // Reset type-specific data when changing type
                })}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              >
                <option value="brewery">🍺 Brewery</option>
                <option value="restaurant">🍽️ Restaurant</option>
                <option value="tourist_place">🗺️ Tourist Place</option>
                <option value="hotel">🏨 Hotel</option>
              </select>
            </div>

            {/* Type-specific fields */}
            {newLocationData.place_type === 'brewery' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Brewery Type
                </label>
                <select
                  value={newLocationData.type_data.brewery_type || 'micro'}
                  onChange={(e) => setNewLocationData({
                    ...newLocationData,
                    type_data: { ...newLocationData.type_data, brewery_type: e.target.value }
                  })}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="micro">Micro</option>
                  <option value="nano">Nano</option>
                  <option value="regional">Regional</option>
                  <option value="brewpub">Brewpub</option>
                  <option value="large">Large</option>
                </select>
              </div>
            )}

            {newLocationData.place_type === 'restaurant' && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Cuisine Type
                  </label>
                  <input
                    type="text"
                    value={newLocationData.type_data.cuisine_type || ''}
                    onChange={(e) => setNewLocationData({
                      ...newLocationData,
                      type_data: { ...newLocationData.type_data, cuisine_type: e.target.value }
                    })}
                    style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="e.g., Italian, Mexican, American"
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Price Range (1-4)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={newLocationData.type_data.price_range || ''}
                    onChange={(e) => setNewLocationData({
                      ...newLocationData,
                      type_data: { ...newLocationData.type_data, price_range: e.target.value ? parseInt(e.target.value) : null }
                    })}
                    style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="1=Budget, 2=Moderate, 3=Expensive, 4=Very Expensive"
                  />
                </div>
              </>
            )}

            {newLocationData.place_type === 'tourist_place' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Tourist Place Type
                </label>
                <select
                  value={newLocationData.type_data.tourist_type || 'Attraction'}
                  onChange={(e) => setNewLocationData({
                    ...newLocationData,
                    type_data: { ...newLocationData.type_data, tourist_type: e.target.value }
                  })}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="Attraction">Attraction</option>
                  <option value="Museum">Museum</option>
                  <option value="Monument">Monument</option>
                  <option value="Park">Park</option>
                  <option value="Landmark">Landmark</option>
                </select>
              </div>
            )}

            {newLocationData.place_type === 'hotel' && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Star Rating (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newLocationData.type_data.star_rating || ''}
                    onChange={(e) => setNewLocationData({
                      ...newLocationData,
                      type_data: { ...newLocationData.type_data, star_rating: e.target.value ? parseInt(e.target.value) : null }
                    })}
                    style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="1-5 stars"
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Amenities (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(newLocationData.type_data.amenities) 
                      ? newLocationData.type_data.amenities.join(', ') 
                      : (newLocationData.type_data.amenities || '')}
                    onChange={(e) => {
                      const amenities = e.target.value.split(',').map(a => a.trim()).filter(a => a);
                      setNewLocationData({
                        ...newLocationData,
                        type_data: { ...newLocationData.type_data, amenities: amenities.length > 0 ? amenities : null }
                      });
                    }}
                    style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="e.g., WiFi, Pool, Gym, Spa"
                  />
                </div>
              </>
            )}

            {error && (
              <div style={{ marginBottom: '12px', padding: '8px', background: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: '13px' }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={loading || !newLocationData.name}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: loading ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading || !newLocationData.name ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? 'Adding...' : 'Add Location'}
              </button>
              <button
                type="button"
                onClick={handleCancelAdd}
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <LoadScript
        googleMapsApiKey={API_KEY}
        libraries={['geometry']}
        onError={(error) => {
          setError('Google Maps API failed to load. Please check your API key.');
          console.error('Google Maps API error:', error);
        }}
      >
        {/* Toggle button for left sidebar (Search Options) */}
        <button
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 1001,
            width: '32px',
            height: '32px',
            background: showLeftSidebar ? '#f5f5f5' : '#2196F3',
            color: showLeftSidebar ? '#666' : 'white',
            border: '1px solid #ddd',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            fontWeight: '300'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = showLeftSidebar ? '#f44336' : '#1976D2';
            e.target.style.color = 'white';
            e.target.style.borderColor = showLeftSidebar ? '#f44336' : '#1976D2';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = showLeftSidebar ? '#f5f5f5' : '#2196F3';
            e.target.style.color = showLeftSidebar ? '#666' : 'white';
            e.target.style.borderColor = '#ddd';
            e.target.style.transform = 'scale(1)';
          }}
          title={showLeftSidebar ? 'Hide search options' : 'Show search options'}
        >
          {showLeftSidebar ? '×' : '🔍'}
        </button>

        {/* Left Sidebar - Search Options */}
        {showLeftSidebar && (
          <SearchControls
            onSearch={handleSearch}
            onLoadStats={loadStats}
            onLoadAnalytics={loadStateAnalytics}
            onLoadDensity={loadDensityAnalysis}
            loading={loading}
          />
        )}

        {/* Toggle button for right sidebar (Results & Analytics) - Bottom Right */}
        <button
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 1001,
            width: '32px',
            height: '32px',
            background: showRightSidebar ? '#f5f5f5' : '#2196F3',
            color: showRightSidebar ? '#666' : 'white',
            border: '1px solid #ddd',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            fontWeight: '300'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = showRightSidebar ? '#f44336' : '#1976D2';
            e.target.style.color = 'white';
            e.target.style.borderColor = showRightSidebar ? '#f44336' : '#1976D2';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = showRightSidebar ? '#f5f5f5' : '#2196F3';
            e.target.style.color = showRightSidebar ? '#666' : 'white';
            e.target.style.borderColor = '#ddd';
            e.target.style.transform = 'scale(1)';
          }}
          title={showRightSidebar ? 'Hide results & analytics' : 'Show results & analytics'}
        >
          {showRightSidebar ? '×' : '📊'}
        </button>

        {/* Right Sidebar - Results & Analytics (slides from bottom) */}
        {showRightSidebar && (
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              right: '10px',
              width: '350px',
              maxHeight: 'calc(100vh - 80px)',
              background: 'white',
              padding: '16px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              overflowY: 'auto',
              zIndex: 1000,
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <ResultsSidebar
              results={results}
              stats={stats}
              analytics={analytics}
              density={density}
              queryInfo={queryInfo}
              error={error}
              onMarkerClick={handleMarkerClick}
              onExport={handleExport}
              hasResults={results.length > 0}
              userAuthenticated={!!userAccount}
              noPosition={true}
              activeListView={activeListView}
              listSearchQuery={listSearchQuery}
              onListSearchChange={setListSearchQuery}
            />
          </div>
        )}

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          onClick={addingLocation ? handleMapClick : undefined}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Markers are handled by clustering library for 5+ markers */}
          {/* For less than 5 markers, they're added directly in useEffect */}
          {/* Info window for selected place */}
          {selectedPlace && (
            <InfoWindow
              position={{ lat: selectedPlace.lat, lng: selectedPlace.lon }}
              onCloseClick={() => setSelectedPlace(null)}
            >
              <div style={{ padding: '8px' }}>
                <strong>{selectedPlace.name || 'Unknown'}</strong>
                <br />
                {selectedPlace.city || ''}{selectedPlace.city && selectedPlace.state ? ', ' : ''}{selectedPlace.state || ''}
                {selectedPlace.distance_km && (
                  <>
                    <br />
                    <small>📍 {selectedPlace.distance_km} km away</small>
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}

export default App;

