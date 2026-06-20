let emergencyMap = null;
let incidents = [];
let incidentMarkers = {};
let selectedIncidentId = null;
let lastIncidentAlertKey = null;
let operatorRouteLine = null;
let operatorMarker = null;
let usingMapFallback = false;
const locationNameCache = {};

document.addEventListener('DOMContentLoaded', () => {
  initEmergencyPage();
  initEmergencySocket();
});

function initEmergencyPage() {
  initializeEmergencyMap();
  initializeConsoleActions();
  loadIncidents();
}

function initializeEmergencyMap() {
  const mapEl = document.getElementById('emergencyMap');
  if (!mapEl) {
    console.warn('Emergency map container not found');
    return;
  }

  if (!window.L) {
    console.warn('Leaflet library not loaded, using fallback');
    usingMapFallback = true;
    renderMapFallback({ lat: 17.3850, lng: 78.4867 }, 'Emergency map');
    return;
  }

  if (emergencyMap) emergencyMap.remove();

  try {
    emergencyMap = L.map('emergencyMap').setView([17.3850, 78.4867], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(emergencyMap);

    addStaticServices();
    
    // Multiple invalidateSize calls to ensure proper sizing
    setTimeout(() => emergencyMap.invalidateSize(), 100);
    setTimeout(() => emergencyMap.invalidateSize(), 300);
    setTimeout(() => emergencyMap.invalidateSize(), 500);
    
    console.log('Emergency map initialized successfully');
  } catch (error) {
    console.error('Error initializing emergency map:', error);
    usingMapFallback = true;
    renderMapFallback({ lat: 17.3850, lng: 78.4867 }, 'Emergency map - Fallback mode');
  }
}

function addStaticServices() {
  const services = [
    { lat: 17.3833, lng: 78.4867, type: 'police', name: 'Police Station' },
    { lat: 17.3885, lng: 78.4899, type: 'hospital', name: 'Hospital' },
    { lat: 17.3910, lng: 78.4789, type: 'fire', name: 'Fire Station' }
  ];

  const icons = {
    police: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    hospital: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    fire: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
  };

  services.forEach(service => {
    const icon = L.icon({
      iconUrl: icons[service.type],
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41]
    });

    L.marker([service.lat, service.lng], { icon }).addTo(emergencyMap)
      .bindPopup(`<b>${service.name}</b>`);
  });
}

async function loadIncidents() {
  try {
    const result = await fetchWithAuth('/emergency/incidents');
    if (result.success) {
      incidents = result.incidents || [];
      await hydrateIncidentLocationNames(incidents);
      displayIncidents();
      updateIncidentStats();
      updateResponseConsole(incidents.find(incident => incident._id === selectedIncidentId) || null);
    } else {
      showEmergencyToast(result.message || 'Failed to load incidents');
    }
  } catch (error) {
    console.error('Load incidents error:', error);
    showEmergencyToast('Error loading incidents');
  }
}

function displayIncidents() {
  const container = document.getElementById('incidentList');
  if (!container) return;

  if (emergencyMap) {
    Object.values(incidentMarkers).forEach(marker => emergencyMap.removeLayer(marker));
  }
  incidentMarkers = {};
  container.innerHTML = '';

  if (!incidents.length) {
    container.innerHTML = '<div class="empty-state">No incidents reported yet.</div>';
    return;
  }

  incidents.forEach(incident => {
    const user = incident.userId || {};
    const card = document.createElement('div');
    card.className = `incident-card ${incident.status || 'active'}`;
    if (incident._id === selectedIncidentId) card.classList.add('selected');

    const statusColor = {
      active: '#ef4444',
      responding: '#f59e0b',
      resolved: '#22c55e'
    };
    const status = incident.status || 'active';

    card.innerHTML = `
      <div class="incident-header">
        <div>
          <strong>${escapeHtml(user.name || 'Unknown')}</strong>
          <span class="type">${formatIncidentType(incident.type)}</span>
        </div>
        <span class="status-badge" style="background: ${statusColor[status] || '#64748b'}20; color: ${statusColor[status] || '#64748b'};">
          ${status.toUpperCase()}
        </span>
      </div>
      <div class="incident-details">
        <div>Phone: ${escapeHtml(user.phone || '-')}</div>
        <div>Emergency: ${escapeHtml(formatEmergencyContact(user.emergencyContact))}</div>
        <div>Time: ${incident.createdAt ? new Date(incident.createdAt).toLocaleString() : '-'}</div>
        <div>Location: ${escapeHtml(formatLocation(incident.location))}</div>
        <div>Status: ${status}</div>
      </div>
      <div class="incident-actions">
        <button class="respond-btn" type="button" data-id="${incident._id}">Respond</button>
        <button class="resolve-btn" type="button" data-id="${incident._id}">Resolve</button>
      </div>
    `;

    card.addEventListener('click', () => selectIncident(incident._id));
    card.querySelector('.respond-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      selectIncident(incident._id);
      respondToIncident(incident._id);
    });
    card.querySelector('.resolve-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      selectIncident(incident._id);
      resolveIncident(incident._id);
    });

    container.appendChild(card);

    if (incident.location) addEmergencyIncidentMarker(incident);
  });
}

function addEmergencyIncidentMarker(incident) {
  if (!emergencyMap || !window.L || !incident.location) return;

  const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [30, 46],
    shadowSize: [41, 41],
    iconAnchor: [15, 46],
    shadowAnchor: [12, 41]
  });

  const marker = L.marker([incident.location.lat, incident.location.lng], { icon: redIcon })
    .addTo(emergencyMap)
    .bindPopup(`<b>SOS</b><br>Tourist: ${escapeHtml(incident.userId?.name || 'Unknown')}<br>Phone: ${escapeHtml(incident.userId?.phone || '-')}<br>Type: ${formatIncidentType(incident.type)}`);

  marker.on('click', () => selectIncident(incident._id));
  incidentMarkers[incident._id] = marker;
}

function initializeConsoleActions() {
  const respondBtn = document.getElementById('consoleRespondBtn');
  const resolveBtn = document.getElementById('consoleResolveBtn');

  if (respondBtn) {
    respondBtn.addEventListener('click', () => {
      if (selectedIncidentId) respondToIncident(selectedIncidentId);
    });
  }

  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => {
      if (selectedIncidentId) resolveIncident(selectedIncidentId);
    });
  }
}

function selectIncident(incidentId) {
  selectedIncidentId = incidentId;
  const incident = incidents.find(item => item._id === incidentId);
  updateResponseConsole(incident || null);

  document.querySelectorAll('.incident-card').forEach(card => card.classList.remove('selected'));
  const index = incidents.findIndex(item => item._id === incidentId);
  const card = document.querySelectorAll('.incident-card')[index];
  if (card) card.classList.add('selected');

  const marker = incidentMarkers[incidentId];
  if (incident?.location && marker && emergencyMap) {
    emergencyMap.setView([incident.location.lat, incident.location.lng], 15);
    marker.openPopup();
  } else if (incident?.location && usingMapFallback) {
    renderMapFallback(incident.location, incident.userId?.name || 'SOS location');
  }
}

function updateResponseConsole(incident) {
  const touristNameEl = document.getElementById('touristName');
  const touristContactEl = document.getElementById('touristContact');
  const emergencyContactEl = document.getElementById('emergencyContact');
  const incidentTypeEl = document.getElementById('incidentType');
  const incidentStatusEl = document.getElementById('incidentStatus');
  const incidentLocationEl = document.getElementById('incidentLocation');
  const respondBtn = document.getElementById('consoleRespondBtn');
  const resolveBtn = document.getElementById('consoleResolveBtn');

  if (!incident) {
    if (touristNameEl) touristNameEl.textContent = 'Select Incident';
    if (touristContactEl) touristContactEl.textContent = '-';
    if (emergencyContactEl) emergencyContactEl.textContent = '-';
    if (incidentTypeEl) incidentTypeEl.textContent = '-';
    if (incidentStatusEl) incidentStatusEl.textContent = '-';
    if (incidentLocationEl) incidentLocationEl.textContent = '-';
    if (respondBtn) respondBtn.disabled = true;
    if (resolveBtn) resolveBtn.disabled = true;
    return;
  }

  const user = incident.userId || {};
  if (touristNameEl) touristNameEl.textContent = user.name || 'Unknown';
  if (touristContactEl) touristContactEl.textContent = [user.phone, user.email].filter(Boolean).join(' | ') || '-';
  if (emergencyContactEl) emergencyContactEl.textContent = formatEmergencyContact(user.emergencyContact);
  if (incidentTypeEl) incidentTypeEl.textContent = formatIncidentType(incident.type);
  if (incidentStatusEl) incidentStatusEl.textContent = incident.status || '-';
  if (incidentLocationEl) {
    incidentLocationEl.textContent = formatLocation(incident.location);
  }
  if (respondBtn) respondBtn.disabled = incident.status === 'resolved';
  if (resolveBtn) resolveBtn.disabled = incident.status === 'resolved';
}

async function respondToIncident(incidentId) {
  try {
    const result = await fetchWithAuth(`/emergency/incidents/${incidentId}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({})
    });

    if (result.success) {
      showEmergencyToast('Response message sent to tourist');
      loadIncidents();
    } else {
      showEmergencyToast(result.message || 'Error responding to incident');
    }
  } catch (error) {
    console.error('Respond error:', error);
    showEmergencyToast('Error responding to incident');
  }
}

async function resolveIncident(incidentId) {
  const incident = incidents.find(item => item._id === incidentId);
  if (incident?.location) {
    await showDirectionsToIncident(incident);
  }

  try {
    const result = await fetchWithAuth(`/emergency/incidents/${incidentId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({})
    });

    if (result.success) {
      showEmergencyToast('Incident resolved');
      loadIncidents();
    } else {
      showEmergencyToast(result.message || 'Error resolving incident');
    }
  } catch (error) {
    console.error('Resolve error:', error);
    showEmergencyToast('Error resolving incident');
  }
}

function updateIncidentStats() {
  const activeCount = incidents.filter(i => i.status === 'active').length;
  const respondingCount = incidents.filter(i => i.status === 'responding').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  const activeEl = document.getElementById('activeCount');
  const respondingEl = document.getElementById('respondingCount');
  const resolvedEl = document.getElementById('resolvedCount');

  if (activeEl) activeEl.textContent = activeCount;
  if (respondingEl) respondingEl.textContent = respondingCount;
  if (resolvedEl) resolvedEl.textContent = resolvedCount;
}

function initEmergencySocket() {
  const socket = initSocket();
  if (!socket || socket._emergencyBound) return;
  socket._emergencyBound = true;

  socket.on('newIncident', (data = {}) => {
    const alertKey = data.incidentId || `${data.type || 'incident'}-${data.location?.lat || ''}-${data.location?.lng || ''}`;
    if (alertKey && alertKey === lastIncidentAlertKey) return;
    lastIncidentAlertKey = alertKey;

    loadIncidents();
    showEmergencyToast('NEW INCIDENT ALERT');
  });

  socket.on('incidentUpdated', () => {
    loadIncidents();
  });
}

async function showDirectionsToIncident(incident) {
  const operatorLocation = await getOperatorLocation();
  const touristLocation = incident.location;
  const directionsUrl = buildDirectionsUrl(operatorLocation, touristLocation);

  if (emergencyMap && window.L) {
    if (operatorRouteLine) emergencyMap.removeLayer(operatorRouteLine);
    if (operatorMarker) emergencyMap.removeLayer(operatorMarker);

    operatorMarker = L.marker([operatorLocation.lat, operatorLocation.lng])
      .addTo(emergencyMap)
      .bindPopup('Operator Location');

    operatorRouteLine = L.polyline(
      [
        [operatorLocation.lat, operatorLocation.lng],
        [touristLocation.lat, touristLocation.lng]
      ],
      { color: '#2563eb', weight: 5, opacity: 0.8, dashArray: '8, 10' }
    ).addTo(emergencyMap);

    emergencyMap.fitBounds(operatorRouteLine.getBounds(), { padding: [60, 60] });
  }

  const locationEl = document.getElementById('incidentLocation');
  if (locationEl) {
    locationEl.innerHTML = `
      ${escapeHtml(formatLocation(touristLocation))}
      <br><a href="${directionsUrl}" target="_blank" rel="noopener">Open turn-by-turn directions</a>
    `;
  }

  showEmergencyToast('Directions displayed');
}

function getOperatorLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({ lat: 17.3850, lng: 78.4867 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve({ lat: 17.3850, lng: 78.4867 }),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  });
}

function buildDirectionsUrl(origin, destination) {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function renderMapFallback(location, label) {
  const mapEl = document.getElementById('emergencyMap');
  if (!mapEl || !location) return;

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const delta = 0.012;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');
  const marker = `${lat},${lng}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;

  mapEl.innerHTML = `
    <iframe class="fallback-map-frame" title="${escapeHtml(label || 'Incident map')}" src="${src}"></iframe>
  `;
}

function formatIncidentType(type = '') {
  if (type === 'voice_sos' || type === 'auto_detected') return 'Automatic SOS';
  if (type === 'manual_sos') return 'Manual SOS';
  return type ? type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : '-';
}

function formatLocation(location) {
  if (!location) return '-';
  return location.name || location.displayName || 'Location unavailable';
}

async function hydrateIncidentLocationNames(items) {
  await Promise.all(items.map(async incident => {
    if (!incident.location || incident.location.name) return;
    incident.location.name = await getIncidentLocationName(incident.location);
  }));
}

async function getIncidentLocationName(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Location unavailable';

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (locationNameCache[cacheKey]) return locationNameCache[cacheKey];

  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '1'
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await response.json();
    const name = formatLocationName(data) || 'Location unavailable';
    locationNameCache[cacheKey] = name;
    return name;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return 'Location unavailable';
  }
}

function formatLocationName(place) {
  const address = place?.address || {};
  const parts = [
    address.neighbourhood || address.suburb || address.road || address.village,
    address.city || address.town || address.county,
    address.state
  ].filter(Boolean);

  return parts.length ? [...new Set(parts)].join(', ') : place?.display_name;
}

function formatEmergencyContact(contact = {}) {
  const name = contact.name || '';
  const phone = contact.phone || '';
  return [name, phone].filter(Boolean).join(' | ') || '-';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function showEmergencyToast(message) {
  const toast = document.createElement('div');
  toast.className = 'sos-toast success';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-bell"></i>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
}

window.respondToIncident = respondToIncident;
window.resolveIncident = resolveIncident;
