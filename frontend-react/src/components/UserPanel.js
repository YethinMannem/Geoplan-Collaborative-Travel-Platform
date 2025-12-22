import React, { useState } from 'react';

function UserPanel({
  userAccount,
  userRole,
  userPermissions,
  onLogout,
  onLoadPersonalList,
  onShowGroups,
  onShowUserAuth,
  onLoadPermissionDetails,
  onEnableAddMode,
  addingLocation,
  onCSVUpload,
  uploadingCSV,
  fileInputRef,
  activeListView,
  showGroups
}) {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const personalLists = [
    { 
      id: 'visited', 
      label: 'Visited', 
      icon: '✓', 
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      bgColor: '#dbeafe'
    },
    { 
      id: 'wishlist', 
      label: 'Wishlist', 
      icon: '⭐', 
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      bgColor: '#d1fae5'
    },
    { 
      id: 'liked', 
      label: 'Liked', 
      icon: '❤️', 
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      bgColor: '#fef3c7'
    }
  ];

  return (
    <div className="user-panel">
      {/* Header Section */}
      <div className="user-panel-header">
        <div className="user-avatar">
          <div className="avatar-circle">
            {userAccount ? (
              <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white' }}>
                {userAccount.username?.[0]?.toUpperCase() || '👤'}
              </span>
            ) : (
              <span style={{ fontSize: '1.75rem' }}>👤</span>
            )}
          </div>
        </div>
        <div className="user-details">
          <div className="user-name">
            {userAccount ? (
              <>
                <span style={{ 
                  fontWeight: '800', 
                  fontSize: '1.125rem',
                  color: '#000000',
                  display: 'block',
                  lineHeight: '1.4'
                }}>
                  {userAccount.username || 'User'}
                </span>
                {userAccount.email && (
                  <span style={{ 
                    fontSize: '0.8125rem', 
                    color: '#000000',
                    display: 'block',
                    marginTop: '4px',
                    fontWeight: '600'
                  }}>
                    {userAccount.email}
                  </span>
                )}
              </>
            ) : (
              <span style={{ 
                fontWeight: '800', 
                fontSize: '1.125rem',
                color: '#000000'
              }}>
                {userRole || 'Guest'}
              </span>
            )}
          </div>
          {userRole && !userAccount && (
            <div style={{
              fontSize: '0.75rem',
              color: '#000000',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginTop: '4px'
            }}>
              {userPermissions.length > 0 ? userPermissions.join(' • ') : 'No permissions'}
            </div>
          )}
        </div>
      </div>

      {/* Personal Lists Section - Only for logged-in users */}
      {userAccount && (
        <div className="user-panel-section">
          <button
            className="section-toggle"
            onClick={() => toggleSection('lists')}
            style={{
              background: expandedSection === 'lists' 
                ? 'linear-gradient(135deg, #e0e7ff, #c7d2fe)' 
                : 'transparent',
              color: '#000000'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem' }}>📋</span>
              <span style={{ fontWeight: '800', fontSize: '0.9375rem', color: '#000000' }}>My Lists</span>
            </span>
            <span style={{ 
              fontSize: '0.875rem',
              transform: expandedSection === 'lists' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              color: '#000000',
              fontWeight: '700'
            }}>
              ▼
            </span>
          </button>
          
          {expandedSection === 'lists' && (
            <div className="section-content" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              {personalLists.map(list => (
                <button
                  key={list.id}
                  onClick={() => onLoadPersonalList(list.id)}
                  className={`list-button ${activeListView === list.id ? 'active' : ''}`}
                  style={{
                    background: activeListView === list.id 
                      ? list.bgColor 
                      : '#f9fafb',
                    color: '#000000',
                    border: `2px solid ${activeListView === list.id ? list.color : '#e5e7eb'}`,
                    boxShadow: activeListView === list.id 
                      ? `0 4px 12px ${list.color}40` 
                      : '0 1px 3px rgba(0,0,0,0.1)',
                    fontWeight: '700'
                  }}
                  onMouseEnter={(e) => {
                    if (activeListView !== list.id) {
                      e.target.style.background = list.bgColor;
                      e.target.style.borderColor = list.color;
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = `0 4px 12px ${list.color}30`;
                      e.target.style.color = '#000000';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeListView !== list.id) {
                      e.target.style.background = '#f9fafb';
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                      e.target.style.color = '#000000';
                    }
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{list.icon}</span>
                  <span style={{ fontWeight: '700', fontSize: '0.9375rem', color: '#000000' }}>{list.label}</span>
                  {activeListView === list.id && (
                    <span style={{ 
                      fontSize: '0.75rem',
                      marginLeft: 'auto',
                      background: 'rgba(0,0,0,0.1)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      color: '#000000',
                      border: '1px solid rgba(0,0,0,0.2)'
                    }}>
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Groups Section */}
      {userAccount && (
        <div className="user-panel-section">
          <button
            className="section-toggle"
            onClick={() => {
              toggleSection('groups');
              if (expandedSection !== 'groups') {
                onShowGroups();
              }
            }}
            style={{
              background: showGroups || expandedSection === 'groups'
                ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' 
                : 'transparent',
              color: showGroups || expandedSection === 'groups' ? 'white' : '#000000'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem' }}>👥</span>
              <span style={{ fontWeight: '800', fontSize: '0.9375rem', color: showGroups || expandedSection === 'groups' ? 'white' : '#000000' }}>Groups</span>
            </span>
            <span style={{ 
              fontSize: '0.875rem',
              transform: expandedSection === 'groups' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              fontWeight: '700'
            }}>
              ▼
            </span>
          </button>
        </div>
      )}

      {/* Admin/App User Actions */}
      {(userRole === 'admin_user' || userRole === 'app_user') && (
        <div className="user-panel-section">
          <button
            className="section-toggle"
            onClick={() => toggleSection('admin')}
            style={{
              background: expandedSection === 'admin' 
                ? 'linear-gradient(135deg, #fef3c7, #fde68a)' 
                : 'transparent',
              color: '#000000'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem' }}>⚙️</span>
              <span style={{ fontWeight: '800', fontSize: '0.9375rem', color: '#000000' }}>Admin Tools</span>
            </span>
            <span style={{ 
              fontSize: '0.875rem',
              transform: expandedSection === 'admin' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              color: '#000000',
              fontWeight: '700'
            }}>
              ▼
            </span>
          </button>
          
          {expandedSection === 'admin' && (
            <div className="section-content" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <button
                onClick={onLoadPermissionDetails}
                className="admin-button"
                style={{
                  background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '0.9375rem'
                }}
              >
                <span style={{ fontSize: '1.125rem' }}>🔒</span>
                <span>Test Permissions</span>
              </button>
              
              <button
                onClick={onEnableAddMode}
                disabled={addingLocation}
                className="admin-button"
                style={{
                  background: addingLocation
                    ? 'linear-gradient(135deg, var(--warning), var(--warning-dark))'
                    : 'linear-gradient(135deg, var(--success), var(--success-dark))',
                  color: 'white',
                  cursor: addingLocation ? 'crosshair' : 'pointer',
                  fontWeight: '700',
                  fontSize: '0.9375rem'
                }}
              >
                <span style={{ fontSize: '1.125rem' }}>{addingLocation ? '📍' : '➕'}</span>
                <span>{addingLocation ? 'Click Map' : 'Add Location'}</span>
              </button>
              
              {userRole === 'admin_user' && (
                <label className="admin-button" style={{
                  background: uploadingCSV
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, var(--accent-blue), var(--info-dark))',
                  color: 'white',
                  cursor: uploadingCSV ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '0.9375rem'
                }}>
                  <span style={{ fontSize: '1.125rem' }}>{uploadingCSV ? '📤' : '📁'}</span>
                  <span>{uploadingCSV ? 'Uploading...' : 'Upload CSV'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={onCSVUpload}
                    disabled={uploadingCSV}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {/* Login/Logout Section */}
      <div className="user-panel-footer">
        {userAccount || userRole ? (
          <button
            onClick={onLogout}
            className="logout-button"
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: '800',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
            }}
          >
            <span style={{ fontSize: '1.125rem' }}>🚪</span>
            <span>Logout</span>
          </button>
        ) : (
          <button
            onClick={onShowUserAuth}
            className="login-button"
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: '800',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
            }}
          >
            <span style={{ fontSize: '1.125rem' }}>🔐</span>
            <span>Login / Register</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default UserPanel;
