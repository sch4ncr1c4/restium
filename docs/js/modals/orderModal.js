import { openModal, closeModal } from "./modalCore.js";
import { getPlanKeyByGrid } from "../plans/planGrid.js";
import { renderCatalog } from "../catalog/catalogRender.js";
import { renderOrderModal, renderWaiters, ensureOrderMeta } from "../orders/ordersRender.js";
import { apiRequest } from "../services/apiClient.js";

const CATALOG_PALETTE = [
  "#FFFFFF",
  "#E86C6C",
  "#E08A5A",
  "#D8A64F",
  "#C9B34E",
  "#98B94A",
  "#69AF7A",
  "#53A58D",
  "#4FAFA7",
  "#5FAEB7",
  "#5A9FCC",
  "#6C8FC7",
  "#7D84CB",
  "#8D7AC3",
  "#A277C2",
  "#BB74B4",
  "#C27AA5",
  "#C57994",
  "#9B7A67",
  "#7D8796",
];

const MAX_PRODUCT_NAME_LENGTH = 60;
const MAX_CATEGORY_NAME_LENGTH = 30;
const PRINTER_TARGET_OPTIONS = ["comanda salon", "comanda cocina", "comanda barra"];
const BACKEND_BASE_URL = "http://localhost:3000";

function normalizeCategory(value) {
  return (value || "").trim();
}

function isUnsafeObjectKey(value) {
  const key = String(value || "").toLowerCase();
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

function categoryExists(state, name) {
  const normalized = normalizeCategory(name).toLowerCase();
  if (!normalized) return false;
  return state.categories.some((category) => category.toLowerCase() === normalized);
}

function removeCategory(state, categoryToDelete) {
  const current = normalizeCategory(categoryToDelete);
  if (!current || state.categories.length <= 1) return;
  state.categories = state.categories.filter((category) => category !== current);

  // Keep products and move them to fallback category to avoid data loss.
  const fallback = state.categories.includes("Varios") ? "Varios" : state.categories[0] || "Varios";
  if (!state.categories.includes(fallback)) state.categories.push(fallback);
  state.productsCatalog.forEach((product) => {
    if ((product.category || "Varios") === current) {
      product.category = fallback;
    }
  });
  if (state.catalogLayoutByCategory) {
    delete state.catalogLayoutByCategory[current];
  }
  if (state.catalogCategoryColors) {
    delete state.catalogCategoryColors[current];
  }
  state.selectedCatalogCategory = fallback;
}

function getActiveCatalogCategory(state) {
  if (state.selectedCatalogCategory && state.categories.includes(state.selectedCatalogCategory)) {
    return state.selectedCatalogCategory;
  }
  return state.categories[0] || "Varios";
}

function canBypassWaiterPin(state) {
  const role = String(state.currentUser?.role || "").toLowerCase();
  return role === "admin" || role === "gerente";
}

export function renderOrderCategories(state) {
  state.categories = state.categories.filter((category) => {
    const normalized = normalizeCategory(category);
    return Boolean(normalized) && normalized !== "__none__";
  });

  const categoriesFromProducts = state.productsCatalog
    .map((product) => normalizeCategory(product.category))
    .filter((category) => Boolean(category) && category !== "__none__");

  categoriesFromProducts.forEach((category) => {
    if (!categoryExists(state, category)) {
      state.categories.push(category);
    }
  });

  if (!state.categories.length) {
    state.categories.push("Varios");
  }

  if (!categoryExists(state, state.selectedCatalogCategory)) {
    state.selectedCatalogCategory = state.categories[0];
  }

  const chips = document.getElementById("orderCategoryChips");
  if (chips) {
    chips.replaceChildren();
    state.categories.forEach((category) => {
      const active = category === state.selectedCatalogCategory;
      const customColor = state.catalogCategoryColors?.[category];
      const hasCustomColor = Boolean(customColor) && customColor.toUpperCase() !== "#FFFFFF";
      const base = "shrink-0 rounded-md border px-3 py-2 text-sm font-semibold transition sm:px-5 sm:py-2.5 sm:text-base";
      const style = hasCustomColor
        ? active
          ? "border-zinc-700 text-white ring-2 ring-zinc-400 ring-offset-1"
          : "border-transparent text-white hover:brightness-95"
        : active
          ? "border-emeraldbrand bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500";
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.categoryChip = category;
      button.className = `${base} ${style}`;
      if (hasCustomColor) button.style.backgroundColor = customColor;
      button.textContent = category;
      chips.appendChild(button);
    });
  }

  const removeButton = document.getElementById("removeCategoryButton");
  if (removeButton) {
    const disableDelete = state.categories.length <= 1;
    removeButton.disabled = disableDelete;
    removeButton.classList.toggle("opacity-40", disableDelete);
  }

  const deleteCategorySelect = document.getElementById("deleteCategorySelect");
  if (deleteCategorySelect) {
    deleteCategorySelect.replaceChildren();
    state.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      deleteCategorySelect.appendChild(option);
    });
    deleteCategorySelect.value = state.selectedCatalogCategory || state.categories[0];
  }

}

export function renderCatalogLockUI(state) {
  const button = document.getElementById("toggleCatalogLockButton");
  const categoryActions = document.getElementById("categoryManageActions");
  const paletteControl = document.getElementById("catalogPaletteControl");
  if (!button) return;
  const lockClosedIcon =
    '<svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" clip-rule="evenodd"/></svg>';
  const lockOpenIcon =
    '<svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path d="M7 6a3 3 0 116 0v1h-2V6a1 1 0 10-2 0v2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2V6z"/></svg>';
  if (state.catalogLocked) {
    button.innerHTML = lockClosedIcon;
    button.setAttribute("aria-label", "Desbloquear productos");
    button.setAttribute("title", "Desbloquear productos");
    button.className =
      "inline-flex h-8 w-8 items-center justify-center rounded-md bg-emeraldbrand text-white transition hover:bg-emerald-600";
    if (categoryActions) categoryActions.classList.add("hidden");
    if (paletteControl) paletteControl.classList.add("hidden");
    state.catalogPaletteOpen = false;
    state.catalogPaintColor = null;
    renderCatalogPaintUI(state);
    return;
  }
  button.innerHTML = lockOpenIcon;
  button.setAttribute("aria-label", "Bloquear productos");
  button.setAttribute("title", "Bloquear productos");
  button.className =
    "inline-flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white transition hover:bg-zinc-700";
  if (categoryActions) categoryActions.classList.remove("hidden");
  if (paletteControl) paletteControl.classList.remove("hidden");
}

export function renderCatalogPaintUI(state) {
  const palette = document.getElementById("catalogColorPalette");
  const tray = document.getElementById("catalogPaletteTray");
  const toggle = document.getElementById("toggleCatalogPalette");
  if (!palette || !tray || !toggle) return;

  palette.innerHTML = CATALOG_PALETTE.map((color) => {
    const active = state.catalogPaintColor === color;
    const ring = active ? "ring-2 ring-zinc-900 ring-offset-2" : "ring-1 ring-zinc-300";
    return `<button type="button" data-catalog-color="${color}" class="h-6 w-6 rounded-full ${ring} transition hover:scale-110" style="background-color:${color}" aria-label="Color ${color}"></button>`;
  }).join("");

  tray.className = state.catalogPaletteOpen
    ? "pointer-events-auto flex max-w-[80vw] items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-2 shadow-xl transition-all duration-200 opacity-100 translate-x-0 scale-100 origin-right"
    : "pointer-events-none flex max-w-[80vw] items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-2 shadow-xl transition-all duration-200 opacity-0 translate-x-3 scale-95 origin-right";
  toggle.className = state.catalogPaletteOpen
    ? "h-10 w-10 rounded-full bg-emeraldbrand text-white shadow-lg transition hover:bg-emerald-600"
    : "h-10 w-10 rounded-full bg-zinc-900 text-white shadow-lg transition hover:bg-zinc-700";
  toggle.textContent = state.catalogPaletteOpen ? "\u00D7" : "\uD83C\uDFA8";
}

export function initOrderModal(state) {
  const orderModal = document.createElement("div");
  orderModal.id = "orderModal";
  orderModal.className =
    "fixed inset-0 z-[83] hidden items-center justify-center bg-zinc-900/60 p-3 sm:p-4 opacity-0 transition-opacity duration-200";
  orderModal.innerHTML = `
    <div id="orderModalPanel" class="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-[1500px] flex-col overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-[88vh] sm:max-h-[88vh] sm:rounded-2xl sm:p-4 lg:h-[82vh] lg:max-h-[82vh] lg:overflow-hidden">
      <div class="mb-3 flex flex-col gap-3 border-b border-zinc-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Gestion de mesa</p>
          <h3 id="orderModalTitle" class="text-lg font-semibold">Mesa</h3>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs text-zinc-500">Mozo:</span>
            <select id="orderWaiterSelect" class="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"></select>
          </div>
        </div>
        <div class="flex min-w-0 flex-col items-start gap-2 sm:flex-1 sm:items-center">
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Categorias</p>
          <div class="w-full overflow-x-auto sm:flex sm:max-w-full sm:flex-wrap sm:items-center sm:justify-center sm:gap-2 sm:overflow-visible">
            <div id="orderCategoryChips" class="flex w-max min-w-full items-center gap-2 sm:w-auto sm:min-w-0 sm:max-w-full sm:flex-wrap sm:justify-center"></div>
          </div>
        </div>
        <button id="closeOrderModal" type="button" class="absolute right-3 top-3 z-10 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 sm:static sm:self-auto">Cerrar</button>
      </div>
      <div class="grid min-h-0 flex-1 gap-3 pb-[calc(env(safe-area-inset-bottom)+7rem)] md:grid-cols-[300px_minmax(0,1fr)] md:pb-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section class="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-3 md:min-h-0">
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-semibold">Productos cargados</h4>
            <span id="orderItemsCount" class="rounded-md bg-white px-2 py-1 text-[11px]">0 items</span>
          </div>
          <div id="orderItemsList" class="min-h-[180px] flex-1 space-y-2 overflow-y-auto md:min-h-0"></div>
          <div class="mt-3 border-t border-zinc-200 pt-3 text-sm">
            <div class="flex justify-between"><span>Subtotal</span><strong id="orderSubtotal">$0</strong></div>
            <div class="flex justify-between"><span>Sena</span><strong id="orderDeposit">-$0</strong></div>
            <div class="flex justify-between"><span>Descuento</span><strong id="orderDiscount">-$0</strong></div>
            <div class="flex justify-between"><span>Total</span><strong id="orderTotal">$0</strong></div>
            <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button id="invoiceAButton" type="button" class="rounded-md bg-zinc-100 px-2 py-2 text-[11px] font-semibold text-zinc-700">Factura A</button>
              <button id="invoiceBButton" type="button" class="rounded-md bg-zinc-100 px-2 py-2 text-[11px] font-semibold text-zinc-700">Factura B</button>
              <button id="openAdjustModal" type="button" class="rounded-md bg-amber-100 px-2 py-2 text-[11px] font-semibold text-amber-800">Descuento</button>
              <button id="deleteOrderItemButton" type="button" class="rounded-md bg-rose-100 px-2 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-40">Eliminar prod.</button>
            </div>
          </div>
        </section>
        <section class="flex flex-col rounded-xl border border-zinc-200 bg-white p-3 md:min-h-0">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h4 class="text-sm font-semibold">Carga de productos</h4>
            <div id="catalogToolsStrip" class="catalog-tools-strip flex items-center gap-2">
              <button id="toggleCatalogLockButton" type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-700" aria-label="Bloquear productos" title="Bloquear productos">
                <svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path d="M7 6a3 3 0 116 0v1h-2V6a1 1 0 10-2 0v2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2V6z"/></svg>
              </button>
              <div id="categoryManageActions" class="relative">
                <button id="categoryMenuToggle" type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100" aria-haspopup="true" aria-expanded="false" aria-label="Opciones de categoria">...</button>
                <div id="categoryMenuPanel" class="absolute right-0 top-9 z-20 hidden min-w-[180px] rounded-md border border-zinc-200 bg-white p-1.5 shadow-xl">
                  <button id="openAddCategoryModal" type="button" class="block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Agregar categoria</button>
                  <button id="removeCategoryButton" type="button" class="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50">Eliminar categoria</button>
                </div>
              </div>
            </div>
          </div>
          <div id="catalogBoard" class="relative min-h-[300px] flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-0 md:min-h-0"></div>
        </section>
      </div>
      <div id="catalogPaletteControl" class="absolute bottom-2 right-2 z-20 flex items-center gap-2">
        <div id="catalogPaletteTray" class="pointer-events-none flex max-w-[80vw] items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-2 shadow-xl transition-all duration-200 opacity-0 translate-x-3 scale-95 origin-right">
          <div id="catalogColorPalette" class="flex flex-wrap items-center gap-1.5"></div>
        </div>
        <button id="toggleCatalogPalette" type="button" class="pointer-events-auto h-9 w-9 rounded-full bg-zinc-900 text-white shadow-lg transition hover:bg-zinc-700" aria-label="Mostrar paleta">&#x1F3A8;</button>
      </div>
    </div>
  `;
  document.body.appendChild(orderModal);
  state.orderModal = orderModal;
  state.orderModal.__onClose = () => {
    state.catalogPaintColor = null;
    state.catalogPaletteOpen = false;
    discardPendingStaticTableDraftIfEmpty(state);
  };

  const waiterPickerModal = document.createElement("div");
  waiterPickerModal.id = "waiterPickerModal";
  waiterPickerModal.className =
    "fixed inset-0 z-[84] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  waiterPickerModal.innerHTML = `
    <div id="waiterPickerPanel" class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 id="waiterPickerTitle" class="text-base font-semibold text-zinc-900">Seleccionar mozo</h3>
      <p class="mt-2 text-sm text-zinc-600">Ingresa el codigo de 4 digitos del mozo que comanda.</p>
      <div class="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p class="text-xs font-semibold text-zinc-600">Codigo mozo</p>
        <input id="waiterPinInput" type="password" inputmode="numeric" maxlength="4" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="****" />
      </div>
      <div id="waiterPinPad" class="mt-3 grid grid-cols-3 gap-2">
        <button type="button" data-waiter-pin-key="1" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">1</button>
        <button type="button" data-waiter-pin-key="2" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">2</button>
        <button type="button" data-waiter-pin-key="3" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">3</button>
        <button type="button" data-waiter-pin-key="4" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">4</button>
        <button type="button" data-waiter-pin-key="5" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">5</button>
        <button type="button" data-waiter-pin-key="6" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">6</button>
        <button type="button" data-waiter-pin-key="7" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">7</button>
        <button type="button" data-waiter-pin-key="8" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">8</button>
        <button type="button" data-waiter-pin-key="9" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">9</button>
        <button type="button" data-waiter-pin-action="clear" class="rounded-md border border-zinc-300 bg-zinc-100 py-2 text-xs font-semibold text-zinc-700">Borrar</button>
        <button type="button" data-waiter-pin-key="0" class="rounded-md border border-zinc-300 bg-white py-2 text-sm font-semibold text-zinc-800">0</button>
        <button type="button" data-waiter-pin-action="backspace" class="rounded-md border border-zinc-300 bg-zinc-100 py-2 text-xs font-semibold text-zinc-700">Del</button>
      </div>
      <p id="waiterPickerError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelWaiterPicker" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="confirmWaiterPicker" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(waiterPickerModal);
  state.waiterPickerModal = waiterPickerModal;
  state.waiterPickerModal.__onClose = () => {
    state.pendingStaticPlanKey = null;
  };
  state.waiterPickerPanel = document.getElementById("waiterPickerPanel");
  state.waiterPickerOptions = null;
  const waiterPinInput = document.getElementById("waiterPinInput");
  const waiterPinPad = document.getElementById("waiterPinPad");
  const waiterPickerError = document.getElementById("waiterPickerError");
  const waiterConfirmBtn = document.getElementById("confirmWaiterPicker");
  let waiterPickerContext = null;

  const setWaiterPickerError = (message = "") => {
    if (!waiterPickerError) return;
    waiterPickerError.textContent = message;
    waiterPickerError.classList.toggle("hidden", !message);
  };

  const resetWaiterPinInput = () => {
    if (waiterPinInput) waiterPinInput.value = "";
    setWaiterPickerError("");
  };

  const resolveWaiterFromPin = async () => {
    const pinCode = waiterPinInput?.value?.replace(/\D/g, "").slice(0, 4) || "";
    if (!/^\d{4}$/.test(pinCode)) {
      setWaiterPickerError("El codigo del mozo debe tener 4 digitos.");
      return;
    }

    waiterConfirmBtn.disabled = true;
    waiterConfirmBtn.classList.add("opacity-70");
    if (waiterPinPad) waiterPinPad.classList.add("pointer-events-none", "opacity-70");

    try {
      const response = await apiRequest("/users/resolve-pin", {
        method: "POST",
        auth: true,
        body: { pinCode },
      });
      const waiterName = response?.data?.name;
      if (!waiterName || !waiterPickerContext || typeof waiterPickerContext.onResolved !== "function") {
        throw new Error("no se pudo resolver el mozo");
      }
      closeModal(state, state.waiterPickerModal, { panel: state.waiterPickerPanel, restoreFocus: false });
      waiterPickerContext.onResolved(waiterName);
    } catch (error) {
      setWaiterPickerError(error?.message || "No se pudo validar el codigo del mozo.");
    } finally {
      waiterConfirmBtn.disabled = false;
      waiterConfirmBtn.classList.remove("opacity-70");
      if (waiterPinPad) waiterPinPad.classList.remove("pointer-events-none", "opacity-70");
    }
  };

  const openWaiterPinPicker = (title, onResolved) => {
    waiterPickerContext = { onResolved };
    const waiterPickerTitle = document.getElementById("waiterPickerTitle");
    if (waiterPickerTitle) waiterPickerTitle.textContent = title;
    resetWaiterPinInput();
    openModal(state, state.waiterPickerModal, {
      panel: state.waiterPickerPanel,
      title: waiterPickerTitle,
    });
    requestAnimationFrame(() => waiterPinInput?.focus());
  };

  const closeBtn = document.getElementById("closeOrderModal");
  closeBtn.addEventListener("click", () => closeOrderModal(state));

  document.getElementById("cancelWaiterPicker").addEventListener("click", () => {
    closeModal(state, state.waiterPickerModal, { panel: state.waiterPickerPanel });
  });
  waiterPickerModal.addEventListener("click", (event) => {
    if (event.target === waiterPickerModal) {
      closeModal(state, state.waiterPickerModal, { panel: state.waiterPickerPanel });
    }
  });

  waiterPinInput?.addEventListener("input", () => {
    waiterPinInput.value = waiterPinInput.value.replace(/\D/g, "").slice(0, 4);
    setWaiterPickerError("");
  });

  waiterPinInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      resolveWaiterFromPin();
    }
  });

  waiterPinPad?.addEventListener("click", (event) => {
    const keyButton = event.target.closest("[data-waiter-pin-key]");
    if (keyButton) {
      const current = waiterPinInput.value || "";
      if (current.length >= 4) return;
      waiterPinInput.value = `${current}${keyButton.dataset.waiterPinKey}`.slice(0, 4);
      setWaiterPickerError("");
      return;
    }

    const actionButton = event.target.closest("[data-waiter-pin-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.waiterPinAction;
    if (action === "clear") {
      waiterPinInput.value = "";
      setWaiterPickerError("");
      return;
    }
    if (action === "backspace") {
      waiterPinInput.value = (waiterPinInput.value || "").slice(0, -1);
      setWaiterPickerError("");
    }
  });

  waiterConfirmBtn?.addEventListener("click", () => {
    resolveWaiterFromPin();
  });

  state.openWaiterPinPicker = openWaiterPinPicker;
}

function getOrderKeyFromTable(state, table) {
  const staticOrderKey = table.dataset.orderKey;
  if (staticOrderKey) return staticOrderKey;
  const grid = table.closest("[id^='tablesGrid']");
  const planKey = getPlanKeyByGrid(state, grid) || "plan";
  return `${planKey}:${table.dataset.tableId}`;
}

function getTableLabel(table) {
  return table.dataset.tableLabel || table.dataset.tableId || table.textContent.trim();
}

function getStaticPlanConfig(planKey) {
  const number = planKey.replace("static", "");
  return {
    boardId: `staticPlanBoard${number}`,
    orderPrefix: `${planKey}:`,
    planLabel: `Plano ${number}`,
  };
}

function ensureStaticPlanState(state, planKey) {
  if (!state.staticPlanTableState[planKey]) {
    state.staticPlanTableState[planKey] = { nextTableNumber: 1, tables: [] };
  }
  return state.staticPlanTableState[planKey];
}

function setStaticTableOccupiedClass(button, occupied) {
  if (!button) return;
  button.className = occupied
    ? "h-10 w-10 rounded-md border border-rose-500 bg-rose-100 text-[10px] font-semibold leading-none text-rose-800 transition hover:border-rose-600 hover:bg-rose-200"
    : "h-10 w-10 rounded-md border border-emerald-500 bg-emerald-100 text-[10px] font-semibold leading-none text-emerald-800 transition hover:border-emerald-600 hover:bg-emerald-200";
}

function renderStaticPlanBoard(state, planKey) {
  const config = getStaticPlanConfig(planKey);
  const board = document.getElementById(config.boardId);
  if (!board) return;
  const planState = ensureStaticPlanState(state, planKey);
  board.replaceChildren();
  planState.tables.forEach((tableNumber) => {
    const orderKey = `${config.orderPrefix}${tableNumber}`;
    const items = state.ordersByTable[orderKey] || [];
    const occupied = items.some((item) => !item.deleted && Number(item.qty || 0) > 0);
    const style = occupied
      ? "border-rose-500 bg-rose-100 text-rose-800 hover:border-rose-600 hover:bg-rose-200"
      : "border-emerald-500 bg-emerald-100 text-emerald-800 hover:border-emerald-600 hover:bg-emerald-200";
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.staticTable = "";
    button.dataset.orderKey = orderKey;
    button.dataset.tableLabel = String(tableNumber);
    button.className = `h-10 w-10 rounded-md border text-[10px] font-semibold leading-none transition ${style}`;
    button.setAttribute("aria-label", `Mesa ${tableNumber}`);
    button.textContent = String(tableNumber);
    board.appendChild(button);
  });
}

function hasActiveItems(items) {
  return (items || []).some((item) => !item.deleted && Number(item.qty || 0) > 0);
}

export function commitPendingStaticTableDraft(state) {
  const draft = state.pendingStaticTableDraft;
  if (!draft) return false;

  const items = state.ordersByTable[draft.orderKey] || [];
  if (!hasActiveItems(items)) return false;

  const planState = ensureStaticPlanState(state, draft.planKey);
  if (!planState.tables.includes(draft.tableNumber)) {
    planState.tables.push(draft.tableNumber);
    planState.tables.sort((a, b) => a - b);
  }
  if (planState.nextTableNumber <= draft.tableNumber) {
    planState.nextTableNumber = draft.tableNumber + 1;
  }

  renderStaticPlanBoard(state, draft.planKey);
  state.pendingStaticTableDraft = null;
  return true;
}

export function discardPendingStaticTableDraftIfEmpty(state) {
  const draft = state.pendingStaticTableDraft;
  if (!draft) return;
  if (commitPendingStaticTableDraft(state)) return;

  delete state.ordersByTable[draft.orderKey];
  delete state.metaByTable[draft.orderKey];
  if (state.currentOrderKey === draft.orderKey) {
    state.currentOrderKey = null;
    state.selectedOrderProductId = null;
  }
  state.pendingStaticTableDraft = null;
}

function openOrderModalForTable(state, table, waiterName) {
  const tableNumber = getTableLabel(table);
  state.currentOrderKey = getOrderKeyFromTable(state, table);
  state.selectedOrderProductId = null;
  state.catalogPaletteOpen = false;
  ensureOrderMeta(state, state.currentOrderKey);
  if (waiterName) {
    if (!state.waiters.includes(waiterName)) {
      state.waiters = [...state.waiters, waiterName];
    }
    state.metaByTable[state.currentOrderKey].waiterName = waiterName;
  }
  renderWaiters(state);
  renderOrderCategories(state);
  renderCatalogLockUI(state);
  renderCatalogPaintUI(state);
  document.getElementById("orderModalTitle").textContent = `Mesa ${tableNumber}`;
  openModal(state, state.orderModal, {
    panel: document.getElementById("orderModalPanel"),
    title: document.getElementById("orderModalTitle"),
  });
  requestAnimationFrame(() => renderCatalog(state));
  requestAnimationFrame(() => requestAnimationFrame(() => renderCatalog(state)));
  renderOrderModal(state);
}

export function openTableOrderModal(state, table) {
  if (!table || state.dragState || state.tableJustDragged) return;
  const tableNumber = table.dataset.tableId || table.textContent.trim();
  const orderKey = getOrderKeyFromTable(state, table);
  ensureOrderMeta(state, orderKey);
  if (canBypassWaiterPin(state)) {
    const waiterName = state.metaByTable[orderKey]?.waiterName || state.waiters[0] || "Terminal";
    openOrderModalForTable(state, table, waiterName);
    return;
  }
  if (typeof state.openWaiterPinPicker !== "function") return;
  state.openWaiterPinPicker(`Codigo mozo - Mesa ${tableNumber}`, (waiterName) => {
    openOrderModalForTable(state, table, waiterName);
  });
}

export function closeOrderModal(state) {
  closeModal(state, state.orderModal, { panel: document.getElementById("orderModalPanel") });
}

export function openStaticPlanWaiterModal(state, planLabel) {
  if (!state.permissions?.canEditPlans) return;
  const numberMatch = String(planLabel || "").match(/\d+/);
  const planNumber = numberMatch ? numberMatch[0] : "3";
  const planKey = `static${planNumber}`;
  state.pendingStaticPlanKey = planKey;
  ensureStaticPlanState(state, planKey);

  if (canBypassWaiterPin(state)) {
    const selectedPlanKey = state.pendingStaticPlanKey;
    if (!selectedPlanKey) return;
    const planState = ensureStaticPlanState(state, selectedPlanKey);
    const tableNumber = planState.nextTableNumber;
    const orderKey = `${getStaticPlanConfig(selectedPlanKey).orderPrefix}${tableNumber}`;
    state.pendingStaticTableDraft = {
      planKey: selectedPlanKey,
      tableNumber,
      orderKey,
    };
    const tableLike = {
      dataset: {
        orderKey,
        tableLabel: String(tableNumber),
      },
      textContent: String(tableNumber),
      closest: () => null,
    };
    openOrderModalForTable(state, tableLike, state.waiters[0] || "Terminal");
    return;
  }

  if (typeof state.openWaiterPinPicker !== "function") return;
  state.openWaiterPinPicker(`Codigo mozo - ${planLabel}`, (waiterName) => {
    const selectedPlanKey = state.pendingStaticPlanKey;
    if (!selectedPlanKey) return;
    const planState = ensureStaticPlanState(state, selectedPlanKey);
    const tableNumber = planState.nextTableNumber;
    const orderKey = `${getStaticPlanConfig(selectedPlanKey).orderPrefix}${tableNumber}`;
    state.pendingStaticTableDraft = {
      planKey: selectedPlanKey,
      tableNumber,
      orderKey,
    };
    const tableLike = {
      dataset: {
        orderKey,
        tableLabel: String(tableNumber),
      },
      textContent: String(tableNumber),
      closest: () => null,
    };
    openOrderModalForTable(state, tableLike, waiterName);
  });
}

export function openStaticTableOrderModal(state, table) {
  if (!table || state.dragState || state.tableJustDragged) return;
  const orderKey = getOrderKeyFromTable(state, table);
  ensureOrderMeta(state, orderKey);
  if (canBypassWaiterPin(state)) {
    const waiterName = state.metaByTable[orderKey]?.waiterName || state.waiters[0] || "Terminal";
    openOrderModalForTable(state, table, waiterName);
    return;
  }
  if (typeof state.openWaiterPinPicker !== "function") return;
  state.openWaiterPinPicker(`Codigo mozo - Mesa ${getTableLabel(table)}`, (resolvedWaiterName) => {
    openOrderModalForTable(state, table, resolvedWaiterName);
  });
}

export function initQuickCatalogModals(state) {
  const rightPanelActions = state.openCashModal?.parentElement;
  if (rightPanelActions && state.permissions?.canManageCatalog && !document.getElementById("openManageProductsModal")) {
    const manageProductsButton = document.createElement("button");
    manageProductsButton.id = "openManageProductsModal";
    manageProductsButton.type = "button";
    manageProductsButton.className =
      "flex h-10 w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-zinc-700";
    manageProductsButton.textContent = "Gestionar articulos";

    const addWaiterButton = document.createElement("button");
    addWaiterButton.id = "openAddWaiterModal";
    addWaiterButton.type = "button";
    addWaiterButton.className =
      "flex h-10 w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-zinc-700";
    addWaiterButton.textContent = "Personal";

    rightPanelActions.appendChild(manageProductsButton);
    if (state.permissions?.canManageStaff) {
      rightPanelActions.appendChild(addWaiterButton);
    }
  }
  if (!state.permissions?.canManageCatalog) {
    const manageProductsButton = document.getElementById("openManageProductsModal");
    if (manageProductsButton) manageProductsButton.classList.add("hidden");
  }
  if (!state.permissions?.canManageStaff) {
    const addWaiterButton = document.getElementById("openAddWaiterModal");
    if (addWaiterButton) addWaiterButton.classList.add("hidden");
  }

  const addProductModal = document.createElement("div");
  addProductModal.className =
    "fixed inset-0 z-[85] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  addProductModal.innerHTML = `
    <div class="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 id="newProductModalTitle" class="text-base font-semibold text-zinc-900">Agregar articulo</h3>
      <p id="newProductModeHint" class="mt-1 text-xs text-zinc-500">Completa el formulario para crear un nuevo producto.</p>
      <label for="newProductSearch" class="mt-3 block text-xs font-semibold text-zinc-600">Buscar producto existente</label>
      <input id="newProductSearch" type="text" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Buscar producto existente" />
      <div id="newProductSearchResults" class="mt-2 max-h-28 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-1 text-xs text-zinc-600"></div>
      <label for="newProductName" class="mt-3 block text-xs font-semibold text-zinc-600">Nombre del producto</label>
      <input id="newProductName" type="text" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Nombre del producto" />
      <label for="newProductDescription" class="mt-2 block text-xs font-semibold text-zinc-600">Descripcion</label>
      <textarea id="newProductDescription" rows="2" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Descripcion del producto"></textarea>

      <div class="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label for="newProductPrice" class="block text-xs font-semibold text-zinc-600">Precio</label>
          <input id="newProductPrice" type="number" min="1" step="0.01" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Precio" />
        </div>
        <div>
          <label for="newProductTaxRate" class="block text-xs font-semibold text-zinc-600">IVA</label>
          <select id="newProductTaxRate" class="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="21">IVA 21%</option>
          </select>
        </div>
      </div>

      <div class="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <label for="newProductRubro" class="block text-xs font-semibold text-zinc-600">Rubro</label>
          <input id="newProductRubro" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Rubro" />
        </div>
        <div>
          <label for="newProductSubrubro" class="block text-xs font-semibold text-zinc-600">Subrubro</label>
          <input id="newProductSubrubro" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Subrubro" />
        </div>
        <div>
          <label for="newProductType" class="block text-xs font-semibold text-zinc-600">Tipo</label>
          <input id="newProductType" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Tipo" />
        </div>
      </div>

      <label for="newProductPrinters" class="mt-2 block text-xs font-semibold text-zinc-600">Comanderas (hasta 3)</label>
      <select id="newProductPrinters" multiple class="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
        <option value="comanda salon">Comanda salon</option>
        <option value="comanda cocina">Comanda cocina</option>
        <option value="comanda barra">Comanda barra</option>
      </select>
      <p class="mt-1 text-[11px] text-zinc-500">Usa Ctrl/Cmd + click para seleccionar varias.</p>

      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <label class="flex items-center justify-between rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700">
          <span>Mostrar en menu digital</span>
          <span class="relative inline-flex items-center">
            <input id="newProductShowInMenu" type="checkbox" checked class="peer sr-only" />
            <span class="h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-emerald-500"></span>
            <span class="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5"></span>
          </span>
        </label>
        <label class="flex items-center justify-between rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700">
          <span>Mostrar en delivery</span>
          <span class="relative inline-flex items-center">
            <input id="newProductShowInDelivery" type="checkbox" checked class="peer sr-only" />
            <span class="h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-emerald-500"></span>
            <span class="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5"></span>
          </span>
        </label>
      </div>

      <label for="newProductImageFile" class="mt-2 block text-xs font-semibold text-zinc-600">Foto del producto</label>
      <input id="newProductImageFile" type="file" accept="image/png,image/jpeg,image/webp" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      <p class="text-[11px] text-zinc-500">Foto del producto (png, jpg o webp, max 3MB).</p>
      <div class="mt-2">
        <p class="text-[11px] font-semibold text-zinc-600">Vista previa (100x100)</p>
        <img
          id="newProductImagePreview"
          src=""
          alt="Vista previa del producto"
          class="mt-1 hidden h-[100px] w-[100px] rounded-md border border-zinc-200 object-cover"
        />
      </div>

      <p id="newProductError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex items-center justify-between gap-2">
        <button id="deleteProductButton" type="button" class="hidden rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">Eliminar</button>
        <div class="flex gap-2">
        <button id="cancelNewProduct" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="saveNewProduct" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(addProductModal);
  state.addProductModal = addProductModal;

  const quickAddProductModal = document.createElement("div");
  quickAddProductModal.className =
    "fixed inset-0 z-[86] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  quickAddProductModal.innerHTML = `
    <div class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Agregar producto a categoria</h3>
      <p id="quickAddProductHint" class="mt-1 text-xs text-zinc-500"></p>
      <label for="quickAddProductSearch" class="mt-3 block text-xs font-semibold text-zinc-600">Buscar producto</label>
      <input id="quickAddProductSearch" type="text" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Buscar producto existente" />
      <div id="quickAddProductResults" class="mt-2 max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-1 text-xs text-zinc-600"></div>
      <p id="quickAddProductError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelQuickAddProduct" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="confirmQuickAddProduct" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Agregar seleccionado</button>
      </div>
    </div>`;
  document.body.appendChild(quickAddProductModal);
  state.quickAddProductModal = quickAddProductModal;

  const addWaiterModal = document.createElement("div");
  addWaiterModal.className =
    "fixed inset-0 z-[85] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  addWaiterModal.innerHTML = `
    <div class="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Gestion de personal</h3>
      <p class="mt-1 text-xs text-zinc-500">Crear, editar o eliminar empleados. Los de rol mozo aparecen en selector de mesa.</p>
      <label for="staffSearch" class="mt-3 block text-xs font-semibold text-zinc-600">Buscar personal</label>
      <input id="staffSearch" type="text" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Buscar personal por nombre o usuario" />
      <div id="staffSearchResults" class="mt-2 max-h-28 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-1 text-xs text-zinc-600"></div>

      <div class="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label for="staffFirstName" class="block text-xs font-semibold text-zinc-600">Nombre</label>
          <input id="staffFirstName" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Nombre" />
        </div>
        <div>
          <label for="staffLastName" class="block text-xs font-semibold text-zinc-600">Apellido</label>
          <input id="staffLastName" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Apellido" />
        </div>
      </div>
      <label for="staffAddress" class="mt-2 block text-xs font-semibold text-zinc-600">Direccion</label>
      <input id="staffAddress" type="text" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Direccion" />
      <div class="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label for="staffPhone" class="block text-xs font-semibold text-zinc-600">Telefono</label>
          <input id="staffPhone" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Telefono" />
        </div>
        <div>
          <label for="staffEmergencyPhone" class="block text-xs font-semibold text-zinc-600">Telefono de emergencia</label>
          <input id="staffEmergencyPhone" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Telefono de emergencia" />
        </div>
      </div>
      <div class="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <label for="staffUsername" class="block text-xs font-semibold text-zinc-600">Usuario</label>
          <input id="staffUsername" type="text" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Usuario" />
        </div>
        <div>
          <label for="staffPinCode" class="block text-xs font-semibold text-zinc-600">Codigo de 4 digitos</label>
          <input id="staffPinCode" type="text" maxlength="4" class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Codigo 4 digitos" />
        </div>
        <div>
          <label for="staffRole" class="block text-xs font-semibold text-zinc-600">Rol</label>
          <select id="staffRole" class="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="mozo">Mozo</option>
            <option value="cocina">Cocina</option>
            <option value="cajero">Cajero</option>
            <option value="gerente">Gerente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <p id="newWaiterError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex items-center justify-between gap-2">
        <button id="deleteStaffButton" type="button" class="hidden rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">Eliminar</button>
        <div class="flex justify-end gap-2">
        <button id="cancelNewWaiter" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="saveNewWaiter" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Guardar personal</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(addWaiterModal);
  state.addWaiterModal = addWaiterModal;

  const addCategoryModal = document.createElement("div");
  addCategoryModal.className =
    "fixed inset-0 z-[86] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  addCategoryModal.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Agregar categoria</h3>
      <input id="newCategoryName" type="text" class="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Ej: Bebidas" />
      <p id="newCategoryError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelNewCategory" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="saveNewCategory" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(addCategoryModal);
  state.addCategoryModal = addCategoryModal;

  const deleteCategoryModal = document.createElement("div");
  deleteCategoryModal.className =
    "fixed inset-0 z-[86] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  deleteCategoryModal.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Eliminar categoria</h3>
      <select id="deleteCategorySelect" class="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"></select>
      <p class="mt-2 text-xs text-zinc-500">Los productos pasan a otra categoria (Varios o la primera disponible).</p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelDeleteCategory" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="confirmDeleteCategory" type="button" class="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">Eliminar</button>
      </div>
    </div>`;
  document.body.appendChild(deleteCategoryModal);

  const deleteProductConfirmModal = document.createElement("div");
  deleteProductConfirmModal.className =
    "fixed inset-0 z-[87] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  deleteProductConfirmModal.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Eliminar producto</h3>
      <p id="deleteProductConfirmText" class="mt-2 text-sm text-zinc-600">Confirma la eliminacion del producto seleccionado.</p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelDeleteProductConfirm" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="confirmDeleteProductConfirm" type="button" class="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">Eliminar</button>
      </div>
    </div>
  `;
  document.body.appendChild(deleteProductConfirmModal);

  const toggleSimpleModal = (modal, open) => {
    const panel = modal.querySelector(":scope > div");
    const title = panel ? panel.querySelector("h1, h2, h3, h4") : null;
    if (open) {
      openModal(state, modal, { panel, title });
      return;
    }
    closeModal(state, modal, { panel });
  };

  let selectedProductId = null;
  let productModalCategoryContext = null;
  let quickAddSelectedProductId = null;
  let quickAddCategoryContext = null;
  let selectedStaffId = null;

  const normalizeBackendProduct = (product, fallback = {}) => ({
    id: String(product.id),
    name: product.name,
    price: Number(product.price),
    category: fallback.category || "Varios",
    description: product.description || "",
    taxRate: Number(product.tax_rate ?? fallback.taxRate ?? 21),
    rubro: product.rubro || fallback.rubro || "",
    subrubro: product.subrubro || fallback.subrubro || "",
    productType: product.product_type || fallback.productType || "",
    printerTargets: Array.isArray(product.printer_targets)
      ? product.printer_targets
      : (fallback.printerTargets || []),
    showInMenu: Boolean(product.show_in_menu),
    showInDelivery: Boolean(product.show_in_delivery),
    imageUrl: product.image_url || fallback.imageUrl || "",
  });

  const notifyProductsChanged = () => {
    window.dispatchEvent(
      new CustomEvent("products:changed", {
        detail: { products: state.productsCatalog.slice() },
      })
    );
  };

  const resolveProductImageUrl = (value) => {
    if (!value) return "";
    if (/^data:image\//i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return `${BACKEND_BASE_URL}${value}`;
    return `${BACKEND_BASE_URL}/${value}`;
  };

  const setProductImagePreview = (url) => {
    const preview = document.getElementById("newProductImagePreview");
    if (!preview) return;
    if (!url) {
      preview.src = "";
      preview.classList.add("hidden");
      return;
    }
    preview.src = url;
    preview.classList.remove("hidden");
  };

  const setProductModalMode = (product = null) => {
    const title = document.getElementById("newProductModalTitle");
    const hint = document.getElementById("newProductModeHint");
    const saveBtn = document.getElementById("saveNewProduct");
    const deleteBtn = document.getElementById("deleteProductButton");
    if (!title || !hint || !saveBtn || !deleteBtn) return;

    if (product) {
      title.textContent = "Editar articulo";
      hint.textContent = `Editando: ${product.name}`;
      saveBtn.textContent = "Guardar cambios";
      deleteBtn.classList.remove("hidden");
      return;
    }

    title.textContent = "Agregar articulo";
    const categoryLabel = normalizeCategory(productModalCategoryContext || getActiveCatalogCategory(state) || "Varios");
    hint.textContent = `Nuevo producto en categoria: ${categoryLabel}`;
    saveBtn.textContent = "Guardar";
    deleteBtn.classList.add("hidden");
  };

  const getSelectedPrinterTargets = () => {
    const printersSelect = document.getElementById("newProductPrinters");
    if (!printersSelect) return [];
    return Array.from(printersSelect.selectedOptions)
      .map((option) => option.value)
      .filter((value) => PRINTER_TARGET_OPTIONS.includes(value));
  };

  const syncProductVisibilityControls = () => {
    const showMenu = document.getElementById("newProductShowInMenu")?.checked;
    const showDelivery = document.getElementById("newProductShowInDelivery")?.checked;
    const imageInput = document.getElementById("newProductImageFile");
    if (!imageInput) return;

    const canSetImage = Boolean(showMenu || showDelivery);
    imageInput.disabled = !canSetImage;
    imageInput.classList.toggle("bg-zinc-100", !canSetImage);
  };

  const getStaffDisplayName = (staff) => {
    const first = String(staff?.name || "").trim();
    const last = String(staff?.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    return full || String(staff?.username || staff?.email || "Sin nombre").trim();
  };

  const syncWaitersFromStaff = () => {
    const waiterNames = (state.staffMembers || [])
      .filter((staff) => String(staff.role || "").toLowerCase() === "mozo")
      .map((staff) => getStaffDisplayName(staff))
      .filter(Boolean);
    const unique = [...new Set(waiterNames)];
    state.waiters = canBypassWaiterPin(state) ? ["Terminal", ...unique] : unique;
    renderWaiters(state);
  };

  const resetStaffForm = () => {
    selectedStaffId = null;
    document.getElementById("staffSearch").value = "";
    document.getElementById("staffFirstName").value = "";
    document.getElementById("staffLastName").value = "";
    document.getElementById("staffAddress").value = "";
    document.getElementById("staffPhone").value = "";
    document.getElementById("staffEmergencyPhone").value = "";
    document.getElementById("staffUsername").value = "";
    document.getElementById("staffPinCode").value = "";
    document.getElementById("staffRole").value = "mozo";
    document.getElementById("deleteStaffButton").classList.add("hidden");
    document.getElementById("saveNewWaiter").textContent = "Guardar personal";
    const err = document.getElementById("newWaiterError");
    err.textContent = "";
    err.classList.add("hidden");
  };

  const renderStaffSearchResults = () => {
    const query = document.getElementById("staffSearch")?.value.trim().toLowerCase() || "";
    const results = document.getElementById("staffSearchResults");
    if (!results) return;

    const source = Array.isArray(state.staffMembers) ? state.staffMembers : [];
    const matches = query
      ? source.filter((staff) => {
        const haystack = `${getStaffDisplayName(staff)} ${staff.username || ""} ${staff.role || ""}`.toLowerCase();
        return haystack.includes(query);
      })
      : source.slice(0, 12);

    results.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "px-2 py-1 text-zinc-500";
      empty.textContent = "Sin resultados";
      results.appendChild(empty);
      return;
    }

    matches.slice(0, 20).forEach((staff) => {
      const row = document.createElement("button");
      row.type = "button";
      row.dataset.staffId = String(staff.id);
      row.className = "mb-1 block w-full rounded-md px-2 py-1 text-left hover:bg-zinc-100";
      if (String(selectedStaffId) === String(staff.id)) {
        row.classList.add("bg-emerald-50", "text-emerald-800");
      }
      row.textContent = `${getStaffDisplayName(staff)} (${staff.role || "sin rol"})`;
      results.appendChild(row);
    });
  };

  const resetProductForm = () => {
    selectedProductId = null;
    document.getElementById("newProductSearch").value = "";
    document.getElementById("newProductName").value = "";
    document.getElementById("newProductDescription").value = "";
    document.getElementById("newProductPrice").value = "";
    document.getElementById("newProductTaxRate").value = "21";
    document.getElementById("newProductRubro").value = "";
    document.getElementById("newProductSubrubro").value = "";
    document.getElementById("newProductType").value = "";
    document.getElementById("newProductShowInMenu").checked = true;
    document.getElementById("newProductShowInDelivery").checked = true;
    document.getElementById("newProductImageFile").value = "";
    const printersSelect = document.getElementById("newProductPrinters");
    Array.from(printersSelect.options).forEach((option) => {
      option.selected = false;
    });
    syncProductVisibilityControls();
    setProductModalMode(null);
    setProductImagePreview("");
  };

  const setDeleteProductConfirmText = () => {
    const text = document.getElementById("deleteProductConfirmText");
    if (!text) return;
    const product = state.productsCatalog.find((item) => item.id === selectedProductId);
    const productName = product?.name || "este producto";
    text.textContent = `Confirma la eliminacion de ${productName}.`;
  };

  const deleteSelectedProduct = async () => {
    const err = document.getElementById("newProductError");
    const deleteBtn = document.getElementById("deleteProductButton");
    err.textContent = "";
    err.classList.add("hidden");

    if (!selectedProductId) {
      err.textContent = "Selecciona un producto para eliminar.";
      err.classList.remove("hidden");
      return false;
    }

    deleteBtn.disabled = true;
    deleteBtn.classList.add("opacity-70");
    try {
      const accessToken = localStorage.getItem("accessToken");
      const rawResponse = await fetch(`${BACKEND_BASE_URL}/api/products/${selectedProductId}`, {
        method: "DELETE",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const response = await rawResponse.json().catch(() => ({}));
      if (!rawResponse.ok) {
        throw { message: response.message || "No se pudo eliminar el producto." };
      }

      state.productsCatalog = state.productsCatalog.filter((item) => item.id !== selectedProductId);
      Object.values(state.catalogHiddenByCategory || {}).forEach((hiddenMap) => {
        if (hiddenMap && typeof hiddenMap === "object") {
          delete hiddenMap[selectedProductId];
        }
      });
      Object.values(state.catalogLayoutByCategory || {}).forEach((layoutMap) => {
        if (layoutMap && typeof layoutMap === "object") {
          delete layoutMap[selectedProductId];
        }
      });
      selectedProductId = null;

      renderOrderCategories(state);
      if (state.orderModal && !state.orderModal.classList.contains("hidden")) {
        renderCatalog(state);
      }
      notifyProductsChanged();
      resetProductForm();
      renderProductSearchResults();
      toggleSimpleModal(addProductModal, false);
      return true;
    } catch (error) {
      err.textContent = error?.message || "No se pudo eliminar el producto.";
      err.classList.remove("hidden");
      return false;
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.classList.remove("opacity-70");
    }
  };

  const openAddProductModalForFocusedCategory = () => {
    productModalCategoryContext = normalizeCategory(getActiveCatalogCategory(state) || "Varios");
    resetProductForm();
    renderProductSearchResults();
    toggleSimpleModal(addProductModal, true);
  };

  const renderQuickAddSearchResults = () => {
    const query = document.getElementById("quickAddProductSearch")?.value.trim().toLowerCase() || "";
    const results = document.getElementById("quickAddProductResults");
    if (!results) return;
    const matches = query
      ? state.productsCatalog.filter((product) => product.name.toLowerCase().includes(query))
      : state.productsCatalog.slice(0, 12);

    results.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "px-2 py-1 text-zinc-500";
      empty.textContent = "Sin resultados";
      results.appendChild(empty);
      return;
    }

    matches.slice(0, 20).forEach((product) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.quickAddProductId = product.id;
      button.className =
        "mb-1 block w-full rounded-md px-2 py-1 text-left hover:bg-zinc-100";
      const category = product.category && product.category !== "__none__" ? product.category : "Sin categoria";
      button.textContent = `${product.name} - ${category}`;
      if (quickAddSelectedProductId === product.id) {
        button.classList.add("bg-emerald-50", "text-emerald-800");
      }
      results.appendChild(button);
    });
  };

  const openQuickAddProductModalForFocusedCategory = () => {
    quickAddCategoryContext = normalizeCategory(getActiveCatalogCategory(state) || "Varios");
    quickAddSelectedProductId = null;
    const hint = document.getElementById("quickAddProductHint");
    const error = document.getElementById("quickAddProductError");
    const search = document.getElementById("quickAddProductSearch");
    if (hint) hint.textContent = `Categoria en foco: ${quickAddCategoryContext}`;
    if (error) {
      error.textContent = "";
      error.classList.add("hidden");
    }
    if (search) search.value = "";
    renderQuickAddSearchResults();
    toggleSimpleModal(quickAddProductModal, true);
  };

  const renderProductSearchResults = () => {
    const query = document.getElementById("newProductSearch")?.value.trim().toLowerCase() || "";
    const results = document.getElementById("newProductSearchResults");
    if (!results) return;
    const matches = query
      ? state.productsCatalog.filter((product) => product.name.toLowerCase().includes(query))
      : state.productsCatalog.slice(0, 8);
    results.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "px-2 py-1 text-zinc-500";
      empty.textContent = "Sin resultados";
      results.appendChild(empty);
      return;
    }

    matches.slice(0, 12).forEach((product) => {
      const rubroLabel = product.rubro ? ` - ${product.rubro}` : "";
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.searchProductId = product.id;
      button.className = "mb-1 block w-full rounded-md px-2 py-1 text-left hover:bg-zinc-100";
      button.textContent = `${product.name}${rubroLabel}`;
      results.appendChild(button);
    });
  };

  const catalogBoardMenu = document.createElement("div");
  catalogBoardMenu.id = "catalogBoardContextMenu";
  catalogBoardMenu.className =
    "fixed z-[87] hidden min-w-[160px] rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl";
  catalogBoardMenu.innerHTML =
    '<button id="openAddProductFromCatalogMenu" type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50">Agregar producto</button>' +
    '<button id="openManageProductsFromCatalogMenu" type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100">Gestionar articulos</button>' +
    '<button id="deleteCatalogProductAction" type="button" class="hidden w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50">Eliminar producto</button>';
  document.body.appendChild(catalogBoardMenu);

  const hideCatalogBoardMenu = () => catalogBoardMenu.classList.add("hidden");
  let catalogContextProductId = null;

  document.getElementById("openManageProductsModal")?.addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    openAddProductModalForFocusedCategory();
  });
  document.getElementById("openAddWaiterModal")?.addEventListener("click", () => {
    if (!state.permissions?.canManageStaff) return;
    resetStaffForm();
    renderStaffSearchResults();
    toggleSimpleModal(addWaiterModal, true);
  });
  const categoryMenuToggle = document.getElementById("categoryMenuToggle");
  const categoryMenuPanel = document.getElementById("categoryMenuPanel");
  const closeCategoryMenu = () => {
    if (!categoryMenuPanel || !categoryMenuToggle) return;
    categoryMenuPanel.classList.add("hidden");
    categoryMenuToggle.setAttribute("aria-expanded", "false");
  };
  categoryMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = categoryMenuPanel.classList.toggle("hidden");
    categoryMenuToggle.setAttribute("aria-expanded", String(!open));
  });
  document.addEventListener("pointerdown", (event) => {
    if (!categoryMenuPanel || !categoryMenuToggle) return;
    if (categoryMenuPanel.classList.contains("hidden")) return;
    if (categoryMenuPanel.contains(event.target) || categoryMenuToggle.contains(event.target)) return;
    closeCategoryMenu();
  });

  document.getElementById("openAddCategoryModal")?.addEventListener("click", () => {
    closeCategoryMenu();
    toggleSimpleModal(addCategoryModal, true);
  });
  document.getElementById("newProductSearch").addEventListener("input", renderProductSearchResults);
  document.getElementById("staffSearch").addEventListener("input", renderStaffSearchResults);
  document.getElementById("staffSearchResults").addEventListener("click", (event) => {
    const row = event.target.closest("[data-staff-id]");
    if (!row) return;
    const selected = (state.staffMembers || []).find((staff) => String(staff.id) === String(row.dataset.staffId));
    if (!selected) return;
    selectedStaffId = String(selected.id);
    document.getElementById("staffFirstName").value = selected.name || "";
    document.getElementById("staffLastName").value = selected.last_name || "";
    document.getElementById("staffAddress").value = selected.address || "";
    document.getElementById("staffPhone").value = selected.phone || "";
    document.getElementById("staffEmergencyPhone").value = selected.emergency_phone || "";
    document.getElementById("staffUsername").value = selected.username || "";
    document.getElementById("staffPinCode").value = selected.pin_code || "";
    document.getElementById("staffRole").value = selected.role || "mozo";
    document.getElementById("deleteStaffButton").classList.remove("hidden");
    document.getElementById("saveNewWaiter").textContent = "Guardar cambios";
    renderStaffSearchResults();
  });
  document.getElementById("quickAddProductSearch").addEventListener("input", renderQuickAddSearchResults);
  document.getElementById("quickAddProductResults").addEventListener("click", (event) => {
    const row = event.target.closest("[data-quick-add-product-id]");
    if (!row) return;
    quickAddSelectedProductId = row.dataset.quickAddProductId;
    renderQuickAddSearchResults();
  });
  document.getElementById("confirmQuickAddProduct").addEventListener("click", () => {
    const error = document.getElementById("quickAddProductError");
    if (error) {
      error.textContent = "";
      error.classList.add("hidden");
    }
    if (!quickAddSelectedProductId) {
      if (error) {
        error.textContent = "Selecciona un producto para agregar.";
        error.classList.remove("hidden");
      }
      return;
    }
    const targetCategory = normalizeCategory(quickAddCategoryContext || getActiveCatalogCategory(state) || "Varios");
    const selected = state.productsCatalog.find((item) => item.id === quickAddSelectedProductId);
    if (!selected) {
      if (error) {
        error.textContent = "El producto seleccionado no existe.";
        error.classList.remove("hidden");
      }
      return;
    }

    selected.category = targetCategory;
    if (!state.catalogHiddenByCategory[targetCategory]) {
      state.catalogHiddenByCategory[targetCategory] = Object.create(null);
    }
    delete state.catalogHiddenByCategory[targetCategory][selected.id];

    state.selectedCatalogCategory = targetCategory;
    renderOrderCategories(state);
    renderCatalog(state);
    notifyProductsChanged();
    toggleSimpleModal(quickAddProductModal, false);
  });
  document.getElementById("cancelQuickAddProduct").addEventListener("click", () => toggleSimpleModal(quickAddProductModal, false));
  document.getElementById("newProductShowInMenu").addEventListener("change", syncProductVisibilityControls);
  document.getElementById("newProductShowInDelivery").addEventListener("change", syncProductVisibilityControls);
  document.getElementById("newProductImageFile").addEventListener("change", () => {
    const imageFileInput = document.getElementById("newProductImageFile");
    const imageFile = imageFileInput?.files?.[0] || null;
    if (!imageFile) {
      setProductImagePreview("");
      return;
    }
    setProductImagePreview(URL.createObjectURL(imageFile));
  });
  document.getElementById("newProductSearchResults").addEventListener("click", (event) => {
    const row = event.target.closest("[data-search-product-id]");
    if (!row) return;
    const product = state.productsCatalog.find((item) => item.id === row.dataset.searchProductId);
    if (!product) return;
    selectedProductId = product.id;
    document.getElementById("newProductName").value = product.name;
    document.getElementById("newProductPrice").value = String(product.price);
    document.getElementById("newProductDescription").value = product.description || "";
    document.getElementById("newProductTaxRate").value = String(product.taxRate || 21);
    document.getElementById("newProductRubro").value = product.rubro || "";
    document.getElementById("newProductSubrubro").value = product.subrubro || "";
    document.getElementById("newProductType").value = product.productType || "";
    document.getElementById("newProductShowInMenu").checked =
      product.showInMenu !== undefined ? Boolean(product.showInMenu) : true;
    document.getElementById("newProductShowInDelivery").checked =
      product.showInDelivery !== undefined ? Boolean(product.showInDelivery) : true;
    document.getElementById("newProductImageFile").value = "";
    const selectedPrinters = Array.isArray(product.printerTargets) ? product.printerTargets : [];
    Array.from(document.getElementById("newProductPrinters").options).forEach((option) => {
      option.selected = selectedPrinters.includes(option.value);
    });
    setProductModalMode(product);
    syncProductVisibilityControls();
    setProductImagePreview(resolveProductImageUrl(product.imageUrl || ""));
  });
  document.getElementById("orderCategoryChips")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-category-chip]");
    if (!chip) return;
    const chipCategory = normalizeCategory(chip.dataset.categoryChip);
    if (!chipCategory || !categoryExists(state, chipCategory)) return;

    if (state.catalogPaintColor && !state.catalogLocked) {
      const categoryToPaint = chipCategory;
      state.catalogCategoryColors[categoryToPaint] = state.catalogPaintColor;
      renderOrderCategories(state);
      return;
    }

    state.selectedCatalogCategory = chipCategory;
    renderOrderCategories(state);
    renderCatalog(state);
  });
  document.getElementById("removeCategoryButton")?.addEventListener("click", () => {
    closeCategoryMenu();
    if (state.categories.length <= 1) return;
    renderOrderCategories(state);
    toggleSimpleModal(deleteCategoryModal, true);
  });
  document.getElementById("cancelNewProduct").addEventListener("click", () => toggleSimpleModal(addProductModal, false));
  document.getElementById("deleteProductButton").addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    const err = document.getElementById("newProductError");
    err.textContent = "";
    err.classList.add("hidden");

    if (!selectedProductId) {
      err.textContent = "Selecciona un producto para eliminar.";
      err.classList.remove("hidden");
      return;
    }
    setDeleteProductConfirmText();
    toggleSimpleModal(deleteProductConfirmModal, true);
  });
  document.getElementById("cancelDeleteProductConfirm").addEventListener("click", () => {
    toggleSimpleModal(deleteProductConfirmModal, false);
  });
  document.getElementById("confirmDeleteProductConfirm").addEventListener("click", async () => {
    const confirmBtn = document.getElementById("confirmDeleteProductConfirm");
    confirmBtn.disabled = true;
    confirmBtn.classList.add("opacity-70");
    try {
      const deleted = await deleteSelectedProduct();
      if (deleted) {
        toggleSimpleModal(deleteProductConfirmModal, false);
      }
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.classList.remove("opacity-70");
    }
  });
  document.getElementById("cancelNewWaiter").addEventListener("click", () => toggleSimpleModal(addWaiterModal, false));
  document.getElementById("cancelNewCategory").addEventListener("click", () => toggleSimpleModal(addCategoryModal, false));
  document.getElementById("cancelDeleteCategory").addEventListener("click", () => toggleSimpleModal(deleteCategoryModal, false));

  document.getElementById("catalogBoard").addEventListener("contextmenu", (event) => {
    if (!state.permissions?.canManageCatalog) return;
    event.preventDefault();
    hideCatalogBoardMenu();
    const targetProduct = event.target.closest("[data-product-id]");
    catalogContextProductId = targetProduct ? targetProduct.dataset.productId : null;
    const deleteAction = document.getElementById("deleteCatalogProductAction");
    if (deleteAction) {
      deleteAction.classList.toggle("hidden", !catalogContextProductId);
    }
    const menuWidth = 170;
    const menuHeight = catalogContextProductId ? 118 : 78;
    const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    catalogBoardMenu.style.left = `${Math.max(8, left)}px`;
    catalogBoardMenu.style.top = `${Math.max(8, top)}px`;
    catalogBoardMenu.classList.remove("hidden");
  });
  document.getElementById("openAddProductFromCatalogMenu").addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    hideCatalogBoardMenu();
    openQuickAddProductModalForFocusedCategory();
  });
  document.getElementById("openManageProductsFromCatalogMenu").addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    hideCatalogBoardMenu();
    openAddProductModalForFocusedCategory();
  });
  document.getElementById("deleteCatalogProductAction").addEventListener("click", () => {
    if (!catalogContextProductId) return;
    const activeCategory = getActiveCatalogCategory(state);
    if (!state.catalogHiddenByCategory[activeCategory]) {
      state.catalogHiddenByCategory[activeCategory] = Object.create(null);
    }
    state.catalogHiddenByCategory[activeCategory][catalogContextProductId] = true;
    if (state.catalogLayoutByCategory[activeCategory] && state.catalogLayoutByCategory[activeCategory][catalogContextProductId]) {
      delete state.catalogLayoutByCategory[activeCategory][catalogContextProductId];
    }
    const target = state.productsCatalog.find((item) => item.id === catalogContextProductId);
    if (target) {
      target.category = "__none__";
    }
    hideCatalogBoardMenu();
    renderCatalog(state);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!catalogBoardMenu.classList.contains("hidden") && !catalogBoardMenu.contains(event.target)) {
      hideCatalogBoardMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCatalogBoardMenu();
      closeCategoryMenu();
    }
  });

  document.getElementById("saveNewProduct").addEventListener("click", async () => {
    if (!state.permissions?.canManageCatalog) return;
    const name = document.getElementById("newProductName").value.trim();
    const description = document.getElementById("newProductDescription").value.trim();
    const price = Number(document.getElementById("newProductPrice").value || "");
    const taxRate = Number(document.getElementById("newProductTaxRate").value || "21");
    const rubro = document.getElementById("newProductRubro").value.trim();
    const subrubro = document.getElementById("newProductSubrubro").value.trim();
    const productType = document.getElementById("newProductType").value.trim();
    const printerTargets = getSelectedPrinterTargets();
    const showInMenu = document.getElementById("newProductShowInMenu").checked;
    const showInDelivery = document.getElementById("newProductShowInDelivery").checked;
    const imageFileInput = document.getElementById("newProductImageFile");
    const imageFile = imageFileInput?.files?.[0] || null;

    const err = document.getElementById("newProductError");
    const saveBtn = document.getElementById("saveNewProduct");
    err.textContent = "";
    err.classList.add("hidden");

    if (!name || !Number.isFinite(price) || price <= 0) {
      err.textContent = "Completa nombre y precio validos.";
      err.classList.remove("hidden");
      return;
    }

    if (name.length > MAX_PRODUCT_NAME_LENGTH) {
      err.textContent = `El nombre no puede superar ${MAX_PRODUCT_NAME_LENGTH} caracteres.`;
      err.classList.remove("hidden");
      return;
    }

    if (!printerTargets.length) {
      err.textContent = "Selecciona al menos una comandera.";
      err.classList.remove("hidden");
      return;
    }

    if (printerTargets.length > 3) {
      err.textContent = "Solo puedes seleccionar hasta 3 comanderas.";
      err.classList.remove("hidden");
      return;
    }

    if (!(showInMenu || showInDelivery) && imageFile) {
      err.textContent = "La foto solo aplica a menu digital o delivery.";
      err.classList.remove("hidden");
      return;
    }

    if (imageFile && imageFile.size > 3 * 1024 * 1024) {
      err.textContent = "La imagen supera 3MB.";
      err.classList.remove("hidden");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.classList.add("opacity-70");

    try {
      const accessToken = localStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description || "");
      formData.append("price", String(price));
      formData.append("taxRate", String(taxRate));
      formData.append("rubro", rubro);
      formData.append("subrubro", subrubro);
      formData.append("productType", productType);
      formData.append("printerTargets", JSON.stringify(printerTargets));
      formData.append("showInMenu", String(showInMenu));
      formData.append("showInDelivery", String(showInDelivery));
      if (imageFile) {
        formData.append("imageFile", imageFile);
      }

      const isEditing = Boolean(selectedProductId);
      const endpoint = isEditing
        ? `${BACKEND_BASE_URL}/api/products/${selectedProductId}`
        : `${BACKEND_BASE_URL}/api/products`;

      const rawResponse = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      });
      const response = await rawResponse.json().catch(() => ({}));
      if (!rawResponse.ok) {
        throw { message: response.message || "No se pudo guardar el producto." };
      }

      const saved = normalizeBackendProduct(response.data, {
        taxRate,
        rubro,
        subrubro,
        productType,
        printerTargets,
        category: state.productsCatalog.find((item) => item.id === String(response.data?.id))?.category
          || normalizeCategory(productModalCategoryContext || getActiveCatalogCategory(state))
          || "Varios",
      });

      const existingIndex = state.productsCatalog.findIndex((item) => item.id === saved.id);
      if (existingIndex >= 0) {
        state.productsCatalog[existingIndex] = saved;
      } else {
        state.productsCatalog.push(saved);
      }
      const targetCategory = normalizeCategory(saved.category || getActiveCatalogCategory(state) || "Varios");
      if (!state.catalogHiddenByCategory[targetCategory]) {
        state.catalogHiddenByCategory[targetCategory] = Object.create(null);
      }
      delete state.catalogHiddenByCategory[targetCategory][saved.id];
      state.selectedCatalogCategory = targetCategory;

      renderOrderCategories(state);
      if (state.orderModal && !state.orderModal.classList.contains("hidden")) {
        renderCatalog(state);
      }
      notifyProductsChanged();

      resetProductForm();
      renderProductSearchResults();
      toggleSimpleModal(addProductModal, false);
    } catch (error) {
      err.textContent = error?.message || "No se pudo guardar el producto.";
      err.classList.remove("hidden");
    } finally {
      saveBtn.disabled = false;
      saveBtn.classList.remove("opacity-70");
    }
  });

  document.getElementById("saveNewWaiter").addEventListener("click", async () => {
    if (!state.permissions?.canManageStaff) return;
    const firstName = document.getElementById("staffFirstName").value.trim();
    const lastName = document.getElementById("staffLastName").value.trim();
    const address = document.getElementById("staffAddress").value.trim();
    const phone = document.getElementById("staffPhone").value.trim();
    const emergencyPhone = document.getElementById("staffEmergencyPhone").value.trim();
    const username = document.getElementById("staffUsername").value.trim();
    const pinCode = document.getElementById("staffPinCode").value.trim();
    const role = document.getElementById("staffRole").value;
    const err = document.getElementById("newWaiterError");
    const saveBtn = document.getElementById("saveNewWaiter");
    err.textContent = "";
    err.classList.add("hidden");

    if (!firstName || !lastName) {
      err.textContent = "Completa nombre y apellido.";
      err.classList.remove("hidden");
      return;
    }
    if (!username) {
      err.textContent = "Completa usuario.";
      err.classList.remove("hidden");
      return;
    }
    if (!/^\d{4}$/.test(pinCode)) {
      err.textContent = "El codigo debe tener 4 digitos.";
      err.classList.remove("hidden");
      return;
    }

    const payload = {
      name: firstName,
      lastName,
      address,
      phone,
      emergencyPhone,
      username,
      pinCode,
      role,
    };

    saveBtn.disabled = true;
    saveBtn.classList.add("opacity-70");
    try {
      const accessToken = localStorage.getItem("accessToken");
      const endpoint = selectedStaffId
        ? `${BACKEND_BASE_URL}/api/users/${selectedStaffId}`
        : `${BACKEND_BASE_URL}/api/users`;
      const method = selectedStaffId ? "PATCH" : "POST";
      const rawResponse = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const response = await rawResponse.json().catch(() => ({}));
      if (!rawResponse.ok) {
        throw new Error(response.message || "No se pudo guardar el personal.");
      }

      const saved = response.data;
      const existingIndex = (state.staffMembers || []).findIndex((item) => String(item.id) === String(saved.id));
      if (existingIndex >= 0) {
        state.staffMembers[existingIndex] = saved;
      } else {
        state.staffMembers.push(saved);
      }
      syncWaitersFromStaff();
      resetStaffForm();
      renderStaffSearchResults();
      toggleSimpleModal(addWaiterModal, false);
    } catch (error) {
      err.textContent = error?.message || "No se pudo guardar el personal.";
      err.classList.remove("hidden");
    } finally {
      saveBtn.disabled = false;
      saveBtn.classList.remove("opacity-70");
    }
  });

  document.getElementById("deleteStaffButton").addEventListener("click", async () => {
    if (!state.permissions?.canManageStaff) return;
    const err = document.getElementById("newWaiterError");
    const btn = document.getElementById("deleteStaffButton");
    err.textContent = "";
    err.classList.add("hidden");
    if (!selectedStaffId) {
      err.textContent = "Selecciona un empleado para eliminar.";
      err.classList.remove("hidden");
      return;
    }

    if (!window.confirm("Eliminar este empleado?")) return;

    btn.disabled = true;
    btn.classList.add("opacity-70");
    try {
      const accessToken = localStorage.getItem("accessToken");
      const rawResponse = await fetch(`${BACKEND_BASE_URL}/api/users/${selectedStaffId}`, {
        method: "DELETE",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const response = await rawResponse.json().catch(() => ({}));
      if (!rawResponse.ok) {
        throw new Error(response.message || "No se pudo eliminar el personal.");
      }

      state.staffMembers = (state.staffMembers || []).filter((item) => String(item.id) !== String(selectedStaffId));
      syncWaitersFromStaff();
      resetStaffForm();
      renderStaffSearchResults();
      toggleSimpleModal(addWaiterModal, false);
    } catch (error) {
      err.textContent = error?.message || "No se pudo eliminar el personal.";
      err.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.classList.remove("opacity-70");
    }
  });

  document.getElementById("saveNewCategory").addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    const name = normalizeCategory(document.getElementById("newCategoryName").value);
    const err = document.getElementById("newCategoryError");
    err.textContent = "";
    err.classList.add("hidden");

    if (!name) {
      err.textContent = "Ingresa un nombre de categoria.";
      err.classList.remove("hidden");
      return;
    }
    if (name.length > MAX_CATEGORY_NAME_LENGTH) {
      err.textContent = `La categoria no puede superar ${MAX_CATEGORY_NAME_LENGTH} caracteres.`;
      err.classList.remove("hidden");
      return;
    }

    if (categoryExists(state, name)) {
      err.textContent = "Esa categoria ya existe.";
      err.classList.remove("hidden");
      return;
    }

    if (isUnsafeObjectKey(name)) {
      err.textContent = "Ese nombre de categoria no esta permitido.";
      err.classList.remove("hidden");
      return;
    }

    state.categories.push(name);
    state.selectedCatalogCategory = name;
    renderOrderCategories(state);

    if (state.orderModal && !state.orderModal.classList.contains("hidden")) {
      renderCatalog(state);
    }

    document.getElementById("newCategoryName").value = "";
    toggleSimpleModal(addCategoryModal, false);
  });

  document.getElementById("confirmDeleteCategory").addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    const categoryToDelete = normalizeCategory(document.getElementById("deleteCategorySelect").value);
    removeCategory(state, categoryToDelete);
    renderOrderCategories(state);
    if (state.orderModal && !state.orderModal.classList.contains("hidden")) {
      renderCatalog(state);
    }
    toggleSimpleModal(deleteCategoryModal, false);
  });

  addProductModal.addEventListener("click", (event) => {
    if (event.target === addProductModal) toggleSimpleModal(addProductModal, false);
  });
  quickAddProductModal.addEventListener("click", (event) => {
    if (event.target === quickAddProductModal) toggleSimpleModal(quickAddProductModal, false);
  });
  addWaiterModal.addEventListener("click", (event) => {
    if (event.target === addWaiterModal) toggleSimpleModal(addWaiterModal, false);
  });
  addCategoryModal.addEventListener("click", (event) => {
    if (event.target === addCategoryModal) toggleSimpleModal(addCategoryModal, false);
  });
  deleteCategoryModal.addEventListener("click", (event) => {
    if (event.target === deleteCategoryModal) toggleSimpleModal(deleteCategoryModal, false);
  });
  deleteProductConfirmModal.addEventListener("click", (event) => {
    if (event.target === deleteProductConfirmModal) toggleSimpleModal(deleteProductConfirmModal, false);
  });

  syncProductVisibilityControls();
  renderOrderCategories(state);
  renderCatalogLockUI(state);
  renderCatalogPaintUI(state);
}
