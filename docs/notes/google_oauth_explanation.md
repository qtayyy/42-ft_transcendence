# Google Sign-in OAuth2.0 — Feature Explanation (Repo-Grounded)

## 0) Metadata
- Feature: Google Sign-in OAuth2.0
- Date: 2026-02-28
- Scope: Explain-only
- Keywords searched: google, oauth, callback, code, access_token

---

## 1) Feature Overview
### User flow
- Click "Login with Google" button.
- Redirected to Google's consent screen (accounts.google.com).
- User allows sharing of basic profile details.
- Google redirects back to backend callback url with `code`.
- Backend exchanges code for token, provisions user (if brand new), logs user in via JWT cookie, and redirects user to dashboard.

### Success states
- Seamless login linking existing email.
- Account creation generating highly secure random hash.

### Error / empty states
- External provider downtime or missing Google environment keys gracefully handles error redirects back to login page.

---

## 2) Repo Discovery Summary (Evidence Map)
> List real files discovered in the repo.

a) Routes/Pages
- `frontend/app/(auth)/login/page.tsx` — Trigger UI button

b) UI Components
- Generic button pointing to static backend route `/api/auth/google/login`.

c) State/Data (useState/Context/Redux/Zustand/TanStack Query/etc.)
- Session established via standard HttpOnly Cookie matching general auth flow.

d) API Client Modules
- Handled via `href` location redirect natively, no internal fetch executed on frontend.

e) Backend Routes/Controllers
- `backend/routes/api/auth/google.js` — The OAuth callback executor.

f) Services / Business Logic
- `backend/plugins/oauth.js` — Google Client configuration binding and provider setup (`@fastify/oauth2`).

g) Data Models / Schemas / Queries
- Uses `prisma.profile.findUnique` to lookup existing emails, and `prisma.user.create` for new provisions.

h) Side Effects / Async
- Backend makes synchronous REST call to Google servers `https://www.googleapis.com/oauth2/v2/userinfo`.

i) Security / Middleware
- Avoids local 2FA prompt for Google sessions (relying on Google's own 2FA systems to prevent fatigue). Assings 32-byte randomized un-crackable hash to new auto-provisoned profiles.

---

## 3) File Index (Navigation Map)
- UI: `/login/page.tsx`
- Backend Routes/Controllers: `routes/api/auth/google.js`
- Services: `plugins/oauth.js`
- Data Layer: Prisma User/Profile model inserts
- Side Effects/Async: Fetching User info from external Google API
- Security: `@fastify/oauth2` validation, bcrypt salting on random hash.

---

## 4) End-to-End Call Chain Trace
Trace runtime path:
UI event → state update → API call → backend handler → service → DB → response → UI render

### Step 1: UI Entry
- File: `frontend/app/(auth)/login/page.tsx`
- Function(s): Button click redirect
- Inputs/Outputs: Forces hard navigation to `window.location.href = "/api/auth/google/login"`.

### Step 2: Auth Provider Kickoff
- File: `@fastify/oauth2` implicit route
- Notes: Evaluates `plugins/oauth.js` configuration and redirects user to Google Consent page.

### Step 3: Google Callback
- File: `backend/routes/api/auth/google.js`
- Function(s): `export default async function (fastify, opts)` callback executor.
- Request shape: `req.query.code` provided by Google.

### Step 4: Token Exchange and User Fetch
- File: `backend/routes/api/auth/google.js`
- Function(s): `fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow`
- Inputs/Outputs: Swaps code for structural Bearer token, then queries `userinfo` API.

### Step 5: Database Provisioning
- File: `backend/routes/api/auth/google.js`
- Extracted DB Query: Merges profile if it exists, otherwise provisions completely new PostgreSQL user model using secure random generated password logic.

### Step 6: Session Binding
- File: `backend/routes/api/auth/google.js`
- Outputs: Executes `fastify.jwt.sign()` creating a trusted app token cookie, and responds with a 302 Header redirect to `https://localhost:8443/dashboard`.

---

## 5) Function-by-Function Catalog
For each key function/class:

- Name: `fp(async function(fastify, opts))` OAuth init
- File: `backend/plugins/oauth.js`
- Responsibilities: Validates ENV existence (`GOOGLE_CLIENT_ID`) and hooks Fastify into provider callback structure.

---

## 6) Call Graph Diagram

```mermaid
graph TD
    Client[Browser] -->|href=/api/auth/google/login| Fastify[Fastify Router]
    Fastify -->|Redirect to /o/oauth2/v2/auth| Browser1[Google Consent Screen]
    Browser1 -->|Consent Given| Callback[GET /api/auth/google/callback?code=...]
    
    Callback -->|Server-to-Server POST| Google[Google Token API]
    Google -->|Return Access Token| Callback
    
    Callback -->|Fetch Profile (GET)| UserInfo[Google UserInfo API]
    UserInfo -->|Return {email, picture, name}| Callback
    
    Callback -->|Check Database| DB[(PostgreSQL)]
    DB -->|Exists? Yes| Session[Generate JWT]
    DB -->|Exists? No| Provision[Create Hash + User] --> Session
    
    Session -->|Set Cookie + Redirect /dashboard| ClientDashboard[Dashboard Page]
```

---

## 7) Architecture Notes (Fill fully ONLY if code changed)
N/A (no code changes)

---

## 8) Change Ledger (ONLY if code changed)
Explain-only: N/A (no code changes)
