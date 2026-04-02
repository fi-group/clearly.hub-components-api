/**
 * OUP Bootstrap Loader
 *
 * Self-executing bootstrap script that dynamically loads `oup.components.min.js`
 * relative to wherever this script itself is hosted. Designed to be included as
 * a single `<script>` tag; it then takes care of injecting the components bundle.
 *
 * Usage:
 *   <script src="https://cdn.example.com/oup.js" id="oup-bootstrap"></script>
 *
 * The `id="oup-bootstrap"` attribute is required when `document.currentScript`
 * is unavailable (e.g. deferred/async scripts or certain legacy browsers).
 */
(() => {
  /**
   * Resolves the `<script>` element that loaded this bootstrap file.
   *
   * Tries `document.currentScript` first (works in most modern browsers when the
   * script runs synchronously). Falls back to querying by `id="oup-bootstrap"`.
   *
   * @returns The bootstrap `<script>` element.
   * @throws {Error} If neither strategy can locate the element.
   */
  const getCurrentScript = (): HTMLScriptElement | null => {
    if (document.currentScript && document.currentScript instanceof HTMLScriptElement) {
      return document.currentScript as HTMLScriptElement;
    }
    const byId = document.getElementById('oup-bootstrap');
    if (byId && byId instanceof HTMLScriptElement) {
      return byId as HTMLScriptElement;
    }

    throw new Error(
      `OUP bootstrap: cannot determine bootstrap <script> element. Please add id="oup-bootstrap" to the script tag.`
    );
  };

  /**
   * Resolves a relative path against a base script URL.
   *
   * Uses the `URL` constructor when available, with two fallbacks for
   * environments where it may not behave as expected:
   * - Absolute paths (`/foo`) are resolved against the origin of the base URL.
   * - Relative paths are resolved by replacing the filename portion of the base.
   *
   * @param baseScriptUrl - The `src` of the bootstrap script.
   * @param relative - The path to resolve (e.g. `"oup.components.js"`).
   * @returns The fully-qualified URL string.
   */
  const resolveUrl = (baseScriptUrl: string, relative: string) => {
    try {
      return new URL(relative, baseScriptUrl).toString();
    } catch (e) {
      if (relative.startsWith('/')) {
        const u = new URL(baseScriptUrl);
        return u.origin + relative;
      }
      return baseScriptUrl.replace(/[^/]*$/, '') + relative;
    }
  };

  /**
   * Checks whether a script with the given URL is already present in the DOM.
   *
   * Query-string parameters are ignored during the comparison so that scripts
   * loaded with different cache-busters are still detected as duplicates.
   *
   * @param url - The URL to check (query string is stripped before comparing).
   * @returns `true` if a matching `<script src="…">` element already exists.
   */
  const scriptAlreadyPresent = (url: string) => {
    const baseUrl = url.split('?')[0];
    const existing = Array.from(document.querySelectorAll('script[src]'))
      .map((el) => (el as HTMLScriptElement).src.split('?')[0]);
    return existing.includes(baseUrl);
  };

  /**
   * Appends a `v=<timestamp>` query parameter to defeat CDN / browser caching.
   *
   * @param url - The original URL.
   * @returns The URL with a cache-busting parameter appended.
   */
  const addCacheBuster = (url: string) => {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(Date.now())}`;
  };

  /**
   * Creates a `<script>` element and appends it to `<head>`.
   *
   * `async` is set to `false` so the injected script executes in document order
   * (i.e. after this bootstrap, before any subsequent synchronous scripts).
   *
   * @param url - The fully-qualified URL of the script to load.
   */
  const injectScript = (url: string) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    const parent = document.head
      || document.getElementsByTagName('head')[0]
      || document.documentElement;
    parent.appendChild(script);
  };

  // --- Entry point ---

  const currentScript = getCurrentScript();
  // Guard: if the script element or its src cannot be determined, do nothing.
  if (!currentScript || !currentScript.src) return;

  // Derive the components bundle URL from the location of this bootstrap script.
  // Mirrors the current script's own filename: oup.js → oup.components.js, oup.min.js → oup.components.min.js.
  const currentFilename = currentScript.src.split('/').pop()!.split('?')[0];
  const componentsFilename = currentFilename.replace(/^oup/, 'oup.components');
  const componentsUrl = resolveUrl(currentScript.src, componentsFilename);

  // Avoid injecting the same script twice (e.g. if the page reloads partially).
  if (scriptAlreadyPresent(componentsUrl)) return;

  // Inject the bundle with a cache-buster to ensure the latest version is fetched.
  const finalUrl = addCacheBuster(componentsUrl);
  injectScript(finalUrl);
})();
