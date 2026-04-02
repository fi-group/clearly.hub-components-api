# Clearly.HUB – Components API

> **Preview** — This library is not yet publicly hosted. See [Building locally](#building-locally) below. Functionality might change.

A lightweight browser-side JavaScript library that lets your web app open Clearly Hub components (e.g. payment flows, identity screens) either as a **popup window** or a **full-page redirect**, then receive the result back in your app.

Once included on your page it exposes `window.oupapi.components` with two methods: `open()` and `getRedirectResult()`.

---

## How it works

The library ships as two files:

| File | Purpose |
|---|---|
| `oup.js` / `oup.min.js` | Bootstrap loader — the only file you include in your HTML |
| `oup.components.js` / `oup.components.min.js` | The actual library, loaded automatically by the bootstrap |

You only add one `<script>` tag. The bootstrap detects its own URL, derives the components bundle filename from it, and injects it automatically.

---

## Usage

### 1. Include the script

```html
<script src="https://your-cdn/oup.min.js" id="oup-bootstrap"></script>
```

> The `id="oup-bootstrap"` attribute is required for browsers where `document.currentScript` is unavailable (deferred/async scripts, some legacy browsers).

### 2. Open a component — popup mode

```js
window.oupapi.components.open({
  component: {
    client_id:  'your-client-id',
    actions:    ['SELECT_HUB'],
    type:       'popup',             // 'popup' (default) or 'redirect'
  },
  settings: {                        // all optional
    popup: {
      position: 'right',             // 'left' | 'center' | 'right' (default: 'right')
      height:   800,                 // px (default: full screen height)
    },
  },
  callback: (result) => {
    console.log(result);
    // { request: {…}, response: {…}, verified: 'VERIFIED' | 'INVALID_SIGNATURE' }
  },
});
```

### 3. Open a component — redirect mode

When `type: 'redirect'` is used the browser navigates away and returns. Call `getRedirectResult()` on page load to pick up the result when it comes back:

```js
window.oupapi.components.open({
  component: {
    client_id:    'your-client-id',
    actions:      ['SELECT_HUB'],
    type:         'redirect',
  },
});

// On page load:
window.oupapi.components.getRedirectResult((result) => {
  console.log(result);
  // { request: {…}, response: {…}, verified: 'VERIFIED' | 'INVALID_SIGNATURE' }
});
```

---

## Prerequisites — `client_id`

Every call to `open()` requires a `client_id`. This is an identifier issued to your application through the Clearly Hub API configuration — you cannot generate it yourself.

Retrieve it from your API config in [Clearly Hub](https://hub.clearly.app) and treat it as a non-secret app identifier (it is sent in the URL payload, not as a credential). Make sure [http://localhost:8080](http://localhost:8080) and [https://hub.clearly.app/components](https://hub.clearly.app/components) are in the redirect urls list of the api config.

---

## Result object

| Field | Type | Description |
|---|---|---|
| `request` | `object` | The original request payload sent to the component |
| `response` | `object` | The response returned by the component |
| `verified` | `'VERIFIED'` \| `'INVALID_SIGNATURE'` | Signature verification outcome |

---

## Building locally

### Prerequisites

- Node.js ≥ 18
- npm

### Install dependencies

```bash
npm install
```

### Commands

| Command | Output | Description |
|---|---|---|
| `npm run build` | `dist/oup.min.js`, `dist/oup.components.min.js` | Production build (minified) |
| `npm run watch:build` | `dist/oup.js`, `dist/oup.components.js` | Development build with watch |
| `npm run watch:build:min` | `dist/oup.min.js`, `dist/oup.components.min.js` | Minified build with watch |

### Running locally

The repo includes an `index.html` example page. After building, start the dev server:

```bash
npm run watch:build   # keep the build updated in dist/
npm run dev           # serve the project on http://localhost:8080
```

Open [http://localhost:8080](http://localhost:8080) — you'll see a single **run component** button. Click it to trigger the component flow. Results are logged to the browser console via `receivedDataCallback`.

The page covers both modes:
- **Popup** — `open()` with `type: 'popup'` and a `callback`
- **Redirect** — `getRedirectResult()` is registered on every page load to catch the return

### Including your local build in your own project

After building, host the `dist/` folder (or copy its contents) and include only the bootstrap script:

```html
<script src="/path/to/dist/oup[.min].js" id="oup-bootstrap"></script>
```

Both `oup[.min].js` and `oup.components[.min].js` must be served from the same directory.

