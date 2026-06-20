const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Incident = require('../models/Incident');

router.post('/create', protect, async (req, res) => {
  try {
    const { type, location, notes } = req.body;
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);

    if (!type || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Please provide incident type and location' });
    }

    const incident = await Incident.create({
      userId: req.user._id,
      type,
      location: { lat, lng },
      notes: notes || ''
    });

    const populatedIncident = await Incident.findById(incident._id)
      .populate('userId', 'name email phone emergencyContact touristType womenSafetyMode');

    const io = req.app.get('io');
    io?.emit('newIncident', {
      incidentId: populatedIncident._id,
      incident: populatedIncident,
      userId: req.user._id,
      touristName: populatedIncident.userId?.name,
      touristPhone: populatedIncident.userId?.phone,
      emergencyContact: populatedIncident.userId?.emergencyContact,
      type,
      location: populatedIncident.location
    });

    res.status(201).json({ success: true, incident: populatedIncident });
  } catch (error) {
    console.error('Create incident error:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating incident' });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const incidents = await Incident.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, incidents });
  } catch (error) {
    console.error('My incident error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching your incidents' });
  }
});

module.exports = router;
