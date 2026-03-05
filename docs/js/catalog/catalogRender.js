import { CATALOG_GAP, CATALOG_TILE_SIZE } from "../config.js";
import { clamp } from "../utils/math.js";
import { escapeHtml, normalizeHexColor } from "../utils/dom.js";

function getBoardSize(board) {
  const rect = board.getBoundingClientRect();
  const fallbackWidth = board.parentElement ? board.parentElement.clientWidth : CATALOG_TILE_SIZE;
  const fallbackHeight = board.parentElement ? board.parentElement.clientHeight : CATALOG_TILE_SIZE;
  const width = Math.max(Math.floor(board.clientWidth || rect.width || fallbackWidth), CATALOG_TILE_SIZE);
  const height = Math.max(Math.floor(board.clientHeight || rect.height || fallbackHeight), CATALOG_TILE_SIZE);
  return { width, height };
}

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

function getCategoryHiddenMap(state, category) {
  if (!state.catalogHiddenByCategory[category]) {
    state.catalogHiddenByCategory[category] = Object.create(null);
  }
  return state.catalogHiddenByCategory[category];
}

function findNextFreeCell(occupied, cols, rows) {
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${col}:${row}`;
      if (!occupied.has(key)) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

export function renderCatalog(state) {
  const board = document.getElementById("catalogBoard");
  if (!board) return;

  const { width: innerWidth, height: innerHeight } = getBoardSize(board);
  const colPositions = buildAxisPositions(innerWidth);
  const rowPositions = buildAxisPositions(innerHeight);
  const cols = colPositions.length;
  const rows = rowPositions.length;

  const activeCategory = getActiveCategory(state);
  state.selectedCatalogCategory = activeCategory;
  const hiddenMap = getCategoryHiddenMap(state, activeCategory);
  const visibleProducts = state.productsCatalog.filter(
    (product) => (product.category || "Varios") === activeCategory && !hiddenMap[product.id],
  );
  const layout = getCategoryLayout(state, activeCategory);
  const occupied = new Set();

  visibleProducts.forEach((product) => {
    const current = layout[product.id];
    if (!current) {
      layout[product.id] = findNextFreeCell(occupied, cols, rows);
    } else {
      const clamped = {
        col: clamp(current.col, 0, cols - 1),
        row: clamp(current.row, 0, rows - 1),
      };
      const key = `${clamped.col}:${clamped.row}`;
      if (occupied.has(key)) {
        layout[product.id] = findNextFreeCell(occupied, cols, rows);
      } else {
        layout[product.id] = clamped;
      }
    }

    occupied.add(`${layout[product.id].col}:${layout[product.id].row}`);
  });

  const boardHeight = innerHeight;

  board.innerHTML = `
    <div id="catalogBoardInner" class="relative" style="height:${boardHeight}px">
      ${visibleProducts
        .map((product) => {
          const pos = layout[product.id];
          const dragClass = state.catalogLocked ? "cursor-default" : "cursor-grab";
          const tileColor = normalizeHexColor(state.catalogProductColors[product.id], "#FFFFFF");
          const isPainted = tileColor !== "#FFFFFF";
          const textClass = isPainted ? "text-white" : "text-zinc-700";
          return `<button data-product-id="${escapeHtml(product.id)}" type="button" class="absolute rounded-lg border border-zinc-300 px-1 text-center text-[10px] font-semibold ${textClass} hover:border-emeraldbrand ${dragClass}" style="touch-action:none;background-color:${tileColor};width:${CATALOG_TILE_SIZE}px;height:${CATALOG_TILE_SIZE}px;left:${colPositions[pos.col]}px;top:${rowPositions[pos.row]}px"><span class="line-clamp-2 block">${escapeHtml(product.name)}</span></button>`;
        })
        .join("")}
    </div>
  `;
}
