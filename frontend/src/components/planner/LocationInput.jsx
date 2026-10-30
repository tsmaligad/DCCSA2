import React from 'react';
import { SearchIcon, MapPinIcon, CrosshairIcon, NavigationIcon } from '../icons/Icons';

export default function LocationInput({
  type, // 'start' | 'dest'
  location,
  activeInput,
  setActiveInput,
  searchQuery,
  handleSearchInputChange,
  searchResults,
  handleSelectEstablishment,
  handleUseCurrentLocation,
  setMapPickMode
}) {
  const isStart = type === 'start';
  const activeBorder = isStart ? '1.5px solid #2563eb' : '1.5px solid #ef4444';
  const dotBg = isStart ? '#2563eb' : '#ef4444';
  const iconColor = isStart ? '#2563eb' : '#ef4444';
  const placeholder = isStart ? 'Select origin' : 'Select destination';

  return (
    <div style={{ position: 'relative', zIndex: activeInput === type ? 100 : 2, marginBottom: isStart ? '14px' : '0' }}>
      <div
        onClick={() => {
          setActiveInput(activeInput === type ? null : type);
          handleSearchInputChange('');
        }}
        style={{
          padding: '10px 14px 10px 38px',
          background: '#ffffff',
          borderRadius: '10px',
          cursor: 'pointer',
          border: activeInput === type ? activeBorder : '1px solid #cbd5e1',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          position: 'relative'
        }}
      >
        <div style={{
          position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
          width: '10px', height: '10px', borderRadius: '50%', background: dotBg, border: '2px solid #ffffff', boxShadow: `0 0 0 2px ${dotBg}`
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: 'calc(100% - 20px)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {location.label}
          </span>
          <span style={{ fontSize: '0.73rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
            {location.address || placeholder}
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0 }}>▼</span>
      </div>

      {/* SEARCH DROPDOWN OVERLAY */}
      {activeInput === type && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)', zIndex: 200
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
            <SearchIcon size={15} color="#64748b" />
            <input
              type="text"
              autoFocus
              placeholder="Search address, establishment, or area..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#0f172a' }}
            />
          </div>

          <div style={{ maxHeight: '230px', overflowY: 'auto' }}>
            {searchResults.map((place, idx) => {
              const rawParts = place.display_name ? place.display_name.split(',') : [];
              const title = place.name || rawParts[0]?.trim() || 'Place';
              const fullAddress = rawParts.length > 1 ? rawParts.slice(1).join(',').trim() : place.display_name;

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectEstablishment(place, type)}
                  style={{
                    padding: '9px 10px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start',
                    gap: '10px', marginBottom: '2px', transition: 'background 0.12s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>
                    <MapPinIcon size={15} color={iconColor} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {title}
                    </span>
                    <span style={{ fontSize: '0.73rem', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {fullAddress}
                    </span>
                  </div>
                </div>
              );
            })}

            {isStart && (
              <div
                onClick={handleUseCurrentLocation}
                style={{
                  padding: '9px 10px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: '10px', color: '#2563eb', fontWeight: '600', fontSize: '0.8rem', background: '#eff6ff', marginTop: '4px'
                }}
              >
                <CrosshairIcon size={15} color="#2563eb" />
                Use current location (GPS)
              </div>
            )}

            <div
              onClick={() => { setMapPickMode(type); setActiveInput(null); }}
              style={{
                padding: '9px 10px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '10px', color: '#475569', fontWeight: '500', fontSize: '0.8rem', marginTop: '2px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <NavigationIcon size={15} color="#475569" />
              Select location on map
            </div>
          </div>
        </div>
      )}
    </div>
  );
}