import { PLAN_META, DEFAULT_PRODUCTS, DEFAULT_WAITERS, DEFAULT_CATEGORIES } from "./config.js";

export const state = {
  currentUser: null,
  permissions: {
    restrictToMesas: false,
    canViewMenuDelivery: true,
    canEditPlans: true,
    canManageCatalog: true,
    canManageStaff: true,
    canUseCash: true,
    canUseClock: true,
    canUseTerminalWaiter: false,
  },

  plansColumn: null,
  addPlanButton: null,
  staticPlansAside: null,
  plans: {},

  dragState: null,
  contextTargetTable: null,
  contextTargetGrid: null,
  pendingPlanAction: null,
  staticAsideBaselineHeight: null,
  tableJustDragged: false,

  modalStack: [],
  modalCloseTimers: new WeakMap(),

  tableContextMenu: null,
  addTableAction: null,
  deleteTableAction: null,
  plansContextMenu: null,
  addPlanContextAction: null,

  deleteTableModal: null,
  deleteTableModalPanel: null,
  deleteTableModalText: null,
  cancelDeleteTable: null,
  confirmDeleteTable: null,

  deletePlanModal: null,
  deletePlanModalPanel: null,
  deletePlanModalTitle: null,
  deletePlanModalText: null,
  cancelDeletePlan: null,
  confirmDeletePlan: null,

  addTableModal: null,
  addTableModalPanel: null,
  addTableNumberInput: null,
  addTableError: null,
  cancelAddTable: null,
  confirmAddTableBtn: null,

  profileButton: null,
  profileMenu: null,

  panels: {},
  currentView: "mesas",
  panelSwitchTimer: null,
  sideTabs: [],
  topTabs: [],

  openCashModal: null,
  closeCashModal: null,
  cashModal: null,
  cashModalPanel: null,
  clockModal: null,
  clockModalPanel: null,

  productsCatalog: [...DEFAULT_PRODUCTS],
  categories: [...DEFAULT_CATEGORIES],
  selectedCatalogCategory: "",
  waiters: [...DEFAULT_WAITERS],
  staffMembers: [],
  ordersByTable: Object.create(null),
  metaByTable: Object.create(null),
  currentOrderKey: null,
  selectedOrderProductId: null,

  catalogLayout: {},
  catalogLayoutByCategory: Object.create(null),
  catalogHiddenByCategory: Object.create(null),
  catalogLocked: true,
  catalogPaintColor: null,
  catalogProductColors: Object.create(null),
  catalogCategoryColors: Object.create(null),
  catalogPaletteOpen: false,
  catalogDragState: null,
  catalogJustDragged: false,

  orderModal: null,
  waiterPickerModal: null,
  waiterPickerPanel: null,
  waiterPickerOptions: null,
  staticPlanTableState: Object.create(null),
  pendingStaticPlanKey: null,
  pendingStaticTableDraft: null,
  adjustModal: null,
  addProductModal: null,
  addWaiterModal: null,
  addCategoryModal: null,
};

export function initState() {
  state.plansColumn = document.getElementById("plansColumn");
  state.addPlanButton = document.getElementById("addPlanButton");
  state.staticPlansAside = document.getElementById("staticPlansAside");

  state.plans = {
    primary: {
      card: document.getElementById(PLAN_META.primary.cardId),
      grid: document.getElementById(PLAN_META.primary.gridId),
    },
    secondary: {
      card: document.getElementById(PLAN_META.secondary.cardId),
      grid: document.getElementById(PLAN_META.secondary.gridId),
    },
  };

  state.deleteTableModal = document.getElementById("deleteTableModal");
  state.deleteTableModalPanel = document.getElementById("deleteTableModalPanel");
  state.deleteTableModalText = document.getElementById("deleteTableModalText");
  state.cancelDeleteTable = document.getElementById("cancelDeleteTable");
  state.confirmDeleteTable = document.getElementById("confirmDeleteTable");

  state.deletePlanModal = document.getElementById("deletePlanModal");
  state.deletePlanModalPanel = document.getElementById("deletePlanModalPanel");
  state.deletePlanModalTitle = document.getElementById("deletePlanModalTitle");
  state.deletePlanModalText = document.getElementById("deletePlanModalText");
  state.cancelDeletePlan = document.getElementById("cancelDeletePlan");
  state.confirmDeletePlan = document.getElementById("confirmDeletePlan");

  state.profileButton = document.getElementById("profileButton");
  state.profileMenu = document.getElementById("profileMenu");

  state.panels = {
    mesas: document.getElementById("view-mesas"),
    menu: document.getElementById("view-menu"),
    delivery: document.getElementById("view-delivery"),
  };

  state.sideTabs = Array.from(document.querySelectorAll(".side-tab"));
  state.topTabs = Array.from(document.querySelectorAll(".top-tab"));

  state.openCashModal = document.getElementById("openCashModal");
  state.closeCashModal = document.getElementById("closeCashModal");
  state.cashModal = document.getElementById("cashModal");
  state.cashModalPanel = document.getElementById("cashModalPanel");
}
