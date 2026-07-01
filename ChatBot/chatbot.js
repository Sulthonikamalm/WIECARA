/**
 * WIECARA PPKS - ARA Chatbot v4.0
 * 
 * Chatbot dengan fitur-fitur baru:
 * - Integrasi dengan ChatStorage untuk persistence terenkripsi
 * - Session continuity (lanjutkan chat sebelumnya)
 * - Context restoration dari localStorage
 * - Improved UX dengan session info
 * 
 * @package WIECARA_PPKS
 * @subpackage ChatBot
 */

(function () {
  "use strict";

  // ============================================
  // KONFIGURASI
  // ============================================
  const CONFIG = {
    apiEndpoint: "../api/chatbot/chat.php",
    logoUrl: new URL("assets/logo-ara.png", document.currentScript?.src || window.location.href).href,
    emergencyApiBase: new URL("../api/emergency/", document.currentScript?.src || window.location.href).href,
    emergencyPhone: "6282188467793",
    loadingDelay: 600,
    welcomeMessage: "Halo, aku ARA.\n\nKamu bisa cerita pelan-pelan di sini. Aku akan mendengarkan dan membantumu menemukan langkah yang aman.",
    continueMessage: "Hai lagi.\n\nAku masih ingat obrolan kita sebelumnya. Mau lanjutkan atau mulai dari awal?",
    enablePersistence: true,  // Aktifkan penyimpanan lokal
    autoRestoreSession: true  // Otomatis restore session sebelumnya
  };

  // Merge dengan config global jika ada
  if (window.CHATBOT_CONFIG) {
    Object.assign(CONFIG, window.CHATBOT_CONFIG);
  }

  function araAvatarMarkup() {
    return `
      <div class="message-avatar ara-avatar">
        <img src="${CONFIG.logoUrl}" alt="Logo ARA" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <span>ARA</span>
      </div>
    `;
  }

  // ============================================
  // STATE VARIABLES
  // ============================================
  let isOpen = false;
  let isTyping = false;
  let sessionActive = false;
  let sessionId = null;
  let hasRestoredSession = false;

  // Voice recording states
  let isRecording = false;
  let recognition = null;
  let voiceSupported = false;
  let chatRecordingStartTime = null;
  let chatTimerInterval = null;
  let shouldKeepRecording = false;
  let finalTranscriptAccumulated = '';
  let interimTranscript = '';

  // Conversation states
  let conversationHistory = [];
  let currentPhase = 'curhat';
  let currentTier = 0;
  let hesitationHandled = false;
  let locationWatchId = null;
  let lastKnownLocation = null;
  let locationPermissionState = 'unknown';
  let pendingSafetyCheck = null;
  let safetyCheckTimerId = null;
  let pendingLocationRefreshPromise = null;

  // ============================================
  // DOM ELEMENTS
  // ============================================
  let modalOverlay, chatMessages, chatMessagesContainer, chatInput, btnSendChat, typingIndicator;
  let chatInterfaceScreen;
  let btnVoiceInput, voiceRecordingMode, btnStopRecording, chatInputWrapper;
  let safetyLocationPanel, btnEnableSafetyLocation, safetyLocationStatus;

  // ============================================
  // UI TEMPLATE
  // ============================================
  const CHATBOT_UI_TEMPLATE = `
    <div class="chatbot-modal-overlay" id="chatbotModalOverlay">
        <div class="chatbot-modal">
            <div class="chatbot-screen chat-interface-screen" id="chatInterfaceScreen">
                <div class="chat-header">
                    <div class="chat-header-brand">
                        <div class="chat-header-logo">
                            <img src="${CONFIG.logoUrl}" alt="Logo ARA" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <span>ARA</span>
                        </div>
                        <div class="chat-header-info">
                            <h3 id="chatModeTitle">ARA</h3>
                            <p class="chat-mode-desc" id="chatModeDesc">Asisten Ruang Aman</p>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="btn-clear-chat" id="btnClearChat" title="Hapus Riwayat">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button class="btn-minimize-chat" id="btnMinimizeChat" title="Minimize">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button class="btn-close-chatbot" id="btnCloseChatbot2" onclick="AraChatbot.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div class="chat-messages-container" id="chatMessagesContainer">
                    <div class="chat-messages" id="chatMessages">
                    </div>

                    <div class="typing-indicator" id="typingIndicator">
                        <div class="typing-bubble">
                            <div class="typing-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="chat-input-area">
                    <div class="safety-location-panel" id="safetyLocationPanel">
                        <div class="safety-location-copy">
                            <strong>Mode Siaga Lokasi</strong>
                            <span id="safetyLocationStatus">Lokasi belum aktif. Dipakai hanya untuk kondisi darurat.</span>
                        </div>
                        <button type="button" class="btn-enable-location" id="btnEnableSafetyLocation">
                            Aktifkan
                        </button>
                    </div>

                    <div class="chat-input-wrapper" id="chatInputWrapper">
                        <button type="button" class="btn-voice-input" id="btnVoiceInput" title="Rekam suara">
                            <i class="fas fa-microphone"></i>
                        </button>

                        <input type="text" class="chat-input" id="chatInput" placeholder="Ketik pesan Anda..." autocomplete="off" />
                        <button class="btn-send-chat" id="btnSendChat" disabled>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>

                    <div class="voice-recording-mode" id="voiceRecordingMode">
                        <div class="recording-info">
                            <span class="recording-dot"></span>
                            <span class="recording-label">Merekam...</span>
                            <span class="recording-time" id="chatRecordingTimer">00:00</span>
                        </div>

                        <div class="live-transcript-preview" id="liveTranscriptPreview">
                            <span class="live-transcript-text placeholder" id="liveTranscriptText">Mulai berbicara...</span>
                        </div>

                        <div class="chat-waveform">
                            <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
                            <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
                        </div>

                        <button type="button" class="btn-stop-voice" id="btnStopRecording">
                            <i class="fas fa-check"></i>
                            <span>Selesai</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `;

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Inject UI template ke DOM
   */
  function injectChatbotUI() {
    if (!document.getElementById("chatbotModalOverlay")) {
      document.body.insertAdjacentHTML("beforeend", CHATBOT_UI_TEMPLATE);
    }
  }

  /**
   * Inisialisasi chatbot
   */
  async function init() {
    injectChatbotUI();

    // Ambil referensi DOM elements
    modalOverlay = document.getElementById("chatbotModalOverlay");
    chatInterfaceScreen = document.getElementById("chatInterfaceScreen");
    chatMessagesContainer = document.getElementById("chatMessagesContainer");
    chatMessages = document.getElementById("chatMessages");
    chatInput = document.getElementById("chatInput");
    btnSendChat = document.getElementById("btnSendChat");
    typingIndicator = document.getElementById("typingIndicator");

    btnVoiceInput = document.getElementById("btnVoiceInput");
    voiceRecordingMode = document.getElementById("voiceRecordingMode");
    btnStopRecording = document.getElementById("btnStopRecording");
    chatInputWrapper = document.getElementById("chatInputWrapper");
    safetyLocationPanel = document.getElementById("safetyLocationPanel");
    btnEnableSafetyLocation = document.getElementById("btnEnableSafetyLocation");
    safetyLocationStatus = document.getElementById("safetyLocationStatus");

    if (!modalOverlay) return;

    setupEventListeners();
    initVoiceRecognition();
    initSafetyLocationState();

    // Inisialisasi ChatStorage
    if (CONFIG.enablePersistence && typeof ChatStorage !== 'undefined') {
      await ChatStorage.init();
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Close/minimize buttons
    const closeButtons = document.querySelectorAll(".btn-close-chatbot, .btn-minimize-chat");
    closeButtons.forEach((btn) => {
      btn.addEventListener("click", minimize);
    });

    // Clear chat button
    const btnClearChat = document.getElementById("btnClearChat");
    if (btnClearChat) {
      btnClearChat.addEventListener("click", confirmClearChat);
    }

    // Send button
    if (btnSendChat) {
      btnSendChat.addEventListener("click", sendMessage);
    }

    // Input field
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      chatInput.addEventListener("input", () => {
        btnSendChat.disabled = chatInput.value.trim().length === 0;
      });
    }

    // Voice recording
    if (btnVoiceInput) {
      btnVoiceInput.addEventListener("click", startVoiceRecording);
    }

    if (btnStopRecording) {
      btnStopRecording.addEventListener("click", stopVoiceRecording);
    }

    if (btnEnableSafetyLocation) {
      btnEnableSafetyLocation.addEventListener("click", enableSafetyLocationMode);
    }

    // Trigger untuk buka chatbot
    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="chat-ara"], [data-action="chat-temanku"]')) {
        e.preventDefault();
        open();
      }
    });
  }

  function emergencyUrl(path) {
    return new URL(path, CONFIG.emergencyApiBase).href;
  }

  async function initSafetyLocationState() {
    if (!navigator.geolocation) {
      updateSafetyLocationStatus('Browser tidak mendukung lokasi.', true);
      if (btnEnableSafetyLocation) btnEnableSafetyLocation.disabled = true;
      return;
    }

    if (navigator.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        locationPermissionState = result.state;
        result.onchange = () => {
          locationPermissionState = result.state;
          if (result.state === 'denied') {
            updateSafetyLocationStatus('Izin lokasi ditolak. Emergency akan memakai IP fallback.', false);
          }
        };
      } catch (error) {
        locationPermissionState = 'unknown';
      }
    }

    if (localStorage.getItem('wiecara_safety_location_enabled') === 'true' && locationPermissionState === 'granted') {
      enableSafetyLocationMode();
    }
  }

  function updateSafetyLocationStatus(message, disabledButton = false) {
    if (safetyLocationStatus) safetyLocationStatus.textContent = message;
    if (btnEnableSafetyLocation) {
      btnEnableSafetyLocation.disabled = disabledButton;
      if (disabledButton) {
        btnEnableSafetyLocation.textContent = 'Tidak tersedia';
      }
    }
  }

  function hideSafetyLocationPanel(delay = 1400) {
    if (!safetyLocationPanel) return;
    window.setTimeout(() => {
      safetyLocationPanel.classList.add('is-hidden-after-active');
    }, delay);
  }

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toISOString()
          };
          lastKnownLocation = location;
          resolve(location);
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000
        }
      );
    });
  }

  async function sendLocationHeartbeat(location, permissionState = locationPermissionState) {
    if (!location) return false;
    try {
      const response = await fetch(emergencyUrl('location_heartbeat.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          permission_state: permissionState
        })
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async function enableSafetyLocationMode() {
    if (!navigator.geolocation) {
      updateSafetyLocationStatus('Browser tidak mendukung lokasi.', true);
      return;
    }

    if (btnEnableSafetyLocation) {
      btnEnableSafetyLocation.disabled = true;
      btnEnableSafetyLocation.textContent = 'Mengaktifkan...';
    }

    try {
      const location = await getCurrentLocation();
      locationPermissionState = 'granted';
      localStorage.setItem('wiecara_safety_location_enabled', 'true');
      const heartbeatSaved = await sendLocationHeartbeat(location, 'granted');
      startLocationWatch();
      updateSafetyLocationStatus(
        heartbeatSaved
          ? 'Mode siaga aktif. Lokasi terakhir siap dipakai untuk kondisi darurat.'
          : 'GPS aktif di browser. Jika heartbeat gagal, emergency tetap memakai lokasi halaman ini.',
        true
      );
      if (btnEnableSafetyLocation) {
        btnEnableSafetyLocation.textContent = 'Aktif';
        btnEnableSafetyLocation.disabled = true;
      }
      hideSafetyLocationPanel();
    } catch (error) {
      locationPermissionState = error?.code === 1 ? 'denied' : 'unavailable';
      localStorage.removeItem('wiecara_safety_location_enabled');
      updateSafetyLocationStatus('Lokasi belum aktif. Jika darurat, sistem memakai IP fallback.', false);
      if (btnEnableSafetyLocation) {
        btnEnableSafetyLocation.textContent = 'Coba Lagi';
        btnEnableSafetyLocation.disabled = false;
      }
    }
  }

  function startLocationWatch() {
    if (!navigator.geolocation || locationWatchId !== null) return;

    locationWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        };
        lastKnownLocation = location;
        await sendLocationHeartbeat(location, 'granted');
      },
      (error) => {
        locationPermissionState = error?.code === 1 ? 'denied' : locationPermissionState;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  async function refreshLocationIfAllowed() {
    if (!navigator.geolocation) return null;

    if (navigator.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        locationPermissionState = result.state;
        if (result.state !== 'granted') return null;
      } catch (error) {
        if (localStorage.getItem('wiecara_safety_location_enabled') !== 'true') return null;
      }
    } else if (localStorage.getItem('wiecara_safety_location_enabled') !== 'true') {
      return null;
    }

    try {
      const location = await getCurrentLocation();
      await sendLocationHeartbeat(location, 'granted');
      return location;
    } catch (error) {
      return null;
    }
  }

  async function waitForPendingLocationRefresh() {
    if (!pendingLocationRefreshPromise) return null;
    try {
      return await pendingLocationRefreshPromise;
    } catch (error) {
      return null;
    } finally {
      pendingLocationRefreshPromise = null;
    }
  }

  // ============================================
  // OPEN / CLOSE / MINIMIZE
  // ============================================

  /**
   * Buka chatbot
   */
  async function open() {
    if (isOpen) return;

    isOpen = true;
    modalOverlay.classList.add("active");

    if (chatInterfaceScreen) {
      chatInterfaceScreen.style.display = "flex";
    }

    if (!sessionActive) {
      sessionActive = true;

      // Cek apakah ada session sebelumnya yang bisa di-restore
      if (CONFIG.autoRestoreSession && !hasRestoredSession) {
        await tryRestoreSession();
      } else {
        // Tampilkan welcome message
        showTyping();
        setTimeout(() => {
          hideTyping();
          addBotMessage(CONFIG.welcomeMessage);
        }, CONFIG.loadingDelay);
      }
    }

    if (chatInput) {
      setTimeout(() => chatInput.focus(), 400);
    }
  }

  /**
   * Coba restore session dari localStorage
   */
  async function tryRestoreSession() {
    if (!CONFIG.enablePersistence || typeof ChatStorage === 'undefined') {
      showWelcome();
      return;
    }

    try {
      const hasHistory = await ChatStorage.hasHistory();

      if (hasHistory) {
        const storedHistory = await ChatStorage.loadHistory();

        if (storedHistory && storedHistory.length > 0) {
          // Tampilkan continue message
          showContinuePrompt(storedHistory.length);
          hasRestoredSession = true;
          return;
        }
      }
    } catch (error) {
      console.error('[Chatbot] Restore error:', error);
    }

    showWelcome();
  }

  /**
   * Tampilkan prompt untuk melanjutkan atau mulai baru
   */
  function showContinuePrompt(messageCount) {
    addBotMessage(CONFIG.continueMessage);

    // Tambahkan tombol pilihan
    const optionsDiv = document.createElement("div");
    optionsDiv.className = "chat-message bot-message session-options-message";
    optionsDiv.innerHTML = `
      ${araAvatarMarkup()}
      <div class="message-bubble session-options">
        <p>${messageCount} pesan sebelumnya tersimpan</p>
        <div class="session-buttons">
          <button class="btn-session btn-continue" id="btnContinueSession">
            <i class="fas fa-play"></i> Lanjutkan
          </button>
          <button class="btn-session btn-new" id="btnNewSession">
            <i class="fas fa-plus"></i> Mulai Baru
          </button>
        </div>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(optionsDiv);
      scrollToBottom();

      // Event listeners untuk tombol
      document.getElementById("btnContinueSession")?.addEventListener("click", () => {
        restorePreviousSession();
        optionsDiv.remove();
      });

      document.getElementById("btnNewSession")?.addEventListener("click", () => {
        startNewSession();
        optionsDiv.remove();
      });
    }
  }

  /**
   * Restore session sebelumnya
   */
  async function restorePreviousSession() {
    try {
      const storedHistory = await ChatStorage.loadHistory();

      if (storedHistory && storedHistory.length > 0) {
        // Render semua pesan
        storedHistory.forEach(msg => {
          if (msg.role === 'user') {
            addUserMessage(msg.content, false);
          } else {
            addBotMessage(msg.content, false);
          }
        });

        conversationHistory = storedHistory;

        // Sync ke server
        await restoreServerSession(storedHistory);

        addBotMessage("Aku sudah membaca percakapan kita sebelumnya. Apa yang ingin kamu ceritakan hari ini?");
      }
    } catch (error) {
      console.error('[Chatbot] Restore session error:', error);
      addBotMessage("Maaf, ada kendala memuat riwayat. Mari kita mulai dari awal.");
    }
  }

  /**
   * Restore server session dengan history
   */
  async function restoreServerSession(history) {
    try {
      const response = await fetch(CONFIG.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          history: history.slice(-20) // Kirim 20 pesan terakhir
        }),
      });

      const data = await response.json();
      if (data.session_id) {
        sessionId = data.session_id;
      }
    } catch (error) {
      console.error('[Chatbot] Server restore error:', error);
    }
  }

  /**
   * Mulai session baru
   */
  async function startNewSession() {
    // Clear local storage
    if (typeof ChatStorage !== 'undefined') {
      await ChatStorage.clearHistory();
    }

    conversationHistory = [];

    // Reset server session
    await fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    }).catch(console.error);

    addBotMessage("Baik, mari kita mulai dari awal. Aku di sini untuk mendengarkanmu.");
  }

  /**
   * Tampilkan welcome message
   */
  function showWelcome() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addBotMessage(CONFIG.welcomeMessage);
    }, CONFIG.loadingDelay);
  }

  /**
   * Minimize chatbot (tutup tapi simpan state)
   */
  function minimize() {
    isOpen = false;
    modalOverlay.classList.remove("active");
    // Tidak clear session, biarkan user bisa lanjutkan
  }

  /**
   * Tutup chatbot sepenuhnya (clear session)
   */
  function close() {
    isOpen = false;
    modalOverlay.classList.remove("active");
    clearChat();
  }

  /**
   * Konfirmasi hapus riwayat
   */
  function confirmClearChat() {
    if (confirm("Hapus semua riwayat chat? Tindakan ini tidak dapat dibatalkan.")) {
      fullClear();
    }
  }

  /**
   * Clear chat secara penuh (termasuk localStorage)
   */
  async function fullClear() {
    if (chatMessages) {
      chatMessages.innerHTML = "";
    }

    sessionActive = false;
    sessionId = null;
    conversationHistory = [];
    hasRestoredSession = false;

    // Clear localStorage
    if (typeof ChatStorage !== 'undefined') {
      await ChatStorage.clearHistory();
    }

    // Reset server session
    fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    }).catch((e) => console.error("Reset error:", e));

    addBotMessage("Riwayat sudah dihapus. Ada yang bisa aku bantu?");
  }

  /**
   * Clear chat (untuk minimize, tidak hapus localStorage)
   */
  function clearChat() {
    // Simpan ke localStorage sebelum clear UI
    saveToStorage();

    if (chatMessages) {
      chatMessages.innerHTML = "";
    }
    sessionActive = false;
    sessionId = null;
    conversationHistory = [];

    fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    }).catch((e) => console.error("Reset error:", e));
  }

  // ============================================
  // MESSAGING
  // ============================================

  /**
   * Kirim pesan ke server
   */
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || isTyping) return;

    addUserMessage(message);
    chatInput.value = "";
    btnSendChat.disabled = true;

    showTyping();

    try {
      const requestBody = { message, action: "chat" };
      if (sessionId) requestBody.session_id = sessionId;

      const response = await fetch(CONFIG.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      hideTyping();

      if (data.success) {
        if (data.session_id) sessionId = data.session_id;

        // Update phase dan tier
        currentPhase = data.phase || currentPhase;
        currentTier = data.tier || currentTier;

        // Handle redirect ke form
        if (data.action === 'redirect_to_form' && data.payload) {
          handleAutoFillRedirect(data.payload, data.response);
          return;
        }

        // Handle safety check darurat self-harm
        if (data.phase === "safety_check") {
          handleSafetyCheck(data);
        }
        // Handle emergency lama
        else if (data.phase === "emergency") {
          handleEmergency(data.response);
        }
        // Handle hesitation detection dari server
        else if (data.phase === "hesitation" && data.hesitation_type) {
          const localResponse = getHesitationResponse(data.hesitation_type);
          addBotMessage(localResponse);
          setTimeout(() => showReofferButtons(), 1200);
        }
        // Handle consent phase - tampilkan tombol Ya/Tidak
        else if (data.phase === "consent") {
          addBotMessage(data.response);
          setTimeout(() => showConsentButtons(), 600);
        }
        else {
          addBotMessage(data.response);
        }

        // Tampilkan kode laporan jika ada
        if (data.kode_laporan) {
          setTimeout(() => showReportCode(data.kode_laporan), 800);
        }

        // Simpan ke localStorage
        saveToStorage();

      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error(error);
      hideTyping();
      addBotMessage("Maaf, terjadi kesalahan. Silakan coba lagi.");
    }
  }

  /**
   * Simpan ke localStorage
   */
  async function saveToStorage() {
    if (!CONFIG.enablePersistence || typeof ChatStorage === 'undefined') return;

    try {
      await ChatStorage.saveHistory(conversationHistory);
    } catch (error) {
      console.error('[Chatbot] Save error:', error);
    }
  }

  /**
   * Tambah pesan user ke UI
   */
  function addUserMessage(text, addToHistory = true) {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (addToHistory) {
      conversationHistory.push({
        role: "user",
        content: text,
        timestamp: Date.now(),
        time: time
      });
    }

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message user-message";
    msgDiv.innerHTML = `
      <div class="message-bubble">
        <div class="message-text">${escapeHtml(text)}</div>
        <span class="message-time">${time}</span>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(msgDiv);
      scrollToBottom();
    }
  }

  /**
   * Tambah pesan bot ke UI
   */
  function addBotMessage(text, addToHistory = true) {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (addToHistory) {
      conversationHistory.push({
        role: "assistant",
        content: text,
        timestamp: Date.now(),
        time: time
      });
    }

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message bot-message";

    const formattedText = escapeHtml(String(text)).replace(/\n/g, "<br>");

    msgDiv.innerHTML = `
      ${araAvatarMarkup()}
      <div class="message-bubble">
        <div class="message-text">${formattedText}</div>
        <span class="message-time">${time}</span>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(msgDiv);
      scrollToBottom();
    }
  }

  // ============================================
  // SPECIAL HANDLERS
  // ============================================

  function handleSafetyCheck(data) {
    addBotMessage(data.response);

    pendingSafetyCheck = {
      triggerMessage: data.trigger_message || '',
      riskType: data.risk_type || 'SELF_HARM_INTENT',
      freshLocation: null
    };

    pendingLocationRefreshPromise = refreshLocationIfAllowed().then((location) => {
      if (pendingSafetyCheck) {
        pendingSafetyCheck.freshLocation = location;
      }
      return location;
    });

    showSafetyCheckOverlay(data.safety_check_timeout_seconds || 20);
  }

  function showSafetyCheckOverlay(timeoutSeconds) {
    clearExistingSafetyCheck();

    const overlay = document.createElement('div');
    overlay.className = 'safety-check-overlay';
    overlay.id = 'safetyCheckOverlay';
    overlay.innerHTML = `
      <div class="safety-check-card">
        <div class="safety-check-badge">DARURAT</div>
        <h3>ARA mendeteksi kondisi darurat</h3>
        <p>Apakah kamu aman sekarang?</p>
        <div class="safety-check-timer">
          <span id="safetyCheckSeconds">${timeoutSeconds}</span> detik untuk menjawab
        </div>
        <div class="safety-check-actions">
          <button type="button" class="btn-safety-safe" id="btnSafetySafe">Saya aman</button>
          <button type="button" class="btn-safety-danger" id="btnSafetyDanger">Saya butuh bantuan sekarang</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let remaining = timeoutSeconds;
    const secondsEl = document.getElementById('safetyCheckSeconds');

    document.getElementById('btnSafetySafe')?.addEventListener('click', () => {
      handleSafetyAnswer('SAFE');
    });

    document.getElementById('btnSafetyDanger')?.addEventListener('click', () => {
      handleSafetyAnswer('NEED_HELP_NOW');
    });

    safetyCheckTimerId = setInterval(() => {
      remaining -= 1;
      if (secondsEl) secondsEl.textContent = String(Math.max(remaining, 0));
      if (remaining <= 0) {
        handleSafetyAnswer('NO_RESPONSE_20_SECONDS');
      }
    }, 1000);
  }

  function clearExistingSafetyCheck() {
    if (safetyCheckTimerId) {
      clearInterval(safetyCheckTimerId);
      safetyCheckTimerId = null;
    }
    document.getElementById('safetyCheckOverlay')?.remove();
  }

  async function handleSafetyAnswer(answer) {
    if (!pendingSafetyCheck) return;

    const current = pendingSafetyCheck;
    pendingSafetyCheck = null;
    clearExistingSafetyCheck();

    if (answer === 'SAFE') {
      pendingLocationRefreshPromise = null;
      addUserMessage('Saya aman');
      await fetch(emergencyUrl('safety_log.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trigger_message: current.triggerMessage,
          risk_type: current.riskType
        })
      }).catch(() => {});
      addBotMessage('Terima kasih sudah menjawab. Aku tetap di sini kalau kamu ingin bercerita pelan-pelan.');
      return;
    }

    addUserMessage(answer === 'NEED_HELP_NOW' ? 'Saya butuh bantuan sekarang' : 'Tidak menjawab dalam 20 detik');

    try {
      if (!current.freshLocation) {
        current.freshLocation = await waitForPendingLocationRefresh();
      }

      const response = await fetch(emergencyUrl('create_case.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trigger_message: current.triggerMessage,
          risk_type: current.riskType,
          user_response: answer,
          fresh_location: current.freshLocation,
          last_known_location: lastKnownLocation
        })
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        addBotMessage('Emergency case sudah dikirim ke Dashboard Responder WIECARA. Petugas dapat melihat lokasi terbaik yang tersedia.');
      } else {
        addBotMessage('ARA gagal mengirim emergency case. Jika kamu bisa, segera cari bantuan orang terdekat.');
      }
    } catch (error) {
      addBotMessage('Koneksi ke dashboard darurat gagal. Jika kamu bisa, segera cari bantuan orang terdekat.');
    }
  }

  /**
   * Handle auto-fill redirect ke form
   */
  async function handleAutoFillRedirect(extractedData, botMessage) {
    addBotMessage(botMessage);

    setTimeout(async () => {
      addBotMessage(
        "Data kamu sudah aku siapkan.\n\nSekarang aku akan arahkan kamu ke formulir. Beberapa field sudah terisi otomatis."
      );

      try {
        const dataToStore = JSON.stringify(extractedData);
        let encryptedData;

        if (window.sharedEncryption) {
          const sessionKey = generateEphemeralKey();
          encryptedData = await window.sharedEncryption.encrypt(dataToStore, sessionKey);
          sessionStorage.setItem('_autofill_key', sessionKey);
        } else {
          encryptedData = btoa(unescape(encodeURIComponent(dataToStore)));
        }

        sessionStorage.setItem('_chatbot_autofill', encryptedData);
        sessionStorage.setItem('_autofill_timestamp', Date.now().toString());

        showRedirectAnimation();

        setTimeout(() => {
          window.location.href = '../Lapor/lapor.html?source=chatbot';
        }, 2000);

      } catch (error) {
        sessionStorage.setItem('_chatbot_autofill', btoa(JSON.stringify(extractedData)));
        sessionStorage.setItem('_autofill_timestamp', Date.now().toString());

        setTimeout(() => {
          window.location.href = '../Lapor/lapor.html?source=chatbot';
        }, 2000);
      }

    }, 1200);
  }

  /**
   * Handle emergency
   */
  function handleEmergency(message) {
    addBotMessage(message);

    setTimeout(() => {
      const emergencyDiv = document.createElement("div");
      emergencyDiv.className = "chat-message bot-message emergency-options-message";
      emergencyDiv.innerHTML = `
        ${araAvatarMarkup()}
        <div class="message-bubble emergency-actions">
          <p><strong>Bantuan Darurat</strong></p>
          <div class="emergency-buttons">
              <a href="https://wa.me/${CONFIG.emergencyPhone}" target="_blank" class="btn-emergency btn-whatsapp">
                  <i class="fab fa-whatsapp"></i> WhatsApp Satgas
              </a>
              <a href="tel:${CONFIG.emergencyPhone}" class="btn-emergency btn-call">
                  <i class="fas fa-phone-alt"></i> Telepon Darurat
              </a>
              <a href="../Lapor/lapor.html" class="btn-emergency btn-form">
                  <i class="fas fa-file-alt"></i> Isi Formulir
              </a>
          </div>
        </div>
      `;

      if (chatMessages) {
        chatMessages.appendChild(emergencyDiv);
        scrollToBottom();
      }
    }, 600);
  }

  /**
   * Tampilkan tombol consent untuk membuat laporan
   */
  function showConsentButtons() {
    const consentDiv = document.createElement("div");
    consentDiv.className = "chat-message bot-message consent-options-message";
    consentDiv.innerHTML = `
      ${araAvatarMarkup()}
      <div class="message-bubble consent-actions">
        <p><strong>Buat Laporan Resmi?</strong></p>
        <p style="font-size: 0.85rem; color: #666; margin-bottom: 12px;">
          Identitasmu akan dijaga kerahasiaannya oleh Satgas PPKPT.
        </p>
        <div class="consent-buttons">
          <button class="btn-consent btn-yes" id="btnConsentYes">
            <i class="fas fa-check"></i> Ya, Bantu Saya Lapor
          </button>
          <button class="btn-consent btn-no" id="btnConsentNo">
            <i class="fas fa-times"></i> Saya Masih Ragu
          </button>
        </div>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(consentDiv);
      scrollToBottom();

      document.getElementById("btnConsentYes")?.addEventListener("click", () => {
        consentDiv.remove();
        window.location.href = "../Lapor/lapor.html";
      });

      document.getElementById("btnConsentNo")?.addEventListener("click", () => {
        consentDiv.remove();
        
        // Beritahu backend bahwa tawaran ditolak agar poin di-reset ke 0
        fetch(CONFIG.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject_offer" })
        }).catch(e => console.error("Error rejecting offer:", e));

        hesitationHandled = false;
        showHesitationOptions();
      });
    }
  }

  // ============================================
  // HESITATION HANDLING SYSTEM
  // ============================================

  /**
   * Klasifikasi sikon keraguan berdasarkan kata kunci
   * 
   * @param {string} message - Pesan user
   * @returns {'fear'|'pessimism'|'fatigue'|'unknown'}
   */
  function classifyHesitation(message) {
    const msg = message.toLowerCase().trim();

    // Sikon 1: Takut Ancaman / Bahaya
    const fearKeywords = [
      'takut', 'ancam', 'diancam', 'bahaya', 'ngeri', 'serem',
      'ketahuan', 'balas dendam', 'dimarahin', 'dihukum',
      'dikeluarkan', 'di-do', 'dipecat', 'dibully',
      'ancaman', 'teror', 'intimidasi', 'gak aman', 'tidak aman',
      'malu', 'aib', 'tercoreng', 'nama baik'
    ];

    // Sikon 2: Merasa Sia-sia / Pesimis
    const pessimismKeywords = [
      'sia-sia', 'percuma', 'gak guna', 'gak ada gunanya',
      'tidak berguna', 'gak bakal', 'mustahil', 'tidak mungkin',
      'gak akan diproses', 'gak ditanggepin', 'diabaikan',
      'gak percaya', 'tidak percaya', 'ragu', 'buat apa',
      'gak ada hasilnya', 'buang waktu', 'males', 'hopeless',
      'gak yakin', 'tidak yakin'
    ];

    // Sikon 3: Lelah Mental / Trauma
    const fatigueKeywords = [
      'capek', 'cape', 'lelah', 'udah males', 'udah lemas',
      'gak kuat', 'gak sanggup', 'trauma', 'belum siap',
      'belum kuat', 'butuh waktu', 'nanti aja', 'nanti dulu',
      'berat', 'keberatan', 'susah', 'sulit', 'gak bisa',
      'overwhelm', 'drain', 'exhausted', 'pusing',
      'sakit', 'luka', 'terluka'
    ];

    for (const kw of fearKeywords) {
      if (msg.includes(kw)) return 'fear';
    }

    for (const kw of pessimismKeywords) {
      if (msg.includes(kw)) return 'pessimism';
    }

    for (const kw of fatigueKeywords) {
      if (msg.includes(kw)) return 'fatigue';
    }

    return 'unknown';
  }

  /**
   * Dapatkan respons kontekstual berdasarkan sikon keraguan
   * Pendekatan psikologis klinis: validasi emosi + highlight siklus berulang
   * Maksimal 2-3 kalimat, ringkas dan padat
   * 
   * @param {'fear'|'pessimism'|'fatigue'|'unknown'} sikon
   * @returns {string}
   */
  function getHesitationResponse(sikon) {
    const responses = {
      // Sikon 1: Takut Ancaman/Bahaya
      fear: "Aku mengerti, rasa takutmu itu sangat wajar dan manusiawi. " +
            "Perlu kamu tahu, sistem pelaporan ini sepenuhnya anonim dan identitasmu tidak akan diungkap ke siapapun tanpa persetujuanmu. " +
            "Perilaku seperti ini punya kecenderungan kuat untuk berulang, dan melaporkan justru langkah nyata untuk melindungi dirimu dari siklus itu.",

      // Sikon 2: Merasa Sia-sia/Pesimis
      pessimism: "Perasaan skeptis itu wajar banget, apalagi setelah apa yang sudah kamu alami. " +
                 "Tapi satu laporan bisa jadi pemicu efek domino: melindungi kamu, sekaligus mencegah orang lain jadi korban berikutnya. " +
                 "Pelaku yang dibiarkan punya kecenderungan kuat mengulangi perbuatannya. Keberanianmu bisa memutus siklus itu.",

      // Sikon 3: Lelah Mental/Trauma
      fatigue: "Kamu sudah menanggung beban yang sangat berat, dan aku nggak akan memaksamu. " +
              "Kamu boleh istirahat dulu, laporan ini bisa dilanjutkan kapan pun kamu merasa siap. " +
              "Aku tetap di sini dan data ceritamu aman. Prioritaskan dirimu dulu ya.",

      // Default: Keraguan umum
      unknown: "Kamu sudah sangat berani mau menceritakan ini, dan aku menghargai itu. " +
               "Memutuskan untuk melapor memang bukan hal mudah. Tapi dari kacamata psikologis, perilaku seperti ini cenderung berulang jika dibiarkan. " +
               "Keputusan tetap ada di tanganmu, dan aku di sini mendampingi apapun pilihanmu."
    };

    return responses[sikon] || responses.unknown;
  }

  /**
   * Tampilkan opsi keraguan agar user bisa memilih alasan mereka ragu.
   */
  function showHesitationOptions() {
    addUserMessage("Saya masih ragu...");

    // Tampilkan respons umum dulu
    showTyping();
    setTimeout(() => {
      hideTyping();
      addBotMessage(
        "Aku sangat mengerti, dan keputusan ini memang berat. " +
        "Boleh aku tahu apa yang membuatmu ragu? Ini penting supaya aku bisa bantu dengan lebih tepat."
      );

      // Tampilkan tombol sikon
      const optionsDiv = document.createElement("div");
      optionsDiv.className = "chat-message bot-message hesitation-options-message";
      optionsDiv.innerHTML = `
        ${araAvatarMarkup()}
        <div class="message-bubble hesitation-actions">
          <div class="hesitation-buttons">
            <button class="btn-hesitation btn-fear" data-sikon="fear">
              <i class="fas fa-shield-alt"></i> Takut ada ancaman/bahaya
            </button>
            <button class="btn-hesitation btn-pessimism" data-sikon="pessimism">
              <i class="fas fa-question-circle"></i> Merasa laporan sia-sia
            </button>
            <button class="btn-hesitation btn-fatigue" data-sikon="fatigue">
              <i class="fas fa-battery-quarter"></i> Lelah / belum siap
            </button>
            <button class="btn-hesitation btn-cancel-final" data-sikon="final_no">
              <i class="fas fa-times"></i> Tidak mau lapor sama sekali
            </button>
          </div>
        </div>
      `;

      if (chatMessages) {
        chatMessages.appendChild(optionsDiv);
        scrollToBottom();

        // Event listeners
        optionsDiv.querySelectorAll('.btn-hesitation').forEach(btn => {
          btn.addEventListener('click', () => {
            const sikon = btn.dataset.sikon;
            optionsDiv.remove();
            handleHesitationChoice(sikon);
          });
        });
      }
    }, 800);
  }

  /**
   * Handle pilihan sikon keraguan user
   * @param {string} sikon - 'fear' | 'pessimism' | 'fatigue' | 'final_no'
   */
  function handleHesitationChoice(sikon) {
    const labelMap = {
      fear: "Aku takut ada ancaman...",
      pessimism: "Aku merasa laporannya percuma...",
      fatigue: "Aku lelah dan belum siap...",
      final_no: "Tidak, terima kasih"
    };

    addUserMessage(labelMap[sikon] || "Saya tidak mau lapor");
    hesitationHandled = true;

    // Jika benar-benar menolak
    if (sikon === 'final_no') {
      handleConsentResponse("tidak, terima kasih. saya tidak mau membuat laporan");
      return;
    }

    // Tampilkan respons kontekstual berdasarkan sikon
    showTyping();
    setTimeout(() => {
      hideTyping();
      const response = getHesitationResponse(sikon);
      addBotMessage(response);

      // Setelah respons sikon, tawarkan kembali dengan lembut
      setTimeout(() => {
        showReofferButtons();
      }, 1200);
    }, 1000);
  }

  /**
   * Tawarkan kembali setelah respons hesitation (tanpa memaksa)
   */
  function showReofferButtons() {
    const reofferDiv = document.createElement("div");
    reofferDiv.className = "chat-message bot-message reoffer-message";
    reofferDiv.innerHTML = `
      ${araAvatarMarkup()}
      <div class="message-bubble reoffer-actions">
        <p style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">Apapun keputusanmu, aku menghormatinya.</p>
        <div class="reoffer-buttons">
          <button class="btn-consent btn-yes btn-reoffer-yes" id="btnReofferYes">
            <i class="fas fa-check"></i> Oke, aku mau coba lapor
          </button>
          <button class="btn-consent btn-no btn-reoffer-later" id="btnReofferLater">
            <i class="fas fa-clock"></i> Nanti saja
          </button>
        </div>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(reofferDiv);
      scrollToBottom();

      document.getElementById("btnReofferYes")?.addEventListener("click", () => {
        reofferDiv.remove();
        addUserMessage("Oke, aku mau coba lapor");
        handleConsentResponse("ya, saya mau dibantu membuat laporan");
      });

      document.getElementById("btnReofferLater")?.addEventListener("click", () => {
        reofferDiv.remove();
        addUserMessage("Nanti saja");
        showTyping();
        setTimeout(() => {
          hideTyping();
          addBotMessage(
            "Baik, aku menghormati keputusanmu. Data ceritamu tetap aman di sini. " +
            "Kalau suatu saat kamu berubah pikiran, tinggal bilang aja ya. Aku selalu ada."
          );
          // Kirim ke server sebagai rejected
          fetch(CONFIG.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "saya menolak untuk membuat laporan saat ini", action: "chat" })
          }).catch(console.error);
          saveToStorage();
        }, 600);
      });
    }
  }

  /**
   * Handle respons consent dari user
   */
  async function handleConsentResponse(response) {
    addUserMessage(response);
    showTyping();

    try {
      const requestBody = { message: response, action: "chat" };
      if (sessionId) requestBody.session_id = sessionId;

      const res = await fetch(CONFIG.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      hideTyping();

      if (data.success) {
        if (data.session_id) sessionId = data.session_id;
        currentPhase = data.phase || currentPhase;

        addBotMessage(data.response);

        // Jika user setuju, mungkin ada redirect atau kode laporan
        if (data.action === 'redirect_to_form' && data.payload) {
          setTimeout(() => handleAutoFillRedirect(data.payload, ""), 1000);
        }

        if (data.kode_laporan) {
          setTimeout(() => showReportCode(data.kode_laporan), 800);
        }

        saveToStorage();
      } else {
        addBotMessage(data.response || "Terima kasih atas jawabanmu.");
      }
    } catch (error) {
      console.error(error);
      hideTyping();
      addBotMessage("Terima kasih. Aku tetap di sini jika kamu butuh bantuan.");
    }
  }

  /**
   * Tampilkan kode laporan
   */
  function showReportCode(code) {
    const codeDiv = document.createElement("div");
    codeDiv.className = "chat-message bot-message report-code-message";
    codeDiv.innerHTML = `
      ${araAvatarMarkup()}
      <div class="message-bubble report-code-bubble">
        <div class="report-icon">
          <i class="fas fa-clipboard-check"></i>
        </div>
        <div class="report-content">
          <h4>Laporan Tercatat</h4>
          <p>Kode unik laporan:</p>
          <div class="code-display">
            <span id="reportCode">${code}</span>
            <button class="btn-copy-code" onclick="AraChatbot.copyCode('${code}')" title="Salin">
              <i class="fas fa-copy"></i>
            </button>
          </div>
          <small>Simpan kode ini untuk cek status laporan</small>
        </div>
        <div class="report-actions">
          <a href="../Monitoring/monitoring.html" class="btn-check-status">
            <i class="fas fa-search"></i>
            Cek Status
          </a>
        </div>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(codeDiv);
      scrollToBottom();
    }
  }

  /**
   * Copy kode laporan
   */
  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector('.btn-copy-code');
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.background = '#2fc4b2';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.background = '';
        }, 1500);
      }
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  // ============================================
  // VOICE RECORDING
  // ============================================

  /**
   * Inisialisasi voice recognition
   */
  function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      voiceSupported = false;
      if (btnVoiceInput) {
        btnVoiceInput.style.display = "none";
      }
      return;
    }

    voiceSupported = true;
    recognition = new SpeechRecognition();

    recognition.lang = "id-ID";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      isRecording = true;
      finalTranscriptAccumulated = chatInput ? chatInput.value : '';
      interimTranscript = '';
      showVoiceRecordingUI();
    };

    recognition.onresult = (event) => {
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscriptAccumulated += transcript + ' ';
        } else {
          currentInterim += transcript;
        }
      }

      interimTranscript = currentInterim;
      const fullText = (finalTranscriptAccumulated + interimTranscript).trim();

      if (chatInput) {
        chatInput.value = fullText;
        chatInput.scrollLeft = chatInput.scrollWidth;

        if (btnSendChat) {
          btnSendChat.disabled = !fullText;
        }
      }

      const liveTranscriptText = document.getElementById("liveTranscriptText");
      if (liveTranscriptText) {
        liveTranscriptText.textContent = fullText || "Mulai berbicara...";
        liveTranscriptText.classList.toggle("placeholder", !fullText);

        const preview = document.getElementById("liveTranscriptPreview");
        if (preview) {
          preview.scrollTop = preview.scrollHeight;
        }
      }
    };

    recognition.onend = () => {
      if (shouldKeepRecording && isRecording) {
        setTimeout(() => {
          if (shouldKeepRecording) {
            try {
              recognition.start();
            } catch (e) {
              setTimeout(() => {
                if (shouldKeepRecording) {
                  try { recognition.start(); } catch (e2) { }
                }
              }, 200);
            }
          }
        }, 50);
        return;
      }

      if (isRecording) {
        stopVoiceRecording();
      }
    };

    recognition.onerror = (event) => {
      if (['no-speech', 'aborted', 'network'].includes(event.error)) {
        if (shouldKeepRecording && isRecording) {
          return;
        }
      }

      if (event.error === "not-allowed") {
        alert("Izin microphone ditolak. Silakan aktifkan di pengaturan browser.");
        shouldKeepRecording = false;
        stopVoiceRecording();
      } else if (event.error === "audio-capture") {
        alert("Mikrofon tidak ditemukan. Pastikan mikrofon terhubung.");
        shouldKeepRecording = false;
        stopVoiceRecording();
      }
    };
  }

  /**
   * Mulai voice recording
   */
  function startVoiceRecording() {
    if (!voiceSupported || !recognition) {
      alert("Voice recognition tidak didukung di browser ini. Gunakan Chrome atau Edge.");
      return;
    }

    if (isRecording) {
      stopVoiceRecording();
      return;
    }

    finalTranscriptAccumulated = '';
    interimTranscript = '';
    shouldKeepRecording = true;

    try {
      recognition.start();
    } catch (e) {
      console.error("Error starting voice recognition:", e);
      shouldKeepRecording = false;
    }
  }

  /**
   * Stop voice recording
   */
  function stopVoiceRecording() {
    shouldKeepRecording = false;
    isRecording = false;

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) { }
    }

    hideVoiceRecordingUI();

    if (chatInput && chatInput.value.trim()) {
      btnSendChat.disabled = false;
    }
  }

  /**
   * Tampilkan UI voice recording
   */
  function showVoiceRecordingUI() {
    if (voiceRecordingMode) voiceRecordingMode.classList.add("active");
    if (chatInputWrapper) chatInputWrapper.style.display = "none";
    if (btnVoiceInput) btnVoiceInput.classList.add("recording");

    const liveTranscriptText = document.getElementById("liveTranscriptText");
    if (liveTranscriptText) {
      liveTranscriptText.textContent = "Mulai berbicara...";
      liveTranscriptText.classList.add("placeholder");
    }

    chatRecordingStartTime = Date.now();
    startChatRecordingTimer();
  }

  /**
   * Sembunyikan UI voice recording
   */
  function hideVoiceRecordingUI() {
    if (voiceRecordingMode) voiceRecordingMode.classList.remove("active");
    if (chatInputWrapper) chatInputWrapper.style.display = "flex";
    if (btnVoiceInput) btnVoiceInput.classList.remove("recording");

    if (chatTimerInterval) {
      clearInterval(chatTimerInterval);
      chatTimerInterval = null;
    }
    chatRecordingStartTime = null;

    const timerDisplay = document.getElementById("chatRecordingTimer");
    if (timerDisplay) {
      timerDisplay.textContent = "00:00";
    }
  }

  /**
   * Timer untuk recording
   */
  function startChatRecordingTimer() {
    const timerDisplay = document.getElementById("chatRecordingTimer");
    if (!timerDisplay) return;

    chatTimerInterval = setInterval(() => {
      if (!chatRecordingStartTime) return;

      const elapsed = Math.floor((Date.now() - chatRecordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const seconds = (elapsed % 60).toString().padStart(2, "0");
      timerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Tampilkan typing indicator
   */
  function showTyping() {
    isTyping = true;
    if (typingIndicator) {
      typingIndicator.classList.add('active');
      typingIndicator.style.display = "flex";
    }
    scrollToBottom();
  }

  /**
   * Sembunyikan typing indicator
   */
  function hideTyping() {
    isTyping = false;
    if (typingIndicator) {
      typingIndicator.classList.remove('active');
      typingIndicator.style.display = "none";
    }
  }

  /**
   * Scroll ke bawah
   */
  function scrollToBottom() {
    if (chatMessagesContainer) {
      requestAnimationFrame(() => {
        chatMessagesContainer.scrollTo({
          top: chatMessagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  }

  /**
   * Animasi redirect
   */
  function showRedirectAnimation() {
    const animDiv = document.createElement("div");
    animDiv.className = "redirect-animation";
    animDiv.innerHTML = `
      <div class="redirect-content">
        <div class="redirect-spinner"></div>
        <p>Mengalihkan ke formulir...</p>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(animDiv);
      scrollToBottom();
    }
  }

  /**
   * Generate random key
   */
  function generateEphemeralKey() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Escape HTML untuk keamanan
   */
  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // ============================================
  // PUBLIC API
  // ============================================
  window.AraChatbot = {
    close,
    open,
    init,
    copyCode,
    minimize,
    clearHistory: fullClear
  };
  // Alias lama dipertahankan agar modul existing yang belum diganti tidak rusak.
  window.TemanKuChatbot = window.AraChatbot;

  // Auto init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
