const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');
const { protect, authorize } = require('../middleware/auth');

router.get('/incidents', protect, authorize('operator', 'admin'), async (req, res) => {
  try {
    const incidents = await Incident.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone emergencyContact touristType womenSafetyMode');
    res.json({ success: true, incidents });
  } catch (error) {
    console.error('Emergency incidents error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching incidents' });
  }
});

router.patch('/incidents/:id/respond', protect, authorize('operator', 'admin'), async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id).populate('userId', 'name email phone emergencyContact touristType');
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    incident.status = 'responding';
    await incident.save();

    const io = req.app.get('io');
    io?.to(String(incident.userId._id)).emit('operatorResponding', {
      incidentId: incident._id,
      message: 'Emergency operator is responding to your SOS. Please stay where you are if it is safe.',
      operator: {
        id: req.user._id,
        name: req.user.name,
        phone: req.user.phone
      }
    });
    io?.emit('incidentUpdated', { incidentId: incident._id, status: incident.status });

    res.json({ success: true, incident });
  } catch (error) {
    console.error('Respond incident error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating incident' });
  }
});

router.patch('/incidents/:id/resolve', protect, authorize('operator', 'admin'), async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id).populate('userId', 'name email phone emergencyContact touristType');
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    await incident.save();

    const io = req.app.get('io');
    io?.to(String(incident.userId._id)).emit('incidentResolved', {
      incidentId: incident._id,
      message: 'Your SOS incident has been marked resolved by the emergency operator.'
    });
    io?.emit('incidentUpdated', { incidentId: incident._id, status: incident.status });

    res.json({ success: true, incident });
  } catch (error) {
    console.error('Resolve incident error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating incident' });
  }
});

module.exports = router;
