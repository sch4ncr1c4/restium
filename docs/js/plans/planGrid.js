import {
  TABLE_COUNT,
  DESKTOP_TABLE_COLUMNS,
  TABLE_GAP_DESKTOP,
  TABLE_GAP_MOBILE,
  MIN_TABLE_SIZE,
  MAX_TABLE_SIZE,
  PLAN_PADDING,
  PLAN_RESIZE_STEP_H,
  PLAN_MIN_W,
  PLAN_MAX_W,
  PLAN_MIN_H,
  PLAN_MAX_H,
  PLAN_META,
} from "../config.js";
import { clamp, normalizePosition, denormalizePosition } from "../utils/math.js";

const MAX_PLAN_GROW_STEPS = 5;

const TABLE_BASE_CLASSES = [
  "border-emerald-500",
  "bg-emerald-100",
  "text-emerald-800",
  "hover:border-emerald-600",
  "hover:bg-emerald-200",
  "dark:border-emerald-800",
  "dark:bg-emerald-950",
  "dark:text-emerald-100",
  "dark:hover:border-emerald-700",
  "dark:hover:bg-emerald-900",
];

const TABLE_OCCUPIED_CLASSES = [
  "border-rose-500",
  "bg-rose-100",
  "text-rose-800",
  "hover:border-rose-600",
  "hover:bg-rose-200",
  "dark:border-rose-800",
  "dark:bg-rose-950",
  "dark:text-rose-100",
  "dark:hover:border-rose-700",
  "dark:hover:bg-rose-900",
];

export function getActivePlanEntries(state) {
  return Object.values(state.plans).filter((plan) => plan.card && plan.grid && plan.card.isConnected);
}

export function getActiveRemovablePlanCount(state) {
  return getActivePlanEntries(state).length;
}

export function getMissingPlanKey(state) {
  return ["primary", "secondary"].find((key) => !state.plans[key].card || !state.plans[key].card.isConnected) || null;
}

export function updateAddPlanButtonState(state) {
  if (!state.addPlanButton) return;
  if (!state.permissions?.canEditPlans) {
    state.addPlanButton.disabled = true;
    state.addPlanButton.classList.add("opacity-40", "cursor-not-allowed");
    return;
  }
  const missing = getMissingPlanKey(state);
  state.addPlanButton.disabled = !missing;
  state.addPlanButton.classList.toggle("opacity-40", !missing);
  state.addPlanButton.classList.toggle("cursor-not-allowed", !missing);
}

export function updateDeletePlanButtonsState(state) {
  if (!state.permissions?.canEditPlans) {
    document.querySelectorAll('[data-plan-action="delete"]').forEach((button) => {
      button.disabled = true;
      button.classList.add("opacity-40", "cursor-not-allowed");
    });
    return;
  }
  const canDelete = getActiveRemovablePlanCount(state) > 1;
  document.querySelectorAll('[data-plan-action="delete"]').forEach((button) => {
    button.disabled = !canDelete;
    button.classList.toggle("opacity-40", !canDelete);
    button.classList.toggle("cursor-not-allowed", !canDelete);
  });
}

export function syncStaticAsideHeight(state, forceRecalc = false) {
  if (!state.staticPlansAside || !state.plansColumn) return;
  if (window.innerWidth < 1280) {
    state.staticPlansAside.style.height = "";
    state.staticPlansAside.style.minHeight = "";
    state.staticPlansAside.style.maxHeight = "";
    state.staticPlansAside.style.overflowY = "";
    state.plansColumn.style.maxHeight = "";
    state.plansColumn.style.overflowY = "";
    return;
  }
  const canRecalc = forceRecalc && getActiveRemovablePlanCount(state) === 2;
  if (state.staticAsideBaselineHeight === null || canRecalc) {
    const measured = Math.round(state.plansColumn.getBoundingClientRect().height);
    if (measured > 0) state.staticAsideBaselineHeight = measured;
  }
  const asideTop = Math.round(state.staticPlansAside.getBoundingClientRect().top);
  const viewportAvailable = Math.max(320, window.innerHeight - asideTop - 16);
  const targetHeight = Math.max(320, Math.min(state.staticAsideBaselineHeight || viewportAvailable, viewportAvailable));

  // Keep plans column without inner scrollbar to avoid layout jitter when controls expand/collapse.
  state.plansColumn.style.maxHeight = "";
  state.plansColumn.style.overflowY = "";
  state.staticPlansAside.style.maxHeight = `${viewportAvailable}px`;
  state.staticPlansAside.style.overflowY = "auto";
  if (state.staticAsideBaselineHeight) {
    state.staticPlansAside.style.height = `${targetHeight}px`;
    state.staticPlansAside.style.minHeight = `${targetHeight}px`;
  }
}

export function getColumnsForWidth(width) {
  const gap = getGapForWidth(width);
  const availableWidth = Math.max(width - PLAN_PADDING * 2, 0);
  const minCols = width < 768 ? 5 : width < 1100 ? 8 : 10;
  let cols = width < 768 ? 5 : width < 1100 ? 12 : DESKTOP_TABLE_COLUMNS;

  // Grow columns when cells would exceed max size, so grid uses width better.
  while (cols < DESKTOP_TABLE_COLUMNS) {
    const raw = Math.floor((availableWidth - gap * (cols - 1)) / cols);
    if (raw <= MAX_TABLE_SIZE) break;
    cols += 1;
  }

  // Avoid making cells too small after responsive changes.
  while (cols > minCols) {
    const raw = Math.floor((availableWidth - gap * (cols - 1)) / cols);
    if (raw >= Math.max(MIN_TABLE_SIZE, 36)) break;
    cols -= 1;
  }

  return cols;
}

function getGapForWidth(width) {
  if (width < 768) return TABLE_GAP_MOBILE;
  return TABLE_GAP_DESKTOP;
}

function getTableSizeForWidth(width, columns, gap) {
  const availableWidth = Math.max(width - PLAN_PADDING * 2, 0);
  const rawSize = Math.floor((availableWidth - gap * (columns - 1)) / columns);
  return clamp(rawSize, MIN_TABLE_SIZE, MAX_TABLE_SIZE);
}

function getExpandedGap(width, columns, tableSize, baseGap) {
  if (columns <= 1) return baseGap;
  const availableWidth = Math.max(width - PLAN_PADDING * 2, 0);
  const remaining = availableWidth - columns * tableSize;
  if (remaining <= 0) return baseGap;

  const distributed = Math.floor(remaining / (columns - 1));
  // Keep spacing controlled on very wide screens.
  return clamp(distributed, baseGap, 28);
}

export function setTablePosition(table, left, top) {
  table.style.left = `${left}px`;
  table.style.top = `${top}px`;
}

export function readTablePosition(table) {
  return {
    left: parseFloat(table.style.left || "0"),
    top: parseFloat(table.style.top || "0"),
  };
}

export function getGridTables(grid) {
  return Array.from(grid.querySelectorAll("button[data-table-id]"));
}

function updateTableVisualSize(grid, tableSize) {
  getGridTables(grid).forEach((table) => {
    table.style.width = `${tableSize}px`;
    table.style.height = `${tableSize}px`;
  });
}

function buildAxisPositions(start, max, step) {
  const positions = [];
  for (let pos = start; pos <= max; pos += step) {
    positions.push(pos);
  }
  if (!positions.length || positions[positions.length - 1] !== max) {
    positions.push(max);
  }
  return positions;
}

function nearestIndex(positions, value) {
  return positions.reduce(
    (best, pos, idx) => {
      const dist = Math.abs(value - pos);
      if (dist < best.dist) return { idx, dist };
      return best;
    },
    { idx: 0, dist: Number.POSITIVE_INFINITY },
  ).idx;
}

function getAxisBounds(width, height, tableSize, tableCount, columns, gap) {
  const rows = Math.ceil(Math.max(tableCount, 1) / Math.max(columns, 1));
  const baseHeight = PLAN_PADDING * 2 + rows * tableSize + (rows - 1) * gap;
  const maxLeft = Math.max(PLAN_PADDING, width - tableSize - PLAN_PADDING);
  const maxTop = Math.max(PLAN_PADDING, Math.max(height, baseHeight) - tableSize - PLAN_PADDING);
  return { maxLeft, maxTop };
}

export function syncGridTableRatios(grid) {
  if (!grid || !grid.isConnected) return;
  const width = grid.clientWidth;
  const height = grid.clientHeight;
  const tableSize = parseFloat(grid.dataset.tableSize || "0");
  const columns = parseInt(grid.dataset.tableColumns || String(DESKTOP_TABLE_COLUMNS), 10);
  const gap = parseInt(grid.dataset.tableGap || String(TABLE_GAP_DESKTOP), 10);
  const tables = getGridTables(grid);
  const { maxLeft, maxTop } = getAxisBounds(width, height, tableSize, tables.length, columns, gap);

  tables.forEach((table) => {
    const pos = readTablePosition(table);
    table.dataset.ratioX = String(normalizePosition(pos.left, PLAN_PADDING, maxLeft));
    table.dataset.ratioY = String(normalizePosition(pos.top, PLAN_PADDING, maxTop));
  });
}

function snapGridTablesToCells(grid, width, height, tableSize, columns, gap, updateRatios) {
  const tables = getGridTables(grid);
  if (!tables.length) return;
  const { maxLeft, maxTop } = getAxisBounds(width, height, tableSize, tables.length, columns, gap);
  const step = Math.max(1, tableSize + gap);
  const colPositions = buildAxisPositions(PLAN_PADDING, maxLeft, step);
  const rowPositions = buildAxisPositions(PLAN_PADDING, maxTop, step);
  const occupied = new Set();

  tables.forEach((table) => {
    const pos = readTablePosition(table);
    let col = nearestIndex(colPositions, pos.left);
    let row = nearestIndex(rowPositions, pos.top);
    let key = `${col}:${row}`;

    if (occupied.has(key)) {
      let found = false;
      for (let r = 0; r < rowPositions.length && !found; r += 1) {
        for (let c = 0; c < colPositions.length; c += 1) {
          const candidate = `${c}:${r}`;
          if (!occupied.has(candidate)) {
            col = c;
            row = r;
            key = candidate;
            found = true;
            break;
          }
        }
      }
    }

    occupied.add(key);
    setTablePosition(table, colPositions[col], rowPositions[row]);
  });

  if (updateRatios) syncGridTableRatios(grid);
}

function applyGridTableRatios(grid, width, height, tableSize, columns, gap, updateRatios = true) {
  const tables = getGridTables(grid);
  const { maxLeft, maxTop } = getAxisBounds(width, height, tableSize, tables.length, columns, gap);

  tables.forEach((table) => {
    const ratioX = Number(table.dataset.ratioX);
    const ratioY = Number(table.dataset.ratioY);
    if (!Number.isFinite(ratioX) || !Number.isFinite(ratioY)) return;
    const left = clamp(denormalizePosition(ratioX, PLAN_PADDING, maxLeft), PLAN_PADDING, maxLeft);
    const top = clamp(denormalizePosition(ratioY, PLAN_PADDING, maxTop), PLAN_PADDING, maxTop);
    setTablePosition(table, left, top);
  });

  snapGridTablesToCells(grid, width, height, tableSize, columns, gap, updateRatios);
}

export function applyGridDimensions(grid) {
  const requestedWidthFromState = parseFloat(grid.dataset.customWidth || "0");
  const requestedHeightFromState = parseFloat(grid.dataset.customHeight || "0");
  const requestedWidth = requestedWidthFromState || grid.clientWidth;
  const requestedHeight = requestedHeightFromState || 0;
  const parentWidth = Math.floor(grid.parentElement?.clientWidth || 0);
  const viewportWidth = Math.max(260, window.innerWidth - PLAN_PADDING * 2);
  const maxResponsiveWidth = Math.min(PLAN_MAX_W, parentWidth || viewportWidth);
  const baseMinWidth = window.innerWidth < 1280 ? 320 : PLAN_MIN_W;
  const minPlanWidth = Math.min(baseMinWidth, maxResponsiveWidth);
  const width = clamp(requestedWidth, minPlanWidth, maxResponsiveWidth);
  const columns = getColumnsForWidth(width);
  const baseGap = getGapForWidth(width);
  const tableCount = Math.max(getGridTables(grid).length, 1);
  const rows = Math.ceil(tableCount / columns);
  const tableSize = getTableSizeForWidth(width, columns, baseGap);
  const gap = width >= 768 ? getExpandedGap(width, columns, tableSize, baseGap) : baseGap;
  const baseHeight = PLAN_PADDING * 2 + rows * tableSize + (rows - 1) * gap;
  const height = clamp(Math.max(requestedHeight || baseHeight, baseHeight), PLAN_MIN_H, PLAN_MAX_H);

  grid.style.width = `${width}px`;
  grid.style.height = `${height}px`;
  if (!requestedWidthFromState) {
    grid.dataset.customWidth = String(width);
  }
  if (!requestedHeightFromState) {
    grid.dataset.customHeight = String(height);
  }
  grid.dataset.tableSize = String(tableSize);
  grid.dataset.tableColumns = String(columns);
  grid.dataset.tableGap = String(gap);
  updateTableVisualSize(grid, tableSize);
  return { width, height, tableSize, columns, gap };
}

export function layoutGridTables(grid) {
  const { tableSize } = applyGridDimensions(grid);
  const columns = parseInt(grid.dataset.tableColumns || String(DESKTOP_TABLE_COLUMNS), 10);
  const gap = parseInt(grid.dataset.tableGap || String(TABLE_GAP_DESKTOP), 10);
  const tables = getGridTables(grid);
  tables.forEach((table, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const left = PLAN_PADDING + col * (tableSize + gap);
    const top = PLAN_PADDING + row * (tableSize + gap);
    setTablePosition(table, left, top);
  });
  syncGridTableRatios(grid);
}

export function resizePlan(grid, deltaWidth, deltaHeight, options = {}) {
  if (!grid || !grid.isConnected) return;
  const commitLayout = options.commitLayout !== false;

  if (commitLayout) {
    syncGridTableRatios(grid);
  }

  const oldWidth = grid.clientWidth;
  const oldHeight = grid.clientHeight;

  const currentWidth = parseFloat(grid.dataset.customWidth || "0") || oldWidth;
  const currentHeight = parseFloat(grid.dataset.customHeight || "0") || oldHeight;
  const baseHeight = parseFloat(grid.dataset.baseHeight || "0") || currentHeight;
  const maxGrowHeight = baseHeight + PLAN_RESIZE_STEP_H * MAX_PLAN_GROW_STEPS;
  let nextHeight = currentHeight + deltaHeight;
  if (deltaHeight > 0) {
    nextHeight = Math.min(nextHeight, maxGrowHeight);
  }

  grid.dataset.customWidth = String(currentWidth + deltaWidth);
  grid.dataset.customHeight = String(nextHeight);

  const { width, height, tableSize, columns, gap } = applyGridDimensions(grid);
  applyGridTableRatios(grid, width, height, tableSize, columns, gap, commitLayout);
}

export function getPlanKeyByGrid(state, grid) {
  const found = Object.entries(state.plans).find(([, plan]) => plan.grid === grid);
  return found ? found[0] : null;
}

export function isPlanLocked(state, planKey) {
  return Boolean(planKey && state.plans[planKey] && state.plans[planKey].locked);
}

export function setPlanCursor(state, planKey) {
  const plan = state.plans[planKey];
  if (!plan || !plan.grid || !plan.card || !plan.card.isConnected) return;
  const locked = isPlanLocked(state, planKey);

  const tables = plan.grid.querySelectorAll("button[data-table-id]");
  tables.forEach((table) => {
    if (locked) {
      table.classList.remove("cursor-grab", "cursor-grabbing");
      table.classList.add("cursor-default");
      return;
    }
    table.classList.remove("cursor-default");
    table.classList.add("cursor-grab");
  });

  // Grid panning is disabled; only table dragging remains enabled when unlocked.
  plan.grid.classList.remove("cursor-move");
  plan.grid.classList.add("cursor-default");
}

export function updatePlanLockUI(state, planKey) {
  const toggle = document.querySelector(`[data-plan-lock-toggle][data-plan="${planKey}"]`);
  if (!toggle) return;
  const locked = isPlanLocked(state, planKey);
  const lockClosedIcon =
    '<svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" clip-rule="evenodd"/></svg>';
  const lockOpenIcon =
    '<svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path d="M7 6a3 3 0 116 0v1h-2V6a1 1 0 10-2 0v2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2V6z"/></svg>';
  if (locked) {
    toggle.innerHTML = lockClosedIcon;
    toggle.setAttribute("aria-label", "Desbloquear plano");
    toggle.setAttribute("title", "Desbloquear plano");
    toggle.className =
      "inline-flex items-center justify-center rounded-md bg-emeraldbrand p-1.5 text-[10px] font-semibold text-white transition-all duration-200 ease-out hover:bg-emerald-600";
  } else {
    toggle.innerHTML = lockOpenIcon;
    toggle.setAttribute("aria-label", "Bloquear plano");
    toggle.setAttribute("title", "Bloquear plano");
    toggle.className =
      "inline-flex items-center justify-center rounded-md bg-zinc-900 p-1.5 text-[10px] font-semibold text-white transition-all duration-200 ease-out hover:bg-zinc-700";
  }
  toggle.classList.remove("plan-lock-bump");
  requestAnimationFrame(() => toggle.classList.add("plan-lock-bump"));
  setPlanCursor(state, planKey);
}

export function resetPlan(state, planKey) {
  const plan = state.plans[planKey];
  if (!plan || !plan.grid || !plan.card || !plan.card.isConnected) return;

  if (state.dragState && state.dragState.grid === plan.grid) {
    state.dragState = null;
  }

  plan.grid.dataset.customWidth = String(plan.defaultWidth || plan.grid.clientWidth || 1200);
  if (plan.defaultHeight) plan.grid.dataset.customHeight = String(plan.defaultHeight);
  layoutGridTables(plan.grid);
  syncGridTableRatios(plan.grid);
}

export function createPlanCardElement(planKey) {
  const meta = PLAN_META[planKey];
  const article = document.createElement("article");
  article.id = meta.cardId;
  article.className = "select-none rounded-xl border border-zinc-200 bg-zinc-50/40 p-3";
  article.innerHTML = `
    <div class="mb-2 flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">${meta.title}</p>
      <div class="flex items-center gap-1">
        <button data-plan-lock-toggle data-plan="${planKey}" type="button" class="inline-flex items-center justify-center rounded-md bg-zinc-900 p-1.5 text-[10px] font-semibold text-white hover:bg-zinc-700" aria-label="Bloquear plano" title="Bloquear plano">
          <svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path d="M7 6a3 3 0 116 0v1h-2V6a1 1 0 10-2 0v2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2V6z"/></svg>
        </button>
        <div data-plan-controls data-plan="${planKey}" class="plan-controls-pop flex gap-1">
          <button data-plan-action="grow" data-plan="${planKey}" type="button" class="rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-zinc-700">+</button>
          <button data-plan-action="shrink" data-plan="${planKey}" type="button" class="rounded-md bg-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-300">-</button>
          <button data-plan-action="reset" data-plan="${planKey}" type="button" class="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-200">Resetear</button>
          <button data-plan-action="delete" data-plan="${planKey}" type="button" class="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-200">Eliminar</button>
        </div>
        <button data-plan-controls-toggle data-plan="${planKey}" type="button" class="inline-flex w-[68px] items-center justify-center rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200">Opciones</button>
      </div>
    </div>
    <div class="overflow-auto pb-2">
      <div id="${meta.gridId}" class="relative mx-auto rounded-xl border border-zinc-200 bg-zinc-50/70"></div>
    </div>
  `;
  return article;
}

export function buildTableButton(tableNumber, handlers) {
  const table = document.createElement("button");
  table.type = "button";
  table.dataset.tableId = String(tableNumber);
  table.className = `absolute rounded-lg border text-xs font-semibold transition touch-none ${TABLE_BASE_CLASSES.join(" ")}`;
  table.textContent = tableNumber;
  table.setAttribute("aria-label", `Mesa ${tableNumber}`);
  table.addEventListener("pointerdown", handlers.onTablePointerDown);
  table.addEventListener("contextmenu", handlers.onTableContextMenu);
  table.addEventListener("click", () => handlers.onTableClick(table));
  return table;
}

function parseOrderKey(orderKey) {
  if (!orderKey || typeof orderKey !== "string") return null;
  const separator = orderKey.indexOf(":");
  if (separator <= 0) return null;
  return {
    planKey: orderKey.slice(0, separator),
    tableId: orderKey.slice(separator + 1),
  };
}

function setTableOccupiedClass(table, occupied) {
  if (!table) return;
  table.classList.remove(...TABLE_BASE_CLASSES, ...TABLE_OCCUPIED_CLASSES);
  if (occupied) {
    table.classList.add(...TABLE_OCCUPIED_CLASSES);
    return;
  }
  table.classList.add(...TABLE_BASE_CLASSES);
}

export function syncTableOccupiedState(state, orderKey) {
  const parsed = parseOrderKey(orderKey);
  if (!parsed) return;
  const plan = state.plans[parsed.planKey];
  if (!plan || !plan.grid) return;

  const table = plan.grid.querySelector(`[data-table-id="${parsed.tableId}"]`);
  if (!table) return;
  const items = state.ordersByTable[orderKey] || [];
  const occupied = items.some((item) => !item.deleted && Number(item.qty || 0) > 0);
  setTableOccupiedClass(table, occupied);
}

export function initDraggableGrid(state, gridElement, handlers) {
  if (!gridElement) return;

  for (let i = 1; i <= TABLE_COUNT; i += 1) {
    gridElement.appendChild(buildTableButton(i, handlers));
  }

  gridElement.dataset.customWidth = String(gridElement.clientWidth || 1200);
  const parentWidth = gridElement.parentElement ? gridElement.parentElement.clientWidth : 0;
  if (parentWidth > 0) {
    gridElement.dataset.customWidth = String(parentWidth);
  }

  layoutGridTables(gridElement);
  gridElement.dataset.customHeight = String(gridElement.clientHeight);
  gridElement.dataset.baseHeight = String(gridElement.clientHeight);
  const dimensions = applyGridDimensions(gridElement);
  applyGridTableRatios(
    gridElement,
    dimensions.width,
    dimensions.height,
    dimensions.tableSize,
    dimensions.columns,
    dimensions.gap,
    true,
  );
  syncGridTableRatios(gridElement);
  gridElement.addEventListener("pointerdown", handlers.onGridPointerDown);
  gridElement.addEventListener("contextmenu", handlers.onGridContextMenu);

  const plan = Object.values(state.plans).find((entry) => entry.grid === gridElement);
  if (plan) {
    plan.defaultWidth = parseFloat(gridElement.dataset.customWidth || "0") || gridElement.clientWidth || 1200;
    plan.defaultHeight = parseFloat(gridElement.dataset.customHeight || "0") || gridElement.clientHeight || 0;
  }
}

export function mountMissingPlan(state, handlers) {
  const planKey = getMissingPlanKey(state);
  if (!planKey || !state.plansColumn) return;

  const meta = PLAN_META[planKey];
  const card = createPlanCardElement(planKey);
  const secondaryCard = state.plans.secondary.card;

  if (planKey === "primary" && secondaryCard && secondaryCard.isConnected) {
    state.plansColumn.insertBefore(card, secondaryCard);
  } else {
    state.plansColumn.appendChild(card);
  }

  const grid = card.querySelector(`#${meta.gridId}`);
  state.plans[planKey].card = card;
  state.plans[planKey].grid = grid;
  state.plans[planKey].locked = true;

  initDraggableGrid(state, grid, handlers);
  refreshResponsivePlans(state);
}

export function refreshResponsivePlans(state) {
  if (state.dragState) return;
  getActivePlanEntries(state).forEach((plan) => {
    if (!plan.grid.dataset.customWidth) {
      plan.grid.dataset.customWidth = String(plan.grid.clientWidth || 1200);
    }
    // Keep saved user layout while adapting to viewport/container.
    resizePlan(plan.grid, 0, 0, { commitLayout: false });

    // Failsafe: if a bad state left tables without valid coordinates, rebuild layout.
    const tables = getGridTables(plan.grid);
    const hasInvalidPosition = tables.some((table) => {
      const left = parseFloat(table.style.left || "");
      const top = parseFloat(table.style.top || "");
      return !Number.isFinite(left) || !Number.isFinite(top);
    });
    if (hasInvalidPosition) {
      layoutGridTables(plan.grid);
    }
  });
  syncStaticAsideHeight(state, true);
}

export function initPlanGrids(state, handlers) {
  Object.values(state.plans).forEach((plan) => initDraggableGrid(state, plan.grid, handlers));

  let rafId = 0;
  const scheduleResponsiveRefresh = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      refreshResponsivePlans(state);
    });
  };

  window.addEventListener("resize", scheduleResponsiveRefresh);
  window.addEventListener("orientationchange", scheduleResponsiveRefresh);

  if (state.plansColumn && typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => scheduleResponsiveRefresh());
    resizeObserver.observe(state.plansColumn);
    getActivePlanEntries(state).forEach((plan) => {
      const host = plan.grid?.parentElement || plan.grid;
      if (host) resizeObserver.observe(host);
    });
    state.planResizeObserver = resizeObserver;

    const mutationObserver = new MutationObserver(() => {
      getActivePlanEntries(state).forEach((plan) => {
        const host = plan.grid?.parentElement || plan.grid;
        if (host) resizeObserver.observe(host);
      });
      scheduleResponsiveRefresh();
    });
    mutationObserver.observe(state.plansColumn, { childList: true, subtree: true });
    state.planMutationObserver = mutationObserver;
  } else if (state.plansColumn) {
    // Compatibility fallback (older engines without ResizeObserver).
    window.addEventListener("resize", scheduleResponsiveRefresh);
  }

  scheduleResponsiveRefresh();

  Object.keys(state.plans).forEach((planKey) => {
    state.plans[planKey].locked = true;
    updatePlanLockUI(state, planKey);
  });
}
