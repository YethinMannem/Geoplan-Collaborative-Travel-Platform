import React from 'react';
import PlaceListButtons from './PlaceListButtons';

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
  noPosition = false,
  activeListView = null,
  listSearchQuery = '',
  onListSearchChange = null,
}) {
  const sidebarStyle = noPosition ? {
    position: 'relative',
    top: 'auto',
    right: 'auto',
    width: '100%',
    maxHeight: 'none',
    background: 'transparent',
    padding: '0',
    borderRadius: '0',
    boxShadow: 'none',
    overflowY: 'visible',
    zIndex: 'auto'
  } : {};

  return (
    <div className="sidebar" style={sidebarStyle}>
      <h3>📊 Results & Analytics</h3>

      {error && <div className="error">❌ {error}</div>}

      {stats && (
        <div className="stats">
          <strong>📈 Database Statistics</strong>
          <br />
          <strong>Total Places:</strong> {(stats.total_places || stats.total || 0).toLocaleString()}
          <br />
          {stats.top_states && stats.top_states.length > 0 && (
            <>
              <strong>Top States:</strong>
              <ul style={{ marginTop: '4px', marginLeft: '20px' }}>
                {stats.top_states.slice(0, 5).map((state, idx) => (
                  <li key={idx}>
                    {state.state}: {state.count}
                  </li>
                ))}
              </ul>
            </>
          )}
          {stats.bounds && (
            <>
              <br />
              <strong>Geographic Bounds:</strong>
              <br />
              <small>
                Lat: {stats.bounds.min_lat?.toFixed(2) || 'N/A'} to {stats.bounds.max_lat?.toFixed(2) || 'N/A'}
                <br />
                Lon: {stats.bounds.min_lon?.toFixed(2) || 'N/A'} to {stats.bounds.max_lon?.toFixed(2) || 'N/A'}
              </small>
            </>
          )}
        </div>
      )}

      {analytics && (
        <div className="stats">
          <strong>📊 State Analytics</strong>
          <br />
          <small>Total: {analytics.total} states</small>
          <br />
          <br />
          {analytics.states?.slice(0, 10).map((s, idx) => (
            <div key={idx} style={{ marginBottom: '6px' }}>
              <strong>#{idx + 1} {s.state}:</strong> {s.count} places
              {s.avg_lat && (
                <>
                  <br />
                  <small>📍 Avg: ({s.avg_lat.toFixed(4)}, {s.avg_lon.toFixed(4)})</small>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {density && (
        <div className="stats">
          <strong>📊 Density Analysis</strong>
          <br />
          <small>Center: ({density.center?.lat.toFixed(4)}, {density.center?.lon.toFixed(4)})</small>
          <br />
          <small>Radius: {density.radius_km} km</small>
          <br />
          <br />
          <strong>Count:</strong> {density.count} places
          <br />
          <strong>Density:</strong> {density.density_per_1000_km2} places/1000 km²
        </div>
      )}

      {hasResults && (
        <div className="export-buttons">
          <div className="label">📥 Export Data:</div>
          <button
            type="button"
            onClick={() => onExport('csv')}
            style={{ background: '#4CAF50', marginBottom: '8px', fontSize: '13px', padding: '8px' }}
          >
            📄 Export CSV
          </button>
          <button
            type="button"
            onClick={() => onExport('geojson')}
            style={{ background: '#2196F3', fontSize: '13px', padding: '8px' }}
          >
            🗺️ Export GeoJSON
          </button>
        </div>
      )}

      {queryInfo && (
        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
          <strong>Query:</strong> {queryInfo}
        </div>
      )}

      {/* Search bar for personal lists */}
      {activeListView && onListSearchChange && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            background: '#f8f9fa',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #e0e0e0'
          }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <input
              type="text"
              placeholder={`Search ${activeListView} list by name, city, or state...`}
              value={listSearchQuery}
              onChange={(e) => onListSearchChange(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#4CAF50'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
            {listSearchQuery && (
              <button
                type="button"
                onClick={() => onListSearchChange('')}
                style={{
                  padding: '6px 10px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {listSearchQuery && (
            <div style={{ 
              marginTop: '6px', 
              fontSize: '12px', 
              color: '#666',
              fontStyle: 'italic'
            }}>
              {results.length === 0 
                ? 'No places found matching your search'
                : `Showing ${results.length} matching place${results.length !== 1 ? 's' : ''}`
              }
            </div>
          )}
        </div>
      )}

      <div className="results-list">
        {results.length === 0 && !error && (
          <div className="loading">Enter search criteria and click Search</div>
        )}

        {results.length > 0 && (
          <>
            <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '500' }}>
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((place, index) => (
              <div
                key={place.id || index}
                className="result-item"
              >
                <div onClick={() => onMarkerClick(place)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong>{place.name || 'Unknown'}</strong>
                    {place.place_type && (
                      <span style={{
                        fontSize: '0.7em',
                        padding: '2px 6px',
                        borderRadius: '3px',
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
                  <small>
                    {place.city || ''}
                    {place.city && place.state ? ', ' : ''}
                    {place.state || ''}
                    {place.distance_km && ` • ${place.distance_km} km away`}
                  </small>
                </div>
                {userAuthenticated && place.list_status && (
                  <PlaceListButtons 
                    place={place} 
                    listStatus={place.list_status}
                  />
                )}
                {place.groupPlace && place.membersStatus && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>👥 Member Statuses:</strong>
                    {place.membersStatus.map(member => {
                      const statuses = [];
                      if (member.visited) statuses.push('✓ Visited');
                      if (member.in_wishlist) statuses.push('★ Wishlist');
                      if (member.liked) statuses.push('❤️ Liked');
                      if (!member.visited && !member.in_wishlist && !member.liked) {
                        statuses.push('○ Not in lists');
                      }
                      return (
                        <div key={member.user_id} style={{ fontSize: '11px', marginBottom: '2px' }}>
                          <strong>{member.username}:</strong> {statuses.join(', ')}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default ResultsSidebar;



