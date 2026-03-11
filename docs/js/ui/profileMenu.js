const API_BASE_URL = "http://localhost:3000/api";
const SIGNIN_PATH = "./signin.html";
const THEME_STORAGE_KEY = "dashboardTheme";

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authUser");
}

function redirectToSignin() {
  window.location.href = SIGNIN_PATH;
}

function readStoredUser() {
  const raw = localStorage.getItem("authUser");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function readThemePreference() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return null;
}

function resolveInitialTheme() {
  const preferred = readThemePreference();
  if (preferred) return preferred;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  return isDark;
}

function updateThemeToggleUI(isDark) {
  const label = document.getElementById("themeToggleLabel");
  const sun = document.getElementById("themeIconSun");
  const moon = document.getElementById("themeIconMoon");

  if (label) label.textContent = isDark ? "Modo claro" : "Modo oscuro";
  if (sun) sun.classList.toggle("hidden", isDark);
  if (moon) moon.classList.toggle("hidden", !isDark);
}

function setProfileIdentity(state) {
  const user = readStoredUser();
  const userLabel = document.getElementById("profileUserLabel");

  if (!user) return;

  if (userLabel) {
    const role = user.role ? ` (${user.role})` : "";
    userLabel.textContent = `${user.email || "Usuario"}${role}`;
  }

  const seed = (user.name || user.email || "U").trim();
  state.profileButton.textContent = seed.charAt(0).toUpperCase() || "U";
}

async function requestBackendLogout() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return;

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (_error) {
    // Session still closes locally if backend is unavailable.
  }
}

export function initProfileMenu(state) {
  if (!state.profileButton || !state.profileMenu) return;

  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) {
    redirectToSignin();
    return;
  }

  const logoutLink = document.getElementById("logoutLink");
  const themeToggleButton = document.getElementById("themeToggleButton");
  setProfileIdentity(state);
  const isDark = applyTheme(resolveInitialTheme()) === true;
  updateThemeToggleUI(isDark);

  state.profileButton.addEventListener("click", () => {
    const isHidden = state.profileMenu.classList.contains("hidden");
    state.profileMenu.classList.toggle("hidden", !isHidden);
    state.profileButton.setAttribute("aria-expanded", String(isHidden));
  });

  document.addEventListener("click", (event) => {
    if (!state.profileMenu.contains(event.target) && !state.profileButton.contains(event.target)) {
      state.profileMenu.classList.add("hidden");
      state.profileButton.setAttribute("aria-expanded", "false");
    }
  });

  themeToggleButton?.addEventListener("click", () => {
    const nowDark = document.documentElement.classList.contains("dark");
    const isDarkMode = applyTheme(nowDark ? "light" : "dark");
    updateThemeToggleUI(isDarkMode);
  });

  logoutLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    await requestBackendLogout();
    clearSession();
    redirectToSignin();
  });
}
