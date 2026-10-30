import L from 'leaflet';

export const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export const boardStopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export const alightStopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export const createCircleStopIcon = (color = '#2563eb') => {
  return L.divIcon({
    className: 'custom-circle-stop-marker',
    html: `<div style="
      width: 12px; height: 12px; background-color: #ffffff;
      border: 3.5px solid ${color}; border-radius: 50%;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.25); cursor: pointer;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

export const createHighlightedStopIcon = (color = '#ef4444') => {
  return L.divIcon({
    className: 'custom-highlight-stop-marker',
    html: `<div style="
      width: 22px; height: 22px; background-color: ${color};
      border: 4px solid #ffffff; border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.35), 0 4px 10px rgba(0,0,0,0.3);
      cursor: pointer; animation: pulse-ring 1.5s infinite;
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};