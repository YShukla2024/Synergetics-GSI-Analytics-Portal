# GSI Analytics Portal

Executive analytics frontend for Synergetics Information Technology's Microsoft GSI/ESI/GPS
delivery programs. This app is a **frontend shell only** — it does not compute or store
analytics. Real analytics live in Microsoft Fabric / Power BI; this portal logs in, navigates,
shows KPI summaries, and embeds published Fabric reports.

## Tech stack
React 19 · Next.js 15 (App Router) · TypeScript · Tailwind CSS · Fluent-inspired design tokens ·
lucide-react icons · Framer Motion

## Getting started
```bash
npm install
npm run dev
```
Then open http://localhost:3000 — you are redirected to `/login`, where **Sign in with
Microsoft Entra ID** authenticates you via your Microsoft work account before you
reach `/dashboard`.

## Project structure
```
app/                    Route pages (App Router)
  login/                Entra ID sign-in (Auth.js / NextAuth v5)
  dashboard/             KPI row + Power BI embed + activity row + AI panel
  analytics/              Filter bar + full-width Power BI embed
  delivery/               Delivery Tracker table
  enquiries/              Enquiries list
  enquiries/[id]/         Drill-through detail page (timeline + delivery history)
  reports/, insights/, settings/, help/
components/
  layout/                Header, Sidebar, Footer, AppShell
  ui/                    KpiCard, PowerBIContainer, NotificationPanel, ProfileMenu,
                          Breadcrumb, SearchBar, FilterBar, ActivityFeed, AIAssistantPanel,
                          StatusBadge
data/dummyData.ts        Fixture data — replace with real API calls
lib/types.ts              Shared domain types
```

## Wiring in real data

### 1. Power BI / Microsoft Fabric secure embed (already wired up)
`components/ui/PowerBIContainer.tsx` embeds a real report using the official
`powerbi-client-react` SDK — no iframe, so filters/drill-through/bookmarks work.
It gets its embed token from `app/api/powerbi-embed-token/route.ts`, a server-side
route that authenticates as an Azure AD **service principal** and calls Power BI's
`GenerateToken` API (the standard "App Owns Data" pattern for embedding secured
reports without asking each viewer to sign into Power BI separately).

One-time setup:
1. **Azure Portal → App registrations → New registration.** Note the Application
   (client) ID and Directory (tenant) ID.
2. **Certificates & secrets → New client secret.** Copy the value immediately —
   it's shown once.
3. **Power BI Admin Portal → Tenant settings →** enable *"Allow service principals
   to use Power BI APIs"* for a security group that contains this app registration.
4. **In the target Power BI/Fabric workspace → Access →** add the app registration
   (service principal) as a **Member** or **Admin**.
5. Copy `.env.example` to `.env.local` and fill in:
   ```
   POWERBI_TENANT_ID=
   POWERBI_CLIENT_ID=
   POWERBI_CLIENT_SECRET=
   POWERBI_WORKSPACE_ID=   # the workspace GUID holding your report
   POWERBI_REPORT_ID=      # the report GUID to embed
   ```
   Get the workspace/report GUIDs from the report's URL in Power BI Service:
   `app.powerbi.com/groups/<workspaceId>/reports/<reportId>`.

Until those env vars are set, `PowerBIContainer` falls back to a static placeholder
so the rest of the UI still renders. To embed a different report on a specific page,
pass `<PowerBIContainer workspaceId="..." reportId="..." />` explicitly.

### 2. Microsoft Entra ID login (wired up)
Authentication uses **Auth.js (NextAuth v5)** with the `microsoft-entra-id`
provider — OAuth 2.0 authorization-code + PKCE against Microsoft Entra ID.

Flow: click *Sign in with Microsoft Entra ID* → Microsoft login → back to
`/dashboard` with a signed, httpOnly session cookie. The profile menu, header,
and settings show the **real** user (name, email, initials, photo) from the
session — nothing is hardcoded. Sign out is in the profile menu.

One-time setup:
1. **Azure Portal → App registrations → New registration.**
   - Name: e.g. `GSI Analytics Portal`.
   - *Supported account types*: **Accounts in this organizational directory only**
     (single tenant).
   - Leave the redirect URI blank for now.
2. **Authentication → Platform → Web → Redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id` (dev)
   - `https://<your-domain>/api/auth/callback/microsoft-entra-id` (prod)
   - Under *Implicit grant and hybrid flows*: nothing needs to be enabled
     (Auth.js uses the authorization-code + PKCE flow).
3. **Certificates & secrets → New client secret.** Copy the value now — it's
   shown only once.
4. Note the **Application (client) ID** and **Directory (tenant) ID** from Overview.
5. Copy `.env.example` to `.env.local` and fill in:
   ```
   AZURE_CLIENT_ID=
   AZURE_CLIENT_SECRET=
   AZURE_TENANT_ID=
   NEXTAUTH_SECRET=     # generate with: npx auth secret
   NEXTAUTH_URL=http://localhost:3000
   ```

#### RBAC (roles)
The portal resolves roles into `Admin | Manager | Trainer | Sales | Viewer`
(see `lib/authz.ts`). Two claim sources are supported:
- **App roles**: define them under *App registrations → App roles*, assign to
  users/groups, and they arrive in the `roles` claim automatically.
- **Security groups**: enable group claims (app manifest →
  `groupMembershipClaims: "SecurityGroup"`) and map group object IDs to roles:
  `AZURE_GROUP_ROLE_MAP="<groupId>:Admin,<groupId>:Manager"`.

Until either is configured, every user is assigned `Viewer` (least privilege).
Use `hasRole(session.user.roles, "Admin")` / `requireRole(...)` to gate pages
and API routes.

#### Security notes
- The Power BI embed uses a **separate service principal** — user sessions and
  the embed backend never share credentials (two isolated Azure AD apps).
- The session JWT stores only identity (id, name, email, photo, roles); the
  provider captures the 48×48 profile photo at sign-in. Sessions are encrypted
  with `NEXTAUTH_SECRET` and the cookie is `httpOnly` by default.
- Middleware (`middleware.ts`) protects every page except `/login` and returns
  `401` JSON for unauthenticated `/api/*` calls.

### 3. Real delivery/enquiry data
Replace `data/dummyData.ts` with fetch calls (Server Components or route handlers)
against the Fabric/warehouse API; the shapes in `lib/types.ts` are already modeled
on the Delivery Activities Tracker fields.

## Notes
- Desktop-first, tested down to a 1024px content width; sidebar collapses below `lg`.
- Keyboard focus is visible everywhere and `prefers-reduced-motion` is respected.
- `npm run build` has been verified to compile cleanly (all 17 routes prerender).
