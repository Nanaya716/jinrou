import * as React from 'react';

import { RoomListStore } from './store';
import { RoomList } from './component';
import { i18n } from '../../i18n';
import { RoomListMode } from './defs';
import { GetJobColorProvider, GetJobColorFunction } from './get-job-color';
import { mountReact } from '../../util/react-root';

/**
 * Options to place.
 */
export interface IPlaceOptions {
  i18n: i18n;
  /**
   * Node to place.
   */
  node: HTMLElement;
  /**
   * Current mode of list.
   */
  listMode: RoomListMode;
  /**
   * Number of rooms in one page.
   */
  pageNumber: number;
  /**
   * When enabled, links are not shown.
   */
  noLinks: boolean;
  /**
   * Initial keyword for favorite room search.
   */
  keyword?: string;
  /**
   * Start number of index of rooms.
   */
  indexStart: number;
  /**
   * handler of page move.
   */
  onPageMove: (dist: number) => void;
  /**
   * Handler of favorite room search.
   */
  onSearch?: (keyword: string) => void;
  /**
   * Function to return color of given job.
   */
  getJobColor: GetJobColorFunction;
}
export interface IPlaceResult {
  unmount: () => void;
  store: RoomListStore;
}

export function place({
  i18n,
  node,
  pageNumber,
  listMode,
  noLinks,
  keyword,
  onPageMove,
  onSearch,
  getJobColor,
}: IPlaceOptions): IPlaceResult {
  const store = new RoomListStore(pageNumber, listMode);

  const com = (
    <GetJobColorProvider value={getJobColor}>
      <RoomList
        i18n={i18n}
        store={store}
        noLinks={noLinks}
        keyword={keyword || ''}
        onPageMove={onPageMove}
        onSearch={onSearch}
      />
    </GetJobColorProvider>
  );

  const root = mountReact(node, com);

  const unmount = () => {
    root.unmount();
  };

  return { unmount, store };
}
