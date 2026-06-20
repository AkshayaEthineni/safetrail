const mongoose = require('mongoose');

const journeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startLocation: {
    label: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number }
  },
  endLocation: {
    label: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number }
  },
  selectedRoute: { type: String, required: true },
  safetyScore: { type: Number, default: 0 },
  distanceKm: { type: Number, default: 0 },
  durationMin: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  waypoints: [
    {
      lat: Number,
      lng: Number,
      timestamp: Date
    }
  ]
});

module.exports = mongoose.model('Journey', journeySchema);
