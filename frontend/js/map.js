const safeTrailMaps = {};

const initLeafletMap = (containerId, center = [17.3850, 78.4867], zoom = 13) => {
  const mapElement = document.getElementById(containerId);
  if (!mapElement) return null;
  if (safeTrailMaps[containerId]) return safeTrailMaps[containerId];

  const map = L.map(containerId, { zoomControl: false }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const blueIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41]
  });

  const marker = L.marker(center, { icon: blueIcon }).addTo(map);
  marker.bindPopup('Your Location');
  
  safeTrailMaps[containerId] = { map, marker, center, markers: [] };
  return safeTrailMaps[containerId];
};

const updateLeafletLocation = (containerId, lat, lng, label) => {
  const entry = safeTrailMaps[containerId] || initLeafletMap(containerId, [lat, lng]);
  if (!entry) return;
  entry.map.setView([lat, lng], 15);
  if (entry.marker) {
    entry.marker.setLatLng([lat, lng]);
  } else {
    const blueIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41]
    });
    entry.marker = L.marker([lat, lng], { icon: blueIcon }).addTo(entry.map);
  }
  if (label) {
    entry.marker.setPopupContent(label).openPopup();
  }
};

const drawRouteOnMap = (containerId, coordinates = [], color = '#2563eb') => {
  const entry = safeTrailMaps[containerId];
  if (!entry || coordinates.length < 2) return;
  if (entry.routeLine) entry.map.removeLayer(entry.routeLine);
  entry.routeLine = L.polyline(coordinates, { color: color, weight: 5, opacity: 0.75 }).addTo(entry.map);
  entry.map.fitBounds(entry.routeLine.getBounds(), { padding: [50, 50] });
  return entry.routeLine;
};

const addServiceMarker = (containerId, lat, lng, service) => {
  const entry = safeTrailMaps[containerId];
  if (!entry) return null;

  const serviceIcons = {
    'police': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    'hospital': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    'helpline': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    'pharmacy': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    'fire': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    'safezone': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png'
  };

  const icon = L.icon({
    iconUrl: serviceIcons[service.type] || serviceIcons['safezone'],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41]
  });

  const marker = L.marker([lat, lng], { icon }).addTo(entry.map);
  marker.bindPopup(`<b>${service.name}</b><br><small>${service.distance}km away</small>`);
  entry.markers.push(marker);
  return marker;
};

const addIncidentMarker = (containerId, lat, lng, incident) => {
  const entry = safeTrailMaps[containerId];
  if (!entry) return null;

  const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [30, 46],
    shadowSize: [41, 41],
    iconAnchor: [15, 46],
    shadowAnchor: [12, 41]
  });

  const marker = L.marker([lat, lng], { icon }).addTo(entry.map);
  marker.bindPopup(`<b>🚨 SOS Alert</b><br>Type: ${incident.type}<br>Tourist: ${incident.touristName}`);
  entry.markers.push(marker);
  
  // Animate pulse effect
  marker.setOpacity(1);
  let pulse = true;
  setInterval(() => {
    pulse = !pulse;
    marker.setOpacity(pulse ? 1 : 0.7);
  }, 800);

  return marker;
};

const clearMapMarkers = (containerId) => {
  const entry = safeTrailMaps[containerId];
  if (!entry) return;
  entry.markers.forEach(marker => {
    entry.map.removeLayer(marker);
  });
  entry.markers = [];
};

const getCurrentLocation = (callback) => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        callback({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      error => {
        console.error('Geolocation error:', error);
        callback({ lat: 17.3850, lng: 78.4867 });
      }
    );
  } else {
    callback({ lat: 17.3850, lng: 78.4867 });
  }
};

window.initLeafletMap = initLeafletMap;
window.updateLeafletLocation = updateLeafletLocation;
window.drawRouteOnMap = drawRouteOnMap;
window.addServiceMarker = addServiceMarker;
window.addIncidentMarker = addIncidentMarker;
window.clearMapMarkers = clearMapMarkers;
window.getCurrentLocation = getCurrentLocation;
window.safeTrailMaps = safeTrailMaps;
