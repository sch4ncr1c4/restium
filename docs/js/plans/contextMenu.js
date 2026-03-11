import { getPlanKeyByGrid, isPlanLocked, getMissingPlanKey } from "./planGrid.js";

export function initContextMenu(state) {
  const tableContextMenu = document.createElement("div");
  tableContextMenu.id = "tableContextMenu";
  tableContextMenu.className =
    "fixed z-[70] hidden min-w-[150px] rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl";
  tableContextMenu.innerHTML =
    '<button id="addTableAction" type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50">Agregar mesa</button>' +
    '<button id="deleteTableAction" type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50">Eliminar mesa</button>';
  document.body.appendChild(tableContextMenu);

  state.tableContextMenu = tableContextMenu;
  state.addTableAction = document.getElementById("addTableAction");
  state.deleteTableAction = document.getElementById("deleteTableAction");

  const plansContextMenu = document.createElement("div");
  plansContextMenu.id = "plansContextMenu";
  plansContextMenu.className =
    "fixed z-[70] hidden min-w-[150px] rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl";
  plansContextMenu.innerHTML =
    '<button id="addPlanContextAction" type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50">Agregar plano</button>';
  document.body.appendChild(plansContextMenu);

  state.plansContextMenu = plansContextMenu;
  state.addPlanContextAction = document.getElementById("addPlanContextAction");

  document.addEventListener("pointerdown", (event) => {
    if (!state.tableContextMenu.classList.contains("hidden") && !state.tableContextMenu.contains(event.target)) {
      hideTableContextMenu(state);
    }
    if (!state.plansContextMenu.classList.contains("hidden") && !state.plansContextMenu.contains(event.target)) {
      hidePlansContextMenu(state);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !state.tableContextMenu.classList.contains("hidden")) {
      hideTableContextMenu(state);
    }
    if (event.key === "Escape" && !state.plansContextMenu.classList.contains("hidden")) {
      hidePlansContextMenu(state);
    }
  });
}

export function hideTableContextMenu(state) {
  state.tableContextMenu.classList.add("hidden");
}

export function hidePlansContextMenu(state) {
  state.plansContextMenu.classList.add("hidden");
}

export function handleTableContextMenu(state, event) {
  if (!state.permissions?.canEditPlans) return;
  event.preventDefault();
  const table = event.currentTarget;
  const grid = table.parentElement;
  const planKey = getPlanKeyByGrid(state, grid);
  if (isPlanLocked(state, planKey)) return;

  state.contextTargetTable = table;
  state.contextTargetGrid = grid;
  state.addTableAction.classList.remove("hidden");
  state.deleteTableAction.classList.remove("hidden");

  hidePlansContextMenu(state);
  state.tableContextMenu.classList.remove("hidden");
  const menuWidth = 160;
  const menuHeight = 84;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  state.tableContextMenu.style.left = `${Math.max(8, left)}px`;
  state.tableContextMenu.style.top = `${Math.max(8, top)}px`;
}

export function handleGridContextMenu(state, event) {
  if (!state.permissions?.canEditPlans) return;
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  const grid = event.currentTarget;
  const planKey = getPlanKeyByGrid(state, grid);
  if (isPlanLocked(state, planKey)) return;

  state.contextTargetGrid = grid;
  state.contextTargetTable = null;
  state.addTableAction.classList.remove("hidden");
  state.deleteTableAction.classList.add("hidden");

  hidePlansContextMenu(state);
  state.tableContextMenu.classList.remove("hidden");
  const menuWidth = 160;
  const menuHeight = 44;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  state.tableContextMenu.style.left = `${Math.max(8, left)}px`;
  state.tableContextMenu.style.top = `${Math.max(8, top)}px`;
}

export function handlePlansColumnContextMenu(state, event) {
  if (!state.permissions?.canEditPlans) return;
  if (!state.plansColumn || !state.plansColumn.contains(event.target)) return;
  if (event.target.closest("[id^='tablesGrid']")) return;
  event.preventDefault();

  hideTableContextMenu(state);

  const missingPlanKey = getMissingPlanKey(state);
  const disabled = !missingPlanKey;
  state.addPlanContextAction.disabled = disabled;
  state.addPlanContextAction.classList.toggle("opacity-40", disabled);
  state.addPlanContextAction.classList.toggle("cursor-not-allowed", disabled);

  state.plansContextMenu.classList.remove("hidden");
  const menuWidth = 160;
  const menuHeight = 44;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  state.plansContextMenu.style.left = `${Math.max(8, left)}px`;
  state.plansContextMenu.style.top = `${Math.max(8, top)}px`;
}
