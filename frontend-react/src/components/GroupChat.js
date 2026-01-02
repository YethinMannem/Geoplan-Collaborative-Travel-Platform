import React, { useState, useEffect, useRef } from 'react';
import { getGroupMessages, sendGroupMessage } from '../services/userListsApi';
import { getAuthToken } from '../services/api';
import './GroupChat.css';

function GroupChat({ groupId, currentUserId, onClose, onMessagesLoaded }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Scroll to bottom when messages change (only scroll within chat container, not the whole page)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Only scroll if user is already near the bottom (don't interrupt if they're reading old messages)
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom || messages.length === 0) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
          scrollToBottom();
        }, 0);
      }
    }
  }, [messages]);

  // Load messages
  useEffect(() => {
    if (!groupId) return;
    loadMessages();
    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [groupId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getGroupMessages(groupId);
      if (response && response.success) {
        const messages = response.messages || [];
        setMessages(messages);
        // Notify parent component about loaded messages
        if (onMessagesLoaded && messages.length > 0) {
          onMessagesLoaded(messages);
        }
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setError('');

    try {
      const response = await sendGroupMessage(groupId, messageText);
      if (response && response.success && response.message) {
        // Add the new message to the list
        setMessages(prev => [...prev, response.message]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      // Restore message text on error
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // Helper function to render user avatar
  const renderAvatar = (user, size = 'small') => {
    const hasPhoto = user?.profile_photo_url && user.profile_photo_url.trim() !== '';
    const displayName = user?.display_name || user?.username;
    const initials = displayName?.[0]?.toUpperCase() || '👤';
    const avatarSize = size === 'small' ? '32px' : '40px';
    const fontSize = size === 'small' ? '0.75rem' : '0.875rem';

    return (
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          background: hasPhoto ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          backgroundImage: hasPhoto ? `url(${user.profile_photo_url})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}
        title={displayName}
      >
        {!hasPhoto && (
          <span style={{
            color: '#000000',
            fontWeight: '700',
            fontSize: fontSize,
            textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
          }}>
            {initials}
          </span>
        )}
      </div>
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#ffffff',
      overflow: 'hidden',
      maxHeight: '100%',
      borderRadius: '20px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
          }}>
            💬
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#1e293b',
            letterSpacing: '-0.5px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            Group Chat
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              background: '#f1f5f9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
              color: '#64748b',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#fee2e2';
              e.target.style.color = '#dc2626';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#f1f5f9';
              e.target.style.color = '#64748b';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 24px 40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: '#fafbfc'
        }}
      >
        {loading && messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#94a3b8',
            fontSize: '0.9375rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#94a3b8'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '20px', opacity: 0.6 }}>💬</div>
            <div style={{ 
              fontSize: '0.9375rem', 
              fontWeight: '500',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}>
              No messages yet. Start the conversation!
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.user_id === currentUserId;
            return (
              <div
                key={message.message_id}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-end',
                  flexDirection: 'row',
                  justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                  marginBottom: '4px'
                }}
              >
                {/* Avatar - Only show for received messages (other users) */}
                {!isCurrentUser && (
                  <div style={{ flexShrink: 0 }}>
                    {renderAvatar(message, 'small')}
                  </div>
                )}
                
                {/* Message Content */}
                <div style={{
                  flex: 1,
                  maxWidth: isCurrentUser ? '70%' : '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isCurrentUser ? 'flex-end' : 'flex-start'
                }}>
                  {/* Sender Name & Time - Only show for received messages */}
                  {!isCurrentUser && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.75rem',
                      color: '#64748b',
                      paddingLeft: '4px',
                      marginBottom: '6px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                    }}>
                      <span style={{ fontWeight: '600', color: '#475569' }}>
                        {message.display_name || message.username}
                      </span>
                      <span style={{ color: '#94a3b8' }}>{formatTime(message.created_at)}</span>
                      {message.edited && (
                        <span style={{ fontStyle: 'italic', fontSize: '0.7rem', color: '#94a3b8' }}>
                          (edited)
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: isCurrentUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isCurrentUser
                      ? 'rgba(99, 102, 241, 0.9)'
                      : 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: isCurrentUser ? '#ffffff' : '#1e293b',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    wordWrap: 'break-word',
                    boxShadow: isCurrentUser
                      ? '0 2px 8px rgba(99, 102, 241, 0.25)'
                      : '0 1px 3px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5)',
                    border: isCurrentUser
                      ? 'none'
                      : '1px solid rgba(255, 255, 255, 0.6)',
                    maxWidth: '100%',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    fontWeight: '400'
                  }}>
                    {message.message_text}
                  </div>
                  
                  {/* Time for current user messages */}
                  {isCurrentUser && (
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      paddingRight: '4px',
                      paddingTop: '4px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                    }}>
                      {formatTime(message.created_at)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 20px',
          background: '#fee2e2',
          color: '#dc2626',
          fontSize: '0.875rem',
          borderTop: '2px solid #fecaca'
        }}>
          {error}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '20px 24px 28px 24px',
          borderTop: '1px solid #f1f5f9',
          background: '#ffffff',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          borderBottomLeftRadius: '20px',
          borderBottomRightRadius: '20px'
        }}
      >
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          background: '#f8fafc',
          borderRadius: '28px',
          padding: '4px',
          border: '1px solid #e2e8f0',
          transition: 'all 0.2s ease'
        }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            rows={1}
            style={{
              flex: 1,
              padding: '12px 18px',
              border: 'none',
              borderRadius: '24px',
              fontSize: '0.9375rem',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '120px',
              background: 'transparent',
              color: '#1e293b',
              transition: 'all 0.2s ease',
              lineHeight: '1.5',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.parentElement.style.borderColor = '#6366f1';
              e.target.parentElement.style.background = '#ffffff';
              e.target.parentElement.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
            }}
            onBlur={(e) => {
              e.target.parentElement.style.borderColor = '#e2e8f0';
              e.target.parentElement.style.background = '#f8fafc';
              e.target.parentElement.style.boxShadow = 'none';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            onInput={(e) => {
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              background: newMessage.trim() && !sending
                ? '#6366f1'
                : '#cbd5e1',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: newMessage.trim() && !sending
                ? '0 2px 8px rgba(99, 102, 241, 0.3)'
                : 'none'
            }}
            onMouseEnter={(e) => {
              if (newMessage.trim() && !sending) {
                e.target.style.background = '#4f46e5';
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (newMessage.trim() && !sending) {
                e.target.style.background = '#6366f1';
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)';
              }
            }}
          >
            {sending ? (
              <span style={{ 
                width: '16px', 
                height: '16px', 
                border: '2px solid rgba(255,255,255,0.3)', 
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                display: 'inline-block',
                flexShrink: 0
              }}></span>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GroupChat;

