# Shopademia Admin for Android

Native Kotlin/XML administrator client for the existing Shopademia Express API. It does not contain business rules or database connectivity; PostgreSQL remains server-only.

## Implemented

- Bearer login, optional platform-admin TOTP challenge, first-time TOTP enrollment, server-revoked logout, and profile-based session restoration.
- Dashboard metrics from `GET /admin/dashboard`.
- Read-only product list/detail and order list/detail with bounded product `limit`/`offset` and order `page`/`limit`.
- Shop-member role display. Platform administrators are told that these shop-scoped screens are unavailable; server permission failures remain authoritative.
- Distinct loading, empty, validation, unauthorized, forbidden, not-found, conflict, rate-limited, network, and server-error states.
- AES-256-GCM encrypted bearer-token persistence using a non-exportable Android Keystore key. App backup is disabled, cookies are not persisted, and sensitive screens are protected from screenshots.

Product/catalog writes, category management, order-state changes, payment verification, push notifications, and product image uploads are intentionally not in this client. Although some write routes exist on the backend, this first app iteration does not implement them.

## Build and test

Open this directory (`phone app`) in Android Studio with its Gradle JDK set to JDK 17+ and Android SDK API 37/build tools 36 installed, or use the included Gradle wrapper:

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:connectedDebugAndroidTest
```

The JVM tests use MockWebServer/fake repositories; they do not access the backend. Instrumentation tests require an authorized Android emulator/device. The Keystore encryption test is an instrumented device test, not a mocked JVM test.

## Local API networking

Debug builds default to `http://127.0.0.1:3002/api/v1/` from the existing API contract. To reach a loopback-only host listener from an attached device, forward the matching port:

```powershell
adb reverse tcp:3002 tcp:3002
```

**The existing port-3002 preview is read-only:** it rejects login/session-creating POST requests. Do not use it for authenticated app testing or attempt to work around its gate. Authenticated tests require a separately authorized disposable writable backend. When such an isolated backend is running on host loopback port 3003, configure the debug build and forward that exact port:

```powershell
.\gradlew.bat :app:assembleDebug -PshopademiaApiBaseUrl=http://127.0.0.1:3003/api/v1/
adb reverse tcp:3003 tcp:3003
```

A standard emulator's `10.0.2.2` is not a substitute for this ADB reverse route when the server binds only to `127.0.0.1`. Do not widen server binding. The disposable authenticated test instance from the previous verification was shut down and removed; authenticated Android connectivity has **not** been live-tested.

Remote release builds default to `https://api.shopademia.store/api/v1/`. The URL, HTTPS termination, DNS, and proxy route are not verified; production remains NO-GO. An override must remain HTTPS:

```powershell
.\gradlew.bat :app:assembleRelease -PshopademiaReleaseApiBaseUrl=https://api.shopademia.store/api/v1/
```

The release build rejects non-HTTPS API URLs. Cleartext is allowed only in the Android debug manifest; release uses the manifest's cleartext-disabled default. Do not add API/database passwords, JWT signing keys, MFA secrets, or bearer tokens to build configuration or source. User passwords and TOTP codes are sent only to the documented login/enrollment endpoints over the configured API connection and are not persisted by the app.

## API surface

The client uses only these documented routes:

- `POST /admin/login`
- `POST /admin/mfa/enroll`
- `GET /admin/profile`
- `POST /admin/logout`
- `GET /admin/dashboard`
- `GET /admin/products?limit=…&offset=…`
- `GET /admin/products/:id`
- `GET /admin/orders?page=…&limit=…`
- `GET /admin/orders/:id`

Native login omits `Origin` so the API returns its bearer token. The client ignores the browser cookie and sends `Authorization: Bearer …` only on protected requests. HTTP errors use the API's `{error:string}` shape and safe `X-Request-Id` diagnostic; the app never logs tokens, passwords, MFA codes, order data, or response bodies.
