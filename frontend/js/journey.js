let map;
let currentMarker;
let destinationMarker;
let routePolyline;
let selectedRoute = null;
let currentLocation = { lat: 17.385, lng: 78.4867 };
let activeJourney = null;
let routeOptions = [];
let destinationLabel = '';
let selectedDestinationPlace = null;
let destinationSuggestionTimer = null;
let destinationSuggestionRequest = 0;
let currentLocationName = 'Current Location';
let journeyVoiceRecognition = null;
let journeyVoiceListening = false;
let journeyVoiceSOSSent = false;
let journeyVoiceRestartEnabled = false;
let journeySecretPhrase = '';

const routeColors = ['#22c55e', '#f59e0b', '#ef4444'];

const routeLabelMap = {
  safest: { label: 'Safest', badge: 'safe-badge' },
  balanced: { label: 'Balanced', badge: 'medium-badge' },
  fastest: { label: 'Fastest', badge: 'risk-badge' }
};

document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  initializeGPS();
  initializeEvents();
});

function initializeMap() {
  if (map) map.remove();

  const placeholder = document.querySelector('#map .map-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  map = L.map('map').setView([currentLocation.lat, currentLocation.lng], 15);
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

  currentMarker = L.marker([currentLocation.lat, currentLocation.lng], { icon: blueIcon })
    .addTo(map)
    .bindPopup('Your Location');
}

function initializeGPS() {
  if (!navigator.geolocation) {
    showStatus('GPS not supported');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      const currentLocationInput = document.getElementById('currentLocationInput');
      if (currentLocationInput) currentLocationInput.value = 'Finding your location...';
      updateCurrentLocationMarker();
      map.setView([currentLocation.lat, currentLocation.lng], 15);
      currentLocationName = await getLocationName(currentLocation);
      if (currentLocationInput) currentLocationInput.value = currentLocationName;
      if (currentMarker) currentMarker.bindPopup(currentLocationName);
    },
    () => {
      showStatus('GPS access denied. Using default location.');
    }
  );
}

function initializeEvents() {
  const analyzeBtn = document.getElementById('analyzeRoutesBtn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeRoutes);

  const startBtn = document.getElementById('startJourneyBtn');
  if (startBtn) startBtn.addEventListener('click', startJourney);

  initializeDestinationSuggestions();
}

async function analyzeRoutes() {
  const destination = document.getElementById('destinationInput')?.value.trim() || '';
  if (!destination) {
    showStatus('Please enter destination');
    return;
  }
  destinationLabel = selectedDestinationPlace?.display_name || destination;

  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }

  showStatus('Finding destination and estimating routes...');

  try {
    const geocodeData = selectedDestinationPlace
      ? [selectedDestinationPlace]
      : await searchPlaces(destination, 1);

    if (!Array.isArray(geocodeData) || geocodeData.length === 0) {
      showStatus('Destination not found. Try another address or place name.');
      return;
    }

    const destinationCoords = {
      lat: parseFloat(geocodeData[0].lat),
      lng: parseFloat(geocodeData[0].lon)
    };

    if (destinationMarker) map.removeLayer(destinationMarker);

    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41]
    });

    destinationMarker = L.marker([destinationCoords.lat, destinationCoords.lng], { icon: redIcon })
      .addTo(map)
      .bindPopup(destinationLabel);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${destinationCoords.lng},${destinationCoords.lat}?alternatives=true&overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      showStatus('Unable to estimate a driving route. Please try a different destination.');
      return;
    }

    routeOptions = data.routes.slice(0, 3).map((route, idx) => {
      const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
      const durationMin = Math.round(route.duration / 60);
      const score = Math.round(Math.max(55, Math.min(95, 95 - distanceKm * 1.3 - durationMin * 0.3 + idx * 3)));

      return {
        rawIndex: idx,
        name: `Route ${String.fromCharCode(65 + idx)}`,
        score,
        eta: durationMin,
        distance: distanceKm,
        color: routeColors[idx] || '#34d399',
        geometry: route.geometry.coordinates,
        durationSec: route.duration,
        destinationCoords
      };
    });

    routeOptions = classifyRouteOptions(routeOptions);

    renderRoutes(routeOptions);
    const preference = document.querySelector('input[name="routePreference"]:checked')?.value || 'Safest';
    const preferredIndex = Math.max(0, routeOptions.findIndex(route => route.label === preference));
    selectAndDrawRoute(preferredIndex, routeOptions[preferredIndex] || routeOptions[0]);
    map.fitBounds([ [currentLocation.lat, currentLocation.lng], [destinationCoords.lat, destinationCoords.lng] ], { padding: [50, 50] });
    showStatus('Routes updated based on destination. Select a route to view it on the map.');
  } catch (error) {
    console.error('Analyze routes error:', error);
    showStatus('Error estimating routes. Check your network and try again.');
  }
}

function initializeDestinationSuggestions() {
  const input = document.getElementById('destinationInput');
  const suggestions = document.getElementById('destinationSuggestions');
  if (!input || !suggestions) return;

  input.addEventListener('input', () => {
    selectedDestinationPlace = null;
    window.clearTimeout(destinationSuggestionTimer);

    const query = input.value.trim();
    if (query.length < 3) {
      hideDestinationSuggestions();
      return;
    }

    destinationSuggestionTimer = window.setTimeout(() => {
      loadDestinationSuggestions(query);
    }, 300);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideDestinationSuggestions();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.destination-search')) hideDestinationSuggestions();
  });
}

async function loadDestinationSuggestions(query) {
  const requestId = ++destinationSuggestionRequest;
  const suggestions = document.getElementById('destinationSuggestions');
  if (!suggestions) return;

  try {
    const places = await searchPlaces(query, 6);
    if (requestId !== destinationSuggestionRequest) return;

    if (!places.length) {
      hideDestinationSuggestions();
      return;
    }

    suggestions.innerHTML = '';
    places.forEach(place => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'destination-suggestion';
      button.setAttribute('role', 'option');

      const title = getPlaceTitle(place);
      button.innerHTML = `
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(place.display_name || title)}</span>
      `;

      button.addEventListener('click', () => {
        selectedDestinationPlace = place;
        destinationLabel = place.display_name || title;
        const input = document.getElementById('destinationInput');
        if (input) input.value = title;
        hideDestinationSuggestions();
      });

      suggestions.appendChild(button);
    });

    suggestions.classList.add('show');
  } catch (error) {
    console.error('Destination suggestions error:', error);
    hideDestinationSuggestions();
  }
}

function hideDestinationSuggestions() {
  const suggestions = document.getElementById('destinationSuggestions');
  if (suggestions) {
    suggestions.classList.remove('show');
    suggestions.innerHTML = '';
  }
}

async function searchPlaces(query, limit = 5) {
  const viewbox = `${currentLocation.lng - 1},${currentLocation.lat + 1},${currentLocation.lng + 1},${currentLocation.lat - 1}`;
  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    q: query,
    viewbox,
    bounded: '0'
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { 'Accept-Language': 'en' }
  });
  return response.json();
}

function getPlaceTitle(place) {
  const address = place.address || {};
  return place.name
    || address.tourism
    || address.amenity
    || address.road
    || address.suburb
    || address.city
    || address.town
    || address.village
    || (place.display_name || '').split(',')[0]
    || 'Selected destination';
}

async function getLocationName(location) {
  try {
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
    return formatLocationName(data) || 'Current Location';
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return 'Current Location';
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function renderRoutes(routeData) {
  const container = document.getElementById('routesContainer');
  if (!container) return;

  container.innerHTML = '';

  routeData.forEach((route, idx) => {
    const card = document.createElement('div');
    card.className = `route-card ${idx === 0 ? 'selected' : ''}`;
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    const riskLevel = getRiskLevel(route.score);

    card.innerHTML = `
      <div class="route-top">
        <div>
          <h4>${route.label.toUpperCase()} ROUTE</h4>
          <p class="route-label ${route.badgeClass}">${route.name}</p>
        </div>
        <span class="safe-badge">${route.score}%</span>
      </div>
      <div class="route-metrics">
        <div><span>Safety Score</span><strong>${route.score}%</strong></div>
        <div><span>ETA</span><strong>${route.eta} min</strong></div>
        <div><span>Distance</span><strong>${route.distance} km</strong></div>
        <div><span>Risk Level</span><strong>${riskLevel}</strong></div>
      </div>
      <div class="route-description">${route.description}</div>
    `;

    card.addEventListener('click', () => {
      selectAndDrawRoute(idx, route);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectAndDrawRoute(idx, route);
      }
    });

    container.appendChild(card);
  });

  if (routeData.length > 0) updateRouteSummary(routeData[0]);
}

function selectAndDrawRoute(idx, route) {
  selectedRoute = route;

  document.querySelectorAll('.route-card').forEach((card, i) => {
    card.classList.toggle('selected', i === idx);
  });

  updateRouteSummary(selectedRoute);
  drawRoute(selectedRoute);
}

function classifyRouteOptions(options) {
  const safest = [...options].sort((a, b) => b.score - a.score)[0];
  const fastest = [...options].sort((a, b) => a.durationSec - b.durationSec)[0];
  const balanced = options.find(route => route !== safest && route !== fastest) || options[0];

  return options.map(route => {
    if (route === safest) {
      return {
        ...route,
        label: 'Safest',
        badgeClass: 'safe-badge',
        name: 'Safe Route',
        description: 'Higher public visibility and safer road conditions, ideal for cautious travel.'
      };
    }
    if (route === fastest) {
      return {
        ...route,
        label: 'Fastest',
        badgeClass: 'risk-badge',
        name: 'Fast Route',
        description: 'Shortest estimated travel time, but may include busier or more complex roads.'
      };
    }
    return {
      ...route,
      label: 'Balanced',
      badgeClass: 'medium-badge',
      name: 'Balanced Route',
      description: 'A compromise between speed and safety, suitable for everyday travel.'
    };
  });
}

function getRiskLevel(score) {
  if (score >= 85) return 'Low';
  if (score >= 70) return 'Medium';
  return 'High';
}

function updateRouteSummary(route) {
  const routeNameEl = document.getElementById('summaryRouteName');
  const etaEl = document.getElementById('summaryEta');
  const distanceEl = document.getElementById('summaryDistance');
  const safetyEl = document.getElementById('summarySafety');
  const statusEl = document.getElementById('voiceStatus');

  if (routeNameEl) routeNameEl.textContent = route ? `${route.label} Route` : '--';
  if (etaEl) etaEl.textContent = route ? `${route.eta} min` : '--';
  if (distanceEl) distanceEl.textContent = route ? `${route.distance} km` : '--';
  if (safetyEl) safetyEl.textContent = route ? `${route.score}%` : '--';
  if (statusEl && route) {
    statusEl.textContent = `${route.label} route selected with ${getRiskLevel(route.score).toLowerCase()} risk.`;
  }
}

async function drawRoute(route) {
  if (!destinationMarker) {
    showStatus('Please set a destination first');
    return;
  }

  const destLat = destinationMarker.getLatLng().lat;
  const destLng = destinationMarker.getLatLng().lng;

  const routeCoordinates = route.geometry
    ? route.geometry.map(coord => [coord[1], coord[0]])
    : null;

  if (routePolyline) map.removeLayer(routePolyline);

  if (routeCoordinates) {
    routePolyline = L.polyline(routeCoordinates, {
      color: route.color,
      weight: 5,
      opacity: 0.7
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
    showStatus(`${route.name} is displayed with ${route.distance} km and ${route.eta} min.`);
    return;
  }

  try {
    showStatus('Fetching route...');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      showStatus('Could not find route. Using direct path.');
      drawDirectRoute(route, currentLocation, { lat: destLat, lng: destLng });
      return;
    }

    const routeGeometry = data.routes[0].geometry;
    const routeCoords = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);

    routePolyline = L.polyline(routeCoords, {
      color: route.color,
      weight: 5,
      opacity: 0.7
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
    showStatus('Route ready!');
  } catch (error) {
    console.error('OSRM route error:', error);
    showStatus('Error fetching route. Using direct path.');
    drawDirectRoute(route, currentLocation, { lat: destLat, lng: destLng });
  }
}

function drawDirectRoute(route, start, end) {
  const routePoints = [
    [start.lat, start.lng],
    [end.lat, end.lng]
  ];

  if (routePolyline) map.removeLayer(routePolyline);

  routePolyline = L.polyline(routePoints, {
    color: route.color,
    weight: 5,
    opacity: 0.7
  }).addTo(map);

  map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
}

function updateCurrentLocationMarker() {
  if (currentMarker) map.removeLayer(currentMarker);

  const blueIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41]
  });

  currentMarker = L.marker([currentLocation.lat, currentLocation.lng], { icon: blueIcon })
    .addTo(map)
    .bindPopup('Your Location');
}

async function startJourney() {
  if (!selectedRoute) {
    showStatus('Please select a route first');
    return;
  }

  if (!destinationMarker) {
    showStatus('Please analyze routes first before previewing.');
    return;
  }

  try {
    const result = await fetchWithAuth('/journey/start', {
      method: 'POST',
      body: JSON.stringify({
        startLocation: {
          label: currentLocationName,
          lat: currentLocation.lat,
          lng: currentLocation.lng
        },
        endLocation: {
          label: destinationLabel || document.getElementById('destinationInput')?.value.trim() || 'Destination',
          lat: destinationMarker.getLatLng().lat,
          lng: destinationMarker.getLatLng().lng
        },
        selectedRoute: `${selectedRoute.label} Route`,
        safetyScore: selectedRoute.score,
        distanceKm: selectedRoute.distance,
        durationMin: selectedRoute.eta
      })
    });

    if (!result.success) {
      showStatus(result.message || 'Unable to start journey');
      return;
    }

    activeJourney = result.journey;
    drawRoute(selectedRoute);
    showStatus(`${selectedRoute.label} route journey started.`);
    startSecretPhraseVoiceDetection();
  } catch (error) {
    console.error('Start journey error:', error);
    showStatus('Error starting journey. Please try again.');
  }
}

async function startSecretPhraseVoiceDetection() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const statusEl = document.getElementById('voiceStatus');

  if (!SpeechRecognition) {
    if (statusEl) statusEl.textContent = 'Voice SOS is not supported in this browser.';
    showStatus('Voice SOS is not supported in this browser.');
    return;
  }

  if (journeyVoiceListening) {
    if (statusEl) statusEl.textContent = 'Voice SOS is already listening for your secret phrase.';
    return;
  }

  try {
    const authResult = await fetchWithAuth('/auth/me');
    const phrase = authResult?.user?.sosPhrase || [
      authResult?.user?.sosPhraseWord1,
      authResult?.user?.sosPhraseWord2
    ].filter(Boolean).join(' ');

    journeySecretPhrase = normalizeVoiceText(phrase);
    if (!journeySecretPhrase) {
      if (statusEl) statusEl.textContent = 'Secret phrase not found. Manual SOS is still available.';
      return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    journeyVoiceSOSSent = false;
    journeyVoiceRestartEnabled = true;
    journeyVoiceRecognition = new SpeechRecognition();
    journeyVoiceRecognition.lang = 'en-US';
    journeyVoiceRecognition.interimResults = true;
    journeyVoiceRecognition.maxAlternatives = 1;
    journeyVoiceRecognition.continuous = true;

    journeyVoiceRecognition.onstart = () => {
      journeyVoiceListening = true;
      if (statusEl) statusEl.textContent = 'Voice SOS active. Listening for your secret phrase.';
    };

    journeyVoiceRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(' ');

      if (normalizeVoiceText(transcript).includes(journeySecretPhrase)) {
        triggerVoiceSOS();
      }
    };

    journeyVoiceRecognition.onend = () => {
      journeyVoiceListening = false;
      if (journeyVoiceRestartEnabled && !journeyVoiceSOSSent && activeJourney) {
        window.setTimeout(() => {
          try {
            journeyVoiceRecognition?.start();
          } catch (error) {
            console.error('Voice SOS restart error:', error);
          }
        }, 800);
      }
    };

    journeyVoiceRecognition.onerror = (event) => {
      console.error('Voice SOS recognition error:', event);
      if (event.error === 'not-allowed' || event.error === 'permission-denied' || event.error === 'service-not-allowed') {
        journeyVoiceRestartEnabled = false;
      }
      if (statusEl) statusEl.textContent = 'Voice SOS paused. Check microphone permission.';
    };

    journeyVoiceRecognition.start();
  } catch (error) {
    console.error('Voice SOS start error:', error);
    if (statusEl) statusEl.textContent = 'Voice SOS could not start. Manual SOS is still available.';
    showStatus('Voice SOS could not start. Check microphone permission.');
  }
}

function normalizeVoiceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function triggerVoiceSOS() {
  if (journeyVoiceSOSSent) return;
  journeyVoiceSOSSent = true;
  journeyVoiceRestartEnabled = false;

  try {
    journeyVoiceRecognition?.stop();
  } catch (error) {
    console.error('Voice SOS stop error:', error);
  }

  const statusEl = document.getElementById('voiceStatus');
  if (statusEl) statusEl.textContent = 'Secret phrase detected. Sending SOS now.';
  showStatus('Secret phrase detected. Sending SOS now.');

  if (typeof triggerSOS === 'function') {
    triggerSOS({
      type: 'voice_sos',
      notes: 'Automatic voice SOS triggered by secret phrase during active journey'
    });
  }
}


function loadServices() {
  const container = document.getElementById('nearbyServices');
  if (!container) return;

  const services = [
    { icon: '🏥', name: 'Hospital' },
    { icon: '👮', name: 'Police' },
    { icon: '📞', name: 'Helpline' },
    { icon: '💊', name: 'Pharmacy' },
    { icon: '🔥', name: 'Fire Station' }
  ];

  container.innerHTML = '';

  services.forEach(service => {
    const btn = document.createElement('button');
    btn.className = 'service-btn';
    btn.innerHTML = `${service.icon} ${service.name}`;
    btn.addEventListener('click', () => showServiceRoute(service.name));
    container.appendChild(btn);
  });
}

function showServiceRoute(service) {
  const serviceCoords = {
    lat: currentLocation.lat + 0.008,
    lng: currentLocation.lng + 0.008
  };

  if (routePolyline) map.removeLayer(routePolyline);

  routePolyline = L.polyline([
    [currentLocation.lat, currentLocation.lng],
    [serviceCoords.lat, serviceCoords.lng]
  ], {
    color: '#14b8a6',
    weight: 5,
    opacity: 0.7
  }).addTo(map);

  map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  showStatus(`Navigation to ${service}`);
}

function showStatus(message) {
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

window.selectAndDrawRoute = selectAndDrawRoute;
