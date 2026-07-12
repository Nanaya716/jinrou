import '../../util/mobx-config';
import { observable, action, computed, makeObservable } from 'mobx';
import { Room, RoomListMode, freshDuration } from './defs';

export interface RoomInStore extends Room {
  /**
   * Whether this room is fresh.
   */
  fresh: boolean;
}

export interface FavoriteSummary {
  total: number;
  played: number;
  win: number;
  lose: number;
  draw: number;
  gm: number;
  helper: number;
}
export interface FavoriteUserlog {
  counter?: {
    allgamecount?: number;
  };
  wincount?: {
    all?: number;
    [job: string]: number | undefined;
  };
  losecount?: {
    all?: number;
    [job: string]: number | undefined;
  };
}
/**
 * States of room list page.
 * @package
 */
export class RoomListStore {
  constructor(private pageNumber: number, mode: RoomListMode) {
    makeObservable(this);
    this.mode = mode;
  }
  /**
   * Flag of loading.
   */
  @observable
  public state: 'loading' | 'loaded' | 'error' = 'loading';
  /**
   * List of rooms.
   */
  @observable
  public rooms: RoomInStore[] = [];
  /**
   * Number of page.
   */
  @observable
  public page: number = 0;
  /**
   * Current mode of list.
   */
  @observable
  public mode: RoomListMode;
  /**
   * Summary of favorite rooms after current filtering.
   */
  @observable.shallow
  public favoriteSummary: FavoriteSummary | null = null;
  /**
   * User log aggregated from all favorite rooms.
   */
  @observable.shallow
  public favoriteUserlog: FavoriteUserlog | null = null;

  /**
   * Whether previous page is available.
   */
  @computed
  get prevAvailable(): boolean {
    return this.state === 'loaded' && this.page > 0;
  }
  /**
   * Whether next page is available.
   */
  @computed
  get nextAvailable(): boolean {
    // XXX this has false positive
    return this.state === 'loaded' && this.rooms.length >= this.pageNumber;
  }
  /**
   * Start of page index.
   */
  @computed
  get indexStart(): number {
    return this.page * this.pageNumber + 1;
  }

  /**
   * Set rooms and page
   */
  @action
  public setRooms(
    rooms: Room[],
    page: number,
    favoriteSummary?: FavoriteSummary | null,
    favoriteUserlog?: FavoriteUserlog | null,
  ): void {
    const currentTime = Date.now();
    this.rooms = rooms.map(room => ({
      ...room,
      fresh: room.made + freshDuration > currentTime,
    }));
    this.page = page;
    if (favoriteSummary !== undefined) {
      this.favoriteSummary = favoriteSummary;
    }
    if (favoriteUserlog !== undefined) {
      this.favoriteUserlog = favoriteUserlog;
    }
    this.state = 'loaded';
  }
  /**
   * Set error state.
   */
  @action
  public setError(): void {
    this.state = 'error';
  }
}
