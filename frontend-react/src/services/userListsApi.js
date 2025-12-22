import { setAuthToken, getAuthToken } from './api';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5001';

async function fetchAPI(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// USER ACCOUNTS & PERSONAL LISTS API
// ============================================================================

export async function registerUser(userData) {
  return fetchAPI('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function loginUser(userData) {
  const response = await fetch(`${API_BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function getUserProfile() {
  return fetchAPI('/api/users/profile');
}

// Visited List
export async function getVisitedList(lat = null, lon = null) {
  const params = new URLSearchParams();
  if (lat !== null && lon !== null) {
    params.append('lat', lat);
    params.append('lon', lon);
  }
  const queryString = params.toString();
  return fetchAPI(`/api/user/visited${queryString ? '?' + queryString : ''}`);
}

export async function addToVisited(placeId, notes = '') {
  return fetchAPI('/api/user/visited', {
    method: 'POST',
    body: JSON.stringify({ place_id: placeId, notes }),
  });
}

export async function removeFromVisited(placeId) {
  return fetchAPI(`/api/user/visited/${placeId}`, {
    method: 'DELETE',
  });
}

// Wishlist
export async function getWishlist(lat = null, lon = null) {
  const params = new URLSearchParams();
  if (lat !== null && lon !== null) {
    params.append('lat', lat);
    params.append('lon', lon);
  }
  const queryString = params.toString();
  return fetchAPI(`/api/user/wishlist${queryString ? '?' + queryString : ''}`);
}

export async function addToWishlist(placeId, priority = 1, notes = '') {
  return fetchAPI('/api/user/wishlist', {
    method: 'POST',
    body: JSON.stringify({ place_id: placeId, priority, notes }),
  });
}

export async function removeFromWishlist(placeId) {
  return fetchAPI(`/api/user/wishlist/${placeId}`, {
    method: 'DELETE',
  });
}

// Liked/Favorites
export async function getLikedList(lat = null, lon = null) {
  const params = new URLSearchParams();
  if (lat !== null && lon !== null) {
    params.append('lat', lat);
    params.append('lon', lon);
  }
  const queryString = params.toString();
  return fetchAPI(`/api/user/liked${queryString ? '?' + queryString : ''}`);
}

export async function addToLiked(placeId, rating = null, notes = '') {
  return fetchAPI('/api/user/liked', {
    method: 'POST',
    body: JSON.stringify({ place_id: placeId, rating, notes }),
  });
}

export async function removeFromLiked(placeId) {
  return fetchAPI(`/api/user/liked/${placeId}`, {
    method: 'DELETE',
  });
}

export async function getPlaceStatus(placeId) {
  return fetchAPI(`/api/user/place-status/${placeId}`);
}

// ============================================================================
// GROUPS API
// ============================================================================

export async function createGroup(groupData) {
  return fetchAPI('/api/groups', {
    method: 'POST',
    body: JSON.stringify(groupData),
  });
}

export async function getUserGroups() {
  return fetchAPI('/api/groups');
}

export async function getGroupDetails(groupId) {
  return fetchAPI(`/api/groups/${groupId}`);
}

export async function addGroupMember(groupId, username) {
  return fetchAPI(`/api/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function removeGroupMember(groupId, memberId) {
  return fetchAPI(`/api/groups/${groupId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function getGroupPlaces(groupId) {
  return fetchAPI(`/api/groups/${groupId}/places`);
}

export async function getPlaceGroups(placeId) {
  return fetchAPI(`/api/places/${placeId}/groups`);
}

