const API_BASE = ['127.0.0.1:5501', 'localhost:5501'].includes(window.location.host)
  ? 'http://127.0.0.1:5000/api'
  : '/api';
const STORAGE_TOKEN = 'safetrail_token';
const STORAGE_USER = 'safetrail_user';

const getToken = () => localStorage.getItem(STORAGE_TOKEN);
const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null');
  } catch (error) {
    return null;
  }
};

const setAuthData = (token, user) => {
  localStorage.setItem(STORAGE_TOKEN, token);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
};

const clearAuth = () => {
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_USER);
};

const fetchWithAuth = async (path, options = {}) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const text = await response.text();
  if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    clearAuth();
    if (!window.location.pathname.toLowerCase().endsWith('login.html')) {
      window.location.href = 'login.html';
    }
    return { success: false, message: 'Session expired. Please login again.' };
  }
  if (!response.ok) {
    try {
      const errorData = JSON.parse(text);
      return { success: false, message: errorData.message || `Request failed with status ${response.status}` };
    } catch (error) {
      console.error('API error response:', response.status, text);
      return { success: false, message: `Request failed with status ${response.status}` };
    }
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Invalid JSON response from API:', text);
    return { success: false, message: 'Server returned invalid response. Please refresh and try again.' };
  }
};

const showAlert = (message, type = 'error', target = null) => {
  const alert = target || document.getElementById('alertBox');
  if (!alert) return;
  alert.textContent = message;
  alert.className = `alert-box ${type}`;
  alert.style.display = 'block';
};

const hideAlert = (target = null) => {
  const alert = target || document.getElementById('alertBox');
  if (!alert) return;
  alert.style.display = 'none';
};

const handleLogout = () => {
  clearAuth();
  window.location.replace('login.html');
};

const populateNavUser = () => {
  const user = getStoredUser();
  if (!user) return;

  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.textContent = user.name || 'User';

  const userRoleEl = document.getElementById('userRole');
  if (userRoleEl) userRoleEl.textContent = user.role || 'Tourist';
};

const authGuard = () => {
  const token = getToken();
  const user = getStoredUser();
  const path = window.location.pathname.toLowerCase();
  const isAuthPage = path.endsWith('login.html') || path.endsWith('register.html') || path.endsWith('index.html') || path.endsWith('/');
  
  // Redirect unauthenticated users to login
  if (!token && !isAuthPage) {
    window.location.href = 'login.html';
    return;
  }
  
  // Redirect authenticated users away from auth pages
  if (token && (path.endsWith('login.html') || path.endsWith('register.html'))) {
    const redirectMap = {
      'tourist': 'dashboard.html',
      'operator': 'emergency.html',
      'admin': 'emergency.html'
    };
    window.location.href = redirectMap[user?.role] || 'dashboard.html';
    return;
  }
  
  // Check page-specific access control
  if (token && user) {
    if (path.endsWith('emergency.html') && !['operator', 'admin'].includes(user.role)) {
      window.location.href = 'dashboard.html';
      return;
    }
    if (path.endsWith('analytics.html')) {
      window.location.href = ['operator', 'admin'].includes(user.role) ? 'emergency.html' : 'dashboard.html';
      return;
    }
  }
  
  populateNavUser();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', handleLogout);
  }
};

const initializeLogin = () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    try {
      const { success, token, user, message } = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!success) {
        return showAlert(message || 'Unable to login');
      }
      setAuthData(token, user);
      // Role-based redirect
      const redirectMap = {
        'tourist': 'dashboard.html',
        'operator': 'emergency.html',
        'admin': 'emergency.html'
      };
      const redirectPath = redirectMap[user.role] || 'dashboard.html';
      window.location.href = redirectPath;
    } catch (error) {
      console.error('Login fetch error:', error);
      showAlert(error?.message || 'Network error while logging in');
    }
  });
};

const initializeRegister = () => {
  const registerForm = document.getElementById('registerForm');
  const sosCard = document.getElementById('sosPhraseCard');
  const sosPhrase = document.getElementById('sosPhrase');
  const continueBtn = document.getElementById('phraseContinue');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value.trim();
    const emergencyContactName = document.getElementById('emergencyContactName').value.trim();
    const emergencyContactPhone = document.getElementById('emergencyContactPhone').value.trim();
    const touristType = document.querySelector('input[name="touristType"]:checked')?.value || 'solo';
    const womenSafetyMode = document.getElementById('womenSafetyMode').checked;

    try {
      const { success, token, user, message, sosPhrase: phrase } = await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password, emergencyContactName, emergencyContactPhone, touristType, womenSafetyMode }),
      });
      if (!success) {
        return showAlert(message || 'Registration failed');
      }
      setAuthData(token, user);
      if (phrase) {
        if (sosPhrase) sosPhrase.textContent = phrase;
        if (sosCard) sosCard.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        window.location.href = 'dashboard.html';
      }
    } catch (error) {
      console.error('Register fetch error:', error);
      showAlert(error?.message || 'Network error while registering');
    }
  });

  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  authGuard();
  initializeLogin();
  initializeRegister();
});

window.API_BASE = API_BASE;
window.fetchWithAuth = fetchWithAuth;
window.getToken = getToken;
window.getStoredUser = getStoredUser;
window.clearAuth = clearAuth;
window.handleLogout = handleLogout;
window.authGuard = authGuard;
window.showAlert = showAlert;
window.hideAlert = hideAlert;
window.populateNavUser = populateNavUser;
