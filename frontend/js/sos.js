let socket = null;

const initSocket = () => {
  if (!socket && window.io) {
    socket = io();
    socket.on('connect', () => {
      console.log('Socket connected');
      const user = typeof getStoredUser === 'function' ? getStoredUser() : null;
      const userId = user?.id || user?._id;
      if (userId) {
        socket.emit('join', { userId });
      }
    });
    socket.on('disconnect', () => console.log('Socket disconnected'));
  }
  return socket;
};

const showSOSModal = (onConfirm, onCancel) => {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'sos-modal-overlay';
  modal.innerHTML = `
    <div class="sos-modal-content">
      <div class="sos-modal-header">
        <h2>🚨 Emergency SOS</h2>
      </div>
      <div class="sos-modal-body">
        <p class="sos-warning">Are you in need of immediate help?</p>
        <p class="sos-info">This will alert emergency operators and your emergency contact immediately.</p>
        <div class="sos-details">
          <div>Your Location: <strong>Will be shared</strong></div>
          <div>Emergency Contact: <strong>Will be notified</strong></div>
          <div>Operator: <strong>Will respond</strong></div>
        </div>
      </div>
      <div class="sos-modal-footer">
        <button class="btn btn-outline sos-cancel">Cancel</button>
        <button class="btn btn-danger sos-confirm">Confirm SOS</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.sos-confirm').addEventListener('click', () => {
    document.body.removeChild(modal);
    onConfirm();
  });

  modal.querySelector('.sos-cancel').addEventListener('click', () => {
    document.body.removeChild(modal);
    if (onCancel) onCancel();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      if (onCancel) onCancel();
    }
  });
};

const triggerSOS = async (options = {}) => {
  const incidentType = options.type || 'manual_sos';
  const incidentNotes = options.notes || 'Manual SOS triggered by tourist';
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // Get current location
  getCurrentLocation((location) => {
    const incident = {
      type: incidentType,
      location: { lat: location.lat, lng: location.lng },
      notes: incidentNotes
    };

    // Send to backend
    fetchWithAuth('/incident/create', {
      method: 'POST',
      body: JSON.stringify(incident)
    }).then(response => {
      if (response.success) {
        // Emit via Socket.io
        if (!socket) initSocket();
        if (socket) {
          socket.emit('sosTriggered', {
            incidentId: response.incident._id,
            location: incident.location,
            type: incident.type,
            timestamp: new Date().toISOString()
          });
        }

        // Show success message
        showSOSSuccess();
      } else {
        showSOSError(response.message || 'Failed to send SOS');
      }
    }).catch(error => {
      console.error('SOS error:', error);
      showSOSError('Network error sending SOS');
    });
  });
};

const showSOSSuccess = () => {
  const toast = document.createElement('div');
  toast.className = 'sos-toast success';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-check-circle"></i>
      <span>SOS activated! Help is on the way.</span>
    </div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
};

const showSOSError = (message) => {
  const toast = document.createElement('div');
  toast.className = 'sos-toast error';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-exclamation-circle"></i>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
};

const emitSOS = async () => {
  showSOSModal(triggerSOS);
};

const attachSOSButton = () => {
  const sosButtons = document.querySelectorAll('[data-sos-trigger], #sosButton, .sos-button');
  sosButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      emitSOS();
    });
  });
};

window.addEventListener('DOMContentLoaded', () => {
  attachSOSButton();
});

window.emitSOS = emitSOS;
window.triggerSOS = triggerSOS;
window.initSocket = initSocket;
window.getSocket = () => socket;
