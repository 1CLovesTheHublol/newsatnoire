# News At Noire — Writers' Desk setup

Invite-only essay writing at **newsatnoire.com/write.html**. Writers sign in with a 6-digit code sent to their email. Only addresses on your list can get a code, and writers don't need GitHub accounts. Published essays appear at **/essays.html**, on the front page under "Latest Essays", and each one has its own page at **/essay.html?e=…**.

Everything runs on your existing Cloudflare Worker (**noire-oauth**). The CMS login at /admin keeps working as before.

---

## 1. Create the sign-in email sender (Resend, free)
1. Sign up at **resend.com**.
2. **Domains → Add domain** → `newsatnoire.com`. Add the DNS records it shows at your domain registrar, then wait for "Verified".
   (Until the domain is verified you can test with sender `onboarding@resend.dev`. It only delivers to your own Resend account email.)
3. **API Keys → Create** → copy the key.

## 2. Create a GitHub token for publishing
github.com → Settings → Developer settings → **Fine-grained tokens → Generate new token**
- Repository access: **Only select repositories → newsatnoire**
- Permissions → Repository → **Contents: Read and write**
- Copy the token.

## 3. Create the code store (KV)
Cloudflare dash → **Storage & Databases → KV → Create namespace** → name it `noire-writer`.

## 4. Configure the worker
Cloudflare dash → Workers & Pages → **noire-oauth**.

**Settings → Bindings → Add → KV namespace**
- Variable name: `WRITER_KV` → namespace: `noire-writer`

**Settings → Variables and Secrets → Add**

| Name | Type | Value |
|---|---|---|
| `GITHUB_TOKEN` | Secret | token from step 2 |
| `RESEND_API_KEY` | Secret | key from step 1 |
| `SESSION_SECRET` | Secret | any long random string (e.g. 40+ random characters) |
| `ALLOWED_EMAILS` | Text | `jane@example.com:Jane Doe, sam@example.com:Sam Okafor` |
| `MAIL_FROM` | Text | `News At Noire <desk@newsatnoire.com>` |
| `REQUIRE_REVIEW` | Text | `false` to publish straight away, `true` to hold essays for you |

Keep `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as they are.

## 5. Deploy the new worker code
**Edit code** → replace everything with the contents of `worker-oauth.js` → **Deploy**.

## 6. Upload the site files
Upload this folder's contents to the repo root (GitHub → Add file → Upload files) and commit to `main`.

## 7. Test
1. Open **newsatnoire.com/write.html** → enter an invited email → enter the code from your inbox.
2. Write a short test essay → **Publish**.
3. A new file appears in `content/essays/` in the repo. Within about 2 minutes the essay shows on /essays.html.
4. Delete the test file from GitHub (or set it to Draft in /admin) when you're done.

---

## Managing access
- **Give access:** add the email to `ALLOWED_EMAILS` → Save. The `:Name` part is optional and pre-fills their byline.
- **Remove access:** delete the email → Save. They're signed out on their next action, even if they were mid-session.
- **Review before publishing:** set `REQUIRE_REVIEW` to `true`. Essays arrive as drafts. Publish them in /admin → Essays by unticking "Draft".
- **Edit or remove a published essay:** /admin → Essays, or edit/delete the file in `content/essays/` on GitHub.

## Security notes
- Codes expire after 10 minutes and are limited to 5 attempts. Each email can request at most 5 codes per 15 minutes.
- The sign-in page gives the same answer whether or not an email is invited, so nobody can probe your list.
- Sessions last 14 days on the writer's device.
- The GitHub token lives only in the worker. It can only change files in the newsatnoire repo.
