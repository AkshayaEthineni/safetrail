const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Incident = require('../models/Incident');
const Journey = require('../models/Journey');
const { protect, authorize } = require('../middleware/auth');

router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalIncidents = await Incident.countDocuments();
    const geoFenceAlerts = await Incident.countDocuments({ type: 'auto_detected' });
    const responseTimes = await Incident.aggregate([
      { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
      { $project: { minutes: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60] } } },
      { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } }
    ]);
    res.json({ success: true, stats: { totalUsers, totalIncidents, geoFenceAlerts, averageResponseTime: responseTimes[0]?.avgMinutes ? Number(responseTimes[0].avgMinutes.toFixed(1)) : 0 } });
  } catch (error) {
    console.error('Analytics stats error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching analytics stats' });
  }
});

router.get('/charts', protect, authorize('admin'), async (req, res) => {
  try {
    const today = new Date();
    const last7 = new Date();
    last7.setDate(today.getDate() - 6);
    const sosEvents = await Incident.aggregate([
      { $match: { createdAt: { $gte: last7 } } },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: 1 } },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const userTypeDistribution = await User.aggregate([
      { $group: { _id: '$touristType', count: { $sum: 1 } } }
    ]);
    const incidentTypes = await Incident.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const safetyTrends = await Journey.aggregate([
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } }, safetyScore: 1 } },
      { $group: { _id: '$day', avgScore: { $avg: '$safetyScore' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, charts: { sosEvents, userTypeDistribution, incidentTypes, safetyTrends } });
  } catch (error) {
    console.error('Analytics charts error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching analytics charts' });
  }
});

router.get('/activity', protect, authorize('admin'), async (req, res) => {
  try {
    const recentIncidents = await Incident.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'name');
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10).select('name touristType createdAt');
    const activity = [];
    recentIncidents.forEach((incident) => {
      activity.push({ type: incident.type, userName: incident.userId?.name || 'Unknown', timestamp: incident.createdAt, description: `${incident.type.replace('_', ' ')} reported`, status: incident.status });
    });
    recentUsers.forEach((user) => {
      activity.push({ type: 'registration', userName: user.name, timestamp: user.createdAt, description: `New ${user.touristType} registration`, status: 'new' });
    });
    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, activity: activity.slice(0, 20) });
  } catch (error) {
    console.error('Analytics activity error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching activity feed' });
  }
});

module.exports = router;
