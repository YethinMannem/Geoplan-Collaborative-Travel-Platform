import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, InfoWindow } from '@react-google-maps/api';
import SearchControls from './components/SearchControls';
import ResultsSidebar from './components/ResultsSidebar';
import UserPanel from './components/UserPanel';
import NavBar from './components/NavBar';
import Login from './components/Login';
import UserAuth from './components/UserAuth';
import Groups from './components/Groups';
import GroupPlaces from './components/GroupPlaces';
import { getUserProfile, getVisitedList, getWishlist, getLikedList } from './services/userListsApi';
import PlaceListIcons from './components/PlaceListIcons';
import { searchPlaces, getStats, getStateAnalytics, getDensityAnalysis, exportData, checkPermissions, addPlace, uploadCSV, setAuthToken, getAuthToken } from './services/api';
import './App.css';

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Check if API key is set
if (!API_KEY || API_KEY.trim() === '') {
  console.error('⚠️ WARNING: Google Maps API key is not set!');
  console.error('Please set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file');
  console.error('See GOOGLE_MAPS_SETUP.md for instructions');
}
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5001';

const mapContainerStyle = {
  width: '100%',
  height: 'calc(100vh - 64px)' // Account for navbar height
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
  const [listSearchQuery, setListSearchQuery] = useState(''); // Search filter for both search results and personal lists
  const [allListResults, setAllListResults] = useState([]); // Store all results before filtering (for personal lists)
  const [allSearchResults, setAllSearchResults] = useState([]); // Store all search results before filtering
  
  // Groups state
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  
  // User header card toggle
  const [showUserHeader, setShowUserHeader] = useState(false); // Hidden by default - using NavBar instead

  // Sidebar toggles
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);  // Search Options
  const [showRightSidebar, setShowRightSidebar] = useState(false); // Results & Analytics - only show when there are results

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

  // Check authentication status on mount (prioritize user account)
  useEffect(() => {
    // Check user account first (primary auth method)
    checkUserAuth();
    // Also check role-based auth (for backward compatibility)
    checkAuth();
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
    // Ensure places is always an array
    const safePlaces = Array.isArray(places) ? places : [];
    
    if (!searchQuery || !searchQuery.trim()) {
      return safePlaces;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return safePlaces.filter(place => {
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

  const handleLoginSuccess = async (loginData) => {
    // Handle user account login (primary method)
    if (loginData.user) {
      setUserAccount(loginData.user);
      setAuthenticated(true); // Set authenticated for app access
      // Check user profile to get full details
      try {
        const profile = await getUserProfile();
        setUserAccount(profile.user);
      } catch (err) {
        console.warn('Could not fetch user profile:', err);
      }
    } else {
      // Fallback: role-based login (for admin/backward compatibility)
    setAuthenticated(true);
    setUserRole(loginData.role);
    setUserPermissions(loginData.permissions || []);
    }
  };

  // Check user account authentication (for personal lists)
  const checkUserAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setUserAccount(null);
      setAuthenticated(false);
      return;
    }

    try {
      const profile = await getUserProfile();
      setUserAccount(profile.user);
      setAuthenticated(true); // Set authenticated when user account is found
    } catch (err) {
      // Token might be expired, invalid, or for role-based auth only
      setUserAccount(null);
      setAuthenticated(false);
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
    setAuthenticated(false); // Clear authenticated state to redirect to login
    setActiveListView(null);
    // Refresh results to remove list status
    if (Array.isArray(results) && results.length > 0) {
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
        lat: p.latitude || p.lat,
        lon: p.longitude || p.lon,
        place_type: p.place_type,
        distance_km: p.distance_km || null,
        list_status: {
          visited: p.visited || false,
          wishlist: p.in_wishlist || false,
          liked: p.liked || false
        }
      }));
      
      // Show sidebar when loading personal list with results
      if (formattedPlaces.length > 0) {
        setShowRightSidebar(true);
      } else {
        setShowRightSidebar(false);
      }
      
      setAllListResults(formattedPlaces);
      const filtered = filterListResults(formattedPlaces, listSearchQuery);
      setResults(filtered);
      setReferenceLocation(refLat && refLon ? { lat: refLat, lon: refLon } : null);
    } catch (err) {
      console.error(`Error loading ${listType} list:`, err);
      setError(`Failed to load ${listType} list: ${err.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Load list with current location for distance calculation
  const loadListWithCurrentLocation = async (listType) => {
      if (!navigator.geolocation) {
      alert('Geolocation is not available');
      await loadPersonalList(listType);
        return;
      }
      
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
      };
      await loadPersonalList(listType, location.lat, location.lon);
    } catch (error) {
      alert(`Could not get your location: ${error.message}`);
      // Fallback to loading without distance
      await loadPersonalList(listType);
    }
  };

  // Filter results when search query changes (for both search results and personal lists)
  useEffect(() => {
    if (activeListView && allListResults.length > 0) {
      // Filter personal list results
      const filtered = filterListResults(allListResults, listSearchQuery);
      setResults(filtered);
    } else if (!activeListView && allSearchResults.length > 0) {
      // Filter search results
      const filtered = filterListResults(allSearchResults, listSearchQuery);
      setResults(filtered);
    }
  }, [listSearchQuery, activeListView, allListResults, allSearchResults]);

  // Reset to search mode (clear personal list view)
  const resetToSearchMode = () => {
    setActiveListView(null);
    setListSearchQuery('');
    setAllListResults([]);
    setAllSearchResults([]);
    setResults([]);
    setReferenceLocation(null);
  };

  const handleLogout = () => {
      setAuthToken(null);
      setAuthenticated(false);
      setUserRole(null);
      setUserPermissions([]);
    setUserAccount(null);
    setActiveListView(null);
      setResults([]);
      setError(null);
  };

  const loadPermissionDetails = async () => {
    try {
      const data = await checkPermissions();
      setPermissionDetails(data);
      setShowPermissions(true);
    } catch (err) {
      alert('Failed to check permissions: ' + err.message);
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

  const handleCancelAdd = () => {
    setAddingLocation(false);
    setShowAddForm(false);
    setNewLocationCoords(null);
    setNewLocationData({ 
      name: '', 
      city: '', 
      state: '', 
      country: 'US',
      place_type: 'brewery',
      type_data: {}
    });
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!newLocationCoords) {
      alert('Please click on the map to select a location');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const placeData = {
        ...newLocationData,
        latitude: newLocationCoords.lat,
        longitude: newLocationCoords.lon,
      };

      await addPlace(placeData);
      alert('✅ Location added successfully!');
      handleCancelAdd();
      // Optionally refresh stats
      await loadStats();
    } catch (err) {
      console.error('Error adding location:', err);
      setError('Failed to add location: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingCSV(true);
    setCsvUploadResult(null);
    setError(null);

    try {
      const result = await uploadCSV(file);
      setCsvUploadResult(result);
      alert(`✅ CSV uploaded successfully! ${result.added || 0} places added, ${result.updated || 0} updated, ${result.errors || 0} errors.`);
      // Refresh stats
      await loadStats();
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError('Failed to upload CSV: ' + (err.message || 'Unknown error'));
      alert('❌ CSV upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingCSV(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSearch = async (searchParams) => {
    setLoading(true);
    setError(null);
    setActiveListView(null); // Clear personal list view
    setListSearchQuery(''); // Clear list search
    setAllListResults([]); // Clear stored list results

    try {
      console.log('🔍 Search params:', searchParams);
      const data = await searchPlaces(searchParams);
      console.log('📊 Search response:', data);
      
      // Backend returns {features: [...], count: N} for radius/nearest searches
      // Handle both formats: {features: [...]} or {places: [...]} or direct array
      let resultsArray = [];
      if (data?.features && Array.isArray(data.features)) {
        resultsArray = data.features;
      } else if (data?.places && Array.isArray(data.places)) {
        resultsArray = data.places;
      } else if (Array.isArray(data)) {
        resultsArray = data;
      }
      
      console.log(`✅ Found ${resultsArray.length} places`);
      // Debug: Log first result to check data structure
      if (resultsArray.length > 0) {
        console.log('📋 Sample place data:', {
          name: resultsArray[0].name,
          rating: resultsArray[0].rating,
          description: resultsArray[0].description,
          place_type: resultsArray[0].place_type
        });
      }
      // Store all search results for filtering
      setAllSearchResults(resultsArray);
      setResults(resultsArray);
      
      // Automatically show sidebar when results are found
      if (resultsArray.length > 0) {
        setShowRightSidebar(true);
      } else {
        setShowRightSidebar(false);
        setError(`No places found. Try increasing the search radius or selecting a different state.`);
      }
      
      // Build query info string
      let info = '';
      if (searchParams.type === 'radius') {
        info = `Radius search: ${searchParams.km}km from (${searchParams.lat.toFixed(4)}, ${searchParams.lon.toFixed(4)})`;
      } else if (searchParams.type === 'nearest') {
        info = `Nearest ${searchParams.k} places from (${searchParams.lat.toFixed(4)}, ${searchParams.lon.toFixed(4)})`;
      } else if (searchParams.type === 'bbox') {
        info = `Bounding box: [${searchParams.south.toFixed(2)}, ${searchParams.west.toFixed(2)}] to [${searchParams.north.toFixed(2)}, ${searchParams.east.toFixed(2)}]`;
      }
      if (searchParams.name) info += `, name: "${searchParams.name}"`;
      if (searchParams.state) info += `, state: "${searchParams.state}"`;
      if (searchParams.place_type) info += `, type: ${searchParams.place_type}`;
      setQueryInfo(info);
    } catch (err) {
      console.error('❌ Search error:', err);
      setError('Search failed: ' + (err.message || 'Unknown error'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerClick = (place) => {
    // Find the full place data from results to get list_status
    const fullPlace = results.find(p => p.id === place.id) || place;
    setSelectedPlace({
      ...fullPlace,
      lat: fullPlace.lat || fullPlace.latitude,
      lon: fullPlace.lon || fullPlace.longitude
    });
  };

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadStateAnalytics = async () => {
    try {
      const data = await getStateAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics: ' + err.message);
    }
  };

  const loadDensityAnalysis = async (params) => {
    try {
      const data = await getDensityAnalysis(params);
      setDensity(data);
    } catch (err) {
      console.error('Error loading density:', err);
      setError('Failed to load density analysis: ' + err.message);
    }
  };

  const handleExport = async (format) => {
    try {
      await exportData(format, results);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const onMapLoad = (mapInstance) => {
    setMap(mapInstance);
  };

  const onMapUnmount = () => {
    clearAllMarkers();
    setMap(null);
  };

  // Update markers when results change
  useEffect(() => {
    try {
      if (!map || !window.google || !window.google.maps) {
        return;
      }

      clearAllMarkers();

      // Ensure results is an array
      const safeResults = Array.isArray(results) ? results : [];
      
      if (safeResults.length === 0) {
        return;
      }

      const google = window.google;
      const newMarkers = [];

      // For 5+ markers, use clustering
      if (safeResults.length >= 5 && markerClustererLibRef.current) {
        const markers = safeResults.map(place => {
          try {
            const position = {
              lat: parseFloat(place.lat || place.latitude),
              lng: parseFloat(place.lon || place.longitude)
            };

            if (isNaN(position.lat) || isNaN(position.lng)) {
              console.warn('Invalid coordinates for place:', place);
              return null;
            }

            const marker = new google.maps.Marker({
              position,
              map,
              title: place.name || 'Unknown',
              animation: google.maps.Animation.DROP
            });

            marker.addListener('click', () => {
              handleMarkerClick(place);
            });

            return marker;
          } catch (e) {
            console.error('Error creating marker:', e, place);
            return null;
          }
        }).filter(m => m !== null);

        try {
          clustererRef.current = new markerClustererLibRef.current.MarkerClusterer({
            map,
            markers
          });
          googleMarkersRef.current = markers;
        } catch (e) {
          console.error('Error creating clusterer:', e);
          // Fallback to individual markers
          markers.forEach(m => newMarkers.push(m));
          googleMarkersRef.current = markers;
        }
      } else {
        // For < 5 markers, add individually
        safeResults.forEach(place => {
          try {
            const position = {
              lat: parseFloat(place.lat || place.latitude),
              lng: parseFloat(place.lon || place.longitude)
            };

            if (isNaN(position.lat) || isNaN(position.lng)) {
              console.warn('Invalid coordinates for place:', place);
              return;
            }

            const marker = new google.maps.Marker({
              position,
              map,
              title: place.name || 'Unknown',
              animation: google.maps.Animation.DROP
            });

            marker.addListener('click', () => {
              handleMarkerClick(place);
            });

            newMarkers.push(marker);
            googleMarkersRef.current.push(marker);
          } catch (e) {
            console.error('Error creating marker:', e, place);
          }
        });
      }

      setMarkers(newMarkers);
    } catch (error) {
      console.error('Error in markers useEffect:', error);
      // Don't throw - just log the error
    }
  }, [results, map, clearAllMarkers]);

  // Show API key warning if not set
  if (!API_KEY || API_KEY === 'YOUR_API_KEY' || API_KEY.trim() === '') {
    return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '40px',
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        textAlign: 'center'
      }}>
              <div style={{ 
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          maxWidth: '600px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '800', 
            color: '#000000',
            marginBottom: '16px'
          }}>
            Google Maps API Key Required
          </h1>
          <p style={{ 
            fontSize: '1rem', 
            color: '#000000',
            marginBottom: '24px',
            lineHeight: '1.6'
          }}>
            To use this application, you need to set up a Google Maps API key.
          </p>
                  <div style={{ 
            background: '#f3f4f6',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '800', 
              color: '#000000',
              marginBottom: '12px'
            }}>
              Quick Setup:
            </h3>
            <ol style={{ 
              fontSize: '0.9375rem', 
              color: '#000000',
              lineHeight: '1.8',
              paddingLeft: '20px',
              margin: 0
            }}>
              <li style={{ marginBottom: '8px' }}>Get API key from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontWeight: '700', textDecoration: 'underline' }}>Google Cloud Console</a></li>
              <li style={{ marginBottom: '8px' }}>Enable <strong>Maps JavaScript API</strong> and <strong>Places API</strong></li>
              <li style={{ marginBottom: '8px' }}>Create <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.875rem' }}>.env</code> file in <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.875rem' }}>frontend-react/</code></li>
              <li style={{ marginBottom: '8px' }}>Add: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.875rem' }}>REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here</code></li>
              <li>Restart the development server</li>
            </ol>
          </div>
          <p style={{ 
            fontSize: '0.875rem', 
            color: '#6b7280',
            fontWeight: '600'
          }}>
            See <strong>GOOGLE_MAPS_SETUP.md</strong> for detailed instructions
          </p>
        </div>
      </div>
    );
  }

  if (checkingAuth) {
    return (
      <div style={{
                        display: 'flex',
        justifyContent: 'center',
                        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: 'var(--text-secondary)'
      }}>
        Checking authentication...
      </div>
    );
  }

  // Show login/signup page first if user is not authenticated
  // Only show main app after successful login
  if (!userAccount && !authenticated) {
    return (
      <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
        <Login onLoginSuccess={handleLoginSuccess} />
                  </div>
    );
  }

  return (
    <div className="App">
      {/* Top Navigation Bar */}
      <NavBar
        userAccount={userAccount}
        userRole={userRole}
        userPermissions={userPermissions}
        onShowGroups={() => {
                  setShowGroups(true);
                  setActiveListView(null);
                  setSelectedGroupId(null);
                }}
        onLoadPersonalList={loadPersonalList}
        onShowUserAuth={() => {
                  setUserAuthKey(prev => prev + 1);
                  setShowUserAuth(true);
                }}
        onLogout={handleLogout}
        activeListView={activeListView}
        onResetToSearch={resetToSearchMode}
        onLoadPermissionDetails={loadPermissionDetails}
        onEnableAddMode={handleEnableAddMode}
        addingLocation={addingLocation}
        onCSVUpload={handleCSVUpload}
        uploadingCSV={uploadingCSV}
        fileInputRef={fileInputRef}
      />

      {/* User Panel removed - all functionality moved to NavBar */}

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
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowGroups(false);
            setSelectedGroupId(null);
          }
        }}
        >
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '0',
            maxWidth: '800px',
            width: '50%',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowGroups(false);
                setSelectedGroupId(null);
                setGroupPlacesMode(false);
                resetToSearchMode();
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--gray-200)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'var(--error)';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'var(--gray-200)';
                e.target.style.color = 'inherit';
              }}
            >
              ×
            </button>
            {selectedGroupId ? (
              <GroupPlaces
                groupId={selectedGroupId}
                onBack={() => {
                  setSelectedGroupId(null);
                  setGroupPlacesMode(false);
                }}
                onShowOnMap={(places) => {
                    setGroupPlacesMode(true);
                  setResults(Array.isArray(places) ? places : []);
                    setShowGroups(false);
                }}
              />
            ) : (
              <Groups
                onSelectGroup={(groupId) => {
                  setSelectedGroupId(groupId);
                }}
                onViewGroupPlaces={(groupId) => {
                  console.log('📍 View Group Places clicked for group:', groupId);
                  setSelectedGroupId(groupId);
                }}
                onClose={() => {
                  setShowGroups(false);
                  setSelectedGroupId(null);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Add Location Form */}
      {showAddForm && newLocationCoords && (
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
              justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancelAdd();
          }
        }}
        >
        <div style={{
          background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Add New Location</h2>
            <form onSubmit={handleAddLocation}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Name *
              </label>
              <input
                type="text"
                value={newLocationData.name}
                  onChange={(e) => setNewLocationData({ ...newLocationData, name: e.target.value })}
                required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
              />
            </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                City
              </label>
              <input
                type="text"
                value={newLocationData.city}
                  onChange={(e) => setNewLocationData({ ...newLocationData, city: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
              />
            </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                State
              </label>
              <input
                type="text"
                value={newLocationData.state}
                  onChange={(e) => setNewLocationData({ ...newLocationData, state: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
              />
            </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Place Type
              </label>
              <select
                value={newLocationData.place_type}
                  onChange={(e) => setNewLocationData({ ...newLocationData, place_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                >
                  <option value="brewery">Brewery</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="tourist_place">Tourist Place</option>
                  <option value="hotel">Hotel</option>
              </select>
            </div>

              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--gray-50)', borderRadius: '8px', fontSize: '13px' }}>
                <strong>Coordinates:</strong> {newLocationCoords.lat.toFixed(6)}, {newLocationCoords.lon.toFixed(6)}
              </div>

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
        </div>
      )}

      {API_KEY && API_KEY.trim() !== '' ? (
      <LoadScript
        googleMapsApiKey={API_KEY}
          libraries={['geometry', 'places']}
          loadingElement={<div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            fontSize: '1.2rem',
            color: '#000000',
            fontWeight: '600'
          }}>Loading Google Maps...</div>}
          onLoad={() => {
            console.log('✅ Google Maps API loaded successfully');
            setError(null); // Clear any previous errors
          }}
        onError={(error) => {
            const errorMsg = 'Google Maps API failed to load. Please check your API key and ensure Maps JavaScript API and Places API are enabled in Google Cloud Console.';
            setError(errorMsg);
            console.error('❌ Google Maps API error:', error);
            console.error('💡 Make sure:');
            console.error('   1. API key is correct and not expired');
            console.error('   2. Maps JavaScript API is enabled');
            console.error('   3. Places API is enabled');
            console.error('   4. Billing is enabled on your Google Cloud project');
            console.error('   5. API key restrictions allow localhost:3000');
            console.error('   6. See GOOGLE_MAPS_SETUP.md for detailed instructions');
        }}
      >
        {/* Toggle button for left sidebar (Search Options) */}
        <button
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          style={{
            position: 'absolute',
            top: '76px', // 12px + 64px navbar
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
            loading={loading}
            map={map}
          />
        )}

        {/* Toggle button for right sidebar (Results & Analytics) - Only show when there are results */}
        {(results.length > 0 || showRightSidebar || activeListView) && (
        <button
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          style={{
            position: 'absolute',
              top: '76px', // Below navbar
              right: showRightSidebar ? '424px' : '12px', // Adjust when sidebar is open
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
            title={showRightSidebar ? 'Hide results' : 'Show results'}
        >
            {showRightSidebar ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <span>📊</span>
            )}
        </button>
        )}

        {/* Right Sidebar - Results & Analytics - Only show when there are results or active list */}
        {showRightSidebar && (results.length > 0 || activeListView) && (
          <div
            style={{
              position: 'absolute',
              top: '76px', // Start below navbar (64px + 12px margin)
              right: '12px',
              width: '400px',
              maxHeight: 'calc(100vh - 88px)', // Account for navbar + margins
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              padding: '20px',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              border: '2px solid var(--border-light)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1000,
              animation: 'slideDown 0.3s ease-out'
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
              onClose={() => setShowRightSidebar(false)}
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
              <div style={{
                padding: '20px',
                minWidth: '280px',
                maxWidth: '320px',
                fontFamily: 'var(--font-sans)',
                background: 'white'
              }}>
                <h3 style={{
                  margin: '0 0 10px 0',
                  fontSize: '1.25rem',
                  fontWeight: '900',
                  color: '#000000',
                  lineHeight: '1.3',
                  letterSpacing: '-0.3px'
                }}>
                  {selectedPlace.name || 'Unknown'}
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#000000',
                  fontWeight: '700',
                  border: '1px solid #cbd5e1'
                }}>
                  <span style={{ fontSize: '1rem' }}>📍</span>
                  <span>
                    {[selectedPlace.city, selectedPlace.state].filter(Boolean).join(', ') || 'Location unknown'}
                  </span>
                </div>
                {selectedPlace.distance_km && (
                  <div style={{
                    marginBottom: '16px',
                    fontSize: '0.8125rem',
                    color: '#000000',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>📍</span>
                    <span>{selectedPlace.distance_km.toFixed(1)} km away</span>
                  </div>
                )}
                {userAccount && selectedPlace.list_status && (
                  <div style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '2px solid #e2e8f0'
                  }}>
                    <PlaceListIcons 
                      place={selectedPlace} 
                      listStatus={selectedPlace.list_status}
                      onUpdate={() => {
                        // Refresh the place data to update status
                        const updatedPlace = results.find(p => p.id === selectedPlace.id);
                        if (updatedPlace) {
                          setSelectedPlace({
                            ...updatedPlace,
                            lat: updatedPlace.lat || updatedPlace.latitude,
                            lon: updatedPlace.lon || updatedPlace.longitude
                          });
                        }
                      }}
                    />
                  </div>
                )}
                {!userAccount && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                    borderRadius: '10px',
                    fontSize: '0.8125rem',
                    color: '#000000',
                    textAlign: 'center',
                    fontWeight: '700',
                    border: '2px solid #f59e0b'
                  }}>
                    💡 Login to save places to your lists
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '1.2rem',
          color: '#000000',
          fontWeight: '600',
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
            <h2 style={{ color: '#000000', marginBottom: '16px' }}>API Key Missing</h2>
            <p style={{ color: '#000000', marginBottom: '24px' }}>
              Please set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              See GOOGLE_MAPS_SETUP.md for instructions
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
