import { PLAN_PADDING, TABLE_COUNT, DESKTOP_TABLE_COLUMNS, TABLE_GAP_DESKTOP } from "../config.js";
import { clamp } from "../utils/math.js";
import { getGridTables, readTablePosition, setTablePosition, getPlanKeyByGrid, isPlanLocked, syncGridTableRatios } from "./planGrid.js";

function getGroupBounds(tables, tableSize) {
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  tables.forEach((table) => {
    const pos = readTablePosition(table);
    minLeft = Math.min(minLeft, pos.left);
    minTop = Math.min(minTop, pos.top);
    maxRight = Math.max(maxRight, pos.left + tableSize);
    maxBottom = Math.max(maxBottom, pos.top + tableSize);
  });

  return { minLeft, minTop, maxRight, maxBottom };
}

function getSnappedPlanPosition(grid, left, top, tableSize) {
  const tableGap = parseFloat(grid.dataset.tableGap || String(TABLE_GAP_DESKTOP));
  const step = Math.max(1, tableSize + tableGap);
  const snappedLeft = PLAN_PADDING + Math.round((left - PLAN_PADDING) / step) * step;
  const snappedTop = PLAN_PADDING + Math.round((top - PLAN_PADDING) / step) * step;
  const maxLeft = grid.clientWidth - tableSize - PLAN_PADDING;
  const maxTop = grid.clientHeight - tableSize - PLAN_PADDING;
  return {
    left: clamp(snappedLeft, PLAN_PADDING, maxLeft),
    top: clamp(snappedTop, PLAN_PADDING, maxTop),
  };
}

function collidesWithOtherTables(grid, movingTable, left, top, tableSize) {
  return getGridTables(grid).some((other) => {
    if (other === movingTable) return false;
    const pos = readTablePosition(other);
    return left < pos.left + tableSize && left + tableSize > pos.left && top < pos.top + tableSize && top + tableSize > pos.top;
  });
}

export function startTableDrag(state, event) {
  if (!state.permissions?.canEditPlans) return;
  const planKey = getPlanKeyByGrid(state, event.currentTarget.parentElement);
  if (isPlanLocked(state, planKey)) return;

  event.stopPropagation();
  const table = event.currentTarget;
  const grid = table.parentElement;
  const tableBounds = table.getBoundingClientRect();
  const gridBounds = grid.getBoundingClientRect();

  state.dragState = {
    mode: "table",
    grid,
    table,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - tableBounds.left,
    offsetY: event.clientY - tableBounds.top,
    gridBounds,
    moved: false,
  };

  table.classList.remove("cursor-grab");
  table.classList.add("cursor-grabbing", "z-20", "shadow-md");
}

export function startPlanPan(state, event) {
  // Disabled by design: unlocked mode should only move individual tables.
  // Keeping this function as a no-op preserves existing wiring in main.js.
  void state;
  void event;
}

function moveTableDrag(state, event) {
  const tableSize = parseFloat(state.dragState.grid.dataset.tableSize || "0");
  const minPos = PLAN_PADDING;
  const maxLeft = state.dragState.grid.clientWidth - tableSize - PLAN_PADDING;
  const maxTop = state.dragState.grid.clientHeight - tableSize - PLAN_PADDING;

  const nextLeft = clamp(event.clientX - state.dragState.gridBounds.left - state.dragState.offsetX, minPos, maxLeft);
  const nextTop = clamp(event.clientY - state.dragState.gridBounds.top - state.dragState.offsetY, minPos, maxTop);
  const collides = collidesWithOtherTables(state.dragState.grid, state.dragState.table, nextLeft, nextTop, tableSize);

  if (!collides) {
    setTablePosition(state.dragState.table, nextLeft, nextTop);
  }

  if (Math.abs(event.clientX - state.dragState.startX) > 3 || Math.abs(event.clientY - state.dragState.startY) > 3) {
    state.dragState.moved = true;
  }
}

function movePlanPan(state, event) {
  const grid = state.dragState.grid;
  const tables = getGridTables(grid);
  const tableSize = parseFloat(grid.dataset.tableSize || "0");
  const groupBounds = getGroupBounds(tables, tableSize);
  const diffX = event.clientX - state.dragState.startX;
  const diffY = event.clientY - state.dragState.startY;

  const minShiftX = PLAN_PADDING - groupBounds.minLeft;
  const maxShiftX = grid.clientWidth - PLAN_PADDING - groupBounds.maxRight;
  const minShiftY = PLAN_PADDING - groupBounds.minTop;
  const maxShiftY = grid.clientHeight - PLAN_PADDING - groupBounds.maxBottom;

  const shiftX = clamp(diffX, minShiftX, maxShiftX);
  const shiftY = clamp(diffY, minShiftY, maxShiftY);

  tables.forEach((table) => {
    const pos = readTablePosition(table);
    setTablePosition(table, pos.left + shiftX, pos.top + shiftY);
  });

  state.dragState.startX = event.clientX;
  state.dragState.startY = event.clientY;
}

export function moveDrag(state, event) {
  if (!state.dragState) return;
  event.preventDefault();
  if (state.dragState.mode === "table") {
    moveTableDrag(state, event);
    return;
  }
  if (state.dragState.mode === "plan") {
    movePlanPan(state, event);
  }
}

export function endDrag(state) {
  if (!state.dragState) return;

  if (state.dragState.mode === "table") {
    const table = state.dragState.table;
    const grid = state.dragState.grid;
    const tableSize = parseFloat(grid.dataset.tableSize || "0");
    const current = readTablePosition(table);
    const snapped = getSnappedPlanPosition(grid, current.left, current.top, tableSize);
    const collides = collidesWithOtherTables(grid, table, snapped.left, snapped.top, tableSize);
    if (!collides && (Math.abs(snapped.left - current.left) > 0.5 || Math.abs(snapped.top - current.top) > 0.5)) {
      table.style.transition = "left 120ms ease-out, top 120ms ease-out";
      setTablePosition(table, snapped.left, snapped.top);
      setTimeout(() => {
        if (table) table.style.transition = "";
      }, 140);
    }

    if (state.dragState.moved) {
      state.tableJustDragged = true;
      setTimeout(() => {
        state.tableJustDragged = false;
      }, 140);
    }
    table.classList.remove("cursor-grabbing", "z-20", "shadow-md");
    const planKey = getPlanKeyByGrid(state, state.dragState.grid);
    if (!isPlanLocked(state, planKey)) {
      table.classList.add("cursor-grab");
    }
    syncGridTableRatios(grid);
  }

  if (state.dragState.mode === "plan") {
    syncGridTableRatios(state.dragState.grid);
  }

  state.dragState = null;
}

export function initPlanDrag(state) {
  document.addEventListener("pointermove", (event) => moveDrag(state, event));
  document.addEventListener("pointerup", () => endDrag(state));
  document.addEventListener("pointercancel", () => endDrag(state));
}

