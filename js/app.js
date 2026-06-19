(() => {
  const {
    cloneData,
    markActiveNav,
    showMaintenanceNav,
    initQuickLookup,
    initTreePage,
    initMaintenancePage,
    initCompPage,
    initCompTreePage,
    initRecommendPage
  } = window.ORDApp;

  function initApp() {
    markActiveNav();

    const records = cloneData(window.ORD_DATA || []);
    const page = document.body.dataset.page;

    if (page === 'lookup') {
      initQuickLookup(records);
    } else if (page === 'tree') {
      initTreePage(records);
    } else if (page === 'maintenance') {
      initMaintenancePage(records);
    } else if (page === 'comp') {
      initCompPage(records);
    } else if (page === 'comp_tree') {
      initCompTreePage(records);
    } else if (page === 'recommend') {
      initRecommendPage(records);
    }

    showMaintenanceNav();
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
