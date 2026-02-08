(function () {
  var script = document.currentScript;
  if (!script || !script.hasAttribute("data-reservekit")) {
    script = document.querySelector("script[data-reservekit]");
  }
  if (!script) return;

  var baseUrl = script.getAttribute("data-url") || script.src.replace(/\/widget\.js(?:\?.*)?$/, "");
  var theme = script.getAttribute("data-theme") || "light";
  var accent = script.getAttribute("data-accent") || "#2563eb";
  var query = new URLSearchParams({ theme: theme, accent: accent }).toString();

  var host = document.createElement("div");
  host.id = "reservekit-widget";
  host.style.width = "100%";
  host.style.maxWidth = "680px";

  var iframe = document.createElement("iframe");
  iframe.src = baseUrl + "/reserve/embed?" + query;
  iframe.style.width = "100%";
  iframe.style.minHeight = "520px";
  iframe.style.height = "520px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "10px";
  iframe.style.background = "transparent";
  iframe.setAttribute("title", "Restaurant Reservations");

  var powered = document.createElement("a");
  powered.href = baseUrl;
  powered.target = "_blank";
  powered.rel = "noopener noreferrer";
  powered.textContent = "Powered by ReserveKit";
  powered.style.display = "inline-block";
  powered.style.marginTop = "8px";
  powered.style.fontSize = "12px";
  powered.style.color = "#6b7280";
  powered.style.textDecoration = "none";

  host.appendChild(iframe);
  host.appendChild(powered);

  if (script.parentNode) {
    script.parentNode.insertBefore(host, script);
  }

  var expectedOrigin;
  try {
    expectedOrigin = new URL(baseUrl, window.location.href).origin;
  } catch (_err) {
    expectedOrigin = "*";
  }

  window.addEventListener("message", function (event) {
    if (expectedOrigin !== "*" && event.origin !== expectedOrigin) return;
    if (!event.data || event.data.type !== "reservekit-resize") return;
    if (typeof event.data.height !== "number") return;

    var nextHeight = Math.max(380, Math.ceil(event.data.height));
    iframe.style.height = nextHeight + "px";
  });
})();
