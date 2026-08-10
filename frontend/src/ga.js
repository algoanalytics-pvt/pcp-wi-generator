const GA_ID = "G-M59HEQJCB3";

function isLocal() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

function getClientId() {
  try {
    let clientId = localStorage.getItem("custom_ga_user_id");
    if (!clientId) {
      clientId = "user_" + Math.random().toString(36).slice(2) + "_" + Date.now();
      localStorage.setItem("custom_ga_user_id", clientId);
    }
    return clientId;
  } catch {
    return "user_" + Math.random().toString(36).slice(2);
  }
}

export function loadGA(appName) {
  try {
    if (isLocal()) return; // skip entirely for localhost
    if (window.__ga_initialized__) return;

    const clientId = getClientId();

    const existing = document.querySelector(
      `script[src*="googletagmanager.com/gtag/js?id=${GA_ID}"]`
    );
    if (!existing) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(s);
    }

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = window.gtag || gtag;
    window.__ga_initialized__ = true;

    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      user_id: clientId,
      app_name: appName,
      page_title: appName,
    });

    const loadKey = `ga_loaded_${appName}`;
    if (!sessionStorage.getItem(loadKey)) {
      window.gtag("event", "app_loaded", {
        app_name: appName,
        user_id: clientId,
      });
      sessionStorage.setItem(loadKey, "true");
    }
  } catch {
    // never crash the app due to GA
  }
}

export function trackEvent(eventName, params = {}) {
  try {
    if (isLocal()) return;
    if (!window.gtag) return;

    let uid = "anonymous";
    try {
      uid =
        localStorage.getItem("real_user_id") ||
        localStorage.getItem("custom_ga_user_id") ||
        "anonymous";
    } catch {
      // ignore
    }

    window.gtag("event", eventName, {
      ...params,
      user_id: uid,
      page_path: window.location.pathname,
    });
  } catch {
    // never crash the app due to GA
  }
}
