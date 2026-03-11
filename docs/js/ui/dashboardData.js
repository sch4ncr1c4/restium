import { apiRequest, saveAuthUser } from "../services/apiClient.js";
import { renderOrderCategories } from "../modals/orderModal.js";
import { renderCatalog } from "../catalog/catalogRender.js";
import { renderWaiters } from "../orders/ordersRender.js";
import { applyRoleAccess, setView } from "./views.js";

const BACKEND_BASE_URL = "http://localhost:3000";

function resolveProductImageUrl(value) {
  if (!value) return "";
  if (/^data:image\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${BACKEND_BASE_URL}${value}`;
  return `${BACKEND_BASE_URL}/${value}`;
}

function renderProductListItem(product) {
  const priceLabel = `$${Number(product.price).toLocaleString("es-AR")}`;
  const imageUrl = resolveProductImageUrl(product.imageUrl);
  if (!imageUrl) {
    return `<li>${product.name} - ${priceLabel}</li>`;
  }
  return `
    <li class="flex items-center gap-3">
      <img src="${imageUrl}" alt="${product.name}" class="h-[100px] w-[100px] rounded-md object-cover border border-zinc-200" />
      <span>${product.name} - ${priceLabel}</span>
    </li>
  `;
}

function setProfileIdentity(user) {
  const userLabel = document.getElementById("profileUserLabel");
  const profileButton = document.getElementById("profileButton");
  if (!user) return;

  if (userLabel) {
    userLabel.textContent = `${user.email}${user.role ? ` (${user.role})` : ""}`;
  }

  if (profileButton) {
    const seed = (user.name || user.email || "U").trim();
    profileButton.textContent = seed.charAt(0).toUpperCase() || "U";
  }
}

function getStaffDisplayName(user) {
  const first = String(user?.name || "").trim();
  const last = String(user?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || String(user?.username || user?.email || "Sin nombre").trim();
}

function renderMenuData(products) {
  const categoriesList = document.getElementById("menuCategoriesList");
  const productsList = document.getElementById("menuProductsList");
  const deliveryProductsList = document.getElementById("deliveryProductsList");
  const visibleInMenu = products.filter((product) => product.showInMenu !== false);
  const visibleInDelivery = products.filter((product) => product.showInDelivery !== false);

  if (categoriesList) {
    const categories = [...new Set(visibleInMenu.map((product) => product.category || "General"))];
    categoriesList.innerHTML = categories.length
      ? categories.map((category) => `<li>${category}</li>`).join("")
      : "<li>Sin categorias todavia.</li>";
  }

  if (productsList) {
    productsList.innerHTML = visibleInMenu.length
      ? visibleInMenu
          .slice(0, 8)
          .map((product) => renderProductListItem(product))
          .join("")
      : "<li>No hay productos todavia.</li>";
  }

  if (deliveryProductsList) {
    deliveryProductsList.innerHTML = visibleInDelivery.length
      ? visibleInDelivery
          .slice(0, 8)
          .map((product) => renderProductListItem(product))
          .join("")
      : "<li>No hay productos todavia.</li>";
  }
}

function renderCashSummary(summary) {
  const ordersNode = document.getElementById("cashSummaryOrders");
  const totalNode = document.getElementById("cashSummaryTotal");
  const updatedNode = document.getElementById("cashSummaryUpdatedAt");
  const rawTotal = summary.total_sales;
  const totalLabel =
    typeof rawTotal === "string" && rawTotal.includes("-")
      ? "$-"
      : `$${Number(rawTotal ?? 0).toLocaleString("es-AR")}`;

  if (ordersNode) ordersNode.textContent = `${summary.orders_count ?? 0}`;
  if (totalNode) totalNode.textContent = totalLabel;
  if (updatedNode) {
    const now = new Date();
    updatedNode.textContent = `Actualizado ${now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  }
}

function mapBackendProductsToCatalog(products) {
  return products.map((product) => ({
    id: String(product.id),
    name: product.name,
    price: Number(product.price),
    category: "General",
    description: product.description || "",
    taxRate: Number(product.tax_rate ?? 21),
    rubro: product.rubro || "",
    subrubro: product.subrubro || "",
    productType: product.product_type || "",
    printerTargets: Array.isArray(product.printer_targets) ? product.printer_targets : [],
    showInMenu: Boolean(product.show_in_menu),
    showInDelivery: Boolean(product.show_in_delivery),
    imageUrl: product.image_url || "",
  }));
}

async function loadCurrentUser() {
  const response = await apiRequest("/auth/me", { auth: true });
  if (response?.user) {
    saveAuthUser(response.user);
    return response.user;
  }
  return null;
}

async function loadProducts(state) {
  const response = await apiRequest("/products", { auth: true });
  const items = mapBackendProductsToCatalog(response?.data || []);
  state.productsCatalog = items;
  state.categories = [...new Set(items.map((product) => product.category || "General"))];
  if (!state.categories.length) state.categories = ["General"];
  state.selectedCatalogCategory = state.categories[0] || "General";

  renderMenuData(items);
  renderOrderCategories(state);
  renderCatalog(state);
}

async function loadStaff(state) {
  try {
    const response = await apiRequest("/users", { auth: true });
    const staff = Array.isArray(response?.data) ? response.data : [];
    state.staffMembers = staff;
    const waiterNames = staff
      .filter((user) => String(user.role || "").toLowerCase() === "mozo")
      .map((user) => getStaffDisplayName(user));

    const uniqueWaiters = [...new Set(waiterNames.filter(Boolean))];
    const currentRole = String(state.currentUser?.role || "").toLowerCase();
    const canUseTerminal = currentRole === "admin" || currentRole === "gerente";
    state.waiters = canUseTerminal ? ["Terminal", ...uniqueWaiters] : uniqueWaiters;
    renderWaiters(state);
  } catch (_error) {
    const currentRole = String(state.currentUser?.role || "").toLowerCase();
    const canUseTerminal = currentRole === "admin" || currentRole === "gerente";
    state.waiters = canUseTerminal ? ["Terminal"] : [];
    renderWaiters(state);
  }
}

async function loadCashSummary() {
  try {
    const response = await apiRequest("/cash/summary", { auth: true });
    renderCashSummary(response?.data || {});
  } catch (error) {
    if (error?.status === 403) {
      renderCashSummary({ orders_count: "-", total_sales: "-" });
    }
  }
}

export async function initDashboardData(state) {
  let currentUser = null;
  try {
    currentUser = await loadCurrentUser();
    state.currentUser = currentUser;
    setProfileIdentity(currentUser);
    applyRoleAccess(state, currentUser);
    if (state.permissions?.restrictToMesas) {
      setView(state, "mesas", false);
    }
  } catch (_error) {
    window.location.href = "./signin.html";
    return;
  }

  try {
    await loadProducts(state);
  } catch (_error) {
    // Keep UI responsive when products endpoint is unavailable.
    renderMenuData([]);
    state.productsCatalog = [];
    state.categories = ["General"];
    state.selectedCatalogCategory = "General";
    renderOrderCategories(state);
    renderCatalog(state);
  }

  const currentRole = String(currentUser?.role || "").toLowerCase();
  const canManageUsers = currentRole === "admin" || currentRole === "gerente";
  const canUseCashSummary = currentRole === "admin" || currentRole === "gerente" || currentRole === "cajero";

  if (canManageUsers) {
    await loadStaff(state);
  } else {
    state.staffMembers = [];
    state.waiters = [];
    renderWaiters(state);
  }

  window.addEventListener("products:changed", (event) => {
    const items = Array.isArray(event.detail?.products) ? event.detail.products : [];
    renderMenuData(items);
  });

  if (canUseCashSummary) {
    await loadCashSummary();
  } else {
    renderCashSummary({ orders_count: "-", total_sales: "-" });
  }
}
