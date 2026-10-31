# OURSPACE V2.2 — Repository Quality & Architecture Audit

**Target System**: OURSPACE (Private Couple Communication & Connection Platform)  
**Evaluator**: Principal Full-Stack Engineer & Security Auditor  
**Audit Date**: October 31, 2026  
**Repository**: [karthibaraniofficial-wq/OURSPACE](https://github.com/karthibaraniofficial-wq/OURSPACE)  
**Target Vercel Project**: `ourspace-app` (Project ID: `prj_eX5F2vuq41j0kLD8lcVcD2bWhmF6`)  
**Target Firebase Project**: `ourspace-edbf5` (Project ID: `ourspace-edbf5`)

---

## 1. Executive Summary

This audit provides a comprehensive, verified assessment of the OURSPACE repository following repeated Vercel production deployment failures (commits `32ee4e8`, `e17921c`, `72b8ad6`, and `7498102`). The previous mitigation attempt added `eslint: { ignoreDuringBuilds: true }` in `apps/web/next.config.js` under the mistaken hypothesis of a linter failure. Real-time extraction of Vercel production logs revealed the true blocker: **a missing server dependency (`livekit-server-sdk`) in `apps/web/package.json`**.

In addition, deeper multi-platform analysis revealed:
1. An invalid JavaScript syntax error in Firebase Cloud Functions (`functions/index.js:56`).
2. An unconfigured and missing ESLint setup in `apps/web/package.json` leading to false lint bypasses.
3. Lack of a committed root `package-lock.json` causing non-deterministic resolution between environments.
4. Redundant single-field indexes in Firestore indexes that were rejected by Firebase API (HTTP 400).
5. Disconnected placeholder data in certain UI views and unverified binary sizes in `apppackage/`.

---

## 2. Detailed Findings by Category

### 2.1 Build Problems & Root Cause Analysis of Vercel Deployment Failure

| Issue ID | Severity | Location | Description | Status |
|:---|:---:|:---|:---|:---:|
| **BLD-01** | **CRITICAL** | `apps/web/package.json` vs `apps/web/src/app/api/livekit/token/route.ts` | `./src/app/api/livekit/token/route.ts` executes `await import('livekit-server-sdk')`. However, `livekit-server-sdk` was omitted from `apps/web/package.json` dependencies (only existed in `functions/package.json`). Webpack failed during `next build` on Vercel with: `Module not found: Can't resolve 'livekit-server-sdk'`. | **Identified / Remedying** |
| **BLD-02** | **HIGH** | `apps/web/next.config.js` | `eslint: { ignoreDuringBuilds: true }` was implemented as a blind bypass rather than resolving underlying configuration. | **Identified / Remedying** |
| **BLD-03** | **MEDIUM** | Root `package.json` / Workspace Hoisting | Next.js 14 requires `serverComponentsExternalPackages: ['livekit-server-sdk']` in `next.config.js` to prevent bundler pollution and native Node.js binary resolution issues in Vercel serverless functions. | **Identified / Remedying** |
| **BLD-04** | **HIGH** | `functions/index.js` (line 56) | File had TypeScript annotations (`uid: string, token: string, deviceDocId?: string`) inside a pure `.js` module, causing instant `SyntaxError: Unexpected token ':'` in Node.js runtime. | **Resolved** |

### 2.2 Dependency & Lockfile Audit

| Issue ID | Severity | Component | Finding | Action |
|:---|:---:|:---|:---|:---|
| **DEP-01** | **HIGH** | Root Lockfile | Root `package-lock.json` was absent or untracked, causing `npm install` on CI/CD (Vercel & GitHub Actions) to perform dynamic dependency resolution instead of clean reproducible `npm ci`. | Generate & commit authoritative `package-lock.json`. |
| **DEP-02** | **MEDIUM** | `apps/web` DevDependencies | Missing `eslint` and `eslint-config-next` declarations in `apps/web/package.json`, causing `next lint` to invoke interactive CLI prompts or error in headless environments. | Add `eslint@^8.57.1` and `eslint-config-next@14.2.15`. |
| **DEP-03** | **HIGH** | Cross-Platform React Sync | `apps/mobile` runs on Expo SDK 51, which strictly requires `react@18.2.0` and `react-native@0.74.5`. Web workspace must stay pinned to `react@18.2.0` and `react-dom@18.2.0` to preserve monorepo harmony. | Maintain coordinated `react@18.2.0` across web and mobile. |

### 2.3 Architecture & Monorepo Structure

| Area | Evaluation | Finding / Recommended Solution |
|:---|:---|:---|
| **Workspace Boundaries** | Good | Monorepo cleanly separates `apps/web`, `apps/mobile`, and `packages/*` (`types`, `validation`, `shared`). Workspace configuration correctly excludes mobile to avoid React Native/DOM hoisting friction. |
| **Type Sharing** | Excellent | `@ourspace/types` and `@ourspace/validation` are referenced via tsconfig paths and transpilePackages. |
| **Central State** | Clean | Zustand stores (`useAuthStore`, `useChatStore`, `useSpaceStore`, `useCallStore`) manage client state predictably. |
| **API Endpoints** | Secure | Route handlers enforce authorization headers and validate request payloads via Zod schemas. |

### 2.4 Security & Privacy Audit

| Area | Evaluation | Details |
|:---|:---|:---|
| **Firestore Security Rules** | **PASS** | Strict two-person isolation enforced (`exists(/databases/$(database)/documents/privateSpaces/$(spaceId)/members/$(request.auth.uid))`). 2-member maximum strictly checked. |
| **Storage Security Rules** | **PASS** | MIME-type whitelisting (images, audio, video, pdf, docx, zip) + 50MB per-file boundary + Space member authorization check. |
| **Secret Management** | **PASS** | No hardcoded API keys or Firebase service accounts committed. All secrets sourced via `process.env`. |
| **Client Bundle Security** | **PASS** | Zero privileged tokens (`LIVEKIT_API_SECRET`, service accounts) leaked in `NEXT_PUBLIC_` variables. |

### 2.5 UI/UX & Responsive Inconsistencies

1. **Dashboard Milestone / Event Fallbacks**:
   - In the absence of user-created events, default values should gracefully communicate empty states rather than arbitrary placeholder dates.
2. **Online Status Real-Time Indicator**:
   - Status dots must strictly reflect Firestore active presence heartbeat (`users/{uid}/status`) rather than static simulation.
3. **Glassmorphism Contrast**:
   - In dark mode with deep plum backgrounds, certain muted rose text requires higher contrast ratio (WCAG AA 4.5:1) for readability.
4. **Mobile Navigation Overlay**:
   - Bottom navigation bar on iOS Safari requires proper `env(safe-area-inset-bottom)` padding to prevent home-indicator collision.

---

## 3. Prioritized Remediation Roadmap

1. **Phase 2 (Immediate Priority)**:
   - Add `"livekit-server-sdk": "^2.6.0"` to `apps/web/package.json`.
   - Add `"eslint": "^8.57.1"` and `"eslint-config-next": "14.2.15"` to `apps/web/package.json`.
   - Add `apps/web/.eslintrc.json` with `"extends": "next/core-web-vitals"`.
   - Update `apps/web/next.config.js` to enable `serverComponentsExternalPackages: ['livekit-server-sdk']` and remove `ignoreDuringBuilds: true`.
   - Generate clean `package-lock.json`.
2. **Phase 3 (Dependency Modernization)**:
   - Audit and bump patch/minor dependencies safely.
3. **Phase 5 (GitHub Presentation & Branding)**:
   - Redesign `README.md` with "Two Hearts. One Private Digital World."
   - Replace any raw local Windows paths with standard repository URLs.
4. **Phase 6 (UI/UX Polish)**:
   - Elevate romantic soft glassmorphism tokens and dark mode contrast.
   - Refine mobile safe-area insets and empty states.
5. **Phase 10 (Production Release & Vercel Verification)**:
   - Push commit to GitHub `main` and verify Vercel builds cleanly to `Ready`.
