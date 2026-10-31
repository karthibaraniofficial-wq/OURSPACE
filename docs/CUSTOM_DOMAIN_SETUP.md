# OURSPACE — Custom Domain & HTTPS Setup Guide

This guide details the DNS records, SSL/TLS certificate issuance, and cloud provider configurations required to host OURSPACE under a custom domain (e.g. `ourspace.app`).

---

## 1. DNS Record Configuration

Configure the following records in your domain registrar's DNS management panel (Cloudflare, Namecheap, GoDaddy, Google Domains, etc.):

### 1.1 Vercel Edge Hosting (Primary Recommendation)

| Type | Host / Name | Value / Target | TTL | Purpose |
|---|---|---|---|---|
| **A** | `@` (Apex) | `76.76.21.21` | Auto / 300 | Routes `ourspace.app` to Vercel Global Anycast Edge |
| **CNAME** | `www` | `cname.vercel-dns.com.` | Auto / 300 | Routes `www.ourspace.app` to Vercel CDN |
| **CAA** | `@` | `0 issue "letsencrypt.org"`| Auto | Authorizes automated Let's Encrypt SSL issuance |

### 1.2 Firebase Hosting Alternative

| Type | Host / Name | Value / Target | TTL | Purpose |
|---|---|---|---|---|
| **A** | `@` | `199.36.158.100` | Auto / 300 | Firebase Hosting Primary IP |
| **A** | `@` | `199.36.158.100` | Auto / 300 | Firebase Hosting Secondary IP |
| **CNAME** | `www` | `<project-id>.web.app.` | Auto / 300 | Subdomain routing |

---

## 2. Firebase Authorized Domains Integration

When using a custom domain, Firebase Authentication blocks login and password reset requests unless the domain is registered:

1. Open **[Firebase Console](https://console.firebase.google.com/)** -> **Authentication** -> **Settings** -> **Authorized domains**.
2. Click **Add domain**.
3. Add:
   - `ourspace.app`
   - `www.ourspace.app`
4. Verify the entry appears in the list.

---

## 3. Cloud Storage CORS Update

To ensure media files and photos upload cleanly from the custom domain:
1. In `cors.json`:
   ```json
   [
     {
       "origin": ["https://ourspace.app", "https://www.ourspace.app"],
       "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "x-goog-resumable"]
     }
   ]
   ```
2. Apply:
   ```bash
   gcloud storage buckets update gs://<project-id>.appspot.com --cors-file=cors.json
   ```

---

## 4. Verification & Health Check Commands

Run the following commands in your terminal to verify that DNS and HTTPS certificates are properly provisioned:

```bash
# 1. Query A Record
nslookup ourspace.app

# 2. Query CNAME Record
nslookup -type=CNAME www.ourspace.app

# 3. Test HTTPS Handshake and HTTP/2 Protocol
curl -I https://ourspace.app

# 4. Verify Security Headers (HSTS, CSP, X-Frame-Options)
curl -s -D - https://ourspace.app -o /dev/null | grep -E "strict-transport-security|x-frame-options"
```
