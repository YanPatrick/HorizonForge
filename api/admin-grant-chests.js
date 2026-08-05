/**
 * Script de uso único para conceder baús a jogadores que pagaram mas não receberam itens.
 * Usa a mesma lógica exata do openChest() em server.js.
 *
 * Uso:
 *   node api/admin-grant-chests.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// ── Tabelas de configuração (espelho de server.js) ────────────────────────────

const CHEST_RARITY_ROLL = [
  { rarity: 'common',    max: 40  },
  { rarity: 'uncommon',  max: 70  },
  { rarity: 'rare',      max: 90  },
  { rarity: 'epic',      max: 98  },
  { rarity: 'legendary', max: 100 },
];

const CHEST_STAT_CFG = {
  common:    { count: 1, req_count: 0, atk: [3,10],  hp: [30,80],   spd: [0,1],   neg: { atk:-5,  hp:-30,  spd:-0.5 } },
  uncommon:  { count: 1, req_count: 1, atk: [8,18],  hp: [60,150],  spd: [1,2],   neg: { atk:-8,  hp:-50,  spd:-1.0 } },
  rare:      { count: 2, req_count: 1, atk: [15,28], hp: [130,250], spd: [2,3],   neg: { atk:-12, hp:-80,  spd:-1.5 } },
  epic:      { count: 2, req_count: 2, atk: [25,38], hp: [240,380], spd: [3,4],   neg: { atk:-18, hp:-120, spd:-2.0 } },
  legendary: { count: 3, req_count: 2, atk: [35,50], hp: [360,550], spd: [4,5],   neg: { atk:-25, hp:-180, spd:-2.5 } },
};

const VETERAN_REQ_VALUE = { uncommon: 10, rare: 13, epic: 16, legendary: 20 };

const CHEST_PREFIXES   = ['Ancient','Cursed','Divine','Shadow','Burning','Frozen','Runed','Spectral','Wicked','Sacred'];
const CHEST_SUFFIXES   = ['of Ruin','of the Fallen','of Chaos','of Dawn','of Shadows','of the Void','of Eternity','of Power'];
const CHEST_SLOT_WORDS = {
  amulet:'Amulet', helm:'Helm', weapon:'Blade', chest:'Cuirass',
  offhand:'Shield', belt:'Belt', legs:'Greaves', gloves:'Gauntlets',
  ring1:'Ring', ring2:'Ring', boots:'Boots', special:'Relic',
};
const CHAOS_ATTR_POOL = ['str','dex','con','int','wis','cha'];

// ── Funções geradoras (espelho de server.js) ──────────────────────────────────

function _rollRarity(table = CHEST_RARITY_ROLL) {
  const r = Math.random() * 100;
  return table.find(x => r < x.max).rarity;
}

function _scaleByD20(min, max, d20) {
  return min + (d20 / 20) * (max - min);
}

function _rollVeteranStats(rarity, d20) {
  const cfg  = CHEST_STAT_CFG[rarity];
  const keys = ['atk','hp','spd'].sort(() => Math.random() - 0.5).slice(0, cfg.count);
  const out  = { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
  for (const k of keys) {
    const [mn, mx] = cfg[k];
    const raw = _scaleByD20(mn, mx, d20);
    if (k === 'spd') out.spd_bonus = parseFloat(Math.min(raw, mx).toFixed(2));
    else if (k === 'atk') out.atk_bonus = Math.min(Math.round(raw), mx);
    else out.hp_bonus = Math.min(Math.round(raw), mx);
  }
  return out;
}

function _rollCriticalFail(rarity) {
  const cfg  = CHEST_STAT_CFG[rarity];
  const keys = ['atk','hp','spd'].sort(() => Math.random() - 0.5).slice(0, cfg.count);
  const out  = { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
  for (const k of keys) {
    const negFloor = cfg.neg[k];
    const posMax   = cfg[k][0];
    const raw      = negFloor + Math.random() * (posMax - negFloor);
    if (k === 'spd') out.spd_bonus = parseFloat(raw.toFixed(2));
    else if (k === 'atk') out.atk_bonus = Math.round(raw);
    else out.hp_bonus = Math.round(raw);
  }
  return out;
}

function _pickReqs(rarity, d20, chestType) {
  const reqCount = CHEST_STAT_CFG[rarity].req_count;
  if (reqCount === 0) return { reqAttr: null, reqValue: null, reqAttr2: null, reqValue2: null };

  const attrs    = [...CHAOS_ATTR_POOL].sort(() => Math.random() - 0.5);
  const reqAttr  = attrs[0];
  const reqAttr2 = reqCount >= 2 ? attrs[1] : null;

  let reqValue, reqValue2 = null;
  if (chestType === 'chaos_chest') {
    reqValue  = Math.round(20 - (d20 / 20) * 10);
    if (reqCount >= 2) reqValue2 = Math.round(20 - (d20 / 20) * 10);
  } else {
    reqValue  = VETERAN_REQ_VALUE[rarity] || 12;
    if (reqCount >= 2) reqValue2 = reqValue;
  }

  return { reqAttr, reqValue, reqAttr2, reqValue2 };
}

function _rollName(slot) {
  const p = CHEST_PREFIXES[Math.floor(Math.random() * CHEST_PREFIXES.length)];
  const s = CHEST_SUFFIXES[Math.floor(Math.random() * CHEST_SUFFIXES.length)];
  return `${p} ${CHEST_SLOT_WORDS[slot] || 'Item'} ${s}`;
}

function _randomSlot() {
  const slots = Object.keys(CHEST_SLOT_WORDS);
  return slots[Math.floor(Math.random() * slots.length)];
}

function _generateChestItem(chestType) {
  const rarity  = _rollRarity();
  const slot    = _randomSlot();
  const name    = _rollName(slot);
  const d20     = Math.floor(Math.random() * 20) + 1;
  const desc    = 'Motor of Chaos — Veteran Chest';

  let stats, flavorText = null;
  if (d20 === 1) {
    stats = _rollCriticalFail(rarity);
  } else {
    stats = _rollVeteranStats(rarity, d20);
  }

  const { reqAttr, reqValue, reqAttr2, reqValue2 } = _pickReqs(rarity, d20, chestType);
  return { name, desc, rarity, slot, d20, stats, reqAttr, reqValue, reqAttr2, reqValue2, flavorText };
}

async function openChest(username, chestType) {
  const { name, desc, rarity, slot, d20, stats, reqAttr, reqValue, reqAttr2, reqValue2, flavorText } = _generateChestItem(chestType);
  const [item] = await sql`
    INSERT INTO items (name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus,
                       source, d20_roll, req_attr, req_value, req_attr2, req_value2, flavor_text)
    VALUES (${name}, ${desc}, ${rarity}, ${slot},
            ${stats.atk_bonus}, ${stats.hp_bonus}, ${stats.spd_bonus},
            ${'chest'}, ${d20}, ${reqAttr}, ${reqValue}, ${reqAttr2}, ${reqValue2}, ${flavorText})
    RETURNING *
  `;
  await sql`
    INSERT INTO player_items (player, item_id, source)
    VALUES (${username}, ${item.id}, ${'chest'})
    ON CONFLICT DO NOTHING
  `;
  const reqLog = [reqAttr && `${reqAttr}>=${reqValue}`, reqAttr2 && `${reqAttr2}>=${reqValue2}`].filter(Boolean).join(' ');
  console.log(`🎲 ${username} → "${name}" (${rarity}) D20=${d20} atk${stats.atk_bonus>=0?'+':''}${stats.atk_bonus} hp${stats.hp_bonus>=0?'+':''}${stats.hp_bonus} spd${stats.spd_bonus>=0?'+':''}${stats.spd_bonus}${reqLog ? ` req:${reqLog}` : ''}`);
  return item;
}

// ── Execução ──────────────────────────────────────────────────────────────────

const GRANTS = [
  { username: 'kennybot',  chestType: 'treasure_chest', count: 2 },
  { username: 'dreloop07', chestType: 'treasure_chest', count: 1 },
];

async function main() {
  console.log('Admin grant — gerando baús para jogadores com pagamento não processado\n');

  for (const { username, chestType, count } of GRANTS) {
    console.log(`▸ ${username} (${count}x ${chestType})`);
    for (let i = 0; i < count; i++) {
      await openChest(username, chestType);
    }
  }

  console.log('\n✅ Concluído. Verifique player_items no banco.');
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
