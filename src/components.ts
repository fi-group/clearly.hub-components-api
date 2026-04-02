import {
  CHANNEL_NAME,
  DEFAULTS,
  SETTINGS_KEY,
  CONFIG_KEY,
  COMPONENT_LAUNCH,
  POPUP_WINDOW_NAME,
} from "./common/constants";
import { OpenProps, OupWindow } from "./common/types";
import { verifySignature, cleanup, getDataFromPayload } from "./common/utils";

/**
 * This module runs as a single IIFE and serves a dual purpose depending on
 * where in the component flow the current page load sits:
 *
 *  1. HOST PAGE (normal load, no special URL params)
 *     Exposes `window.oupapi.components.open()` and `getRedirectResult()`.
 *     Nothing else happens on load.
 *
 *  2. LAUNCH STEP (host page reloaded with ?__oup_components_popup__=1)
 *     Triggered by `open()`. Reads config from localStorage, encodes it as a
 *     base64 payload, and navigates (or opens a popup window) to the external
 *     components URL with that payload.
 *
 *  3. RETURN STEP (redirect_url loaded with data params in the URL)
 *     The external components site has finished and redirected back. The URL
 *     contains the encoded response payload and its signature. This step
 *     verifies the signature and resolves `redirectResultPromise` with the
 *     result so that `getRedirectResult()` can hand it back to the host app.
 *
 * Popup flow:   host page → (popup window) launch step → external site
 *                         → (popup window) return step → BroadcastChannel → host page callback
 *
 * Redirect flow: host page → launch step (same tab) → external site
 *                          → return step (same tab) → redirectResultPromise → getRedirectResult() callback
 */
void (() => {
  const { localStorage, location } = window;

  // BroadcastChannel is used in popup mode to send results from the popup
  // window back to the host page that opened it.
  const channel = new BroadcastChannel(CHANNEL_NAME);

  // In redirect mode the result travels via a Promise instead of BroadcastChannel,
  // because the host page navigates away and comes back fresh — there is no
  // persistent JS context to post a message to. The IIFE resolves this promise
  // once it has processed the return URL; getRedirectResult() subscribes to it.
  let redirectResultResolve!: (data: Record<string, unknown> | null) => void;
  const redirectResultPromise = new Promise<Record<string, unknown> | null>((resolve) => {
    redirectResultResolve = resolve;
  });

  /**
   * Opens the external component UI.
   * - Persists settings and component config to localStorage (survives navigation).
   * - In popup mode: opens a new browser window and listens for results via BroadcastChannel.
   * - In redirect mode: navigates the current tab; the caller must use
   *   `getRedirectResult()` on the next page load to receive the result.
   */
  const open = ({ component, settings, callback }: OpenProps): void => {
    let type = component.type || DEFAULTS.TYPE;

    const sett = {
      publicKeyUrl: settings?.publicKeyUrl || DEFAULTS.PUBLIC_KEY_URL,
      componentsUrl: settings?.componentsUrl || DEFAULTS.COMPONENTS_URL,
      type,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(sett));

    localStorage.setItem(CONFIG_KEY, JSON.stringify(component));

    // Popup mode only: wire up the BroadcastChannel listener before we open
    // the window, so the message from the return step is not missed.
    if (type !== 'redirect') {
      channel.onmessage = (event) => {
        callback(event.data);
      };
    }

    const popupWidth = 450;
    const position = settings?.popup?.position || 'right';
    const height = settings?.popup?.height || screen.availHeight;
    const left = position === 'center'
      ? (screen.availWidth - popupWidth) / 2
      : position === 'right'
        ? screen.availWidth - popupWidth
        : 0;
    const top = height < screen.availHeight ? (screen.availHeight - height) / 2 : 0;
    const opts = `width=${popupWidth},height=${height},left=${left},top=${top}`;

    // Navigate to the current URL with the launch marker param. The IIFE on
    // that page load will detect it and forward to the external components URL.
    if (type === 'redirect') {
      window.open(`${location.href}?${COMPONENT_LAUNCH}=1`, '_self');
    } else {
      window.open(
        `${location.href}?${COMPONENT_LAUNCH}=1`,
        POPUP_WINDOW_NAME,
        opts,
      );
    }
  };

  // Runs immediately on every page load to detect which step of the flow we're in.
  void (async (): Promise<void> => {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const params = new URLSearchParams(location.search);
    const componentConfig = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');

    const paramName = componentConfig.param || DEFAULTS.DATA_PARAM;
    const signatureParamName = componentConfig.signatureParam || DEFAULTS.SIGNATURE_PARAM;

    // isLaunching: we were just sent here by open() and need to forward to the external site.
    // hasDataParam: the external site redirected back with response data in the URL.
    const isLaunching = params.get(COMPONENT_LAUNCH) === '1';
    const hasDataParam = params.get(paramName) !== null;
    const isHandling = isLaunching || hasDataParam;

    if (!isHandling) {
      // Normal host page load — nothing to process, unblock getRedirectResult().
      redirectResultResolve(null);
      return;
    }

    if (hasDataParam) {
      // ── RETURN STEP ──────────────────────────────────────────────────────────
      // The external components site has redirected back with the response
      // payload (and optionally a signature) in the URL params.
      const payloadData = params.get(paramName) as string;
      const payloadSig = params.get(signatureParamName);

      const signatureFormat = componentConfig.signatureFormat || DEFAULTS.SIGNATURE_FORMAT;
      const data = getDataFromPayload(payloadData, signatureFormat);

      const valid = await verifySignature(payloadData, signatureFormat, payloadSig);
      const verified = valid ? 'VERIFIED' : 'INVALID_SIGNATURE';

      const isRedirect = settings.type === 'redirect';

      if (payloadSig && !valid) {
        // Signature present but invalid — report failure and bail out.
        const result = { request: data.request, response: { result: 'FAILURE' }, verified };
        if (isRedirect) {
          redirectResultResolve(result);
        } else {
          channel.postMessage(result);
          cleanup();
        }
        return;
      }

      // Signature valid (or absent — unsigned response) — deliver the result.
      const result = { request: data.request, response: data.response, verified };
      if (isRedirect) {
        redirectResultResolve(result);
      } else {
        channel.postMessage(result);
        cleanup();
      }
    } else {
      // ── LAUNCH STEP ──────────────────────────────────────────────────────────
      // We have the launch marker param but no data yet. Build the encoded
      // component config and navigate to the external components URL.
      redirectResultResolve(null);

      const component = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      component.param = component.param || DEFAULTS.DATA_PARAM;
      component.signatureParam = component.signatureParam || DEFAULTS.SIGNATURE_PARAM;
      component.signatureFormat = component.signatureFormat || DEFAULTS.SIGNATURE_FORMAT;
      component.redirect_url = component.redirect_url || DEFAULTS.REDIRECT_URL;

      const payload = btoa(JSON.stringify(component));

      window.open(
        `${settings.componentsUrl}/${payload}`,
        '_self',
      );
    }
  })();

  /**
   * Registers a callback to receive the result of a redirect-mode component flow.
   * Must be called on every page load — if a redirect result is waiting (i.e. the
   * external site just redirected back), the callback fires once the signature
   * verification completes. If there is no pending result, the callback is never called.
   */
  const getRedirectResult = (callback: (data: Record<string, unknown>) => void): void => {
    redirectResultPromise.then((data) => {
      if (!data) return;
      cleanup();
      const url = new URL(window.location.href);
      url.searchParams.delete(COMPONENT_LAUNCH);
      url.searchParams.delete(DEFAULTS.DATA_PARAM);
      url.searchParams.delete(DEFAULTS.SIGNATURE_PARAM);
      window.history.replaceState({}, document.title, url.toString());
      callback(data);
    });
  };

  const oupWindow = window as OupWindow;
  oupWindow.oupapi = oupWindow.oupapi || {};
  oupWindow.oupapi.components = { open, getRedirectResult };
})();
