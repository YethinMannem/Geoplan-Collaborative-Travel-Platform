import React from 'react';
import PlaceListIcons from './PlaceListIcons';

function ResultsSidebar({
  results,
  stats,
  analytics,
  density,
  queryInfo,
  error,
  onMarkerClick,
  onExport,
  hasResults,
  userAuthenticated = false,
  activeListView = null,
  listSearchQuery = '',
  onListSearchChange = null,
  onClose = null,
}) {

  // Ensure results is always an array
  const safeResults = Array.isArray(results) ? results : [];

  const getPlaceTypeColor = (placeType) => {
    const colors = {
      brewery: { bg: '#8B4513', light: '#F5E6D3' },
      restaurant: { bg: '#FF6B6B', light: '#FFE5E5' },
      tourist_place: { bg: '#4ECDC4', light: '#E0F7F5' },
      hotel: { bg: '#95E1D3', light: '#E8F8F5' }
    };
    return colors[placeType] || { bg: '#6b7280', light: '#f3f4f6' };
  };

  // Get dynamic heading based on active view
  const getHeading = () => {
    if (activeListView === 'visited') {
      return 'Visited Places';
    } else if (activeListView === 'wishlist') {
      return 'Wishlist Places';
    } else if (activeListView === 'liked') {
      return 'Liked Places';
    } else {
      return 'Places'; // For search results
    }
  };

  // Get icon based on active view
  const getHeadingIcon = () => {
    if (activeListView === 'visited') {
      return '✓';
    } else if (activeListView === 'wishlist') {
      return '⭐';
    } else if (activeListView === 'liked') {
      return '❤️';
    } else {
      return '📍'; // For search results
    }
  };

  return (
    <div className="results-sidebar">
      {/* Header with Tabs */}
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '1.5rem',
          fontWeight: '800',
          color: '#000000',
          letterSpacing: '-0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '1.75rem' }}>{getHeadingIcon()}</span>
          <span style={{ color: '#000000' }}>{getHeading()}</span>
        </h3>
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              transition: 'all 0.2s ease',
              color: '#64748b'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.transform = 'rotate(90deg) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
            }}
            title="Close results"
            aria-label="Close results"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: 'all 0.2s ease'
              }}
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
        </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--error-light)',
          border: '2px solid var(--error)',
          borderRadius: '12px',
          color: 'var(--error-dark)',
          fontSize: '0.875rem',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results Content */}
      <div className="results-content">
          {/* Search Bar - Show for both search results and personal lists */}
      {(activeListView || !activeListView) && onListSearchChange && (
            <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
                gap: '10px',
                background: 'var(--gray-50)',
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid var(--border-light)'
              }}>
                <span style={{ fontSize: '1.125rem' }}>🔍</span>
            <input
              type="text"
                  placeholder={activeListView ? `Search ${activeListView} list...` : 'Search places...'}
              value={listSearchQuery}
              onChange={(e) => onListSearchChange(e.target.value)}
              style={{
                flex: 1,
                    padding: '10px 12px',
                    fontSize: '0.875rem',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'white',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary-500)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-light)';
                    e.target.style.boxShadow = 'none';
                  }}
            />
            {listSearchQuery && (
              <button
                type="button"
                onClick={() => onListSearchChange('')}
                style={{
                  padding: '6px 10px',
                      background: 'var(--error)',
                  color: 'white',
                  border: 'none',
                      borderRadius: '6px',
                  cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'var(--error-dark)';
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'var(--error)';
                      e.target.style.transform = 'scale(1)';
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {listSearchQuery && (
            <div style={{ 
                  marginTop: '8px',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  {safeResults.length === 0 
                ? 'No places found matching your search'
                    : `Showing ${safeResults.length} matching place${safeResults.length !== 1 ? 's' : ''}`
              }
            </div>
          )}
        </div>
      )}

          {/* Query Info */}
          {queryInfo && (
            <div style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, var(--primary-50), var(--primary-100))',
              borderRadius: '10px',
              marginBottom: '16px',
              border: '1px solid var(--primary-200)',
              fontSize: '0.8125rem',
              color: 'var(--primary-700)',
              fontWeight: '600'
            }}>
              <span style={{ marginRight: '8px' }}>🔍</span>
              {queryInfo}
            </div>
          )}

          {/* Results Count */}
          {safeResults.length > 0 && (
            <div style={{
              marginBottom: '12px',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              borderRadius: '12px',
              border: '2px solid #10b981',
              fontSize: '0.9375rem',
              fontWeight: '800',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
            }}>
              <span style={{ fontSize: '1.25rem' }}>✅</span>
              <span>Found {safeResults.length} result{safeResults.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Results List */}
          <div className="results-list">
            {safeResults.length === 0 && !error && (
              <div style={{
                padding: '50px 20px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
                borderRadius: '16px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px', opacity: 0.7 }}>🔍</div>
                <div style={{ 
                  fontWeight: '800', 
                  marginBottom: '8px',
                  fontSize: '1.125rem',
                  color: '#000000'
                }}>
                  {activeListView ? `No places in your ${activeListView} list` : 'No results yet'}
                </div>
                <div style={{ 
                  fontSize: '0.875rem',
                  color: '#000000',
                  fontWeight: '600'
                }}>
                  {activeListView ? 'Add places to see them here' : 'Enter search criteria and click Search'}
                </div>
              </div>
            )}

            {safeResults.map((place, index) => {
              const typeColor = getPlaceTypeColor(place.place_type);
              
              // Debug: Log place data to check what's available
              if (index === 0) {
                console.log('🔍 First place data:', {
                  name: place.name,
                  rating: place.rating,
                  ratingType: typeof place.rating,
                  description: place.description,
                  descriptionType: typeof place.description,
                  place_type: place.place_type
                });
              }
              
              return (
              <div
                key={place.id || index}
                className="result-card"
                onClick={(e) => {
                  // Only trigger if clicking on the card itself, not on interactive elements
                  if (e.target.closest('.place-list-icons') || e.target.closest('.list-icon-btn')) {
                    return;
                  }
                  onMarkerClick(place);
                }}
                style={{
                    padding: '12px 14px',
                    background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.01)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = typeColor.bg;
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff, #f1f5f9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff, #f8fafc)';
                  }}
                >
                  {/* Row 1: Name, Rating */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {/* Place Name */}
                    <h4 style={{
                      margin: '0',
                      fontSize: '1rem',
                      fontWeight: '900',
                      color: '#000000',
                      lineHeight: '1.3',
                      letterSpacing: '-0.2px',
                      flex: '1',
                      minWidth: '120px'
                    }}>
                      {place.name || 'Unknown'}
                    </h4>

                    {/* Rating */}
                    {(() => {
                      const rating = place.rating;
                      const reviewCount = place.review_count;
                      const hasRating = rating !== null && rating !== undefined && 
                                      (typeof rating === 'number' || typeof rating === 'string') &&
                                      !isNaN(Number(rating)) && Number(rating) > 0;
                      
                      if (hasRating) {
                        const ratingNum = Number(rating);
                        const hasReviewCount = reviewCount !== null && reviewCount !== undefined && 
                                              (typeof reviewCount === 'number' || typeof reviewCount === 'string') &&
                                              !isNaN(Number(reviewCount)) && Number(reviewCount) > 0;
                        
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1.5px solid #f59e0b'
                          }}>
                            <span style={{ fontSize: '0.875rem', color: '#000000' }}>⭐</span>
                            <span style={{ 
                              fontWeight: '800', 
                              color: '#000000',
                              fontSize: '0.75rem'
                            }}>
                              {ratingNum.toFixed(1)}
                            </span>
                            {hasReviewCount && (
                              <span style={{
                                fontWeight: '600',
                                color: '#64748b',
                                fontSize: '0.7rem',
                                marginLeft: '2px'
                              }}>
                                ({Number(reviewCount).toLocaleString()})
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Row 2: Full Address */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px',
                    padding: '6px 10px',
                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    color: '#000000',
                    fontWeight: '700',
                    border: '1px solid #cbd5e1'
                  }}>
                    <span style={{ 
                      fontSize: '0.875rem',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                    }}>📍</span>
                    <span style={{ flex: 1, fontSize: '0.8125rem', lineHeight: '1.4' }}>
                      {(() => {
                        const addressParts = [];
                        if (place.street) addressParts.push(place.street);
                        if (place.city) addressParts.push(place.city);
                        if (place.state) addressParts.push(place.state);
                        if (place.postal_code) addressParts.push(place.postal_code);
                        return addressParts.length > 0 
                          ? addressParts.join(', ') 
                          : ([place.city, place.state].filter(Boolean).join(', ') || 'Location unknown');
                      })()}
                    </span>
                    {place.distance_km && (
                      <span style={{
                        fontWeight: '800',
                        color: '#000000',
                        fontSize: '0.8125rem',
                        background: 'white',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        whiteSpace: 'nowrap'
                      }}>
                        {place.distance_km.toFixed(1)} km
                      </span>
                    )}
                  </div>

                  {/* Row 3: List Status Buttons (Visited, Wishlist, Liked) on left, Type Badge on right */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    {/* List Status Buttons - on left */}
                    {userAuthenticated && place.list_status ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PlaceListIcons 
                          place={place} 
                          listStatus={place.list_status}
                        />
                        {/* Helpful tooltip for first-time users */}
                        {!place.list_status.visited && !place.list_status.in_wishlist && !place.list_status.liked && (
                          <div style={{
                            fontSize: '0.65rem',
                            color: '#64748b',
                            fontStyle: 'italic',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }} title="Add to your lists to share with groups">
                            <span>💡</span>
                            <span>Add to share</span>
                          </div>
                        )}
                      </div>
                    ) : !userAuthenticated ? (
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#64748b',
                        fontStyle: 'italic',
                        padding: '4px 8px',
                        background: '#f1f5f9',
                        borderRadius: '6px'
                      }}>
                        💡 Login to add places
                      </div>
                    ) : (
                      <div></div> // Spacer when no buttons
                    )}
                    
                    {/* Place Type Badge - on right */}
                    {place.place_type && (
                      <div style={{
                        padding: '4px 10px',
                        background: `linear-gradient(135deg, ${typeColor.light}, ${typeColor.light}dd)`,
                        color: '#000000',
                        borderRadius: '16px',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        textTransform: 'capitalize',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        letterSpacing: '0.2px',
                        border: `1.5px solid ${typeColor.bg}`
                      }}>
                        {place.place_type.replace('_', ' ')}
                      </div>
                    )}
                  </div>

                  {/* Group Member Statuses */}
                {place.groupPlace && place.membersStatus && (
                    <div style={{
                      marginTop: '12px',
                      padding: '10px',
                      background: 'var(--gray-50)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: '#000000',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        👥 Member Statuses
                      </div>
                    {place.membersStatus.map(member => {
                      const statuses = [];
                      if (member.visited) statuses.push('✓ Visited');
                        if (member.in_wishlist) statuses.push('⭐ Wishlist');
                      if (member.liked) statuses.push('❤️ Liked');
                      if (!member.visited && !member.in_wishlist && !member.liked) {
                        statuses.push('○ Not in lists');
                      }
                      return (
                          <div key={member.user_id} style={{
                            fontSize: '0.7rem',
                            marginBottom: '4px',
                            color: '#000000',
                            fontWeight: '600'
                          }}>
                            <strong style={{ color: '#000000', fontWeight: '700' }}>
                              {member.username}:
                            </strong>{' '}
                            {statuses.join(', ')}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })}
          </div>

          {/* Export Buttons */}
          {hasResults && (
            <div style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '2px solid var(--border-light)'
            }}>
              <div style={{
                fontSize: '1rem',
                fontWeight: '800',
                color: '#000000',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '1.375rem' }}>📥</span>
                <span style={{ color: '#000000' }}>Export Data</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => onExport('csv')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, var(--success), var(--success-dark))',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: '700',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  <span>📄</span>
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('geojson')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--info-dark))',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: '700',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  <span>🗺️</span>
                  <span>GeoJSON</span>
                </button>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default ResultsSidebar;
