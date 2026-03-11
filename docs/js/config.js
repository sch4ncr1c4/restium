export const OPEN_MODAL_CLASS = "opacity-100";
export const CLOSED_MODAL_CLASS = "opacity-0";

export const TABLE_COUNT = 64;
export const DESKTOP_TABLE_COLUMNS = 16;
export const TABLE_GAP_DESKTOP = 10;
export const TABLE_GAP_MOBILE = 6;
export const MIN_TABLE_SIZE = 20;
export const MAX_TABLE_SIZE = 64;
export const PLAN_PADDING = 10;
export const PLAN_RESIZE_STEP_W = 0;
export const PLAN_RESIZE_STEP_H = 80;
export const PLAN_MIN_W = 820;
export const PLAN_MAX_W = 2200;
export const PLAN_MIN_H = 320;
export const PLAN_MAX_H = 1200;

export const CATALOG_TILE_SIZE = 74;
export const CATALOG_GAP = 8;

export const PLAN_META = {
  primary: {
    title: "Plano 1",
    cardId: "planCardPrimary",
    gridId: "tablesGridPrimary",
  },
  secondary: {
    title: "Plano 2",
    cardId: "planCardSecondary",
    gridId: "tablesGridSecondary",
  },
};

export const DEFAULT_PRODUCTS = [
  { id: "mila", name: "Milanesa napolitana", price: 9800, category: "Platos" },
  { id: "papas", name: "Papas rusticas", price: 4200, category: "Entradas" },
  { id: "empi", name: "Empanadas x3", price: 3600, category: "Entradas" },
  { id: "limo", name: "Limonada menta", price: 3100, category: "Bebidas" },
  { id: "flan", name: "Flan casero", price: 2900, category: "Postres" },
  { id: "agua", name: "Agua sin gas", price: 1800, category: "Bebidas" },
  { id: "fernet", name: "Fernet con cola", price: 5200, category: "Tragos" },
  { id: "promo", name: "Promo del dia", price: 7500, category: "Varios" },
  { id: "burgerc", name: "Burger clasica", price: 8600, category: "Burgers" },
  { id: "muzza", name: "Pizza muzzarella", price: 9400, category: "Pizzas" },
];

export const DEFAULT_WAITERS = [];
export const DEFAULT_CATEGORIES = ["Bebidas", "Tragos", "Entradas", "Varios", "Burgers", "Pizzas", "Platos", "Postres"];
