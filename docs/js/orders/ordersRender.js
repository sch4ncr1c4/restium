import { money } from "../utils/format.js";
import { calcTotals } from "./ordersCalc.js";
import { syncTableOccupiedState } from "../plans/planGrid.js";
import { escapeHtml, escapeCssAttrValue } from "../utils/dom.js";

export function ensureOrderMeta(state, key) {
  if (!state.metaByTable[key]) {
    state.metaByTable[key] = { waiterName: "Terminal", discountAmount: 0, depositAmount: 0, invoiceType: "" };
  }
  if (!state.ordersByTable[key]) state.ordersByTable[key] = [];
  if (!state.waiters.includes(state.metaByTable[key].waiterName)) {
    state.metaByTable[key].waiterName = state.waiters[0] || "Terminal";
  }
}

export function renderWaiters(state) {
  const waiterSelect = document.getElementById("orderWaiterSelect");
  waiterSelect.innerHTML = state.waiters.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
}

export function renderOrderModal(state) {
  if (!state.currentOrderKey) return;
  ensureOrderMeta(state, state.currentOrderKey);

  const items = state.ordersByTable[state.currentOrderKey];
  const meta = state.metaByTable[state.currentOrderKey];
  const totals = calcTotals(items, meta);

  const waiterSelect = document.getElementById("orderWaiterSelect");
  waiterSelect.value = meta.waiterName;
  document.getElementById("orderItemsCount").textContent = `${items.length} items`;

  document.getElementById("orderItemsList").innerHTML = items
    .map((item) => {
      const itemKey = item.lineId || item.id;
      const selected = state.selectedOrderProductId === itemKey;
      const deleted = Boolean(item.deleted);
      const safeItemKey = escapeHtml(itemKey);
      const qty = Math.max(0, Math.trunc(Number(item.qty) || 0));
      return `<article data-order-item="${safeItemKey}" class="cursor-pointer rounded-lg border p-2 ${selected ? "border-emeraldbrand bg-emerald-50" : "border-zinc-200 bg-white"} ${deleted ? "opacity-75" : ""}">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold">${escapeHtml(item.name)}</p>
            <p class="text-xs text-zinc-500">Unitario: ${money.format(item.price)}</p>
            <p class="text-xs text-zinc-500">Total: ${money.format(item.price * qty)}</p>
            ${deleted ? '<p class="text-xs font-semibold text-rose-600">Eliminado</p>' : ""}
          </div>
          ${
            deleted
              ? '<div class="rounded bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">Borrado</div>'
              : `<div class="flex items-center gap-1">
                  <button data-qty-minus="${safeItemKey}" type="button" class="h-6 w-6 rounded bg-zinc-200 text-xs font-bold text-zinc-700">-</button>
                  <span class="w-7 text-center text-xs font-semibold">x${qty}</span>
                  <button data-qty-plus="${safeItemKey}" type="button" class="h-6 w-6 rounded bg-zinc-200 text-xs font-bold text-zinc-700">+</button>
                </div>`
          }
        </div>
      </article>`;
    })
    .join("");

  document.getElementById("orderSubtotal").textContent = money.format(totals.subtotal);
  document.getElementById("orderDeposit").textContent = `-${money.format(totals.deposit)}`;
  document.getElementById("orderDiscount").textContent = `-${money.format(totals.discount)}`;
  document.getElementById("orderTotal").textContent = money.format(totals.total);

  const deleteItemButton = document.getElementById("deleteOrderItemButton");
  const selectedItem = items.find((item) => (item.lineId || item.id) === state.selectedOrderProductId);
  const deleteDisabled = !selectedItem || selectedItem.deleted;
  deleteItemButton.disabled = deleteDisabled;
  deleteItemButton.classList.toggle("opacity-40", deleteDisabled);

  const invoiceAButton = document.getElementById("invoiceAButton");
  const invoiceBButton = document.getElementById("invoiceBButton");
  invoiceAButton.className =
    meta.invoiceType === "A"
      ? "rounded-md bg-zinc-900 px-2 py-2 text-[11px] font-semibold text-white"
      : "rounded-md bg-zinc-100 px-2 py-2 text-[11px] font-semibold text-zinc-700";
  invoiceBButton.className =
    meta.invoiceType === "B"
      ? "rounded-md bg-zinc-900 px-2 py-2 text-[11px] font-semibold text-white"
      : "rounded-md bg-zinc-100 px-2 py-2 text-[11px] font-semibold text-zinc-700";

  syncTableOccupiedState(state, state.currentOrderKey);

  const staticTable = document.querySelector(
    `[data-static-table][data-order-key="${escapeCssAttrValue(state.currentOrderKey)}"]`,
  );
  if (staticTable) {
    const occupied = items.some((item) => !item.deleted && Number(item.qty || 0) > 0);
    staticTable.className = occupied
      ? "h-10 w-10 rounded-md border border-rose-500 bg-rose-100 text-[10px] font-semibold leading-none text-rose-800 transition hover:border-rose-600 hover:bg-rose-200"
      : "h-10 w-10 rounded-md border border-emerald-500 bg-emerald-100 text-[10px] font-semibold leading-none text-emerald-800 transition hover:border-emerald-600 hover:bg-emerald-200";
  }
}
