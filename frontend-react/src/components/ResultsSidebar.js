import React from 'react';
import PlaceListIcons from './PlaceListIcons';
import MultiSelectDropdown from './MultiSelectDropdown';

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
  filters = { placeTypes: [], minRating: 0, maxDistance: null, states: [] },
  onFiltersChange = null,
  allResults = [],
              restaurantFilters = { 
    cuisines: [], 
    priceRanges: [], 
    ratings: [],
    dietaryOptions: [],
    openNow: false,
    delivery: false,
    takeout: false,
    reservations: false
  },
  onRestaurantFiltersChange = null,
  touristFilters = {
    categories: [],
    entryFee: [],
    ratings: [],
    familyFriendly: false,
    accessibility: false,
    petFriendly: false,
    openNow: false,
    guidedTours: false
  },
  onTouristFiltersChange = null,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{
            margin: '0',
          fontSize: '1.5rem',
          fontWeight: '800',
            color: '#1f2937',
          letterSpacing: '-0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '1.75rem' }}>{getHeadingIcon()}</span>
            <span style={{ color: '#1f2937' }}>{getHeading()}</span>
        </h3>
          
          {/* Results Count Badge - Small rounded badge in top-right */}
          {safeResults.length > 0 && (
            <div style={{
              padding: '6px 12px',
              background: 'rgba(16, 185, 129, 0.15)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '0.875rem' }}>✅</span>
              <span>{safeResults.length}</span>
            </div>
          )}
        </div>
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '36px',
              height: '36px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              transition: 'all 0.2s ease',
              color: '#64748b',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.transform = 'rotate(90deg) scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
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
          background: 'rgba(239, 68, 68, 0.2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          color: '#1f2937',
          fontSize: '0.875rem',
          fontWeight: '700',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)'
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
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
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
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    transition: 'all 0.2s ease',
                    color: '#1f2937'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1), 0 4px 12px rgba(99, 102, 241, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.7)';
                    e.target.style.boxShadow = 'none';
                  }}
            />
            {listSearchQuery && (
              <button
                type="button"
                onClick={() => onListSearchChange('')}
                style={{
                  padding: '6px 10px',
                    background: 'rgba(239, 68, 68, 0.8)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                  color: 'white',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '6px',
                  cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(220, 38, 38, 0.9)';
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.8)';
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
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

          {/* Restaurant-Specific Filters - Show only when there are restaurant results */}
          {!activeListView && hasResults && onRestaurantFiltersChange && allResults.length > 0 && 
           allResults.some(r => r.place_type === 'restaurant') && (
            <div style={{
              marginBottom: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              position: 'relative',
              zIndex: 999
            }}>
              <h4 style={{
                margin: '0 0 16px 0',
                fontSize: '0.875rem',
                fontWeight: '700',
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>🍽️</span>
                <span>Restaurant Filters</span>
              </h4>
              
              {/* 9 Filters in 3 rows of 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <MultiSelectDropdown
                    placeholder="Cuisine Type"
                    options={[
                      { value: 'Italian', label: 'Italian' },
                      { value: 'Mexican', label: 'Mexican' },
                      { value: 'Chinese', label: 'Chinese' },
                      { value: 'Indian', label: 'Indian' },
                      { value: 'Japanese', label: 'Japanese' },
                      { value: 'Thai', label: 'Thai' },
                      { value: 'American', label: 'American' },
                      { value: 'Mediterranean', label: 'Mediterranean' },
                      { value: 'French', label: 'French' },
                      { value: 'Greek', label: 'Greek' },
                      { value: 'Korean', label: 'Korean' },
                      { value: 'Vietnamese', label: 'Vietnamese' },
                      { value: 'Seafood', label: 'Seafood' },
                      { value: 'Steakhouse', label: 'Steakhouse' },
                      { value: 'Pizza', label: 'Pizza' },
                      { value: 'BBQ', label: 'BBQ' }
                    ]}
                    selectedValues={restaurantFilters.cuisines}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, cuisines: selected })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Price Range"
                    options={[
                      { value: '1', label: '$ Budget' },
                      { value: '2', label: '$$ Moderate' },
                      { value: '3', label: '$$$ Expensive' },
                      { value: '4', label: '$$$$ Very Expensive' }
                    ]}
                    selectedValues={restaurantFilters.priceRanges}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, priceRanges: selected })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Rating"
                    options={[
                      { value: '4', label: '4+ Stars' },
                      { value: '4.5', label: '4.5+ Stars' },
                      { value: '5', label: '5 Stars' }
                    ]}
                    selectedValues={restaurantFilters.ratings}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, ratings: selected })}
                  />
                </div>
                
                {/* Row 2 - Dietary, Open Now */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <MultiSelectDropdown
                    placeholder="Dietary Options"
                    options={[
                      { value: 'vegetarian', label: 'Vegetarian' },
                      { value: 'vegan', label: 'Vegan' },
                      { value: 'gluten-free', label: 'Gluten-Free' },
                      { value: 'halal', label: 'Halal' },
                      { value: 'kosher', label: 'Kosher' },
                      { value: 'keto-friendly', label: 'Keto-Friendly' }
                    ]}
                    selectedValues={restaurantFilters.dietaryOptions || []}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, dietaryOptions: selected })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Open Now"
                    options={[
                      { value: 'yes', label: 'Open Now' }
                    ]}
                    selectedValues={restaurantFilters.openNow ? ['yes'] : []}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, openNow: selected.includes('yes') })}
                  />
                </div>
                
                {/* Row 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <MultiSelectDropdown
                    placeholder="Delivery"
                    options={[
                      { value: 'yes', label: 'Delivery Available' }
                    ]}
                    selectedValues={restaurantFilters.delivery ? ['yes'] : []}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, delivery: selected.includes('yes') })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Takeout"
                    options={[
                      { value: 'yes', label: 'Takeout Available' }
                    ]}
                    selectedValues={restaurantFilters.takeout ? ['yes'] : []}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, takeout: selected.includes('yes') })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Reservations"
                    options={[
                      { value: 'yes', label: 'Accepts Reservations' }
                    ]}
                    selectedValues={restaurantFilters.reservations ? ['yes'] : []}
                    onChange={(selected) => onRestaurantFiltersChange({ ...restaurantFilters, reservations: selected.includes('yes') })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tourist Place-Specific Filters - Show only when there are tourist place results */}
          {!activeListView && hasResults && onTouristFiltersChange && allResults.length > 0 && 
           allResults.some(r => r.place_type === 'tourist_place') && (
            <div style={{
              marginBottom: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              position: 'relative',
              zIndex: 999
            }}>
              <h4 style={{
                margin: '0 0 16px 0',
                fontSize: '0.875rem',
                fontWeight: '700',
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>🗺️</span>
                <span>Tourist Place Filters</span>
              </h4>
              
              {/* 8 Filters in 3 rows: 3-3-2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <MultiSelectDropdown
                    placeholder="Category"
                    options={[
                      { value: 'Park', label: 'Park' },
                      { value: 'Museum', label: 'Museum' },
                      { value: 'Monument', label: 'Monument' },
                      { value: 'Attraction', label: 'Attraction' },
                      { value: 'Beach', label: 'Beach' },
                      { value: 'Landmark', label: 'Landmark' }
                    ]}
                    selectedValues={touristFilters.categories}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, categories: selected })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Entry Fee"
                    options={[
                      { value: 'free', label: 'Free' },
                      { value: '1-10', label: '$1-$10' },
                      { value: '11-25', label: '$11-$25' },
                      { value: '25+', label: '$25+' }
                    ]}
                    selectedValues={touristFilters.entryFee}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, entryFee: selected })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Rating"
                    options={[
                      { value: '4', label: '4+ Stars' },
                      { value: '4.5', label: '4.5+ Stars' },
                      { value: '5', label: '5 Stars' }
                    ]}
                    selectedValues={touristFilters.ratings}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, ratings: selected })}
                  />
                </div>
                
                {/* Row 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <MultiSelectDropdown
                    placeholder="Family Friendly"
                    options={[{ value: 'yes', label: 'Family Friendly' }]}
                    selectedValues={touristFilters.familyFriendly ? ['yes'] : []}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, familyFriendly: selected.includes('yes') })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Accessibility"
                    options={[{ value: 'yes', label: 'Wheelchair Accessible' }]}
                    selectedValues={touristFilters.accessibility ? ['yes'] : []}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, accessibility: selected.includes('yes') })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Pet Friendly"
                    options={[{ value: 'yes', label: 'Pet Friendly' }]}
                    selectedValues={touristFilters.petFriendly ? ['yes'] : []}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, petFriendly: selected.includes('yes') })}
                  />
                </div>
                
                {/* Row 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <MultiSelectDropdown
                    placeholder="Open Now"
                    options={[{ value: 'yes', label: 'Open Now' }]}
                    selectedValues={touristFilters.openNow ? ['yes'] : []}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, openNow: selected.includes('yes') })}
                  />
                  
                  <MultiSelectDropdown
                    placeholder="Guided Tours"
                    options={[{ value: 'yes', label: 'Guided Tours Available' }]}
                    selectedValues={touristFilters.guidedTours ? ['yes'] : []}
                    onChange={(selected) => onTouristFiltersChange({ ...touristFilters, guidedTours: selected.includes('yes') })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Query Info - Hidden per user request */}


          {/* Results List */}
          <div className="results-list">
            {safeResults.length === 0 && !error && (
              <div style={{
                padding: '50px 20px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 16px rgba(31, 38, 135, 0.1)'
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
                    padding: '16px',
                    /* Glassmorphism Effect */
                    background: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 16px rgba(31, 38, 135, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(31, 38, 135, 0.2)';
                    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(typeColor.bg);
                    if (rgb) {
                      const borderColor = `rgba(${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}, 0.5)`;
                      e.currentTarget.style.borderColor = borderColor;
                    }
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(31, 38, 135, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
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
                      fontSize: '1.125rem',
                      fontWeight: '900',
                      color: '#1f2937',
                      lineHeight: '1.3',
                      letterSpacing: '-0.3px',
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
                            background: 'rgba(245, 158, 11, 0.15)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
                          }}>
                            <span style={{ fontSize: '0.875rem', color: '#f59e0b', filter: 'drop-shadow(0 1px 2px rgba(245, 158, 11, 0.3))' }}>⭐</span>
                            <span style={{ 
                              fontWeight: '700', 
                              color: '#1f2937',
                              fontSize: '0.75rem'
                            }}>
                              {ratingNum.toFixed(1)}
                            </span>
                            {hasReviewCount && (
                              <span style={{
                                fontWeight: '500',
                                color: '#9ca3af',
                                fontSize: '0.65rem',
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
                    background: 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontWeight: '500',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)'
                  }}>
                    <span style={{ 
                      fontSize: '0.75rem',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                      opacity: 0.7
                    }}>📍</span>
                    <span style={{ flex: 1, fontSize: '0.75rem', lineHeight: '1.4', color: '#6b7280' }}>
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
                        fontWeight: '600',
                        color: '#6b7280',
                        fontSize: '0.7rem',
                        background: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)'
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
                        padding: '6px 12px',
                        background: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: '#1f2937',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                        letterSpacing: '0.2px',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {place.place_type.replace('_', ' ')}
                      </div>
                    )}
                  </div>

                  {/* Group Member Statuses */}
                {place.groupPlace && place.membersStatus && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
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
                    padding: '12px 16px',
                    background: 'rgba(16, 185, 129, 0.8)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: '700',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.background = 'rgba(16, 185, 129, 0.9)';
                    e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.background = 'rgba(16, 185, 129, 0.8)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
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
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.8)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: '700',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.background = 'rgba(59, 130, 246, 0.9)';
                    e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.background = 'rgba(59, 130, 246, 0.8)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
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
