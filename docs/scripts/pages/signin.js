const API_BASE_CANDIDATES = [
  "http://localhost:3000/api",
  "http://127.0.0.1:3000/api",
];
const DASHBOARD_PATH = "./dashboard.html";

const signinForm = document.getElementById("signinForm");
const signinMessage = document.getElementById("signinMessage");
const signinModeInput = document.getElementById("signinMode");
const signinModePin = document.getElementById("signinModePin");
const signinModeEmail = document.getElementById("signinModeEmail");
const signinPinFields = document.getElementById("signinPinFields");
const signinEmailFields = document.getElementById("signinEmailFields");
const pinCodeInput = document.getElementById("pinCode");

function showMessage(message, isError = false) {
  signinMessage.textContent = message;
  signinMessage.className = `text-sm ${isError ? "text-rose-600" : "text-emerald-700"}`;
}

function saveSession(payload) {
  localStorage.setItem("accessToken", payload.accessToken);
  localStorage.setItem("refreshToken", payload.refreshToken);
  localStorage.setItem("authUser", JSON.stringify(payload.user));
}

function redirectToDashboard() {
  window.location.href = DASHBOARD_PATH;
}

function setSigninMode(mode) {
  const useEmailMode = mode === "email";
  signinModeInput.value = useEmailMode ? "email" : "pin";

  signinModePin.className = useEmailMode
    ? "rounded-md bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
    : "rounded-md bg-emeraldbrand px-3 py-2 text-xs font-semibold text-white";
  signinModeEmail.className = useEmailMode
    ? "rounded-md bg-emeraldbrand px-3 py-2 text-xs font-semibold text-white"
    : "rounded-md bg-white px-3 py-2 text-xs font-semibold text-zinc-700";

  signinPinFields.classList.toggle("hidden", useEmailMode);
  signinEmailFields.classList.toggle("hidden", !useEmailMode);
}

async function handleSignin(event) {
  event.preventDefault();
  showMessage("Ingresando...");

  const formData = new FormData(signinForm);
  const mode = String(formData.get("signinMode") || "pin").toLowerCase();
  const payload = {};

  if (mode === "email") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    if (!email || !password) {
      showMessage("Completa email y contrasena.", true);
      return;
    }
    payload.email = email;
    payload.password = password;
  } else {
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const pinCode = String(formData.get("pinCode") || "").replace(/\D/g, "").slice(0, 4);
    if (!username || !/^\d{4}$/.test(pinCode)) {
      showMessage("Completa usuario y PIN de 4 digitos.", true);
      return;
    }
    payload.username = username;
    payload.pinCode = pinCode;
  }

  try {
    let response = null;
    let responsePayload = null;
    let lastNetworkError = null;

    for (const baseUrl of API_BASE_CANDIDATES) {
      try {
        const attempt = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        response = attempt;
        responsePayload = await attempt.json().catch(() => ({}));
        if (attempt.ok) {
          localStorage.setItem("apiBaseUrl", baseUrl);
        }
        break;
      } catch (error) {
        lastNetworkError = error;
      }
    }

    if (!response) {
      throw lastNetworkError || new Error("network error");
    }

    if (!response.ok) {
      showMessage(responsePayload?.message || "No se pudo iniciar sesion.", true);
      return;
    }

    saveSession(responsePayload);
    showMessage("Sesion iniciada. Redirigiendo...");
    setTimeout(redirectToDashboard, 400);
  } catch (_error) {
    showMessage("No se pudo conectar con el servidor.", true);
  }
}

pinCodeInput?.addEventListener("input", () => {
  pinCodeInput.value = pinCodeInput.value.replace(/\D/g, "").slice(0, 4);
});

signinModePin?.addEventListener("click", () => setSigninMode("pin"));
signinModeEmail?.addEventListener("click", () => setSigninMode("email"));
setSigninMode("pin");

signinForm?.addEventListener("submit", handleSignin);
