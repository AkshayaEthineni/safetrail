const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  touristType: {
    type: String,
    enum: ['solo', 'family', 'group', 'solo_woman', 'international'],
    default: 'solo'
  },
  womenSafetyMode: { type: Boolean, default: false },
  role: { type: String, enum: ['tourist', 'operator', 'admin'], default: 'tourist' },
  sosPhraseWord1: { type: String },
  sosPhraseWord2: { type: String },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
