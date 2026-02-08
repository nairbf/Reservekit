(function() {
  var script = document.querySelector('script[data-reservekit]');
  if (!script) return;
  var baseUrl = script.getAttribute('data-url') || script.src.replace('/widget.js', '');
  var container = document.createElement('div');
  container.id = 'reservekit-widget';
  script.parentNode.insertBefore(container, script);
  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/reserve/embed';
  iframe.style.width = '100%';
  iframe.style.minHeight = '500px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.setAttribute('title', 'Restaurant Reservations');
  container.appendChild(iframe);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'reservekit-resize') iframe.style.height = e.data.height + 'px';
  });
})();
