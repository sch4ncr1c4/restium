import { openModal, closeModal } from "./modalCore.js";
import { apiRequest } from "../services/apiClient.js";

function formatHourLabel(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function formatDurationLabel(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}m`;
  if (rest <= 0) return `${hours}h`;
  return `${hours}:${String(rest).padStart(2, "0")}h`;
}

export function initClockModal(state) {
  const openBtn = document.getElementById("openClockModal");
  if (!openBtn) return;

  const clockModal = document.createElement("div");
  clockModal.id = "clockModal";
  clockModal.className =
    "fixed inset-0 z-[88] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  clockModal.innerHTML = `
    <div id="clockModalPanel" class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Fichaje de personal</h3>
      <p class="mt-1 text-xs text-zinc-500">Ingresa el codigo de 4 digitos para registrar entrada/salida.</p>

      <div class="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p class="text-xs font-semibold text-zinc-600">Codigo</p>
        <div id="clockPinDots" class="mt-2 flex items-center gap-2">
          <span class="h-3 w-3 rounded-full bg-zinc-300"></span>
          <span class="h-3 w-3 rounded-full bg-zinc-300"></span>
          <span class="h-3 w-3 rounded-full bg-zinc-300"></span>
          <span class="h-3 w-3 rounded-full bg-zinc-300"></span>
        </div>
      </div>

      <div id="clockPad" class="mt-3 grid grid-cols-3 gap-2">
        <button type="button" data-pin-key="1" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">1</button>
        <button type="button" data-pin-key="2" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">2</button>
        <button type="button" data-pin-key="3" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">3</button>
        <button type="button" data-pin-key="4" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">4</button>
        <button type="button" data-pin-key="5" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">5</button>
        <button type="button" data-pin-key="6" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">6</button>
        <button type="button" data-pin-key="7" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">7</button>
        <button type="button" data-pin-key="8" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">8</button>
        <button type="button" data-pin-key="9" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">9</button>
        <button type="button" data-pin-action="clear" class="rounded-md border border-zinc-300 bg-zinc-100 py-3 text-xs font-semibold text-zinc-700">Borrar</button>
        <button type="button" data-pin-key="0" class="rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800">0</button>
        <button type="button" data-pin-action="backspace" class="rounded-md border border-zinc-300 bg-zinc-100 py-3 text-xs font-semibold text-zinc-700">Del</button>
      </div>

      <p id="clockModalError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <p id="clockModalSuccess" class="mt-2 hidden text-sm font-medium text-emerald-700"></p>

      <article id="clockLastEvent" class="mt-3 hidden rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p class="text-xs font-semibold text-emerald-700">Ultimo fichaje</p>
        <p id="clockLastEventName" class="mt-1 text-sm font-semibold text-zinc-900"></p>
        <p id="clockLastEventEntry" class="text-xs text-zinc-700"></p>
        <p id="clockLastEventElapsed" class="text-xs text-zinc-700"></p>
      </article>

      <article id="clockActiveCard" class="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p class="text-xs font-semibold text-zinc-700">Personal fichado</p>
        <div id="clockActiveList" class="mt-2 space-y-1 text-xs text-zinc-700">
          <p class="text-zinc-500">Sin personal fichado.</p>
        </div>
      </article>

      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelClockModal" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(clockModal);
  state.clockModal = clockModal;
  state.clockModalPanel = document.getElementById("clockModalPanel");

  const dotsNode = document.getElementById("clockPinDots");
  const padNode = document.getElementById("clockPad");
  const errorNode = document.getElementById("clockModalError");
  const successNode = document.getElementById("clockModalSuccess");
  const lastEventCard = document.getElementById("clockLastEvent");
  const activeCardNode = document.getElementById("clockActiveCard");
  const lastEventName = document.getElementById("clockLastEventName");
  const lastEventEntry = document.getElementById("clockLastEventEntry");
  const lastEventElapsed = document.getElementById("clockLastEventElapsed");
  const activeListNode = document.getElementById("clockActiveList");

  let pinBuffer = "";
  let activeEntries = [];
  let renderTimer = null;
  let lastEventHideTimer = null;

  const renderPinDots = () => {
    const dots = Array.from(dotsNode.querySelectorAll("span"));
    dots.forEach((dot, index) => {
      const active = index < pinBuffer.length;
      dot.className = active
        ? "h-3 w-3 rounded-full bg-zinc-800"
        : "h-3 w-3 rounded-full bg-zinc-300";
    });
  };

  const renderActiveList = () => {
    if (!activeEntries.length) {
      activeListNode.innerHTML = '<p class="text-zinc-500">Sin personal fichado.</p>';
      return;
    }

    activeListNode.innerHTML = activeEntries
      .map((entry) => {
        const entryDate = new Date(entry.entry_at);
        const elapsedMinutes = Math.max(0, Math.floor((Date.now() - entryDate.getTime()) / 60000));
        return `
          <div class="rounded-md bg-white px-2 py-1">
            <p class="font-semibold text-zinc-800">${entry.name}</p>
            <p>Entrada: ${formatHourLabel(entry.entry_at)} | Tiempo: ${formatDurationLabel(elapsedMinutes)}</p>
          </div>
        `;
      })
      .join("");
  };

  const loadActiveClockedUsers = async () => {
    try {
      const response = await apiRequest("/users/clock/active", { auth: true });
      activeEntries = Array.isArray(response?.data) ? response.data : [];
      renderActiveList();
    } catch (_error) {
      activeEntries = [];
      renderActiveList();
    }
  };

  const clearFeedback = () => {
    errorNode.textContent = "";
    successNode.textContent = "";
    errorNode.classList.add("hidden");
    successNode.classList.add("hidden");
  };

  const clearPin = () => {
    pinBuffer = "";
    renderPinDots();
  };

  const appendPinDigit = (digit) => {
    if (!/^\d$/.test(String(digit))) return;
    if (pinBuffer.length >= 4) return;
    pinBuffer += String(digit);
    renderPinDots();
    if (pinBuffer.length === 4) {
      submitClock();
    }
  };

  const submitClock = async () => {
    if (!/^\d{4}$/.test(pinBuffer)) return;
    clearFeedback();
    padNode.classList.add("pointer-events-none", "opacity-70");
    try {
      const response = await apiRequest("/users/clock", {
        method: "POST",
        auth: true,
        body: { pinCode: pinBuffer },
      });

      const payload = response?.data || {};
      const eventTypeLabel = payload.event_type === "out" ? "Salida" : "Entrada";
      const staffName = payload?.user?.name || "Personal";
      successNode.textContent = `${eventTypeLabel} registrada para ${staffName}.`;
      successNode.classList.remove("hidden");

      if (payload.entry_at) {
        lastEventName.textContent = `${staffName} (${eventTypeLabel})`;
        lastEventEntry.textContent = `Hora de entrada: ${formatHourLabel(payload.entry_at)}`;
        lastEventElapsed.textContent = `Tiempo fichado: ${formatDurationLabel(payload.session_minutes)}`;
        lastEventCard.classList.remove("hidden");
        if (lastEventHideTimer) clearTimeout(lastEventHideTimer);
        lastEventHideTimer = setTimeout(() => {
          lastEventCard.classList.add("hidden");
          lastEventHideTimer = null;
        }, 3000);
      }

      clearPin();
      await loadActiveClockedUsers();
    } catch (error) {
      errorNode.textContent = error?.message || "No se pudo registrar el fichaje.";
      errorNode.classList.remove("hidden");
      clearPin();
    } finally {
      padNode.classList.remove("pointer-events-none", "opacity-70");
    }
  };

  const openClock = async () => {
    if (!state.permissions?.canUseClock) return;
    clearFeedback();
    clearPin();
    lastEventCard.classList.add("hidden");
    if (lastEventHideTimer) {
      clearTimeout(lastEventHideTimer);
      lastEventHideTimer = null;
    }
    openModal(state, clockModal, {
      panel: state.clockModalPanel,
      title: state.clockModalPanel.querySelector("h3"),
    });
    if (activeCardNode) activeCardNode.classList.remove("hidden");
    await loadActiveClockedUsers();
    if (renderTimer) clearInterval(renderTimer);
    renderTimer = setInterval(renderActiveList, 10000);
  };

  const closeClock = () => {
    if (renderTimer) {
      clearInterval(renderTimer);
      renderTimer = null;
    }
    if (lastEventHideTimer) {
      clearTimeout(lastEventHideTimer);
      lastEventHideTimer = null;
    }
    closeModal(state, clockModal, { panel: state.clockModalPanel });
  };

  openBtn.addEventListener("click", openClock);
  document.getElementById("cancelClockModal").addEventListener("click", closeClock);
  clockModal.addEventListener("click", (event) => {
    if (event.target === clockModal) closeClock();
  });

  padNode.addEventListener("click", (event) => {
    const keyButton = event.target.closest("[data-pin-key]");
    if (keyButton) {
      appendPinDigit(keyButton.dataset.pinKey);
      return;
    }

    const actionButton = event.target.closest("[data-pin-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.pinAction;
    if (action === "clear") {
      clearPin();
      return;
    }
    if (action === "backspace") {
      pinBuffer = pinBuffer.slice(0, -1);
      renderPinDots();
    }
  });

  clockModal.addEventListener("keydown", (event) => {
    if (clockModal.classList.contains("hidden")) return;
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      appendPinDigit(event.key);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      pinBuffer = pinBuffer.slice(0, -1);
      renderPinDots();
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      clearPin();
      return;
    }
    if (event.key === "Enter") {
      if (pinBuffer.length === 4) {
        event.preventDefault();
        submitClock();
      }
    }
  });
}
