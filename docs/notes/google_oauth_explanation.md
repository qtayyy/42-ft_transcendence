# Google Sign-in OAuth2.0 — Feature Explanation (Repo-Grounded)

## 0) Metadata
- Feature: Google Sign-in OAuth2.0
- Date: 2026-02-28
- Scope: Explain-only
- Keywords searched: google, oauth, callback, code, access_token
- Entry points (first guesses): `/login` (UI), `/api/auth/google/callback`

---

## 1) Feature Overview
### User flow
- User navigates to `/login` UI.
- User clicks "Login with Google".
- Browser is forcefully redirected to Google's consent screen (accounts.google.com).
- User allows sharing of basic profile details.
- Google redirects back to backend callback url with a special query string `?code=xxx`.
- Backend exchanges code for token, provisions user (if brand new), logs user in via JWT cookie, and redirects user to `/dashboard`.

### Success states
- Seamless login seamlessly linking existing email structure into local JWT.
- Account creation generating highly secure random hash bypassing standard registration pages entirely.

### Error / empty states
- Server/Network error: External provider downtime or missing Google environment keys gracefully handles error redirects back to login page.
- Validation error: Mismatched state code resolving to a 400 Bad Request if the OAuth flow is tampered with by an MITM intercept.

---

## 2) Repo Discovery Summary (Evidence Map)
> List real files discovered in the repo. Every bullet must be a real path and explain why it matters.

### a) Routes/Pages (UI entry points)
- `frontend/app/(auth)/login/page.tsx:L1-L150` — Contains the "Sign in with Google" HTML button that triggers the flow.

### b) UI Components (render + handlers)
- (Inline button) `frontend/app/(auth)/login/page.tsx:L120` — A standard `<a>` or `window.location.href` redirect pointing to static backend route.

### c) State/Data (useState/useReducer/Context/Redux/Zustand/TanStack Query/etc.)
- Session established via standard HttpOnly Cookie (`app_session`) matching general Fastify Auth logic.

### d) API Client Modules (fetch/axios wrappers)
- Handled via native browser HTTP 302 redirects. No internal `fetch` or `axios` executed for the login step itself as OAuth requires main-thread navigation.

### e) Backend Routes/Controllers (request entry)
- `backend/routes/api/auth/google.js:L1-L100` — The OAuth callback executor hook catching `/callback` and `/login` stubs.

### f) Services / Business Logic (domain rules)
- `backend/plugins/oauth.js:L1-L50` — Google Client configuration binding and provider setup registering the `@fastify/oauth2` core plugin.

### g) Data Models / Schemas / Queries (persistence)
- `backend/routes/api/auth/google.js:L40-L80` — Uses `prisma.profile.findUnique` to lookup existing emails, and `prisma.user.create` for new provisions integrating bcrypt hashes.

### h) Side Effects / Async (queues/emails/uploads/cron/external APIs)
- Backend makes synchronous REST call to Google servers `https://www.googleapis.com/oauth2/v2/userinfo` pausing thread execution to swap temporary code for long-term token.

### i) Security / Middleware (auth, perms, validation)
- Bypass: Skips local 2FA prompt for Google sessions (relying on Google's own 2FA systems to prevent fatigue). Assings 32-byte randomized un-crackable hash to new auto-provisoned profiles.

### j) Observability (logs/metrics/tracing)
- Fastify debug logs.

### k) Tests (unit/integration/e2e)
- N/A

---

## 3) File Index (Navigation Map)
> Quick jump list. Keep it short and only include files actually used by this feature.

- UI:
  - `frontend/app/(auth)/login/page.tsx` — Login Page / Button
- State/Data:
  - `HttpOnly Cookie` — Session Storage
- API Client:
  - (Native Browser redirect)
- Backend Routes/Controllers:
  - `backend/routes/api/auth/google.js` — The Callback API
- Services:
  - `backend/plugins/oauth.js` — The Client Registration
- Data Layer:
  - Prisma User Schema (Inline creations)

---

## 4) End-to-End Call Chain Trace (Primary Path)
Trace runtime path:
UI event → state update → API call → backend handler → service → DB → response → UI render

### Step 1: UI Entry
- Component/Handler: `<Button onClick={() => window.location.href = "/api/auth/google/login"}>`
- Trigger: click
- Inputs: N/A
- Outputs: Hard browser navigation leaving the React SPA.

### Step 2: Auth Provider Kickoff
- File: `backend/plugins/oauth.js`
- Function: `@fastify/oauth2` hook routing `/login` -> 302 to `accounts.google.com`.

### Step 3: Google Callback (Service Boundary)
- File: `backend/routes/api/auth/google.js`
- Function: Callback handler bound to `/api/auth/google/callback`
- Endpoint: `GET /callback?code=xxxx`
- Request shape: query parameter `code` plus security `state`.

### Step 4: Token Exchange (Backend to Google)
- File: `backend/routes/api/auth/google.js`
- Function: `fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)`
- Inputs: Evaluates `req` stream data.
- Outputs: Returns structural Bearer token mapping to an implicit `{ email, name, picture }` query.

### Step 5: Data Layer / DB (Provisioning & Merging)
- File: `backend/routes/api/auth/google.js`
- Query/Repo function: `prisma.profile.findFirst({ where: { email }})`
- Transactions: If user does not exist, uses bcrypt to hash `crypto.randomBytes(32)` mapping to a `prisma.user.create()` structure to stub a permanent internal structure.

### Step 6: Response → UI Render
- Response: `fastify.jwt.sign()` creates cookie header.
- UI update location: 302 redirect targets `https://localhost:8443/dashboard`.
- Render branch: Returns user into React SPA securely bootstrapped.

---

## 5) Walkthroughs (What happens when…)
> Write this like a narrated trace. For each walkthrough: show what the user does, what the UI shows, what request is sent, what backend does, what DB does, and what the UI shows at the end.
> Include file + function references ONLY at the key steps (not everywhere), so it stays readable.

### Walkthrough 1 — Normal Success (Happy Path)
**User story:** User clicks "Login with Google" and successfully logs into the dashboard.

1) **User action (UI trigger)**
- What user does: Clicks the Google sign in button on the login screen.
- Where in code: `frontend/app/(auth)/login/page.tsx:L120` — `<Button onClick={() => window.location.href = ...}>`

2) **Immediate UI behavior**
- What user sees instantly: The window redirects outwards to Google's consent screen.
- What state changes: Single Page App (SPA) unmounts entirely.

3) **Request sent**
- Endpoint: `GET /api/auth/google/login` -> (302 Redirect to accounts.google.com) -> Returns to `GET /api/auth/google/callback?code=xxx`
- Client function that sends it: Native Browser Navigation.

4) **Backend processing**
- Controller entry: `backend/routes/api/auth/google.js` — `@fastify/oauth2` hook executes.
- Business logic: Exchanges `code` for a long-lived Bearer token natively making a server-side fetch to `googleapis.com/oauth2/v2/userinfo`.
- Key rule(s) applied: Extracts verified `email` from Google payload to determine provisioning.

5) **Database/persistence**
- What is read/written: Reads `profile`, creates `user` if first time.
- Where: `backend/routes/api/auth/google.js:L50` — `prisma.profile.findFirst({ where: { email }})`

6) **Response + final UI**
- Response: `302 Redirect` to `/dashboard`. Fastify injects an `HttpOnly` `app_session` cookie into the headers.
- UI update: Single page app reboots upon landing at `/dashboard`.
- What user sees: The authenticated dashboard view.

---

### Walkthrough 2 — Invalid Input (User mistake)
**User story:** N/A (Standard Google OAuth uses Native Google UI input, not local forms).

---

### Walkthrough 3 — Not Logged In / Not Allowed
**User story:** Security tampering on the Callback URL State parameter.

1) **User action**
- Where: MITM intercepts browser return from Google and attempts to inject bad `?state=` parameter.

2) **Where it’s blocked**
- Backend middleware/guard: `@fastify/oauth2` internal library validates state cookie hash vs URL parameter.

3) **What happens**
- Response: `400 Bad Request` or generic `500`
- UI behavior: Request throws error instantly. User remains logged out and sees standard fastify unhandled error generic block or is explicitly redirected to `/login?error=true`.

---

### Walkthrough 4 — Server/Network Failure (Request can’t complete)
**User story:** Google APIs are offline or rate-limiting server-to-server requests.

1) **User action**
- Where: Callback return pipeline.

2) **Failure mode**
- `fetch` to `googleapis.com` throws a connection timeout.
- Where error is handled: `backend/routes/api/auth/google.js` — Core `try/catch` wrapper around `getAccessTokenFromAuthorizationCodeFlow`.

3) **What user sees**
- UI fallback: Browser halts on 500 error page because the request couldn't fulfill the final 302 hook back to the React UI. Acknowledges OAuth disruption.

---

### Walkthrough 5 — Empty Result (Nothing to show, but not an error)
**User story:** N/A

---

## 6) Function-by-Function Catalog
> Only functions/classes actually in the feature path.

For each key function/class:
- Name: `fastify.googleOAuth2` Init Phase
- File: `backend/plugins/oauth.js`
- Signature: `fp(async function(fastify, opts))`
- Responsibility: Validates ENV existence (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and hooks Fastify into provider callback structure via `register`.
- Inputs/Outputs: Fails fast if ENV configuration is entirely missing.
- Called by: App boots.
- Calls: Native `@fastify/oauth2` module.
- Pitfalls: Improper callback origin mismatch with Google Developer console causes infinite rejection loops (`URI_MISMATCH`).

- Name: `Callback Executor`
- File: `backend/routes/api/auth/google.js`
- Signature: `export default async function (fastify, opts)`
- Responsibility: Exchanging code code and minting sessions.
- Calls: `prisma.user.create`, `crypto.randomBytes`, `bcrypt.hash`.
- Important branches: `if (!existingProfile)` executes robust creation mapping otherwise bypasses directly to session signing avoiding duplication.

---

## 7) Call Graph Diagram

```text
Browser_Login_Button
  -> window.location.href = "/api/auth/google/login"
  -> [302 Redirect] -> accounts.google.com/auth
  -> User Consents -> [302 Redirect] -> /api/auth/google/callback?code=123
     -> backend/routes/api/auth/google.js
        -> @fastify/oauth2.getAccessToken() -> https://www.googleapis.com
        -> fetch userInfo() -> https://www.googleapis.com (email extracts)
        -> prisma.profile.findFirst(email)
        -> IF NULL -> prisma.user.create(random_hash)
        -> fastify.jwt.sign()
        -> res.setCookie("app_session")
  -> [302 Redirect] -> /dashboard
  -> SPA Boots and Reads Session
```
