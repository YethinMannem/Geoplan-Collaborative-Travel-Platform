import React, { useState, useRef, useEffect } from 'react';

function MultiSelectDropdown({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder = 'Select...',
  label = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    // Add listener after a brief delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (value) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newSelected);
  };

  // Use label as placeholder if no placeholder is provided
  const effectivePlaceholder = placeholder || label || 'Select...';

  const displayText = selectedValues.length > 0 
    ? `${selectedValues.length} selected`
    : effectivePlaceholder;

  return (
    <div 
      ref={dropdownRef} 
      style={{ 
        position: 'relative', 
        width: '100%',
        zIndex: isOpen ? 1000 : 'auto'
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          width: '100%',
          padding: '8px 32px 8px 10px',
          fontSize: '0.75rem',
          fontWeight: '500',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          borderRadius: '6px',
          outline: 'none',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 4px 12px rgba(255, 107, 107, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          minHeight: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.target.style.borderColor = 'rgba(255, 107, 107, 0.5)';
            e.target.style.boxShadow = '0 2px 6px rgba(255, 107, 107, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.target.style.borderColor = 'rgba(255, 107, 107, 0.3)';
            e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }
        }}
      >
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selectedValues.length > 0 ? '#1f2937' : '#000000',
          fontWeight: '500'
        }}>
          {displayText}
        </span>
        <span style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}`,
          transition: 'transform 0.2s ease',
          fontSize: '0.7rem',
          color: '#6b7280',
          flexShrink: 0
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            zIndex: 1001,
            maxHeight: '250px',
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(option.value);
                }}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                  background: isSelected 
                    ? 'rgba(255, 107, 107, 0.15)' 
                    : 'transparent',
                  border: isSelected
                    ? '1px solid rgba(255, 107, 107, 0.3)'
                    : '1px solid transparent',
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 107, 107, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  border: `2px solid ${isSelected ? 'rgba(255, 107, 107, 0.8)' : '#d1d5db'}`,
                  background: isSelected ? 'rgba(255, 107, 107, 0.9)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}>
                  {isSelected && (
                    <span style={{
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      lineHeight: 1
                    }}>✓</span>
                  )}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#1f2937',
                  fontWeight: isSelected ? '600' : '400'
                }}>
                  {option.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selectedValues.length > 0 && (
        <div style={{
          marginTop: '6px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '5px'
        }}>
          {selectedValues.map((value) => {
            const option = options.find(opt => opt.value === value);
            return (
              <span
                key={value}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.65rem',
                  background: 'rgba(255, 107, 107, 0.2)',
                  border: '1px solid rgba(255, 107, 107, 0.4)',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {option?.label || value}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedValues.filter(v => v !== value));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0,
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#991b1b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#dc2626';
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;