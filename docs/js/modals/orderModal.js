import { openModal, closeModal } from "./modalCore.js";
import { getPlanKeyByGrid } from "../plans/planGrid.js";
import { renderCatalog } from "../catalog/catalogRender.js";
import { renderOrderModal, renderWaiters, ensureOrderMeta } from "../orders/ordersRender.js";

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
const MAX_WAITER_NAME_LENGTH = 60;
const MAX_CATEGORY_NAME_LENGTH = 30;

function normalizeCategory(value) {
  return (value || "").trim();
}

function isUnsafeObjectKey(value) {
  const key = String(value || "").toLowerCase();
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

function normalizeProductName(value) {
  return (value || "").trim().toLowerCase();
}

function categoryExists(state, name) {
  const normalized = normalizeCategory(name).toLowerCase();
  if (!normalized) return false;
  return state.categories.some((category) => category.toLowerCase() === normalized);
}

function findProductByName(state, name) {
  const normalized = normalizeProductName(name);
  if (!normalized) return null;
  return state.productsCatalog.find((product) => normalizeProductName(product.name) === normalized) || null;
}

function isProductVisibleInCategory(state, productId, category) {
  const hiddenMap = state.catalogHiddenByCategory?.[category];
  return !(hiddenMap && hiddenMap[productId]);
}

function getSelectableWaiters(state) {
  const waiters = state.waiters.filter((waiter) => waiter !== "Sin asignar");
  if (!waiters.includes("Terminal")) waiters.unshift("Terminal");
  return waiters;
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
      const base = "rounded-md border px-5 py-2.5 text-base font-semibold transition";
      const style = hasCustomColor
        ? active
          ? "border-zinc-700 text-white ring-2 ring-zinc-400 ring-offset-1"
          : "border-transparent text-white hover:brightness-95"
        : active
          ? "border-emeraldbrand bg-emerald-50 text-emerald-800"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400";
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
    button.innerHTML = `${lockClosedIcon}<span>Desbloquear productos</span>`;
    button.className =
      "inline-flex items-center gap-1.5 rounded-md bg-emeraldbrand px-2 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600";
    if (categoryActions) categoryActions.classList.add("hidden");
    if (paletteControl) paletteControl.classList.add("hidden");
    state.catalogPaletteOpen = false;
    state.catalogPaintColor = null;
    renderCatalogPaintUI(state);
    return;
  }
  button.innerHTML = `${lockOpenIcon}<span>Bloquear productos</span>`;
  button.className =
    "inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white transition hover:bg-zinc-700";
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
    <div id="orderModalPanel" class="relative flex h-[82vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
      <div class="mb-3 flex items-start justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Gestion de mesa</p>
          <h3 id="orderModalTitle" class="text-lg font-semibold">Mesa</h3>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs text-zinc-500">Mozo:</span>
            <select id="orderWaiterSelect" class="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"></select>
          </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Categorias</p>
          <div class="flex max-w-full flex-wrap items-center justify-center gap-2">
            <div id="orderCategoryChips" class="flex max-w-full flex-wrap items-center justify-center gap-2"></div>
          </div>
        </div>
        <button id="closeOrderModal" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">Cerrar</button>
      </div>
      <div class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section class="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-semibold">Productos cargados</h4>
            <span id="orderItemsCount" class="rounded-md bg-white px-2 py-1 text-[11px]">0 items</span>
          </div>
          <div id="orderItemsList" class="min-h-0 flex-1 space-y-2 overflow-y-auto"></div>
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
        <section class="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white p-3">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h4 class="text-sm font-semibold">Carga de productos</h4>
            <div class="flex items-center gap-2">
              <button id="toggleCatalogLockButton" type="button" class="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">Bloquear productos</button>
              <div id="categoryManageActions" class="relative">
                <button id="categoryMenuToggle" type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100" aria-haspopup="true" aria-expanded="false" aria-label="Opciones de categoria">...</button>
                <div id="categoryMenuPanel" class="absolute right-0 top-9 z-20 hidden min-w-[180px] rounded-md border border-zinc-200 bg-white p-1.5 shadow-xl">
                  <button id="openAddCategoryModal" type="button" class="block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Agregar categoria</button>
                  <button id="removeCategoryButton" type="button" class="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50">Eliminar categoria</button>
                </div>
              </div>
            </div>
          </div>
          <div id="catalogBoard" class="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-0"></div>
        </section>
      </div>
      <div id="catalogPaletteControl" class="absolute bottom-1 right-1 z-20 flex items-center gap-2">
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
      <p class="mt-2 text-sm text-zinc-600">Elegi quien toma la mesa para continuar.</p>
      <div id="waiterPickerOptions" class="mt-4 grid gap-2"></div>
      <div class="mt-4 flex justify-end">
        <button id="cancelWaiterPicker" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(waiterPickerModal);
  state.waiterPickerModal = waiterPickerModal;
  state.waiterPickerModal.__onClose = () => {
    state.pendingStaticPlanKey = null;
  };
  state.waiterPickerPanel = document.getElementById("waiterPickerPanel");
  state.waiterPickerOptions = document.getElementById("waiterPickerOptions");

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

  const waiterPickerTitle = document.getElementById("waiterPickerTitle");
  if (waiterPickerTitle) {
    waiterPickerTitle.textContent = `Seleccionar mozo - Mesa ${tableNumber}`;
  }

  const options = state.waiterPickerOptions;
  if (!options) return;
  const waiters = getSelectableWaiters(state);
  options.replaceChildren();
  waiters.forEach((waiter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.pickWaiter = waiter;
    button.className = "rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200";
    button.textContent = waiter;
    options.appendChild(button);
  });

  options.onclick = (event) => {
    const button = event.target.closest("[data-pick-waiter]");
    if (!button) return;
    const waiterName = button.dataset.pickWaiter;
    if (!getSelectableWaiters(state).includes(waiterName)) return;
    closeModal(state, state.waiterPickerModal, { panel: state.waiterPickerPanel, restoreFocus: false });
    openOrderModalForTable(state, table, waiterName);
  };

  openModal(state, state.waiterPickerModal, {
    panel: state.waiterPickerPanel,
    title: document.getElementById("waiterPickerTitle"),
  });
}

export function closeOrderModal(state) {
  closeModal(state, state.orderModal, { panel: document.getElementById("orderModalPanel") });
}

export function openStaticPlanWaiterModal(state, planLabel) {
  const numberMatch = String(planLabel || "").match(/\d+/);
  const planNumber = numberMatch ? numberMatch[0] : "3";
  const planKey = `static${planNumber}`;
  state.pendingStaticPlanKey = planKey;
  ensureStaticPlanState(state, planKey);

  const waiterPickerTitle = document.getElementById("waiterPickerTitle");
  if (waiterPickerTitle) {
    waiterPickerTitle.textContent = `Seleccionar mozo - ${planLabel}`;
  }

  const options = state.waiterPickerOptions;
  if (!options) return;
  options.replaceChildren();
  const terminalButton = document.createElement("button");
  terminalButton.type = "button";
  terminalButton.dataset.pickWaiter = "Terminal";
  terminalButton.className = "rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200";
  terminalButton.textContent = "Terminal";
  options.appendChild(terminalButton);

  options.onclick = (event) => {
    const button = event.target.closest("[data-pick-waiter]");
    if (!button) return;
    if (button.dataset.pickWaiter !== "Terminal") return;
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

    closeModal(state, state.waiterPickerModal, { panel: state.waiterPickerPanel, restoreFocus: false });
    openOrderModalForTable(state, tableLike, "Terminal");
  };

  openModal(state, state.waiterPickerModal, {
    panel: state.waiterPickerPanel,
    title: document.getElementById("waiterPickerTitle"),
  });
}

export function openStaticTableOrderModal(state, table) {
  if (!table || state.dragState || state.tableJustDragged) return;
  const orderKey = getOrderKeyFromTable(state, table);
  ensureOrderMeta(state, orderKey);
  const waiterName = state.metaByTable[orderKey]?.waiterName || "Terminal";
  openOrderModalForTable(state, table, waiterName);
}

export function initQuickCatalogModals(state) {
  const rightPanelActions = state.openCashModal?.parentElement;
  if (rightPanelActions && !document.getElementById("openAddProductModal")) {
    const addProductButton = document.createElement("button");
    addProductButton.id = "openAddProductModal";
    addProductButton.type = "button";
    addProductButton.className =
      "rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700";
    addProductButton.textContent = "Agregar articulo";

    const addWaiterButton = document.createElement("button");
    addWaiterButton.id = "openAddWaiterModal";
    addWaiterButton.type = "button";
    addWaiterButton.className =
      "rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700";
    addWaiterButton.textContent = "Crear mozo";

    rightPanelActions.appendChild(addProductButton);
    rightPanelActions.appendChild(addWaiterButton);
  }

  const addProductModal = document.createElement("div");
  addProductModal.className =
    "fixed inset-0 z-[85] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  addProductModal.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Agregar articulo</h3>
      <input id="newProductSearch" type="text" class="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Buscar producto existente" />
      <div id="newProductSearchResults" class="mt-2 max-h-28 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-1 text-xs text-zinc-600"></div>
      <input id="newProductName" type="text" class="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Nombre del producto" />
      <input id="newProductPrice" type="number" min="1" class="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Precio" />
      <p id="newProductError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelNewProduct" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="saveNewProduct" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(addProductModal);
  state.addProductModal = addProductModal;

  const addWaiterModal = document.createElement("div");
  addWaiterModal.className =
    "fixed inset-0 z-[85] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  addWaiterModal.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
      <h3 class="text-base font-semibold text-zinc-900">Crear mozo</h3>
      <input id="newWaiterName" type="text" class="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Nombre del mozo" />
      <p id="newWaiterError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-4 flex justify-end gap-2">
        <button id="cancelNewWaiter" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">Cancelar</button>
        <button id="saveNewWaiter" type="button" class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Guardar</button>
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

  const toggleSimpleModal = (modal, open) => {
    const panel = modal.querySelector(":scope > div");
    const title = panel ? panel.querySelector("h1, h2, h3, h4") : null;
    if (open) {
      openModal(state, modal, { panel, title });
      return;
    }
    closeModal(state, modal, { panel });
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
      const categoryLabel = state.categories.includes(product.category) ? product.category : "Sin categoria";
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.searchProductId = product.id;
      button.className = "mb-1 block w-full rounded-md px-2 py-1 text-left hover:bg-zinc-100";
      button.textContent = `${product.name} - ${categoryLabel}`;
      results.appendChild(button);
    });
  };

  const catalogBoardMenu = document.createElement("div");
  catalogBoardMenu.id = "catalogBoardContextMenu";
  catalogBoardMenu.className =
    "fixed z-[87] hidden min-w-[160px] rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl";
  catalogBoardMenu.innerHTML =
    '<button id="openAddProductFromCatalogMenu" type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50">Agregar producto</button>' +
    '<button id="deleteCatalogProductAction" type="button" class="hidden w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50">Eliminar producto</button>';
  document.body.appendChild(catalogBoardMenu);

  const hideCatalogBoardMenu = () => catalogBoardMenu.classList.add("hidden");
  let catalogContextProductId = null;

  document.getElementById("openAddProductModal")?.addEventListener("click", () => {
    document.getElementById("newProductSearch").value = "";
    renderProductSearchResults();
    toggleSimpleModal(addProductModal, true);
  });
  document.getElementById("openAddWaiterModal")?.addEventListener("click", () => toggleSimpleModal(addWaiterModal, true));
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
  document.getElementById("newProductSearchResults").addEventListener("click", (event) => {
    const row = event.target.closest("[data-search-product-id]");
    if (!row) return;
    const product = state.productsCatalog.find((item) => item.id === row.dataset.searchProductId);
    if (!product) return;
    document.getElementById("newProductName").value = product.name;
    document.getElementById("newProductPrice").value = String(product.price);
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
  document.getElementById("cancelNewWaiter").addEventListener("click", () => toggleSimpleModal(addWaiterModal, false));
  document.getElementById("cancelNewCategory").addEventListener("click", () => toggleSimpleModal(addCategoryModal, false));
  document.getElementById("cancelDeleteCategory").addEventListener("click", () => toggleSimpleModal(deleteCategoryModal, false));

  document.getElementById("catalogBoard").addEventListener("contextmenu", (event) => {
    event.preventDefault();
    hideCatalogBoardMenu();
    const targetProduct = event.target.closest("[data-product-id]");
    catalogContextProductId = targetProduct ? targetProduct.dataset.productId : null;
    const deleteAction = document.getElementById("deleteCatalogProductAction");
    if (deleteAction) {
      deleteAction.classList.toggle("hidden", !catalogContextProductId);
    }
    const menuWidth = 170;
    const menuHeight = catalogContextProductId ? 84 : 44;
    const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    catalogBoardMenu.style.left = `${Math.max(8, left)}px`;
    catalogBoardMenu.style.top = `${Math.max(8, top)}px`;
    catalogBoardMenu.classList.remove("hidden");
  });
  document.getElementById("openAddProductFromCatalogMenu").addEventListener("click", () => {
    hideCatalogBoardMenu();
    document.getElementById("newProductSearch").value = "";
    renderProductSearchResults();
    toggleSimpleModal(addProductModal, true);
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

  document.getElementById("saveNewProduct").addEventListener("click", () => {
    const name = document.getElementById("newProductName").value.trim();
    const price = parseInt(document.getElementById("newProductPrice").value || "", 10);
    const selectedCategory = normalizeCategory(getActiveCatalogCategory(state));
    const err = document.getElementById("newProductError");
    err.textContent = "";
    err.classList.add("hidden");
    if (!name || !Number.isInteger(price) || price <= 0 || !selectedCategory) {
      err.textContent = "Completa nombre y precio validos.";
      err.classList.remove("hidden");
      return;
    }
    if (name.length > MAX_PRODUCT_NAME_LENGTH) {
      err.textContent = `El nombre no puede superar ${MAX_PRODUCT_NAME_LENGTH} caracteres.`;
      err.classList.remove("hidden");
      return;
    }

    const existing = findProductByName(state, name);
    if (existing) {
      const existingCategory = state.categories.includes(existing.category) ? existing.category : null;
      const visibleNow = existingCategory ? isProductVisibleInCategory(state, existing.id, existingCategory) : false;
      if (existingCategory && visibleNow) {
        err.textContent = `Ese producto ya existe en ${existingCategory}.`;
        err.classList.remove("hidden");
        return;
      }

      // If the same product is hidden, allow moving/reusing it in the selected category.
      existing.price = price;
      existing.category = selectedCategory;

      if (!state.catalogHiddenByCategory[selectedCategory]) {
        state.catalogHiddenByCategory[selectedCategory] = Object.create(null);
      }
      delete state.catalogHiddenByCategory[selectedCategory][existing.id];
      if (existingCategory && existingCategory !== selectedCategory && state.catalogLayoutByCategory[existingCategory]) {
        delete state.catalogLayoutByCategory[existingCategory][existing.id];
      }

      state.selectedCatalogCategory = selectedCategory;
      renderOrderCategories(state);
      renderCatalog(state);
      document.getElementById("newProductName").value = "";
      document.getElementById("newProductPrice").value = "";
      document.getElementById("newProductSearch").value = "";
      renderProductSearchResults();
      toggleSimpleModal(addProductModal, false);
      return;
    }

    if (!categoryExists(state, selectedCategory)) {
      state.categories.push(selectedCategory);
    }

    const newProduct = { id: `p-${Date.now()}`, name, price, category: selectedCategory };
    state.productsCatalog.push(newProduct);
    if (!state.catalogHiddenByCategory[selectedCategory]) {
      state.catalogHiddenByCategory[selectedCategory] = Object.create(null);
    }
    delete state.catalogHiddenByCategory[selectedCategory][newProduct.id];
    state.selectedCatalogCategory = selectedCategory;
    renderOrderCategories(state);

    if (state.orderModal && !state.orderModal.classList.contains("hidden")) {
      renderCatalog(state);
    }

    document.getElementById("newProductName").value = "";
    document.getElementById("newProductPrice").value = "";
    document.getElementById("newProductSearch").value = "";
    renderProductSearchResults();
    toggleSimpleModal(addProductModal, false);
  });

  document.getElementById("saveNewWaiter").addEventListener("click", () => {
    const name = document.getElementById("newWaiterName").value.trim();
    const err = document.getElementById("newWaiterError");
    err.textContent = "";
    err.classList.add("hidden");
    if (!name) {
      err.textContent = "Ingresa un nombre.";
      err.classList.remove("hidden");
      return;
    }
    if (name.length > MAX_WAITER_NAME_LENGTH) {
      err.textContent = `El nombre no puede superar ${MAX_WAITER_NAME_LENGTH} caracteres.`;
      err.classList.remove("hidden");
      return;
    }
    if (state.waiters.includes(name)) {
      err.textContent = "Ese mozo ya existe.";
      err.classList.remove("hidden");
      return;
    }
    state.waiters.push(name);
    if (state.orderModal && !state.orderModal.classList.contains("hidden")) {
      renderWaiters(state);
    }
    document.getElementById("newWaiterName").value = "";
    toggleSimpleModal(addWaiterModal, false);
  });

  document.getElementById("saveNewCategory").addEventListener("click", () => {
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
  addWaiterModal.addEventListener("click", (event) => {
    if (event.target === addWaiterModal) toggleSimpleModal(addWaiterModal, false);
  });
  addCategoryModal.addEventListener("click", (event) => {
    if (event.target === addCategoryModal) toggleSimpleModal(addCategoryModal, false);
  });
  deleteCategoryModal.addEventListener("click", (event) => {
    if (event.target === deleteCategoryModal) toggleSimpleModal(deleteCategoryModal, false);
  });

  renderOrderCategories(state);
  renderCatalogLockUI(state);
  renderCatalogPaintUI(state);
}
