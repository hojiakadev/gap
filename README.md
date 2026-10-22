# Gap

A little space. A lot of connection.

Temporary browser tunnels for sharing messages, links, code, images, and files with classmates and teammates. No accounts. Names are required to create or join a tunnel. No database. No saved content history.

## Run locally

Requires Node.js 24 (also pinned in `.nvmrc` for CI and hosting).

```sh
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies Socket.IO to the in-memory relay on port 3001. Both ports must be available locally; other devices only need access to port 5173.

### Invite your phone during development

1. Connect the phone and computer to the **same Wi-Fi**; keep `npm run dev` running.
2. Create a tunnel. On localhost, the invite panel uses a private network address detected when Vite starts. If multiple addresses are available, select the address for the Wi-Fi your phone uses.
3. Copy the **Invite link** or scan the QR. The link points to the computer (for example `http://192.168.1.10:5173/#/join/...`), preserving the current room.
4. If no address is detected, open the **Network** URL printed by Vite on the computer, then create a tunnel and share its link. Restart Vite if your Wi-Fi/IP changes.

`localhost`, `127.0.0.1`, and `::1` refer to whichever device opens the link, so a localhost invite cannot reach your computer from a phone. LAN links only work inside that network. Sharing through Messenger does not publish the server. To share across different Wi-Fi networks or mobile data, deploy the Node server at a public HTTPS address.

If the Network URL itself does not open on the phone, check that the computer is awake, the server is running, both devices are on the same Wi-Fi, and the firewall permits the Node development server. Guest/classroom Wi-Fi may isolate devices even on the same network; test on a network that permits connections between devices. Do not disable the firewall globally.

On plain HTTP LAN origins, clipboard access can be unavailable; select and copy the visible invite link manually. File sharing still works.

## Netlify + Render deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the one-time setup, environment variables, CI/CD behavior, and live verification command. Netlify publishes the frontend; Render runs the single-instance Socket.IO relay.

## Self-hosted production

```sh
npm run build
npm start
```

The Node server serves `dist/` and Socket.IO together on port 3001 (`PORT` overrides it). Put it behind an HTTPS reverse proxy that supports WebSocket upgrades and passes the original Host header. `ALLOWED_ORIGINS` declares the exact frontend origins allowed to use the relay. Set it before starting with `NODE_ENV=production`. Environment variables must be set in the process environment; `.env.example` documents them (no automatic dotenv loading).

Deploy as one long-running Node process. Static-only hosting cannot run this relay. Rooms live in one process; multiple replicas require coordinated room ownership and are intentionally outside this implementation. Restarting the server destroys all tunnels. Disable request-body logging in your hosting/proxy configuration. No content telemetry is included.

## Features

- Pair tunnels (2 people) or team tunnels (12 people)
- Random 48-bit invite codes, shareable hash links, and real QR codes
- Live presence, messages, clickable HTTP(S) links, and code snippets
- Chunked arbitrary file transfers, up to 20 MB per file; raster image previews
- Download, copy, drag-and-drop, transfer progress, and accessible keyboard controls
- Required display name (remembered in the browser) and persistent light/dark mode
- Uzbek (Latin), English, and Russian interface translations with a persistent language selector
- Teal interface, quoted message replies, and a formatting toolbar
- Bold (Ctrl/⌘+B), italic (Ctrl/⌘+I), inline code, and safe formatting preview
- Dedicated code editor with language labels, Tab indentation, and Ctrl/⌘+Enter to send
- Immediate empty-room deletion, manual end-for-everyone, and two-hour expiry
- Responsive custom interface using only free Material UI components

## Data lifecycle and limits

The server retains **only** room membership, expiry timers, rate counters, and transfer metadata in process memory. Payloads temporarily pass through transport buffers during delivery and are never written to application storage. There is no message or file history on the server, no replay, and no data restoration. A new arrival only receives new content.

Connected browsers keep up to 150 received/sent items in memory, including Blob URLs for files. Leaving, disconnecting, or ending a tunnel clears that device’s memory references and revokes file URLs. Ending/expiring a room clears all connected devices. An empty room is deleted immediately. Remaining participants can keep their session when someone leaves. Downloads, copied text, screenshots, and browser/OS internal buffers are outside Gap’s control; secure erasure is not promised.

LocalStorage contains only `gap.preferences` with the display name (required for connecting), theme preference, and interface language. Invite codes are placed in URL fragments, which browsers do not send in HTTP requests; they can still appear in browser history. Nothing is stored in IndexedDB, cookies, service workers, or a database.

Gap is **not end-to-end encrypted**. Use HTTPS in production for transport encryption. Anyone who has an invitation can join within capacity, and any participant can end the tunnel. Do not use it as an anonymous public file host. Each socket has rate limits; each transfer is validated for size, chunk order, and declared byte count. Transfers time out after 60 seconds of inactivity. There is no malware scanning. Downloads retain their original extension; only PNG/JPEG/GIF/WebP are previewed, never HTML/SVG or other executable file types.

On plain HTTP LAN origins the Clipboard API can be unavailable. The UI explains this and codes can be selected/copied manually. File transfer IDs use a browser UUID helper that also works on HTTP LAN. Use HTTPS for a public installation.

## Architecture

```text
src/app/                 App composition, theme, global visual system
src/components/          Shared shell, brand, illustration, information pages
src/features/tunnel/     Tunnel lifecycle hook and feature UI
src/lib/                 Formatting, clipboard, local preference boundary
shared/protocol.ts       Typed Socket.IO events, DTOs, shared limits
server/relay.ts          In-memory room lifecycle and validated event relay
server/index.ts          HTTP/static host and Socket.IO entry point
tests/relay.test.ts      Multi-client integration tests over real sockets
docs/DESIGN.md           Design direction established before implementation
```

```sh
npm run typecheck
npm test
npm run build
```

No paid Material UI modules, external image assets, analytics, or persistence services. Roboto is bundled and served locally.

## Messaging shortcuts

Select text and press **Ctrl/⌘+B** for bold or **Ctrl/⌘+I** for italic. Toolbar buttons offer the same actions on touch devices. Gap uses lightweight markup (`**bold**`, `_italic_`, and backticks for inline code) with a preview before sending; raw HTML is never interpreted.

Use the reply arrow beneath any message or file to quote it. Click a received quote to scroll to the original if it is still in your device’s temporary history. Reply excerpts are limited to 200 characters and travel with the new message; the server does not retain the original or validate authorship of the quoted excerpt.

The code button opens a dedicated editor with language selection, preserved whitespace, horizontal scrolling, and a copy action. Language is a label; code is rendered as plain text and is never executed. Theme changes do not reconnect the tunnel or clear the conversation.

## Interface languages

Gap uses `i18next` and `react-i18next` with bundled catalogs in `src/i18n/locales/` for **O‘zbekcha**, **English**, and **Русский**. The header selector changes the UI immediately without reconnecting the tunnel. A saved language wins over browser language detection, with English as the fallback. The selection is kept in the existing `gap.preferences` object alongside name and theme.

Navigation, forms, dialogs, help/privacy pages, messaging controls, accessibility labels, validation messages, and known relay notifications are translated. Dates/numbers follow the interface locale. Russian plural forms cover room expiry and code line counts. User messages, names, filenames, invite codes, and programming code remain unchanged. No translation service, external requests, or content persistence is added.

Catalogs use English source phrases as flat keys (`keySeparator` and `nsSeparator` are disabled); interpolated and pluralized messages use named keys. Add each key to all three catalogs. Tests verify key and placeholder parity, plural rules, language detection, and server error coverage.
