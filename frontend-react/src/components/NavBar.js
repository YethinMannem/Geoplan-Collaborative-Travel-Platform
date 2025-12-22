import React, { useState, useRef, useEffect } from 'react';
import './NavBar.css';

function NavBar({
  userAccount,
  userRole,
  userPermissions = [],
  onShowGroups,
  onLoadPersonalList,
  onShowUserAuth,
  onLogout,
  activeListView,
  onResetToSearch,
  onLoadPermissionDetails,
  onEnableAddMode,
  addingLocation = false,
  onCSVUpload,
  uploadingCSV = false,
  fileInputRef
}) {
  const [showListsMenu, setShowListsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const listsMenuRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (listsMenuRef.current && !listsMenuRef.current.contains(event.target)) {
        setShowListsMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const personalLists = [
    { 
      id: 'visited', 
      label: 'Visited', 
      icon: '✓', 
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    },
    { 
      id: 'wishlist', 
      label: 'Wishlist', 
      icon: '⭐', 
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)'
    },
    { 
      id: 'liked', 
      label: 'Liked', 
      icon: '❤️', 
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, #ec4899, #db2777)'
    }
  ];

  const handleListClick = (listId) => {
    onLoadPersonalList(listId);
    setShowListsMenu(false);
  };

  const handleGroupsClick = () => {
    onShowGroups();
    setShowListsMenu(false);
    setShowUserMenu(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/Brand */}
        <div className="navbar-brand">
          <span className="brand-icon">📍</span>
          <span className="brand-text">GeoPlaces</span>
        </div>

        {/* Navigation Items */}
        <div className="navbar-items">
          {/* Groups Button */}
          <button
            className="nav-button groups-button"
            onClick={handleGroupsClick}
            title="Groups"
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Groups</span>
          </button>

          {/* Lists Dropdown */}
          {userAccount && (
            <div className="nav-dropdown" ref={listsMenuRef}>
              <button
                className={`nav-button lists-button ${activeListView ? 'active' : ''}`}
                onClick={() => setShowListsMenu(!showListsMenu)}
                title="My Lists"
              >
                <span className="nav-icon">📋</span>
                <span className="nav-label">Lists</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showListsMenu && (
                <div className="dropdown-menu lists-menu">
                  <div className="dropdown-header">
                    <span className="dropdown-title">My Lists</span>
                    {activeListView && (
                      <button
                        className="clear-active-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResetToSearch();
                          setShowListsMenu(false);
                        }}
                        title="Clear active list"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {personalLists.map(list => (
                    <button
                      key={list.id}
                      className={`dropdown-item ${activeListView === list.id ? 'active' : ''}`}
                      onClick={() => handleListClick(list.id)}
                      style={{
                        borderLeft: `4px solid ${list.color}`
                      }}
                    >
                      <span className="dropdown-item-icon">{list.icon}</span>
                      <span className="dropdown-item-label">{list.label}</span>
                      {activeListView === list.id && (
                        <span className="active-indicator">●</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Account Menu */}
          <div className="nav-dropdown" ref={userMenuRef}>
            <button
              className="nav-button user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={userAccount ? userAccount.username : 'Account'}
            >
              {userAccount ? (
                <>
                  <div className="user-avatar-small">
                    {userAccount.username?.[0]?.toUpperCase() || '👤'}
                  </div>
                  <span className="nav-label">{userAccount.username}</span>
                </>
              ) : (
                <>
                  <span className="nav-icon">👤</span>
                  <span className="nav-label">Account</span>
                </>
              )}
              <span className="dropdown-arrow">▼</span>
            </button>

            {showUserMenu && (
              <div className="dropdown-menu user-menu">
                {userAccount ? (
                  <>
                    <div className="user-menu-header">
                      <div className="user-avatar-menu">
                        {userAccount.username?.[0]?.toUpperCase() || '👤'}
                      </div>
                      <div className="user-menu-info">
                        <div className="user-menu-name">{userAccount.username}</div>
                        {userAccount.email && (
                          <div className="user-menu-email">{userAccount.email}</div>
                        )}
                        {userRole && (
                          <div className="user-menu-role">{userRole}</div>
                        )}
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    
                    {/* Admin Tools - Only for admin users */}
                    {(userRole === 'admin' || (userPermissions && userPermissions.length > 0)) && (
                      <>
                        <div className="dropdown-section-header">Admin Tools</div>
                        {onLoadPermissionDetails && (
                          <button
                            className="dropdown-item admin-item"
                            onClick={() => {
                              setShowUserMenu(false);
                              onLoadPermissionDetails();
                            }}
                          >
                            <span className="dropdown-item-icon">🔐</span>
                            <span className="dropdown-item-label">Permissions</span>
                          </button>
                        )}
                        {onEnableAddMode && (
                          <button
                            className="dropdown-item admin-item"
                            onClick={() => {
                              setShowUserMenu(false);
                              onEnableAddMode();
                            }}
                            disabled={addingLocation}
                          >
                            <span className="dropdown-item-icon">{addingLocation ? '⏳' : '➕'}</span>
                            <span className="dropdown-item-label">
                              {addingLocation ? 'Adding Location...' : 'Add Location'}
                            </span>
                          </button>
                        )}
                        {onCSVUpload && fileInputRef && (
                          <>
                            <button
                              className="dropdown-item admin-item"
                              onClick={() => {
                                setShowUserMenu(false);
                                fileInputRef.current?.click();
                              }}
                              disabled={uploadingCSV}
                            >
                              <span className="dropdown-item-icon">{uploadingCSV ? '⏳' : '📤'}</span>
                              <span className="dropdown-item-label">
                                {uploadingCSV ? 'Uploading...' : 'Upload CSV'}
                              </span>
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".csv"
                              onChange={onCSVUpload}
                              disabled={uploadingCSV}
                              style={{ display: 'none' }}
                            />
                          </>
                        )}
                        <div className="dropdown-divider"></div>
                      </>
                    )}
                    
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setShowUserMenu(false);
                        onShowUserAuth();
                      }}
                    >
                      <span className="dropdown-item-icon">⚙️</span>
                      <span className="dropdown-item-label">Settings</span>
                    </button>
                    <button
                      className="dropdown-item logout-item"
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                    >
                      <span className="dropdown-item-icon">🚪</span>
                      <span className="dropdown-item-label">Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    className="dropdown-item login-item"
                    onClick={() => {
                      setShowUserMenu(false);
                      onShowUserAuth();
                    }}
                  >
                    <span className="dropdown-item-icon">🔐</span>
                    <span className="dropdown-item-label">Login / Register</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;

