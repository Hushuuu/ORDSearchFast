(() => {
  const {
    createIndices,
    escapeHtml,
    fillLevelSelect,
    getLevelLabel,
    getSearchableText,
    readQueryParam,
    resolveRecordLabel
  } = window.ORDApp;

  function createNameStack(record) {
    const lines = [
      `<button type="button" class="name-primary-button" data-search-name="${escapeHtml(record.name)}">${escapeHtml(record.name)}</button>`
    ];

    if (record.en_name) {
      lines.push(`<span class="name-secondary">${escapeHtml(record.en_name)}</span>`);
    }

    if (record.kr_name) {
      lines.push(`<span class="name-secondary">${escapeHtml(record.kr_name)}</span>`);
    }

    return `<div class="name-stack">${lines.join('')}</div>`;
  }

  function createMaterialChips(record, indices) {
    if (!record.materials || record.materials.length === 0) {
      return '<span class="muted">-</span>';
    }

    return `<div class="chip-group">${record.materials
      .map((material) => {
        const label = resolveRecordLabel(material.material_id, indices);
        const materialLevel = indices.byCharacterId.get(material.material_id)?.level || 0;
        return `<button type="button" class="material-chip badge-${materialLevel}" data-search-name="${escapeHtml(label)}" data-material-id="${escapeHtml(material.material_id)}">${escapeHtml(label)}</button>`;
      })
      .join('')}</div>`;
  }

  function initQuickLookup(records) {
    const indices = createIndices(records);
    const searchInput = document.getElementById('searchInput');
    const levelFilter = document.getElementById('levelFilter');
    const clearButton = document.getElementById('clearButton');
    const summary = document.getElementById('summaryText');
    const body = document.getElementById('lookupTableBody');

    fillLevelSelect(levelFilter, '全部稀有度');

    const presetKeyword = readQueryParam('q');
    if (presetKeyword) {
      searchInput.value = presetKeyword;
    }

    // 速查頁維持即時篩選，輸入或點擊素材時立即重畫表格。
    function filterRecords() {
      const keyword = searchInput.value.trim().toLowerCase();
      const levelValue = levelFilter.value;

      return indices.records.filter((record) => {
        if (levelValue && String(record.level) !== levelValue) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return getSearchableText(record, indices).includes(keyword);
      });
    }

    function render() {
      const filtered = filterRecords();
      summary.textContent = `目前顯示 ${filtered.length} / ${indices.records.length} 筆資料`;

      if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty-state">找不到符合條件的資料。</div></td></tr>';
        return;
      }

      body.innerHTML = filtered
        .map(
          (record) => `
            <tr>
              <td data-label="稀有度"><span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span></td>
              <td data-mobile="${escapeHtml(getLevelLabel(record.level))}" data-label="單位名稱" data-keycode="${record.key_code ? '(' + record.key_code + ')' : ''}">${createNameStack(record)}</td>
              <td data-label="材料">
                <div class="cell-mobile-label">
                  <span class="label-text">材料</span>
                  <a class="link-button mobile-action-btn" href="tree.html?character=${encodeURIComponent(record.character_id)}">
                    <img style="vertical-align: middle" width="20" height="16" src="resource/mitre.svg" alt="合成樹">
                  </a>
                </div>
                <div class="cell-content">
                  ${createMaterialChips(record, indices)}
                </div>
              </td>
              <td data-label="金鑰">${record.key_code ? escapeHtml(record.key_code) : '<span class="muted">-</span>'}</td>
              <td data-label="備註">${record.remark ? escapeHtml(record.remark) : '<span class="muted">-</span>'}</td>
              <td data-label="功能">
                <div class="inline-actions">
                  <a class="link-button" href="tree.html?character=${encodeURIComponent(record.character_id)}"><img style="vertical-align: middle" width="25" height="20" src="resource/mitre.svg" alt="合成樹"></a>
                </div>
              </td>
            </tr>
          `
        )
        .join('');
    }

    body.addEventListener('click', (event) => {
      const target = event.target.closest('[data-search-name]');
      if (!target) {
        return;
      }

      searchInput.value = target.dataset.searchName || '';
      render();
      //window.scrollTo({ top: 0, behavior: 'smooth' });
      searchInput.scrollIntoView({
        behavior: 'smooth', // 平滑滾動，如果想要瞬間跳過去可以改成 'auto'
        block: 'start'      // 滾動到該元素的「頂部」
      });
    });
    // 1. 新增防抖函數
    function debounce(func, delay = 150) {
      let timer;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
      };
    }

    // 2. 修改原本的事件監聽（將 render 包起來）
    searchInput.addEventListener('input', debounce(render, 300));
    levelFilter.addEventListener('change', render);
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      levelFilter.value = '';
      render();
    });

    render();
  }

  window.ORDApp.initQuickLookup = initQuickLookup;
})();
