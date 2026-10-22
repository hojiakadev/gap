# Deploy Gap: Netlify + Render

Netlify serves the React frontend. Render runs the long-lived Socket.IO relay. The browser connects **directly** to Render over HTTPS/WSS; Netlify Functions and redirect proxies are not used for the relay.

## Files already configured

- `netlify.toml`: publishes `dist/`, requires a relay URL, runs the CI checks before deploying, and adds response headers.
- `render.yaml`: a single Node 24 relay instance, `/health` health check, required origin allowlist, and automatic deployment with relay checks before startup.
- `.github/workflows/ci.yml`: installs from the lockfile, checks formatting, runs integration tests, type-checks, and builds both artifacts on pushes and pull requests.
- `.nvmrc`: Node 24, matching Netlify, Render, and GitHub Actions.
- `npm run verify:deployment`: checks frontend assets and real cross-origin Socket.IO delivery after provisioning.

The checkout currently needs a GitHub repository before these workflows can run remotely. Commit and push the project to a repository you own; do not commit `.env` files or platform credentials.

## One-time setup

1. **Create the Netlify project from the GitHub repository.** Select the branch you want to publish. Netlify reads `netlify.toml`; no manual publish directory is needed. Note its actual HTTPS URL, such as `https://your-gap.netlify.app`. The initial build intentionally fails if `VITE_RELAY_URL` has not been set yet.
2. **Create a Render Blueprint from the same repository.** Render reads `render.yaml`. Set the required `ALLOWED_ORIGINS` value to the **exact Netlify origin**, for example `https://your-gap.netlify.app` (no path or slash needed). Render provides the port. The relay must stay at **one instance** because rooms are held only in that process.
3. **Wait for the Render deployment to be healthy.** Open `https://YOUR-RELAY.onrender.com/health`; the response must be `{"status":"ok"}`. Use the URL Render actually assigns, not the example service name in this guide.
4. **Set the frontend environment variable in Netlify.** Under environment variables, add `VITE_RELAY_URL=https://YOUR-RELAY.onrender.com`, available to builds. It is a public endpoint, not a secret. Trigger a new deployment; Vite embeds it at build time. Changing it later requires another frontend deploy.
5. **Run the live check from the repository:**

   ```sh
   npm run verify:deployment -- https://YOUR-SITE.netlify.app https://YOUR-RELAY.onrender.com
   ```

   The check creates a disposable named room, joins with a second client, sends a message and small binary file, verifies the WebSocket upgrade, then closes the room. It does not read or join existing rooms.

6. **Check in two actual devices.** Open the Netlify URL on a computer and phone, enter different names, create a tunnel, and share its link. Public deployment no longer requires both devices to use the same Wi-Fi.

No Netlify or Render API token is needed in the repository or workflow. Each platform uses its GitHub integration for continuous delivery. The first account/repository connection must be completed in the platform UI.

## CI/CD behavior

- Push or pull request → GitHub **Gap CI / Test and build** runs.
- A push to Netlify's configured production branch → Netlify installs dependencies and runs `npm run build:netlify`, including the same checks, before publishing.
- Render's `commit` trigger builds its linked branch and runs formatting, type, and integration checks before replacing the relay. It does not wait for Netlify's status, avoiding a first-deploy dependency loop.
- Protect your production branch with the **Test and build** required check if you want to prevent merging failing code.
- A failed build does not replace the currently deployed application.
- Frontend and relay deployments are independent. Keep protocol changes compatible when deploying them separately.

GitHub artifacts are verification builds; Netlify builds its own frontend with its configured `VITE_RELAY_URL`. Native Git deployments are used instead of an additional token-based deploy workflow, avoiding duplicate production publishes.

## Origins, custom domains, and previews

The relay allows exact origins from `ALLOWED_ORIGINS`, separated by commas. Example:

```text
https://your-gap.netlify.app,https://gap.your-domain.com
```

This controls both WebSocket handshakes and polling CORS responses. No wildcard permits other people's Netlify sites. Origin checks are a browser boundary, not user authentication; display names identify participants but are not verified identities.

For a Netlify Deploy Preview or branch deployment, add its **exact** origin to `ALLOWED_ORIGINS`, or use a separate preview relay. Production-only origins intentionally reject unlisted preview URLs. Disable automatic previews in Netlify until you choose a preview-origin policy. Custom domains require updating the allowlist before users connect from them. Do not set the frontend URL to the relay's host.

## Hosting limits and data lifecycle

The Blueprint uses Render's free plan for initial testing. Free services can sleep when idle and have usage limits; the first connection may take time to wake up. For reliable production availability, select an appropriate always-on plan yourself. No paid service is provisioned by this configuration.

All rooms, membership, transfer metadata, and contents remain ephemeral. A relay restart or deployment disconnects clients and destroys its rooms. There is no database, persistent disk, file upload storage, or restoration step. Keep only one relay instance; uncoordinated replicas can route teammates into different room maps. The frontend's language, theme, and display name preferences remain browser-local.

Use each platform's HTTPS URL. Configure platform logging without request-body or message logging. Gap does not log message or file payloads. Netlify's fingerprinted frontend assets and font files are cached; room content never enters Netlify's asset build or cache.

## Local checks

```sh
npm ci --include=dev
npm run ci
```

To exercise the exact Netlify build path with a syntactically valid example endpoint:

```sh
VITE_RELAY_URL=https://gap-relay.onrender.com npm run build:netlify
```

The example validates build configuration only; it does not claim that an example host exists or belongs to this project. Run the live check against the actual provisioned URLs before claiming the hosted application works.

Local development still uses `npm run dev` and the same-origin Vite proxy when `VITE_RELAY_URL` is unset. A unified self-hosted deployment can use `npm run build && npm start`; production mode also requires `ALLOWED_ORIGINS` to include its public origin. Node server environment variables come from the process environment; Vite loads frontend `.env.local` values. The Node relay does not automatically load dotenv files.

## References

- [Netlify file-based build configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Netlify guidance on running a persistent web server](https://answers.netlify.com/t/socket-io-is-not-working-in-next-js-app-on-netlify/87342)
- [Render WebSockets](https://render.com/docs/websocket)
- [Render Blueprint settings](https://render.com/docs/blueprint-spec)
- [Render continuous deployment](https://render.com/docs/deploys)
- [Render free service limits](https://render.com/docs/free)
