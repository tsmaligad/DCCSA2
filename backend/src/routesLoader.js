const fs = require('fs');
const path = require('path');

function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minsToTimeStr(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function loadRoutesData() {
  const candidateDirs = [
    path.join(__dirname, '../data/routes-main'),
    path.join(__dirname, '../data'),
    path.join(__dirname, '../data/routes'),
    path.join(__dirname, 'routes')
  ];

  const routesDir = candidateDirs.find(dir => fs.existsSync(dir));

  if (!routesDir) {
    console.error(`❌ Could not locate routes folder.`);
    return { routes: [], stopsMap: new Map() };
  }

  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.json') && f !== 'schema.json');
  const routes = [];
  const stopsMap = new Map();

  files.forEach(file => {
    try {
      const filePath = path.join(routesDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);

      const rawPoints = data.points || data.waypoints || [];

      // Standardize path coordinates to { lat, lng } format
      const allPathPoints = rawPoints
        .map(p => ({
          lat: parseFloat(p.latitude !== undefined ? p.latitude : p.lat),
          lng: parseFloat(p.longitude !== undefined ? p.longitude : p.lng)
        }))
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng));

      // Extract ONLY points where kind === 'stop' for bus stop markers
      const stops = rawPoints
        .filter(s => s.kind === 'stop')
        .map((s, idx) => {
          const lat = parseFloat(s.latitude !== undefined ? s.latitude : s.lat);
          const lng = parseFloat(s.longitude !== undefined ? s.longitude : s.lng);
          if (isNaN(lat) || isNaN(lng)) return null;

          const stopId = s.id || `${data.route_number || 'route'}_stop_${idx}`;
          const stopData = {
            id: stopId,
            name: s.name && s.name.trim() !== '' ? s.name : `Station #${idx + 1}`,
            kind: 'stop',
            lat,
            lng
          };

          if (!stopsMap.has(stopId)) {
            stopsMap.set(stopId, stopData);
          }
          return stopData;
        })
        .filter(Boolean);

      const startMins = timeToMins(data.start_time || '06:00');
      const endMins = timeToMins(data.end_time || '21:00');
      const frequencyMins = data.headway_mins || 15;

      const trips = [];
      for (let dep = startMins; dep <= endMins; dep += frequencyMins) {
        trips.push({ departureTimeMins: dep });
      }

      routes.push({
        id: String(data.route_number || file.replace('.json', '')),
        name: data.name || file.replace('.json', ''),
        color: data.color || '#ff8300',
        startMins,
        endMins,
        operatingHours: `${minsToTimeStr(startMins)} - ${minsToTimeStr(endMins)}`,
        stops,
        allPathPoints,
        trips
      });
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  });

  console.log(`✅ Loaded ${routes.length} routes and ${stopsMap.size} bus stops.`);
  return { routes, stopsMap };
}

module.exports = { loadRoutesData, timeToMins, minsToTimeStr };