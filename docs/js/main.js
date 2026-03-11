import { initState, state } from "./state.js";
import { initModalCore } from "./modals/modalCore.js";
import {
  initContextMenu,
  handleGridContextMenu,
  handleTableContextMenu,
  handlePlansColumnContextMenu,
} from "./plans/contextMenu.js";
import {
  initPlanGrids,
  updateDeletePlanButtonsState,
  updateAddPlanButtonState,
  syncStaticAsideHeight,
  updatePlanLockUI,
  resizePlan,
  mountMissingPlan,
} from "./plans/planGrid.js";
import { initPlanDrag, startPlanPan, startTableDrag, endDrag } from "./plans/planDrag.js";
import { initTableModals } from "./modals/tableModals.js";
import { initViews } from "./ui/views.js";
import { initProfileMenu } from "./ui/profileMenu.js";
import { initDashboardData } from "./ui/dashboardData.js";
import { initCashModal } from "./modals/cashModal.js";
import { initClockModal } from "./modals/clockModal.js";
import {
  initOrderModal,
  openTableOrderModal,
  initQuickCatalogModals,
  openStaticPlanWaiterModal,
  openStaticTableOrderModal,
} from "./modals/orderModal.js";
import { initAdjustModal } from "./modals/adjustModal.js";
import { initOrdersEvents } from "./orders/ordersEvents.js";
import { initCatalogDrag } from "./catalog/catalogDrag.js";

initState();
initModalCore(state);
initContextMenu(state);
initOrderModal(state);
initAdjustModal(state);

const tableHandlers = {
  onTablePointerDown: (event) => startTableDrag(state, event),
  onTableContextMenu: (event) => handleTableContextMenu(state, event),
  onTableClick: (table) => openTableOrderModal(state, table),
  onGridPointerDown: (event) => startPlanPan(state, event),
  onGridContextMenu: (event) => handleGridContextMenu(state, event),
};

initPlanGrids(state, tableHandlers);
state.plansColumn?.addEventListener("contextmenu", (event) => handlePlansColumnContextMenu(state, event));
initPlanDrag(state);

initTableModals(state, {
  ...tableHandlers,
  onLockToggled: (planKey) => {
    if (state.dragState && state.dragState.grid === state.plans[planKey].grid) {
      endDrag(state);
    }
    updatePlanLockUI(state, planKey);
  },
  onPlanAction: (action, _planKey, plan) => {
    if (action === "grow") {
      resizePlan(plan.grid, 0, 80);
      syncStaticAsideHeight(state, true);
    }
    if (action === "shrink") {
      resizePlan(plan.grid, 0, -80);
      syncStaticAsideHeight(state, true);
    }
  },
});

initCashModal(state);
initClockModal(state);
initViews(state);
initProfileMenu(state);
initDashboardData(state).finally(() => {
  initQuickCatalogModals(state);
});
initOrdersEvents(state);
initCatalogDrag(state);

updateDeletePlanButtonsState(state);
updateAddPlanButtonState(state);
requestAnimationFrame(() => syncStaticAsideHeight(state, true));

document.querySelectorAll("[data-static-plan]").forEach((card) => {
  const planLabel = card.dataset.staticPlan || "Plano";
  card.addEventListener("click", (event) => {
    if (!state.permissions?.canEditPlans) return;
    if (event.target.closest("[data-static-table]")) return;
    openStaticPlanWaiterModal(state, planLabel);
  });
  card.addEventListener("keydown", (event) => {
    if (!state.permissions?.canEditPlans) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    openStaticPlanWaiterModal(state, planLabel);
  });
});

document.addEventListener("click", (event) => {
  const table = event.target.closest("[data-static-table]");
  if (!table) return;
  openStaticTableOrderModal(state, table);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const table = event.target.closest?.("[data-static-table]");
  if (!table) return;
  event.preventDefault();
  openStaticTableOrderModal(state, table);
});

window.mountMissingPlan = () => mountMissingPlan(state, tableHandlers);
