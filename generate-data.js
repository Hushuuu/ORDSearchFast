const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const sourcePath = path.join(rootDir, 'ord_recipes_normalized_tw.json');
const outputJsonPath = path.join(rootDir, 'ord_data_structured.json');
const outputJsPath = path.join(rootDir, 'ord_data.js');

const levelLabels = {
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
  18: '神秘',
  0: '素材/別名'
};

const manualAliasMap = {
  '巴奇': '巴其',
  '克洛克達爾[限制級]': '克洛克達爾',
  '凱薩': '凱薩·庫朗',
  '시저': '凱薩·庫朗',
  '黃猿': '波魯薩利諾',
  '赤犬': '薩卡斯基',
  '青雉': '庫贊 青雉',
  '아오키지': '庫贊 青雉',
  '龍': '蒙其·D·多拉格',
  '龍 (多拉格)': '蒙其·D·多拉格',
  '羅白路奇': '羅布·路基',
  '羅伯·路奇': '羅布·路基',
  '羅賓': '妮可·羅賓',
  '로빈': '妮可·羅賓',
  '羅賓奧哈拉': '妮可·羅賓 歐哈拉的惡魔',
  '로빈 오하라': '妮可·羅賓 歐哈拉的惡魔',
  '芭蕾咪5': 'Baby5',
  '帕拉戴斯5': 'Baby5',
  '巴索羅米·熊': '巴索羅繆·大熊',
  '大熊暴君': '巴索羅繆·大熊',
  '쿠마 폭군': '巴索羅繆·大熊',
  '巴特洛馬': '巴托洛米奧',
  '基德 船長': '尤斯塔斯·基德 船長',
  '캡틴 키드': '尤斯塔斯·基德 船長',
  '狙擊王': '狙擊王騙人布',
  '蕾玖': '文斯莫克·蕾玖',
  '馮克雷': '馮·克雷',
  '馮·克雷 Mr.2': '馮·克雷',
  '馬可 不死鳥': '馬可',
  '馬可不死鳥': '馬可',
  '馬可幻獸種不死鳥': '馬可',
  '馬可 환수종不死鳥': '馬可',
  '魯夫三檔': '魯夫 三檔 超新星',
  '魯夫惡夢': '魯夫 夢魘',
  '魯夫 나이트메어': '魯夫 夢魘',
  '阿布薩羅姆 透明人': '阿布薩羅姆',
  '吉貝爾 七武海': '吉貝爾',
  '稻草人': '巴吉魯·霍金斯 稻草人',
  '拉布': '鯨魚拉布',
  '捷風': '捷風 (Z) 澤法',
  '加洛特斯隆': '加洛特斯隆型態',
  '海賊合體5號 거대 로봇 전사': '海賊合體5號',
  '파이러츠도킹5': '海賊合體5號',
  '培羅娜幽靈公主': '培羅娜 幽靈公主',
  '培羅娜 고스트프린세스': '培羅娜 幽靈公主',
  '培羅娜高樹公主': '培羅娜 幽靈公主',
  '벤베크만': '本·貝克曼',
  '雨之希留': '雨之希留 隱藏',
  '香吉士 黑足': '香吉士',
  'S-熊': 'S - 베어',
  'S-鯊': 'S - 샤크',
  'S-蛇': 'S - 스네이크',
  'S-鷹': 'S - 호크'
};

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[·．\.\-–—_]/g, '')
    .replace(/[\s'"]/g, '')
    .replace(/[()（）\[\]【】]/g, '')
    .replace(/[+,，、/]/g, '')
    .trim();
}

function containsHangul(value) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(String(value || ''));
}

function compareByLevelThenName(left, right) {
  if (left.level !== right.level) {
    return left.level - right.level;
  }

  return left.name.localeCompare(right.name, 'zh-Hant');
}

function getRecordStrength(record) {
  return {
    materialCount: (record.materials || []).length,
    specLength: String(record.spec || '').trim().length,
    hasKorean: Boolean(String(record.korean || '').trim())
  };
}

function choosePreferredRecord(current, candidate) {
  const currentLevel = Number(current.level || 0);
  const candidateLevel = Number(candidate.level || 0);

  if (candidateLevel !== currentLevel) {
    return candidateLevel < currentLevel ? candidate : current;
  }

  const currentStrength = getRecordStrength(current);
  const candidateStrength = getRecordStrength(candidate);

  if (candidateStrength.materialCount !== currentStrength.materialCount) {
    return candidateStrength.materialCount > currentStrength.materialCount ? candidate : current;
  }

  if (candidateStrength.specLength !== currentStrength.specLength) {
    return candidateStrength.specLength > currentStrength.specLength ? candidate : current;
  }

  if (candidateStrength.hasKorean !== currentStrength.hasKorean) {
    return candidateStrength.hasKorean ? candidate : current;
  }

  return current;
}

const sourceRecords = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const dedupedRecordsByName = new Map();
let removedDuplicateCount = 0;

sourceRecords.forEach((record) => {
  const key = record.name.trim();
  const current = dedupedRecordsByName.get(key);

  if (!current) {
    dedupedRecordsByName.set(key, record);
    return;
  }

  const preferred = choosePreferredRecord(current, record);
  if (preferred !== current) {
    dedupedRecordsByName.set(key, preferred);
  }
  removedDuplicateCount += 1;
});

const uniqueSourceRecords = [...dedupedRecordsByName.values()];

const characterGroups = new Map();

uniqueSourceRecords.forEach((record, index) => {
  const key = record.name.trim();
  const level = Number(record.level || 0);
  characterGroups.set(key, {
    name: key,
    firstLevel: level,
    firstIndex: index
  });
});

const groupedByLevel = new Map();

[...characterGroups.values()]
  .sort((left, right) => {
    if (left.firstLevel !== right.firstLevel) {
      return left.firstLevel - right.firstLevel;
    }

    return left.name.localeCompare(right.name, 'zh-Hant');
  })
  .forEach((entry) => {
    if (!groupedByLevel.has(entry.firstLevel)) {
      groupedByLevel.set(entry.firstLevel, []);
    }

    groupedByLevel.get(entry.firstLevel).push(entry);
  });

const characterIdByName = new Map();

[...groupedByLevel.entries()]
  .sort((left, right) => left[0] - right[0])
  .forEach(([level, entries]) => {
    entries.forEach((entry, index) => {
      characterIdByName.set(entry.name, `${level}-${index + 1}`);
    });
  });

const aliasIndex = new Map();

function registerAlias(alias, characterId) {
  const normalized = normalizeName(alias);
  if (!normalized) {
    return;
  }

  if (!aliasIndex.has(normalized)) {
    aliasIndex.set(normalized, characterId);
  }
}

uniqueSourceRecords.forEach((record) => {
  const characterId = characterIdByName.get(record.name.trim());
  registerAlias(record.name, characterId);
  registerAlias(record.korean, characterId);
  registerAlias(record.base, characterId);
});

Object.entries(manualAliasMap).forEach(([alias, targetName]) => {
  const targetId = characterIdByName.get(targetName);
  if (targetId) {
    registerAlias(alias, targetId);
  }
});

const placeholders = new Map();
let placeholderSequence = 1;

function getOrCreatePlaceholderId(aliasName) {
  const normalized = normalizeName(aliasName);
  if (placeholders.has(normalized)) {
    return placeholders.get(normalized).character_id;
  }

  const characterId = `0-${placeholderSequence++}`;
  const placeholderRecord = {
    character_id: characterId,
    level: 0,
    name: aliasName,
    kr_name: containsHangul(aliasName) ? aliasName : '',
    en_name: '',
    materials: [],
    key_code: '',
    remark: '',
    major: '',
    suitable_partners: []
  };

  placeholders.set(normalized, placeholderRecord);
  registerAlias(aliasName, characterId);
  return characterId;
}

function resolveCharacterId(name) {
  const normalized = normalizeName(name);
  if (aliasIndex.has(normalized)) {
    return aliasIndex.get(normalized);
  }

  return getOrCreatePlaceholderId(name.trim());
}

const transformedRecords = uniqueSourceRecords.map((record) => ({
  character_id: characterIdByName.get(record.name.trim()),
  level: Number(record.level || 0),
  name: record.name || '',
  kr_name: record.korean || '',
  en_name: '',
  materials: (record.materials || []).map((materialName) => ({
    material_id: resolveCharacterId(materialName)
  })),
  key_code: '',
  remark: '',
  major: '',
  suitable_partners: []
}));

const allRecords = [...transformedRecords, ...placeholders.values()]
  .sort(compareByLevelThenName)
  .map((record) => ({
    ...record,
    materials: record.materials.map((material) => ({ material_id: material.material_id })),
    suitable_partners: record.suitable_partners.map((partner) => ({ character_id: partner.character_id }))
  }));

fs.writeFileSync(outputJsonPath, `${JSON.stringify(allRecords, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  outputJsPath,
  `window.ORD_DATA = ${JSON.stringify(allRecords, null, 2)};\n`,
  'utf8'
);

console.log(
  JSON.stringify(
    {
      sourceRecords: sourceRecords.length,
      uniqueSourceRecords: uniqueSourceRecords.length,
      removedDuplicates: removedDuplicateCount,
      outputRecords: allRecords.length,
      placeholders: [...placeholders.values()].length
    },
    null,
    2
  )
);
