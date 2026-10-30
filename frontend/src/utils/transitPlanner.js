import { getDistanceInKm } from './routeUtils';

export const SOUTH_ZONES = ['toril', 'mintal', 'bangkal', 'matina', 'calinan'];
export const NORTH_ZONES = ['buhangin', 'panacan', 'sasa', 'cabantian', 'tibungco'];
export const TRANSFER_HUBS = ['roxas', 'torres', 'poblacion', 'aldevinco', 'claveria'];

export function checkIsSouthbound(text = '') {
  const lower = text.toLowerCase();
  return SOUTH_ZONES.some(zone => lower.includes(zone));
}

export function checkIsNorthbound(text = '') {
  const lower = text.toLowerCase();
  return NORTH_ZONES.some(zone => lower.includes(zone));
}

export function findNearestStopAndRoutes(origin, routesList) {
  if (!origin?.lat || !origin?.lng || !routesList.length) return null;

  let nearestStop = null;
  let minDistance = Infinity;

  routesList.forEach(route => {
    const stops = route.stops || route.allRouteStops || [];
    stops.forEach(stop => {
      const dist = getDistanceInKm(origin.lat, origin.lng, stop.lat, stop.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestStop = stop;
      }
    });
  });

  let servingRoutes = [];
  if (nearestStop) {
    servingRoutes = routesList.filter(route => {
      const stops = route.stops || route.allRouteStops || [];
      return stops.some(s => s.id === nearestStop.id || (s.name && s.name.toLowerCase() === nearestStop.name.toLowerCase()));
    });
  }

  return {
    nearestStop,
    distanceKm: minDistance.toFixed(2),
    servingRoutes
  };
}

export function buildDoubleRideOption(origin, destination, routesList) {
  const isFromSouth = checkIsSouthbound(`${origin.label} ${origin.address}`);
  const isToNorth = checkIsNorthbound(`${destination.label} ${destination.address}`);

  if (!isFromSouth || !isToNorth) return null;

  let leg1Candidate = null;
  let transferStop = null;

  for (const route of routesList) {
    const stops = route.stops || route.allRouteStops || [];
    const hubStop = stops.find(s => TRANSFER_HUBS.some(hub => s.name?.toLowerCase().includes(hub)));
    if (hubStop) {
      leg1Candidate = route;
      transferStop = hubStop;
      break;
    }
  }

  let leg2Candidate = null;
  if (leg1Candidate && transferStop) {
    for (const route of routesList) {
      if (route.id === leg1Candidate.id) continue;
      const stops = route.stops || route.allRouteStops || [];
      const hasHub = stops.some(s => TRANSFER_HUBS.some(hub => s.name?.toLowerCase().includes(hub)));
      if (hasHub) {
        leg2Candidate = route;
        break;
      }
    }
  }

  if (leg1Candidate && leg2Candidate && transferStop) {
    const combinedStops = [...(leg1Candidate.stops || []), ...(leg2Candidate.stops || [])];
    const combinedPath = [...(leg1Candidate.pathPoints || []), ...(leg2Candidate.pathPoints || [])];

    return {
      isTransfer: true,
      primaryColor: '#8b5cf6',
      primaryRouteNumber: `${leg1Candidate.code || leg1Candidate.id} ➔ ${leg2Candidate.code || leg2Candidate.id}`,
      primaryRouteName: `Double Ride via ${transferStop.name}`,
      transferHubName: transferStop.name || 'Roxas Avenue / Torres St Hub',
      totalDuration: (leg1Candidate.totalDuration || 30) + (leg2Candidate.totalDuration || 25) + 10,
      nextDepartureStr: '10-15 mins',
      isActiveNow: true,
      allRouteStops: combinedStops,
      allPathPoints: combinedPath,
      boardStopId: leg1Candidate.stops?.[0]?.id || 'board-1',
      alightStopId: leg2Candidate.stops?.[leg2Candidate.stops.length - 1]?.id || 'alight-2',
      leg1: {
        routeCode: leg1Candidate.code || leg1Candidate.id,
        routeName: leg1Candidate.name,
        from: origin.label,
        to: transferStop.name
      },
      leg2: {
        routeCode: leg2Candidate.code || leg2Candidate.id,
        routeName: leg2Candidate.name,
        from: transferStop.name,
        to: destination.label
      }
    };
  }

  return null;
}