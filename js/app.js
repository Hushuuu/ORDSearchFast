const LEVEL_LABELS = {
  0: '物品',
  1: '常見',
  2: '不平凡',
  3: '特別',
  4: '稀有',
  5: '傳奇',
  6: '隱藏',
  7: '扭曲',
  8: '變化',
  9: '限制',
  10: '超越',
  11: '不朽',
  12: '永恆',
  16: '隨機限定',
  18: '神秘',
  23: '熾天使',
};

function cloneData(data) {
  return JSON.parse(JSON.stringify(data || []));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[·．\.\-–—_]/g, '')
    .replace(/[\s'"]/g, '')
    .replace(/[()（）\[\]【】]/g, '')
    .replace(/[+,，、/]/g, '')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compareRecords(left, right) {
  if (left.level !== right.level) {
    return Number(left.level || 0) - Number(right.level || 0);
  }
  // 1. 先比較 characterId (啟用 numeric: true，讓電腦看懂 1-2 < 1-13)
  const levelCompare = String(left.character_id || '').localeCompare(
    String(right.character_id || ''), 
    undefined, 
    { numeric: true, sensitivity: 'base' }
  );

  // 如果 level 不一樣，就直接回傳 level 的比較結果
  if (levelCompare !== 0) {
    return levelCompare;
  }

  return String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hant');
}

function getLevelLabel(level) {
  return LEVEL_LABELS[level] || `Lv.${level}`;
}

function createIndices(records) {
  const sortedRecords = [...records].sort(compareRecords);
  const byCharacterId = new Map();
  const byName = new Map();
  const parentMap = new Map();

  sortedRecords.forEach((record) => {
    byCharacterId.set(record.character_id, record);

    const normalizedName = normalizeText(record.name);
    if (normalizedName && !byName.has(normalizedName)) {
      byName.set(normalizedName, record);
    }

    (record.materials || []).forEach((material) => {
      const materialId = material.material_id;
      if (!parentMap.has(materialId)) {
        parentMap.set(materialId, []);
      }
      parentMap.get(materialId).push(record);
    });
  });

  return {
    records: sortedRecords,
    byCharacterId,
    byName,
    parentMap
  };
}

function getPrimaryRecord(characterId, indices) {
  return indices.byCharacterId.get(characterId) || null;
}

function resolveRecordLabel(characterId, indices) {
  const record = getPrimaryRecord(characterId, indices);
  if (!record) {
    return characterId;
  }

  return record.name;
}

function getMaterialNames(record, indices) {
  return (record.materials || []).map((material) => resolveRecordLabel(material.material_id, indices));
}

function getSearchableText(record, indices) {
  return [
    record.character_id,
    record.name,
    record.kr_name,
    record.en_name,
    record.key_code,
    record.remark,
    record.major,
    getLevelLabel(record.level),
    ...getMaterialNames(record, indices),
    ...(record.suitable_partners || []).map((partner) => resolveRecordLabel(partner.character_id, indices))
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function fillLevelSelect(select, includeAllLabel) {
  const levels = Object.entries(LEVEL_LABELS)
    .map(([level, label]) => ({ level: Number(level), label }))
    .sort((left, right) => left.level - right.level);

  select.innerHTML = '';
  if (includeAllLabel) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = includeAllLabel;
    select.appendChild(option);
  }

  levels.forEach(({ level, label }) => {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = `${level}｜${label}`;
    select.appendChild(option);
  });
}

function markActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

function createNameStack(record) {
  const lines = [];
  lines.push(
    `<button type="button" class="name-primary-button" data-search-name="${escapeHtml(record.name)}">${escapeHtml(record.name)}</button>`
  );

  if (record.en_name) {
    lines.push(`<span class="name-secondary">${escapeHtml(record.en_name)}</span>`);
  }

  if (record.kr_name) {
    lines.push(`<span class="name-secondary">${escapeHtml(record.kr_name)}</span>`);
  }

  // lines.push(`<span class="name-secondary">ID：${escapeHtml(record.character_id)}</span>`);
  return `<div class="name-stack">${lines.join('')}</div>`;
}

function createMaterialChips(record, indices) {
  if (!record.materials || record.materials.length === 0) {
    return '<span class="muted">-</span>';
  }

  return `<div class="chip-group">${record.materials
    .map((material) => {
      const label = resolveRecordLabel(material.material_id, indices);
      const materialLevel = getPrimaryRecord(material.material_id, indices)?.level || 0;
      return `<button type="button" class="material-chip badge-${materialLevel}" data-search-name="${escapeHtml(label)}" data-material-id="${escapeHtml(material.material_id)}">${escapeHtml(label)}</button>`;
    })
    .join('')}</div>`;
}

function createPartnerChips(record, indices) {
  if (!record.suitable_partners || record.suitable_partners.length === 0) {
    return '<span class="muted">未填寫</span>';
  }

  return `<div class="chip-group">${record.suitable_partners
    .map((partner) => {
      const label = resolveRecordLabel(partner.character_id, indices);
      return `<span class="partner-chip">${escapeHtml(label)}</span>`;
    })
    .join('')}</div>`;
}

function showToast(element, type, message) {
  element.className = `toast ${type}`;
  element.textContent = message;
}

function clearToast(element) {
  element.className = 'toast';
  element.textContent = '';
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function createTomSelectOptions(records) {
  return [...records]
    .sort(compareRecords)
    .map((record) => ({
      value: record.character_id,
      text: record.name,
      label: record.name,
      levelLabel: getLevelLabel(record.level),
      kr_name: record.kr_name || '',
      en_name: record.en_name || '',
      character_id: record.character_id
    }));
}

function createTomSelectRenderConfig() {
  return {
    option(data, escape) {
      return `
        <div>
          <div>${escape(data.label || data.text || data.value)}</div>
          <div class="picker-result-meta">${escape(data.character_id || '')}｜${escape(data.levelLabel || '')}${data.kr_name ? `｜KR：${escape(data.kr_name)}` : ''}</div>
        </div>
      `;
    },
    item(data, escape) {
      return `<div>${escape(data.label || data.text || data.value)}</div>`;
    }
  };
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
      body.innerHTML = `<tr><td colspan="6"><div class="empty-state">找不到符合條件的資料。</div></td></tr>`;
      return;
    }

    body.innerHTML = filtered
      .map(
        (record) => `
          <tr>
            <td data-label="稀有度"><span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span></td>
            <td data-label="單位名稱">${createNameStack(record)}</td>
            <td data-label="所需材料">${createMaterialChips(record, indices)}</td>
            <td data-label="金鑰">${record.key_code ? escapeHtml(record.key_code) : '<span class="muted">-</span>'}</td>
            <td data-label="備註">${record.remark ? escapeHtml(record.remark) : '<span class="muted">-</span>'}</td>
            <td data-label="功能">
              <div class="inline-actions">
                <a class="link-button" href="tree.html?character=${encodeURIComponent(record.character_id)}"><img style="vertical-align: middle"  width="25" height="20" src="resource/mitre.svg" alt="合成樹"></a>
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  searchInput.addEventListener('input', render);
  levelFilter.addEventListener('change', render);
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    levelFilter.value = '';
    render();
  });

  render();
}

function initTreePage(records) {
  const indices = createIndices(records);
  const treeSearchSelect = document.getElementById('treeSearchSelect');
  const levelFilter = document.getElementById('treeLevelFilter');
  const loadButton = document.getElementById('loadTreeButton');
  const resultTitle = document.getElementById('treeResultTitle');
  const rootSummary = document.getElementById('treeRootSummary');
  const upwardContainer = document.getElementById('upwardContainer');
  const downwardContainer = document.getElementById('downwardContainer');
  const toggleUpwardButton = document.getElementById('toggleUpwardButton');
  const hasTomSelect = typeof window.TomSelect === 'function';
  const treeSelect = hasTomSelect
    ? new window.TomSelect(treeSearchSelect, {
        options: [],
        valueField: 'value',
        labelField: 'label',
        searchField: ['label', 'value', 'kr_name', 'en_name'],
        maxOptions: 400,
        create: false,
        persist: false,
        placeholder: '搜尋角色名稱',
        render: createTomSelectRenderConfig(),
        dropdownParent: 'body',
      })
    : null;
  let selectedCharacterId = '';

  fillLevelSelect(levelFilter, '全部');

  function getFilteredTreeRecords() {
    const levelValue = levelFilter.value;
    return indices.records.filter((record) => !levelValue || String(record.level) === levelValue);
  }

  function syncTreeSelectOptions(preferredCharacterId = '') {
    if (!treeSelect) {
      return;
    }

    const options = createTomSelectOptions(getFilteredTreeRecords());
    const hasPreferred = options.some((option) => option.value === preferredCharacterId);
    treeSelect.clear(true);
    treeSelect.clearOptions();
    treeSelect.addOptions(options);
    treeSelect.refreshOptions(false);

    if (hasPreferred) {
      treeSelect.setValue(preferredCharacterId, true);
      selectedCharacterId = preferredCharacterId;
    } else if (selectedCharacterId && options.some((option) => option.value === selectedCharacterId)) {
      treeSelect.setValue(selectedCharacterId, true);
    } else {
      selectedCharacterId = '';
    }
  }

  function resolveRecordFromInput() {
    return selectedCharacterId ? indices.byCharacterId.get(selectedCharacterId) || null : null;
  }

  function renderNodeCard(record, options = {}) {
    const titleMarkup = options.navigateable
      ? `<button type="button" class="tree-node-action" data-navigate-character="${escapeHtml(record.character_id)}">${escapeHtml(record.name)}</button>`
      : `<strong>${escapeHtml(record.name)}</strong>`;

    return `
      <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
        <div class="node-title">
          <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
          ${titleMarkup}
          ${record.key_code ? '('+ record.key_code +')' : ''}
        </div>
        <div class="node-detail">
          <div style="display:none">角色 ID：${escapeHtml(record.character_id)}</div>
          <div>材料：${escapeHtml(getMaterialNames(record, indices).join('、') || '無')}</div>
        </div>
      </div>
    `;
  }

  function renderDownwardBranch(record, trailCharacterIds, depth) {
    const nextTrail = new Set(trailCharacterIds);
    nextTrail.add(record.character_id);
    const materials = record.materials || [];

    if (materials.length === 0) {
      return `<li>${renderNodeCard(record)}</li>`;
    }

    const childrenMarkup = materials
      .map((material) => {
        const childRecord = getPrimaryRecord(material.material_id, indices);
        if (!childRecord) {
          return `<li><div class="node-card placeholder"><div class="node-title"><strong>${escapeHtml(material.material_id)}</strong></div><div class="node-detail">查無對應資料</div></div></li>`;
        }

        if (nextTrail.has(childRecord.character_id)) {
          return `<li>
            ${renderNodeCard(childRecord)}
            <div class="status-line">此節點與上層屬於同一角色 ID，已停止繼續展開避免循環。</div>
          </li>`;
        }

        return renderDownwardBranch(childRecord, nextTrail, depth + 1);
      })
      .join('');

    return `
      <li>
        <details class="branch-details">
          <summary class="branch-summary">
            ${renderNodeCard(record, { navigateable: true })}
            <span class="branch-toggle-hint">
              <img style="vertical-align: middle" width="25" height="25" src="resource/arrow_drop_down.svg" alt="${depth === 1 ? '點擊收合 / 展開' : '點擊收合 / 展開'}">
            </span>
          </summary>
          <ul class="tree-list">${childrenMarkup}</ul>
        </details>
      </li>
    `;
  }

  function renderUpwardSection(record) {
    const parents = indices.parentMap.get(record.character_id) || [];
    //toggleUpwardButton.classList.remove('is-hidden');
    //upwardContainer.classList.add('is-hidden');

    if (parents.length === 0) {
      toggleUpwardButton.textContent = '此角色沒有上層';
      toggleUpwardButton.disabled = true;
      upwardContainer.innerHTML = '<div class="empty-state">無上層角色</div>';
      return;
    }

    toggleUpwardButton.disabled = false;
    toggleUpwardButton.textContent = `顯示上層（${parents.length} 筆）`;
    upwardContainer.innerHTML = `
      <div class="upward-card">
        <h3><span>上層角色</span></h3>
        <ul class="upward-list">
          ${parents.map((parent) => `<li>${renderNodeCard(parent, { navigateable: true })}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  function renderTree(record) {
    selectedCharacterId = record.character_id;
    const characterNameText = `${record.name}｜${getLevelLabel(record.level)} | KR: ${escapeHtml(record.kr_name || '')} | EN: ${escapeHtml(record.en_name || '')}`;
    // resultTitle.textContent = characterNameText;
    if (treeSelect) {
      syncTreeSelectOptions(record.character_id);
    }
    // rootSummary.innerHTML = `
    //   <div class="tree-card">
    //     <div class="node-detail">
    //       <div style="display:none">角色 ID：${escapeHtml(record.character_id)}</div>
    //       <div style="display:none">KR：${escapeHtml(record.kr_name || '未填寫')}</div>
    //       <div style="display:none">EN：${escapeHtml(record.en_name || '未填寫')}</div>
    //       <div>金鑰：${record.key_code || ''}</div>
    //       <div>備註：${escapeHtml(record.remark || '')}</div>
    //       <div>總材料：${escapeHtml(formatBaseMaterialsText(record, indices))}</div>
    //     </div>
    //   </div>
    // `;
    const directMaterials = record.materials || [];
    downwardContainer.innerHTML = `
      <div class="tree-card">
        <h4>點擊卡片往下展開 或 名稱搜尋</h4>
        <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
            <div class="node-title">
              <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
              ${record.name} ${record.key_code ? '('+ record.key_code +')' : ''}
            </div>
            <div class="node-detail">
              <div>備註：${escapeHtml(record.remark || '')}</div>
              <div>總材料：${escapeHtml(formatBaseMaterialsText(record, indices))}</div>
            </div>
        </div>
        ${directMaterials.length === 0
          ? '<div class="empty-state">這個角色沒有可往下的材料。</div>'
          : `<ul class="tree-list">${directMaterials
              .map((material) => {
                const childRecord = getPrimaryRecord(material.material_id, indices);
                if (!childRecord) {
                  return `<li><div class="node-card placeholder"><div class="node-title"><strong>${escapeHtml(material.material_id)}</strong></div><div class="node-detail">查無對應資料</div></div></li>`;
                }

                return renderDownwardBranch(childRecord, new Set([record.character_id]), 1);
              })
              .join('')}</ul>`}
      </div>
    `;
    renderUpwardSection(record);
  }

  function loadTree(record = resolveRecordFromInput()) {
    if (!record) {
      resultTitle.textContent = '找不到指定角色';
      rootSummary.innerHTML = `<div class="empty-state">請輸入存在的名稱或角色 ID。</div>`;
      toggleUpwardButton.classList.add('is-hidden');
      upwardContainer.innerHTML = '';
      downwardContainer.innerHTML = '';
      return;
    }

    renderTree(record);
  }

  function handleTreeNavigation(event){
    // 1. 檢查使用者點擊的是不是帶有跳轉屬性的節點/按鈕
    const target = event.target.closest('[data-navigate-character]');
    if (!target) {
      return;
    }

    // 2. 從索引中撈出該節點對應的角色完整資料
    const record = indices.byCharacterId.get(target.dataset.navigateCharacter);
    if (!record) {
      return;
    }

    // 3. 跳轉與重刷邏輯
    levelFilter.value = String(record.level);
    syncTreeSelectOptions(record.character_id);
    loadTree(record); // 這行會重新觸發 renderTree，把整棵樹（包含上下層）刷新
    //window.scrollTo({ top: 220, behavior: 'smooth' }); // 捲回頂部
    downwardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  upwardContainer.addEventListener('click', handleTreeNavigation);
  downwardContainer.addEventListener('click', handleTreeNavigation);

  if (treeSelect) {
    treeSelect.on('change', (value) => {
      selectedCharacterId = String(value || '');
    });
  }

  syncTreeSelectOptions();

  const presetCharacterId = readQueryParam('character');
  if (presetCharacterId && indices.byCharacterId.has(presetCharacterId)) {
    const presetRecord = indices.byCharacterId.get(presetCharacterId);
    levelFilter.value = String(presetRecord.level);
    syncTreeSelectOptions(presetRecord.character_id);
    renderTree(presetRecord);
  }

  loadButton.addEventListener('click', () => loadTree());
  toggleUpwardButton.addEventListener('click', () => {
    upwardContainer.classList.toggle('is-hidden');
    toggleUpwardButton.textContent = upwardContainer.classList.contains('is-hidden')
      ? toggleUpwardButton.textContent.replace('隱藏', '顯示')
      : toggleUpwardButton.textContent.replace('顯示', '隱藏');
  });
  levelFilter.addEventListener('change', () => {
    const currentRecord = resolveRecordFromInput();
    syncTreeSelectOptions(currentRecord?.character_id || '');
    if (currentRecord && String(currentRecord.level) === levelFilter.value) {
      loadTree(currentRecord);
    } else if (!levelFilter.value && currentRecord) {
      loadTree(currentRecord);
    } else if (selectedCharacterId) {
      loadTree();
    }
  });
}

/**
 * 遞迴計算指定角色所需的所有基礎材料（Level 0 & Level 1）
 * @param {Object} record - 當前要查詢的角色資料
 * @param {Object} indices - 透過 createIndices(records) 建立的索引
 * @param {Map} [counts=new Map()] - 用於記錄累加數量的 Map（內部遞迴用）
 * @param {Set} [visited=new Set()] - 避免循環依賴死結（內部遞迴用）
 * @returns {Map} 鍵為 character_id，值為總需求的數量
 */
function getBaseMaterialQuantities(record, indices, counts = new Map(), visited = new Set()) {
  if (!record) return counts;

  // 1. 防止防呆：避免循環合成導致無窮遞迴（死結）
  if (visited.has(record.character_id)) {
    return counts;
  }
  visited.add(record.character_id);

  // 2. 判斷是否為基礎材料 (Level 0 或 Level 1)
  // 如果是基礎材料，直接累加數量，且「不再往下拆解」
  if (record.level === 0 || record.level === 1) {
    const currentCount = counts.get(record.character_id) || 0;
    counts.set(record.character_id, currentCount + 1);
    
    // 記得在返回前移出 visited，讓其他合成路徑可以重複使用此基礎材料
    visited.delete(record.character_id);
    return counts;
  }

  // 3. 如果不是基礎材料，代表需要繼續往下拆解 (遞迴)
  const materials = record.materials || [];
  materials.forEach((material) => {
    const childRecord = indices.byCharacterId.get(material.material_id);
    if (childRecord) {
      // 遞迴呼叫下一層
      getBaseMaterialQuantities(childRecord, indices, counts, visited);
    } else {
      // 防呆：如果找不到對應的資料，就把這個材料代碼當作基礎材料計算
      const currentCount = counts.get(material.material_id) || 0;
      counts.set(material.material_id, currentCount + 1);
    }
  });

  // 移除當前節點的拜訪紀錄
  visited.delete(record.character_id);
  return counts;
}

/**
 * 將計算出來的基礎材料轉化為文字格式（例如：A * 10 + B * 5）
 */
function formatBaseMaterialsText(record, indices) {
  const countsMap = getBaseMaterialQuantities(record, indices);
  if (countsMap.size === 0) {
    return '無基礎材料';
  }

  const resultSegments = [];
  countsMap.forEach((count, characterId) => {
    // 嘗試撈出真實的中文名稱，找不到就顯示 ID
    const childRecord = indices.byCharacterId.get(characterId);
    const name = childRecord ? childRecord.name : characterId;
    
    resultSegments.push(`${name} * ${count}`);
  });

  // 用 ' + ' 把所有材料串起來
  return resultSegments.join(' + ');
}

//resetTreeSearchButton
const resetTreeSearchButton = document.getElementById('resetTreeSearchButton');
function handleResetTreeSearchButton() {
  document.getElementById('treeSearchSelect').tomselect.clear();
  document.getElementById('treeLevelFilter').value = '';
}
if(resetTreeSearchButton){
  document.getElementById('resetTreeSearchButton').addEventListener('click', handleResetTreeSearchButton);
}


////////end of tree page
function initMaintenancePage(records) {
  const state = {
    records: cloneData(records),
    selectedRecordId: null,
    materialDraft: []
  };

  const listSearchInput = document.getElementById('maintenanceSearchInput');
  const listContainer = document.getElementById('maintenanceList');
  const listSummary = document.getElementById('maintenanceSummary');
  const toast = document.getElementById('maintenanceToast');
  const preview = document.getElementById('maintenancePreview');
  const materialPickerSelect = document.getElementById('materialPickerSelect');
  const materialChips = document.getElementById('fieldMaterialsChips');
  const clearMaterialsButton = document.getElementById('clearMaterialsButton');
  const partnerPickerSelect = document.getElementById('partnerPickerSelect');
  const hasTomSelect = typeof window.TomSelect === 'function';

  const fields = {
    character_id: document.getElementById('fieldCharacterId'),
    level: document.getElementById('fieldLevel'),
    name: document.getElementById('fieldName'),
    kr_name: document.getElementById('fieldKrName'),
    en_name: document.getElementById('fieldEnName'),
    key_code: document.getElementById('fieldKeyCode'),
    major: document.getElementById('fieldMajor'),
    remark: document.getElementById('fieldRemark')
  };

  const materialPicker = hasTomSelect
    ? new window.TomSelect(materialPickerSelect, {
        options: [],
        valueField: 'value',
        labelField: 'label',
        searchField: ['label', 'value', 'kr_name', 'en_name'],
        maxOptions: 150,
        create: false,
        persist: false,
        placeholder: '搜尋名稱或 id',
        render: createTomSelectRenderConfig()
      })
    : null;

  const partnerPicker = hasTomSelect
    ? new window.TomSelect(partnerPickerSelect, {
        options: [],
        valueField: 'value',
        labelField: 'label',
        searchField: ['label', 'value', 'kr_name', 'en_name'],
        maxOptions: 150,
        maxItems: null,
        create: false,
        persist: false,
        plugins: ['remove_button'],
        placeholder: '選擇適合夥伴',
        render: createTomSelectRenderConfig()
      })
    : null;

  fillLevelSelect(fields.level);

  function getIndices(records = state.records) {
    return createIndices(records);
  }

  function generateCharacterId(level) {
    let counter = 1;
    const indices = getIndices();
    let candidate = `${level}-${counter}`;

    while (indices.byCharacterId.has(candidate)) {
      counter += 1;
      candidate = `${level}-${counter}`;
    }

    return candidate;
  }

  function syncMaintenancePickers() {
    const options = createTomSelectOptions(state.records);

    if (materialPicker) {
      materialPicker.clear(true);
      materialPicker.clearOptions();
      materialPicker.addOptions(options);
      materialPicker.refreshOptions(false);
    }

    if (partnerPicker) {
      const selectedPartners = getSelectedRecord()
        ? (getSelectedRecord().suitable_partners || []).map((partner) => partner.character_id)
        : [];
      partnerPicker.clear(true);
      partnerPicker.clearOptions();
      partnerPicker.addOptions(options);
      partnerPicker.refreshOptions(false);
      partnerPicker.setValue(selectedPartners, true);
    }
  }

  function getFilteredRecords() {
    const keyword = listSearchInput.value.trim().toLowerCase();
    const indices = getIndices();
    const sorted = [...state.records].sort(compareRecords);

    if (!keyword) {
      return { records: sorted, indices };
    }

    return {
      records: sorted.filter((record) => getSearchableText(record, indices).includes(keyword)),
      indices
    };
  }

  function renderMaterialDraft() {
    if (state.materialDraft.length === 0) {
      materialChips.innerHTML = '<span class="muted">尚未加入材料。</span>';
      return;
    }

    const indices = getIndices();
    materialChips.innerHTML = state.materialDraft
      .map((characterId, index) => {
        const record = indices.byCharacterId.get(characterId);
        const label = record ? `${record.name}｜${characterId}` : characterId;
        return `
          <span class="selected-chip">
            <span>${escapeHtml(label)}</span>
            <button type="button" data-remove-material-index="${index}">×</button>
          </span>
        `;
      })
      .join('');
  }

  function appendMaterial(characterId) {
    if (!getIndices().byCharacterId.has(characterId)) {
      showToast(toast, 'error', `找不到材料 ID：${characterId}`);
      return;
    }

    state.materialDraft.push(characterId);
    clearToast(toast);
    renderMaterialDraft();
    if (materialPicker) {
      materialPicker.clear(true);
      materialPicker.blur();
    }
  }

  function setSelectedRecord(characterId) {
    state.selectedRecordId = characterId;
    renderList();
    fillForm();
  }

  function renderList() {
    const { records: filteredRecords } = getFilteredRecords();
    listSummary.textContent = `目前 ${filteredRecords.length} / ${state.records.length} 筆`;

    listContainer.innerHTML = filteredRecords
      .map(
        (record) => `
          <button type="button" class="record-list-button ${record.character_id === state.selectedRecordId ? 'active' : ''}" data-character-id="${escapeHtml(record.character_id)}">
            <strong>${escapeHtml(record.name)}</strong>
            <div class="record-meta">
              <span>${escapeHtml(record.kr_name || '')}</span>
              <span>${escapeHtml(record.en_name || '')}</span>
            </div>
            <div class="record-meta">
              <span>${escapeHtml(getLevelLabel(record.level))}</span>
              <span>${escapeHtml(record.character_id)}</span>
            </div>
          </button>
        `
      )
      .join('');
  }

  function getSelectedRecord() {
    return state.records.find((record) => record.character_id === state.selectedRecordId) || null;
  }

  function fillForm() {
    const record = getSelectedRecord();
    if (!record) {
      Object.values(fields).forEach((field) => {
        if ('value' in field) {
          field.value = '';
        }
      });
      state.materialDraft = [];
      renderMaterialDraft();
      if (materialPicker) {
        materialPicker.clear(true);
      }
      if (partnerPicker) {
        partnerPicker.clear(true);
      }
      preview.textContent = '尚未選擇資料。';
      return;
    }

    fields.character_id.value = record.character_id || '';
    fields.level.value = String(record.level ?? 0);
    fields.name.value = record.name || '';
    fields.kr_name.value = record.kr_name || '';
    fields.en_name.value = record.en_name || '';
    fields.key_code.value = record.key_code || '';
    fields.major.value = record.major || '';
    fields.remark.value = record.remark || '';
    state.materialDraft = (record.materials || []).map((material) => material.material_id);
    renderMaterialDraft();
    if (materialPicker) {
      materialPicker.clear(true);
    }
    if (partnerPicker) {
      partnerPicker.setValue((record.suitable_partners || []).map((partner) => partner.character_id), true);
    }
    preview.textContent = JSON.stringify(record, null, 2);
  }

  function parseReferenceLines(rawValue, keyName) {
    return rawValue
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((value) => ({ [keyName]: value }));
  }

  function validateReferences(materials, partners) {
    const indices = getIndices();
    const unknownMaterials = materials
      .map((item) => item.material_id)
      .filter((id) => !indices.byCharacterId.has(id));
    const unknownPartners = partners
      .map((item) => item.character_id)
      .filter((id) => !indices.byCharacterId.has(id));

    if (unknownMaterials.length > 0 || unknownPartners.length > 0) {
      const lines = [];
      if (unknownMaterials.length > 0) {
        lines.push(`找不到材料 ID：${unknownMaterials.join('、')}`);
      }
      if (unknownPartners.length > 0) {
        lines.push(`找不到適配角色 ID：${unknownPartners.join('、')}`);
      }
      return lines.join('\n');
    }

    return '';
  }

  function saveCurrentRecord() {
    const record = getSelectedRecord();
    if (!record) {
      showToast(toast, 'error', '請先選擇一筆資料。');
      return;
    }

    const nextMaterials = state.materialDraft.map((materialId) => ({ material_id: materialId }));
    const selectedPartners = partnerPicker
      ? Array.isArray(partnerPicker.getValue())
        ? partnerPicker.getValue()
        : String(partnerPicker.getValue() || '')
            .split(',')
            .filter(Boolean)
      : [];
    const nextPartners = selectedPartners.map((characterId) => ({ character_id: String(characterId) }));
    const validationMessage = validateReferences(nextMaterials, nextPartners);
    if (validationMessage) {
      showToast(toast, 'error', validationMessage);
      return;
    }

    if (!fields.character_id.value.trim() || !fields.name.value.trim()) {
      showToast(toast, 'error', '角色 ID 與中文名稱不可為空。');
      return;
    }

    const nextCharacterId = fields.character_id.value.trim();
    const nextLevel = Number(fields.level.value || 0);
    if (!nextCharacterId.startsWith(`${nextLevel}-`)) {
      showToast(toast, 'error', `character_id 需以 ${nextLevel}- 開頭，才能符合 level 編碼。`);
      return;
    }

    const duplicateCharacterId = state.records.some(
      (item) => item !== record && item.character_id === nextCharacterId
    );
    if (duplicateCharacterId) {
      showToast(toast, 'error', `character_id 重複：${nextCharacterId}`);
      return;
    }

    Object.assign(record, {
      character_id: nextCharacterId,
      level: nextLevel,
      name: fields.name.value.trim(),
      kr_name: fields.kr_name.value.trim(),
      en_name: fields.en_name.value.trim(),
      key_code: fields.key_code.value.trim(),
      major: fields.major.value.trim(),
      remark: fields.remark.value.trim(),
      materials: nextMaterials,
      suitable_partners: nextPartners
    });

    clearToast(toast);
    showToast(toast, 'success', '已更新。最後記得要匯出JSON檔！');
    syncMaintenancePickers();
    renderList();
    fillForm();
  }

  function addRecord() {
    const record = {
      character_id: generateCharacterId(0),
      level: 0,
      name: '新資料',
      kr_name: '',
      en_name: '',
      materials: [],
      key_code: '',
      remark: '',
      major: '',
      suitable_partners: []
    };

    state.records.push(record);
    clearToast(toast);
    syncMaintenancePickers();
    setSelectedRecord(record.character_id);
  }

  function deleteRecord() {
    const record = getSelectedRecord();
    if (!record) {
      showToast(toast, 'error', '請先選擇要刪除的資料。');
      return;
    }

    const confirmed = window.confirm(`確定刪除「${record.name}」嗎？`);
    if (!confirmed) {
      return;
    }

    state.records = state.records.filter((item) => item.character_id !== record.character_id);
    state.selectedRecordId = state.records[0]?.character_id || null;
    showToast(toast, 'success', '已刪除資料。最後記得要匯出JSON檔！');
    syncMaintenancePickers();
    renderList();
    fillForm();
  }

  function exportJson() {
    const output = [...state.records].sort(compareRecords);
    downloadTextFile('ord_data_export.json', `${JSON.stringify(output, null, 2)}\n`, 'application/json');
    showToast(toast, 'success', '已匯出最新 JSON。');
  }

  listContainer.addEventListener('click', (event) => {
    const target = event.target.closest('[data-character-id]');
    if (!target) {
      return;
    }

    clearToast(toast);
    setSelectedRecord(target.dataset.characterId);
  });

  listSearchInput.addEventListener('input', renderList);
  materialChips.addEventListener('click', (event) => {
    const target = event.target.closest('[data-remove-material-index]');
    if (!target) {
      return;
    }

    state.materialDraft.splice(Number(target.dataset.removeMaterialIndex), 1);
    renderMaterialDraft();
  });
  clearMaterialsButton.addEventListener('click', () => {
    state.materialDraft = [];
    renderMaterialDraft();
    if (materialPicker) {
      materialPicker.clear(true);
    }
  });
  if (materialPicker) {
    materialPicker.on('change', (value) => {
      if (value) {
        appendMaterial(String(value));
      }
    });
  }
  document.getElementById('saveRecordButton').addEventListener('click', saveCurrentRecord);
  document.getElementById('addRecordButton').addEventListener('click', addRecord);
  document.getElementById('deleteRecordButton').addEventListener('click', deleteRecord);
  document.getElementById('exportJsonButton').addEventListener('click', exportJson);
  document.getElementById('resetToastButton').addEventListener('click', () => clearToast(toast));

  if (state.records.length > 0) {
    state.selectedRecordId = [...state.records].sort(compareRecords)[0].character_id;
  }

  syncMaintenancePickers();
  renderList();
  fillForm();
}

function initCompPage(records) {
  const indices = createIndices(records);
  
  // Elements
  const compSearchInput = document.getElementById('compSearchInput');
  const levelCheckboxGroup = document.getElementById('levelCheckboxGroup');
  const compSummaryText = document.getElementById('compSummaryText');
  const compCharacterGroups = document.getElementById('compCharacterGroups');
  const selectedTeamList = document.getElementById('selectedTeamList');
  const teamMaterialsList = document.getElementById('teamMaterialsList');
  const analyzeTeamBtn = document.getElementById('analyzeTeamBtn');
  const clearTeamBtn = document.getElementById('clearTeamBtn');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // State
  let selectedTeamIds = [];
  try {
    selectedTeamIds = JSON.parse(localStorage.getItem('selectedTeamIds') || '[]');
  } catch (e) {
    selectedTeamIds = [];
  }
  // Sanity check: verify all ids exist in dataset
  selectedTeamIds = selectedTeamIds.filter(id => indices.byCharacterId.has(id));

  let checkedLevels = new Set();
  let searchKeyword = '';

  // Render Levels Checkboxes
  function renderLevelCheckboxes() {
    levelCheckboxGroup.innerHTML = '';
    const sortedLevels = Object.entries(LEVEL_LABELS)
      .map(([level, label]) => ({ level: Number(level), label }))
      .sort((a, b) => a.level - b.level);

    sortedLevels.forEach(({ level, label }) => {
      const checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'checkbox-badge';
      checkboxLabel.innerHTML = `
        <input type="checkbox" value="${level}" ${checkedLevels.has(level) ? 'checked' : ''}>
        <span class="checkbox-badge-label badge-${level}">${level}｜${label}</span>
      `;
      
      const input = checkboxLabel.querySelector('input');
      input.addEventListener('change', () => {
        if (input.checked) {
          checkedLevels.add(level);
        } else {
          checkedLevels.delete(level);
        }
        renderCharactersList();
      });
      levelCheckboxGroup.appendChild(checkboxLabel);
    });
  }

  // Calculate and Render Team Panel
  function renderTeamPanel() {
    // 1. Selected characters
    if (selectedTeamIds.length === 0) {
      selectedTeamList.innerHTML = '<div class="empty-state">尚未選取任何角色。</div>';
    } else {
      selectedTeamList.innerHTML = selectedTeamIds.map(id => {
        const record = indices.byCharacterId.get(id);
        if (!record) return '';
        return `
          <div class="team-member-card">
            <div class="team-member-info">
              <span class="badge badge-${record.level}" style="min-width: unset; padding: 2px 8px; font-size: 0.75rem;">${getLevelLabel(record.level)}</span>
              <span class="team-member-name">${escapeHtml(record.name)}</span>
            </div>
            <button class="team-member-remove" data-id="${escapeHtml(id)}" type="button" title="移出隊伍">&times;</button>
          </div>
        `;
      }).join('');

      // Add remove listeners
      selectedTeamList.querySelectorAll('.team-member-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          selectedTeamIds = selectedTeamIds.filter(x => x !== id);
          localStorage.setItem('selectedTeamIds', JSON.stringify(selectedTeamIds));
          renderTeamPanel();
          renderCharactersList(); // Update checkboxes in main list
        });
      });
    }

    // 2. Base materials
    const totalCounts = new Map();
    selectedTeamIds.forEach(id => {
      const record = indices.byCharacterId.get(id);
      if (record) {
        getBaseMaterialQuantities(record, indices, totalCounts);
      }
    });

    const level0Items = [];
    const level1Items = [];

    totalCounts.forEach((count, charId) => {
      const record = indices.byCharacterId.get(charId);
      const name = record ? record.name : charId;
      const lvl = record ? record.level : 0;
      const item = { id: charId, name, count, level: lvl };
      
      if (lvl === 1) {
        level1Items.push(item);
      } else if (lvl === 0) {
        level0Items.push(item);
      }
    });

    // Sort by name
    level1Items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    level0Items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

    if (level1Items.length === 0 && level0Items.length === 0) {
      teamMaterialsList.innerHTML = '<span class="muted">無</span>';
    } else {
      let html = '';
      if (level1Items.length > 0) {
        html += `
          <div class="materials-group">
            <h4 class="materials-subgroup-title" style="margin: 4px 0 8px; font-size: 0.85rem; color: #ffd28a;">角色材料 (常見)</h4>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${level1Items.map(item => `
                <div class="materials-item">
                  <span>${escapeHtml(item.name)}</span>
                  <span class="item-qty">x${item.count}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      if (level0Items.length > 0) {
        html += `
          <div class="materials-group" style="margin-top: 12px;">
            <h4 class="materials-subgroup-title" style="margin: 4px 0 8px; font-size: 0.85rem; color: #ffd28a;">特殊物品</h4>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${level0Items.map(item => `
                <div class="materials-item">
                  <span>${escapeHtml(item.name)}</span>
                  <span class="item-qty">x${item.count}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      teamMaterialsList.innerHTML = html;
    }
  }

  // Render Characters List Grouped by Level
  function renderCharactersList() {
    // Filter records
    const filteredRecords = indices.records.filter(record => {
      // 1. Level filter (if any levels checked)
      if (checkedLevels.size > 0 && !checkedLevels.has(record.level)) {
        return false;
      }
      // 2. Search keyword
      if (searchKeyword) {
        return getSearchableText(record, indices).includes(searchKeyword);
      }
      return true;
    });

    compSummaryText.textContent = `符合條件：${filteredRecords.length} / ${indices.records.length} 筆`;

    if (filteredRecords.length === 0) {
      compCharacterGroups.innerHTML = '<div class="empty-state">沒有符合條件的角色。</div>';
      return;
    }

    // Group by level
    const groups = new Map();
    filteredRecords.forEach(record => {
      if (!groups.has(record.level)) {
        groups.set(record.level, []);
      }
      groups.get(record.level).push(record);
    });

    // Sort group levels
    const sortedLevels = Array.from(groups.keys()).sort((a, b) => a - b);

    compCharacterGroups.innerHTML = sortedLevels.map(level => {
      const groupRecords = groups.get(level);
      const levelLabel = getLevelLabel(level);
      
      const cardsHtml = groupRecords.map(record => {
        const isSelected = selectedTeamIds.includes(record.character_id);
        const materialsText = record.materials && record.materials.length > 0
          ? record.materials.map(m => resolveRecordLabel(m.material_id, indices)).join(' + ')
          : '無';

        return `
          <div class="char-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(record.character_id)}">
            <div class="char-card-checkbox-wrapper">
              <input type="checkbox" class="char-card-checkbox" ${isSelected ? 'checked' : ''} data-id="${escapeHtml(record.character_id)}">
            </div>
            <div class="char-card-content">
              <div class="char-card-name-row">
                <span class="char-card-name">${escapeHtml(record.name)}</span>
                <span class="badge badge-${record.level}" style="min-width: unset; padding: 2px 8px; font-size: 0.72rem;">${escapeHtml(levelLabel)}</span>
              </div>
              <div class="char-card-materials" title="${escapeHtml(materialsText)}">
                材料：${escapeHtml(materialsText)}
              </div>
              ${record.remark ? `<div class="char-card-remark">${escapeHtml(record.remark)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <section class="char-group-section">
          <div class="char-group-header">
            <h3 class="char-group-title">
              <span class="badge badge-${level}" style="min-width: unset; padding: 4px 10px; font-size: 0.85rem;">${levelLabel}</span>
            </h3>
            <span class="char-group-count">${groupRecords.length} 個角色</span>
          </div>
          <div class="char-group-grid">
            ${cardsHtml}
          </div>
        </section>
      `;
    }).join('');

    // Add card toggle listeners
    compCharacterGroups.querySelectorAll('.char-card').forEach(card => {
      const id = card.dataset.id;
      
      const toggleSelect = () => {
        const index = selectedTeamIds.indexOf(id);
        if (index > -1) {
          selectedTeamIds.splice(index, 1);
        } else {
          selectedTeamIds.push(id);
        }
        localStorage.setItem('selectedTeamIds', JSON.stringify(selectedTeamIds));
        renderTeamPanel();
        
        // Toggle card selected class and checkbox checked state directly for fast feedback
        const checkbox = card.querySelector('.char-card-checkbox');
        const isSelectedNow = selectedTeamIds.includes(id);
        card.classList.toggle('selected', isSelectedNow);
        if (checkbox) checkbox.checked = isSelectedNow;
      };

      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('.char-card-checkbox-wrapper')) {
          // Checkbox change event is handled by checkbox click or card click
          return;
        }
        toggleSelect();
      });

      const checkbox = card.querySelector('.char-card-checkbox');
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          toggleSelect();
        });
      }
    });
  }

  // Attach search and buttons events
  compSearchInput.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim().toLowerCase();
    renderCharactersList();
  });

  resetFiltersBtn.addEventListener('click', () => {
    compSearchInput.value = '';
    searchKeyword = '';
    checkedLevels.clear();
    // Reset inputs visually
    levelCheckboxGroup.querySelectorAll('input').forEach(input => {
      input.checked = false;
    });
    renderCharactersList();
  });

  clearTeamBtn.addEventListener('click', () => {
    if (selectedTeamIds.length === 0) return;
    if (confirm('確定清空目前的隊伍嗎？')) {
      selectedTeamIds = [];
      localStorage.setItem('selectedTeamIds', JSON.stringify(selectedTeamIds));
      renderTeamPanel();
      renderCharactersList();
    }
  });

  analyzeTeamBtn.addEventListener('click', () => {
    if (selectedTeamIds.length === 0) {
      alert('請先在角色庫中選取角色加入隊伍！');
      return;
    }
    sessionStorage.setItem('selectedTeamIds', JSON.stringify(selectedTeamIds));
    window.location.href = 'comp_tree.html';
  });

  // Init
  renderLevelCheckboxes();
  renderTeamPanel();
  renderCharactersList();
}

function initCompTreePage(records) {
  const indices = createIndices(records);
  
  // Elements
  const compTreeTabs = document.getElementById('compTreeTabs');
  const compTreeEmptyState = document.getElementById('compTreeEmptyState');
  const compTreeContent = document.getElementById('compTreeContent');
  const compTreeResultTitle = document.getElementById('compTreeResultTitle');
  const compTreeRootSummary = document.getElementById('compTreeRootSummary');
  const compDownwardContainer = document.getElementById('compDownwardContainer');
  const compToggleUpwardButton = document.getElementById('compToggleUpwardButton');
  const compUpwardContainer = document.getElementById('compUpwardContainer');
  const compTreeTeamMaterials = document.getElementById('compTreeTeamMaterials');

  // State
  let selectedTeamIds = [];
  try {
    selectedTeamIds = JSON.parse(sessionStorage.getItem('selectedTeamIds') || '[]');
  } catch (e) {
    selectedTeamIds = [];
  }
  // Sanity check: verify all ids exist in dataset
  selectedTeamIds = selectedTeamIds.filter(id => indices.byCharacterId.has(id));

  if (selectedTeamIds.length === 0) {
    compTreeEmptyState.classList.remove('is-hidden');
    compTreeContent.classList.add('is-hidden');
    return;
  }

  compTreeEmptyState.classList.add('is-hidden');
  compTreeContent.classList.remove('is-hidden');

  // Calculate team total materials
  const totalCounts = new Map();
  selectedTeamIds.forEach(id => {
    const record = indices.byCharacterId.get(id);
    if (record) {
      getBaseMaterialQuantities(record, indices, totalCounts);
    }
  });

  const level0Items = [];
  const level1Items = [];

  totalCounts.forEach((count, charId) => {
    const record = indices.byCharacterId.get(charId);
    const name = record ? record.name : charId;
    const lvl = record ? record.level : 0;
    const item = { id: charId, name, count, level: lvl };
    
    if (lvl === 1) {
      level1Items.push(item);
    } else if (lvl === 0) {
      level0Items.push(item);
    }
  });

  level1Items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  level0Items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  function renderTeamTotalMaterials() {
    if (!compTreeTeamMaterials) return;
    if (level1Items.length === 0 && level0Items.length === 0) {
      compTreeTeamMaterials.innerHTML = '<div class="muted">無需求材料</div>';
      return;
    }

    const itemsHtml = [...level1Items, ...level0Items].map(item => `
      <div class="team-summary-material-item" style="border-left: 3px solid ${item.level === 1 ? 'var(--primary-color)' : 'var(--muted-color)'};">
        <span class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <span class="qty">x${item.count}</span>
      </div>
    `).join('');

    compTreeTeamMaterials.innerHTML = itemsHtml;
  }

  let activeIndex = 0;
  let currentlyViewedRecord = null;

  // Node card renderer (adapted)
  function renderCompNodeCard(record, options = {}) {
    const titleMarkup = options.navigateable
      ? `<button type="button" class="tree-node-action" data-navigate-character="${escapeHtml(record.character_id)}">${escapeHtml(record.name)}</button>`
      : `<strong>${escapeHtml(record.name)}</strong>`;

    return `
      <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
        <div class="node-title">
          <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
          ${titleMarkup}
          ${record.key_code ? '('+ record.key_code +')' : ''}
        </div>
        <div class="node-detail">
          <div>材料：${escapeHtml(getMaterialNames(record, indices).join('、') || '無')}</div>
        </div>
      </div>
    `;
  }

  // Downward branch recursive renderer (adapted)
  function renderCompDownwardBranch(record, trailCharacterIds, depth) {
    const nextTrail = new Set(trailCharacterIds);
    nextTrail.add(record.character_id);
    const materials = record.materials || [];

    if (materials.length === 0) {
      return `<li>${renderCompNodeCard(record)}</li>`;
    }

    const childrenMarkup = materials
      .map((material) => {
        const childRecord = getPrimaryRecord(material.material_id, indices);
        if (!childRecord) {
          return `<li><div class="node-card placeholder"><div class="node-title"><strong>${escapeHtml(material.material_id)}</strong></div><div class="node-detail">查無對應資料</div></div></li>`;
        }

        if (nextTrail.has(childRecord.character_id)) {
          return `<li>
            ${renderCompNodeCard(childRecord)}
            <div class="status-line">此節點與上層屬於同一角色 ID，已停止繼續展開避免循環。</div>
          </li>`;
        }

        return renderCompDownwardBranch(childRecord, nextTrail, depth + 1);
      })
      .join('');

    return `
      <li>
        <details class="branch-details">
          <summary class="branch-summary">
            ${renderCompNodeCard(record, { navigateable: true })}
            <span class="branch-toggle-hint">
              <img style="vertical-align: middle" width="25" height="25" src="resource/arrow_drop_down.svg" alt="點擊收合 / 展開">
            </span>
          </summary>
          <ul class="tree-list">${childrenMarkup}</ul>
        </details>
      </li>
    `;
  }

  // Upward section renderer (adapted)
  function renderCompUpwardSection(record) {
    const parents = indices.parentMap.get(record.character_id) || [];
    
    if (parents.length === 0) {
      compToggleUpwardButton.textContent = '此角色沒有上層';
      compToggleUpwardButton.disabled = true;
      compUpwardContainer.innerHTML = '<div class="empty-state">無上層角色</div>';
      return;
    }

    compToggleUpwardButton.disabled = false;
    compToggleUpwardButton.textContent = `顯示上層（${parents.length} 筆）`;
    compUpwardContainer.innerHTML = `
      <div class="upward-card">
        <h3><span>上層角色</span></h3>
        <ul class="upward-list">
          ${parents.map((parent) => `<li>${renderCompNodeCard(parent, { navigateable: true })}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Render tree function (adapted)
  function renderCompTree(record) {
    currentlyViewedRecord = record;
    compTreeResultTitle.textContent = `${record.name}｜${getLevelLabel(record.level)} | KR: ${escapeHtml(record.kr_name || '')} | EN: ${escapeHtml(record.en_name || '')}`;
    
    compTreeRootSummary.innerHTML = `
      <div class="tree-card" style="margin-bottom: 12px;">
        <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
            <div class="node-title">
              <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
              ${record.name} ${record.key_code ? '('+ record.key_code +')' : ''}
            </div>
            <div class="node-detail">
              <div>備註：${escapeHtml(record.remark || '無')}</div>
              <div>總材料：${escapeHtml(formatBaseMaterialsText(record, indices))}</div>
            </div>
        </div>
      </div>
    `;

    const directMaterials = record.materials || [];
    compDownwardContainer.innerHTML = `
      <div class="tree-card">
        ${directMaterials.length === 0
          ? '<div class="empty-state">這個角色沒有可往下的材料。</div>'
          : `<ul class="tree-list">${directMaterials
              .map((material) => {
                const childRecord = getPrimaryRecord(material.material_id, indices);
                if (!childRecord) {
                  return `<li><div class="node-card placeholder"><div class="node-title"><strong>${escapeHtml(material.material_id)}</strong></div><div class="node-detail">查無對應資料</div></div></li>`;
                }

                return renderCompDownwardBranch(childRecord, new Set([record.character_id]), 1);
              })
              .join('')}</ul>`}
      </div>
    `;
    if(compUpwardContainer){
      renderCompUpwardSection(record);
    }
  }

  // Render Tabs navigation
  function renderTabs() {
    compTreeTabs.innerHTML = selectedTeamIds.map((id, idx) => {
      const record = indices.byCharacterId.get(id);
      if (!record) return '';
      return `
        <button type="button" class="comp-tree-tab-btn ${idx === activeIndex ? 'active' : ''}" data-index="${idx}">
          <span class="badge badge-${record.level}" style="min-width: unset; padding: 2px 6px; font-size: 0.72rem;">${getLevelLabel(record.level)}</span>
          <span>${escapeHtml(record.name)}</span>
        </button>
      `;
    }).join('');

    // Attach listeners
    compTreeTabs.querySelectorAll('.comp-tree-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        activeIndex = idx;
        renderTabs();
        
        // Hide upward section on tab switch by default
        compUpwardContainer.classList.add('is-hidden');
        
        const activeRecord = indices.byCharacterId.get(selectedTeamIds[activeIndex]);
        if (activeRecord) {
          renderCompTree(activeRecord);
        }
      });
    });
  }

  // Synthesis tree node navigation
  function handleCompTreeNavigation(event) {
    const target = event.target.closest('[data-navigate-character]');
    if (!target) return;

    const record = indices.byCharacterId.get(target.dataset.navigateCharacter);
    if (!record) return;

    // Load clicked character tree, keeping active tab the same
    renderCompTree(record);
    compDownwardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if(compUpwardContainer){
    compUpwardContainer.addEventListener('click', handleCompTreeNavigation);
  }
  compDownwardContainer.addEventListener('click', handleCompTreeNavigation);

  // Upward Toggle
  if (compToggleUpwardButton) {
    compToggleUpwardButton.addEventListener('click', () => {
      compUpwardContainer.classList.toggle('is-hidden');
      compToggleUpwardButton.textContent = compUpwardContainer.classList.contains('is-hidden')
        ? compToggleUpwardButton.textContent.replace('隱藏', '顯示')
        : compToggleUpwardButton.textContent.replace('顯示', '隱藏');
    });
  }

  // Initial render
  renderTabs();
  renderTeamTotalMaterials();
  const firstRecord = indices.byCharacterId.get(selectedTeamIds[0]);
  if (firstRecord) {
    renderCompTree(firstRecord);
  }
}

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
  }

  showMaintenanceNav();
}

window.addEventListener('DOMContentLoaded', initApp);


function setCanMaintain(value) {
  localStorage.setItem('canMaintain', value ? 'true' : 'false');
}
function getIfCanMaintain() {
  const canMaintain = localStorage.getItem('canMaintain');
  return canMaintain === 'true';
}
function showMaintenanceNav(){
  if (!getIfCanMaintain()) {
    return;
  }
  const navLink = document.querySelector('.nav-link[data-page="maintenance"]');
  if (navLink) {
    navLink.style.display = 'block';
  }
}