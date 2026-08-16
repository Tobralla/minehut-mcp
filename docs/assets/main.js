(function () {
  // theme toggle
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem("mh-theme"); } catch (e) {}
  if (!stored) stored = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.setAttribute("data-theme", stored);

  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.textContent = stored === "dark" ? "Light" : "Dark";
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      toggle.textContent = next === "dark" ? "Light" : "Dark";
      try { localStorage.setItem("mh-theme", next); } catch (e) {}
    });
  }

  // code copy buttons
  document.querySelectorAll("pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.className = "code-copy";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      var text = pre.querySelector("code").innerText;
      navigator.clipboard.writeText(text).then(
        function () {
          btn.textContent = "Copied";
          btn.classList.add("copied");
          setTimeout(function () {
            btn.textContent = "Copy";
            btn.classList.remove("copied");
          }, 1500);
        },
        function () { btn.textContent = "Error"; }
      );
    });
    pre.appendChild(btn);
  });

  // toc scroll spy
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if (tocLinks.length) {
    var targets = tocLinks
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);
    var spy = setInterval(function () {
      var found = null;
      for (var i = targets.length - 1; i >= 0; i--) {
        var t = targets[i];
        if (t.getBoundingClientRect().top <= 120) { found = t; break; }
      }
      tocLinks.forEach(function (a) { a.classList.remove("active"); });
      if (found) {
        var match = tocLinks.find(function (a) { return a.getAttribute("href") === "#" + found.id; });
        if (match) match.classList.add("active");
      }
    }, 200);
    window.addEventListener("beforeunload", function () { clearInterval(spy); });
  }
})();