import * as React from 'react';
import styled from '../../util/styled';
import Swipeable from 'react-swipeable';

import { ThemeProvider } from '../../util/styled';
import { observer } from 'mobx-react';

import { bind } from '../../util/bind';
import { themeStore, UserTheme } from '../../theme';
import { I18nProvider, I18n, i18n } from '../../i18n';

import {
  Rule,
  RuleGroup,
  RoomControlHandlers,
  RoleCategoryDefinition,
} from '../../defs';
import {
  SpeakState,
  LogVisibility,
  SpeakQuery,
  ReportFormConfig,
  ReportFormQuery,
  ShareButtonConfig,
  PlayerInfo,
} from './defs';
import { GameStore } from './store';
import { JobInfo } from './job-info';
import { SpeakForm } from './speak-form';
import { JobForms } from './job-forms';
import { Logs } from './logs';
import { ShowRule } from './rule';

import { Players } from './players';
import { RoomControls } from './room-controls';
import { lightA } from '../../styles/a';
import { GlobalStyle } from './global-style';
import { phone } from '../../common/media';
import { styleModeOf } from './logic/style-mode';
import { AppStyling } from '../../styles/phone';
import {
  speakFormZIndex,
  ruleZIndex,
  jobinfoZIndex,
} from '../../common/z-index';
import memoizeOne from 'memoize-one';
import { GameFooter } from './footer';

type TeamColors = Record<string, string | undefined>;

const SPEAK_KIND_STORAGE_PREFIX = 'jinrou-speak-kind:';
const SPEAK_KIND_STORAGE_INDEX = 'jinrou-speak-kind-index';
const MAX_SAVED_SPEAK_KIND_ROOMS = 5;

type SavedSpeakKindRoom = {
  roomid: number;
  updatedAt: number;
};

function speakKindStorageKey(roomid: number): string {
  return `${SPEAK_KIND_STORAGE_PREFIX}${roomid}`;
}

function getSpeakKindStorageIndex(): SavedSpeakKindRoom[] {
  try {
    const index = JSON.parse(
      sessionStorage.getItem(SPEAK_KIND_STORAGE_INDEX) || '[]',
    );
    if (!Array.isArray(index)) {
      return [];
    }
    return index.filter(
      item =>
        typeof item.roomid === 'number' && typeof item.updatedAt === 'number',
    );
  } catch {
    return [];
  }
}

function touchSpeakKindStorageRoom(roomid: number): void {
  try {
    const next = [
      { roomid, updatedAt: Date.now() },
      ...getSpeakKindStorageIndex().filter(item => item.roomid !== roomid),
    ];
    const keep = next.slice(0, MAX_SAVED_SPEAK_KIND_ROOMS);
    const removed = next.slice(MAX_SAVED_SPEAK_KIND_ROOMS);
    sessionStorage.setItem(SPEAK_KIND_STORAGE_INDEX, JSON.stringify(keep));
    for (const item of removed) {
      sessionStorage.removeItem(speakKindStorageKey(item.roomid));
    }
  } catch {
    // 忽略存储异常。
  }
}

function loadSpeakKind(roomid: number): string | null {
  try {
    return sessionStorage.getItem(speakKindStorageKey(roomid));
  } catch {
    return null;
  }
}

function saveSpeakKind(roomid: number, kind: string): void {
  try {
    sessionStorage.setItem(speakKindStorageKey(roomid), kind);
    touchSpeakKindStorageRoom(roomid);
  } catch {
    // 忽略存储异常。
  }
}

interface IPropGame {
  /**
   * i18n instance.
   */
  i18n: i18n;
  /**
   * ID of this room.
   */
  roomid: number;
  /**
   * store.
   */
  store: GameStore;
  /**
   * Definition of categories.
   */
  categories: RoleCategoryDefinition[];
  /**
   * Definition of rules.
   */
  ruleDefs: RuleGroup;
  /**
   * Definition of report forms.
   */
  reportForm: ReportFormConfig;
  /**
   * Config of share button.
   */
  shareButton: ShareButtonConfig;
  /**
   * Color of each team.
   */
  teamColors: TeamColors;
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
  onRefuseRevival: () => void;
  /**
   * Handle a job query event.
   */
  onJobQuery: (query: Record<string, string>) => void;
  /**
   * Handle a will update event.
   */
  onWillChange: (will: string) => void;
  /**
   * Handle a note update event.
   */
  onNoteChange: (note: string) => void;
  /**
   * Handle a report form submit event.
   */
  onReportFormSubmit: (query: ReportFormQuery) => void;
  /**
   * Handlers of room prelude.
   */
  roomControlHandlers: RoomControlHandlers;
}

@observer
export class Game extends React.Component<IPropGame, {}> {
  private ruleElement = React.createRef<HTMLDivElement>();
  private playersElement = React.createRef<HTMLDivElement>();
  private jobinfoElement = React.createRef<HTMLDivElement>();
  private jobinfoMarkerElement = React.createRef<HTMLDivElement>();
  private speakElement = React.createRef<HTMLDivElement>();
  private speakFormRef = React.createRef<SpeakForm>();
  /**
   * memoized function to make theme object from user theme and colors.
   */
  private makeTheme = memoizeOne((user: UserTheme, teamColors: TeamColors) => ({
    user,
    teamColors,
  }));

  public componentDidMount(): void {
    this.restoreSavedSpeakKind();
  }

  public componentDidUpdate(): void {
    this.restoreSavedSpeakKind();
  }

  public render() {
    const {
      i18n,
      roomid,
      store,
      categories,
      ruleDefs,
      teamColors,
      reportForm,
      shareButton,
      onJobQuery,
      onInvalidSpeakKind,
      onWillChange,
      onNoteChange,
      onReportFormSubmit,
      roomControlHandlers,
    } = this.props;
    const {
      gameInfo,
      roleInfo,
      speakState,
      logVisibility,
      rule,
      timer,
      players,
      roomControls,
      speakFocus,
    } = store;
    const styleMode = styleModeOf(roleInfo, gameInfo);
    const theme = this.makeTheme(themeStore.themeObject, teamColors);

    return (
      <ThemeProvider theme={theme} mode={styleMode}>
        <I18nProvider i18n={i18n}>
          <AppWrapper>
            {/* List of players. */}
            <RoomHeaderPart ref={this.playersElement}>
              <Players
                players={players}
                onFilter={this.handleLogFilter}
                onInsertName={this.handlePlayerNameClick}
              />
            </RoomHeaderPart>
            {/* Room control buttons. */}
            {roomControls != null ? (
              <I18n>
                {t => (
                  <RoomPreludePart>
                    <RoomControls
                      roomControls={roomControls}
                      t={t}
                      roomid={roomid}
                      players={players}
                      handlers={roomControlHandlers}
                    />
                  </RoomPreludePart>
                )}
              </I18n>
            ) : null}
            {/* marker to jump to jobinfo. */}
            <div ref={this.jobinfoMarkerElement} />
            {/* Information of your role. */}
            <JobInfoPart ref={this.jobinfoElement}>
              <JobInfo
                roleInfo={roleInfo}
                timer={timer}
                players={players}
                speakFocus={speakFocus}
              />
            </JobInfoPart>
            {/* Open forms. */}
            {gameInfo.status === 'playing' && roleInfo != null ? (
              <RoomHeaderPart>
                <JobForms forms={roleInfo.forms} onSubmit={onJobQuery} />
              </RoomHeaderPart>
            ) : null}
            {/* Form for speak and other utilities. */}
            <SpeakFormPart ref={this.speakElement}>
              <SpeakForm
                ref={this.speakFormRef}
                gameInfo={gameInfo}
                roleInfo={roleInfo}
                players={players}
                logVisibility={logVisibility}
                rule={rule != null}
                onUpdate={this.handleSpeakUpdate}
                onUpdateLogVisibility={this.handleLogVisibilityUpdate}
                onSpeak={this.handleSpeak}
                onInvalidSpeakKind={onInvalidSpeakKind}
                onRefuseRevival={this.handleRefuseRevival}
                onRuleOpen={this.handleRuleOpen}
                onWillChange={onWillChange}
                onNoteChange={onNoteChange}
                onFocus={this.handleSpeakFocus}
                timer={timer}
                {...speakState}
              />
            </SpeakFormPart>
            {/* Main game screen. */}
            <MainWrapper>
              <RulePane
                store={store}
                rule={rule}
                categories={categories}
                ruleDefs={ruleDefs}
                ruleElement={this.ruleElement}
                onSwipingLeft={this.handleRuleSwipeToLeft}
                onSwipingRight={this.handleRuleSwipeToRight}
              />
              {/* Logs. */}
              <LogsWrapper>
                <LogsPane
                  store={store}
                  players={players}
                  onResetLogPickup={this.handleResetLogPickup}
                  onShortIdClick={this.handleShortIdClick}
                />
              </LogsWrapper>
            </MainWrapper>
            <RoomFooterPart>
              <GameFooter
                reportForm={reportForm}
                shareButton={shareButton}
                roomName={store.roomName}
                onSubmit={onReportFormSubmit}
              />
            </RoomFooterPart>
            <NavigationWrapper>
              <NavigationButton onClick={this.handleNavigationPlayersClick}>
                {i18n.t('game_client:navigation.players')}
              </NavigationButton>
              <NavigationButton onClick={this.handleNavigationSkillClick}>
                {i18n.t('game_client:navigation.skill')}
              </NavigationButton>
              <NavigationButton onClick={this.handleNavigationSpeakClick}>
                {i18n.t('game_client:navigation.speak')}
              </NavigationButton>
            </NavigationWrapper>
            <GlobalStyle />
          </AppWrapper>
        </I18nProvider>
      </ThemeProvider>
    );
  }
  /**
   * Handle an update to the store.
   */
  @bind
  protected handleSpeakUpdate(obj: Partial<SpeakState>): void {
    const { roomid, store } = this.props;
    store.update({
      speakState: obj,
    });
    if (obj.kind != null && this.isSpeakKindAllowed(store.speakState.kind)) {
      saveSpeakKind(roomid, store.speakState.kind);
    }
  }
  /**
   * Handle an update to log visibility.
   */
  @bind
  protected handleLogVisibilityUpdate(obj: LogVisibility): void {
    this.props.store.update({
      logVisibility: obj,
    });
  }
  /**
   * Handle a speak event.
   */
  @bind
  protected handleSpeak(query: SpeakQuery): void {
    const { store, onSpeak } = this.props;
    // Don't reset multiline state, keep current state
    onSpeak(query);
  }
  /**
   * Handle a refuse revival event.
   */
  @bind
  protected handleRefuseRevival(): void {
    const { onRefuseRevival } = this.props;
    onRefuseRevival();
  }
  /**
   * Handle a click on shortId in log.
   */
  @bind
  protected handleShortIdClick(shortId: string): void {
    if (this.speakFormRef.current != null) {
      this.speakFormRef.current.appendToComment(`>>${shortId} `);
    }
  }
  /**
   * Handle a click on player name in log.
   */
  @bind
  protected handlePlayerNameClick(playerName: string): void {
    if (this.speakFormRef.current != null) {
      this.speakFormRef.current.appendToComment(playerName);
    }
  }
  /**
   * handle the rule open button event.
   */
  @bind
  protected handleRuleOpen(scroll: boolean): void {
    const { store } = this.props;
    // toggle the rule pane.
    const prevOpen = store.ruleOpen;
    store.update({
      ruleOpen: !prevOpen,
    });
    if (!prevOpen && scroll && this.ruleElement.current != null) {
      // if scroll request is positive,
      // scroll to the rule pane.
      this.ruleElement.current.scrollIntoView(true);
    }
  }
  /**
   * handle swipe of rule to left.
   */
  @bind
  protected handleRuleSwipeToLeft(): void {
    // when rule is swiped to left, it is open.
    this.props.store.update({
      ruleOpen: true,
    });
  }
  /**
   * handle swipe of rule to right.
   */
  @bind
  protected handleRuleSwipeToRight(): void {
    // when rule is swiped to left, rule is closed.
    this.props.store.update({
      ruleOpen: false,
    });
  }
  /**
   * Handle update of log pickup filter.
   */
  @bind
  protected handleLogFilter(userid: string): void {
    const { store } = this.props;
    // If userid is same to the current one, reset filter.
    store.update({
      logPickup: store.logPickup === userid ? null : userid,
    });
  }
  /**
   * Handle setting signal of log pickup.
   */
  @bind
  protected handleResetLogPickup(): void {
    this.props.store.update({ logPickup: null });
  }
  /**
   * Handle a focus change of speak input.
   */
  @bind
  protected handleSpeakFocus(focus: boolean): void {
    this.props.store.update({
      speakFocus: focus,
    });
  }
  /**
   * Handle click of go to playersb button.
   */
  @bind
  protected handleNavigationPlayersClick() {
    const { current } = this.playersElement;
    if (current != null) {
      current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }
  @bind
  protected handleNavigationSkillClick() {
    const { current } = this.jobinfoMarkerElement;
    if (current != null) {
      current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }
  @bind
  protected handleNavigationSpeakClick() {
    const jobinfo = this.jobinfoElement.current;
    const speak = this.speakElement.current;
    if (jobinfo && speak) {
      const jobinfoh = jobinfo.clientHeight;
      const bodyBox = document.body.getBoundingClientRect();
      const speakBox = speak.getBoundingClientRect();
      const targeth = speakBox.top - bodyBox.top - jobinfoh;
      // use smooth scrolling on supported platform.
      if ('scrollBehavior' in document.body.style) {
        window.scrollTo({
          behavior: 'smooth',
          top: targeth,
          left: window.scrollX,
        });
      } else {
        window.scrollTo(window.scrollX, targeth);
      }
      const { current } = this.speakFormRef;
      if (current != null) {
        current.setFocus();
      }
    }
  }

  private restoreSavedSpeakKind(): void {
    const { roomid, store } = this.props;
    const savedKind = loadSpeakKind(roomid);
    if (
      savedKind != null &&
      savedKind !== store.speakState.kind &&
      this.isSpeakKindAllowed(savedKind)
    ) {
      store.update({
        speakState: {
          kind: savedKind,
        },
      });
    }
  }

  private isSpeakKindAllowed(kind: string): boolean {
    const { roleInfo } = this.props.store;
    const speaks = roleInfo != null ? roleInfo.speak : ['day'];
    return speaks.includes(kind);
  }
}

interface IPropRulePane {
  store: GameStore;
  rule: Rule | undefined;
  categories: RoleCategoryDefinition[];
  ruleDefs: RuleGroup;
  ruleElement: React.RefObject<HTMLDivElement>;
  onSwipingLeft(): void;
  onSwipingRight(): void;
}

@observer
class RulePane extends React.Component<IPropRulePane, {}> {
  public render() {
    const {
      store,
      rule,
      categories,
      ruleDefs,
      ruleElement,
      onSwipingLeft,
      onSwipingRight,
    } = this.props;
    const closed = rule == null || !store.ruleOpen;
    return (
      <RuleWrapper closed={closed}>
        {rule != null ? (
          <RuleStickyWrapper closed={closed}>
            <RuleInnerWrapper ref={ruleElement}>
              <Swipeable
                onSwipingLeft={onSwipingLeft}
                onSwipingRight={onSwipingRight}
              >
                <ShowRule
                  rule={rule}
                  categories={categories}
                  ruleDefs={ruleDefs}
                />
              </Swipeable>
            </RuleInnerWrapper>
          </RuleStickyWrapper>
        ) : null}
      </RuleWrapper>
    );
  }
}

interface IPropLogsPane {
  store: GameStore;
  players: PlayerInfo[];
  onResetLogPickup(): void;
  onShortIdClick?: (shortId: string) => void;
}

@observer
class LogsPane extends React.Component<IPropLogsPane, {}> {
  private makePickupUserids = memoizeOne((players: PlayerInfo[]) =>
    players.map(player => player.id),
  );

  public render() {
    const { store, players, onResetLogPickup, onShortIdClick } = this.props;
    return (
      <Logs
        logs={store.logs}
        visibility={store.logVisibility}
        icons={store.icons}
        rule={store.rule}
        logPickup={store.logPickup}
        pickupUserids={this.makePickupUserids(players)}
        onResetLogPickup={onResetLogPickup}
        onShortIdClick={onShortIdClick}
      />
    );
  }
}

/**
 * Wrapper of whole app.
 */
const AppWrapper = styled(AppStyling)`
  display: flex;
  flex-flow: column nowrap;
  --base-font-size: 1rem;
  ${phone`
    --base-font-size: ${({ theme }): string => {
      const fontSize = theme.user.phoneFontSize;
      switch (fontSize) {
        case 'large':
          return '1rem';
        case 'normal':
          return '0.86rem';
        case 'small':
          return '0.7rem';
        case 'very-small':
          return '0.6em';
      }
    }};
    padding-bottom: 2em;
  `};
`;

/**
 * Wrapper of each room control.
 */
const RoomHeaderPart = styled.div`
  margin: 4px 0;
  padding: 0 8px;
  ${phone`
    padding: 0;
  `};
`;

/**
 * Wrapper of room prelude.
 */
const RoomPreludePart = styled(RoomHeaderPart)`
  display: flex;
  flex-flow: row wrap;

  > button {
    margin: 2px;
  }

  ${phone`
    padding: 0 8px;
    justify-content: space-between;
    > button {
      margin: 3px;
    }
  `};
`;

/**
 * Wrapper of speak form.
 */
const SpeakFormPart = styled(RoomHeaderPart)`
  background-color: ${({ theme }) => theme.globalStyle.background};
  ${phone`
    ${({ theme }) =>
      theme.user.speakFormPosition === 'fixed'
        ? `
      /* On phones, speak form is fixed to the bottom. */
      order: 5;
      position: sticky;
      z-index: ${speakFormZIndex};
      left: 0;
      bottom: 0;
      border-top: 1px solid ${theme.globalStyle.color};
    `
        : ''}

    margin: 0;
    padding: 4px 8px;
    padding: 4px 8px calc(4px + env(safe-area-inset-bottom));
  `};
`;

/**
 * Wrapper of jobinfo form.
 */
const JobInfoPart = styled(RoomHeaderPart)`
  ${phone`
    position: sticky;
    left: 0;
    top: 0;
    z-index: ${jobinfoZIndex};
  `};
`;

/**
 * Wrapper for main game panel.
 */
const MainWrapper = styled.div`
  display: flex;
  flex-flow: row nowrap;
  position: relative;
`;

/**
 * Wrapper of logs.
 */
const LogsWrapper = styled.div`
  flex: auto 1 1;
  order: 1;
`;

/**
 * Wrapper of footer of room.
 */
const RoomFooterPart = styled.div`
  margin: 4px 0;
  padding: 0 8px;
`;

interface IPropsRuleWrapper {
  /**
   * Whether this is in closed state.
   */
  closed?: boolean;
}
/**
 * Wrapper of rule.
 */
const RuleWrapper = styled.div<IPropsRuleWrapper>`
  display: ${({ closed }) => (closed ? 'none' : 'block')};
  position: absolute;
  right: 0;
  top: 0;
  width: 20em;
  max-width: 100%;
  max-height: 100vh;
  overflow: auto;
  order: 2;

  z-index: ${ruleZIndex};
  background-color: #ffd1f2;
  color: black;

  a {
    ${lightA};
  }
`;

const RuleStickyWrapper = styled.div<IPropsRuleWrapper>`
  width: 20em;
  max-width: 100%;
  position: sticky;
  top: 0;
  overflow-x: hidden;
`;

const RuleInnerWrapper = styled.div`
  box-sizing: border-box;
  max-height: 100vh;
  width: 20em;
  padding: 5px;
  ${phone`
    max-height: 80vh;
  `};
`;

const NavigationWrapper = styled.div`
  display: none;
  width: 100%;
  background-color: ${({ theme }) => theme.globalStyle.background};
  ${phone`
    ${({ theme }) =>
      theme.user.speakFormPosition === 'normal'
        ? `
      display: flex;
      flex-flow: row nowrap;
      position: fixed;
      left: 0;
      bottom: 0;
      height: 2em;
      height: calc(2em + env(safe-area-inset-bottom));
    `
        : ''}
  `};
`;

const NavigationButton = styled.button`
  flex: auto 1 1;
  appearance: none;
  background-color: #f3f3f3;
  border: 1px solid #888888;
  margin: 0;
  color: #333333;
`;
