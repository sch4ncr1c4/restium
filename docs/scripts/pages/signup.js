const API_BASE_URL = "http://localhost:3000/api";
const DASHBOARD_PATH = "./dashboard.html";

const signupForm = document.getElementById("signupForm");
const signupMessage = document.getElementById("signupMessage");

function showMessage(message, isError = false) {
  signupMessage.textContent = message;
  signupMessage.className = `text-sm ${isError ? "text-rose-600" : "text-emerald-700"}`;
}

function saveSession(payload) {
  localStorage.setItem("accessToken", payload.accessToken);
  localStorage.setItem("refreshToken", payload.refreshToken);
  localStorage.setItem("authUser", JSON.stringify(payload.user));
}

function redirectToDashboard() {
  window.location.href = DASHBOARD_PATH;
}

async function handleSignup(event) {
  event.preventDefault();
  showMessage("Creando cuenta...");

  const formData = new FormData(signupForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  const businessUsername = String(formData.get("business_username") || "").trim();
  const ownerName = String(formData.get("owner_name") || "").trim();
  const termsAccepted = Boolean(formData.get("terms"));

  if (!email || !password || !ownerName || !businessUsername) {
    showMessage("Completa todos los campos obligatorios.", true);
    return;
  }

  if (password !== confirmPassword) {
    showMessage("Las contrasenas no coinciden.", true);
    return;
  }

  if (!termsAccepted) {
    showMessage("Debes aceptar los terminos y condiciones.", true);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        name: ownerName,
        businessName: businessUsername,
        businessUsername,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      showMessage(payload.message || "No se pudo crear la cuenta.", true);
      return;
    }

    saveSession(payload);
    showMessage("Cuenta creada. Redirigiendo...");
    setTimeout(redirectToDashboard, 500);
  } catch (_error) {
    showMessage("No se pudo conectar con el servidor.", true);
  }
}

signupForm?.addEventListener("submit", handleSignup);
