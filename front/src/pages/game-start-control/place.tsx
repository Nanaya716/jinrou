import * as React from 'react';
import { runInAction } from 'mobx';

import { CastingStore } from './store';
import { Casting } from './component';
import {
  CastingDefinition,
  LabeledGroup,
  RoleCategoryDefinition,
  RuleGroup,
} from '../../defs';
import { i18n } from '../../i18n';
import { findLabeledGroupItem } from '../../util/labeled-group';
import { mountReact } from '../../util/react-root';

/**
 * Key of local storage to temporally save rule.
 */
const localStorageRuleKey = 'lastSavedRule';
const draftStorageKeyPrefix = 'jinrou-gamestart-draft:';
const draftIndexStorageKey = 'jinrou-gamestart-draft-index';
const maxDraftCount = 5;

/**
 * Options to place.
 */
export interface IPlaceOptions {
  /**
   * i18n instance to use.
   */
  i18n: i18n;
  /**
   * Room id.
   */
  roomid: number | string;
  /**
   * A node to place the component to.
   */
  node: HTMLElement;
  /**
   * Id of roles.
   */
  roles: string[];
  /**
   * Definition of castings.
   */
  castings: LabeledGroup<CastingDefinition, string>;
  /**
   * Definition of categories.
   */
  categories: RoleCategoryDefinition[];
  /**
   * Definition of rules.
   */
  rules: RuleGroup;
  /**
   * Initial selection of casting.
   */
  initialCasting: CastingDefinition;
  /**
   * Event of pressing gamestart button.
   */
  onStart: (query: Record<string, string>) => void;
}
export interface IPlaceResult {
  store: CastingStore;
  unmount(): void;
}

interface DraftEntry {
  version: 1;
  roomid: string;
  updatedAt: number;
  rule: string;
}

function draftStorageKey(roomid: string): string {
  return `${draftStorageKeyPrefix}${roomid}`;
}

function loadDraftIndex(): Record<string, number> {
  try {
    const raw = localStorage.getItem(draftIndexStorageKey);
    if (raw == null) {
      return {};
    }
    const parsed = JSON.parse(raw);
    const result: Record<string, number> = {};
    for (const roomid in parsed) {
      if (typeof parsed[roomid] === 'number') {
        result[roomid] = parsed[roomid];
      }
    }
    return result;
  } catch {
    return {};
  }
}

function saveDraftIndex(index: Record<string, number>): void {
  try {
    localStorage.setItem(draftIndexStorageKey, JSON.stringify(index));
  } catch {
    // Ignore storage errors.
  }
}

function pruneDrafts(index: Record<string, number>): void {
  const entries = Object.entries(index).sort((a, b) => b[1] - a[1]);
  for (const [roomid] of entries.slice(maxDraftCount)) {
    try {
      localStorage.removeItem(draftStorageKey(roomid));
    } catch {
      // Ignore storage errors.
    }
    delete index[roomid];
  }
  saveDraftIndex(index);
}

function loadDraft(roomid: string): string | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(roomid));
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<DraftEntry>;
    if (
      parsed.version !== 1 ||
      parsed.roomid !== roomid ||
      typeof parsed.rule !== 'string'
    ) {
      removeDraft(roomid);
      return null;
    }
    return parsed.rule;
  } catch {
    removeDraft(roomid);
    return null;
  }
}

function saveDraft(roomid: string, rule: string): void {
  const updatedAt = Date.now();
  const draft: DraftEntry = {
    version: 1,
    roomid,
    updatedAt,
    rule,
  };
  try {
    localStorage.setItem(draftStorageKey(roomid), JSON.stringify(draft));
  } catch {
    // Ignore storage errors.
    return;
  }
  const index = loadDraftIndex();
  index[roomid] = updatedAt;
  pruneDrafts(index);
}

function removeDraft(roomid: string): void {
  try {
    localStorage.removeItem(draftStorageKey(roomid));
  } catch {
    // Ignore storage errors.
  }
  const index = loadDraftIndex();
  delete index[roomid];
  saveDraftIndex(index);
}

/**
 * Place a game start control component.
 * @returns Unmount point with newly created store.
 */
export function place({
  i18n,
  roomid,
  node,
  roles,
  castings,
  categories,
  rules,
  initialCasting,
  onStart,
}: IPlaceOptions): IPlaceResult {
  const roomKey = String(roomid);
  const store = new CastingStore(roles, categories, initialCasting);
  let draftDirty = false;
  runInAction(() => {
    store.setCurrentCasting(initialCasting);
    setInitialRules(rules, store);
    const draft = loadDraft(roomKey);
    if (draft != null) {
      store.loadSerializedRule(
        draft,
        castingId => findCastingDefinition(castings, castingId) || null,
      );
    } else if ('string' === typeof localStorage[localStorageRuleKey]) {
      // 兼容旧 key；读取后迁移到房间级草稿。
      store.loadSerializedRule(
        localStorage[localStorageRuleKey],
        castingId => findCastingDefinition(castings, castingId) || null,
      );
      localStorage.removeItem(localStorageRuleKey);
      saveDraft(roomKey, store.serializedRule);
    } else {
      if (loadSavedRules(castings, categories, roles, store)) {
        saveDraft(roomKey, store.serializedRule);
      }
    }
  });

  // XXX ad-hoc but exclude hidden roles.
  const cs = excludeHiddenRoles(categories, roles);

  const saveCurrentDraft = () => {
    draftDirty = true;
    saveDraft(roomKey, store.serializedRule);
  };

  // Set unload event as a fallback. Normal saves are triggered by user edits.
  const unloadHandler = () => {
    if (draftDirty) {
      saveDraft(roomKey, store.serializedRule);
    }
  };
  window.addEventListener('unload', unloadHandler);

  // make start handler.
  const startHandler = (query: Record<string, string>) => {
    window.removeEventListener('unload', unloadHandler);
    onStart(query);
  };

  const com = (
    <Casting
      i18n={i18n}
      store={store}
      roles={roles}
      castings={castings}
      categories={cs}
      allCategories={categories}
      ruledefs={rules}
      onStart={startHandler}
      onDraftSave={saveCurrentDraft}
    />
  );

  const root = mountReact(node, com);

  return {
    store,
    unmount: () => {
      window.removeEventListener('unload', unloadHandler);
      if (!store.consumed) {
        // component is unmounted but game was not started.
        unloadHandler();
      } else {
        removeDraft(roomKey);
      }
      root.unmount();
    },
  };
}

/**
 * Filter out hidden roles from categories.
 */
function excludeHiddenRoles(
  categories: RoleCategoryDefinition[],
  roles: string[],
): RoleCategoryDefinition[] {
  // rolesをsetに変換
  const rolesSet = new Set(roles);
  const result: RoleCategoryDefinition[] = [];
  for (const { id, roles } of categories) {
    const r = roles.filter(x => rolesSet.has(x));
    if (r.length > 0) {
      result.push({
        id,
        roles: r,
      });
    }
  }
  return result;
}

/**
 * Set initial rule settings to store.
 */
function setInitialRules(rules: RuleGroup, store: CastingStore): void {
  for (const rule of rules) {
    if (rule.type === 'group') {
      setInitialRules(rule.items, store);
    } else {
      const { value } = rule;
      switch (value.type) {
        case 'checkbox': {
          const v = value.defaultChecked ? value.value : '';
          store.updateRule(value.id, v, true);
          break;
        }
        case 'hidden': {
          store.updateRule(value.id, value.value, true);
          break;
        }
        case 'integer': {
          store.updateRule(value.id, String(value.defaultValue), true);
          break;
        }
        case 'select': {
          store.updateRule(value.id, value.defaultValue, true);
          break;
        }
        case 'time': {
          store.updateRule(value.id, String(value.defaultValue), true);
          break;
        }
      }
    }
  }
}

/**
 * Load saved rule settings.
 * @param roles provided list of roles.
 * @param store Rule store.
 */
function loadSavedRules(
  castings: LabeledGroup<CastingDefinition, string>,
  categories: RoleCategoryDefinition[],
  roles: string[],
  store: CastingStore,
): boolean {
  const { savedRule } = localStorage;
  if (!savedRule) {
    return false;
  }

  try {
    const rule = JSON.parse(savedRule);
    // First, set casting.
    const castingId = rule.jobrule;
    const casting = findCastingDefinition(castings, castingId);
    if (casting != null) {
      store.setCurrentCasting(casting);
    }

    for (const key in rule) {
      // XXX we have to ignore some keys.
      if (
        [
          'number',
          'maxnumber',
          'blind',
          'gm',
          'watchspeak',
          'jobrule',
          '_jobquery',
          'quantum_joblist',
        ].includes(key)
      ) {
        continue;
      }
      if (rule[key] != null) {
        // if not saved, leave it as initial.
        store.updateRule(key, String(rule[key]));
      }
    }
    // XXX we are following old query-based formats.
    const jobs = rule._jobquery;
    if (jobs != null) {
      for (const role of roles) {
        const num = Number(jobs[role]);
        if (isFinite(num)) {
          const included = jobs[`job_use_${role}`] === 'on';
          store.updateJobNumber(role, num, included);
        }
      }
      for (const cat of categories) {
        const num = Number(jobs[`category_${cat.id}`]);
        if (isFinite(num)) {
          store.updateCategoryNumber(cat.id, num);
        }
      }
    }

    localStorage.removeItem('savedRule');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}
/**
 * Find casting definition from id.
 */
function findCastingDefinition(
  castings: LabeledGroup<CastingDefinition, string>,
  castingId: string,
) {
  return findLabeledGroupItem(castings, item => item.id === castingId);
}
