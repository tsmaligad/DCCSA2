import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents
} from 'react-leaflet';
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

function normalizeMapPoint(point) {
  if (!point) return null;

  if (Array.isArray(point)) {
    if (point.length < 2) return null;

    const a = parseFloat(point[0]);
    const b = parseFloat(point[1]);

    if (Number.isNaN(a) || Number.isNaN(b)) return null;

    return a > 100 ? [b, a] : [a, b];
  }

  const lat = parseFloat(
    point.lat ?? point.latitude
  );

  const lng = parseFloat(
    point.lng ?? point.longitude
  );

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return null;
  }

  return [lat, lng];
}

function findNearestPathIndex(
  pathCoords,
  stop
) {
  const stopCoord =
    normalizeMapPoint(stop);

  if (
    !stopCoord ||
    pathCoords.length === 0
  ) {
    return -1;
  }

  let nearestIndex = -1;
  let nearestDistance = Infinity;

  pathCoords.forEach(
    (point, index) => {
      const latDiff =
        point[0] - stopCoord[0];

      const lngDiff =
        point[1] - stopCoord[1];

      const distance =
        (latDiff * latDiff) +
        (lngDiff * lngDiff);

      if (
        distance <
        nearestDistance
      ) {
        nearestDistance =
          distance;

        nearestIndex =
          index;
      }
    }
  );

  return nearestIndex;
}

function getTransitLegPath(leg) {
  const fullPath =
    (leg?.pathPoints || [])
      .map(normalizeMapPoint)
      .filter(Boolean);

  const legStops =
    leg?.stops || [];

  if (fullPath.length < 2) {
    return legStops
      .map(normalizeMapPoint)
      .filter(Boolean);
  }

  if (legStops.length < 2) {
    return fullPath;
  }

  const boardStop =
    legStops[0];

  const alightStop =
    legStops[
      legStops.length - 1
    ];

  const boardIndex =
    findNearestPathIndex(
      fullPath,
      boardStop
    );

  const alightIndex =
    findNearestPathIndex(
      fullPath,
      alightStop
    );

  if (
    boardIndex === -1 ||
    alightIndex === -1
  ) {
    return fullPath;
  }

  let slicedPath;

  if (
    boardIndex <= alightIndex
  ) {
    slicedPath =
      fullPath.slice(
        boardIndex,
        alightIndex + 1
      );
  } else {
    slicedPath =
      fullPath
        .slice(
          alightIndex,
          boardIndex + 1
        )
        .reverse();
  }

  const exactBoardPoint =
    normalizeMapPoint(
      boardStop
    );

  const exactAlightPoint =
    normalizeMapPoint(
      alightStop
    );

  if (exactBoardPoint) {
    slicedPath = [
      exactBoardPoint,
      ...slicedPath
    ];
  }

  if (exactAlightPoint) {
    slicedPath = [
      ...slicedPath,
      exactAlightPoint
    ];
  }

  return slicedPath;
}

function sameStop(a, b) {
  if (!a || !b) {
    return false;
  }

  if (
    a.id &&
    b.id &&
    a.id === b.id
  ) {
    return true;
  }

  const aPoint =
    normalizeMapPoint(a);

  const bPoint =
    normalizeMapPoint(b);

  if (!aPoint || !bPoint) {
    return false;
  }

  const latDiff =
    aPoint[0] - bPoint[0];

  const lngDiff =
    aPoint[1] - bPoint[1];

  return (
    Math.sqrt(
      (latDiff * latDiff) +
      (lngDiff * lngDiff)
    ) < 0.00015
  );
}

function getPlannerTransitSegments(
  activeOption
) {
  const transitLegs =
    (activeOption?.legs || [])
      .filter(
        leg =>
          leg.type ===
          'TRANSIT'
      );

  if (
    transitLegs.length > 0
  ) {
    const segments = [];

    transitLegs.forEach(
      (leg, index) => {
        let pathCoords =
          getTransitLegPath(
            leg
          );

        if (
          index > 0 &&
          segments.length > 0
        ) {
          const previousLeg =
            transitLegs[
              index - 1
            ];

          const previousStops =
            previousLeg?.stops ||
            [];

          const currentStops =
            leg?.stops || [];

          const previousAlightStop =
            previousStops[
              previousStops.length -
                1
            ];

          const currentBoardStop =
            currentStops[0];

          if (
            sameStop(
              previousAlightStop,
              currentBoardStop
            ) &&
            segments[index - 1]
              ?.pathCoords
              ?.length > 0 &&
            pathCoords.length > 0
          ) {
            const exactTransferPoint =
              normalizeMapPoint(
                currentBoardStop
              ) ||
              segments[index - 1]
                .pathCoords[
                  segments[
                    index - 1
                  ].pathCoords
                    .length - 1
                ];

            const previousSegment =
              segments[index - 1];

            previousSegment
              .pathCoords[
                previousSegment
                  .pathCoords
                  .length - 1
              ] =
              exactTransferPoint;

            pathCoords[0] =
              exactTransferPoint;
          }
        }

        if (
          pathCoords.length > 1
        ) {
          segments.push({
            key:
              `${
                leg.routeNumber ||
                'route'
              }-${index}`,

            color:
              leg.color ||
              activeOption
                ?.primaryColor ||
              '#2563eb',

            pathCoords
          });
        }
      }
    );

    return segments;
  }

  const fallbackPath =
    activeOption
      ?.allPathPoints
      ?.length > 0
      ? activeOption
          .allPathPoints
          .map(
            normalizeMapPoint
          )
          .filter(Boolean)
      : activeOption
          ?.allRouteStops
        ? activeOption
            .allRouteStops
            .map(
              normalizeMapPoint
            )
            .filter(Boolean)
        : [];

  return fallbackPath.length > 1
    ? [
        {
          key:
            'primary-route',

          color:
            activeOption
              ?.primaryColor ||
            '#2563eb',

          pathCoords:
            fallbackPath
        }
      ]
    : [];
}

function MapController({
  origin,
  destination,
  activeOption,
  selectedRouteDetails,
  activeTab,
  selectedStop
}) {
  const map = useMap();

  useEffect(() => {
    if (
      selectedStop &&
      selectedStop.lat &&
      selectedStop.lng
    ) {
      map.flyTo(
        [
          selectedStop.lat,
          selectedStop.lng
        ],
        16,
        {
          animate: true,
          duration: 1
        }
      );

      return;
    }

    const points = [];

    if (
      activeTab ===
        'routes' &&
      selectedRouteDetails
    ) {
      if (
        selectedRouteDetails
          .pathPoints
          ?.length > 0
      ) {
        selectedRouteDetails
          .pathPoints
          .forEach(p => {
            if (
              Array.isArray(p)
            ) {
              points.push(p);
            } else if (
              p.lat &&
              p.lng
            ) {
              points.push([
                p.lat,
                p.lng
              ]);
            }
          });
      } else if (
        selectedRouteDetails
          .stops
          ?.length > 0
      ) {
        selectedRouteDetails
          .stops
          .forEach(s => {
            if (
              s.lat &&
              s.lng
            ) {
              points.push([
                s.lat,
                s.lng
              ]);
            }
          });
      }
    } else if (
      activeTab ===
      'planner'
    ) {
      if (
        origin?.lat &&
        origin?.lng
      ) {
        points.push([
          origin.lat,
          origin.lng
        ]);
      }

      if (
        destination?.lat &&
        destination?.lng
      ) {
        points.push([
          destination.lat,
          destination.lng
        ]);
      }

      const transitSegments =
        getPlannerTransitSegments(
          activeOption
        );

      if (
        transitSegments.length >
        0
      ) {
        transitSegments.forEach(
          segment => {
            segment
              .pathCoords
              .forEach(
                point =>
                  points.push(
                    point
                  )
              );
          }
        );
      } else if (
        activeOption
          ?.allRouteStops
      ) {
        activeOption
          .allRouteStops
          .forEach(s => {
            if (
              s.lat &&
              s.lng
            ) {
              points.push([
                s.lat,
                s.lng
              ]);
            }
          });
      }
    }

    if (
      points.length > 1
    ) {
      const bounds =
        L.latLngBounds(
          points
        );

      map.fitBounds(
        bounds,
        {
          padding:
            [50, 50],

          maxZoom: 15
        }
      );
    } else if (
      points.length === 1
    ) {
      map.flyTo(
        points[0],
        14
      );
    }
  }, [
    map,
    origin,
    destination,
    activeOption,
    selectedRouteDetails,
    activeTab,
    selectedStop
  ]);

  return null;
}

function MapClickHandler({
  mapPickMode,
  onMapClick
}) {
  useMapEvents({
    click(e) {
      if (
        mapPickMode
      ) {
        onMapClick({
          lat:
            e.latlng.lat,

          lng:
            e.latlng.lng
        });
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
    <div
      style={{
        flex: 1,
        height: '100vh',
        position: 'relative',
        cursor:
          mapPickMode
            ? 'crosshair'
            : 'grab'
      }}
    >
      {/* Real-Time Traffic Toggle Button */}

      <button
        onClick={() =>
          setShowTraffic(
            prev => !prev
          )
        }
        style={{
          position:
            'absolute',
          top: '16px',
          right: '16px',
          zIndex: 1000,
          background:
            showTraffic
              ? '#2563eb'
              : '#ffffff',
          color:
            showTraffic
              ? '#ffffff'
              : '#0f172a',
          border:
            showTraffic
              ? '1px solid #2563eb'
              : '1px solid #cbd5e1',
          borderRadius:
            '8px',
          padding:
            '8px 12px',
          fontSize:
            '0.78rem',
          fontWeight:
            '600',
          cursor:
            'pointer',
          boxShadow:
            '0 2px 10px rgba(15, 23, 42, 0.15)',
          display:
            'flex',
          alignItems:
            'center',
          gap: '6px',
          transition:
            'all 0.15s ease'
        }}
      >
        <TrafficIcon
          size={15}
          active={
            showTraffic
          }
        />

        {showTraffic
          ? 'Traffic Layer On'
          : 'Traffic Layer Off'}
      </button>

      <MapContainer
        center={[
          origin.lat,
          origin.lng
        ]}
        zoom={14}
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
          url={
            showTraffic
              ? 'https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}'
              : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
          }
          subdomains={[
            'mt0',
            'mt1',
            'mt2',
            'mt3'
          ]}
          maxZoom={20}
        />

        <MapController
          origin={origin}
          destination={
            destination
          }
          activeOption={
            activeOption
          }
          selectedRouteDetails={
            selectedRouteDetails
          }
          activeTab={
            activeTab
          }
          selectedStop={
            selectedStop
          }
        />

        <MapClickHandler
          mapPickMode={
            mapPickMode
          }
          onMapClick={
            onMapClick
          }
        />

        {/* TRIP PLANNER MAP LAYERS */}

        {activeTab ===
          'planner' && (
          <>
            {origin && (
              <Marker
                position={[
                  origin.lat,
                  origin.lng
                ]}
                icon={
                  originIcon
                }
              >
                <Popup>
                  <div
                    style={{
                      padding:
                        '2px 0'
                    }}
                  >
                    <strong
                      style={{
                        fontSize:
                          '0.85rem',

                        color:
                          '#0f172a'
                      }}
                    >
                      {
                        origin.label
                      }
                    </strong>

                    <div
                      style={{
                        fontSize:
                          '0.75rem',

                        color:
                          '#64748b',

                        marginTop:
                          '2px'
                      }}
                    >
                      {
                        origin.address
                      }
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {destination && (
              <Marker
                position={[
                  destination.lat,
                  destination.lng
                ]}
                icon={
                  destIcon
                }
              >
                <Popup>
                  <div
                    style={{
                      padding:
                        '2px 0'
                    }}
                  >
                    <strong
                      style={{
                        fontSize:
                          '0.85rem',

                        color:
                          '#0f172a'
                      }}
                    >
                      {
                        destination.label
                      }
                    </strong>

                    <div
                      style={{
                        fontSize:
                          '0.75rem',

                        color:
                          '#64748b',

                        marginTop:
                          '2px'
                      }}
                    >
                      {
                        destination.address
                      }
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {activeOption &&
              getPlannerTransitSegments(
                activeOption
              ).map(
                segment => (
                  <Polyline
                    key={
                      segment.key
                    }
                    positions={
                      segment.pathCoords
                    }
                    pathOptions={{
                      color:
                        segment.color,
                      weight: 5,
                      opacity:
                        0.85
                    }}
                  />
                )
              )}

            {activeOption
              ?.allRouteStops
              ?.map(
                (
                  stop,
                  idx
                ) => {
                  const isBoarding =
                    stop.id ===
                    activeOption
                      .boardStopId;

                  const isAlighting =
                    stop.id ===
                    activeOption
                      .alightStopId;

                  if (
                    isBoarding
                  ) {
                    return (
                      <Marker
                        key={`board-${stop.id}-${idx}`}
                        position={[
                          stop.lat,
                          stop.lng
                        ]}
                        icon={
                          boardStopIcon
                        }
                      >
                        <Popup>
                          <div
                            style={{
                              padding:
                                '2px 0'
                            }}
                          >
                            <span
                              style={{
                                fontSize:
                                  '0.7rem',

                                fontWeight:
                                  '700',

                                color:
                                  '#166534',

                                textTransform:
                                  'uppercase',

                                letterSpacing:
                                  '0.04em'
                              }}
                            >
                              Boarding Stop
                            </span>

                            <div
                              style={{
                                fontWeight:
                                  '700',

                                fontSize:
                                  '0.88rem',

                                color:
                                  '#0f172a',

                                marginTop:
                                  '2px'
                              }}
                            >
                              {
                                stop.name
                              }
                            </div>

                            <div
                              style={{
                                fontSize:
                                  '0.75rem',

                                color:
                                  '#64748b',

                                marginTop:
                                  '2px'
                              }}
                            >
                              Bus Route{' '}
                              {
                                activeOption
                                  .primaryRouteNumber
                              }
                            </div>

                            {walkToBoardInfo && (
                              <div
                                style={{
                                  marginTop:
                                    '6px',

                                  fontSize:
                                    '0.75rem',

                                  color:
                                    '#166534',

                                  background:
                                    '#f0fdf4',

                                  padding:
                                    '4px 6px',

                                  borderRadius:
                                    '4px',

                                  border:
                                    '1px solid #bbf7d0'
                                }}
                              >
                                🚶 Walk{' '}
                                <strong>
                                  {walkToBoardInfo.distanceMeters >
                                  1000
                                    ? `${walkToBoardInfo.distanceKm} km`
                                    : `${walkToBoardInfo.distanceMeters} m`}
                                </strong>{' '}
                                (~
                                {
                                  walkToBoardInfo.durationMins
                                }{' '}
                                mins) from origin
                              </div>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }

                  if (
                    isAlighting
                  ) {
                    return (
                      <Marker
                        key={`alight-${stop.id}-${idx}`}
                        position={[
                          stop.lat,
                          stop.lng
                        ]}
                        icon={
                          alightStopIcon
                        }
                      >
                        <Popup>
                          <div
                            style={{
                              padding:
                                '2px 0'
                            }}
                          >
                            <span
                              style={{
                                fontSize:
                                  '0.7rem',

                                fontWeight:
                                  '700',

                                color:
                                  '#c2410c',

                                textTransform:
                                  'uppercase',

                                letterSpacing:
                                  '0.04em'
                              }}
                            >
                              Alighting Stop
                            </span>

                            <div
                              style={{
                                fontWeight:
                                  '700',

                                fontSize:
                                  '0.88rem',

                                color:
                                  '#0f172a',

                                marginTop:
                                  '2px'
                              }}
                            >
                              {
                                stop.name
                              }
                            </div>

                            <div
                              style={{
                                fontSize:
                                  '0.75rem',

                                color:
                                  '#64748b',

                                marginTop:
                                  '2px'
                              }}
                            >
                              Bus Route{' '}
                              {
                                activeOption
                                  .primaryRouteNumber
                              }
                            </div>

                            {walkToDestInfo && (
                              <div
                                style={{
                                  marginTop:
                                    '6px',

                                  fontSize:
                                    '0.75rem',

                                  color:
                                    '#ea580c',

                                  background:
                                    '#fff7ed',

                                  padding:
                                    '4px 6px',

                                  borderRadius:
                                    '4px',

                                  border:
                                    '1px solid #ffedd5'
                                }}
                              >
                                🚶 Walk{' '}
                                <strong>
                                  {walkToDestInfo.distanceMeters >
                                  1000
                                    ? `${walkToDestInfo.distanceKm} km`
                                    : `${walkToDestInfo.distanceMeters} m`}
                                </strong>{' '}
                                (~
                                {
                                  walkToDestInfo.durationMins
                                }{' '}
                                mins) to{' '}
                                {
                                  destination.label
                                }
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
                      position={[
                        stop.lat,
                        stop.lng
                      ]}
                      icon={createCircleStopIcon(
                        activeOption
                          .primaryColor ||
                          '#2563eb'
                      )}
                    >
                      <Popup>
                        <div
                          style={{
                            padding:
                              '2px 0'
                          }}
                        >
                          <span
                            style={{
                              fontSize:
                                '0.7rem',

                              fontWeight:
                                '600',

                              color:
                                '#64748b'
                            }}
                          >
                            Stop #
                            {idx + 1}
                          </span>

                          <div
                            style={{
                              fontWeight:
                                '600',

                              fontSize:
                                '0.85rem',

                              color:
                                '#0f172a',

                              marginTop:
                                '2px'
                            }}
                          >
                            {
                              stop.name
                            }
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
              )}

            {activeOption && (
              <>
                {walkToBoardPath.length >
                  0 && (
                  <Polyline
                    positions={
                      walkToBoardPath
                    }
                    pathOptions={{
                      color:
                        '#2563eb',
                      weight: 4,
                      dashArray:
                        '6, 8',
                      opacity:
                        0.8
                    }}
                  />
                )}

                {walkToDestPath.length >
                  0 && (
                  <Polyline
                    positions={
                      walkToDestPath
                    }
                    pathOptions={{
                      color:
                        '#ef4444',
                      weight: 4,
                      dashArray:
                        '6, 8',
                      opacity:
                        0.8
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ALL BUS ROUTES MAP LAYERS */}

        {activeTab ===
          'routes' &&
          selectedRouteDetails && (
          <>
            {selectedRouteDetails
              .pathPoints
              ?.length > 0 && (
              <Polyline
                positions={
                  selectedRouteDetails
                    .pathPoints
                    .map(
                      p =>
                        Array.isArray(
                          p
                        )
                          ? p
                          : [
                              p.lat,
                              p.lng
                            ]
                    )
                }
                pathOptions={{
                  color:
                    selectedRouteDetails.color ||
                    '#2563eb',
                  weight: 6,
                  opacity:
                    0.9
                }}
              />
            )}

            {selectedRouteDetails
              .stops
              ?.map(
                (
                  stop,
                  idx
                ) => {
                  const isSelectedStop =
                    selectedStop &&
                    (
                      selectedStop.id ===
                        stop.id ||
                      (
                        selectedStop.lat ===
                          stop.lat &&
                        selectedStop.lng ===
                          stop.lng
                      )
                    );

                  return (
                    <Marker
                      key={`explorer-stop-${stop.id || idx}`}
                      position={[
                        stop.lat,
                        stop.lng
                      ]}
                      icon={
                        isSelectedStop
                          ? createHighlightedStopIcon(
                              '#ef4444'
                            )
                          : createCircleStopIcon(
                              selectedRouteDetails.color ||
                                '#2563eb'
                            )
                      }
                      eventHandlers={{
                        click: () =>
                          setSelectedStop(
                            stop
                          )
                      }}
                    >
                      <Popup
                        autoPan={
                          false
                        }
                      >
                        <div
                          style={{
                            padding:
                              '2px 0'
                          }}
                        >
                          <span
                            style={{
                              fontSize:
                                '0.7rem',

                              fontWeight:
                                '700',

                              color:
                                '#2563eb',

                              textTransform:
                                'uppercase',

                              letterSpacing:
                                '0.04em'
                            }}
                          >
                            Stop #
                            {idx + 1}
                          </span>

                          <div
                            style={{
                              fontWeight:
                                '700',

                              fontSize:
                                '0.88rem',

                              color:
                                '#0f172a',

                              marginTop:
                                '2px'
                            }}
                          >
                            {
                              stop.name
                            }
                          </div>

                          <div
                            style={{
                              fontSize:
                                '0.75rem',

                              color:
                                '#64748b',

                              marginTop:
                                '2px'
                            }}
                          >
                            Route{' '}
                            {selectedRouteDetails.code ||
                              selectedRouteDetails.id}{' '}
                            (
                            {
                              selectedDirection
                            }
                            )
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
              )}
          </>
        )}
      </MapContainer>
    </div>
  );
}