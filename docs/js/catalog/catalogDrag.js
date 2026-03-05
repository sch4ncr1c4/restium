import { CATALOG_GAP, CATALOG_TILE_SIZE } from "../config.js";
import { clamp } from "../utils/math.js";
import { renderCatalog } from "./catalogRender.js";

function buildAxisPositions(length) {
  const step = CATALOG_TILE_SIZE + CATALOG_GAP;
  const maxStart = Math.max(0, length - CATALOG_TILE_SIZE);
  const positions = [];
  for (let pos = 0; pos <= maxStart; pos += step) {
    positions.push(pos);
  }
  if (positions.length === 0 || positions[positions.length - 1] !== maxStart) {
    positions.push(maxStart);
  }
  return positions;
}

function getActiveCategory(state) {
  if (state.selectedCatalogCategory && state.categories.includes(state.selectedCatalogCategory)) {
    return state.selectedCatalogCategory;
  }
  if (state.categories.length) return state.categories[0];
  return "Varios";
}

function getCategoryLayout(state, category) {
  if (!state.catalogLayoutByCategory[category]) {
    state.catalogLayoutByCategory[category] = Object.create(null);
  }
  return state.catalogLayoutByCategory[category];
}

function getVisibleProductsByCategory(state, category) {
  return state.productsCatalog.filter((product) => (product.category || "Varios") === category);
}

function snapCatalogPosition(board, x, y) {
  const width = Math.max(board.clientWidth, CATALOG_TILE_SIZE);
  const height = Math.max(board.clientHeight, CATALOG_TILE_SIZE);
  const colPositions = buildAxisPositions(width);
  const rowPositions = buildAxisPositions(height);

  const nearestCol = colPositions.reduce(
    (best, pos, idx) => {
      const dist = Math.abs(x - pos);
      if (dist < best.dist) return { idx, dist };
      return best;
    },
    { idx: 0, dist: Number.POSITIVE_INFINITY },
  ).idx;

  const nearestRow = rowPositions.reduce(
    (best, pos, idx) => {
      const dist = Math.abs(y - pos);
      if (dist < best.dist) return { idx, dist };
      return best;
    },
    { idx: 0, dist: Number.POSITIVE_INFINITY },
  ).idx;

  return { col: nearestCol, row: nearestRow };
}

function isCatalogCellOccupied(state, productId, category, col, row) {
  const layout = getCategoryLayout(state, category);
  return getVisibleProductsByCategory(state, category).some((product) => {
    if (product.id === productId) return false;
    const pos = layout[product.id];
    return pos && pos.col === col && pos.row === row;
  });
}

function startCatalogDrag(state, event) {
  if (state.catalogLocked) return;
  const tile = event.target.closest("#catalogBoard [data-product-id]");
  if (!tile) return;
  const board = document.getElementById("catalogBoard");
  const tileLeft = parseFloat(tile.style.left || "0");
  const tileTop = parseFloat(tile.style.top || "0");
  const category = getActiveCategory(state);
  const layout = getCategoryLayout(state, category);

  state.catalogDragState = {
    productId: tile.dataset.productId,
    category,
    tile,
    board,
    pointerStartX: event.clientX,
    pointerStartY: event.clientY,
    startLeft: tileLeft,
    startTop: tileTop,
    originCol: layout[tile.dataset.productId]?.col ?? 0,
    originRow: layout[tile.dataset.productId]?.row ?? 0,
    moved: false,
  };

  tile.classList.remove("cursor-grab");
  tile.classList.add("cursor-grabbing", "z-20", "shadow-md");
}

function moveCatalogDrag(state, event) {
  if (!state.catalogDragState) return;
  event.preventDefault();

  const { tile, board, pointerStartX, pointerStartY, startLeft, startTop } = state.catalogDragState;
  const deltaX = event.clientX - pointerStartX;
  const deltaY = event.clientY - pointerStartY;
  const maxX = Math.max(0, board.clientWidth - CATALOG_TILE_SIZE);
  const maxY = Math.max(0, board.clientHeight - CATALOG_TILE_SIZE);
  const nextLeft = clamp(startLeft + deltaX, 0, maxX);
  const nextTop = clamp(startTop + deltaY, 0, maxY);

  tile.style.left = `${nextLeft}px`;
  tile.style.top = `${nextTop}px`;
  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    state.catalogDragState.moved = true;
  }
}

function endCatalogDrag(state) {
  if (!state.catalogDragState) return;
  const { tile, board, productId, category, moved, originCol, originRow } = state.catalogDragState;
  tile.classList.remove("cursor-grabbing", "z-20", "shadow-md");
  tile.classList.add("cursor-grab");

  if (moved) {
    const liveLeft = parseFloat(tile.style.left || "0");
    const liveTop = parseFloat(tile.style.top || "0");
    const snapped = snapCatalogPosition(board, liveLeft, liveTop);
    const layout = getCategoryLayout(state, category);

    if (isCatalogCellOccupied(state, productId, category, snapped.col, snapped.row)) {
      layout[productId] = { col: originCol, row: originRow };
    } else {
      layout[productId] = snapped;
    }

    renderCatalog(state);
    state.catalogJustDragged = true;
    setTimeout(() => {
      state.catalogJustDragged = false;
    }, 120);
  }

  state.catalogDragState = null;
}

export function initCatalogDrag(state) {
  const board = document.getElementById("catalogBoard");
  board.addEventListener("pointerdown", (e) => startCatalogDrag(state, e));
  document.addEventListener("pointermove", (e) => moveCatalogDrag(state, e));
  document.addEventListener("pointerup", () => endCatalogDrag(state));
  document.addEventListener("pointercancel", () => endCatalogDrag(state));
}
