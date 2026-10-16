'use strict';

const { randomInt } = require('node:crypto');

const CATALOG = Object.freeze([
  Object.freeze({
    id: 'protect_ally',
    variants: Object.freeze([
      Object.freeze({
        id: 'protect_ally_exposed_v1',
        prompt: 'An enemy will strike an exposed ally before your next turn. Your guard skill is ready.',
        state: Object.freeze({ ally: 'exposed', guardSkill: 'ready', nextTarget: 'ally' }),
        correctActionId: 'PROTECT_ALLY',
        options: Object.freeze([
          ['PROTECT_ALLY', 'Cover the ally'],
          ['ATTACK_DISTANT_THREAT', 'Attack a distant enemy'],
          ['EVADE_ATTACK', 'Evade your own position']
        ])
      }),
      Object.freeze({
        id: 'protect_ally_safe_v2',
        prompt: 'The ally is already behind cover; an enemy has marked you for an immediate attack.',
        state: Object.freeze({ ally: 'safe', player: 'marked', nextTarget: 'player' }),
        correctActionId: 'EVADE_ATTACK',
        options: Object.freeze([
          ['PROTECT_ALLY', 'Move to cover the ally'],
          ['ATTACK_DISTANT_THREAT', 'Attack a distant enemy'],
          ['EVADE_ATTACK', 'Evade the marked attack']
        ])
      })
    ])
  }),
  Object.freeze({
    id: 'interrupt_charge',
    variants: Object.freeze([
      Object.freeze({
        id: 'interrupt_charge_ready_v1',
        prompt: 'A charging enemy will hit the group. Your interrupt is ready.',
        state: Object.freeze({ enemy: 'charging', interrupt: 'ready', dodge: 'ready' }),
        correctActionId: 'INTERRUPT_CHARGE',
        options: Object.freeze([
          ['BLOCK_IMPACT', 'Brace for impact'],
          ['INTERRUPT_CHARGE', 'Interrupt the charge'],
          ['DODGE_CHARGE', 'Dodge the charge']
        ])
      }),
      Object.freeze({
        id: 'interrupt_charge_cooldown_v2',
        prompt: 'A charging enemy will hit the group. Your interrupt is on cooldown, but you can dodge.',
        state: Object.freeze({ enemy: 'charging', interrupt: 'cooldown', dodge: 'ready' }),
        correctActionId: 'DODGE_CHARGE',
        options: Object.freeze([
          ['BLOCK_IMPACT', 'Brace for impact'],
          ['INTERRUPT_CHARGE', 'Attempt the unavailable interrupt'],
          ['DODGE_CHARGE', 'Dodge the charge']
        ])
      })
    ])
  }),
  Object.freeze({
    id: 'support_priority',
    variants: Object.freeze([
      Object.freeze({
        id: 'support_critical_ally_v1',
        prompt: 'An ally is critically wounded. Your healing skill is available and no attack is imminent.',
        state: Object.freeze({ ally: 'critical', healing: 'ready', enemy: 'idle' }),
        correctActionId: 'HEAL_ALLY',
        options: Object.freeze([
          ['HEAL_ALLY', 'Heal the ally'],
          ['ATTACK_MARKED_TARGET', 'Attack the marked target'],
          ['USE_SELF_POTION', 'Use a potion on yourself']
        ])
      }),
      Object.freeze({
        id: 'support_channeling_enemy_v2',
        prompt: 'Your ally is stable. An enemy is channeling a group attack, and your interrupt is ready.',
        state: Object.freeze({ ally: 'stable', healing: 'ready', enemy: 'channeling', interrupt: 'ready' }),
        correctActionId: 'INTERRUPT_CHANNEL',
        options: Object.freeze([
          ['HEAL_ALLY', 'Spend the healing skill on a stable ally'],
          ['ATTACK_MARKED_TARGET', 'Attack the marked target'],
          ['INTERRUPT_CHANNEL', 'Interrupt the group attack']
        ])
      })
    ])
  }),
  Object.freeze({
    id: 'resolve_trap',
    variants: Object.freeze([
      Object.freeze({
        id: 'resolve_armed_trap_v1',
        prompt: 'An armed trap blocks the only safe route. Your disarm kit is available.',
        state: Object.freeze({ trap: 'armed', disarmKit: 'ready', safeRoute: 'blocked' }),
        correctActionId: 'DISARM_TRAP',
        options: Object.freeze([
          ['RUSH_AHEAD', 'Rush through the trap'],
          ['DISARM_TRAP', 'Inspect and disarm it'],
          ['CLAIM_REWARD', 'Claim a reward before proceeding']
        ])
      }),
      Object.freeze({
        id: 'resolve_decoy_trap_v2',
        prompt: 'The visible mechanism is a decoy. A marked stable route is available; the side path is unstable.',
        state: Object.freeze({ trap: 'decoy', safeRoute: 'marked', sidePath: 'unstable' }),
        correctActionId: 'TAKE_MARKED_ROUTE',
        options: Object.freeze([
          ['DISARM_TRAP', 'Spend time disarming the decoy'],
          ['TAKE_MARKED_ROUTE', 'Use the marked stable route'],
          ['TAKE_SIDE_PATH', 'Take the unverified side path']
        ])
      })
    ])
  }),
  Object.freeze({
    id: 'secure_and_extract',
    variants: Object.freeze([
      Object.freeze({
        id: 'extract_wounded_party_v1',
        prompt: 'The objective is secured, the extraction point is safe, and the party is wounded.',
        state: Object.freeze({ objective: 'secured', extraction: 'safe', party: 'wounded' }),
        correctActionId: 'EXTRACT_WITH_OBJECTIVE',
        options: Object.freeze([
          ['LOOT_OPTIONAL_CACHE', 'Search an optional cache'],
          ['EXTRACT_WITH_OBJECTIVE', 'Extract with the objective'],
          ['PURSUE_EXTRA_ENEMY', 'Pursue another enemy']
        ])
      }),
      Object.freeze({
        id: 'secure_evidence_first_v2',
        prompt: 'The objective is secured, but extraction is locked until the evidence is recorded.',
        state: Object.freeze({ objective: 'secured', extraction: 'locked', evidence: 'unrecorded' }),
        correctActionId: 'RECORD_EVIDENCE',
        options: Object.freeze([
          ['RESTART_TRAINING', 'Restart the training'],
          ['EXTRACT_WITH_OBJECTIVE', 'Attempt the locked extraction'],
          ['RECORD_EVIDENCE', 'Record the evidence to unlock extraction']
        ])
      })
    ])
  })
]);

function secureRandomIndex(length) {
  if (!Number.isInteger(length) || length < 1) throw new RangeError('length must be positive');
  return randomInt(length);
}

function shuffle(values, pickIndex = secureRandomIndex) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = pickIndex(index + 1);
    if (!Number.isInteger(other) || other < 0 || other > index) {
      throw new RangeError('random index is outside the requested range');
    }
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function createSessionChallenges({ pickIndex = secureRandomIndex } = {}) {
  return CATALOG.map((entry, index) => {
    const variant = entry.variants[pickIndex(entry.variants.length)];
    if (!variant) throw new RangeError('variant index is outside the catalog');
    const options = shuffle(variant.options.map(([id, label]) => ({ id, label })), pickIndex);
    return Object.freeze({
      ordinal: index + 1,
      familyId: entry.id,
      variantId: variant.id,
      prompt: variant.prompt,
      state: variant.state,
      correctActionId: variant.correctActionId,
      options: Object.freeze(options)
    });
  });
}

module.exports = { CATALOG, createSessionChallenges, shuffle };
