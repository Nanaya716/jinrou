import * as React from 'react';

import { I18nProvider, i18n } from '../../i18n';
import {
  FavoriteSummary,
  FavoriteUserlog,
  RoomListStore,
  RoomInStore,
} from './store';
import { observer } from 'mobx-react';
import {
  RoomListWrapper,
  Wrapper,
  NavLinks,
  Navigation,
  FavoriteSearchForm,
} from './elements';
import { NormalButton } from '../../common/button';
import { bind } from 'bind-decorator';
import { Omit } from '../../types/omit';
import { RoomListMode } from './defs';
import { Room } from './room';

export interface IPropRoomList {
  /**
   * i18next instance.
   */
  i18n: i18n;
  /**
   * store.
   */
  store: RoomListStore;
  /**
   * Flag to hide links to other types of room list.
   */
  noLinks: boolean;
  /**
   * Page move event.
   */
  onPageMove: (dist: number) => void;
  /**
   * Current favorite search keyword.
   */
  keyword: string;
  /**
   * Search event for favorite rooms.
   */
  onSearch?: (keyword: string) => void;
}

@observer
export class RoomList extends React.Component<IPropRoomList, {}> {
  public render() {
    const { i18n, store, noLinks, keyword, onPageMove, onSearch } = this.props;
    return (
      <I18nProvider i18n={i18n}>
        <RoomListInner
          i18n={i18n}
          noLinks={noLinks}
          keyword={keyword}
          onPageMove={onPageMove}
          onSearch={onSearch}
          rooms={store.rooms}
          page={store.page}
          mode={store.mode}
          loadingState={store.state}
          prevAvailable={store.prevAvailable}
          nextAvailable={store.nextAvailable}
          indexStart={store.indexStart}
          favoriteSummary={store.favoriteSummary}
          favoriteUserlog={store.favoriteUserlog}
        />
      </I18nProvider>
    );
  }
}

class RoomListInner extends React.Component<
  Omit<IPropRoomList, 'store'> & {
    prevAvailable: boolean;
    nextAvailable: boolean;
    mode: RoomListMode;
    page: number;
    rooms: RoomInStore[];
    noLinks: boolean;
    keyword: string;
    loadingState: RoomListStore['state'];
    indexStart: number;
    favoriteSummary: FavoriteSummary | null;
    favoriteUserlog: FavoriteUserlog | null;
  },
  {
    keyword: string;
  }
> {
  private headerRef = React.createRef<HTMLHeadingElement>();
  public state = {
    keyword: this.props.keyword,
  };
  public render() {
    const {
      i18n,
      noLinks,
      indexStart,
      rooms,
      page,
      prevAvailable,
      nextAvailable,
      mode,
      loadingState,
      onSearch,
      favoriteSummary,
      favoriteUserlog,
    } = this.props;
    return (
      <Wrapper>
        <h1 ref={this.headerRef}>
          {mode === 'favorites' ? '收藏一览' : i18n.t('rooms_client:title')}
        </h1>
        <Navigation>
          {noLinks ? null : (
            <NavLinks>
              <a href="/newroom">{i18n.t('rooms_client:link.newRoom')}</a>
              <a href="/rooms">{i18n.t('rooms_client:link.new')}</a>
              <a href="/rooms/old">{i18n.t('rooms_client:link.old')}</a>
              <a href="/rooms/log">{i18n.t('rooms_client:link.log')}</a>
            </NavLinks>
          )}
          {mode === 'favorites' && onSearch != null ? (
            <FavoriteSearchForm onSubmit={this.handleSearchSubmit}>
              <input
                type="search"
                value={this.state.keyword}
                onChange={this.handleKeywordChange}
                placeholder="搜索房间名、自己的职业名、胜利/败北/平局"
              />
              <NormalButton type="submit">搜索</NormalButton>
              <NormalButton type="button" onClick={this.handleSearchClear}>
                清空
              </NormalButton>
            </FavoriteSearchForm>
          ) : null}
          {mode === 'favorites' && favoriteSummary != null ? (
            <p>收藏 {favoriteSummary.total} 间房间。</p>
          ) : null}
          {loadingState === 'loading' ? (
            <p>{i18n.t('rooms_client:loading')}</p>
          ) : loadingState === 'error' ? (
            <p>{i18n.t('rooms_client:loadFailed')}</p>
          ) : rooms.length === 0 ? (
            <p>
              {mode === 'favorites' && this.state.keyword.trim()
                ? '没有符合条件的收藏房间。'
                : i18n.t('rooms_client:noRoom')}
            </p>
          ) : null}
          {loadingState === 'loaded' && (rooms.length > 0 || page !== 0) ? (
            <>
              <p>
                <NormalButton
                  disabled={!prevAvailable}
                  onClick={this.handlePrevClick}
                >
                  {i18n.t('rooms_client:prevPageButton')}
                </NormalButton>
                <NormalButton
                  disabled={!nextAvailable}
                  onClick={this.handleNextClick}
                >
                  {i18n.t('rooms_client:nextPageButton')}
                </NormalButton>
              </p>
            </>
          ) : null}
        </Navigation>
        {mode === 'favorites' ? (
          <details>
            <summary>全部战绩</summary>
            <div
              id="favorite-userlog"
              data-userlog-state={favoriteUserlog == null ? 'empty' : 'loaded'}
            />
          </details>
        ) : null}
        <RoomListWrapper>
          {rooms.map((room, i) => (
            <Room
              key={room.id}
              room={room}
              listMode={mode}
              index={indexStart + i}
            />
          ))}
        </RoomListWrapper>
      </Wrapper>
    );
  }
  public componentDidUpdate(prevProps: this['props']) {
    const { current } = this.headerRef;
    if (
      prevProps.loadingState === 'loaded' &&
      this.props.loadingState === 'loaded' &&
      current != null
    ) {
      // if header is not in the visible area, then scroll.
      const box = current.getBoundingClientRect();
      if (box.top < 0) {
        current.scrollIntoView(true);
      }
    }
    if (prevProps.keyword !== this.props.keyword) {
      this.setState({
        keyword: this.props.keyword,
      });
    }
  }
  @bind
  private handleKeywordChange(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      keyword: e.currentTarget.value,
    });
  }
  @bind
  private handleSearchSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (this.props.onSearch != null) {
      this.props.onSearch(this.state.keyword.trim());
    }
  }
  @bind
  private handleSearchClear() {
    this.setState({
      keyword: '',
    });
    if (this.props.onSearch != null) {
      this.props.onSearch('');
    }
  }
  @bind
  private handlePrevClick() {
    this.props.onPageMove(-1);
  }
  @bind
  private handleNextClick() {
    this.props.onPageMove(1);
  }
}
