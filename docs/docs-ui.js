document.addEventListener("DOMContentLoaded", function () {
  var page = window.location.pathname.split("/").pop() || "index.html";
  if (!page || page === "") page = "index.html";
  document.querySelectorAll(".ade-nav-item").forEach(function (link) {
    if (link.getAttribute("href") === page) {
      link.classList.add("ade-nav-active");
    }
  });

  var burger = document.getElementById("ade-burger");
  var sidebar = document.querySelector(".ade-sidebar");
  var backdrop = document.getElementById("ade-backdrop");

  if (burger && sidebar && backdrop) {
    burger.addEventListener("click", function () {
      var isOpen = sidebar.classList.toggle("ade-sidebar-open");
      backdrop.style.display = isOpen ? "block" : "none";
    });

    backdrop.addEventListener("click", function () {
      sidebar.classList.remove("ade-sidebar-open");
      backdrop.style.display = "none";
    });
  }

  var themeBtn = document.getElementById("doc-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("ade:theme", next);
      } catch (e) {}
    });
  }
});
