(function () {
  const POLL_INTERVAL_MS = 3000;
  const API_BASE = new URL("../api/emergency/", document.currentScript.src).href;

  const activationScreen = document.getElementById("activationScreen");
  const dashboardView = document.getElementById("dashboardView");
  const btnActivate = document.getElementById("btnActivate");
  const connectionStatus = document.getElementById("connectionStatus");
  const alertBanner = document.getElementById("alertBanner");
  const emptyState = document.getElementById("emptyState");
  const casesGrid = document.getElementById("casesGrid");
  const alarmAudio = document.getElementById("alarmAudio");

  let pollingId = null;
  let activeCases = [];
  let fetchSequence = 0;

  function apiUrl(path) {
    return new URL(path, API_BASE).href;
  }

  function formatDate(value) {
    if (!value) return "-";
    const normalized = String(value).replace(" ", "T");
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function hasGps(caseItem) {
    return caseItem.latitude !== null && caseItem.latitude !== undefined &&
      caseItem.longitude !== null && caseItem.longitude !== undefined;
  }

  function locationLabel(caseItem) {
    if (!hasGps(caseItem)) {
      return "Lokasi GPS tidak tersedia. Gunakan IP fallback sebagai petunjuk awal.";
    }

    const lat = Number(caseItem.latitude).toFixed(6);
    const lng = Number(caseItem.longitude).toFixed(6);
    return `${lat}, ${lng}`;
  }

  function accuracyLabel(caseItem) {
    if (caseItem.accuracy_meters === null || caseItem.accuracy_meters === undefined) {
      return "-";
    }
    return `${Math.round(Number(caseItem.accuracy_meters))} meter`;
  }

  function responseLabel(value) {
    if (value === "NO_RESPONSE_20_SECONDS") return "Tidak menjawab 20 detik";
    if (value === "NEED_HELP_NOW") return "Butuh bantuan sekarang";
    return value || "-";
  }

  function sourceLabel(value) {
    const labels = {
      GPS_FRESH: "GPS fresh",
      GPS_LAST_KNOWN: "GPS terakhir",
      IP_FALLBACK: "IP fallback"
    };
    return labels[value] || value || "IP fallback";
  }

  function updateAlarmState() {
    const hasActive = activeCases.length > 0;
    document.body.classList.toggle("has-active-emergency", hasActive);
    alertBanner.classList.toggle("is-hidden", !hasActive);
    emptyState.classList.toggle("is-hidden", hasActive);
    connectionStatus.textContent = hasActive ? `${activeCases.length} DARURAT AKTIF` : "Siaga";
    connectionStatus.classList.toggle("is-danger", hasActive);

    if (hasActive) {
      alarmAudio.play().catch(() => {
        connectionStatus.textContent = "Klik halaman untuk suara alarm";
      });
    } else {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    }
  }

  function renderCases() {
    casesGrid.innerHTML = activeCases.map((caseItem) => {
      const mapsHref = hasGps(caseItem)
        ? `https://www.google.com/maps?q=${encodeURIComponent(caseItem.latitude)},${encodeURIComponent(caseItem.longitude)}`
        : "#";
      const mapsClass = hasGps(caseItem) ? "btn-map" : "btn-map is-disabled";
      const gpsWarning = hasGps(caseItem) ? "" : '<div class="location-warning">Lokasi GPS tidak tersedia. Dashboard hanya menerima IP fallback.</div>';

      return `
        <article class="case-card" data-case-id="${escapeHtml(caseItem.id)}">
          <div class="case-top">
            <div>
              <strong>DARURAT AKTIF</strong>
              <span>${escapeHtml(caseItem.kode_darurat || `CASE-${caseItem.id}`)}</span>
            </div>
            <div class="case-risk-chip">${escapeHtml(caseItem.risk_type || "SELF_HARM_INTENT")}</div>
          </div>
          <div class="case-body">
            <div class="case-summary">
              <div class="summary-tile">
                <span>Waktu Deteksi</span>
                <strong>${escapeHtml(formatDate(caseItem.created_at))}</strong>
              </div>
              <div class="summary-tile">
                <span>Respons User</span>
                <strong>${escapeHtml(responseLabel(caseItem.user_response))}</strong>
              </div>
              <div class="summary-tile">
                <span>Sumber Lokasi</span>
                <strong>${escapeHtml(sourceLabel(caseItem.location_source))}</strong>
              </div>
              <div class="summary-tile">
                <span>Akurasi</span>
                <strong>${escapeHtml(accuracyLabel(caseItem))}</strong>
              </div>
            </div>
            <div class="trigger-box">
              <span>Pesan Pemicu</span>
              <p>${escapeHtml(caseItem.trigger_message)}</p>
            </div>
            <div class="data-row">
              <div class="data-label">Sumber Lokasi</div>
              <div class="data-value">${escapeHtml(sourceLabel(caseItem.location_source))}</div>
            </div>
            <div class="data-row">
              <div class="data-label">Koordinat</div>
              <div class="data-value">${escapeHtml(locationLabel(caseItem))}</div>
            </div>
            <div class="data-row">
              <div class="data-label">Akurasi</div>
              <div class="data-value">${escapeHtml(accuracyLabel(caseItem))}</div>
            </div>
            <div class="data-row">
              <div class="data-label">IP</div>
              <div class="data-value">${escapeHtml(caseItem.ip_address || "-")}</div>
            </div>
            ${gpsWarning}
          </div>
          <div class="case-actions">
            <a class="${mapsClass}" href="${mapsHref}" target="_blank" rel="noopener">Buka Google Maps</a>
            <button type="button" class="btn-danger" data-action="accept" data-case-id="${escapeHtml(caseItem.id)}">
              Saya segera ke lokasi
            </button>
            <button type="button" class="btn-muted" data-action="false-alarm" data-case-id="${escapeHtml(caseItem.id)}">
              Tandai false alarm
            </button>
          </div>
        </article>
      `;
    }).join("");

    updateAlarmState();
  }

  async function fetchActiveCases() {
    const sequence = ++fetchSequence;
    try {
      const response = await fetch(apiUrl("active_cases.php"), {
        credentials: "include",
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal mengambil emergency case");
      }
      if (sequence !== fetchSequence) return;
      activeCases = result.status === "success" ? result.data : [];
      renderCases();
    } catch (error) {
      connectionStatus.textContent = "Koneksi API gagal";
      connectionStatus.classList.add("is-danger");
    }
  }

  async function postAction(path, payload) {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Aksi gagal diproses");
    }
    await fetchActiveCases();
  }

  function startPolling() {
    fetchActiveCases();
    pollingId = window.setInterval(fetchActiveCases, POLL_INTERVAL_MS);
  }

  btnActivate.addEventListener("click", async () => {
    activationScreen.classList.add("is-hidden");
    dashboardView.classList.remove("is-hidden");
    alarmAudio.volume = 1;
    try {
      await alarmAudio.play();
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    } catch (error) {
      connectionStatus.textContent = "Siaga, audio menunggu emergency";
    }
    startPolling();
  });

  casesGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const caseId = button.dataset.caseId;
    button.disabled = true;

    try {
      if (button.dataset.action === "accept") {
        await postAction("accept_case.php", {
          case_id: caseId,
          responder_label: "Petugas Polisi/Damkar"
        });
      }

      if (button.dataset.action === "false-alarm") {
        const reason = window.prompt("Alasan false alarm:", "Dikonfirmasi petugas sebagai false alarm");
        if (reason === null) {
          button.disabled = false;
          return;
        }
        await postAction("false_alarm.php", {
          case_id: caseId,
          reason: reason.trim() || "False alarm"
        });
      }
    } catch (error) {
      await fetchActiveCases();
      window.alert(error.message);
      button.disabled = false;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && pollingId) {
      fetchActiveCases();
    }
  });
})();
