import React, { useState } from 'react';
import './Login.css';
import { setAuthToken } from '../services/api';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const DEMO_USERS = [
  {
    role: 'readonly_user',
    username: 'readonly_user',
    password: 'readonly_pass123',
    description: 'Read-only access - Can only view data'
  },
  {
    role: 'app_user',
    username: 'app_user',
    password: 'app_pass123',
    description: 'Application user - Can read and write data'
  },
  {
    role: 'analyst_user',
    username: 'analyst_user',
    password: 'analyst_pass123',
    description: 'Analyst - Can read data and use analytics'
  },
  {
    role: 'admin_user',
    username: 'admin_user',
    password: 'admin_pass123',
    description: 'Admin - Full access to all operations'
  }
];

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for sessions
        body: JSON.stringify({ username, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, the server might not be running
        throw new Error(`Server connection failed. Make sure Flask is running on ${API_BASE}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Login failed: HTTP ${response.status}`);
      }

      // Save token to localStorage
      if (data.token) {
        setAuthToken(data.token);
        console.log('✅ Token saved to localStorage:', data.token.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ No token received from login response!', data);
      }

      // Success!
      if (onLoginSuccess) {
        onLoginSuccess(data);
      }
    } catch (err) {
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoUser) => {
    setUsername(demoUser.username);
    setPassword(demoUser.password);
    // Auto-submit after a brief delay
    setTimeout(() => {
      document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 100);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>📍 GeoPlan</h1>
        <p className="login-subtitle">Collaborative Travel Planning Platform</p>
        
        <form id="login-form" onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && <div className="error-message">❌ {error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="demo-users-section">
          <button
            type="button"
            className="demo-toggle"
            onClick={() => setShowDemoUsers(!showDemoUsers)}
          >
            {showDemoUsers ? '▼ Hide' : '▶ Show'} Demo Users
          </button>

          {showDemoUsers && (
            <div className="demo-users-list">
              <p className="demo-note">
                Click any demo user to auto-fill credentials and login:
              </p>
              {DEMO_USERS.map((user) => (
                <button
                  key={user.role}
                  type="button"
                  className="demo-user-button"
                  onClick={() => handleDemoLogin(user)}
                >
                  <strong>{user.role}</strong>
                  <span>{user.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Login;

