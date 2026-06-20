let charts = {};

const createChart = (ctx, type, data, options = {}) => {
  if (!ctx) return null;

  if (charts[ctx.id]) {
    charts[ctx.id].destroy();
  }

  charts[ctx.id] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options
    }
  });

  return charts[ctx.id];
};

const renderStatCards = (stats) => {
  const totalUsersEl = document.getElementById('totalUsers');
  const totalSOSEl = document.getElementById('totalSOS');
  const geoAlertsEl = document.getElementById('geoAlerts');
  const avgResponseEl = document.getElementById('avgResponse');

  if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
  if (totalSOSEl) totalSOSEl.textContent = stats.totalIncidents || 0;
  if (geoAlertsEl) geoAlertsEl.textContent = stats.geoFenceAlerts || 0;
  if (avgResponseEl) avgResponseEl.textContent = `${stats.averageResponseTime || 0} min`;
};

const renderActivityFeed = (items) => {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  if (!items.length) {
    feed.innerHTML = '<p style="color:#64748b;padding:12px 0;">No recent activity.</p>';
    return;
  }

  feed.innerHTML = items.map(item => `
    <div class="activity-event" style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <strong>${item.description || 'Activity'}</strong>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${item.userName || 'System'}</p>
        </div>
        <span style="font-size: 12px; color: #94a3b8;">${new Date(item.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  `).join('');
};

const buildCharts = (chartData) => {
  if (!chartData) return;

  const weeklyCtx = document.getElementById('weeklyChart');
  if (weeklyCtx && chartData.sosEvents) {
    const sosMap = chartData.sosEvents.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const weekLabels = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    createChart(weeklyCtx, 'bar', {
      labels: weekLabels,
      datasets: [{
        label: 'SOS Events',
        data: weekLabels.map(label => sosMap[label] || 0),
        backgroundColor: '#2563eb',
        borderRadius: 4
      }]
    });
  }

  const userTypeCtx = document.getElementById('userTypeChart');
  if (userTypeCtx && chartData.userTypeDistribution) {
    createChart(userTypeCtx, 'doughnut', {
      labels: chartData.userTypeDistribution.map(item => item._id || 'Unknown'),
      datasets: [{
        data: chartData.userTypeDistribution.map(item => item.count),
        backgroundColor: ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6']
      }]
    });
  }

  const incidentTypeCtx = document.getElementById('incidentTypeChart');
  if (incidentTypeCtx && chartData.incidentTypes) {
    createChart(incidentTypeCtx, 'pie', {
      labels: chartData.incidentTypes.map(item => item._id || 'Unknown'),
      datasets: [{
        data: chartData.incidentTypes.map(item => item.count),
        backgroundColor: ['#ef4444', '#f97316', '#facc15', '#10b981', '#0ea5e9']
      }]
    });
  }

  const scoreTrendCtx = document.getElementById('scoreTrendChart');
  if (scoreTrendCtx && chartData.safetyTrends) {
    createChart(scoreTrendCtx, 'line', {
      labels: chartData.safetyTrends.map(item => item._id),
      datasets: [{
        label: 'Avg Safety Score',
        data: chartData.safetyTrends.map(item => (item.avgScore || 0).toFixed(1)),
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    });
  }
};

const loadAnalytics = async () => {
  try {
    const [statsResult, chartResult, activityResult] = await Promise.all([
      fetchWithAuth('/analytics/stats'),
      fetchWithAuth('/analytics/charts'),
      fetchWithAuth('/analytics/activity')
    ]);

    if (statsResult.success) renderStatCards(statsResult.stats);
    if (chartResult.success) buildCharts(chartResult.charts);
    if (activityResult.success) renderActivityFeed(activityResult.activity || []);

    if (!statsResult.success && !chartResult.success && !activityResult.success) {
      throw new Error('Failed to load analytics data');
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
};

function initAnalyticsSocket() {
  const socket = initSocket();
  if (!socket || socket._analyticsBound) return;
  socket._analyticsBound = true;

  socket.on('newIncident', () => {
    loadAnalytics();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadAnalytics();
  initAnalyticsSocket();
});
