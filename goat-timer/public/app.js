const elements = {
  joinModal: document.getElementById('joinModal'),
  joinForm: document.getElementById('joinForm'),
  nameInput: document.getElementById('nameInput'),
  notificationCheckbox: document.getElementById('notificationCheckbox'),
  copyLinkButton: document.getElementById('copyLinkButton'),
  workModeButton: document.getElementById('workModeButton'),
  breakModeButton: document.getElementById('breakModeButton'),
  timerTitle: document.getElementById('timerTitle'),
  timerDisplay: document.getElementById('timerDisplay'),
  toggleButton: document.getElementById('toggleButton'),
  toggleIcon: document.getElementById('toggleIcon'),
  toggleText: document.getElementById('toggleText'),
  resetButton: document.getElementById('resetButton'),
  durationForm: document.getElementById('durationForm'),
  workMinutesInput: document.getElementById('workMinutesInput'),
  breakMinutesInput: document.getElementById('breakMinutesInput'),
  participantsList: document.getElementById('participantsList'),
  participantCount: document.getElementById('participantCount'),
  roomCode: document.getElementById('roomCode'),
  toastRegion: document.getElementById('toastRegion')
};

const goatFaces = ['🐐', '🐏', '🌿', '🌼', '☁️'];
const generatedClientId = globalThis.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clientId = sessionStorage.getItem('capretta-client-id') || generatedClientId;
let currentState = null;
let roomId = getOrCreateRoomId();
let userName = localStorage.getItem('capretta-name') || '';
let notificationsEnabled = true;
let audioContext = null;
let eventSource = null;

sessionStorage.setItem('capretta-client-id', clientId);

function getOrCreateRoomId() {
  const url = new URL(window.location.href);
  let id = url.searchParams.get('room');
  if (!id) {
    id = `prato-${Math.random().toString(36).slice(2, 8)}`;
    url.searchParams.set('room', id);
    window.history.replaceState({}, '', url);
  }
  return id.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 48);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function computedRemaining(state) {
  if (!state) return 0;
  if (state.isRunning && state.endAt) {
    return Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000));
  }
  return state.remainingSeconds;
}

function renderState(state) {
  currentState = state;
  const isWork = state.mode === 'work';
  elements.workModeButton.classList.toggle('active', isWork);
  elements.breakModeButton.classList.toggle('active', !isWork);
  elements.timerTitle.textContent = isWork ? 'Sessione di lavoro' : 'Pausa soffice';
  elements.workMinutesInput.value = state.workMinutes;
  elements.breakMinutesInput.value = state.breakMinutes;
  elements.toggleIcon.textContent = state.isRunning ? 'Ⅱ' : '▶';
  elements.toggleText.textContent = state.isRunning ? 'Pausa' : 'Avvia';
  elements.timerDisplay.textContent = formatTime(computedRemaining(state));
  elements.roomCode.textContent = roomId;
  renderParticipants(state.participants || []);
}

function renderParticipants(participants) {
  elements.participantCount.textContent = participants.length;
  elements.participantsList.innerHTML = '';

  if (!participants.length) {
    elements.participantsList.innerHTML = '<p class="empty-room">Il prato è ancora vuoto 🌱</p>';
    return;
  }

  participants.forEach((participant, index) => {
    const row = document.createElement('div');
    row.className = 'participant';

    const avatar = document.createElement('span');
    avatar.className = 'participant-avatar';
    avatar.textContent = goatFaces[index % goatFaces.length];

    const name = document.createElement('span');
    name.className = 'participant-name';
    name.textContent = participant.name;

    row.append(avatar, name);
    if (participant.id === clientId) {
      const you = document.createElement('span');
      you.className = 'participant-you';
      you.textContent = 'tu';
      row.appendChild(you);
    }

    elements.participantsList.appendChild(row);
  });
}

function showToast(title, message, icon = '🐐') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const toastIcon = document.createElement('span');
  toastIcon.className = 'toast-icon';
  toastIcon.textContent = icon;
  const copy = document.createElement('div');
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  strong.textContent = title;
  small.textContent = message;
  copy.append(strong, small);
  toast.append(toastIcon, copy);
  elements.toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), 4300);
}

function browserNotification(title, body) {
  if (!notificationsEnabled || document.visibilityState === 'visible') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

async function requestNotificationPermission() {
  if (!notificationsEnabled || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.warn('Notification permission error:', error);
    }
  }
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext?.state === 'suspended') audioContext.resume();
}

function playTone(frequency, startTime, duration, gain = 0.13) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(0.0001, startTime);
  volume.gain.exponentialRampToValueAtTime(gain, startTime + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(volume);
  volume.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playJoinChime() {
  ensureAudioContext();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  playTone(659.25, now, 0.23, 0.08);
  playTone(783.99, now + 0.11, 0.28, 0.08);
}

function playFinishChime() {
  ensureAudioContext();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    playTone(frequency, now + index * 0.17, 0.42, 0.12);
  });
}

async function sendAction(action, extra = {}) {
  const response = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, roomId, clientId, ...extra })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'Operazione non riuscita');
  return data;
}

function connectToRoom() {
  if (eventSource) eventSource.close();
  const params = new URLSearchParams({ room: roomId, clientId, name: userName });
  eventSource = new EventSource(`/events?${params.toString()}`);

  eventSource.addEventListener('stateUpdated', event => renderState(JSON.parse(event.data)));
  eventSource.addEventListener('participantJoined', event => {
    const { name } = JSON.parse(event.data);
    playJoinChime();
    showToast('Nuova capretta!', `${name} è entrata nella stanza`, '🐐');
    browserNotification('Nuova capretta nella stanza', `${name} è appena entrata.`);
  });
  eventSource.addEventListener('participantLeft', event => {
    const { name } = JSON.parse(event.data);
    if (name) showToast('Capretta uscita', `${name} ha lasciato il prato`, '☁️');
  });
  eventSource.addEventListener('timerCompleted', event => {
    const { mode, state } = JSON.parse(event.data);
    renderState(state);
    playFinishChime();
    const title = mode === 'work' ? 'Lavoro completato!' : 'Pausa terminata!';
    const message = mode === 'work' ? 'Bravissima. Ora respira un po’ 🌿' : 'È tempo di tornare al focus 🌼';
    showToast(title, message, mode === 'work' ? '🎉' : '🌼');
    browserNotification(title, message);
  });
  eventSource.onopen = () => {
    elements.joinModal.classList.add('hidden');
  };
  eventSource.onerror = () => {
    if (eventSource.readyState === EventSource.CONNECTING) {
      showToast('Connessione instabile', 'Sto provando a riconnettermi…', '🌧️');
    }
  };
}

elements.joinForm.addEventListener('submit', async event => {
  event.preventDefault();
  userName = elements.nameInput.value.trim() || 'Capretta anonima';
  notificationsEnabled = elements.notificationCheckbox.checked;
  localStorage.setItem('capretta-name', userName);
  ensureAudioContext();
  await requestNotificationPermission();
  connectToRoom();
  showToast('Sei entrata nel prato', `Stanza: ${roomId}`, '🌿');
});

elements.copyLinkButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Link copiato', 'Mandalo alle altre caprette ✨', '🔗');
  } catch {
    window.prompt('Copia questo link:', window.location.href);
  }
});

elements.toggleButton.addEventListener('click', async () => {
  ensureAudioContext();
  try { await sendAction('toggleTimer'); } catch (error) { showToast('Errore', error.message, '🌧️'); }
});

elements.resetButton.addEventListener('click', async () => {
  try { await sendAction('resetTimer'); } catch (error) { showToast('Errore', error.message, '🌧️'); }
});

elements.workModeButton.addEventListener('click', async () => {
  try { await sendAction('changeMode', { mode: 'work' }); } catch (error) { showToast('Errore', error.message, '🌧️'); }
});

elements.breakModeButton.addEventListener('click', async () => {
  try { await sendAction('changeMode', { mode: 'break' }); } catch (error) { showToast('Errore', error.message, '🌧️'); }
});

elements.durationForm.addEventListener('submit', async event => {
  event.preventDefault();
  const workMinutes = Number(elements.workMinutesInput.value);
  const breakMinutes = Number(elements.breakMinutesInput.value);
  try {
    await sendAction('updateDurations', { workMinutes, breakMinutes });
    showToast('Tempi aggiornati', `${workMinutes} min lavoro · ${breakMinutes} min pausa`, '⏱️');
  } catch (error) {
    showToast('Errore', error.message, '🌧️');
  }
});

setInterval(() => {
  if (currentState?.isRunning) {
    elements.timerDisplay.textContent = formatTime(computedRemaining(currentState));
  }
}, 250);

if (userName) elements.nameInput.value = userName;
elements.roomCode.textContent = roomId;
setTimeout(() => elements.nameInput.focus(), 100);
