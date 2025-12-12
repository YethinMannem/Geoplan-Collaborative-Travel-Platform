import React, { useState, useEffect } from 'react';
import {
  addToVisited,
  removeFromVisited,
  addToWishlist,
  removeFromWishlist,
  addToLiked,
  removeFromLiked,
} from '../services/userListsApi';
import './PlaceListButtons.css';

function PlaceListButtons({ place, listStatus, onUpdate }) {
  const [status, setStatus] = useState(listStatus || { visited: false, in_wishlist: false, liked: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (listStatus) {
      setStatus(listStatus);
    }
  }, [listStatus]);

  const handleToggle = async (listType, action) => {
    setLoading(true);
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
    } catch (err) {
      setError(err.message);
      console.error(`Error toggling ${listType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  if (!place) return null;

  return (
    <div className="place-list-buttons">
      {error && <div className="list-error">⚠️ {error}</div>}
      
      <button
        className={`list-btn visited-btn ${status.visited ? 'active' : ''}`}
        onClick={() => handleToggle('visited')}
        disabled={loading}
        title={status.visited ? 'Remove from visited' : 'Mark as visited'}
      >
        {status.visited ? '✓ Visited' : '○ Visited'}
      </button>

      <button
        className={`list-btn wishlist-btn ${status.in_wishlist ? 'active' : ''}`}
        onClick={() => handleToggle('wishlist')}
        disabled={loading}
        title={status.in_wishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {status.in_wishlist ? '★ Wishlist' : '☆ Wishlist'}
      </button>

      <button
        className={`list-btn liked-btn ${status.liked ? 'active' : ''}`}
        onClick={() => handleToggle('liked')}
        disabled={loading}
        title={status.liked ? 'Remove from liked' : 'Like this place'}
      >
        {status.liked ? '❤️ Liked' : '🤍 Like'}
      </button>
    </div>
  );
}

export default PlaceListButtons;

