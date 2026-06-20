const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateSOSPhrase = () => {
  const colors = ['Blue', 'Red', 'Green', 'Gold', 'Silver', 'Dark', 'Bright', 'White', 'Black', 'Orange'];
  const nature = ['River', 'Stone', 'Moon', 'Cloud', 'Lake', 'Forest', 'Hill', 'Wind', 'Fire', 'Rain', 'Star', 'Rock', 'Wave', 'Tree', 'Sand'];
  const word1 = colors[Math.floor(Math.random() * colors.length)];
  const word2 = nature[Math.floor(Math.random() * nature.length)];
  return `${word1} ${word2}`;
};

const generateUniqueSOSPhrase = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const phrase = generateSOSPhrase();
    const [word1, word2] = phrase.split(' ');
    const existingUser = await User.findOne({ sosPhraseWord1: word1, sosPhraseWord2: word2 });
    if (!existingUser) return phrase;
  }

  throw new Error('Unable to generate a unique SOS phrase');
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      touristType,
      womenSafetyMode
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'Please complete all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const sosPhrase = await generateUniqueSOSPhrase();

    const user = await User.create({
      name,
      email,
      password,
      phone,
      emergencyContact: {
        name: emergencyContactName || '',
        phone: emergencyContactPhone || ''
      },
      touristType: touristType || 'solo',
      womenSafetyMode: womenSafetyMode === true || womenSafetyMode === 'true',
      sosPhraseWord1: sosPhrase.split(' ')[0],
      sosPhraseWord2: sosPhrase.split(' ')[1]
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        touristType: user.touristType,
        womenSafetyMode: user.womenSafetyMode,
        role: user.role
      },
      sosPhrase
    });
  } catch (error) {
    console.error('Register error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        touristType: user.touristType,
        womenSafetyMode: user.womenSafetyMode,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user.toObject ? req.user.toObject() : req.user;
    res.json({
      success: true,
      user: {
        ...user,
        sosPhrase: [user.sosPhraseWord1, user.sosPhraseWord2].filter(Boolean).join(' ')
      }
    });
  } catch (error) {
    console.error('Auth me error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
