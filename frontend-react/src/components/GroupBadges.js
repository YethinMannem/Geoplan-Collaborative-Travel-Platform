import React, { useState, useEffect } from 'react';
import { getPlaceGroups } from '../services/userListsApi';

function GroupBadges({ placeId, compact = false }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (placeId) {
      loadGroups();
    }
  }, [placeId]);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPlaceGroups(placeId);
      setGroups(response.groups || []);
    } catch (err) {
      // Silently fail - not all places will be in groups
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading || groups.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: '8px'
      }}>
        <span style={{ fontSize: '0.75rem' }}>👥</span>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: '700',
          color: '#6366f1'
        }}>
          {groups.length}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      marginTop: '8px'
    }}>
      {groups.map(group => (
        <div
          key={group.group_id}
          style={{
            padding: '4px 10px',
            background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
            color: '#4338ca',
            borderRadius: '12px',
            fontSize: '0.7rem',
            fontWeight: '700',
            border: '1px solid #a5b4fc',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'default'
          }}
          title={`In group: ${group.name}`}
        >
          <span style={{ fontSize: '0.75rem' }}>👥</span>
          <span>{group.name}</span>
        </div>
      ))}
    </div>
  );
}

export default GroupBadges;


