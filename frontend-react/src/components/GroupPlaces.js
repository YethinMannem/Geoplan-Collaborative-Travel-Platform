import React, { useState, useEffect, useMemo } from 'react';
import { getGroupPlaces, getGroupDetails } from '../services/userListsApi';
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

  useEffect(() => {
    if (groupId) {
      loadGroupDetails();
      loadGroupPlaces();
    }
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

  // Initialize filters: each member gets all statuses selected by default
  useEffect(() => {
    if (allMembers.length > 0 && Object.keys(memberFilters).length === 0) {
      const initialFilters = {};
      allMembers.forEach(member => {
        initialFilters[String(member.user_id)] = new Set(['visited', 'in_wishlist', 'liked', 'none']);
      });
      setMemberFilters(initialFilters);
    }
  }, [allMembers, memberFilters]);

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
      const response = await getGroupPlaces(groupId);
      setPlaces(response.places || []);
    } catch (err) {
      setError(err.message || 'Failed to load group places');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (member) => {
    const statuses = [];
    if (member.visited) statuses.push('✓ Visited');
    if (member.in_wishlist) statuses.push('★ Wishlist');
    if (member.liked) statuses.push('❤️ Liked');
    if (!member.visited && !member.in_wishlist && !member.liked) {
      statuses.push('○ Not in lists');
    }
    return statuses.join(', ');
  };

  const getStatusBadges = (member) => {
    const badges = [];
    if (member.visited) badges.push({ text: '✓', className: 'status-visited' });
    if (member.in_wishlist) badges.push({ text: '★', className: 'status-wishlist' });
    if (member.liked) badges.push({ text: '❤️', className: 'status-liked' });
    if (badges.length === 0) badges.push({ text: '○', className: 'status-none' });
    return badges;
  };

  // Filter places based on per-member filters AND place type filter
  const filteredPlaces = useMemo(() => {
    const activeMemberIds = Object.keys(memberFilters).filter(
      userId => memberFilters[userId] && memberFilters[userId].size > 0
    );

    if (activeMemberIds.length === 0) {
      return [];
    }

    return places.filter(place => {
      // First check place type filter
      const placeType = place.place_type || 'unknown';
      if (placeTypeFilter.size > 0 && !placeTypeFilter.has(placeType)) {
        return false;
      }

      // Then check member status filters
      return activeMemberIds.some(userIdStr => {
        const userId = parseInt(userIdStr);
        const memberStatuses = memberFilters[userIdStr];
        const member = place.members?.find(m => String(m.user_id) === String(userId));
        
        if (!member) return false;

        // Check if member's status matches any selected status in their filter
        if (memberStatuses.has('visited') && member.visited) return true;
        if (memberStatuses.has('in_wishlist') && member.in_wishlist) return true;
        if (memberStatuses.has('liked') && member.liked) return true;
        if (memberStatuses.has('none') && !member.visited && !member.in_wishlist && !member.liked) return true;
        
        return false;
      });
    });
  }, [places, memberFilters, placeTypeFilter]);

  const toggleMemberStatus = (userId, status) => {
    setMemberFilters(prev => {
      const newFilters = { ...prev };
      if (!newFilters[userId]) {
        newFilters[userId] = new Set();
      } else {
        newFilters[userId] = new Set(newFilters[userId]);
      }
      
      if (newFilters[userId].has(status)) {
        newFilters[userId].delete(status);
      } else {
        newFilters[userId].add(status);
      }
      
      return newFilters;
    });
  };

  const toggleAllStatusesForMember = (userId, selectAll) => {
    setMemberFilters(prev => {
      const newFilters = { ...prev };
      newFilters[userId] = selectAll 
        ? new Set(['visited', 'in_wishlist', 'liked', 'none'])
        : new Set();
      return newFilters;
    });
  };

  const handleToggleMap = () => {
    if (!onShowOnMap) return;
    
    if (isShownOnMap) {
      // Hide from map (call with empty array or null)
      onShowOnMap([], null);
    } else if (filteredPlaces.length > 0) {
      // Show on map
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

  if (loading && !places.length) {
    return <div className="group-places-container">Loading places...</div>;
  }

  return (
    <div className="group-places-container" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="group-places-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onBack} className="btn-back">← Back</button>
          {group && <h2 style={{ margin: 0 }}>{group.name} - Places</h2>}
        </div>
        <button 
          onClick={handleToggleMap}
          disabled={filteredPlaces.length === 0 && !isShownOnMap}
          title={isShownOnMap ? "Hide from map" : `Show ${filteredPlaces.length} places on map`}
          style={{
            width: '36px',
            height: '36px',
            background: isShownOnMap ? '#4CAF50' : (filteredPlaces.length > 0 ? '#2196F3' : '#ccc'),
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: (filteredPlaces.length > 0 || isShownOnMap) ? 'pointer' : 'not-allowed',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            padding: 0,
            boxShadow: isShownOnMap ? '0 2px 8px rgba(76, 175, 80, 0.4)' : '0 2px 4px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            if (filteredPlaces.length > 0 || isShownOnMap) {
              e.target.style.transform = 'scale(1.1)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = isShownOnMap ? '0 2px 8px rgba(76, 175, 80, 0.4)' : '0 2px 4px rgba(0,0,0,0.2)';
          }}
        >
          🗺️
        </button>
      </div>

      {error && <div className="error-message">❌ {error}</div>}

      {/* Place Type Filter Section */}
      {places.length > 0 && (
        <div className="filter-section" style={{
          background: '#e3f2fd',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          flexShrink: 0
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>🏷️ Filter by Place Type</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {[
              { key: 'brewery', label: '🍺 Brewery', color: '#FFA500' },
              { key: 'restaurant', label: '🍽️ Restaurant', color: '#FF6B6B' },
              { key: 'tourist_place', label: '🗺️ Tourist Place', color: '#4ECDC4' },
              { key: 'hotel', label: '🏨 Hotel', color: '#95E1D3' }
            ].map(type => {
              const isChecked = placeTypeFilter.has(type.key);
              return (
                <label key={type.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  background: isChecked ? type.color : 'white',
                  color: isChecked ? 'white' : '#333',
                  border: `2px solid ${isChecked ? type.color : '#ddd'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const newFilter = new Set(placeTypeFilter);
                      if (e.target.checked) {
                        newFilter.add(type.key);
                      } else {
                        newFilter.delete(type.key);
                      }
                      setPlaceTypeFilter(newFilter);
                    }}
                    style={{ marginRight: '6px', cursor: 'pointer' }}
                  />
                  {type.label}
                </label>
              );
            })}
            {placeTypeFilter.size < 4 && (
              <button
                type="button"
                onClick={() => setPlaceTypeFilter(new Set(['brewery', 'restaurant', 'tourist_place', 'hotel']))}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Select All
              </button>
            )}
            {placeTypeFilter.size === 0 && (
              <span style={{ fontSize: '11px', color: '#f44336', fontStyle: 'italic', marginLeft: '8px' }}>
                No place types selected - showing no places
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter Section - Per Member Filters */}
      {places.length > 0 && allMembers.length > 0 && (
        <div className="filter-section" style={{
          background: '#f5f5f5',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          maxHeight: '300px',
          overflowY: 'auto',
          flexShrink: 0
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>🔍 Filter by Member Status</h3>
          
          {allMembers.map(member => {
            const userIdStr = String(member.user_id);
            const memberFilter = memberFilters[userIdStr] || new Set();
            const hasAnySelected = memberFilter.size > 0;
            const allSelected = memberFilter.has('visited') && 
                               memberFilter.has('in_wishlist') && 
                               memberFilter.has('liked') && 
                               memberFilter.has('none');

            return (
              <div key={member.user_id} style={{
                marginBottom: '16px',
                padding: '12px',
                background: 'white',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <strong style={{ fontSize: '14px' }}>👤 {member.username}</strong>
                  <button
                    onClick={() => toggleAllStatusesForMember(userIdStr, !allSelected)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: allSelected ? '#666' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {allSelected ? 'Clear All' : 'Select All'}
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { key: 'visited', label: '✓ Visited', color: '#4CAF50' },
                    { key: 'in_wishlist', label: '★ Wishlist', color: '#FF9800' },
                    { key: 'liked', label: '❤️ Liked', color: '#E91E63' },
                    { key: 'none', label: '○ Not in lists', color: '#9E9E9E' }
                  ].map(status => {
                    const isChecked = memberFilter.has(status.key);
                    return (
                      <label key={status.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        background: isChecked ? status.color : 'white',
                        color: isChecked ? 'white' : '#333',
                        border: `2px solid ${isChecked ? status.color : '#ddd'}`,
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberStatus(userIdStr, status.key)}
                          style={{ marginRight: '6px' }}
                        />
                        {status.label}
                      </label>
                    );
                  })}
                </div>
                
                {!hasAnySelected && (
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '11px', 
                    color: '#f44336',
                    fontStyle: 'italic'
                  }}>
                    No filters selected - showing no places for this member
                  </div>
                )}
              </div>
            );
          })}
          
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: '#e3f2fd', 
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1976d2'
          }}>
            <strong>💡 Tip:</strong> Select statuses for each member to show places matching any of those combinations. 
            For example: "User1 visited" OR "User2 wishlist" will show places where either condition is true.
          </div>
        </div>
      )}

      {places.length === 0 ? (
        <div className="empty-state">
          <p>No places found in group member lists yet.</p>
          <p>When group members add places to their lists, they'll appear here!</p>
        </div>
      ) : (
        <div className="places-list" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ marginBottom: '12px', color: '#666', fontSize: '14px' }}>
            Showing {filteredPlaces.length} of {places.length} places
          </div>
          {filteredPlaces.map(place => (
            <div key={place.id} className="place-card">
              <div className="place-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{place.name}</h3>
                  {place.place_type && (
                    <span style={{
                      fontSize: '0.7em',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 
                        place.place_type === 'brewery' ? '#FFA500' :
                        place.place_type === 'restaurant' ? '#FF6B6B' :
                        place.place_type === 'tourist_place' ? '#4ECDC4' :
                        place.place_type === 'hotel' ? '#95E1D3' : '#CCCCCC',
                      color: 'white',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {place.place_type.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="place-location">
                  {place.city && <span>{place.city}</span>}
                  {place.state && <span>{place.state}</span>}
                  {place.country && <span>{place.country}</span>}
                </div>
              </div>

              <div className="members-status">
                <h4>Member Statuses:</h4>
                <div className="members-list">
                  {place.members.map(member => (
                    <div key={member.user_id} className="member-status-item">
                      <div className="member-status-header">
                        <strong>{member.username}</strong>
                        <div className="status-badges">
                          {getStatusBadges(member).map((badge, idx) => (
                            <span key={idx} className={`status-badge ${badge.className}`} title={getStatusIcon(member)}>
                              {badge.text}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="member-status-detail">
                        {getStatusIcon(member)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {place.lat && place.lon && (
                <div className="place-coordinates">
                  📍 {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupPlaces;

