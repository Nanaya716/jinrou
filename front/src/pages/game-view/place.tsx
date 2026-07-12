import * as React from 'react';
import { runInAction } from 'mobx';

import { GameStore } from './store';
import { Game } from './component';
import {
  RuleGroup,
  RoomControlHandlers,
  RoleCategoryDefinition,
} from '../../defs';
import {
  SpeakQuery,
  ReportFormConfig,
  ReportFormQuery,
  ShareButtonConfig,
} from './defs';
import { makeRefuseRevivalLogic } from './logic/refuse-revival';
import { i18n } from '../../i18n';
import { mountReact } from '../../util/react-root';

/**
 * Options to place.
 */
export interface IPlaceOptions {
  /**
   * i18n instance to use.
   */
  i18n: i18n;
  /**
   * Node to place the component to.
   */
  node: HTMLElement;
  /**
   * ID of this room.
   */
  roomid: number;
  /**
   * Name of this room.
   */
  roomName: string;
  /**
   * Definition of categories.
   */
  categories: RoleCategoryDefinition[];
  /**
   * Definition of rules.
   */
  rules: RuleGroup;
  /**
   * Data of report form.
   */
  reportForm: ReportFormConfig;
  /**
   * Config of share button.
   */
  shareButton: ShareButtonConfig;
  /**
   * Color of teams.
   */
  teamColors: Record<string, string | undefined>;
  /**
   * Handle a speak event.
   */
  onSpeak: (query: SpeakQuery) => void;
  /**
   * 处理非法发言频道提交。
   */
  onInvalidSpeakKind: () => void;
  /**
   * Handle a refuse revival event.
   */
  onRefuseRevival: () => Promise<void>;
  /**
   * Handle a job query.
   */
  onJobQuery: (query: Record<string, string>) => void;
  /**
   * Handle an update to the will.
   */
  onWillChange: (will: string) => void;
  /**
   * Handle an update to the note.
   */
  onNoteChange: (note: string) => void;
  /**
   * Handle a submit of report form.
   */
  onReportFormSubmit: (query: ReportFormQuery) => void;
  /**
   * Toggle current room favorite state.
   */
  onFavoriteToggle: (favorite: boolean) => void;
  /**
   * Handlers of room prelude events.
   */
  roomControlHandlers: RoomControlHandlers;
}

export interface IPlaceResult {
  /**
   * store.
   */
  store: GameStore;
  /**
   * RunInAction helper.
   */
  runInAction: typeof runInAction;
  /**
   * Unmount the component placed by place().
   */
  unmount(): void;
}
/**
 * Place a game view component.
 * @returns Unmount point with newly created store.
 */
export function place({
  i18n,
  node,
  roomid,
  roomName,
  categories,
  rules,
  reportForm,
  shareButton,
  teamColors,
  onSpeak,
  onInvalidSpeakKind,
  onRefuseRevival,
  onJobQuery,
  onWillChange,
  onNoteChange,
  onReportFormSubmit,
  onFavoriteToggle,
  roomControlHandlers,
}: IPlaceOptions): IPlaceResult {
  const store = new GameStore();
  // 蘇生辞退時のロジックを作る
  const refuseRevivalLogic = makeRefuseRevivalLogic(i18n, onRefuseRevival);

  const com = (
    <Game
      i18n={i18n}
      roomid={roomid}
      store={store}
      categories={categories}
      ruleDefs={rules}
      teamColors={teamColors}
      reportForm={reportForm}
      shareButton={shareButton}
      onSpeak={onSpeak}
      onInvalidSpeakKind={onInvalidSpeakKind}
      onRefuseRevival={refuseRevivalLogic}
      onJobQuery={onJobQuery}
      onWillChange={onWillChange}
      onNoteChange={onNoteChange}
      onReportFormSubmit={onReportFormSubmit}
      onFavoriteToggle={onFavoriteToggle}
      roomControlHandlers={roomControlHandlers}
    />
  );

  const root = mountReact(node, com);

  return {
    store,
    runInAction,
    unmount: () => {
      root.unmount();
    },
  };
}
