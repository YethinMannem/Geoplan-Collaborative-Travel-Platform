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
import AccountSettings from './components/AccountSettings';
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

const getMapContainerStyle = (selectedGroupId) => ({
  width: '100vw',
  height: '100vh',
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: selectedGroupId ? 1 : 1 // Keep map at z-index 1 so it's behind modals
});

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
  
  // Filter state for results sidebar
  const [filters, setFilters] = useState({
    placeTypes: [], // Array of selected place types ['brewery', 'restaurant', etc.]
    minRating: 0, // Minimum rating (0 = no filter)
    maxDistance: null, // Maximum distance in km (null = no filter)
    states: [] // Array of selected states
  });
  
  // Restaurant-specific filters (Best 9 filters)
  const [restaurantFilters, setRestaurantFilters] = useState({
    cuisines: [], // Array of selected cuisine types
    priceRanges: [], // Array of selected price ranges ('1', '2', '3', '4')
    ratings: [], // Array of selected ratings ('4', '4.5', '5')
    dietaryOptions: [], // Array of dietary options: 'vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'keto-friendly'
    openNow: false, // Filter for restaurants currently open
    delivery: false,
    takeout: false,
    reservations: false
  });

  // Tourist place filters state
  const [touristFilters, setTouristFilters] = useState({
    categories: [], // Array of selected categories (Park, Museum, Monument, Attraction, etc.)
    entryFee: [], // Array of selected entry fee ranges ('free', '1-10', '11-25', '25+')
    ratings: [], // Array of selected ratings ('4', '4.5', '5')
    familyFriendly: false,
    accessibility: false,
    petFriendly: false,
    openNow: false,
    guidedTours: false
  });
  
  // Groups state
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupsViewState, setGroupsViewState] = useState(null);
  
  // Account Settings state
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  
  // User header card toggle
  const [showUserHeader, setShowUserHeader] = useState(false); // Hidden by default - using NavBar instead

  // Sidebar toggles
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);  // Search Options
  const [showRightSidebar, setShowRightSidebar] = useState(false); // Results & Analytics - only show when there are results
  
  // Right sidebar width (resizable)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('rightSidebarWidth');
    return saved ? parseInt(saved, 10) : 400;
  });
  const [isResizing, setIsResizing] = useState(false);

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
  const routePolylineRef = useRef(null);

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
        // Silently handle clusterer cleanup errors
      }
      clustererRef.current = null;
    }
    
    // Clear polyline if it exists
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  }, []);

  // Check authentication status on mount (prioritize user account)
  useEffect(() => {
    // Check user account first (primary auth method)
    checkUserAuth();
    // Also check role-based auth (for backward compatibility)
    checkAuth();
  }, []);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX - 20; // 20px for right margin
      const minWidth = 300;
      const maxWidth = 800;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      setRightSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('rightSidebarWidth', String(rightSidebarWidth));
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, rightSidebarWidth]);

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
        // MarkerClusterer library failed to load - will use individual markers instead
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

  /**
   * Apply all filters to place results
   * Filters include: place type, rating, distance, state, restaurant-specific, and tourist-specific filters
   * @param {Array} places - Array of place objects to filter
   * @returns {Array} Filtered array of places
   */
  const applyFilters = (places) => {
    let filtered = Array.isArray(places) ? places : [];
    
    // Filter by place type
    if (filters.placeTypes.length > 0) {
      filtered = filtered.filter(place => 
        place.place_type && filters.placeTypes.includes(place.place_type)
      );
    }
    
    // Filter by minimum rating
    if (filters.minRating > 0) {
      filtered = filtered.filter(place => {
        const rating = place.rating;
        if (rating === null || rating === undefined) return false;
        const ratingNum = typeof rating === 'number' ? rating : Number(rating);
        return !isNaN(ratingNum) && ratingNum >= filters.minRating;
      });
    }
    
    // Filter by maximum distance
    if (filters.maxDistance !== null && filters.maxDistance > 0) {
      filtered = filtered.filter(place => {
        if (!place.distance_km) return false;
        return place.distance_km <= filters.maxDistance;
      });
    }
    
    // Filter by state
    if (filters.states.length > 0) {
      filtered = filtered.filter(place => 
        place.state && filters.states.includes(place.state)
      );
    }
    
    // Apply restaurant-specific filters (only for restaurants)
    const hasRestaurantResults = filtered.some(p => p.place_type === 'restaurant');
    const hasActiveRestaurantFilters = 
      restaurantFilters.cuisines.length > 0 ||
      restaurantFilters.priceRanges.length > 0 ||
      restaurantFilters.ratings.length > 0 ||
      restaurantFilters.dietaryOptions.length > 0 ||
      restaurantFilters.openNow ||
      restaurantFilters.delivery ||
      restaurantFilters.takeout ||
      restaurantFilters.reservations;
    
    if (hasRestaurantResults && hasActiveRestaurantFilters) {
      filtered = filtered.filter(place => {
        if (place.place_type !== 'restaurant') return true; // Keep non-restaurants
        
        // Filter by cuisine types
        if (restaurantFilters.cuisines.length > 0) {
          const placeCuisine = (place.cuisine_type || '').toLowerCase();
          if (!placeCuisine) return false;
          
          const placeCuisines = placeCuisine.split(/[,;]/).map(c => c.trim());
          const matchesCuisine = restaurantFilters.cuisines.some(filterCuisine => {
            const filterLower = filterCuisine.toLowerCase();
            return placeCuisines.some(pc => pc === filterLower || pc.includes(filterLower) || filterLower.includes(pc));
          });
          if (!matchesCuisine) return false;
        }
        
        // Filter by price ranges
        // Note: If price_range is NULL, we include the restaurant (don't filter it out)
        // This allows restaurants without price data to still be shown
        if (restaurantFilters.priceRanges.length > 0) {
          const placePriceRange = place.price_range;
          // Only filter if the restaurant has price_range data
          if (placePriceRange !== null && placePriceRange !== undefined) {
            const placePriceStr = String(placePriceRange);
            if (!restaurantFilters.priceRanges.includes(placePriceStr)) return false;
          }
          // If price_range is NULL/undefined, allow it through (don't filter out)
        }
        
        // Filter by ratings
        if (restaurantFilters.ratings.length > 0) {
          const rating = place.rating;
          const ratingNum = rating ? (typeof rating === 'number' ? rating : parseFloat(rating)) : 0;
          if (isNaN(ratingNum)) return false;
          
          const matchesRating = restaurantFilters.ratings.some(r => {
            const minRating = parseFloat(r);
            return ratingNum >= minRating;
          });
          if (!matchesRating) return false;
        }
        
        // Filter by dietary options
        // Note: If dietary_options is NULL/empty, we include the restaurant (don't filter it out)
        // This allows restaurants without dietary data to still be shown
        if (restaurantFilters.dietaryOptions.length > 0) {
          // Only filter if the restaurant has dietary_options data
          if (place.dietary_options !== null && place.dietary_options !== undefined) {
            const placeDietary = Array.isArray(place.dietary_options) ? place.dietary_options : 
                                 (place.dietary_options ? [place.dietary_options] : []);
            // If we have data but it's empty array, allow it through
            if (placeDietary.length > 0) {
              const placeDietaryLower = placeDietary.map(d => String(d).toLowerCase());
              const matchesDietary = restaurantFilters.dietaryOptions.some(filterDietary => {
                const filterLower = filterDietary.toLowerCase();
                return placeDietaryLower.some(pd => pd === filterLower || pd.includes(filterLower));
              });
              if (!matchesDietary) return false;
            }
          }
          // If dietary_options is NULL/undefined/empty, allow it through (don't filter out)
        }

        // Filter by open now (check if current time is within hours_of_operation)
        // Note: If hours_of_operation is NULL, we include the restaurant (don't filter it out)
        // This allows restaurants without hours data to still be shown
        if (restaurantFilters.openNow) {
          // Only filter if the restaurant has hours_of_operation data
          if (place.hours_of_operation) {
            // Simple check: if hours exist, consider it potentially open
            // Note: Full implementation would require parsing hours string and checking current time
            // For now, just check if hours data exists - if it does, allow it through
          }
          // If hours_of_operation is NULL/undefined, allow it through (don't filter out)
        }

        // Filter by delivery
        // Note: If delivery is NULL, we include the restaurant (don't filter it out)
        // This allows restaurants without delivery data to still be shown
        if (restaurantFilters.delivery) {
          // Only filter if the restaurant has delivery data and it's false
          if (place.delivery !== null && place.delivery !== undefined && !place.delivery) {
            return false;
          }
          // If delivery is null/undefined, allow it through
          // If delivery is true, allow it through
        }

        // Filter by takeout
        // Note: If takeout is NULL, we include the restaurant (don't filter it out)
        if (restaurantFilters.takeout) {
          // Only filter if the restaurant has takeout data and it's false
          if (place.takeout !== null && place.takeout !== undefined && !place.takeout) {
            return false;
          }
          // If takeout is null/undefined, allow it through
          // If takeout is true, allow it through
        }

        // Filter by reservations
        // Note: If reservations is NULL, we include the restaurant (don't filter it out)
        if (restaurantFilters.reservations) {
          // Only filter if the restaurant has reservations data and it's false
          if (place.reservations !== null && place.reservations !== undefined && !place.reservations) {
            return false;
          }
          // If reservations is null/undefined, allow it through
          // If reservations is true, allow it through
        }
        
        return true;
      });
    }
    
    // Apply tourist place-specific filters (only for tourist places)
    const hasTouristResults = filtered.some(p => p.place_type === 'tourist_place');
    const hasActiveTouristFilters = 
      touristFilters.categories.length > 0 ||
      touristFilters.entryFee.length > 0 ||
      touristFilters.ratings.length > 0 ||
      touristFilters.familyFriendly ||
      touristFilters.accessibility ||
      touristFilters.petFriendly ||
      touristFilters.openNow ||
      touristFilters.guidedTours;
    
    if (hasTouristResults && hasActiveTouristFilters) {
      filtered = filtered.filter(place => {
        if (place.place_type !== 'tourist_place') return true; // Keep non-tourist places
        
        // Filter by category/type
        if (touristFilters.categories.length > 0) {
          const placeType = place.tourist_type;
          // If tourist_type is null/undefined/empty, exclude it when filter is active
          // (we can't verify it matches the selected category)
          if (!placeType || placeType === null || placeType === undefined || placeType === '') {
            return false;
          }
          
          // Check if the place type matches any of the selected categories
          const placeTypeLower = String(placeType).toLowerCase().trim();
          const matchesCategory = touristFilters.categories.some(filterCategory => {
            const filterLower = String(filterCategory).toLowerCase().trim();
            // Exact match or contains match
            return placeTypeLower === filterLower || 
                   placeTypeLower.includes(filterLower) || 
                   filterLower.includes(placeTypeLower);
          });
          if (!matchesCategory) return false;
        }
        
        // Filter by entry fee
        if (touristFilters.entryFee.length > 0) {
          const entryFee = place.entry_fee;
          if (entryFee === null || entryFee === undefined) {
            // If NULL, only show if "free" is selected
            if (!touristFilters.entryFee.includes('free')) return false;
          } else {
            const feeNum = typeof entryFee === 'number' ? entryFee : parseFloat(entryFee);
            if (isNaN(feeNum)) {
              if (!touristFilters.entryFee.includes('free')) return false;
            } else {
              let matchesFee = false;
              if (touristFilters.entryFee.includes('free') && feeNum === 0) matchesFee = true;
              if (touristFilters.entryFee.includes('1-10') && feeNum > 0 && feeNum <= 10) matchesFee = true;
              if (touristFilters.entryFee.includes('11-25') && feeNum > 10 && feeNum <= 25) matchesFee = true;
              if (touristFilters.entryFee.includes('25+') && feeNum > 25) matchesFee = true;
              if (!matchesFee) return false;
            }
          }
        }
        
        // Filter by ratings
        if (touristFilters.ratings.length > 0) {
          const rating = place.rating;
          const ratingNum = rating ? (typeof rating === 'number' ? rating : parseFloat(rating)) : 0;
          if (isNaN(ratingNum)) return false;
          
          const matchesRating = touristFilters.ratings.some(r => {
            const minRating = parseFloat(r);
            return ratingNum >= minRating;
          });
          if (!matchesRating) return false;
        }
        
        // Filter by family friendly
        // When filter is selected, only show places where family_friendly is TRUE
        if (touristFilters.familyFriendly) {
          if (!place.family_friendly || place.family_friendly === null || place.family_friendly === undefined) {
            return false;
          }
        }
        
        // Filter by accessibility
        // When filter is selected, only show places where accessibility is TRUE
        if (touristFilters.accessibility) {
          if (!place.accessibility || place.accessibility === null || place.accessibility === undefined) {
            return false;
          }
        }
        
        // Filter by pet friendly
        // When filter is selected, only show places where pet_friendly is TRUE
        if (touristFilters.petFriendly) {
          if (!place.pet_friendly || place.pet_friendly === null || place.pet_friendly === undefined) {
            return false;
          }
        }
        
        // Filter by open now (check tourist_hours)
        // Note: Currently only checks if hours data exists
        // Full implementation would parse hours string and check current time
        if (touristFilters.openNow) {
          if (!place.tourist_hours) {
            // If no hours data, allow it to pass through to avoid filtering out all results
          }
        }
        
        // Filter by guided tours
        // When filter is selected, only show places where guided_tours is TRUE
        if (touristFilters.guidedTours) {
          if (!place.guided_tours || place.guided_tours === null || place.guided_tours === undefined) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    return filtered;
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
        setAuthenticated(true);
        setUserRole(data.role);
        setUserPermissions(data.permissions || []);
      } else {
        setAuthenticated(false);
        // Clear token if auth check fails
        setAuthToken(null);
      }
    } catch (err) {
      // Silently handle auth errors - expected when not logged in
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
        // Silently handle 401/auth errors - they're expected in some cases
        // Silently handle 401 errors (expected when not authenticated)
        if (err.status !== 401 && !err.isAuthError) {
          // Log non-401 errors for debugging
        }
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
      // Silently handle 401 errors - they're expected when not authenticated
      // Silently handle 401 errors (expected when not authenticated)
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
  // Apply search filter and other filters when they change
  useEffect(() => {
    let baseResults = [];
    if (activeListView && allListResults.length > 0) {
      baseResults = allListResults;
    } else if (!activeListView && allSearchResults.length > 0) {
      baseResults = allSearchResults;
    }
    
    // Always apply filters when we have base results
    if (baseResults.length > 0) {
      // First apply search query filter
      let filtered = filterListResults(baseResults, listSearchQuery);
      // Then apply other filters (place type, rating, distance, state, restaurant filters, tourist filters)
      filtered = applyFilters(filtered);
      setResults(filtered);
    } else if (!activeListView && allSearchResults.length === 0 && allListResults.length === 0) {
      // Clear results if we have no base results and no list/search results
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listSearchQuery, activeListView, allListResults, allSearchResults, filters, restaurantFilters, touristFilters]);

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
      const data = await searchPlaces(searchParams);
      
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
      // Store all search results for filtering
      // The useEffect will automatically apply filters and update results
      setAllSearchResults(resultsArray);
      // Also set results immediately (useEffect will re-filter when filters change)
      // This ensures results are shown immediately, then filtered when user selects filters
      let initialFiltered = filterListResults(resultsArray, listSearchQuery);
      initialFiltered = applyFilters(initialFiltered);
      setResults(initialFiltered);
      
      // Automatically show sidebar when search is performed (to show results or error message)
      setShowRightSidebar(true);
      if (resultsArray.length === 0) {
        setError(`No places found. Try increasing the search radius or selecting a different state.`);
      } else {
        setError(null); // Clear any previous errors if we have results
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
      
      // Check if these are route places (have order_index property)
      const isRoutePlaces = safeResults.length > 0 && safeResults.some(p => 
        p.routePlace === true || typeof p.order_index === 'number'
      );
      
      // Sort route places by order_index
      const sortedResults = isRoutePlaces 
        ? [...safeResults].sort((a, b) => {
            const aIdx = a.order_index ?? 0;
            const bIdx = b.order_index ?? 0;
            return aIdx - bIdx;
          })
        : safeResults;

      // For route places, create numbered markers and polyline
      if (isRoutePlaces) {
        const routePositions = [];
        const markers = sortedResults.map((place, index) => {
          try {
            const position = {
              lat: parseFloat(place.lat || place.latitude),
              lng: parseFloat(place.lon || place.longitude)
            };

            if (isNaN(position.lat) || isNaN(position.lng)) {
              return null;
            }
            
            routePositions.push(position);

            // Create numbered marker for route places
            const marker = new google.maps.Marker({
              position,
              map,
              title: `${index + 1}. ${place.name || 'Unknown'}`,
              animation: google.maps.Animation.DROP,
              label: {
                text: String(index + 1),
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#6366f1',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2
              }
            });

            marker.addListener('click', () => {
              handleMarkerClick(place);
            });

            return marker;
          } catch (e) {
            return null;
          }
        }).filter(m => m !== null);
        
        // Create polyline connecting route places
        if (routePositions.length > 1) {
          routePolylineRef.current = new google.maps.Polyline({
            path: routePositions,
            geodesic: true,
            strokeColor: '#6366f1',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map: map
          });
        }
        
        // Fit map bounds to show all route places
        if (routePositions.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          routePositions.forEach(pos => bounds.extend(pos));
          map.fitBounds(bounds, {
            padding: 80 // Add padding around the bounds
          });
        }
        
        googleMarkersRef.current = markers;
        newMarkers.push(...markers);
      } else if (sortedResults.length >= 5 && markerClustererLibRef.current) {
        // For 5+ non-route markers, use clustering
        const markers = sortedResults.map(place => {
          try {
            const position = {
              lat: parseFloat(place.lat || place.latitude),
              lng: parseFloat(place.lon || place.longitude)
            };

            if (isNaN(position.lat) || isNaN(position.lng)) {
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
          // Fallback to individual markers if clustering fails
          markers.forEach(m => newMarkers.push(m));
          googleMarkersRef.current = markers;
        }
      } else {
        // For < 5 markers, add individually
        sortedResults.forEach(place => {
          try {
            const position = {
              lat: parseFloat(place.lat || place.latitude),
              lng: parseFloat(place.lon || place.longitude)
            };

            if (isNaN(position.lat) || isNaN(position.lng)) {
              // Skip places with invalid coordinates
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
      // Silently handle marker creation errors to prevent UI crashes
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
        onShowAccountSettings={() => setShowAccountSettings(true)}
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

      {/* Account Settings Modal */}
      {showAccountSettings && userAccount && (
        <AccountSettings
          onClose={() => setShowAccountSettings(false)}
          onUpdate={(updatedUser) => {
            // Update userAccount state with new profile data
            setUserAccount(prev => ({
              ...prev,
              ...updatedUser
            }));
          }}
        />
      )}

      {/* Groups Modal */}
      {showGroups && (
        !selectedGroupId ? (
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
            alignItems: 'flex-start',
            padding: '104px 20px 20px 20px',
            pointerEvents: 'auto'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGroups(false);
              setSelectedGroupId(null);
            }
          }}
          >
            <div style={{
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '24px',
              padding: '0',
              width: '75vw',
              maxHeight: '90vh',
              overflow: 'hidden',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
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
                  top: '14px',
                  right: '14px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  fontWeight: '300',
                  lineHeight: '1'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.target.style.color = '#dc2626';
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.5)';
                  e.target.style.color = '#64748b';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                ×
              </button>
              <Groups
                onSelectGroup={(groupId) => {
                  setSelectedGroupId(groupId);
                }}
                onViewGroupPlaces={(groupId) => {
                  setSelectedGroupId(groupId);
                }}
                onClose={() => {
                  setShowGroups(false);
                  setSelectedGroupId(null);
                  setGroupsViewState(null);
                }}
                initialGroupIdToShow={groupsViewState?.showGroupDetails}
              />
            </div>
          </div>
        ) : (
          <div style={{
            position: 'fixed',
            top: '84px',
            left: 0,
            width: '100vw',
            height: 'calc(100vh - 84px)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto'
          }}>
            <div style={{
              pointerEvents: 'auto',
              background: 'transparent',
              padding: '0',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
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
                  top: '14px',
                  right: '14px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  fontWeight: '300',
                  lineHeight: '1'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.target.style.color = '#dc2626';
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.5)';
                  e.target.style.color = '#64748b';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                ×
              </button>
              <GroupPlaces
                groupId={selectedGroupId}
                onBack={() => {
                  setSelectedGroupId(null);
                  setGroupPlacesMode(false);
                }}
                onBackToGroupDetails={() => {
                  setSelectedGroupId(null);
                  setGroupPlacesMode(false);
                  setGroupsViewState({ showGroupDetails: selectedGroupId });
                }}
                onShowOnMap={(places, title) => {
                    setGroupPlacesMode(true);
                  setResults(Array.isArray(places) ? places : []);
                    if (!places || places.length === 0) {
                    }
                }}
                showRoutePlannerInModal={true}
              />
            </div>
          </div>
        )
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
            setError(null);
          }}
        onError={(error) => {
            setError('Google Maps API failed to load. Please check your API key and ensure Maps JavaScript API and Places API are enabled. See GOOGLE_MAPS_SETUP.md for instructions.');
        }}
      >
        {/* Toggle button for left sidebar (Search Options) */}
        <button
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          style={{
            position: 'absolute',
            top: '104px', // 20px (navbar top) + 64px (navbar height) + 20px (spacing)
            left: '20px',
            zIndex: 1001,
            width: '40px',
            height: '40px',
            /* Glassmorphism Effect */
            background: showLeftSidebar 
              ? 'rgba(255, 255, 255, 0.6)' 
              : 'rgba(99, 102, 241, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: showLeftSidebar ? '#64748b' : 'white',
            border: showLeftSidebar 
              ? '1px solid rgba(255, 255, 255, 0.4)' 
              : '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxShadow: showLeftSidebar 
              ? '0 4px 16px rgba(31, 38, 135, 0.1)' 
              : '0 4px 16px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.2s ease',
            fontWeight: '300'
          }}
          onMouseEnter={(e) => {
            if (showLeftSidebar) {
              e.target.style.background = 'rgba(239, 68, 68, 0.8)';
              e.target.style.color = 'white';
              e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            } else {
              e.target.style.background = 'rgba(99, 102, 241, 0.9)';
              e.target.style.borderColor = 'rgba(99, 102, 241, 0.6)';
            }
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 6px 20px rgba(31, 38, 135, 0.2)';
          }}
          onMouseLeave={(e) => {
            if (showLeftSidebar) {
              e.target.style.background = 'rgba(255, 255, 255, 0.6)';
              e.target.style.color = '#64748b';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              e.target.style.boxShadow = '0 4px 16px rgba(31, 38, 135, 0.1)';
            } else {
              e.target.style.background = 'rgba(99, 102, 241, 0.8)';
              e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
              e.target.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.3)';
            }
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
              top: '104px', // 20px (navbar top) + 64px (navbar height) + 20px (spacing)
              right: showRightSidebar ? `${rightSidebarWidth + 24}px` : '20px', // Adjust when sidebar is open (width + gap)
            zIndex: 1001,
            width: '40px',
            height: '40px',
            /* Glassmorphism Effect */
            background: showRightSidebar 
              ? 'rgba(255, 255, 255, 0.6)' 
              : 'rgba(99, 102, 241, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: showRightSidebar ? '#64748b' : 'white',
            border: showRightSidebar 
              ? '1px solid rgba(255, 255, 255, 0.4)' 
              : '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxShadow: showRightSidebar 
              ? '0 4px 16px rgba(31, 38, 135, 0.1)' 
              : '0 4px 16px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.2s ease',
            fontWeight: '300'
          }}
          onMouseEnter={(e) => {
            if (showRightSidebar) {
              e.target.style.background = 'rgba(239, 68, 68, 0.8)';
              e.target.style.color = 'white';
              e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            } else {
              e.target.style.background = 'rgba(99, 102, 241, 0.9)';
              e.target.style.borderColor = 'rgba(99, 102, 241, 0.6)';
            }
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 6px 20px rgba(31, 38, 135, 0.2)';
          }}
          onMouseLeave={(e) => {
            if (showRightSidebar) {
              e.target.style.background = 'rgba(255, 255, 255, 0.6)';
              e.target.style.color = '#64748b';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              e.target.style.boxShadow = '0 4px 16px rgba(31, 38, 135, 0.1)';
            } else {
              e.target.style.background = 'rgba(99, 102, 241, 0.8)';
              e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
              e.target.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.3)';
            }
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

        {/* Right Sidebar - Results & Analytics - Show when sidebar is open (has results, error, or active list) */}
        {showRightSidebar && (
          <div
            style={{
              position: 'absolute',
              top: '104px', // 20px (navbar top) + 64px (navbar height) + 20px (spacing)
              right: '20px',
              width: `${rightSidebarWidth}px`,
              maxHeight: 'calc(100vh - 144px)', // Account for navbar + margins
              /* Glassmorphism Effect */
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              borderRadius: '20px',
              padding: '24px',
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
            {/* Resize Handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                cursor: 'col-resize',
                zIndex: 1001,
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
              }}
              onMouseLeave={(e) => {
                if (!isResizing) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            />
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
              filters={filters}
              onFiltersChange={setFilters}
              allResults={activeListView ? allListResults : allSearchResults}
              restaurantFilters={restaurantFilters}
              onRestaurantFiltersChange={setRestaurantFilters}
              touristFilters={touristFilters}
              onTouristFiltersChange={setTouristFilters}
              noPosition={true}
              activeListView={activeListView}
              listSearchQuery={listSearchQuery}
              onListSearchChange={setListSearchQuery}
              onClose={() => setShowRightSidebar(false)}
            />
          </div>
        )}

        <GoogleMap
          mapContainerStyle={getMapContainerStyle(selectedGroupId)}
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
