// Compact navigation for WarLike Rig Studio. UI only: no mesh or rig mutation.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const drawer = $("toolsDrawer"), backdrop = $("drawerBackdrop");
  const opener = $("menuToggle"), closer = $("closeTools");
  const tabs = [...document.querySelectorAll("#toolsNav [data-page-target]")];
  const pages = [...drawer.querySelectorAll(".tool-page[data-page]")];
  let activePage = "import";
  let previousFocus = null;
  function choose(name) {
    if (!tabs.some(button => button.dataset.pageTarget === name)) return;
    activePage = name;
    for (const tab of tabs) {
      const selected = tab.dataset.pageTarget === name;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    }
    for (const page of pages) page.classList.toggle("active", page.dataset.page === name);
    drawer.scrollTop = 0;
  }
  function open(page = activePage) {
    previousFocus = document.activeElement;
    choose(page);
    document.body.classList.add("tools-open");
    backdrop.hidden = false;
    opener.setAttribute("aria-expanded", "true");
    closer.focus();
  }
  function close() {
    document.body.classList.remove("tools-open");
    backdrop.hidden = true;
    opener.setAttribute("aria-expanded", "false");
    if (drawer.contains(document.activeElement)) (previousFocus?.isConnected ? previousFocus : opener).focus();
  }
  opener.addEventListener("click", () => {
    if (document.body.classList.contains("tools-open")) close();
    else open();
  });
  closer.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("tools-open")) {
      event.preventDefault();
      close();
    }
  });
  for (const tab of tabs) tab.addEventListener("click", () => choose(tab.dataset.pageTarget));
  choose(activePage);
  // Let model interaction start immediately after import; keep chosen section accessible.
  $("file")?.addEventListener("change", () => close());
  // Named access for optional future toolbar actions.
  window.WarLikeRigMenu = Object.freeze({open,close,choose});
})();
