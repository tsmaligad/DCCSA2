import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  BusIcon,
  NavigationIcon,
  ClockIcon,
  MapPinIcon
} from './components/icons/Icons';
import LocationInput from './components/planner/LocationInput';
import MapView from './components/map/mapView';
import {
  reverseGeocode,
  searchPlaces,
  fetchFootRoute,
  fetchAllRoutes,
  fetchRouteDetails,
  planTripApi
} from './services/api';
import { formatTo12Hour } from './utils/timeUtils';
import {
  getDistanceInKm,
  calculateWalkMins,
  sliceRouteGeometry,
  parseBackendRouteData
} from './utils/routeUtils';
import {
  findNearestStopAndRoutes,
  buildDoubleRideOption
} from './utils/transitPlanner';

export default function App() {
  const [activeTab, setActiveTab] = useState('planner');
  const [showTraffic, setShowTraffic] = useState(false);
  const [origin, setOrigin] = useState({
    lat: 7.0185,
    lng: 125.4971,
    label: 'Toril District Hall',
    address: 'Toril, Davao City, Davao del Sur'
  });
  const [destination, setDestination] = useState({
    lat: 7.0673,
    lng: 125.6120,
    label: 'Roxas Avenue',
    address: 'Poblacion District, Davao City, Davao del Sur'
  });

  const [activeInput, setActiveInput] = useState(null);
  const [mapPickMode, setMapPickMode] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  const [journeyOptions, setJourneyOptions] = useState([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [nearestStopData, setNearestStopData] = useState(null);
  const [routesList, setRoutesList] = useState([]);
  const [routesFilter, setRoutesFilter] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedDirection, setSelectedDirection] = useState('AM');
  const [selectedRouteDetails, setSelectedRouteDetails] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routesFetchError, setRoutesFetchError] = useState(false);
  const [walkToBoardPath, setWalkToBoardPath] = useState([]);
  const [walkToDestPath, setWalkToDestPath] = useState([]);
  const [walkToBoardInfo, setWalkToBoardInfo] = useState(null);
  const [walkToDestInfo, setWalkToDestInfo] = useState(null);

  const activeOption = selectedOptionIdx !== null ? journeyOptions[selectedOptionIdx] : null;

  useEffect(() => {
    const loadRoutes = async () => {
      try {
        setRoutesFetchError(false);
        const data = await fetchAllRoutes();
        if (data && Array.isArray(data)) {
          setRoutesList(data);
        }
      } catch (err) {
        console.error('Failed to fetch routes:', err);
        setRoutesFetchError(true);
      }
    };
    loadRoutes();
  }, []);

  useEffect(() => {
    if (!activeOption || activeTab !== 'planner') {
      setWalkToBoardPath([]);
      setWalkToDestPath([]);
      setWalkToBoardInfo(null);
      setWalkToDestInfo(null);
      return;
    }

    const fetchStreetWalkPaths = async () => {
      const boardStop = activeOption.allRouteStops?.find(s => s.id === activeOption.boardStopId);
      const alightStop = activeOption.allRouteStops?.find(s => s.id === activeOption.alightStopId);
      if (boardStop && origin?.lat && origin?.lng) {
        try {
          const routeDataRes = await fetchFootRoute(origin.lng, origin.lat, boardStop.lng, boardStop.lat);
          if (routeDataRes?.routes?.[0]) {
            const routeData = routeDataRes.routes[0];
            const coords = routeData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const distMeters = Math.round(routeData.distance);

            setWalkToBoardPath(coords);
            setWalkToBoardInfo({
              distanceMeters: distMeters,
              distanceKm: (distMeters / 1000).toFixed(2),
              durationMins: calculateWalkMins(distMeters)
            });
          } else {
            const distKm = getDistanceInKm(origin.lat, origin.lng, boardStop.lat, boardStop.lng);
            const distMeters = Math.round(distKm * 1000);
            setWalkToBoardPath([[origin.lat, origin.lng], [boardStop.lat, boardStop.lng]]);
            setWalkToBoardInfo({
              distanceMeters: distMeters,
              distanceKm: distKm.toFixed(2),
              durationMins: calculateWalkMins(distMeters)
            });
          }
        } catch {
          const distKm = getDistanceInKm(origin.lat, origin.lng, boardStop.lat, boardStop.lng);
          const distMeters = Math.round(distKm * 1000);
          setWalkToBoardPath([[origin.lat, origin.lng], [boardStop.lat, boardStop.lng]]);
          setWalkToBoardInfo({
            distanceMeters: distMeters,
            distanceKm: distKm.toFixed(2),
            durationMins: calculateWalkMins(distMeters)
          });
        }
      } else {
        setWalkToBoardPath([]);
        setWalkToBoardInfo(null);
      }
      if (alightStop && destination?.lat && destination?.lng) {
        try {
          const routeDataRes = await fetchFootRoute(alightStop.lng, alightStop.lat, destination.lng, destination.lat);
          if (routeDataRes?.routes?.[0]) {
            const routeData = routeDataRes.routes[0];
            const coords = routeData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const distMeters = Math.round(routeData.distance);

            setWalkToDestPath(coords);
            setWalkToDestInfo({
              distanceMeters: distMeters,
              distanceKm: (distMeters / 1000).toFixed(2),
              durationMins: calculateWalkMins(distMeters)
            });
          } else {
            const distKm = getDistanceInKm(alightStop.lat, alightStop.lng, destination.lat, destination.lng);
            const distMeters = Math.round(distKm * 1000);
            setWalkToDestPath([[alightStop.lat, alightStop.lng], [destination.lat, destination.lng]]);
            setWalkToDestInfo({
              distanceMeters: distMeters,
              distanceKm: distKm.toFixed(2),
              durationMins: calculateWalkMins(distMeters)
            });
          }
        } catch {
          const distKm = getDistanceInKm(alightStop.lat, alightStop.lng, destination.lat, destination.lng);
          const distMeters = Math.round(distKm * 1000);
          setWalkToDestPath([[alightStop.lat, alightStop.lng], [destination.lat, destination.lng]]);
          setWalkToDestInfo({
            distanceMeters: distMeters,
            distanceKm: distKm.toFixed(2),
            durationMins: calculateWalkMins(distMeters)
          });
        }
      } else {
        setWalkToDestPath([]);
        setWalkToDestInfo(null);
      }
    };

    fetchStreetWalkPaths();
  }, [activeOption, origin, destination, activeTab]);

  const handleSearchInputChange = (text) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text || text.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(text);
        setSearchResults(places);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 350);
  };

  const handleSelectEstablishment = (place, target) => {
    const rawParts = place.display_name ? place.display_name.split(',') : [];
    const title = place.name || rawParts[0]?.trim() || 'Selected Place';
    const fullAddress = rawParts.length > 1 ? rawParts.slice(1).join(',').trim() : place.display_name;

    const coords = {
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      label: title,
      address: fullAddress
    };

    if (target === 'start') setOrigin(coords);
    else setDestination(coords);

    setSearchQuery('');
    setSearchResults([]);
    setActiveInput(null);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const geoInfo = await reverseGeocode(lat, lng);

          const coords = {
            lat,
            lng,
            label: geoInfo.label,
            address: geoInfo.address
          };

          if (activeInput === 'dest') setDestination(coords);
          else setOrigin(coords);
          setActiveInput(null);
        },
        () => alert('Unable to retrieve current location.')
      );
    }
  };

  const handleMapClick = async (coords) => {
    const targetMode = mapPickMode;
    setMapPickMode(null);

    const geoInfo = await reverseGeocode(coords.lat, coords.lng);
    const pinnedLoc = {
      lat: coords.lat,
      lng: coords.lng,
      label: geoInfo.label,
      address: geoInfo.address
    };

    if (targetMode === 'start') setOrigin(pinnedLoc);
    else if (targetMode === 'dest') setDestination(pinnedLoc);
  };

  const handleSelectNearestRoute = async (route) => {
    if (!nearestStopData?.nearestStop) return;

    const rId = route.id || route.code;
    let fullRouteData = route;

    try {
      const data = await fetchRouteDetails(rId);
      if (data) fullRouteData = data;
    } catch (err) {
      console.warn('Could not fetch full details for nearest route, using local route object', err);
    }

    const parsedRoute = parseBackendRouteData(fullRouteData, route);
    const boardStop = nearestStopData.nearestStop;

    let alightStop = null;
    if (parsedRoute.stops && parsedRoute.stops.length > 0) {
      let minDestDist = Infinity;
      parsedRoute.stops.forEach(s => {
        const d = getDistanceInKm(s.lat, s.lng, destination.lat, destination.lng);
        if (d < minDestDist) {
          minDestDist = d;
          alightStop = s;
        }
      });
    }

    const { slicedStops, slicedPathPoints } = sliceRouteGeometry(
      parsedRoute.stops,
      parsedRoute.pathPoints,
      boardStop.id,
      alightStop?.id,
      boardStop,
      alightStop || destination
    );

    const formattedOption = {
      primaryColor: parsedRoute.color || '#2563eb',
      primaryRouteNumber: parsedRoute.code || parsedRoute.id,
      primaryRouteName: parsedRoute.name || `Route ${parsedRoute.code || parsedRoute.id}`,
      totalDuration: parsedRoute.totalDuration || 35,
      nextDepartureStr: parsedRoute.nextDepartureStr || '10-15 mins',
      isActiveNow: parsedRoute.isActiveNow !== undefined ? parsedRoute.isActiveNow : true,
      allRouteStops: slicedStops,
      allPathPoints: slicedPathPoints,
      boardStopId: boardStop.id,
      alightStopId: alightStop ? alightStop.id : (slicedStops.length > 0 ? slicedStops[slicedStops.length - 1].id : null),
      isFastest: true
    };

    setJourneyOptions([formattedOption]);
    setSelectedOptionIdx(0);
  };

  const handleSearchRoutes = async () => {
    setLoading(true);
    setHasSearched(true);
    setNearestStopData(null);

    try {
      const resData = await planTripApi(origin, destination, '00:00');
      let options = resData.options || [];

      const doubleRide = buildDoubleRideOption(origin, destination, routesList);
      if (doubleRide) {
        options = [doubleRide, ...options];
      }

      options = options.map(opt => {
        const boardStop = opt.allRouteStops?.find(s => s.id === opt.boardStopId);
        const alightStop = opt.allRouteStops?.find(s => s.id === opt.alightStopId);
        if (opt.allRouteStops?.length > 0) {
          const { slicedStops, slicedPathPoints } = sliceRouteGeometry(
            opt.allRouteStops,
            opt.allPathPoints,
            opt.boardStopId,
            opt.alightStopId,
            boardStop || origin,
            alightStop || destination
          );
          return {
            ...opt,
            allRouteStops: slicedStops,
            allPathPoints: slicedPathPoints
          };
        }
        return opt;
      });

      options.sort((a, b) => (a.totalDuration || 999) - (b.totalDuration || 999));

      if (options.length > 0) {
        const minDuration = Math.min(...options.map(o => o.totalDuration || 999));
        options = options.map(opt => ({
          ...opt,
          isFastest: (opt.totalDuration || 999) === minDuration
        }));
      }

      setJourneyOptions(options);
      setSelectedOptionIdx(options.length > 0 ? 0 : null);

      if (options.length === 0) {
        const nearest = findNearestStopAndRoutes(origin, routesList);
        setNearestStopData(nearest);
      }
    } catch (err) {
      console.error(err);
      let options = [];
      const doubleRide = buildDoubleRideOption(origin, destination, routesList);
      if (doubleRide) {
        options = [doubleRide];
      }

      options.sort((a, b) => (a.totalDuration || 999) - (b.totalDuration || 999));
      if (options.length > 0) {
        const minDuration = Math.min(...options.map(o => o.totalDuration || 999));
        options = options.map(opt => ({
          ...opt,
          isFastest: (opt.totalDuration || 999) === minDuration
        }));
        setJourneyOptions(options);
        setSelectedOptionIdx(0);
      } else {
        const nearest = findNearestStopAndRoutes(origin, routesList);
        setNearestStopData(nearest);
        setJourneyOptions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDirectoryRoute = async (route, direction = 'AM') => {
    const rId = route.id || route.code;
    setSelectedRouteId(rId);
    setSelectedDirection(direction);
    setSelectedStop(null);
    setRouteLoading(true);

    try {
      const data = await fetchRouteDetails(rId, direction);
      if (data) {
        setSelectedRouteDetails(parseBackendRouteData(data, route, direction));
      }
    } catch (err) {
      console.error(`Failed to fetch route details for ${rId}:`, err);
      setSelectedRouteDetails(parseBackendRouteData(route, route, direction));
    } finally {
      setRouteLoading(false);
    }
  };

  const filteredRoutes = routesList.filter(r =>
    (r.id && r.id.toLowerCase().includes(routesFilter.toLowerCase())) ||
    (r.code && r.code.toLowerCase().includes(routesFilter.toLowerCase())) ||
    (r.name && r.name.toLowerCase().includes(routesFilter.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <div style={{
        width: '390px',
        flexShrink: 0,
        background: '#ffffff',
        color: '#0f172a',
        padding: '20px 18px',
        overflowY: 'auto',
        borderRight: '1px solid #e2e8f0',
        boxShadow: '4px 0 20px rgba(15, 23, 42, 0.05)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', background: '#2563eb', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <BusIcon size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              CSA Transit Network
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Trip planning & route directory</p>
          </div>
        </div>

        
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px', width: '100%' }}>
          <button
            onClick={() => { setActiveTab('planner'); setSelectedRouteDetails(null); setSelectedStop(null); }}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: '7px',
              fontWeight: '600',
              fontSize: '0.82rem',
              cursor: 'pointer',
              background: activeTab === 'planner' ? '#ffffff' : 'transparent',
              color: activeTab === 'planner' ? '#2563eb' : '#64748b',
              boxShadow: activeTab === 'planner' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <NavigationIcon size={14} color={activeTab === 'planner' ? '#2563eb' : '#64748b'} />
            Trip Planner
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: '7px',
              fontWeight: '600',
              fontSize: '0.82rem',
              cursor: 'pointer',
              background: activeTab === 'routes' ? '#ffffff' : 'transparent',
              color: activeTab === 'routes' ? '#2563eb' : '#64748b',
              boxShadow: activeTab === 'routes' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <BusIcon size={14} color={activeTab === 'routes' ? '#2563eb' : '#64748b'} />
            Bus Routes
          </button>
        </div>

        
        {activeTab === 'planner' && (
          <>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', position: 'relative', width: '100%' }}>
              <div style={{ position: 'absolute', left: '28px', top: '32px', bottom: '32px', width: '2px', background: '#cbd5e1', zIndex: 1 }} />

              
              <LocationInput
                type="start"
                location={origin}
                activeInput={activeInput}
                setActiveInput={setActiveInput}
                searchQuery={searchQuery}
                handleSearchInputChange={handleSearchInputChange}
                searchResults={searchResults}
                handleSelectEstablishment={handleSelectEstablishment}
                handleUseCurrentLocation={handleUseCurrentLocation}
                setMapPickMode={setMapPickMode}
              />

              
              <LocationInput
                type="dest"
                location={destination}
                activeInput={activeInput}
                setActiveInput={setActiveInput}
                searchQuery={searchQuery}
                handleSearchInputChange={handleSearchInputChange}
                searchResults={searchResults}
                handleSelectEstablishment={handleSelectEstablishment}
                handleUseCurrentLocation={handleUseCurrentLocation}
                setMapPickMode={setMapPickMode}
              />
            </div>

            <button
              onClick={handleSearchRoutes}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '0.88rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                transition: 'background 0.15s ease'
              }}
            >
              {loading ? 'Searching Available Routes...' : 'Search Routes'}
            </button>

            
            {!loading && hasSearched && journeyOptions.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <div style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
                  <div style={{ fontWeight: '700', color: '#991b1b', fontSize: '0.88rem' }}>
                    No available bus routes found
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#7f1d1d', marginTop: '4px' }}>
                    There are no direct bus connections matching your exact origin and destination.
                  </p>
                </div>

                {nearestStopData?.nearestStop && (
                  <div style={{ padding: '14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Nearest Bus Stop
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#0c4a6e', marginTop: '2px' }}>
                      {nearestStopData.nearestStop.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '2px' }}>
                      ~{nearestStopData.distanceKm} km from your origin
                    </div>

                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e0f2fe' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#0369a1' }}>
                        Options if riding from this stop:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        {nearestStopData.servingRoutes.length > 0 ? (
                          nearestStopData.servingRoutes.map((r, i) => (
                            <div
                              key={i}
                              onClick={() => handleSelectNearestRoute(r)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#ffffff',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #bae6fd',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e0f2fe';
                                e.currentTarget.style.borderColor = '#0284c7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = '#bae6fd';
                              }}
                            >
                              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: r.color || '#2563eb' }}>
                                Bus {r.code || r.id}
                              </span>
                              <span style={{ fontSize: '0.74rem', color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                {r.name}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No active routes registered at this stop.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            
            {journeyOptions.length > 0 && (
              <div>
                <h2 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Recommended Options ({journeyOptions.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {journeyOptions.map((opt, idx) => {
                    const isSelected = selectedOptionIdx === idx;
                    const routeColor = opt.primaryColor || '#2563eb';

                    if (opt.isTransfer) {
                      return (
                        <div
                          key={`transfer-${idx}`}
                          onClick={() => setSelectedOptionIdx(idx)}
                          style={{
                            padding: '14px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: isSelected ? '#f3e8ff' : '#ffffff',
                            border: isSelected ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                            boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ background: '#8b5cf6', color: '#ffffff', padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                                Double Ride
                              </span>
                              {opt.isFastest && (
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid #86efac' }}>
                                  ⚡ Fastest Trip
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b21a8' }}>
                              {opt.totalDuration} mins
                            </span>
                          </div>

                          <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#0f172a' }}>
                            <div style={{ fontWeight: '600', color: '#4c1d95' }}>
                              Leg 1: Bus {opt.leg1.routeCode} ({opt.leg1.routeName})
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: '6px', marginTop: '2px' }}>
                              Ride from {opt.leg1.from} ➔ Transfer at <strong>{opt.transferHubName}</strong>
                            </div>

                            <div style={{ fontWeight: '600', color: '#4c1d95', marginTop: '8px' }}>
                              Leg 2: Bus {opt.leg2.routeCode} ({opt.leg2.routeName})
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: '6px', marginTop: '2px' }}>
                              Ride from <strong>{opt.transferHubName}</strong> ➔ Arrive at {opt.leg2.to}
                            </div>
                          </div>

                          
                          {isSelected && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #d8b4fe', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {walkToBoardInfo && (
                                <div style={{ fontSize: '0.74rem', color: '#4c1d95', display: 'flex', alignItems: 'center', gap: '6px', background: '#f5f3ff', padding: '6px 8px', borderRadius: '6px' }}>
                                  <span>🚶</span>
                                  <span>
                                    Walk <strong>{walkToBoardInfo.distanceMeters > 1000 ? `${walkToBoardInfo.distanceKm} km` : `${walkToBoardInfo.distanceMeters} m`}</strong> ({walkToBoardInfo.durationMins} min) to boarding stop
                                  </span>
                                </div>
                              )}
                              {walkToDestInfo && (
                                <div style={{ fontSize: '0.74rem', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '6px', background: '#fff7ed', padding: '6px 8px', borderRadius: '6px' }}>
                                  <span>🚶</span>
                                  <span>
                                    Walk <strong>{walkToDestInfo.distanceMeters > 1000 ? `${walkToDestInfo.distanceKm} km` : `${walkToDestInfo.distanceMeters} m`}</strong> ({walkToDestInfo.durationMins} min) to {destination.label}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedOptionIdx(idx)}
                        style={{
                          padding: '14px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          background: isSelected ? '#f0f9ff' : '#ffffff',
                          border: isSelected ? `2px solid ${routeColor}` : '1px solid #e2e8f0',
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ background: routeColor, color: '#ffffff', padding: '3px 9px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                              Bus {opt.primaryRouteNumber || opt.code || 'Route'}
                            </span>
                            {opt.isFastest && (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid #86efac' }}>
                                ⚡ Fastest Trip
                              </span>
                            )}
                          </div>

                          {opt.isActiveNow ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #bbf7d0' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                              Active
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                              Scheduled
                            </span>
                          )}
                        </div>

                        <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '8px', fontSize: '0.9rem' }}>
                          {opt.primaryRouteName || opt.name}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: opt.isFastest ? '#166534' : '#64748b', fontWeight: opt.isFastest ? '700' : 'normal' }}>
                            <ClockIcon size={13} color={opt.isFastest ? '#166534' : '#64748b'} />
                            {opt.totalDuration || 35} mins
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <BusIcon size={13} color="#64748b" />
                            {opt.nextDepartureStr || '10-15 mins'}
                          </span>
                          <span>
                            {opt.allRouteStops ? opt.allRouteStops.length : 0} stops
                          </span>
                        </div>

                        
                        {isSelected && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {walkToBoardInfo && (
                              <div style={{ fontSize: '0.74rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '6px 8px', borderRadius: '6px' }}>
                                <span>🚶</span>
                                <span>
                                  Walk <strong>{walkToBoardInfo.distanceMeters > 1000 ? `${walkToBoardInfo.distanceKm} km` : `${walkToBoardInfo.distanceMeters} m`}</strong> ({walkToBoardInfo.durationMins} min) to boarding stop
                                </span>
                              </div>
                            )}
                            {walkToDestInfo && (
                              <div style={{ fontSize: '0.74rem', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '6px', background: '#fff7ed', padding: '6px 8px', borderRadius: '6px' }}>
                                <span>🚶</span>
                                <span>
                                  Walk <strong>{walkToDestInfo.distanceMeters > 1000 ? `${walkToDestInfo.distanceKm} km` : `${walkToDestInfo.distanceMeters} m`}</strong> ({walkToDestInfo.durationMins} min) to {destination.label}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        
        {activeTab === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            
            <input
              type="text"
              placeholder="Filter routes by code or name..."
              value={routesFilter}
              onChange={(e) => setRoutesFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontSize: '0.84rem',
                color: '#0f172a',
                outline: 'none'
              }}
            />

            {routesFetchError && (
              <div style={{ padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.78rem' }}>
                Failed to connect to backend service (`http://localhost:5001/api/routes`).
              </div>
            )}

            {routesList.length === 0 && !routesFetchError && (
              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                Loading available routes...
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredRoutes.map((route, idx) => {
                const rId = route.id || route.code;
                const isSelected = selectedRouteId === rId;
                const activeDirection = isSelected ? selectedDirection : 'AM';
                const isAM = activeDirection === 'AM';
                const routeColor = route.color || '#2563eb';
                const isActive = route.isActiveNow !== undefined ? route.isActiveNow : true;

                const startTimeVal = isSelected && selectedRouteDetails?.startTime
                  ? selectedRouteDetails.startTime
                  : (isAM ? (route.startTimeAM || route.startTime || '06:00') : (route.startTimePM || '16:00'));

                const endTimeVal = isSelected && selectedRouteDetails?.endTime
                  ? selectedRouteDetails.endTime
                  : (isAM ? (route.endTimeAM || route.endTime || '10:00') : (route.endTimePM || '21:00'));

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectDirectoryRoute(route, activeDirection)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      border: isSelected ? `2px solid ${routeColor}` : '1px solid #e2e8f0',
                      boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: routeColor,
                        color: '#ffffff',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: '700'
                      }}>
                        Bus {route.code || route.id}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', gap: '2px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectDirectoryRoute(route, 'AM'); }}
                            style={{
                              border: 'none',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              background: activeDirection === 'AM' ? routeColor : 'transparent',
                              color: activeDirection === 'AM' ? '#ffffff' : '#64748b'
                            }}
                          >
                            AM
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectDirectoryRoute(route, 'PM'); }}
                            style={{
                              border: 'none',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              background: activeDirection === 'PM' ? routeColor : 'transparent',
                              color: activeDirection === 'PM' ? '#ffffff' : '#64748b'
                            }}
                          >
                            PM
                          </button>
                        </div>

                        {isActive ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #bbf7d0' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                            Active
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '10px', fontSize: '0.9rem' }}>
                      {route.name || `Route ${route.code || route.id}`}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ClockIcon size={13} color="#64748b" />
                        {formatTo12Hour(startTimeVal)} – {formatTo12Hour(endTimeVal)}
                      </span>
                      <span>
                        {(isSelected && selectedRouteDetails?.totalDuration) || route.totalDuration || 35} mins
                      </span>
                      <span>
                        {
                          (isSelected && selectedRouteDetails?.stops)
                            ? selectedRouteDetails.stops.length
                            : (route.stopsCount || route.stops?.length || 0)
                        } stops
                      </span>
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Route Stops ({activeDirection})
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Click stop to focus map
                          </span>
                        </div>

                        {routeLoading ? (
                          <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Loading route stops...</p>
                        ) : selectedRouteDetails?.stops && selectedRouteDetails.stops.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {selectedRouteDetails.stops.map((st, i) => {
                              const isStopActive = selectedStop && (selectedStop.id === st.id || (selectedStop.lat === st.lat && selectedStop.lng === st.lng));

                              return (
                                <div
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStop(st);
                                  }}
                                  style={{
                                    fontSize: '0.76rem',
                                    color: isStopActive ? '#1e3a8a' : '#334155',
                                    background: isStopActive ? '#eff6ff' : '#ffffff',
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    border: isStopActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justify: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <span style={{
                                      background: isStopActive ? '#2563eb' : '#f1f5f9',
                                      color: isStopActive ? '#ffffff' : '#475569',
                                      fontWeight: '700',
                                      fontSize: '0.68rem',
                                      padding: '2px 6px',
                                      borderRadius: '4px'
                                    }}>
                                      #{i + 1}
                                    </span>
                                    <span style={{ fontWeight: isStopActive ? '700' : '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {st.name}
                                    </span>
                                  </div>
                                  <MapPinIcon size={14} color={isStopActive ? '#2563eb' : '#cbd5e1'} />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.76rem', color: '#94a3b8' }}>No stop details available for this route.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

      
      <MapView
        origin={origin}
        destination={destination}
        activeOption={activeOption}
        selectedRouteDetails={selectedRouteDetails}
        activeTab={activeTab}
        selectedStop={selectedStop}
        setSelectedStop={setSelectedStop}
        mapPickMode={mapPickMode}
        onMapClick={handleMapClick}
        showTraffic={showTraffic}
        setShowTraffic={setShowTraffic}
        walkToBoardPath={walkToBoardPath}
        walkToDestPath={walkToDestPath}
        walkToBoardInfo={walkToBoardInfo}
        walkToDestInfo={walkToDestInfo}
        selectedDirection={selectedDirection}
      />

    </div>
  );
}
