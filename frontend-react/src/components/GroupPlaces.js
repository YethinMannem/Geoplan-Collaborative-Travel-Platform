import React, { useState, useEffect, useMemo } from 'react';
import { getGroupPlaces, getGroupDetails } from '../services/userListsApi';
import ModernFilterDropdown from './ModernFilterDropdown';
import './GroupPlaces.css';

function GroupPlaces({ groupId, onBack, onShowOnMap, isShownOnMap = false }) {
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

  useEffect(() => {
    if (groupId) {
      loadGroupDetails();
      loadGroupPlaces();
    }
  }, [groupId]);

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
            <button
              onClick={onBack}
              style={{
                padding: '6px 12px',
                background: '#f9fafb',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f3f4f6';
                e.target.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f9fafb';
                e.target.style.borderColor = '#e5e7eb';
              }}
            >
              <span>←</span>
              <span>Back</span>
            </button>
            {group && (
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <h1 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#111827',
                  letterSpacing: '-0.3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {group.name}
                </h1>
                <div style={{
                  marginTop: '2px',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  Group Places
        </div>
              </div>
            )}
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            flexShrink: 0,
            marginLeft: '16px'
          }}>
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

      {/* Content Area - Scrollable */}
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
        {places.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0
          }}>
            {/* Category Filter */}
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

            {/* Member Filter */}
            {allMembers.length > 0 && (
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
            )}

            {/* Status Filter - Only show if members are selected */}
            {selectedMembers.length > 0 && (
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
            )}
          </div>
        )}

        {/* Places List */}
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

                  {/* Row 3: Member Statuses */}
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
    </div>
  );
}

export default GroupPlaces;
