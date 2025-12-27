import React, { useState, useRef, useEffect } from 'react';

function ModernFilterDropdown({
  label,
  placeholder,
  options,
  selectedValues = [],
  onChange,
  multiple = true,
  getOptionLabel = (opt) => opt.label || opt,
  getOptionValue = (opt) => opt.value || opt,
  activeColor = '#6366f1' // Brand purple
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleOption = (option) => {
    const value = getOptionValue(option);
    if (multiple) {
      const newSelected = selectedValues.includes(value)
        ? selectedValues.filter(v => v !== value)
        : [...selectedValues, value];
      onChange(newSelected);
    } else {
      onChange(selectedValues.includes(value) ? [] : [value]);
      setIsOpen(false);
    }
  };

  const removeValue = (value, e) => {
    e.stopPropagation(); // Prevent dropdown from opening when clicking X
    const newSelected = selectedValues.filter(v => v !== value);
    onChange(newSelected);
  };

  const isSelected = (option) => {
    const value = getOptionValue(option);
    return selectedValues.includes(value);
  };

  const hasActiveSelection = selectedValues.length > 0;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button - Modern Pill/Soft Rounded Rectangle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 40px 8px 12px',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#000000',
          background: '#ffffff',
          border: `1px solid ${hasActiveSelection ? activeColor : '#e5e7eb'}`,
          borderRadius: '12px', // Soft rounded rectangle (not fully pill, but modern)
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: isOpen 
            ? `0 4px 12px rgba(0, 0, 0, 0.1)` 
            : hasActiveSelection
              ? `0 2px 4px rgba(99, 102, 241, 0.08)`
              : '0 1px 2px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          minHeight: '40px'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = hasActiveSelection ? activeColor : '#d1d5db';
            e.currentTarget.style.background = '#f9fafb';
            e.currentTarget.style.color = '#000000';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = hasActiveSelection ? activeColor : '#e5e7eb';
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.color = '#000000';
          }
        }}
      >
        {selectedValues.length === 0 ? (
          <span style={{
            color: '#6b7280',
            fontSize: '0.875rem',
            fontWeight: '400'
          }}>
            {placeholder || label || 'Select...'}
          </span>
        ) : (
          selectedValues.map((value) => {
            const option = options.find(opt => getOptionValue(opt) === value);
            const label = option ? getOptionLabel(option) : value;
            return (
              <div
                key={value}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  color: '#000000',
                  flexShrink: 0
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={(e) => removeValue(value, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    margin: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    color: '#000000',
                    fontSize: '14px',
                    lineHeight: '1',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                    e.currentTarget.style.color = '#000000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#000000';
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
        {/* Chevron Down Icon - Sleek and modern */}
        <svg
          style={{
            position: 'absolute',
            right: '14px',
            top: '50%',
            transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}`,
            transition: 'transform 0.2s ease',
            width: '16px',
            height: '16px',
            flexShrink: 0,
            pointerEvents: 'none',
            color: hasActiveSelection ? activeColor : '#9ca3af'
          }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown Panel - Floating, Elevated Design */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '8px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          zIndex: 1000,
          maxHeight: '300px',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {options.map((option, index) => {
            const selected = isSelected(option);
            const optionLabel = getOptionLabel(option);
            const optionValue = getOptionValue(option);
            
            return (
              <div
                key={optionValue || index}
                onClick={() => toggleOption(option)}
                style={{
                  padding: '8px 12px', // Generous padding for easy clicking
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: selected 
                    ? `rgba(99, 102, 241, 0.08)` // Subtle purple tint for selected
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)'; // Light purple tint on hover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Checkmark Icon for Selected Items - Brand Purple */}
                {selected && (
                  <svg
                    style={{
                      width: '18px',
                      height: '18px',
                      flexShrink: 0,
                      color: activeColor
                    }}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {/* Empty box for unselected items */}
                {!selected && (
                  <div style={{
                    width: '18px',
                    height: '18px',
                    flexShrink: 0,
                    border: '2px solid #d1d5db',
                    borderRadius: '4px',
                    background: '#ffffff'
                  }} />
                )}
                <span style={{
                  fontSize: '0.875rem',
                  color: '#000000',
                  fontWeight: selected ? '600' : '400',
                  flex: 1
                }}>
                  {optionLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ModernFilterDropdown;
