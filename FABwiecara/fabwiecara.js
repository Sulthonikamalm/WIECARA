// FAB WIECARA - Direct Chat Button

(function () {
  "use strict";

  const logoAraUrl = new URL("../ChatBot/assets/logo-ara.png", document.currentScript?.src || window.location.href).href;

  function createFABButton() {
    const fabContainer = document.createElement("div");
    fabContainer.id = "fab-wiecara-container";
    fabContainer.className = "fab-wiecara-container";
    fabContainer.innerHTML = `
      <button class="fab-main" id="fab-main-btn" aria-label="Chat dengan ARA">
        <span class="fab-logo-shell">
          <img src="${logoAraUrl}" alt="Logo ARA" class="fab-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span class="fab-logo-fallback">ARA</span>
        </span>
      </button>
      <span class="fab-tooltip">Chat ARA</span>
    `;
    document.body.appendChild(fabContainer);
  }

  function initEventListeners() {
    const mainBtn = document.getElementById("fab-main-btn");
    if (!mainBtn) return;

    mainBtn.addEventListener("click", function () {
      const chatbot = window.AraChatbot || window.TemanKuChatbot;
      if (chatbot && chatbot.open) {
        chatbot.open();
      }
    });
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        createFABButton();
        initEventListeners();
      });
    } else {
      createFABButton();
      initEventListeners();
    }
  }

  init();

  window.FABWiecara = {
    open: function () {
      const chatbot = window.AraChatbot || window.TemanKuChatbot;
      if (chatbot && chatbot.open) {
        chatbot.open();
      }
    },
  };
})();
