/* trickle bar: steps .1/.04/.02/.005 by band, every 1000ms with a 1000ms ease, cap .994; done = 200ms to full, fade, remove */
(function () {
  var bar = document.createElement('div'), peg = document.createElement('i');
  bar.className = 'pbar'; bar.appendChild(peg); document.body.appendChild(bar);
  var v = 0, t = null;
  function inc(d) {
    if (v >= 1) return;
    if (typeof d !== 'number') d = v < .2 ? .1 : v < .5 ? .04 : v < .8 ? .02 : v < .99 ? .005 : 0;
    v = Math.min(.994, Math.max(0, v + d));
    bar.style.transition = 'transform 1000ms ease';
    bar.style.transform = 'translate3d(' + (100 * (v - 1)) + '%,0,0)';
    t = setTimeout(inc, 1000);
  }
  t = setTimeout(inc, 0);
  window.__pbar = { done: function () {
    clearTimeout(t); bar.style.transition = 'transform 200ms ease'; bar.style.transform = 'translate3d(0,0,0)';
    setTimeout(function () { bar.style.opacity = 0;  }, 200);
  } };
})();
