import axios from 'axios';

export const reverseGeocode = async (lat, lng) => {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon: lng,
        format: 'json',
        addressdetails: 1
      }
    });

    if (res.data) {
      const place = res.data;
      const addr = place.address || {};
      
      const title =
        place.name ||
        addr.amenity ||
        addr.building ||
        addr.shop ||
        addr.tourism ||
        addr.leisure ||
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        'Selected Location';

      const rawParts = place.display_name ? place.display_name.split(',') : [];
      const fullAddress = rawParts.length > 1 ? rawParts.slice(1).join(',').trim() : place.display_name;

      return { label: title, address: fullAddress };
    }
  } catch (err) {
    console.error('Reverse geocoding failed:', err);
  }

  return { label: 'Pinned Location', address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
};

export const searchPlaces = async (query) => {
  const res = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: query, format: 'json', addressdetails: 1, limit: 6 }
  });
  return res.data || [];
};

export const fetchFootRoute = async (startLng, startLat, endLng, endLat) => {
  const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  const res = await axios.get(url);
  return res.data;
};

export const fetchAllRoutes = async () => {
  const res = await axios.get('http://localhost:5001/api/routes');
  return res.data;
};

export const fetchRouteDetails = async (routeId, direction = 'AM') => {
  const res = await axios.get(`http://localhost:5001/api/routes/${routeId}`, {
    params: { direction }
  });
  return res.data;
};

export const planTripApi = async (origin, destination, departureTime) => {
  const res = await axios.post('http://localhost:5001/api/plan-trip', {
    origin,
    destination,
    departureTime
  });
  return res.data;
};