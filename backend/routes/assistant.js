const express = require('express');
const axios = require('axios');
const router = express.Router();
const { protect } = require('../middleware/auth');

const simulatedResponse = (message) => {
  const normalized = message.toLowerCase();

  if (/\b(hi|hello|hey|good morning|good evening|good afternoon)\b/.test(normalized)) {
    return 'Hello! I am your SafeTrail safety assistant. Ask me about safe routes, nearby help, or what to do in an emergency.';
  }

  if (/\b(thank|thanks|appreciate)\b/.test(normalized)) {
    return 'You are welcome! Stay safe and let me know if you need anything related to travel safety or routes.';
  }

  if (normalized.includes('hospital')) {
    return 'The nearest hospital is Government Hospital, 3.1 km away. Follow the main road and keep your location shared with someone you trust.';
  }

  if (normalized.includes('police')) {
    return 'A police station is 1.2 km away near the main square. Stay on well-lit roads and head there directly if you need support.';
  }

  if (normalized.includes('safe route') || normalized.includes('route') || normalized.includes('navigate') || normalized.includes('direction') || normalized.includes('directions')) {
    return 'The safest route is via the city park and main avenue. It is a little longer but has better visibility, lighting, and public coverage.';
  }

  if (normalized.includes('avoid') || normalized.includes('unsafe') || normalized.includes('danger')) {
    return 'Avoid dark alleyways, isolated parks after sunset, and quiet backstreets. Stick to main roads with more people around.';
  }

  if (normalized.includes('women safety') || normalized.includes('women') || normalized.includes('female')) {
    return 'Travel on well-lit streets, keep your phone ready, stay near public transport hubs, and tell a trusted contact about your plans.';
  }

  if (normalized.includes('emergency') || normalized.includes('help') || normalized.includes('sos')) {
    return 'In an emergency, call local authorities immediately and move to a safe, well-lit public area. Share your location with someone you trust.';
  }

  if (normalized.includes('nearest') || normalized.includes('nearby')) {
    return 'I can help with nearby safety resources like hospitals, police stations, and safe routes. Please ask for one of those services.';
  }

  if (/\b(movie|sports|game|music|news|stock|politics|restaurant|food|shopping|fashion|celebrity)\b/.test(normalized)) {
    return 'I am focused on travel safety, emergency support, and safe route advice. Please ask me about those topics.';
  }

  return 'I specialize in safety and route guidance. Ask me about safe travel, nearby help, or what to do in an emergency.';
};

const generateGeminiResponse = async (message) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const payload = {
    prompt: {
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are SafeTrail AI Assistant. Help tourists with travel safety, route advice, emergency information, and local safety guidance. Keep responses practical, concise, and focused on safety. If the question is unrelated to safety or travel, politely explain that you only answer travel safety and emergency related questions.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: message }
          ]
        }
      ]
    },
    temperature: 0.7,
    maxOutputTokens: 300
  };

  const url = `https://generativelanguage.googleapis.com/v1beta2/models/gemini-1.0:generate?key=${apiKey}`;
  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const candidate = response.data?.candidates?.[0];
  if (!candidate) return null;

  if (Array.isArray(candidate.content)) {
    return candidate.content.map(part => part.text || '').join(' ').trim();
  }

  return candidate.text || null;
};

router.post('/chat', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const geminiResponse = await generateGeminiResponse(message).catch((error) => {
      console.error('Gemini API error:', error?.message || error);
      return null;
    });

    if (geminiResponse) {
      return res.json({ success: true, response: geminiResponse });
    }

    return res.json({ success: true, response: simulatedResponse(message) });
  } catch (error) {
    console.error('Assistant error:', error.message);
    res.json({ success: true, response: simulatedResponse(req.body.message || '') });
  }
});

router.post('/voice', protect, async (req, res) => {
  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ success: false, message: 'No audio file provided' });
    }

    const audioFile = req.files.audio;
    const transcript = req.body.transcript || '';
    
    // For now, treat the audio as a text message would be
    // In a real app, you could:
    // 1. Save the audio file to storage
    // 2. Use a speech-to-text service to convert audio to text
    // 3. Process the resulting text through the AI assistant

    // Simulated response
    const response = simulatedResponse(transcript || 'User sent a voice message');
    
    res.json({ 
      success: true, 
      response: response,
      message: 'Voice message received'
    });
  } catch (error) {
    console.error('Voice message error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process voice message: ' + error.message 
    });
  }
});

module.exports = router;
