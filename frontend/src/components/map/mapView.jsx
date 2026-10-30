import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrafficIcon } from '../icons/Icons';
import {
  originIcon,
  destIcon,
  boardStopIcon,
  alightStopIcon,
  createCircleStopIcon,
  createHighlightedStopIcon
} from './mapIcons';

function MapController({ origin, destination, activeOption, selectedRouteDetails, activeTab, selectedStop }) {
  const map = useMap();

  useEffect(() => {
    if (selectedStop && selectedStop.lat && selectedStop.lng) {
      map.flyTo([selectedStop.lat, selectedStop.lng], 16, { animate: true, duration: 1 });
      return;
    }

    const points = [];

    if (activeTab === 'routes' && selectedRouteDetails) {
      if (selectedRouteDetails.pathPoints?.length > 0) {
        selectedRouteDetails.pathPoints.forEach(p => {
          if (Array.isArray(p)) points.push(p);
          else if (p.lat && p.lng) points.push([p.lat, p.lng]);
        });
      } else if (selectedRouteDetails.stops?.length > 0) {
        selectedRouteDetails.stops.forEach(s => {
          if (s.lat && s.lng) points.push([s.lat, s.lng]);
        });
      }
    } else if (activeTab === 'planner') {
      if (origin?.lat && origin?.lng) points.push([origin.lat, origin.lng]);
      if (destination?.lat && destination?.lng) points.push([destination.lat, destination.lng]);

      if (activeOption?.allPathPoints?.length > 0) {
        activeOption.allPathPoints.forEach(p => {
          if (p.lat && p.lng) points.push([p.lat, p.lng]);
        });
      } else if (activeOption?.allRouteStops) {
        activeOption.allRouteStops.forEach(s => {
          if (s.lat && s.lng) points.push([s.lat, s.lng]);
        });
      }
    }

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (points.length === 1) {
      map.flyTo(points[0], 14);
    }
  }, [map, origin, destination, activeOption, selectedRouteDetails, activeTab, selectedStop]);

  return null;
}

function MapClickHandler({ mapPickMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mapPickMode) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
  });
  return null;
}

export default function MapView({
  origin,
  destination,
  activeOption,
  selectedRouteDetails,
  activeTab,
  selectedStop,
  setSelectedStop,
  mapPickMode,
  onMapClick,
  showTraffic,
  setShowTraffic,
  walkToBoardPath,
  walkToDestPath,
  walkToBoardInfo,
  walkToDestInfo,
  selectedDirection
}) {
  return (
    <div style={{ flex: 1, height: '100vh', position: 'relative', cursor: mapPickMode ? 'crosshair' : 'grab' }}>
      {/* Real-Time Traffic Toggle Button */}
      <button
        onClick={() => setShowTraffic(prev => !prev)}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 1000,
          background: showTraffic ? '#2563eb' : '#ffffff',
          color: showTraffic ? '#ffffff' : '#0f172a',
          border: showTraffic ? '1px solid #2563eb' : '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '0.78rem',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease'
        }}
      >
        <TrafficIcon size={15} active={showTraffic} />
        {showTraffic ? 'Traffic Layer On' : 'Traffic Layer Off'}
      </button>

      <MapContainer center={[origin.lat, origin.lng]} zoom={14} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
          url={showTraffic ? "https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}" : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />

        <MapController
          origin={origin}
          destination={destination}
          activeOption={activeOption}
          selectedRouteDetails={selectedRouteDetails}
          activeTab={activeTab}
          selectedStop={selectedStop}
        />
        <MapClickHandler mapPickMode={mapPickMode} onMapClick={onMapClick} />

        {/* TRIP PLANNER MAP LAYERS */}
        {activeTab === 'planner' && (
          <>
            {origin && (
              <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
                <Popup>
                  <div style={{ padding: '2px 0' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{origin.label}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{origin.address}</div>
                  </div>
                </Popup>
              </Marker>
            )}

            {destination && (
              <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
                <Popup>
                  <div style={{ padding: '2px 0' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{destination.label}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{destination.address}</div>
                  </div>
                </Popup>
              </Marker>
            )}

            {activeOption && (() => {
              const pathCoords = activeOption.allPathPoints?.length > 0
                ? activeOption.allPathPoints.map(p => {
                    if (Array.isArray(p)) {
                      return p[0] > 100 ? [p[1], p[0]] : [p[0], p[1]];
                    }
                    return [parseFloat(p.lat || p.latitude), parseFloat(p.lng || p.longitude)];
                  }).filter(p => !isNaN(p[0]) && !isNaN(p[1]))
                : activeOption.allRouteStops ? activeOption.allRouteStops.map(s => [s.lat, s.lng]) : [];

              return pathCoords.length > 0 ? (
                <Polyline
                  positions={pathCoords}
                  pathOptions={{ color: activeOption.primaryColor || '#2563eb', weight: 5, opacity: 0.85 }}
                />
              ) : null;
            })()}

            {activeOption?.allRouteStops?.map((stop, idx) => {
              const isBoarding = stop.id === activeOption.boardStopId;
              const isAlighting = stop.id === activeOption.alightStopId;

              if (isBoarding) {
                return (
                  <Marker key={`board-${stop.id}-${idx}`} position={[stop.lat, stop.lng]} icon={boardStopIcon}>
                    <Popup>
                      <div style={{ padding: '2px 0' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Boarding Stop</span>
                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', marginTop: '2px' }}>{stop.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Bus Route {activeOption.primaryRouteNumber}</div>
                        {walkToBoardInfo && (
                          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#166534', background: '#f0fdf4', padding: '4px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                            🚶 Walk <strong>{walkToBoardInfo.distanceMeters > 1000 ? `${walkToBoardInfo.distanceKm} km` : `${walkToBoardInfo.distanceMeters} m`}</strong> (~{walkToBoardInfo.durationMins} mins) from origin
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              }

              if (isAlighting) {
                return (
                  <Marker key={`alight-${stop.id}-${idx}`} position={[stop.lat, stop.lng]} icon={alightStopIcon}>
                    <Popup>
                      <div style={{ padding: '2px 0' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alighting Stop</span>
                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', marginTop: '2px' }}>{stop.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Bus Route {activeOption.primaryRouteNumber}</div>
                        {walkToDestInfo && (
                          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#ea580c', background: '#fff7ed', padding: '4px 6px', borderRadius: '4px', border: '1px solid #ffedd5' }}>
                            🚶 Walk <strong>{walkToDestInfo.distanceMeters > 1000 ? `${walkToDestInfo.distanceKm} km` : `${walkToDestInfo.distanceMeters} m`}</strong> (~{walkToDestInfo.durationMins} mins) to {destination.label}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              }

              return (
                <Marker
                  key={`stop-marker-${stop.id}-${idx}`}
                  position={[stop.lat, stop.lng]}
                  icon={createCircleStopIcon(activeOption.primaryColor || '#2563eb')}
                >
                  <Popup>
                    <div style={{ padding: '2px 0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#64748b' }}>Stop #{idx + 1}</span>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a', marginTop: '2px' }}>{stop.name}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {activeOption && (
              <>
                {walkToBoardPath.length > 0 && (
                  <Polyline
                    positions={walkToBoardPath}
                    pathOptions={{ color: '#2563eb', weight: 4, dashArray: '6, 8', opacity: 0.8 }}
                  />
                )}

                {walkToDestPath.length > 0 && (
                  <Polyline
                    positions={walkToDestPath}
                    pathOptions={{ color: '#ef4444', weight: 4, dashArray: '6, 8', opacity: 0.8 }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ALL BUS ROUTES MAP LAYERS */}
        {activeTab === 'routes' && selectedRouteDetails && (
          <>
            {selectedRouteDetails.pathPoints?.length > 0 && (
              <Polyline
                positions={selectedRouteDetails.pathPoints.map(p => Array.isArray(p) ? p : [p.lat, p.lng])}
                pathOptions={{ color: selectedRouteDetails.color || '#2563eb', weight: 6, opacity: 0.9 }}
              />
            )}

            {selectedRouteDetails.stops?.map((stop, idx) => {
              const isSelectedStop = selectedStop && (
                selectedStop.id === stop.id || (selectedStop.lat === stop.lat && selectedStop.lng === stop.lng)
              );

              return (
                <Marker
                  key={`explorer-stop-${stop.id || idx}`}
                  position={[stop.lat, stop.lng]}
                  icon={isSelectedStop ? createHighlightedStopIcon('#ef4444') : createCircleStopIcon(selectedRouteDetails.color || '#2563eb')}
                  eventHandlers={{
                    click: () => setSelectedStop(stop)
                  }}
                >
                  <Popup autoPan={false}>
                    <div style={{ padding: '2px 0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Stop #{idx + 1}
                      </span>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', marginTop: '2px' }}>
                        {stop.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        Route {selectedRouteDetails.code || selectedRouteDetails.id} ({selectedDirection})
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </>
        )}

      </MapContainer>
    </div>
  );
}