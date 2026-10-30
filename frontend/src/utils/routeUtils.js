export function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateWalkMins(distanceMeters) {
  if (!distanceMeters || distanceMeters <= 0) return 1;
  const distKm = distanceMeters / 1000;
  return Math.max(1, Math.round(distKm * 12.5));
}

export function sliceRouteGeometry(stops = [], pathPoints = [], boardStopId, alightStopId, boardStopCoords, alightStopCoords) {
  if (!stops.length) return { slicedStops: [], slicedPathPoints: [] };

  let boardIdx = stops.findIndex(s => s.id === boardStopId || (s.name && boardStopCoords?.name && s.name.toLowerCase() === boardStopCoords.name.toLowerCase()));
  let alightIdx = stops.findIndex(s => s.id === alightStopId || (s.name && alightStopCoords?.name && s.name.toLowerCase() === alightStopCoords.name.toLowerCase()));

  if (boardIdx === -1 && boardStopCoords?.lat) {
    let minDist = Infinity;
    stops.forEach((s, idx) => {
      const d = getDistanceInKm(s.lat, s.lng, boardStopCoords.lat, boardStopCoords.lng);
      if (d < minDist) { minDist = d; boardIdx = idx; }
    });
  }

  if (alightIdx === -1 && alightStopCoords?.lat) {
    let minDist = Infinity;
    stops.forEach((s, idx) => {
      const d = getDistanceInKm(s.lat, s.lng, alightStopCoords.lat, alightStopCoords.lng);
      if (d < minDist) { minDist = d; alightIdx = idx; }
    });
  }

  if (boardIdx === -1) boardIdx = 0;
  if (alightIdx === -1) alightIdx = stops.length - 1;

  const startIdx = Math.min(boardIdx, alightIdx);
  const endIdx = Math.max(boardIdx, alightIdx);

  const slicedStops = stops.slice(startIdx, endIdx + 1);

  let slicedPathPoints = [];
  if (pathPoints && pathPoints.length > 0) {
    const normalizedPath = pathPoints.map(p => {
      if (Array.isArray(p)) {
        return p[0] > 100 ? [p[1], p[0]] : [p[0], p[1]];
      }
      return [parseFloat(p.lat || p.latitude), parseFloat(p.lng || p.longitude)];
    }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    const startCoord = slicedStops[0] || boardStopCoords;
    const endCoord = slicedStops[slicedStops.length - 1] || alightStopCoords;

    if (startCoord?.lat && endCoord?.lat) {
      let closestStartIdx = 0;
      let minStartDist = Infinity;
      let closestEndIdx = normalizedPath.length - 1;
      let minEndDist = Infinity;

      normalizedPath.forEach((pt, idx) => {
        const distStart = getDistanceInKm(pt[0], pt[1], startCoord.lat, startCoord.lng);
        if (distStart < minStartDist) {
          minStartDist = distStart;
          closestStartIdx = idx;
        }

        const distEnd = getDistanceInKm(pt[0], pt[1], endCoord.lat, endCoord.lng);
        if (distEnd < minEndDist) {
          minEndDist = distEnd;
          closestEndIdx = idx;
        }
      });

      const pStart = Math.min(closestStartIdx, closestEndIdx);
      const pEnd = Math.max(closestStartIdx, closestEndIdx);
      slicedPathPoints = normalizedPath.slice(pStart, pEnd + 1);
    } else {
      slicedPathPoints = normalizedPath;
    }
  } else {
    slicedPathPoints = slicedStops.map(s => [s.lat, s.lng]);
  }

  return { slicedStops, slicedPathPoints };
}

export function parseBackendRouteData(data, routeMeta = {}, direction = 'AM') {
  let stops = [];
  let pathPoints = [];

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    data.features.forEach(f => {
      if (f.geometry?.type === 'LineString') {
        pathPoints = f.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      } else if (f.geometry?.type === 'Point') {
        stops.push({
          id: f.properties?.id || `stop-${stops.length}`,
          name: f.properties?.name || f.properties?.stop_name || `Stop #${stops.length + 1}`,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0]
        });
      }
    });
  } else {
    const rawStops = data.stops || data.allRouteStops || data.routeStops || [];
    stops = rawStops.map((st, i) => ({
      id: st.id || `stop-${i}`,
      name: st.name || st.stop_name || st.label || `Stop #${i + 1}`,
      lat: parseFloat(st.lat || st.latitude || (st.coordinates && st.coordinates[1])),
      lng: parseFloat(st.lng || st.longitude || (st.coordinates && st.coordinates[0]))
    })).filter(s => !isNaN(s.lat) && !isNaN(s.lng));

    const rawPath = data.pathPoints || data.allPathPoints || data.geometry || data.coordinates || [];
    pathPoints = rawPath.map(p => {
      if (Array.isArray(p)) {
        return p[0] > 100 ? [p[1], p[0]] : [p[0], p[1]];
      }
      return [parseFloat(p.lat || p.latitude), parseFloat(p.lng || p.longitude)];
    });
  }

  return {
    id: routeMeta.id || data.id,
    code: routeMeta.code || data.code || routeMeta.id || data.id,
    name: data.name || routeMeta.name || `Route ${routeMeta.code || routeMeta.id}`,
    color: routeMeta.color || data.color || '#2563eb',
    isActiveNow: data.isActiveNow !== undefined ? data.isActiveNow : (routeMeta.isActiveNow !== undefined ? routeMeta.isActiveNow : true),
    startTime: data.startTime || (direction === 'PM' ? '16:00' : '06:00'),
    endTime: data.endTime || (direction === 'PM' ? '21:00' : '10:00'),
    totalDuration: data.totalDuration || routeMeta.totalDuration || 35,
    nextDepartureStr: data.nextDepartureStr || routeMeta.nextDepartureStr || '10-15 mins',
    direction,
    stops,
    pathPoints
  };
}