# SECURITY_STANDARD.md

Estandar unico de seguridad del proyecto SaaS.
Este documento consolida y reemplaza el uso operativo de:
- `SEGURIDAD_CHECK.md`
- `docs/XSS_CHECKLIST.md`

Aplicacion: frontend, backend, base de datos, infraestructura y proceso de desarrollo.

---

## 1) Principio de confianza cero

- Todo dato externo es no confiable (form, dataset, URL, storage, API, DB, webhooks).
- Nunca confiar en controles solo de UI.
- Validar siempre en backend aunque haya validacion en frontend.

---

## 2) Validacion y normalizacion de datos

- Normalizar strings con `trim()`.
- Aplicar limites de longitud por campo.
- Validar formato (regex segura) cuando aplique.
- Convertir numeros con `Number()` o `parseInt()`.
- Verificar `Number.isFinite(...)` y `Number.isInteger(...)` segun caso.
- Rechazar `NaN`, `Infinity` y rangos invalidos.

Valores recomendados:
- nombre producto: max 60
- nombre mozo/usuario: max 60
- categoria: max 30

---

## 3) XSS y render seguro (obligatorio)

- Prohibido interpolar input de usuario en `innerHTML`, `outerHTML`, `insertAdjacentHTML`.
- Preferir `createElement` + `textContent` + `replaceChildren`.
- Si se usa template HTML por necesidad: escapar con `escapeHtml(...)`.
- No usar handlers inline (`onclick=`, `onerror=`, etc.).
- No usar `eval()` ni `new Function()`.

Utilidades del proyecto:
- `docs/js/utils/dom.js`
  - `escapeHtml(value)`
  - `normalizeHexColor(value, fallback)`
  - `escapeCssAttrValue(value)`

---

## 4) DOM, IDs, dataset y selectores

- Nunca usar input de usuario directo como `id`.
- IDs se generan internamente.
- Todo valor leido desde `dataset` se valida antes de usar.
- Para selectores CSS con valores dinamicos, escapar (`escapeCssAttrValue` / `CSS.escape`).
- Para listas dinamicas (`button`, `option`, etc.), crear nodos por codigo.

---

## 5) Estilos, URLs y recursos dinamicos

- Validar formatos permitidos antes de usar estilos dinamicos (`normalizeHexColor`).
- No permitir `javascript:` ni protocolos no permitidos en URLs dinamicas.
- No inyectar strings de usuario en `style="..."` sin validacion estricta.

---

## 6) Eventos y flujo UI

- Registrar eventos solo con `addEventListener`.
- Evitar listeners duplicados y fugas de memoria.
- Usar delegacion cuando convenga, con validacion del target.

---

## 7) Multi-tenant estricto (SaaS)

Regla critica:
- Ninguna consulta puede devolver o modificar datos de otro tenant.

Obligatorio:
- Todas las entidades tienen `bar_id` (o tenant_id equivalente).
- `bar_id` se obtiene del contexto autenticado en servidor, no del cliente.
- Toda query lleva filtro tenant.
- Validar que referencias cruzadas pertenezcan al mismo tenant.

---

## 8) Autenticacion y sesiones (SaaS)

- Password hashing fuerte (`argon2id` recomendado, `bcrypt` aceptable).
- Politica minima de password y bloqueo por intentos fallidos.
- Tokens con expiracion y rotacion.
- Si hay cookies: `HttpOnly`, `Secure`, `SameSite`.
- Invalidar sesiones al cambiar password o desactivar usuario.
- MFA recomendado para cuentas admin.

---

## 9) Autorizacion y permisos (RBAC/ABAC)

- Verificar permisos en backend para cada accion sensible.
- No basarse en botones ocultos o flags del cliente.
- Principio de menor privilegio.

Acciones sensibles ejemplo:
- gestionar empleados
- modificar precios
- cerrar caja
- eliminar pedidos/datos

---

## 10) API y backend seguros

- Validacion server-side obligatoria de payloads.
- SQL siempre parametrizado (`$1`, `$2`, ...).
- Nunca concatenar queries.
- Limitar tamano de request body.
- Timeouts y retries controlados para servicios externos.
- Sanitizar y validar datos antes de persistir.

---

## 11) Rate limiting, anti-abuso y protecciones web

- Rate limiting por IP y por usuario.
- Proteccion de brute force en login.
- CAPTCHA o desafio gradual donde aplique.
- CORS restrictivo (solo origins permitidos).
- CSRF protection en endpoints de sesion/cookie.

---

## 12) Headers y politica del navegador

Configurar:
- `Content-Security-Policy` (sin `unsafe-inline` donde sea posible)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security` (en produccion con HTTPS)
- `X-Frame-Options` o `frame-ancestors` en CSP

---

## 13) Secrets y configuracion

- No commitear secretos (tokens, keys, passwords).
- Usar variables de entorno / secret manager.
- Rotacion periodica de secretos.
- Diferenciar entornos (dev/staging/prod) con credenciales separadas.

---

## 14) Dependencias y cadena de suministro

- Fijar versiones y actualizar dependencias regularmente.
- Ejecutar escaneo de vulnerabilidades en CI (`npm audit`, Snyk, etc.).
- Revisar licencias y packages abandonados.

---

## 15) Logs, auditoria y monitoreo

- Loguear eventos de seguridad (login, fallos, cambios de permisos, acciones criticas).
- No loguear datos sensibles (password, tokens completos, PII innecesaria).
- Correlacion de request IDs para trazabilidad.
- Alertas automáticas por patrones anormales.

---

## 16) Backups, continuidad e incident response (SaaS)

- Backups cifrados, verificados y con pruebas de restauracion.
- Definir RPO/RTO objetivo.
- Runbook de incidentes (deteccion, contencion, recuperacion, postmortem).
- Retencion de logs y evidencia para auditoria.

---

## 17) Webhooks y terceros (pagos, notificaciones, etc.)

- Verificar firma de webhook.
- Rechazar payload sin timestamp/nonce valido.
- Idempotencia para evitar dobles procesos.
- Timeouts, retries y circuit breaking en integraciones.

---

## 18) Reglas para modales y UI dinamica (obligatorio)

- Estructura base de modal puede ser estatica.
- Todo contenido variable se inyecta con nodos (`textContent`) o escape estricto.
- En select/listas dinamicas, usar `replaceChildren()` y crear cada nodo.

---

## 19) Checklist rapido pre-merge

Busqueda de patrones:
- `innerHTML =`
- `outerHTML =`
- `insertAdjacentHTML`
- `eval(`
- `new Function(`

Comando sugerido:
```bash
rg -n "innerHTML\\s*=|outerHTML\\s*=|insertAdjacentHTML|eval\\(|new Function\\(" docs/js -S
```

Payloads de prueba:
- `<img src=x onerror=alert(1)>`
- `"><svg/onload=alert(1)>`
- `` `onmouseover=alert(1)` ``

Confirmar:
- se renderiza como texto
- no ejecuta JS
- no rompe layout/flujo

---

## 20) Criterio de aceptacion de seguridad

Un cambio no se mergea si:
- rompe aislamiento tenant
- introduce render dinamico inseguro
- evita validaciones server-side
- usa SQL no parametrizado
- agrega secretos al repo

Excepciones:
- solo con justificacion documentada y aprobacion explicita.

---

## 21) Estado de referencia del proyecto

Este documento es la fuente unica de reglas de seguridad.
Si hay conflicto con otros checklists, prevalece `SECURITY_STANDARD.md`.
