import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { getGroupPlaces, getGroupDetails, getGroupRoute, saveGroupRoute, removeRoutePlace } from '../services/userListsApi';
import ModernFilterDropdown from './ModernFilterDropdown';
import './GroupPlaces.css';

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

function GroupPlaces({ groupId, onBack, onBackToGroupDetails, onShowOnMap, isShownOnMap = false, showRoutePlannerInModal = false }) {
  const [group, setGroup] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter state: { userId: Set([status1, status2, ...]) }
  const [memberFilters, setMemberFilters] = useState({});
  // Place type filter: Set of selected place types
  const [placeTypeFilter, setPlaceTypeFilter] = useState(new Set(['brewery', 'restaurant', 'tourist_place', 'hotel']));

  // New simplified filter state
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  
  // Route planner state
  const [routePlaces, setRoutePlaces] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [routeChanged, setRouteChanged] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showRoutePlanner, setShowRoutePlanner] = useState(true); // Show by default
  const [routeShownOnMap, setRouteShownOnMap] = useState(true); // Auto-show on map when places added
  const [showAvailablePlaces, setShowAvailablePlaces] = useState(true); // Show available places to add
  const [routeMap, setRouteMap] = useState(null); // Map instance for route planner
  const [mapsLoaded, setMapsLoaded] = useState(false); // Track if Google Maps API is loaded
  const routePolylineRef = useRef(null); // Reference to polyline for cleanup

  useEffect(() => {
    if (groupId) {
      loadGroupDetails();
      loadGroupPlaces();
      loadRoute();
    }
  }, [groupId]);
  
  const loadRoute = async () => {
    if (!groupId) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const response = await getGroupRoute(groupId);
      if (response && response.success) {
        setRoutePlaces(response.places || []);
        setRouteChanged(false);
      } else {
        // If no route exists, initialize with empty array
        setRoutePlaces([]);
        setRouteChanged(false);
      }
    } catch (err) {
      // Silently handle errors - route may not exist yet, which is fine
      // Only show error if it's not a 404 (which means route doesn't exist yet)
      if (err.status !== 404 && err.message && !err.message.includes('not found')) {
        setRouteError(err.message || 'Failed to load route');
      } else {
        // Route doesn't exist yet - this is normal for new groups
        setRoutePlaces([]);
        setRouteChanged(false);
      }
    } finally {
      setRouteLoading(false);
    }
  };
  
  const handleAddToRoute = (place) => {
    // Check if place is already in route
    const exists = routePlaces.some(rp => rp.place_id === place.id);
    if (exists) return;
    
    // Validate that place has coordinates
    if (!place.lat || !place.lon) {
      setRouteError('Cannot add place: missing coordinates');
      return;
    }
    
    const newRoutePlace = {
      place_id: place.id,
      name: place.name || 'Unknown',
      city: place.city || '',
      state: place.state || '',
      country: place.country || '',
      lat: parseFloat(place.lat),
      lon: parseFloat(place.lon),
      place_type: place.place_type || 'unknown',
      order_index: routePlaces.length
    };
    
    const newRoutePlaces = [...routePlaces, newRoutePlace];
    setRoutePlaces(newRoutePlaces);
    setRouteChanged(true);
    
    // Automatically show on map when first place is added
    if (routePlaces.length === 0) {
      setRouteShownOnMap(true);
    }
  };
  
  const handleRemoveFromRoute = (placeId) => {
    const newPlaces = routePlaces
      .filter(rp => rp.place_id !== placeId)
      .map((rp, idx) => ({ ...rp, order_index: idx }));
    setRoutePlaces(newPlaces);
    setRouteChanged(true);
  };
  
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };
  
  const handleDragOver = (e, index) => {
    e.preventDefault();
  };
  
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    
    const newPlaces = [...routePlaces];
    const draggedPlace = newPlaces[draggedIndex];
    
    // Remove dragged item
    newPlaces.splice(draggedIndex, 1);
    
    // Insert at drop position
    newPlaces.splice(dropIndex, 0, draggedPlace);
    
    // Update order indices
    const reordered = newPlaces.map((rp, idx) => ({
      ...rp,
      order_index: idx
    }));
    
    setRoutePlaces(reordered);
    setRouteChanged(true);
    setDraggedIndex(null);
  };
  
  // Handle drag from available places to route
  const [draggedAvailablePlace, setDraggedAvailablePlace] = useState(null);
  
  const handleDragStartAvailable = (place, index) => {
    setDraggedAvailablePlace({ place, index });
  };
  
  const handleDropOnRoute = (e, dropIndex) => {
    e.preventDefault();
    if (!draggedAvailablePlace) return;
    
    const place = draggedAvailablePlace.place;
    
    // Check if already in route
    if (routePlaces.some(rp => rp.place_id === place.id)) {
      setDraggedAvailablePlace(null);
      return;
    }
    
    // Validate coordinates
    if (!place.lat || !place.lon) {
      setDraggedAvailablePlace(null);
      return;
    }
    
    const newRoutePlace = {
      place_id: place.id,
      name: place.name || 'Unknown',
      city: place.city || '',
      state: place.state || '',
      country: place.country || '',
      lat: parseFloat(place.lat),
      lon: parseFloat(place.lon),
      place_type: place.place_type || 'unknown',
      order_index: dropIndex
    };
    
    // Insert at drop position
    const newPlaces = [...routePlaces];
    newPlaces.splice(dropIndex, 0, newRoutePlace);
    
    // Update order indices
    const reordered = newPlaces.map((rp, idx) => ({
      ...rp,
      order_index: idx
    }));
    
    setRoutePlaces(reordered);
    setRouteChanged(true);
    setDraggedAvailablePlace(null);
    
    // Automatically show on map when first place is added
    if (routePlaces.length === 0) {
      setRouteShownOnMap(true);
    }
  };
  
  const handleSaveRoute = async () => {
    if (!groupId) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const placesPayload = routePlaces.map((rp, idx) => ({
        place_id: rp.place_id,
        order_index: idx
      }));
      
      await saveGroupRoute(groupId, placesPayload, false); // User customization
      setRouteChanged(false);
    } catch (err) {
      setRouteError(err.message || 'Failed to save route');
    } finally {
      setRouteLoading(false);
    }
  };
  
  // Function to update map with route places (automatically called when route changes)
  const updateMapWithRoute = () => {
    if (!onShowOnMap) return;
    
    // Don't update map if route is empty - let user build route first
    if (routePlaces.length === 0) {
      setRouteShownOnMap(false);
      return;
    }
    
    const validPlaces = routePlaces.filter(rp => rp.lat != null && rp.lon != null);
    
    // Only show map if we have valid places with coordinates
    if (validPlaces.length > 0) {
      const mapPlaces = validPlaces.map((rp, idx) => ({
        id: rp.place_id,
        name: rp.name || 'Unknown',
        city: rp.city || '',
        state: rp.state || '',
        country: rp.country || '',
        lat: parseFloat(rp.lat),
        lon: parseFloat(rp.lon),
        place_type: rp.place_type || 'unknown',
        routePlace: true,
        order_index: idx // Use array index as order
      }));
      
      onShowOnMap(mapPlaces, `${group?.name || 'Group'} Route`);
      setRouteShownOnMap(true);
    } else {
      // No valid places with coordinates - don't show map
      setRouteShownOnMap(false);
    }
  };
  
  // Update map bounds when route places change
  useEffect(() => {
    if (!routeMap || routePlaces.length === 0) return;
    
    const validPlaces = routePlaces.filter(rp => rp.lat && rp.lon);
    if (validPlaces.length === 0) return;
    
    const bounds = new window.google.maps.LatLngBounds();
    validPlaces.forEach(rp => {
      bounds.extend({ lat: rp.lat, lng: rp.lon });
    });
    
    if (!bounds.isEmpty()) {
      routeMap.fitBounds(bounds, { padding: 80 });
    }
  }, [routePlaces, routeMap]);

  // Listen for place list updates and refresh
  useEffect(() => {
    if (!groupId) return;
    
    const handlePlaceUpdate = () => {
      console.log('📍 Place list updated, refreshing group places...');
      setTimeout(() => loadGroupPlaces(), 1000);
    };
    
    window.addEventListener('placeListUpdated', handlePlaceUpdate);
    return () => window.removeEventListener('placeListUpdated', handlePlaceUpdate);
  }, [groupId]);

  // Extract unique members from places
  const allMembers = useMemo(() => {
    const memberMap = new Map();
    places.forEach(place => {
      place.members?.forEach(member => {
        if (!memberMap.has(member.user_id)) {
          memberMap.set(member.user_id, {
            user_id: member.user_id,
            username: member.username
          });
        }
      });
    });
    return Array.from(memberMap.values());
  }, [places]);

  // Initialize member filters when members change
  useEffect(() => {
    if (allMembers.length > 0 && Object.keys(memberFilters).length === 0) {
      const initialFilters = {};
      allMembers.forEach(member => {
        initialFilters[String(member.user_id)] = new Set(['visited', 'in_wishlist', 'liked', 'none']);
      });
      setMemberFilters(initialFilters);
    }
  }, [allMembers, memberFilters]);

  // Sync selectedMembers to memberFilters
  useEffect(() => {
    if (selectedMembers.length > 0) {
      const newFilters = {};
      selectedMembers.forEach(userIdStr => {
        newFilters[userIdStr] = memberFilters[userIdStr] || new Set(selectedStatuses.length > 0 ? selectedStatuses : ['visited', 'in_wishlist', 'liked', 'none']);
      });
      setMemberFilters(newFilters);
    } else {
      setMemberFilters({});
    }
  }, [selectedMembers]);

  // Update status filters for all selected members
  useEffect(() => {
    if (selectedStatuses.length > 0 && selectedMembers.length > 0) {
      const newFilters = { ...memberFilters };
      selectedMembers.forEach(userIdStr => {
        if (newFilters[userIdStr]) {
          newFilters[userIdStr] = new Set(selectedStatuses);
        }
      });
      setMemberFilters(newFilters);
    }
  }, [selectedStatuses]);

  const loadGroupDetails = async () => {
    try {
      const response = await getGroupDetails(groupId);
      setGroup(response.group);
    } catch (err) {
      setError(err.message || 'Failed to load group details');
    }
  };

  const loadGroupPlaces = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`🔄 Loading group places for group ${groupId}...`);
      const response = await getGroupPlaces(groupId);
      console.log(`✅ Received ${response.places?.length || 0} places from backend`);
      setPlaces(response.places || []);
      if (response.places && response.places.length === 0) {
        console.log('⚠️ No places found. Make sure you have added places to your personal lists (visited, wishlist, or liked).');
      }
    } catch (err) {
      console.error('❌ Error loading group places:', err);
      setError(err.message || 'Failed to load group places');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadges = (member) => {
    const badges = [];
    if (member.visited) badges.push({ icon: '✓', label: 'Visited', color: '#10b981' });
    if (member.in_wishlist) badges.push({ icon: '⭐', label: 'Wishlist', color: '#f59e0b' });
    if (member.liked) badges.push({ icon: '❤️', label: 'Liked', color: '#ec4899' });
    return badges;
  };

  // Filter places based on selected members, statuses, and place types
  const filteredPlaces = useMemo(() => {
    if (selectedMembers.length === 0) {
      return [];
    }

    return places.filter(place => {
      // First check place type filter
      const placeType = place.place_type || 'unknown';
      if (placeTypeFilter.size > 0 && !placeTypeFilter.has(placeType)) {
        return false;
      }

      // Then check member and status filters
      return selectedMembers.some(userIdStr => {
        const userId = parseInt(userIdStr);
        const memberStatuses = memberFilters[userIdStr] || new Set();
        const member = place.members?.find(m => String(m.user_id) === String(userId));
        
        if (!member) return false;

        // Check if member's status matches any selected status
        if (memberStatuses.has('visited') && member.visited) return true;
        if (memberStatuses.has('in_wishlist') && member.in_wishlist) return true;
        if (memberStatuses.has('liked') && member.liked) return true;
        if (memberStatuses.has('none') && !member.visited && !member.in_wishlist && !member.liked) return true;
        
        return false;
      });
    });
  }, [places, memberFilters, placeTypeFilter, selectedMembers]);

  // Get available places (places not in route)
  const availablePlaces = useMemo(() => {
    const routePlaceIds = new Set(routePlaces.map(rp => rp.place_id));
    return filteredPlaces.filter(p => !routePlaceIds.has(p.id));
  }, [filteredPlaces, routePlaces]);

  const handleToggleMap = () => {
    if (!onShowOnMap) return;
    
    if (isShownOnMap) {
      onShowOnMap([], null);
    } else if (filteredPlaces.length > 0) {
      const mapPlaces = filteredPlaces.map(place => ({
        id: place.id,
        name: place.name,
        city: place.city,
        state: place.state,
        country: place.country,
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon),
        place_type: place.place_type || 'unknown',
        groupPlace: true,
        membersStatus: place.members
      }));
      onShowOnMap(mapPlaces, group?.name || 'Group Places');
    }
  };

  const getPlaceTypeColor = (placeType) => {
    const colors = {
      brewery: { bg: '#f97316', light: '#fff7ed', text: '#9a3412' },
      restaurant: { bg: '#ef4444', light: '#fef2f2', text: '#991b1b' },
      tourist_place: { bg: '#14b8a6', light: '#f0fdfa', text: '#134e4a' },
      hotel: { bg: '#06b6d4', light: '#ecfeff', text: '#164e63' }
    };
    return colors[placeType] || { bg: '#6b7280', light: '#f3f4f6', text: '#374151' };
  };

  if (loading && !places.length) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '60px 20px'
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '20px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          ⏳
        </div>
        <div style={{
          fontSize: '1.125rem',
          fontWeight: '700',
          color: '#000000',
          marginBottom: '8px'
        }}>
          Loading group places...
        </div>
        <div style={{
          fontSize: '0.875rem',
          color: '#64748b'
        }}>
          Gathering places from all members
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f9fafb',
      overflow: 'hidden'
    }}>
      {/* Modern Header */}
      <div style={{
        background: 'white',
        padding: '14px 20px 14px 20px',
        paddingRight: '60px',
        borderRadius: '0',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexShrink: 0,
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            {/* Breadcrumb Navigation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              minWidth: 0,
              fontSize: '14px',
              fontFamily: 'inherit'
            }}>
              <span
                onClick={onBack}
                style={{
                  color: '#000000',
                  fontSize: '14px',
                  fontWeight: '400',
                  cursor: 'pointer',
                  padding: '0',
                  transition: 'text-decoration 0.2s ease',
                  textDecoration: 'none',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.target.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.target.style.textDecoration = 'none';
                }}
              >
                Groups
              </span>
              {group && (
                <>
                  <span style={{ color: '#9ca3af', fontSize: '14px' }}>›</span>
                  <span
                    onClick={onBackToGroupDetails || onBack}
                    style={{
                      color: '#000000',
                      fontSize: '14px',
                      fontWeight: '400',
                      cursor: 'pointer',
                      padding: '0',
                      transition: 'text-decoration 0.2s ease',
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.textDecoration = 'none';
                    }}
                  >
                    {group.name}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: '14px' }}>›</span>
                  <span style={{ color: '#000000', fontSize: '14px', fontWeight: '400' }}>
                    Places
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            flexShrink: 0,
            marginLeft: '16px'
          }}>
            <button
              onClick={() => setShowRoutePlanner(!showRoutePlanner)}
              title={showRoutePlanner ? "Show places list" : "Show route planner"}
              style={{
                padding: '8px 14px',
                background: showRoutePlanner ? '#6366f1' : '#f9fafb',
                color: showRoutePlanner ? 'white' : '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!showRoutePlanner) {
                  e.target.style.background = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                if (!showRoutePlanner) {
                  e.target.style.background = '#f9fafb';
                }
              }}
            >
              <span>🗺️</span>
              <span>{showRoutePlanner ? 'Route Planner' : 'Places List'}</span>
            </button>
            <button
              onClick={loadGroupPlaces}
              disabled={loading}
              title="Refresh places"
              style={{
                width: '36px',
                height: '36px',
                background: loading ? '#e5e7eb' : '#f9fafb',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                padding: 0,
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.transform = 'rotate(180deg)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.background = '#f9fafb';
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.transform = 'rotate(0deg)';
                }
              }}
            >
              🔄
            </button>
        <button 
          onClick={handleToggleMap}
          disabled={filteredPlaces.length === 0 && !isShownOnMap}
          title={isShownOnMap ? "Hide from map" : `Show ${filteredPlaces.length} places on map`}
          style={{
            width: '36px',
            height: '36px',
                background: isShownOnMap 
                  ? '#d1fae5' 
                  : (filteredPlaces.length > 0 ? '#f9fafb' : '#f3f4f6'),
                color: isShownOnMap ? '#059669' : '#374151',
                border: '1px solid',
                borderColor: isShownOnMap ? '#a7f3d0' : '#e5e7eb',
                borderRadius: '8px',
            cursor: (filteredPlaces.length > 0 || isShownOnMap) ? 'pointer' : 'not-allowed',
                fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
                transition: 'all 0.15s',
            padding: 0,
                flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (filteredPlaces.length > 0 || isShownOnMap) {
                  e.target.style.background = isShownOnMap ? '#a7f3d0' : '#f3f4f6';
                  e.target.style.borderColor = isShownOnMap ? '#6ee7b7' : '#d1d5db';
                  e.target.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
                e.target.style.background = isShownOnMap 
                  ? '#d1fae5' 
                  : (filteredPlaces.length > 0 ? '#f9fafb' : '#f3f4f6');
                e.target.style.borderColor = isShownOnMap ? '#a7f3d0' : '#e5e7eb';
          }}
        >
          🗺️
        </button>
          </div>
        </div>

        {/* Stats Bar */}
        {places.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb',
            marginTop: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#374151',
              fontSize: '0.8125rem',
              fontWeight: '600'
            }}>
              <span style={{ fontSize: '0.875rem' }}>📍</span>
              <span>{filteredPlaces.length} of {places.length} places</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#374151',
              fontSize: '0.8125rem',
              fontWeight: '600'
            }}>
              <span style={{ fontSize: '1.125rem' }}>👥</span>
              <span>{allMembers.length} member{allMembers.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          margin: '16px 24px',
          padding: '14px 18px',
          background: '#fee2e2',
          color: '#dc2626',
          borderRadius: '12px',
          border: '2px solid #ef4444',
          fontSize: '0.875rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '1.25rem' }}>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* Route Planner - Split Layout: Left Panel (Route Places + Available Places) */}
      {showRoutePlanner ? (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: 'transparent'
      }}>
        {/* Left Panel - Route Places and Available Places */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '2px solid rgba(229, 231, 235, 0.8)',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(8px)',
          overflow: 'hidden'
        }}>
          {/* Route Planner Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>🗺️</span>
                  <span>Route Planner</span>
                </h3>
                {routePlaces.length > 0 && (
                  <span style={{
                    padding: '4px 10px',
                    background: '#6366f1',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {routePlaces.length}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {routeChanged && (
                  <button
                    onClick={handleSaveRoute}
                    disabled={routeLoading}
                    style={{
                      padding: '6px 12px',
                      background: routeLoading ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      cursor: routeLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {routeLoading ? 'Saving...' : '💾 Save'}
                  </button>
                )}
              </div>
            </div>
            {routeError && (
              <div style={{
                padding: '8px 12px',
                background: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                marginTop: '8px'
              }}>
                {routeError}
              </div>
            )}
          </div>
          
          {/* Route Places List - Scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedAvailablePlace && routePlaces.length === 0) {
              // Add to empty route
              handleDropOnRoute(e, 0);
            }
          }}
          >
            {routePlaces.length === 0 ? (
              <div 
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6b7280',
                  border: '2px dashed #d1d5db',
                  borderRadius: '12px',
                  background: '#f9fafb',
                  transition: 'all 0.2s ease'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.background = '#f0f9ff';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.background = '#f9fafb';
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📍</div>
                <p style={{ margin: 0, fontWeight: '600', marginBottom: '8px', fontSize: '0.9375rem' }}>
                  No places in route yet
                </p>
                <p style={{ margin: 0, fontSize: '0.8125rem' }}>
                  Drag places from below to add them to your route
                </p>
              </div>
            ) : (
              <>
                {routePlaces.map((routePlace, index) => (
                <div
                  key={`${routePlace.place_id}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(e, index);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedAvailablePlace) {
                      handleDropOnRoute(e, index);
                    } else {
                      handleDrop(e, index);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: draggedIndex === index ? '#f3f4f6' : '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'move',
                    transition: 'all 0.2s ease',
                    opacity: draggedIndex === index ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (draggedIndex !== index) {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (draggedIndex !== index) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#6366f1',
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {routePlace.name}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {[routePlace.city, routePlace.state, routePlace.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromRoute(routePlace.place_id);
                    }}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      lineHeight: '1',
                      borderRadius: '4px',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                    }}
                    title="Remove from route"
                  >
                    ×
                  </button>
                </div>
              ))}
                {/* Drop zone at end of route */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.background = '#f0f9ff';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedAvailablePlace) {
                      handleDropOnRoute(e, routePlaces.length);
                    }
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'transparent';
                  }}
                  style={{
                    minHeight: '60px',
                    border: '2px dashed transparent',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: '0.8125rem'
                  }}
                >
                  {draggedAvailablePlace ? 'Drop here to add to end of route' : ''}
                </div>
              </>
            )}
          </div>
          
          {/* Available Places Section - Toggleable */}
          <div style={{
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            flexShrink: 0
          }}>
            <button
              onClick={() => setShowAvailablePlaces(!showAvailablePlaces)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '700',
                color: '#374151'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span>
                <span>Available Places ({availablePlaces.length})</span>
              </span>
              <span>{showAvailablePlaces ? '▼' : '▲'}</span>
            </button>
            
            {showAvailablePlaces && (
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {availablePlaces.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#9ca3af',
                    fontSize: '0.8125rem'
                  }}>
                    All places are in your route
                  </div>
                ) : (
                  availablePlaces.map((place, index) => (
                    <div
                      key={place.id}
                      draggable
                      onDragStart={() => handleDragStartAvailable(place, index)}
                      onDragOver={(e) => e.preventDefault()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'grab',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.cursor = 'grab';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        background: '#e5e7eb',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        flexShrink: 0
                      }}>
                        +
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {place.name}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {[place.city, place.state].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Panel - Dedicated Map for Route Planner */}
        <div style={{
          width: '50%',
          background: '#f0f0f0',
          position: 'relative',
          borderLeft: '1px solid rgba(229, 231, 235, 0.5)',
          overflow: 'hidden'
        }}>
          {API_KEY && API_KEY.trim() !== '' ? (
            window.google && window.google.maps ? (
              <GoogleMap
                mapContainerStyle={{
                  width: '100%',
                  height: '100%'
                }}
                center={routePlaces.length > 0 && routePlaces[0].lat != null && routePlaces[0].lon != null 
                  ? { lat: parseFloat(routePlaces[0].lat), lng: parseFloat(routePlaces[0].lon) }
                  : { lat: 29.7604, lng: -95.3698 }
                }
                zoom={routePlaces.length > 0 ? 10 : 9}
                onLoad={(map) => {
                  console.log('GoogleMap onLoad called, map instance:', map);
                  setRouteMap(map);
                  setMapsLoaded(true);
                  // Fit bounds to show all route places
                  if (routePlaces.length > 0) {
                    try {
                      const bounds = new window.google.maps.LatLngBounds();
                      routePlaces.forEach(rp => {
                        if (rp.lat != null && rp.lon != null && !isNaN(parseFloat(rp.lat)) && !isNaN(parseFloat(rp.lon))) {
                          bounds.extend({ lat: parseFloat(rp.lat), lng: parseFloat(rp.lon) });
                        }
                      });
                      if (!bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 80 });
                      }
                    } catch (error) {
                      console.error('Error fitting bounds:', error);
                    }
                  }
                }}
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true
                }}
              >
                {/* Route Place Markers */}
                {window.google && window.google.maps && routePlaces
                  .filter((rp) => rp.lat != null && rp.lon != null && !isNaN(parseFloat(rp.lat)) && !isNaN(parseFloat(rp.lon)))
                  .map((rp, idx) => {
                    const lat = parseFloat(rp.lat);
                    const lon = parseFloat(rp.lon);
                    
                    return (
                      <Marker
                        key={`route-${rp.place_id || rp.placeId || idx}-${idx}`}
                        position={{ lat, lng: lon }}
                        label={{
                          text: String(idx + 1),
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 14,
                          fillColor: '#6366f1',
                          fillOpacity: 1,
                          strokeColor: '#ffffff',
                          strokeWeight: 2
                        }}
                        title={`${idx + 1}. ${rp.name || 'Place'}`}
                      />
                    );
                  })}
                
                {/* Polyline connecting route places */}
                {routePlaces.length > 1 && (
                  <Polyline
                    path={routePlaces
                      .filter((rp) => rp.lat != null && rp.lon != null && !isNaN(parseFloat(rp.lat)) && !isNaN(parseFloat(rp.lon)))
                      .map((rp) => ({ lat: parseFloat(rp.lat), lng: parseFloat(rp.lon) }))}
                    options={{
                      strokeColor: '#6366f1',
                      strokeOpacity: 0.8,
                      strokeWeight: 3,
                      geodesic: true
                    }}
                  />
                )}
              </GoogleMap>
            ) : (
              <LoadScript
                googleMapsApiKey={API_KEY}
                libraries={['geometry']}
                loadingElement={<div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%',
                  fontSize: '1rem',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>Loading map...</div>}
                onLoad={() => {
                  console.log('Route planner map loaded successfully');
                  setMapsLoaded(true);
                }}
                onError={(error) => {
                  console.error('Route planner map failed to load:', error);
                }}
              >
                <GoogleMap
                  mapContainerStyle={{
                    width: '100%',
                    height: '100%'
                  }}
                  center={routePlaces.length > 0 && routePlaces[0].lat && routePlaces[0].lon 
                    ? { lat: routePlaces[0].lat, lng: routePlaces[0].lon }
                    : { lat: 29.7604, lng: -95.3698 }
                  }
                  zoom={routePlaces.length > 0 ? 10 : 9}
                onLoad={(map) => {
                  console.log('GoogleMap onLoad called, map instance:', map);
                  setRouteMap(map);
                  setMapsLoaded(true);
                  // Fit bounds to show all route places
                  if (routePlaces.length > 0) {
                    try {
                      const bounds = new window.google.maps.LatLngBounds();
                      routePlaces.forEach(rp => {
                        if (rp.lat && rp.lon) {
                          bounds.extend({ lat: parseFloat(rp.lat), lng: parseFloat(rp.lon) });
                        }
                      });
                      if (!bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 80 });
                      }
                    } catch (error) {
                      console.error('Error fitting bounds:', error);
                    }
                  }
                }}
                  options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true
                  }}
                >
                {/* Route Place Markers */}
                {window.google && window.google.maps && routePlaces
                  .filter((rp) => rp.lat != null && rp.lon != null && !isNaN(parseFloat(rp.lat)) && !isNaN(parseFloat(rp.lon)))
                  .map((rp, idx) => {
                    const lat = parseFloat(rp.lat);
                    const lon = parseFloat(rp.lon);
                    
                    return (
                      <Marker
                        key={`route-${rp.place_id || rp.placeId || idx}-${idx}`}
                        position={{ lat, lng: lon }}
                        label={{
                          text: String(idx + 1),
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 14,
                          fillColor: '#6366f1',
                          fillOpacity: 1,
                          strokeColor: '#ffffff',
                          strokeWeight: 2
                        }}
                        title={`${idx + 1}. ${rp.name || 'Place'}`}
                      />
                    );
                  })}
                
                {/* Polyline connecting route places */}
                {routePlaces.length > 1 && (
                  <Polyline
                    path={routePlaces
                      .filter((rp) => rp.lat != null && rp.lon != null && !isNaN(parseFloat(rp.lat)) && !isNaN(parseFloat(rp.lon)))
                      .map((rp) => ({ lat: parseFloat(rp.lat), lng: parseFloat(rp.lon) }))}
                    options={{
                      strokeColor: '#6366f1',
                      strokeOpacity: 0.8,
                      strokeWeight: 3,
                      geodesic: true
                    }}
                  />
                )}
                </GoogleMap>
              </LoadScript>
            )
          ) : (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗺️</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Map View</div>
              <div style={{ fontSize: '0.8125rem' }}>
                {routePlaces.length === 0 
                  ? 'Add places to see them on the map'
                  : 'Google Maps API key not configured'
                }
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
      {/* Modern Filter Dropdowns */}
      {!showRoutePlanner && places.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            flexShrink: 0,
            width: '100%'
          }}>
            {/* Category Filter */}
            <div style={{ flex: 1 }}>
              <ModernFilterDropdown
                placeholder="Category"
                options={[
                  { value: 'brewery', label: '🍺 Brewery' },
                  { value: 'restaurant', label: '🍽️ Restaurant' },
                  { value: 'tourist_place', label: '🗺️ Tourist Place' },
                  { value: 'hotel', label: '🏨 Hotel' }
                ]}
                selectedValues={Array.from(placeTypeFilter)}
                onChange={(selected) => {
                  const newFilter = new Set(selected);
                  setPlaceTypeFilter(newFilter);
                }}
                multiple={true}
              />
            </div>

            {/* Member Filter */}
            {allMembers.length > 0 && (
              <div style={{ flex: 1 }}>
                <ModernFilterDropdown
                  placeholder="Member"
                  options={allMembers.map(member => ({
                    value: String(member.user_id),
                    label: member.username
                  }))}
                  selectedValues={selectedMembers}
                  onChange={(selected) => {
                    setSelectedMembers(selected);
                    // Initialize status filters for newly selected members
                    const newFilters = { ...memberFilters };
                    selected.forEach(userIdStr => {
                      if (!newFilters[userIdStr]) {
                        newFilters[userIdStr] = new Set(['visited', 'in_wishlist', 'liked', 'none']);
                      }
                    });
                    setMemberFilters(newFilters);
                  }}
                  multiple={true}
                />
              </div>
            )}

            {/* Status Filter - Only show if members are selected */}
            {selectedMembers.length > 0 && (
              <div style={{ flex: 1 }}>
                <ModernFilterDropdown
                  placeholder="Status"
                  options={[
                    { value: 'visited', label: '✓ Visited' },
                    { value: 'in_wishlist', label: '⭐ Wishlist' },
                    { value: 'liked', label: '❤️ Liked' },
                    { value: 'none', label: '○ Not in lists' }
                  ]}
                  selectedValues={selectedStatuses}
                  onChange={(selected) => {
                    setSelectedStatuses(selected);
                    // Update status filters for all selected members
                    const newFilters = { ...memberFilters };
                    selectedMembers.forEach(userIdStr => {
                      if (newFilters[userIdStr]) {
                        newFilters[userIdStr] = new Set(selected);
                      }
                    });
                    setMemberFilters(newFilters);
                  }}
                  multiple={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Places List - Hidden when route planner is active */}
      {places.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '2px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: '5rem',
              marginBottom: '24px',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
            }}>
              📍
        </div>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#000000'
            }}>
              No Places Yet
            </h3>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '1rem',
              color: '#64748b',
              lineHeight: '1.6'
            }}>
              No places found in group member lists yet.
            </p>
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: 'linear-gradient(135deg, #dbeafe, #e0f2fe)',
              borderRadius: '12px',
              border: '2px solid #93c5fd',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              <p style={{
                margin: '0 0 10px 0',
                fontSize: '0.9375rem',
                fontWeight: '800',
                color: '#000000'
              }}>
                💡 How to Add Places
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.875rem',
                color: '#1e40af',
                fontWeight: '700',
                lineHeight: '1.6'
              }}>
                When group members add places to their personal lists (✓ Visited, ⭐ Wishlist, ❤️ Liked), they automatically appear here for everyone to see!
              </p>
              <p style={{
                margin: '12px 0 0 0',
                fontSize: '0.8125rem',
                color: '#1e3a8a',
                fontWeight: '700'
              }}>
                👉 Search for places and click the buttons on any place card to add them to your lists.
              </p>
          </div>
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '2px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '1.25rem',
              fontWeight: '800',
              color: '#000000'
            }}>
              No Places Match Filters
            </h3>
            <p style={{
              margin: 0,
              fontSize: '0.9375rem',
              color: '#64748b',
              lineHeight: '1.6'
            }}>
              Try adjusting your filters to see more places.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            width: '100%',
            alignItems: 'stretch',
            boxSizing: 'border-box'
          }}>
            {filteredPlaces.map(place => {
              const typeColor = getPlaceTypeColor(place.place_type);
              const fullAddress = [
                place.city,
                place.state,
                place.country
              ].filter(Boolean).join(', ') || 'Location unknown';

              return (
                <div
                  key={place.id}
                  style={{
                    background: 'white',
                    padding: '16px',
                      borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = typeColor.bg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  {/* Top accent bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, ${typeColor.bg}, ${typeColor.bg}dd)`
                  }} />

                  {/* Row 1: Name and Type Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    gap: '8px',
                    marginTop: '2px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: '#111827',
                      letterSpacing: '-0.2px',
                      flex: 1,
                      lineHeight: '1.4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {place.name}
                    </h3>
                    {place.place_type && (
                      <div style={{
                        padding: '4px 10px',
                        background: typeColor.bg,
                      color: 'white',
                        borderRadius: '12px',
                        fontSize: '0.6875rem',
                        fontWeight: '700',
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        lineHeight: '1.2'
                    }}>
                      {place.place_type.replace('_', ' ')}
                      </div>
                  )}
                </div>

                  {/* Row 2: Location */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '12px',
                    padding: '8px 10px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #f3f4f6'
                  }}>
                    <span style={{
                      fontSize: '0.875rem',
                      flexShrink: 0
                    }}>
                      📍
                    </span>
                    <span style={{
                      flex: 1,
                      fontSize: '0.8125rem',
                      color: '#374151',
                      fontWeight: '500',
                      lineHeight: '1.3',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {fullAddress}
                    </span>
                </div>

                  {/* Row 3: Add to Route Button */}
                  <div style={{
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6',
                    marginBottom: '12px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToRoute(place);
                      }}
                      disabled={routePlaces.some(rp => rp.place_id === place.id)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: routePlaces.some(rp => rp.place_id === place.id) 
                          ? '#e5e7eb' 
                          : 'rgba(99, 102, 241, 0.9)',
                        color: routePlaces.some(rp => rp.place_id === place.id) 
                          ? '#9ca3af' 
                          : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        cursor: routePlaces.some(rp => rp.place_id === place.id) 
                          ? 'not-allowed' 
                          : 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!routePlaces.some(rp => rp.place_id === place.id)) {
                          e.target.style.background = 'rgba(79, 70, 229, 0.95)';
                          e.target.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!routePlaces.some(rp => rp.place_id === place.id)) {
                          e.target.style.background = 'rgba(99, 102, 241, 0.9)';
                          e.target.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      {routePlaces.some(rp => rp.place_id === place.id) 
                        ? '✓ In Route' 
                        : '+ Add to Route'}
                    </button>
                  </div>

                  {/* Row 4: Member Statuses */}
                  <div style={{
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {place.members.map(member => {
                      const badges = getStatusBadges(member);
                      const hasStatus = badges.length > 0;
                      
                      return (
                        <div
                          key={member.user_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            background: hasStatus ? '#f9fafb' : '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #f3f4f6',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = hasStatus ? '#f3f4f6' : '#f9fafb';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = hasStatus ? '#f9fafb' : '#ffffff';
                            e.currentTarget.style.borderColor = '#f3f4f6';
                          }}
                        >
                          {/* Member Avatar */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                          }}>
                            {member.username.charAt(0).toUpperCase()}
              </div>

                          {/* Member Name and Statuses */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.8125rem',
                              fontWeight: '600',
                              color: '#111827',
                              marginBottom: hasStatus ? '4px' : '0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {member.username}
                            </div>
                            {hasStatus && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                                alignItems: 'center'
                              }}>
                                {badges.map((badge, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      padding: '3px 8px',
                                      background: badge.color,
                                      color: 'white',
                                      borderRadius: '8px',
                                      fontSize: '0.6875rem',
                                      fontWeight: '700',
                                      whiteSpace: 'nowrap',
                                      lineHeight: '1.2',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    {badge.icon} {badge.label}
                            </span>
                          ))}
                        </div>
                            )}
                            {!hasStatus && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#9ca3af',
                                fontWeight: '500',
                                fontStyle: 'italic'
                              }}>
                                Not in lists
                      </div>
                            )}
                      </div>
                    </div>
                      );
                    })}
                </div>
              </div>
              );
            })}
                </div>
              )}
            </div>
      )}
    </div>
  );
}

export default GroupPlaces;
