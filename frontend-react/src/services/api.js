const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5001';

// Token management using localStorage
const TOKEN_KEY = 'auth_token';

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function fetchAPI(endpoint, options = {}) {
  const token = getAuthToken();
  
  // Start with default headers, then merge with token headers, then user-provided headers
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Add token to headers if available (priority: token headers)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token; // Also send as custom header for compatibility
  }
  
  // Merge user-provided headers (may override Content-Type if needed)
  Object.assign(headers, options.headers || {});

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Still include cookies as fallback
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function searchPlaces(searchParams) {
  let url = '';

  if (searchParams.type === 'radius') {
    url = `/within_radius?lat=${searchParams.lat}&lon=${searchParams.lon}&km=${searchParams.km}`;
  } else if (searchParams.type === 'nearest') {
    url = `/nearest?lat=${searchParams.lat}&lon=${searchParams.lon}&k=${searchParams.k}`;
  } else if (searchParams.type === 'bbox') {
    url = `/within_bbox?north=${searchParams.north}&south=${searchParams.south}&east=${searchParams.east}&west=${searchParams.west}`;
  }

  if (searchParams.state) {
    url += `&state=${encodeURIComponent(searchParams.state)}`;
  }
  if (searchParams.name) {
    url += `&name=${encodeURIComponent(searchParams.name)}`;
  }
  if (searchParams.place_type) {
    url += `&place_type=${encodeURIComponent(searchParams.place_type)}`;
  }

  return fetchAPI(url);
}

export async function getStats() {
  return fetchAPI('/stats');
}

export async function getStateAnalytics() {
  return fetchAPI('/analytics/states');
}

export async function getDensityAnalysis(lat, lon, radius) {
  return fetchAPI(`/analytics/density?lat=${lat}&lon=${lon}&radius=${radius}`);
}

export async function exportData(format) {
  const token = getAuthToken();
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  const response = await fetch(`${API_BASE}/export/${format}`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `places.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function checkPermissions() {
  return fetchAPI('/security/permissions');
}

export async function listAllRoles() {
  return fetchAPI('/security/roles');
}

export async function addPlace(placeData) {
  return fetchAPI('/places/add', {
    method: 'POST',
    body: JSON.stringify(placeData),
  });
}

export async function uploadCSV(file) {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please login first.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Auth-Token': token,
  };

  const response = await fetch(`${API_BASE}/places/upload-csv`, {
    method: 'POST',
    credentials: 'include',
    headers: headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
