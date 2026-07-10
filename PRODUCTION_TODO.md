# Production Launch TODO — Protos Platform

Deferred infrastructure tasks. None of these are needed for development or
testing. Complete them only when onboarding real paying clients, since
several cost money. Ordered by launch priority.

Status legend: not started (empty box) · in progress · done

---

## 0. Register Domains (do first — blocks everything else)
- [ ] Register protosadmin.com
- [ ] Register protosportal.com
- Nothing in section 3 works until these are owned.
- Note where DNS ends up hosted (Route 53 / Squarespace / Cloudflare /
  GoDaddy) — it changes the DNS record setup later.

---

## 1. SES — Invite Emails (highest impact — invites don't send without this)
Currently invite emails are caught non-fatally and never send.

- [ ] Verify a sender identity in SES (region us-west-1): SES → Verified
      identities → Create identity → Email address → verify via link
- [ ] Set SES_SENDER_EMAIL env var to the verified sender (adminCognito
      Lambda) — do NOT hardcode
- [ ] Confirm Lambda execution role has ses:SendEmail scoped to the
      verified identity ARN (least-privilege, not *)
- [ ] Request SES production access (SES → Account dashboard → Request
      production access) to send to ANY recipient (~24–48h approval;
      until then, only verified addresses)
- [ ] Test: invite a user → confirm the email actually arrives

---

## 2. WAF — Rate Limiting (~$6–7/month)
Cost: Web ACL $5/mo + rule $1/mo + $0.60 per million requests.

- [ ] Create Web ACL protos-appsync-acl in WAF (region us-west-1)
- [ ] Associate with the PRODUCTION AppSync API (behind d11yajkly52yyj),
      NOT the sandbox (uu3mtdqqnjd6xnew25map3tzpu)
- [ ] Rate-based rule: 100 req / 5 min / source IP, action Block
- [ ] Default action: Allow
- [ ] Keep CloudWatch metrics on to watch for triggers
- Optional future: scope-down to only adminInviteUser, or a dedicated
  adminSearchUsers Lambda with server-side rate limiting.

---

## 3. Wildcard Domains + SSL (Phase 4C)
Do once domains are registered (section 0). Repeat per app.

- [ ] Amplify Console → admin app → Hosting → Custom domains → Add domain:
      root protosadmin.com, wildcard *.protosadmin.com → main branch
- [ ] Add ACM validation + CloudFront CNAME records at the DNS registrar
- [ ] Amplify auto-provisions the wildcard ACM SSL cert
- [ ] Repeat for portal app → *.protosportal.com
- [ ] Wait for SSL provisioning (5–20 min after DNS propagates)
- [ ] Test: https://companya.protosadmin.com + https://companya.protosportal.com
      resolve and SubdomainService reads the slug
- Gotcha: wildcard covers ONE level only. companya.protosportal.com works,
  sub.companya.protosportal.com does not (fine — slugs are single-level).
- Gotcha: if the registrar can't do ANAME/ALIAS/flattened-CNAME at the
  apex, use Route 53 or Cloudflare, or a www-redirect.

---

## 4. Content Security Policy (free, but test carefully)
CSP block already drafted (Phase 4B report). Apply per environment.

- [ ] Add CSP + security headers to production Amplify app (console custom
      headers or amplify.yml)
- [ ] Use PRODUCTION values, not sandbox:
      S3 bucket amplify-d11yajkly52yyj-main-appfilesbucket23865b9a-kmsiwt6coivb
      and the production AppSync endpoint (not sandbox 46yb2yps...)
- [ ] After deploy: load app with browser DevTools console open, fix any
      CSP violations (likely style-src/script-src for Angular/Amplify)

---

## 5. Pre-Launch Data Check
- [ ] Run node scripts/audit-null-org.mjs against PRODUCTION before
      go-live — confirms 0 null organizationId (backfill script ready if not)
- [ ] Confirm organizationId required migration deployed cleanly to prod
- [ ] Verify org isolation end-to-end in prod (repeat the Alice/Bob test)

---

## Notes
- Sandbox is free to keep testing on — none of the above blocks dev work.
- Apply WAF + CSP to PRODUCTION, not sandbox, when the time comes.
- Rough monthly cost once live: WAF ~$6–7 + domains (~$12–24/yr each) +
  standard Amplify/AppSync/Cognito usage. SES is effectively free at low
  volume.
