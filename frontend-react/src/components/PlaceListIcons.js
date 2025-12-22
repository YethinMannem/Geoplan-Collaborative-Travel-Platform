import React, { useState, useEffect } from 'react';
import {
  addToVisited,
  removeFromVisited,
  addToWishlist,
  removeFromWishlist,
  addToLiked,
  removeFromLiked,
} from '../services/userListsApi';
import GroupBadges from './GroupBadges';
import './PlaceListIcons.css';

function PlaceListIcons({ place, listStatus, onUpdate }) {
  const [status, setStatus] = useState(listStatus || { visited: false, in_wishlist: false, liked: false });
  const [loading, setLoading] = useState({ visited: false, wishlist: false, liked: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (listStatus) {
      setStatus(listStatus);
    }
  }, [listStatus]);

  const handleToggle = async (listType) => {
    if (loading[listType]) return;
    
    setLoading(prev => ({ ...prev, [listType]: true }));
    setError(null);
    
    try {
      if (listType === 'visited') {
        if (status.visited) {
          await removeFromVisited(place.id);
          setStatus({ ...status, visited: false });
        } else {
          await addToVisited(place.id);
          setStatus({ ...status, visited: true });
        }
      } else if (listType === 'wishlist') {
        if (status.in_wishlist) {
          await removeFromWishlist(place.id);
          setStatus({ ...status, in_wishlist: false });
        } else {
          await addToWishlist(place.id);
          setStatus({ ...status, in_wishlist: true });
        }
      } else if (listType === 'liked') {
        if (status.liked) {
          await removeFromLiked(place.id);
          setStatus({ ...status, liked: false });
        } else {
          await addToLiked(place.id);
          setStatus({ ...status, liked: true });
        }
      }
      
      if (onUpdate) {
        onUpdate();
      }
      
      // Trigger a small delay to ensure backend has processed the change
      // This helps with group places visibility
      setTimeout(() => {
        // Force a small re-render to update group badges
        window.dispatchEvent(new Event('placeListUpdated'));
      }, 500);
    } catch (err) {
      setError(err.message);
      console.error(`Error toggling ${listType}:`, err);
    } finally {
      setLoading(prev => ({ ...prev, [listType]: false }));
    }
  };

  if (!place) return null;

  return (
    <div className="place-list-icons">
      {error && (
        <div className="list-error" title={error}>
          ⚠️
        </div>
      )}
      
      {/* Visited Icon */}
      <button
        className={`list-icon-btn visited-icon ${status.visited ? 'active' : ''} ${loading.visited ? 'loading' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle('visited');
        }}
        disabled={loading.visited}
        title={status.visited ? 'Remove from visited' : 'Mark as visited'}
        aria-label={status.visited ? 'Remove from visited' : 'Mark as visited'}
      >
        {status.visited ? (
          <span className="icon-filled">✓</span>
        ) : (
          <span className="icon-outline">○</span>
        )}
      </button>

      {/* Wishlist Icon */}
      <button
        className={`list-icon-btn wishlist-icon ${status.in_wishlist ? 'active' : ''} ${loading.wishlist ? 'loading' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle('wishlist');
        }}
        disabled={loading.wishlist}
        title={status.in_wishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-label={status.in_wishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {status.in_wishlist ? (
          <span className="icon-filled">⭐</span>
        ) : (
          <span className="icon-outline">☆</span>
        )}
      </button>

      {/* Liked Icon */}
      <button
        className={`list-icon-btn liked-icon ${status.liked ? 'active' : ''} ${loading.liked ? 'loading' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle('liked');
        }}
        disabled={loading.liked}
        title={status.liked ? 'Remove from liked' : 'Like this place'}
        aria-label={status.liked ? 'Remove from liked' : 'Like this place'}
      >
        {status.liked ? (
          <span className="icon-filled">❤️</span>
        ) : (
          <span className="icon-outline">🤍</span>
        )}
      </button>
      
      {/* Group Badges - Show which groups this place belongs to */}
      {(status.visited || status.in_wishlist || status.liked) && (
        <GroupBadges placeId={place.id} compact={true} />
      )}
    </div>
  );
}

export default PlaceListIcons;

