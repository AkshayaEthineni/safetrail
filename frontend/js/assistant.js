const appendChatMessage = (message, type = 'assistant', isHTML = false) => {
  const chatArea = document.getElementById('chatArea') || document.querySelector('.chat-messages');
  if (!chatArea) return;

  const wrapper = document.createElement('div');
  wrapper.className = `message ${type === 'user' ? 'user-message' : 'bot-message'}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (isHTML) {
    bubble.innerHTML = message;
  } else {
    bubble.textContent = message;
  }

  wrapper.appendChild(bubble);
  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;
};

const postAssistantRequest = async (text) => {
  const result = await fetchWithAuth('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message: text })
  });

  if (!result.success) {
    return { success: false, message: result.message || 'Unable to process your request.' };
  }

  return result;
};

const sendAssistantMessage = async () => {
  const input = document.getElementById('messageInput') || document.getElementById('assistantInput') || document.querySelector('.message-input');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  appendChatMessage(text, 'user');
  input.value = '';

  try {
    const result = await postAssistantRequest(text);

    if (!result.success) {
      appendChatMessage(result.message || 'Unable to process your request.', 'assistant');
      return;
    }

    const reply = result.response || result.text || 'No response';
    appendChatMessage(reply, 'assistant');

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  } catch (error) {
    console.error('Send error:', error);
    appendChatMessage('Connection error. Please try again.', 'assistant');
  }
};

const setupQuickActions = () => {
  const actions = {
    hospital: '🏥 Where is the nearest hospital?',
    police: '👮 Where is the nearest police station?',
    route: '🗺️ Suggest a safe route to my destination',
    women: '👩‍🦰 Women safety tips for travelling alone',
    emergency: '🚨 What should I do in an emergency?',
    unsafe: '⚠️ What areas should I avoid?'
  };

  Object.entries(actions).forEach(([action, text]) => {
    const btn = document.querySelector(`[data-action="${action}"]`);
    if (btn) {
      btn.addEventListener('click', () => {
        const input = document.getElementById('messageInput') || document.getElementById('assistantInput') || document.querySelector('.message-input');
        if (input) input.value = text;
        sendAssistantMessage();
      });
    }
  });
};

const setupSendButton = () => {
  const sendBtn = document.getElementById('sendBtn') ||
                  document.querySelector('[data-send-btn]') ||
                  document.querySelector('.send-btn') ||
                  document.querySelector('button.send');

  if (sendBtn) {
    sendBtn.addEventListener('click', sendAssistantMessage);
  }

  const input = document.getElementById('messageInput') || document.getElementById('assistantInput') || document.querySelector('.message-input');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendAssistantMessage();
      }
    });
  }
};

const setupVoiceInput = () => {
  const voiceBtn = document.getElementById('voiceBtn') ||
                   document.querySelector('[data-voice-btn]') ||
                   document.querySelector('.voice-btn');

  if (!voiceBtn || !('webkitSpeechRecognition' in window)) return;

  const recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';

  voiceBtn.addEventListener('click', () => {
    recognition.start();
    voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Listening...';
  });

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');

    const input = document.getElementById('messageInput') || document.getElementById('assistantInput') || document.querySelector('.message-input');
    if (input) input.value = transcript;
    voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    sendAssistantMessage();
  };

  recognition.onerror = () => {
    voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
  };
};

window.addEventListener('DOMContentLoaded', () => {
  const chatArea = document.getElementById('chatArea');
  if (chatArea) chatArea.innerHTML = '';

  setupSendButton();
  setupQuickActions();
  setupVoiceInput();

  appendChatMessage('👋 Hi! I\'m your SafeTrail AI Assistant. I can help you with safe routes, emergency info, and travel safety tips. How can I help you today?', 'assistant');
});

window.sendAssistantMessage = sendAssistantMessage;
