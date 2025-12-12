import React, { useState, useEffect } from 'react';
import { getUserGroups, createGroup, getGroupDetails, addGroupMember, removeGroupMember, getGroupPlaces } from '../services/userListsApi';
import './Groups.css';

function Groups({ onViewGroupPlaces }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUserGroups();
      setGroups(response.groups || []);
    } catch (err) {
      setError(err.message || 'Failed to load groups');
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
      setShowCreateForm(false);
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
      setError(err.message || 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberUsername.trim() || !selectedGroup) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await addGroupMember(selectedGroup.group.group_id, newMemberUsername.trim());
      setNewMemberUsername('');
      handleViewGroup(selectedGroup.group.group_id); // Refresh group details
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedGroup) return;
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    setLoading(true);
    setError(null);
    try {
      await removeGroupMember(selectedGroup.group.group_id, memberId);
      handleViewGroup(selectedGroup.group.group_id); // Refresh group details
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlaces = async (groupId) => {
    if (onViewGroupPlaces) {
      onViewGroupPlaces(groupId);
    }
  };

  return (
    <div className="groups-container">
      <div className="groups-header">
        <h2>👥 Groups</h2>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary"
        >
          {showCreateForm ? 'Cancel' : '+ Create Group'}
        </button>
      </div>

      {error && <div className="error-message">❌ {error}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreateGroup} className="create-group-form">
          <h3>Create New Group</h3>
          <input
            type="text"
            placeholder="Group Name (required)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            required
            minLength={3}
          />
          <textarea
            placeholder="Description (optional)"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
            rows={3}
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      )}

      {selectedGroup ? (
        <div className="group-details">
          <button 
            onClick={() => setSelectedGroup(null)}
            className="btn-secondary"
          >
            ← Back to Groups
          </button>
          
          <h3>{selectedGroup.group.name}</h3>
          {selectedGroup.group.description && (
            <p className="group-description">{selectedGroup.group.description}</p>
          )}
          
          <div className="group-actions">
            <button 
              onClick={() => handleViewPlaces(selectedGroup.group.group_id)}
              className="btn-primary"
            >
              📍 View Group Places
            </button>
          </div>

          <div className="members-section">
            <h4>Members ({selectedGroup.members.length})</h4>
            
            {selectedGroup.group.your_role === 'admin' && (
              <form onSubmit={handleAddMember} className="add-member-form">
                <input
                  type="text"
                  placeholder="Username to add"
                  value={newMemberUsername}
                  onChange={(e) => setNewMemberUsername(e.target.value)}
                  required
                />
                <button type="submit" disabled={loading} className="btn-primary">
                  Add Member
                </button>
              </form>
            )}

            <div className="members-list">
              {selectedGroup.members.map(member => (
                <div key={member.user_id} className="member-item">
                  <div className="member-info">
                    <strong>{member.username}</strong>
                    <span className="member-role">{member.role}</span>
                  </div>
                  {selectedGroup.group.your_role === 'admin' && member.user_id !== selectedGroup.group.created_by && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="btn-danger"
                      disabled={loading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="groups-list">
          {loading && groups.length === 0 ? (
            <div className="loading">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <p>You're not in any groups yet.</p>
              <p>Create a group to start sharing places with friends!</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.group_id} className="group-card">
                <div className="group-card-header">
                  <h4>{group.name}</h4>
                  <span className="group-role-badge">{group.your_role}</span>
                </div>
                {group.description && (
                  <p className="group-card-description">{group.description}</p>
                )}
                <div className="group-card-footer">
                  <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
                  <div className="group-card-actions">
                    <button 
                      onClick={() => handleViewGroup(group.group_id)}
                      className="btn-secondary"
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => handleViewPlaces(group.group_id)}
                      className="btn-primary"
                    >
                      View Places
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Groups;

