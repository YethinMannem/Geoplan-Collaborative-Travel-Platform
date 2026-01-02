import React, { useState, useEffect, useRef } from 'react';
import { getUserGroups, createGroup, getGroupDetails, addGroupMember, removeGroupMember, getGroupPlaces, getGroupMessages } from '../services/userListsApi';
import GroupChat from './GroupChat';
import './Groups.css';

// Helper function to render member avatar
const renderMemberAvatar = (member) => {
  const hasPhoto = member?.profile_photo_url && member.profile_photo_url && member.profile_photo_url.trim() !== '';
  const displayName = member?.display_name || member?.username;
  const initials = displayName?.[0]?.toUpperCase() || '👤';
  
  return (
    <div 
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: hasPhoto ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', // Only show gradient when NO photo
        backgroundImage: hasPhoto ? `url(${member.profile_photo_url})` : 'none', // Only show image when photo exists
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)',
        flexShrink: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
      title={displayName}
    >
      {/* Show initials only when NO photo - use black text for better visibility */}
      {!hasPhoto && (
        <span style={{
          color: '#000000',
          fontWeight: '700',
          fontSize: '0.8125rem',
          zIndex: 1,
          textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
        }}>
          {initials}
        </span>
      )}
    </div>
  );
};

function Groups({ onViewGroupPlaces, onClose, initialGroupIdToShow }) {
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
  const [showChat, setShowChat] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const lastViewedMessageIdRef = useRef(null);
  const unreadCheckIntervalRef = useRef(null);

  useEffect(() => {
    loadGroups();
  }, []);

  // Check for unread messages when a group is selected and chat is closed
  const checkUnreadMessages = async (groupId) => {
    if (!groupId || !currentUserId || showChat) return;
    
    try {
      const response = await getGroupMessages(groupId);
      if (response && response.success && response.messages) {
        const messages = response.messages;
        if (messages.length === 0) {
          setUnreadMessageCount(0);
          return;
        }
        
        // If we haven't viewed messages yet, set the last viewed to the last message
        if (lastViewedMessageIdRef.current === null) {
          const lastMessageId = messages[messages.length - 1].message_id;
          lastViewedMessageIdRef.current = lastMessageId;
          setUnreadMessageCount(0);
          return;
        }
        
        // Count messages after the last viewed message ID
        const lastViewedIndex = messages.findIndex(m => m.message_id === lastViewedMessageIdRef.current);
        if (lastViewedIndex === -1) {
          // Last viewed message not found, count all messages
          setUnreadMessageCount(messages.length);
        } else {
          // Count messages after the last viewed one
          const unreadCount = messages.length - lastViewedIndex - 1;
          setUnreadMessageCount(Math.max(0, unreadCount));
        }
      }
    } catch (err) {
      console.error('Error checking unread messages:', err);
    }
  };

  // Poll for unread messages when group is selected and chat is closed
  useEffect(() => {
    const groupId = selectedGroup?.group?.group_id;
    if (groupId && !showChat && currentUserId) {
      // Reset unread count and last viewed when group changes
      lastViewedMessageIdRef.current = null;
      
      // Initial check
      checkUnreadMessages(groupId);
      
      // Poll every 5 seconds
      unreadCheckIntervalRef.current = setInterval(() => {
        checkUnreadMessages(groupId);
      }, 5000);
      
      return () => {
        if (unreadCheckIntervalRef.current) {
          clearInterval(unreadCheckIntervalRef.current);
        }
      };
    } else {
      setUnreadMessageCount(0);
      if (unreadCheckIntervalRef.current) {
        clearInterval(unreadCheckIntervalRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.group?.group_id, showChat, currentUserId]);

  // Show group details if initialGroupIdToShow is provided
  useEffect(() => {
    if (initialGroupIdToShow && !selectedGroup) {
      handleViewGroup(initialGroupIdToShow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGroupIdToShow]);

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
      // Extract current user ID from the response
      if (response && response.current_user_id) {
        setCurrentUserId(response.current_user_id);
      }
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
      {/* Header - Integrated Glass Style - Only show on groups list page */}
      {!selectedGroup && (
        <div style={{ 
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          flexShrink: 0,
          background: 'rgba(99, 102, 241, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <h2 style={{ 
            margin: 0, 
            color: '#1f2937', 
            fontSize: '16px', 
            fontWeight: '600',
            letterSpacing: '-0.1px'
          }}>
            Groups
          </h2>
          <button 
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '2px 6px',
              height: '20px',
              minWidth: 'auto',
              background: 'rgba(99, 102, 241, 0.9)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(99, 102, 241, 0.6)',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              boxShadow: '0 1px 3px rgba(99, 102, 241, 0.25)',
              whiteSpace: 'nowrap',
              lineHeight: '1'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(79, 70, 229, 0.95)';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(99, 102, 241, 0.9)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 1px 3px rgba(99, 102, 241, 0.25)';
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: '600', lineHeight: '1' }}>+</span>
            <span style={{ fontSize: '10px', lineHeight: '1' }}>Create</span>
          </button>
        </div>
      )}

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
            {/* Breadcrumb Navigation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}>
              <span
                onClick={() => {
                  setSelectedGroup(null);
                  setError(null);
                  setShowChat(false);
                }}
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
                  outline: 'none'
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
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>›</span>
              <span style={{ color: '#000000', fontSize: '14px', fontWeight: '400' }}>
                {selectedGroup.group.name}
              </span>
            </div>
            
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
                      padding: '14px',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.5)',
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
                      transition: 'all 0.2s ease',
                      position: 'relative'
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
                      {renderMemberAvatar(member)}
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
                          {member.display_name || member.username}
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
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          width: '24px',
                          height: '24px',
                          padding: '0',
                          background: '#fee2e2',
                          color: '#ef4444',
                          border: '1.5px solid #ef4444',
                          borderRadius: '6px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          zIndex: 10
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading) {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#ef4444';
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
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            </div>

            {/* Chat Panel - Fixed Right Side Panel */}
            {showChat && currentUserId && selectedGroup && selectedGroup.group && (
              <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '30%',
                minWidth: '320px',
                maxWidth: '500px',
                background: 'white',
                boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideInRight 0.3s ease-out',
                overflow: 'hidden',
                pointerEvents: 'auto'
              }}>
                <GroupChat
                  groupId={selectedGroup.group.group_id}
                  currentUserId={currentUserId}
                  onClose={() => {
                    setShowChat(false);
                    // Mark messages as read when closing chat
                    checkUnreadMessages(selectedGroup.group.group_id);
                  }}
                  onMessagesLoaded={(messages) => {
                    // Mark all messages as viewed when chat opens
                    if (messages && messages.length > 0) {
                      const lastMessageId = messages[messages.length - 1].message_id;
                      lastViewedMessageIdRef.current = lastMessageId;
                      setUnreadMessageCount(0);
                    }
                  }}
                />
              </div>
            )}

            {/* Floating Chat Button */}
            {!showChat && currentUserId && selectedGroup && selectedGroup.group && (
              <button
                onClick={() => setShowChat(true)}
                style={{
                  position: 'fixed',
                  bottom: '24px',
                  right: '24px',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  zIndex: 1001,
                  transition: 'all 0.3s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
                }}
                aria-label="Open group chat"
                title="Open group chat"
              >
                {/* Speech Bubble with Ellipsis Icon */}
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ position: 'relative' }}
                >
                  {/* Speech Bubble Shape */}
                  <path
                    d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                    fill="white"
                  />
                  {/* Ellipsis dots (three horizontal dots) */}
                  <circle cx="8" cy="12" r="1.5" fill="#6366f1" />
                  <circle cx="12" cy="12" r="1.5" fill="#6366f1" />
                  <circle cx="16" cy="12" r="1.5" fill="#6366f1" />
                </svg>
                
                {/* Unread Message Badge */}
                {unreadMessageCount > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      minWidth: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      background: '#ef4444',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '0 6px',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                      border: '2px solid white',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                  >
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </div>
                )}
              </button>
            )}
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
              /* Groups List - Modern Grid Layout */
              <div className="groups-grid-container" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '24px',
                paddingBottom: '8px'
              }}>
                {groups.map(group => (
                  <div
                    key={group.group_id}
                    className="group-card"
                    style={{
                      /* Modern Card Design */
                      background: '#ffffff',
                      padding: '24px',
                      borderRadius: '16px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
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
                          {(group.member_preview || []).slice(0, 4).map((member, index) => {
                            const hasPhoto = member?.profile_photo_url && member.profile_photo_url && member.profile_photo_url.trim() !== '';
                            const displayName = member?.display_name || member?.username;
                            const initials = displayName?.[0]?.toUpperCase() || '👤';
                            
                            // Gradient colors for initials background (only when no photo)
                            const gradientColors = [
                              { start: '#6366f1', end: '#4f46e5' },
                              { start: '#8b5cf6', end: '#7c3aed' },
                              { start: '#ec4899', end: '#db2777' },
                              { start: '#f59e0b', end: '#d97706' }
                            ];
                            const colors = gradientColors[index % 4];
                            const gradientBg = `linear-gradient(135deg, ${colors.start}, ${colors.end})`;
                            
                            return (
                              <div
                                key={member.user_id || index}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: hasPhoto ? 'transparent' : gradientBg, // Only show gradient when NO photo
                                  backgroundImage: hasPhoto ? `url(${member.profile_photo_url})` : 'none', // Only show image when photo exists
                                  backgroundSize: hasPhoto ? 'cover' : 'auto',
                                  backgroundPosition: hasPhoto ? 'center' : 'auto',
                                  backgroundRepeat: hasPhoto ? 'no-repeat' : 'no-repeat',
                                  border: '2px solid rgba(255, 255, 255, 0.9)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  marginLeft: index > 0 ? '-6px' : '0',
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                                  zIndex: 4 - index,
                                  overflow: 'hidden',
                                  position: 'relative'
                                }}
                                title={displayName}
                              >
                                {/* Show initials only when NO photo - use black text for better visibility */}
                                {!hasPhoto && (
                                  <span style={{
                                    color: '#000000',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    lineHeight: '1',
                                    zIndex: 1,
                                    textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
                                  }}>
                                    {initials}
                                  </span>
                                )}
                              </div>
                            );
                          })}
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
