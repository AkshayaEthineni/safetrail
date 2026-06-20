const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Journey = require('../models/Journey');

router.post('/start', protect, async (req, res) => {
  try {
    const { startLocation, endLocation, selectedRoute, safetyScore, distanceKm, durationMin } = req.body;
    if (!startLocation || !endLocation || !selectedRoute) {
      return res.status(400).json({ success: false, message: 'Please provide journey details' });
    }
    const journey = await Journey.create({
      userId: req.user._id,
      startLocation,
      endLocation,
      selectedRoute,
      safetyScore: safetyScore || 0,
      distanceKm: distanceKm || 0,
      durationMin: durationMin || 0,
      status: 'active'
    });
    res.status(201).json({ success: true, journey });
  } catch (error) {
    console.error('Start journey error:', error.message);
    res.status(500).json({ success: false, message: 'Server error starting journey' });
  }
});

router.get('/active', protect, async (req, res) => {
  try {
    const journey = await Journey.findOne({ userId: req.user._id, status: 'active' }).sort({ startTime: -1 });
    res.json({ success: true, journey });
  } catch (error) {
    console.error('Active journey error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching active journey' });
  }
});

router.patch('/:id/complete', protect, async (req, res) => {
  try {
    const journey = await Journey.findOne({ _id: req.params.id, userId: req.user._id });
    if (!journey) {
      return res.status(404).json({ success: false, message: 'Journey not found' });
    }
    journey.status = 'completed';
    journey.endTime = new Date();
    await journey.save();
    res.json({ success: true, journey });
  } catch (error) {
    console.error('Complete journey error:', error.message);
    res.status(500).json({ success: false, message: 'Server error completing journey' });
  }
});

module.exports = router;
