import { renderOrderModal } from "./ordersRender.js";
import { renderCatalog } from "../catalog/catalogRender.js";
import { setAdjustModal, applyAdjust } from "../modals/adjustModal.js";
import {
  renderOrderCategories,
  renderCatalogLockUI,
  renderCatalogPaintUI,
  commitPendingStaticTableDraft,
} from "../modals/orderModal.js";

export function initOrdersEvents(state) {
  document.getElementById("orderWaiterSelect").addEventListener("change", (event) => {
    if (!state.currentOrderKey) return;
    const pickedWaiter = String(event.target.value || "");
    if (!state.waiters.includes(pickedWaiter)) {
      state.metaByTable[state.currentOrderKey].waiterName = state.waiters[0] || "";
      renderOrderModal(state);
      return;
    }
    state.metaByTable[state.currentOrderKey].waiterName = pickedWaiter;
  });

  document.getElementById("toggleCatalogLockButton").addEventListener("click", () => {
    if (!state.permissions?.canManageCatalog) return;
    state.catalogLocked = !state.catalogLocked;
    renderCatalogLockUI(state);
    renderCatalog(state);
  });

  document.getElementById("catalogColorPalette").addEventListener("click", (event) => {
    const button = event.target.closest("[data-catalog-color]");
    if (!button) return;
    const picked = button.dataset.catalogColor;
    state.catalogPaintColor = state.catalogPaintColor === picked ? null : picked;
    renderCatalogPaintUI(state);
  });

  document.getElementById("toggleCatalogPalette").addEventListener("click", () => {
    state.catalogPaletteOpen = !state.catalogPaletteOpen;
    if (!state.catalogPaletteOpen) {
      state.catalogPaintColor = null;
    }
    renderCatalogPaintUI(state);
  });

  document.getElementById("catalogBoard").addEventListener("click", (event) => {
    if (state.catalogDragState || state.catalogJustDragged || !state.currentOrderKey) return;
    const btn = event.target.closest("[data-product-id]");
    if (!btn) return;
    const product = state.productsCatalog.find((p) => p.id === btn.dataset.productId);
    if (!product) return;

    if (state.catalogPaintColor) {
      state.catalogProductColors[product.id] = state.catalogPaintColor;
      renderCatalog(state);
      return;
    }

    const items = state.ordersByTable[state.currentOrderKey];
    const foundActive = items.find((i) => i.id === product.id && !i.deleted);
    if (foundActive) {
      foundActive.qty += 1;
    } else {
      items.push({
        ...product,
        qty: 1,
        deleted: false,
        lineId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });
    }
    commitPendingStaticTableDraft(state);
    renderOrderModal(state);
  });

  document.getElementById("orderItemsList").addEventListener("click", (event) => {
    if (!state.currentOrderKey) return;
    const items = state.ordersByTable[state.currentOrderKey] || [];
    const minus = event.target.closest("[data-qty-minus]");
    const plus = event.target.closest("[data-qty-plus]");
    const card = event.target.closest("[data-order-item]");

    if (minus) {
      const item = items.find((i) => (i.lineId || i.id) === minus.dataset.qtyMinus);
      if (item) {
        if (item.deleted) {
          renderOrderModal(state);
          return;
        }
        if (item.qty > 1) {
          item.qty -= 1;
        } else {
          item.deleted = true;
        }
      }
      renderOrderModal(state);
      return;
    }

    if (plus) {
      const item = items.find((i) => (i.lineId || i.id) === plus.dataset.qtyPlus);
      if (item) item.qty += 1;
      renderOrderModal(state);
      return;
    }

    if (card) {
      state.selectedOrderProductId = card.dataset.orderItem;
      renderOrderModal(state);
    }
  });

  document.getElementById("deleteOrderItemButton").addEventListener("click", () => {
    if (!state.currentOrderKey || !state.selectedOrderProductId) return;
    const item = (state.ordersByTable[state.currentOrderKey] || []).find(
      (i) => (i.lineId || i.id) === state.selectedOrderProductId,
    );
    if (item) {
      item.deleted = true;
    }
    renderOrderModal(state);
  });

  document.getElementById("invoiceAButton").addEventListener("click", () => {
    if (!state.currentOrderKey) return;
    const meta = state.metaByTable[state.currentOrderKey];
    meta.invoiceType = meta.invoiceType === "A" ? "" : "A";
    renderOrderModal(state);
  });

  document.getElementById("invoiceBButton").addEventListener("click", () => {
    if (!state.currentOrderKey) return;
    const meta = state.metaByTable[state.currentOrderKey];
    meta.invoiceType = meta.invoiceType === "B" ? "" : "B";
    renderOrderModal(state);
  });

  document.getElementById("openAdjustModal").addEventListener("click", () => setAdjustModal(state, true));
  document.getElementById("cancelAdjustButton").addEventListener("click", () => setAdjustModal(state, false));
  document.getElementById("applyAdjustButton").addEventListener("click", () => applyAdjust(state));
  document.getElementById("removeDiscountButton").addEventListener("click", () => {
    if (!state.currentOrderKey) return;
    state.metaByTable[state.currentOrderKey].discountAmount = 0;
    renderOrderModal(state);
  });

  document.getElementById("adjustAmount").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyAdjust(state);
    }
  });

  window.addEventListener("resize", () => {
    if (!state.orderModal.classList.contains("hidden")) {
      renderOrderCategories(state);
      renderCatalogLockUI(state);
      renderCatalogPaintUI(state);
      renderCatalog(state);
    }
  });
}
