import React, { useState, useEffect } from 'react';
import { getUserGroups, createGroup, getGroupDetails, addGroupMember, removeGroupMember, getGroupPlaces } from '../services/userListsApi';
import './Groups.css';

function Groups({ onViewGroupPlaces, onClose }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUserGroups();
      setGroups(response.groups || []);
    } catch (err) {
      const errorMsg = err.message || 'Failed to load groups';
      // Provide more helpful error messages
      if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
        setError('Unable to connect to server. Please check if the backend is running and try again.');
      } else if (errorMsg.includes('401') || errorMsg.includes('Authentication')) {
        setError('Please log in to view your groups.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim()
      });
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateModal(false);
      setSuccessMessage('✅ Group created successfully!');
      loadGroups();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleViewGroup = async (groupId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getGroupDetails(groupId);
      setSelectedGroup(response);
    } catch (err) {
      const errorMsg = err.message || 'Failed to load group details';
      // Provide more helpful error messages
      if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
        setError('Unable to connect to server. Please check if the backend is running and try again.');
      } else if (errorMsg.includes('401') || errorMsg.includes('Authentication')) {
        setError('Please log in to view group details.');
      } else if (errorMsg.includes('403') || errorMsg.includes('not a member')) {
        setError('You are not a member of this group.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberUsername.trim() || !selectedGroup) {
      setError('Username or email is required');
      return;
    }

    setAddingMember(true);
    setError(null);
    try {
      await addGroupMember(selectedGroup.group.group_id, newMemberUsername.trim());
      setNewMemberUsername('');
      setSuccessMessage(`✅ ${newMemberUsername.trim()} added to group!`);
      handleViewGroup(selectedGroup.group.group_id); // Refresh group details
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId, memberUsername) => {
    if (!selectedGroup) return;
    if (!window.confirm(`Are you sure you want to remove ${memberUsername} from this group?`)) return;

    setLoading(true);
    setError(null);
    try {
      await removeGroupMember(selectedGroup.group.group_id, memberId);
      setSuccessMessage(`✅ ${memberUsername} removed from group`);
      handleViewGroup(selectedGroup.group.group_id); // Refresh group details
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlaces = async (groupId) => {
    console.log('🔄 handleViewPlaces called with groupId:', groupId);
    if (onViewGroupPlaces) {
      console.log('✅ Calling onViewGroupPlaces callback');
      onViewGroupPlaces(groupId);
    } else {
      console.error('❌ onViewGroupPlaces prop is not provided!');
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setError(null);
  };

  return (
    <div className="groups-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'transparent',
      borderRadius: '0',
      boxShadow: 'none'
    }}>
      {/* Header - Integrated Glass Style */}
      <div style={{ 
        padding: '0 20px',
        height: '52px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
        flexShrink: 0,
        background: 'rgba(99, 102, 241, 0.1)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0
          }}>
            👥
          </div>
          <h2 style={{ 
            margin: 0, 
            color: '#1f2937', 
            fontSize: '16px', 
            fontWeight: '600',
            letterSpacing: '-0.1px'
          }}>
            Groups
          </h2>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '4px 10px',
            height: '26px',
            background: 'rgba(99, 102, 241, 0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: 'white',
            border: '1px solid rgba(99, 102, 241, 0.6)',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            boxShadow: '0 1px 4px rgba(99, 102, 241, 0.25)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(79, 70, 229, 0.95)';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(99, 102, 241, 0.9)';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 1px 4px rgba(99, 102, 241, 0.25)';
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: '600', lineHeight: '1' }}>+</span>
          <span>Create</span>
        </button>
      </div>

      {/* Success Message Toast */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          zIndex: 10000,
          animation: 'slideInRight 0.3s ease-out',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          margin: '20px 32px',
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.15)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: '#1f2937',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          fontSize: '0.875rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)'
        }}>
          <span>❌</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={loadGroups}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#b91c1c';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#dc2626';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
            aria-label="Retry loading groups"
            title="Retry"
          >
            🔄 Retry
          </button>
          <button
            onClick={() => setError(null)}
            style={{
              width: '24px',
              height: '24px',
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s ease',
              padding: '0',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fecaca';
              e.currentTarget.style.color = '#991b1b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#dc2626';
            }}
            aria-label="Close error message"
            title="Close"
          >
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
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div 
          className="modal-overlay"
          onClick={closeCreateModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              /* Glassmorphism Effect */
              background: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              padding: '32px',
              borderRadius: '24px',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              maxWidth: '500px',
              width: '90%',
              animation: 'scaleIn 0.3s ease-out'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#000000' }}>Create New Group</h3>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  color: '#000000'
                }}>
                  Group Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
          <input
            type="text"
                  placeholder="e.g., Family Trip 2024"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            required
            minLength={3}
                  maxLength={100}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '0.9375rem',
                    color: '#000000',
                    background: '#f9fafb',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.background = '#f9fafb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  color: '#000000'
                }}>
                  Description <span style={{ color: '#64748b', fontWeight: '400' }}>(optional)</span>
                </label>
          <textarea
                  placeholder="What's this group for? e.g., Planning our summer vacation..."
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
                  rows={4}
                  maxLength={500}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '0.9375rem',
                    color: '#000000',
                    background: '#f9fafb',
                    transition: 'all 0.2s',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.background = '#f9fafb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  textAlign: 'right'
                }}>
                  {newGroupDescription.length}/500
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    background: '#f3f4f6',
                    color: '#000000',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.target.style.background = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.target.style.background = '#f3f4f6';
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newGroupName.trim()}
                  style={{
                    padding: '12px 24px',
                    background: loading || !newGroupName.trim() 
                      ? '#d1d5db' 
                      : '#f3f4f6',
                    color: '#000000',
                    border: loading || !newGroupName.trim() 
                      ? '2px solid #d1d5db'
                      : '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    cursor: loading || !newGroupName.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && newGroupName.trim()) {
                      e.target.style.background = '#e5e7eb';
                      e.target.style.borderColor = '#cbd5e1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && newGroupName.trim()) {
                      e.target.style.background = '#f3f4f6';
                      e.target.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
              </div>
        </form>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden',
        padding: '32px',
        minHeight: 0, // Critical for flex scrolling
        WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
      }}>
      {selectedGroup ? (
          /* Group Details View */
          <div className="group-details-view" style={{ minHeight: '100%' }}>
            {/* Back Button */}
          <button 
              onClick={() => {
                setSelectedGroup(null);
                setError(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                color: '#6366f1',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginBottom: '20px',
                transition: 'all 0.2s ease',
                borderRadius: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#4f46e5';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6366f1';
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: '1' }}>←</span>
              <span>Back</span>
          </button>
          
            {/* Group Info Card - Glass Design */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '12px',
                gap: '12px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    margin: '0 0 6px 0',
                    fontSize: '1.375rem',
                    fontWeight: '700',
                    color: '#111827',
                    letterSpacing: '-0.3px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedGroup.group.name}
                  </h3>
          {selectedGroup.group.description && (
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      lineHeight: '1.5',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {selectedGroup.group.description}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '6px 12px',
                  background: selectedGroup.group.your_role === 'admin' 
                    ? 'rgba(254, 243, 199, 0.8)' 
                    : 'rgba(224, 242, 254, 0.8)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: '#1f2937',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                  border: selectedGroup.group.your_role === 'admin' 
                    ? '1px solid rgba(251, 191, 36, 0.4)'
                    : '1px solid rgba(59, 130, 246, 0.4)',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)'
                }}>
                  {selectedGroup.group.your_role}
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  <span>👥</span>
                  <span>{selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? 's' : ''}</span>
                </div>
            <button 
              onClick={() => handleViewPlaces(selectedGroup.group.group_id)}
                  style={{
                    padding: '8px 20px',
                    background: 'rgba(99, 102, 241, 0.9)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    border: '1px solid rgba(99, 102, 241, 0.6)',
                    borderRadius: '24px',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(79, 70, 229, 0.95)';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.9)';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)';
                  }}
                >
                  <span>📍</span>
                  <span>View Places</span>
            </button>
          </div>
            </div>

            {/* Members Section - Glass Design */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              marginBottom: '20px'
            }}>
              <h4 style={{
                margin: '0 0 16px 0',
                fontSize: '1.125rem',
                fontWeight: '700',
                color: '#111827'
              }}>
                Members ({selectedGroup.members.length})
              </h4>

              {/* Info Tip - Glass Design */}
              <div style={{
                padding: '16px',
                background: 'rgba(239, 246, 255, 0.6)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: '12px',
                marginBottom: '20px',
                border: '1px solid rgba(191, 219, 254, 0.4)',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>💡</span>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: '0 0 6px 0',
                      fontSize: '0.8125rem',
                      color: '#111827',
                      fontWeight: '700',
                      lineHeight: '1.4'
                    }}>
                      How Group Places Work
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: '0.75rem',
                      color: '#1e40af',
                      fontWeight: '500',
                      lineHeight: '1.5'
                    }}>
                      <strong>Automatic Sync:</strong> Places added to your personal lists (✓ ⭐ ❤️) automatically appear in all your groups. Members can see each other's suggestions for easier planning!
                    </p>
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      color: '#1e3a8a',
                      fontWeight: '600',
                      lineHeight: '1.4'
                    }}>
                      👉 <strong>To add:</strong> Search places, then click ✓ ⭐ ❤️ on any place card
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Member Form (Admin only) */}
            {selectedGroup.group.your_role === 'admin' && (
                <form onSubmit={handleAddMember} style={{
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    color: '#000000'
                  }}>
                    Add Member
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                      placeholder="Username or Email"
                  value={newMemberUsername}
                  onChange={(e) => setNewMemberUsername(e.target.value)}
                  required
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        color: '#000000',
                        background: 'white',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="submit"
                      disabled={addingMember || !newMemberUsername.trim()}
                      style={{
                        padding: '10px 20px',
                        background: addingMember || !newMemberUsername.trim()
                          ? '#d1d5db'
                          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        cursor: addingMember || !newMemberUsername.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {addingMember ? 'Adding...' : '+ Add'}
                </button>
                  </div>
                  <small style={{
                    display: 'block',
                    marginTop: '6px',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Enter the username or email of the user you want to add
                  </small>
              </form>
            )}

              {/* Members List - Glass Card Design */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedGroup.members.map(member => (
                  <div
                    key={member.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.5)',
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(31, 38, 135, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.06)';
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.8125rem',
                        boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)',
                        flexShrink: 0
                      }}>
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '700',
                          color: '#111827',
                          marginBottom: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {member.username}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontWeight: '500',
                          textTransform: 'capitalize'
                        }}>
                          {member.role}
                        </div>
                      </div>
                  </div>
                    {selectedGroup.group.your_role === 'admin' && 
                     member.user_id !== selectedGroup.group.created_by && (
                    <button
                        onClick={() => handleRemoveMember(member.user_id, member.username)}
                      disabled={loading}
                        style={{
                          width: '28px',
                          height: '28px',
                          padding: '0',
                          background: 'transparent',
                          color: '#000000',
                          border: '1.5px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) {
                            e.currentTarget.style.background = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#9ca3af';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = '#d1d5db';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                        aria-label={`Remove ${member.username}`}
                        title={`Remove ${member.username}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
          /* Groups List View */
          <div>
          {loading && groups.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#64748b',
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 16px rgba(31, 38, 135, 0.1)'
              }}>
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '16px',
                  animation: 'pulse 2s ease-in-out infinite'
                }}>
                  ⏳
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000000' }}>
                  Loading groups...
                </div>
              </div>
          ) : groups.length === 0 ? (
              /* Enhanced Empty State */
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                maxWidth: '500px',
                margin: '0 auto',
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 16px rgba(31, 38, 135, 0.1)'
              }}>
                <div style={{
                  fontSize: '5rem',
                  marginBottom: '24px',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
                }}>
                  👥
                </div>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  color: '#000000'
                }}>
                  No Groups Yet
                </h3>
                <p style={{
                  margin: '0 0 32px 0',
                  fontSize: '1rem',
                  color: '#64748b',
                  lineHeight: '1.6'
                }}>
                  Create a group to start sharing places with friends and family. 
                  Everyone in the group can see places from each other's lists!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    padding: '14px 28px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                  }}
                >
                  + Create Your First Group
                </button>
              </div>
            ) : (
              /* Groups List - Glass Card Design */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingBottom: '8px'
              }}>
                {groups.map(group => (
                  <div
                    key={group.group_id}
                    style={{
                      /* Glass Card Effect - More Opaque for Better Readability */
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      padding: '20px',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.5)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(31, 38, 135, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
                    }}
                  >
                    {/* Group Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                      gap: '10px'
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1f2937',
                        flex: 1,
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-0.1px'
                      }}>
                        {group.name}
                      </h4>
                      <span style={{
                        padding: '4px 10px',
                        background: group.your_role === 'admin'
                          ? 'rgba(254, 243, 199, 0.8)'
                          : 'rgba(224, 242, 254, 0.8)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        color: '#1f2937',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        border: group.your_role === 'admin'
                          ? '1px solid rgba(251, 191, 36, 0.4)'
                          : '1px solid rgba(59, 130, 246, 0.4)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                        lineHeight: '1.2'
                      }}>
                        {group.your_role}
                      </span>
                    </div>

                    {/* Description */}
                {group.description && (
                      <p style={{
                        margin: '0 0 14px 0',
                        fontSize: '0.8125rem',
                        color: '#6b7280',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {group.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(243, 244, 246, 0.6)',
                      marginTop: 'auto' // Push to bottom
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#6b7280'
                        }}>
                          <span style={{ fontSize: '12px' }}>👥</span>
                          <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
                        </div>
                        {/* User Profile Avatars */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '-4px',
                          marginLeft: '4px'
                        }}>
                          {Array.from({ length: Math.min(group.member_count, 4) }).map((_, index) => (
                            <div
                              key={index}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${
                                  ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'][index % 4]
                                }, ${
                                  ['#4f46e5', '#7c3aed', '#db2777', '#d97706'][index % 4]
                                })`,
                                border: '2px solid rgba(255, 255, 255, 0.9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: '600',
                                color: 'white',
                                marginLeft: index > 0 ? '-6px' : '0',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                                zIndex: 4 - index
                              }}
                              title={`Member ${index + 1}`}
                            >
                              {String.fromCharCode(65 + (index % 26))}
                            </div>
                          ))}
                          {group.member_count > 4 && (
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'rgba(107, 114, 128, 0.2)',
                                backdropFilter: 'blur(4px)',
                                WebkitBackdropFilter: 'blur(4px)',
                                border: '2px solid rgba(255, 255, 255, 0.9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '9px',
                                fontWeight: '600',
                                color: '#6b7280',
                                marginLeft: '-6px',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                                zIndex: 0
                              }}
                              title={`+${group.member_count - 4} more`}
                            >
                              +{group.member_count - 4}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewGroup(group.group_id);
                      }}
                          style={{
                            padding: '6px 14px',
                            height: '32px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            color: '#6366f1',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(99, 102, 241, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(99, 102, 241, 0.15)';
                            e.target.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                            e.target.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 1px 3px rgba(99, 102, 241, 0.12)';
                          }}
                    >
                      Details
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPlaces(group.group_id);
                      }}
                          style={{
                            padding: '6px 16px',
                            height: '32px',
                            background: 'rgba(99, 102, 241, 0.9)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: 'white',
                            border: '1px solid rgba(99, 102, 241, 0.6)',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(79, 70, 229, 0.95)';
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 10px rgba(99, 102, 241, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(99, 102, 241, 0.9)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.3)';
                          }}
                        >
                          Places
                    </button>
                  </div>
                </div>
                  </div>
                ))}
              </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default Groups;
