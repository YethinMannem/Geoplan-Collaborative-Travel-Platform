import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile, updateUserProfile } from '../services/userListsApi';
import './AccountSettings.css';

function AccountSettings({ onClose, onUpdate }) {
  // Ensure callbacks are functions
  const handleClose = typeof onClose === 'function' ? onClose : () => {};
  const handleUpdate = typeof onUpdate === 'function' ? onUpdate : () => {};
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    display_name: '',
    profile_photo_url: '',
    bio: '',
    location: '',
    website: ''
  });
  const [originalData, setOriginalData] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getUserProfile();
      if (response && response.user) {
        const user = response.user;
        const data = {
          display_name: (user.display_name !== null && user.display_name !== undefined) ? user.display_name : '',
          profile_photo_url: (user.profile_photo_url !== null && user.profile_photo_url !== undefined) ? user.profile_photo_url : '',
          bio: (user.bio !== null && user.bio !== undefined) ? user.bio : '',
          location: (user.location !== null && user.location !== undefined) ? user.location : '',
          website: (user.website !== null && user.website !== undefined) ? user.website : ''
        };
        setFormData(data);
        setOriginalData(data);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
      // Still set empty data so user can see the form
      const emptyData = {
        display_name: '',
        profile_photo_url: '',
        bio: '',
        location: '',
        website: ''
      };
      setFormData(emptyData);
      setOriginalData(emptyData);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
    
    // Clear photo file if user is typing a URL
    if (name === 'profile_photo_url' && photoFile) {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  const handlePhotoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setPhotoFile(file);
    setError('');
    setSuccess('');

    // Create preview and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      // Convert to base64 data URL and set as profile_photo_url
      setFormData(prev => ({
        ...prev,
        profile_photo_url: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData(prev => ({
      ...prev,
      profile_photo_url: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Only send fields that have changed
      const updates = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== (originalData?.[key] || '')) {
          updates[key] = formData[key] || null;
        }
      });

      if (Object.keys(updates).length === 0) {
        setSuccess('No changes to save');
        setSaving(false);
        return;
      }

      const response = await updateUserProfile(updates);
      if (response && response.success) {
        setSuccess('Profile updated successfully!');
        setOriginalData({ ...formData });
        // Clear photo file after successful save
        setPhotoFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        handleUpdate(response.user);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!originalData) return false;
    return Object.keys(formData).some(key => 
      formData[key] !== (originalData[key] || '')
    );
  };

  if (loading) {
    return (
      <div className="account-settings-modal">
        <div className="account-settings-content">
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-settings-modal">
      <div className="account-settings-content">
        <div className="account-settings-header">
          <h2>Account Settings</h2>
          <button 
            onClick={handleClose}
            className="close-button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="error-message" style={{
            padding: '12px 16px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="success-message" style={{
            padding: '12px 16px',
            background: '#d1fae5',
            border: '1px solid #6ee7b7',
            borderRadius: '8px',
            color: '#059669',
            marginBottom: '20px'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Profile Photo Section */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">📷</span>
              Profile Photo
            </label>
            
            {/* Photo Preview */}
            {(photoPreview || formData.profile_photo_url) && (
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src={photoPreview || formData.profile_photo_url} 
                  alt="Profile preview"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #e5e7eb'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    padding: '6px 12px',
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#fecaca';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#fee2e2';
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            
            {/* File Upload Button */}
            <div style={{ marginBottom: '12px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '10px 16px',
                  background: '#f3f4f6',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  color: '#374151',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e5e7eb';
                  e.target.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.borderColor = '#d1d5db';
                }}
              >
                📁 {photoFile ? 'Change Photo' : 'Select Photo from Device'}
              </button>
            </div>
            
            {/* URL Input (Alternative) */}
            <div style={{ marginTop: '12px' }}>
              <p style={{ 
                fontSize: '0.8125rem', 
                color: '#6b7280', 
                marginBottom: '8px',
                fontWeight: '600'
              }}>
                Or enter photo URL:
              </p>
              <input
                type="url"
                name="profile_photo_url"
                value={formData.profile_photo_url}
                onChange={handleInputChange}
                placeholder="https://example.com/photo.jpg"
                className="form-input"
              />
            </div>
            <p className="form-help">Upload a photo from your device or enter a URL. Maximum file size: 5MB</p>
          </div>

          {/* Display Name */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">👤</span>
              Display Name
            </label>
            <input
              type="text"
              name="display_name"
              value={formData.display_name}
              onChange={handleInputChange}
              placeholder="Your display name"
              maxLength={100}
              className="form-input"
            />
            <p className="form-help">This is how your name appears to others</p>
          </div>

          {/* Bio */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">📝</span>
              Bio
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Tell us about yourself..."
              rows={4}
              maxLength={500}
              className="form-textarea"
            />
            <p className="form-help">{formData.bio.length}/500 characters</p>
          </div>

          {/* Location */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">📍</span>
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="City, State, Country"
              className="form-input"
            />
          </div>

          {/* Website */}
          <div className="form-section">
            <label className="form-label">
              <span className="label-icon">🌐</span>
              Website
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://yourwebsite.com"
              className="form-input"
            />
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges()}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AccountSettings;

