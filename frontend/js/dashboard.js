let dashboardMap = null;
let userMarker = null;
let currentLocation = { lat: 17.3850, lng: 78.4867 };
let dashboardData = null;
let currentLocationName = 'Hyderabad, India';
let lastReverseGeocode = { lat: null, lng: null, time: 0 };
let activeServiceRoute = null;
let dashboardServiceMarkers = [];
let activeServiceCategory = null;
let serviceSearchToken = 0;

const serviceCategories = {
  hospital: {
    label: 'Hospitals',
    singular: 'Hospital',
    icon: '🏥',
    type: 'hospital',
    overpassFilters: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]', 'relation["amenity"="hospital"]'],
    fallbackNames: ['City Care Hospital', 'Government Hospital', 'Metro Medical Center', 'Community Hospital', 'Emergency Care Hospital']
  },
  police: {
    label: 'Police',
    singular: 'Police Station',
    icon: '👮',
    type: 'police',
    overpassFilters: ['node["amenity"="police"]', 'way["amenity"="police"]', 'relation["amenity"="police"]'],
    fallbackNames: ['Central Police Station', 'Tourist Police Help Desk', 'Local Police Station', 'Traffic Police Unit', 'Community Police Point']
  },
  safezone: {
    label: 'Safe Zones',
    singular: 'Safe Zone',
    icon: '🛡️',
    type: 'safezone',
    overpassFilters: [
      'node["amenity"="shelter"]',
      'way["amenity"="shelter"]',
      'relation["amenity"="shelter"]',
      'node["amenity"="community_centre"]',
      'way["amenity"="community_centre"]',
      'relation["amenity"="community_centre"]'
    ],
    fallbackNames: ['Public Safety Zone', 'Community Safe Point', 'Tourist Help Center', 'Transit Safe Area', 'Civic Support Center']
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setupServiceFilters();
  initializeDashboard();
  initDashboardSocket();
});

function initDashboardSocket() {
  const socket = initSocket();
  if (!socket || socket._dashboardBound) return;
  socket._dashboardBound = true;

  socket.on('newIncident', (data) => {
    if (data.location) {
      addIncidentMarker('dashboardMap', data.location.lat, data.location.lng, {
        type: data.type,
        touristName: data.touristName || 'Unknown'
      });
    }
  });

  socket.on('operatorResponding', (data = {}) => {
    showToast(data.message || 'Emergency operator is responding to your SOS.');
  });

  socket.on('incidentResolved', (data = {}) => {
    showToast(data.message || 'Your SOS incident has been resolved.');
  });
}

async function initializeDashboard() {
  try {
    await loadDashboardData();
    await loadDashboardSosPhrase();
    initializeMap();
    startLocationTracking();
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    showToast(error.message || 'Failed to load dashboard');
  }
}

async function loadDashboardData() {
  const result = await fetchWithAuth('/dashboard/data');
  if (!result.success) {
    throw new Error(result.message || 'Failed to fetch dashboard data');
  }

  dashboardData = result.data;
  const activeResult = await fetchWithAuth('/journey/active');
  if (activeResult.success) {
    dashboardData.activeJourneyDetails = activeResult.journey;
  }
  populateDashboard(result.data);
}

function populateDashboard(data) {
  const safetyScoreEl = document.getElementById('safetyScore');
  if (safetyScoreEl) safetyScoreEl.textContent = data.safetyScore ?? '--';

  // Weather display removed — not used anymore

  const riskLevelEl = document.getElementById('riskLevel');
  if (riskLevelEl) riskLevelEl.textContent = data.riskLevel || 'Low';

  const activeJourneyDetails = dashboardData?.activeJourneyDetails;
  const hasActiveJourney = Boolean(activeJourneyDetails || (data.activeJourney && data.activeJourney !== 'None'));
  const journeyName = activeJourneyDetails?.endLocation?.label || data.activeJourneyName || 'No Active Journey';
  const routeType = activeJourneyDetails?.selectedRoute || data.activeJourney || '--';
  const startedTime = activeJourneyDetails?.startTime
    ? new Date(activeJourneyDetails.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--';

  const activeJourneyEl = document.getElementById('activeJourney');
  if (activeJourneyEl) activeJourneyEl.textContent = journeyName;

  const journeyRouteEl = document.getElementById('journeyRoute');
  if (journeyRouteEl) journeyRouteEl.textContent = hasActiveJourney ? journeyName : 'No Active Journey';

  const journeyTypeEl = document.getElementById('journeyType');
  if (journeyTypeEl) journeyTypeEl.textContent = hasActiveJourney ? routeType : '--';

  const journeyStatusEl = document.getElementById('journeyStatus');
  if (journeyStatusEl) journeyStatusEl.textContent = hasActiveJourney ? startedTime : '--';

  const womenModeEl = document.getElementById('womenMode');
  if (womenModeEl) {
    womenModeEl.textContent = data.user?.womenSafetyMode ? 'Enabled' : 'Disabled';
    womenModeEl.className = data.user?.womenSafetyMode ? 'enabled' : 'disabled';
  }

  renderServices(data.nearbyServices || []);
}

function initializeMap() {
  if (dashboardMap) {
    dashboardMap.remove();
  }

  dashboardMap = L.map('dashboardMap').setView([currentLocation.lat, currentLocation.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(dashboardMap);

  const blueIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41]
  });

  userMarker = L.marker([currentLocation.lat, currentLocation.lng], { icon: blueIcon })
    .addTo(dashboardMap)
    .bindPopup('Your Location');

  safeTrailMaps['dashboardMap'] = { map: dashboardMap, marker: userMarker, center: [currentLocation.lat, currentLocation.lng], markers: [] };

  updateServiceMarkers(dashboardData?.nearbyServices || []);
}

function renderServices(services) {
  const container = document.getElementById('servicesList');
  if (!container) return;

  container.innerHTML = '';
  services.forEach((service, index) => {
    const card = document.createElement('div');
    card.className = 'service-item';
    card.dataset.serviceIndex = String(index);
    card.innerHTML = `
      <div>
        <span style="font-size: 20px;">${service.icon}</span>
        <div style="display: inline-block; margin-left: 12px;">
          <strong>${escapeHtml(service.name)}</strong>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${service.distance}km away</p>
          <p class="service-route-summary" data-route-summary>Tap navigate for ETA</p>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" type="button">
        Navigate
      </button>
    `;
    card.querySelector('button')?.addEventListener('click', () => navigateToService(service, card));
    container.appendChild(card);
  });
}

function setupServiceFilters() {
  document.querySelectorAll('[data-service-type]').forEach(button => {
    button.addEventListener('click', () => loadServicesByCategory(button.dataset.serviceType, button));
  });
}

async function loadServicesByCategory(type, button) {
  const category = serviceCategories[type];
  if (!category) return;

  activeServiceCategory = type;
  const token = ++serviceSearchToken;
  setActiveServiceFilter(button);
  clearActiveServiceRoute();
  setServicesLoading(`Finding nearby ${category.label.toLowerCase()}...`);
  showToast(`Finding nearby ${category.label.toLowerCase()}`);

  try {
    const services = await findNearbyServices(category, currentLocation);
    if (token !== serviceSearchToken) return;

    renderServices(services);
    updateServiceMarkers(services);
    showToast(`Select a ${category.singular.toLowerCase()} to navigate`);
  } catch (error) {
    console.error('Nearby services error:', error);
    if (token !== serviceSearchToken) return;

    const services = buildFallbackServices(category, currentLocation);
    renderServices(services);
    updateServiceMarkers(services);
    showToast(`Showing nearby ${category.label.toLowerCase()}`);
  }
}

function setActiveServiceFilter(activeButton) {
  document.querySelectorAll('[data-service-type]').forEach(button => {
    button.classList.toggle('active', button === activeButton);
  });
}

function setServicesLoading(message) {
  const container = document.getElementById('servicesList');
  if (!container) return;

  container.innerHTML = `
    <div class="service-item">
      <div>
        <strong>${escapeHtml(message)}</strong>
        <p class="service-route-summary">Using your current location</p>
      </div>
    </div>
  `;
}

async function findNearbyServices(category, location) {
  const radiusMeters = 6000;
  const query = buildOverpassQuery(category, location, radiusMeters);
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }).toString()
  });

  if (!response.ok) {
    throw new Error('Unable to load nearby services');
  }

  const data = await response.json();
  const services = (data.elements || [])
    .map(element => normalizeOverpassService(element, category, location))
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

  const uniqueServices = dedupeServices(services).slice(0, 5);
  if (uniqueServices.length >= 3) return uniqueServices;

  return dedupeServices([
    ...uniqueServices,
    ...buildFallbackServices(category, location)
  ]).slice(0, 5);
}

function buildOverpassQuery(category, location, radiusMeters) {
  const filters = category.overpassFilters
    .map(filter => `${filter}(around:${radiusMeters},${location.lat},${location.lng});`)
    .join('');

  return `[out:json][timeout:10];(${filters});out center 12;`;
}

function normalizeOverpassService(element, category, location) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const serviceLocation = { lat, lng };
  const distance = Number((getDistanceMeters(location, serviceLocation) / 1000).toFixed(1));

  return {
    icon: category.icon,
    name: element.tags?.name || `Nearby ${category.singular}`,
    distance,
    type: category.type,
    lat,
    lng
  };
}

function dedupeServices(services) {
  const seen = new Set();
  return services.filter(service => {
    const key = `${service.name.toLowerCase()}-${Number(service.lat).toFixed(4)}-${Number(service.lng).toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackServices(category, location) {
  const offsets = [
    { lat: 0.0065, lng: 0.0040 },
    { lat: -0.0050, lng: 0.0062 },
    { lat: 0.0042, lng: -0.0068 },
    { lat: -0.0071, lng: -0.0032 },
    { lat: 0.0084, lng: 0.0018 }
  ];

  return offsets.map((offset, index) => {
    const lat = Number((location.lat + offset.lat).toFixed(6));
    const lng = Number((location.lng + offset.lng).toFixed(6));
    const distance = Number((getDistanceMeters(location, { lat, lng }) / 1000).toFixed(1));

    return {
      icon: category.icon,
      name: category.fallbackNames[index] || `${category.singular} ${index + 1}`,
      distance,
      type: category.type,
      lat,
      lng
    };
  }).sort((a, b) => a.distance - b.distance);
}

function updateServiceMarkers(services) {
  if (!dashboardMap) return;

  dashboardServiceMarkers.forEach(marker => dashboardMap.removeLayer(marker));
  dashboardServiceMarkers = [];

  const entry = safeTrailMaps['dashboardMap'];
  if (entry) {
    entry.markers = entry.markers.filter(marker => dashboardMap.hasLayer(marker));
  }

  services.forEach(service => {
    const marker = addServiceMarker('dashboardMap', service.lat, service.lng, service);
    if (marker) dashboardServiceMarkers.push(marker);
  });
}

function clearActiveServiceRoute() {
  if (activeServiceRoute && dashboardMap) {
    dashboardMap.removeLayer(activeServiceRoute);
    activeServiceRoute = null;
    dashboardMap.closePopup();
  }

  setActiveServiceCard(null);
}

async function loadDashboardSosPhrase() {
  const phraseEl = document.getElementById('dashboardSosPhrase');
  if (!phraseEl) return;

  try {
    const result = await fetchWithAuth('/auth/me');
    const phrase = result?.user?.sosPhrase || [
      result?.user?.sosPhraseWord1,
      result?.user?.sosPhraseWord2
    ].filter(Boolean).join(' ');

    phraseEl.textContent = phrase || 'Not available';
  } catch (error) {
    console.error('Dashboard SOS phrase error:', error);
    phraseEl.textContent = 'Not available';
  }
}

async function navigateToService(service, card) {
  if (!dashboardMap || !service) return;

  setActiveServiceCard(card);
  const summary = card?.querySelector('[data-route-summary]');
  if (summary) summary.textContent = 'Calculating route...';
  showToast(`Calculating route to ${service.name}`);

  const destination = { lat: Number(service.lat), lng: Number(service.lng) };

  try {
    const route = await fetchServiceRoute(currentLocation, destination);
    drawServiceRoute(route.coordinates, service, route.distanceKm, route.durationMin);
    if (summary) summary.textContent = `${route.distanceKm} km - ${route.durationMin} min`;
    showToast(`${service.name}: ${route.distanceKm} km, ${route.durationMin} min`);
  } catch (error) {
    console.error('Service route error:', error);
    const fallback = buildDirectServiceRoute(currentLocation, destination);
    drawServiceRoute(fallback.coordinates, service, fallback.distanceKm, fallback.durationMin);
    if (summary) summary.textContent = `${fallback.distanceKm} km - about ${fallback.durationMin} min`;
    showToast(`Showing direct route to ${service.name}`);
  }
}

async function fetchServiceRoute(start, end) {
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson'
  });
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.routes?.length) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: Number((route.distance / 1000).toFixed(1)),
    durationMin: Math.max(1, Math.round(route.duration / 60))
  };
}

function drawServiceRoute(coordinates, service, distanceKm, durationMin) {
  if (activeServiceRoute) {
    dashboardMap.removeLayer(activeServiceRoute);
  }

  activeServiceRoute = L.polyline(coordinates, {
    color: '#2563eb',
    weight: 5,
    opacity: 0.8
  }).addTo(dashboardMap);

  const destination = coordinates[coordinates.length - 1];
  L.popup()
    .setLatLng(destination)
    .setContent(`<b>${escapeHtml(service.name)}</b><br><small>${distanceKm} km - ${durationMin} min</small>`)
    .openOn(dashboardMap);

  dashboardMap.fitBounds(activeServiceRoute.getBounds(), { padding: [50, 50] });
}

function buildDirectServiceRoute(start, end) {
  const distanceKm = Number((getDistanceMeters(start, end) / 1000).toFixed(1));
  const durationMin = Math.max(1, Math.round((distanceKm / 25) * 60));

  return {
    coordinates: [
      [start.lat, start.lng],
      [end.lat, end.lng]
    ],
    distanceKm,
    durationMin
  };
}

function setActiveServiceCard(activeCard) {
  document.querySelectorAll('.service-item').forEach(card => {
    card.classList.toggle('active', card === activeCard);
  });
}

function startLocationTracking() {
  if (!navigator.geolocation) return;

  navigator.geolocation.watchPosition(
    async position => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      const locationText = document.getElementById('currentLocationText');
      if (locationText) locationText.textContent = 'Finding location...';

      if (userMarker && dashboardMap) {
        userMarker.setLatLng([currentLocation.lat, currentLocation.lng]);
      }

      currentLocationName = await getLocationName(currentLocation);
      if (locationText) locationText.textContent = currentLocationName;
      if (userMarker) userMarker.bindPopup(currentLocationName);

      const socket = initSocket();
      if (socket) {
        socket.emit('locationUpdate', {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          timestamp: new Date().toISOString()
        });
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 0 }
  );
}

async function getLocationName(location) {
  const now = Date.now();
  const movedEnough = !lastReverseGeocode.lat || getDistanceMeters(lastReverseGeocode, location) > 100;
  const canRefresh = now - lastReverseGeocode.time > 30000;

  if (!movedEnough && currentLocationName) return currentLocationName;
  if (!canRefresh && currentLocationName) return currentLocationName;

  try {
    lastReverseGeocode = { ...location, time: now };
    const params = new URLSearchParams({
      format: 'json',
      lat: String(location.lat),
      lon: String(location.lng),
      zoom: '18',
      addressdetails: '1'
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await response.json();
    return formatLocationName(data) || currentLocationName || 'Current Location';
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return currentLocationName || 'Current Location';
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

function getDistanceMeters(start, end) {
  const earthRadius = 6371000;
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  const deltaLat = (end.lat - start.lat) * Math.PI / 180;
  const deltaLng = (end.lng - start.lng) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'sos-toast success';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-info-circle"></i>
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

window.navigateToService = navigateToService;
