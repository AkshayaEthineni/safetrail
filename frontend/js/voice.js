const speakAssistant = async (message) => {
  if (!message) return;
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
};

const attachVoiceControls = () => {
  const micBtn = document.getElementById('micBtn');
  const input = document.getElementById('assistantInput');
  const status = document.getElementById('voiceStatus');
  if (!micBtn || !input) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.title = 'Voice input not supported in this browser';
    micBtn.disabled = true;
    if (status) status.textContent = 'Voice not supported';
    return;
  }

  let recognition = null;
  let isListening = false;

  const updateStatus = (text, isError = false) => {
    if (status) {
      status.textContent = text;
      status.style.color = isError ? 'var(--danger)' : 'var(--text-secondary)';
    }
  };

  micBtn.addEventListener('click', async () => {
    try {
      if (isListening) {
        recognition?.stop();
        return;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;

      recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('recording');
        updateStatus('Listening...');
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('')
          .trim();

        if (transcript) {
          input.value = transcript;
          updateStatus('Recognized: ' + transcript);
        }
      };

      recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('recording');
        if (input.value.trim()) {
          updateStatus('Sending voice text...');
          if (window.sendAssistantMessage) {
            window.sendAssistantMessage();
          } else {
            const sendBtn = document.getElementById('sendMessageBtn');
            if (sendBtn) sendBtn.click();
          }
        } else {
          updateStatus('No voice detected. Tap and speak again.', true);
        }
      };

      recognition.onerror = (e) => {
        isListening = false;
        micBtn.classList.remove('recording');
        const errorText = e.error || 'voice recognition failed';
        console.error('SpeechRecognition error:', e);
        if (errorText === 'not-allowed' || errorText === 'permission-denied') {
          updateStatus('Microphone permission denied', true);
          if (window.showAlert) window.showAlert('Please grant microphone permission to use voice.');
        } else {
          updateStatus('Voice recognition failed. Try again.', true);
          if (window.showAlert) window.showAlert('Voice recognition error: ' + errorText);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Voice start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        updateStatus('Microphone permission denied', true);
        if (window.showAlert) window.showAlert('Please grant microphone permission to use voice.');
      } else if (err.name === 'NotFoundError') {
        updateStatus('No microphone found', true);
        if (window.showAlert) window.showAlert('No microphone detected on this device.');
      } else {
        updateStatus('Voice not available', true);
        if (window.showAlert) window.showAlert(err.message || 'Voice recognition not available.');
      }
    }
  });
};

window.addEventListener('DOMContentLoaded', attachVoiceControls);
window.speakAssistant = speakAssistant;
