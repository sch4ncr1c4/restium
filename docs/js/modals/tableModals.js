import { openModal, closeModal } from "./modalCore.js";
import {
  buildTableButton,
  getGridTables,
  setTablePosition,
  getPlanKeyByGrid,
  isPlanLocked,
  resetPlan,
  updateDeletePlanButtonsState,
  updateAddPlanButtonState,
  updatePlanLockUI,
  syncStaticAsideHeight,
  getActiveRemovablePlanCount,
  mountMissingPlan,
  syncGridTableRatios,
} from "../plans/planGrid.js";
import { hideTableContextMenu } from "../plans/contextMenu.js";
import { PLAN_PADDING } from "../config.js";

function placeNewTableWithoutReordering(grid, newTable) {
  const tableSize = parseFloat(grid.dataset.tableSize || "64");
  const gap = parseFloat(grid.dataset.tableGap || "10");
  const columns = parseInt(grid.dataset.tableColumns || "16", 10);
  const step = tableSize + gap;

  const existing = getGridTables(grid).filter((table) => table !== newTable);

  const maxRows = Math.max(1, Math.floor((grid.clientHeight - PLAN_PADDING * 2 + gap) / step));
  let found = null;
  for (let row = 0; row < maxRows && !found; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const left = PLAN_PADDING + col * step;
      const top = PLAN_PADDING + row * step;
      const collides = existing.some((table) => {
        const posLeft = parseFloat(table.style.left || "0");
        const posTop = parseFloat(table.style.top || "0");
        return (
          left < posLeft + tableSize &&
          left + tableSize > posLeft &&
          top < posTop + tableSize &&
          top + tableSize > posTop
        );
      });
      if (!collides) {
        found = { col, row };
        break;
      }
    }
  }

  if (!found) return false;
  setTablePosition(newTable, PLAN_PADDING + found.col * step, PLAN_PADDING + found.row * step);
  return true;
}

export function initTableModals(state, handlers) {
  state.deleteTableModal.__onClose = () => {
    state.contextTargetTable = null;
    state.contextTargetGrid = null;
  };
  state.deletePlanModal.__onClose = () => {
    state.pendingPlanAction = null;
  };

  const addTableModal = document.createElement("div");
  addTableModal.id = "addTableModal";
  addTableModal.className =
    "fixed inset-0 z-[82] hidden items-center justify-center bg-zinc-900/50 px-4 opacity-0 transition-opacity duration-200";
  addTableModal.innerHTML = `
    <div id="addTableModalPanel" class="w-full max-w-sm translate-y-2 scale-95 rounded-2xl border border-zinc-200 bg-white p-5 opacity-0 shadow-2xl transition-all duration-200">
      <h3 class="text-base font-semibold text-zinc-900">Agregar mesa</h3>
      <p class="mt-2 text-sm text-zinc-600">Elegi el numero de mesa para este plano.</p>
      <input id="addTableNumberInput" type="number" min="1" class="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Ej: 65" />
      <p id="addTableError" class="mt-2 hidden text-sm font-medium text-rose-600"></p>
      <div class="mt-5 flex justify-end gap-2">
        <button id="cancelAddTable" type="button" class="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">Cancelar</button>
        <button id="confirmAddTable" type="button" class="rounded-md bg-emeraldbrand px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">Agregar</button>
      </div>
    </div>
  `;
  document.body.appendChild(addTableModal);

  state.addTableModal = addTableModal;
  state.addTableModalPanel = document.getElementById("addTableModalPanel");
  state.addTableNumberInput = document.getElementById("addTableNumberInput");
  state.addTableError = document.getElementById("addTableError");
  state.cancelAddTable = document.getElementById("cancelAddTable");
  state.confirmAddTableBtn = document.getElementById("confirmAddTable");

  state.addTableAction.addEventListener("click", () => {
    if (!state.permissions?.canEditPlans) return;
    if (!state.contextTargetGrid) return;
    const planKey = getPlanKeyByGrid(state, state.contextTargetGrid);
    if (isPlanLocked(state, planKey)) return;

    state.addTableNumberInput.value = "";
    state.addTableError.textContent = "";
    state.addTableError.classList.add("hidden");
    hideTableContextMenu(state);
    openModal(state, state.addTableModal, {
      panel: state.addTableModalPanel,
      title: state.addTableModalPanel.querySelector("h3"),
    });
  });

  state.cancelAddTable.addEventListener("click", () => {
    closeModal(state, state.addTableModal, { panel: state.addTableModalPanel });
  });

  state.confirmAddTableBtn.addEventListener("click", () => {
    if (!state.permissions?.canEditPlans) return;
    if (!state.contextTargetGrid) return;
    const planKey = getPlanKeyByGrid(state, state.contextTargetGrid);
    if (isPlanLocked(state, planKey)) return;

    const value = parseInt(state.addTableNumberInput.value || "", 10);
    if (!Number.isInteger(value) || value <= 0) {
      state.addTableError.textContent = "Numero invalido.";
      state.addTableError.classList.remove("hidden");
      return;
    }

    const exists = state.contextTargetGrid.querySelector(`[data-table-id="${value}"]`);
    if (exists) {
      state.addTableError.textContent = "La mesa ya existe en este plano.";
      state.addTableError.classList.remove("hidden");
      return;
    }

    const table = buildTableButton(value, handlers);
    state.contextTargetGrid.appendChild(table);
    const tableSize = parseFloat(state.contextTargetGrid.dataset.tableSize || "64");
    table.style.width = `${tableSize}px`;
    table.style.height = `${tableSize}px`;
    const placed = placeNewTableWithoutReordering(state.contextTargetGrid, table);
    if (!placed) {
      table.remove();
      state.addTableError.textContent = "No hay espacio libre en este plano.";
      state.addTableError.classList.remove("hidden");
      return;
    }
    syncGridTableRatios(state.contextTargetGrid);
    closeModal(state, state.addTableModal, { panel: state.addTableModalPanel });
  });

  state.addTableModal.addEventListener("click", (event) => {
    if (event.target === state.addTableModal) {
      closeModal(state, state.addTableModal, { panel: state.addTableModalPanel });
    }
  });

  state.deleteTableAction.addEventListener("click", () => {
    if (!state.permissions?.canEditPlans) return;
    if (!state.contextTargetTable) return;
    const tableNumber = state.contextTargetTable.textContent?.trim() || "";
    state.deleteTableModalText.textContent = `Vas a eliminar la mesa ${tableNumber}. Esta accion no se puede deshacer.`;
    hideTableContextMenu(state);
    openModal(state, state.deleteTableModal, {
      panel: state.deleteTableModalPanel,
      title: state.deleteTableModalPanel.querySelector("h3"),
    });
  });

  state.cancelDeleteTable.addEventListener("click", () => {
    closeModal(state, state.deleteTableModal, { panel: state.deleteTableModalPanel });
  });

  state.confirmDeleteTable.addEventListener("click", () => {
    if (!state.permissions?.canEditPlans) return;
    if (state.contextTargetTable) {
      const grid = state.contextTargetTable.parentElement;
      state.contextTargetTable.remove();
      if (grid) syncGridTableRatios(grid);
    }
    closeModal(state, state.deleteTableModal, { panel: state.deleteTableModalPanel });
  });

  state.deleteTableModal.addEventListener("click", (event) => {
    if (event.target === state.deleteTableModal) {
      closeModal(state, state.deleteTableModal, { panel: state.deleteTableModalPanel });
    }
  });

  state.cancelDeletePlan.addEventListener("click", () => {
    closeModal(state, state.deletePlanModal, { panel: state.deletePlanModalPanel });
  });

  state.confirmDeletePlan.addEventListener("click", () => {
    if (!state.permissions?.canEditPlans) return;
    if (state.pendingPlanAction) {
      const { type, planKey } = state.pendingPlanAction;
      const plan = state.plans[planKey];

      if (type === "add") {
        const before = getActiveRemovablePlanCount(state);
        mountMissingPlan(state, handlers);
        if (getActiveRemovablePlanCount(state) > before) {
          updatePlanLockUI(state, "primary");
          updatePlanLockUI(state, "secondary");
          updateDeletePlanButtonsState(state);
          updateAddPlanButtonState(state);
          syncStaticAsideHeight(state, true);
        }
      }

      if (type === "delete" && plan && plan.card && plan.grid && plan.card.isConnected) {
        plan.card.remove();
        plan.card = null;
        plan.grid = null;
        state.plans[planKey].locked = true;
        updateDeletePlanButtonsState(state);
        updateAddPlanButtonState(state);
        syncStaticAsideHeight(state);
      }

      if (type === "reset") {
        resetPlan(state, planKey);
      }
    }

    closeModal(state, state.deletePlanModal, { panel: state.deletePlanModalPanel });
  });

  state.deletePlanModal.addEventListener("click", (event) => {
    if (event.target === state.deletePlanModal) {
      closeModal(state, state.deletePlanModal, { panel: state.deletePlanModalPanel });
    }
  });

  const openAddPlanConfirm = () => {
    if (!state.permissions?.canEditPlans) return;
    state.pendingPlanAction = { type: "add" };
    state.deletePlanModalTitle.textContent = "Agregar plano";
    state.deletePlanModalText.textContent = "Vas a agregar un nuevo plano. Deseas continuar?";
    state.confirmDeletePlan.textContent = "Agregar";
    state.confirmDeletePlan.className =
      "rounded-md bg-emeraldbrand px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600";
    openModal(state, state.deletePlanModal, { panel: state.deletePlanModalPanel, title: state.deletePlanModalTitle });
  };

  if (state.addPlanButton) {
    state.addPlanButton.addEventListener("click", openAddPlanConfirm);
  }
  if (state.addPlanContextAction) {
    state.addPlanContextAction.addEventListener("click", () => {
      state.plansContextMenu?.classList.add("hidden");
      openAddPlanConfirm();
    });
  }

  document.addEventListener("click", (event) => {
    const lockToggle = event.target.closest("[data-plan-lock-toggle]");
    if (lockToggle) {
      if (!state.permissions?.canEditPlans) return;
      const planKey = lockToggle.dataset.plan;
      if (!state.plans[planKey] || !state.plans[planKey].card || !state.plans[planKey].card.isConnected) return;
      state.plans[planKey].locked = !state.plans[planKey].locked;
      handlers.onLockToggled(planKey);
      return;
    }

    const controlsToggle = event.target.closest("[data-plan-controls-toggle]");
    if (controlsToggle) {
      if (!state.permissions?.canEditPlans) return;
      const planKey = controlsToggle.dataset.plan;
      const controls = document.querySelector(`[data-plan-controls][data-plan="${planKey}"]`);
      if (!controls) return;
      const isOpen = controls.classList.contains("is-open");
      if (!isOpen) {
        controls.classList.add("is-open");
        controlsToggle.textContent = "Ocultar";
        controlsToggle.setAttribute("aria-expanded", "true");
      } else {
        controls.classList.remove("is-open");
        controlsToggle.textContent = "Opciones";
        controlsToggle.setAttribute("aria-expanded", "false");
      }
      return;
    }

    const actionButton = event.target.closest("[data-plan-action]");
    if (!actionButton) return;
    if (!state.permissions?.canEditPlans) return;

    const action = actionButton.dataset.planAction;
    const planKey = actionButton.dataset.plan;
    const plan = state.plans[planKey];
    if (!plan || !plan.grid || !plan.card || !plan.card.isConnected) return;

    handlers.onPlanAction(action, planKey, plan);

    if (action === "delete") {
      if (getActiveRemovablePlanCount(state) <= 1) return;
      const planName = planKey === "primary" ? "Plano 1" : "Plano 2";
      state.pendingPlanAction = { type: "delete", planKey };
      state.deletePlanModalTitle.textContent = "Eliminar plano";
      state.deletePlanModalText.textContent = `Vas a eliminar ${planName}. Esta accion no se puede deshacer.`;
      state.confirmDeletePlan.textContent = "Eliminar";
      state.confirmDeletePlan.className =
        "rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700";
      openModal(state, state.deletePlanModal, { panel: state.deletePlanModalPanel, title: state.deletePlanModalTitle });
    }

    if (action === "reset") {
      const planName = planKey === "primary" ? "Plano 1" : "Plano 2";
      state.pendingPlanAction = { type: "reset", planKey };
      state.deletePlanModalTitle.textContent = "Resetear plano";
      state.deletePlanModalText.textContent = `Vas a resetear ${planName} a su estado inicial. Deseas continuar?`;
      state.confirmDeletePlan.textContent = "Resetear";
      state.confirmDeletePlan.className =
        "rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700";
      openModal(state, state.deletePlanModal, { panel: state.deletePlanModalPanel, title: state.deletePlanModalTitle });
    }
  });
}


