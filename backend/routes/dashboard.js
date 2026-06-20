const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Journey = require('../models/Journey');
const { computeSafetyScore, computeRiskLevel } = require('../utils/safetyScore');

router.get('/data', protect, async (req, res) => {
  try {
    const activeJourney = await Journey.findOne({ userId: req.user._id, status: 'active' }).sort({ startTime: -1 });
    const now = new Date();
    const safetyScore = computeSafetyScore({ date: now, isKnownSafeZone: true, womenSafetyMode: req.user.womenSafetyMode });
    const riskLevel = computeRiskLevel(safetyScore);
    const dashboardData = {
      user: {
        name: req.user.name,
        touristType: req.user.touristType,
        womenSafetyMode: req.user.womenSafetyMode,
        role: req.user.role
      },
      safetyScore,
      riskLevel,
      activeJourney: activeJourney ? activeJourney.selectedRoute : 'None',
      activeJourneyName: activeJourney ? activeJourney.selectedRoute : 'None',
      city: 'Hyderabad',
      nearbyServices: [
        { icon: '👮', name: 'Police Station', distance: 1.2, type: 'police', lat: 17.3833, lng: 78.4867 },
        { icon: '🏥', name: 'Government Hospital', distance: 3.1, type: 'hospital', lat: 17.3885, lng: 78.4899 },
        { icon: '👩‍💼', name: 'Women Helpline', distance: 5.5, type: 'helpline', lat: 17.3921, lng: 78.4822 },
        { icon: '☕', name: 'Safe Zone Cafe', distance: 0.8, type: 'safezone', lat: 17.3877, lng: 78.4854 },
        { icon: '🔥', name: 'Fire Station', distance: 2.4, type: 'fire', lat: 17.3910, lng: 78.4789 },
        { icon: '💊', name: 'Pharmacy', distance: 0.5, type: 'pharmacy', lat: 17.3844, lng: 78.4876 }
      ],
      status: {
        safeZonesActive: true,
        womenSafetyModeActive: req.user.womenSafetyMode
      }
    };
    res.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching dashboard data' });
  }
});

module.exports = router;
