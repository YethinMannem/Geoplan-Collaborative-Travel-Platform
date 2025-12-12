import React, { useState, useEffect } from 'react';
import { registerUser, loginUser } from '../services/userListsApi';
import './UserAuth.css';

function UserAuth({ onLoginSuccess, onCancel }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Reset form when component mounts or mode changes
  useEffect(() => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setError('');
    setSuccess('');
  }, [mode]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });

      setSuccess('Account created successfully! You can now login.');
      setFormData({
        username: formData.username,
        email: '',
        password: '',
        confirmPassword: ''
      });
      
      // Switch to login mode after successful registration
      setTimeout(() => {
        setMode('login');
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.username || !formData.password) {
      setError('Username and password are required');
      setLoading(false);
      return;
    }

    try {
      const result = await loginUser({
        username: formData.username,
        password: formData.password
      });

      setSuccess('Login successful!');
      
      if (onLoginSuccess) {
        onLoginSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-auth-overlay">
      <div className="user-auth-box" style={{ position: 'relative' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              background: '#f5f5f5',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              lineHeight: '1',
              padding: '0',
              transition: 'all 0.2s',
              fontWeight: '300',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f44336';
              e.target.style.color = 'white';
              e.target.style.borderColor = '#f44336';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#f5f5f5';
              e.target.style.color = '#666';
              e.target.style.borderColor = '#ddd';
            }}
            title="Close"
          >
            ×
          </button>
        )}
        <div className="user-auth-header">
          <h2>👤 Personal Lists Account</h2>
          <p>Create an account to save places to your personal lists</p>
        </div>

        <div className="user-auth-tabs">
          <button
            type="button"
            className={`tab-button ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setFormData({
                username: '',
                email: '',
                password: '',
                confirmPassword: ''
              });
              setError('');
              setSuccess('');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`tab-button ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setFormData({
                username: '',
                email: '',
                password: '',
                confirmPassword: ''
              });
              setError('');
              setSuccess('');
            }}
          >
            Register
          </button>
        </div>

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="user-auth-form">
            <div className="form-group">
              <label htmlFor="reg-username">Username *</label>
              <input
                id="reg-username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Choose a username (min 3 chars)"
                required
                minLength={3}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-email">Email *</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password *</label>
              <input
                id="reg-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm">Confirm Password *</label>
              <input
                id="reg-confirm"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Re-enter password"
                required
              />
            </div>

            {error && <div className="error-message">❌ {error}</div>}
            {success && <div className="success-message">✅ {success}</div>}

            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="user-auth-form">
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <div className="error-message">❌ {error}</div>}
            {success && <div className="success-message">✅ {success}</div>}

            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </form>
        )}

        <div className="user-auth-info">
          <p><small>💡 <strong>Note:</strong> This is separate from role-based login. User accounts let you create personal lists (visited, wishlist, liked places).</small></p>
        </div>
      </div>
    </div>
  );
}

export default UserAuth;

