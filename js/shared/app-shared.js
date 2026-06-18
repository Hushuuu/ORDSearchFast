(() => {
  const app = window.ORDApp || (window.ORDApp = {});

  const LEVEL_LABELS = {
    0: '物品',
    1: '常見',
    2: '不凡',
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
    16: '隨機',
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

    const levelCompare = String(left.character_id || '').localeCompare(
      String(right.character_id || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );

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
    return record ? record.name : characterId;
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

  // 遞迴往下拆解，僅把最基礎的素材累加起來，供合成樹與隊伍分析共用。
  function getBaseMaterialQuantities(record, indices, counts = new Map(), visited = new Set()) {
    if (!record) {
      return counts;
    }

    if (visited.has(record.character_id)) {
      return counts;
    }
    visited.add(record.character_id);

    if (record.level === 0 || record.level === 1) {
      const currentCount = counts.get(record.character_id) || 0;
      counts.set(record.character_id, currentCount + 1);
      visited.delete(record.character_id);
      return counts;
    }

    (record.materials || []).forEach((material) => {
      const childRecord = indices.byCharacterId.get(material.material_id);
      if (childRecord) {
        getBaseMaterialQuantities(childRecord, indices, counts, visited);
      } else {
        const currentCount = counts.get(material.material_id) || 0;
        counts.set(material.material_id, currentCount + 1);
      }
    });

    visited.delete(record.character_id);
    return counts;
  }

  function formatBaseMaterialsText(record, indices) {
    const countsMap = getBaseMaterialQuantities(record, indices);
    if (countsMap.size === 0) {
      return '無基礎材料';
    }

    const resultSegments = [];
    countsMap.forEach((count, characterId) => {
      const childRecord = indices.byCharacterId.get(characterId);
      const name = childRecord ? childRecord.name : characterId;
      resultSegments.push(`${name} * ${count}`);
    });

    return resultSegments.join(' + ');
  }

  function readStoredArray(storage, key) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeStoredArray(storage, key, values) {
    storage.setItem(key, JSON.stringify(values));
  }

  function getTeamMaterialGroups(selectedTeamIds, indices) {
    const totalCounts = new Map();
    selectedTeamIds.forEach((characterId) => {
      const record = indices.byCharacterId.get(characterId);
      if (record) {
        getBaseMaterialQuantities(record, indices, totalCounts);
      }
    });

    const level0Items = [];
    const level1Items = [];

    totalCounts.forEach((count, characterId) => {
      const record = indices.byCharacterId.get(characterId);
      const item = {
        id: characterId,
        name: record ? record.name : characterId,
        count,
        level: record ? record.level : 0
      };

      if (item.level === 1) {
        level1Items.push(item);
      } else if (item.level === 0) {
        level0Items.push(item);
      }
    });

    level1Items.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));
    level0Items.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));

    return { totalCounts, level0Items, level1Items };
  }

  function setCanMaintain(value) {
    localStorage.setItem('canMaintain', value ? 'true' : 'false');
  }

  function getIfCanMaintain() {
    return localStorage.getItem('canMaintain') === 'true';
  }

  function showMaintenanceNav() {
    if (!getIfCanMaintain()) {
      return;
    }

    const navLink = document.querySelector('.nav-link[data-page="maintenance"]');
    if (navLink) {
      navLink.style.display = 'block';
    }
  }

  Object.assign(app, {
    LEVEL_LABELS,
    cloneData,
    normalizeText,
    escapeHtml,
    compareRecords,
    getLevelLabel,
    createIndices,
    getPrimaryRecord,
    resolveRecordLabel,
    getMaterialNames,
    getSearchableText,
    fillLevelSelect,
    markActiveNav,
    showToast,
    clearToast,
    downloadTextFile,
    readQueryParam,
    createTomSelectOptions,
    createTomSelectRenderConfig,
    getBaseMaterialQuantities,
    formatBaseMaterialsText,
    readStoredArray,
    writeStoredArray,
    getTeamMaterialGroups,
    setCanMaintain,
    getIfCanMaintain,
    showMaintenanceNav
  });

  // 保留舊的全域入口，避免既有書籤或手動 console 操作失效。
  window.setCanMaintain = setCanMaintain;
  window.getIfCanMaintain = getIfCanMaintain;
})();
