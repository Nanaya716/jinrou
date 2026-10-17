import * as React from 'react';
import { I18n, TranslationFunction } from '../../../i18n';
import { bind } from '../../../util/bind';

import {
  GameInfo,
  RoleInfo,
  SpeakState,
  LogVisibility,
  SpeakQuery,
  PlayerInfo,
  FavoriteState,
} from '../defs';

import { LogVisibilityControl } from './log-visibility';
import { WillForm } from './will-form';
import { NoteForm } from './note-form';
import { makeMapByKey } from '../../../util/map-by-key';
import { AutocompleteDropdown, AutocompleteItem } from './autocomplete';

// Storage key for speak draft.
const SPEAK_DRAFT_STORAGE_KEY = 'jinrou-speak-draft';

/**
 * Load speak draft from localStorage.
 */
function loadSpeakDraftFromStorage(): string {
  try {
    return localStorage.getItem(SPEAK_DRAFT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Save speak draft to localStorage.
 */
function saveSpeakDraftToStorage(content: string): void {
  try {
    localStorage.setItem(SPEAK_DRAFT_STORAGE_KEY, content);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Clear speak draft from localStorage.
 */
function clearSpeakDraftFromStorage(): void {
  try {
    localStorage.removeItem(SPEAK_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
import { SpeakKindSelect, speakKindLabel } from './speak-kind-select';
import {
  MainForm,
  SpeakTextArea,
  SpeakInput,
  SpeakInputArea,
  SpeakButtonArea,
  SpeakControlsArea,
  OthersArea,
  ButtonArea,
  LabeledControl,
  SpeakControlsSlim,
  InputWithCountWrapper,
  CharCount,
} from './layout';
import { IsPhone } from '../../../common/media';
import { FontAwesomeIcon } from '../../../util/icon';
import { SensitiveButton } from '../../../util/sensitive-button';
import { withTheme } from '../../../util/styled';
import { Theme, themeStore } from '../../../theme';

export interface IPropSpeakForm extends SpeakState {
  /**
   * Info of game.
   */
  gameInfo: GameInfo;
  /**
   * Info of roles.
   */
  roleInfo: RoleInfo | null;
  /**
   * List of players currently in the room.
   */
  players: PlayerInfo[];
  /**
   * Info of log visibility.
   */
  logVisibility: LogVisibility;
  /**
   * Whether rule is available now.
   */
  rule: boolean;
  /**
   * update to a speak form state.
   */
  onUpdate: (obj: Partial<SpeakState>) => void;
  /**
   * update to log visibility.
   */
  onUpdateLogVisibility: (obj: LogVisibility) => void;
  /**
   * Speak a comment.
   */
  onSpeak: (query: SpeakQuery) => void;
  /**
   * 通知当前发言频道非法。
   */
  onInvalidSpeakKind: () => void;
  /**
   * Push a refuse revival button.
   */
  onRefuseRevival: () => void;
  /**
   * Push the rule button.
   */
  onRuleOpen: (scroll: boolean) => void;
  /**
   * Change the will.
   */
  onWillChange: (will: string) => void;
  /**
   * Change the note.
   */
  onNoteChange: (note: string) => void;
  /**
   * Current favorite state of this room.
   */
  favoriteState: FavoriteState;
  /**
   * Toggle favorite state of this room.
   */
  onFavoriteToggle: (favorite: boolean) => void;
  /**
   * Focus/unfocus the speak input.
   */
  onFocus: (focus: boolean) => void;
  /**
   * Whether use wide page.
   */
  widePage: boolean;
  timer?: {
    enabled: boolean;
    name: string; // 阶段名称
    target: number; // 结束时间戳
  };
}
/**
 * Speaking controls.
 */
interface AutocompleteState {
  show: boolean;
  position: { top: number; left: number };
  searchTerm: string;
  items: AutocompleteItem[];
  triggerStart: number; // Position of the trigger character
  triggerChar: string; // The trigger character that was used ("、" or "/")
  shortcuts: AutocompleteItem[]; // Quick input shortcuts
  selectedIndex: number; // Currently selected item index
}

const defaultQuickInputShortcuts: AutocompleteItem[] = [
  { label: '●', value: '●', type: 'shortcut', searchKey: '黑' },
  { label: '○', value: '○', type: 'shortcut', searchKey: '白' },
];

export class SpeakForm extends React.PureComponent<
  IPropSpeakForm,
  {
    /**
     * Whether additional controls are shown,
     * only effective on phones UI.
     */
    additionalControlsShown: boolean;
    /**
     * Current character count.
     */
    charCount: number;
    /**
     * Autocomplete state.
     */
    autocomplete: AutocompleteState;
  }
> {
  state = {
    additionalControlsShown: false,
    charCount: 0,
    autocomplete: {
      show: false,
      position: { top: 0, left: 0 },
      searchTerm: '',
      items: [],
      triggerStart: 0,
      triggerChar: '',
      shortcuts: defaultQuickInputShortcuts,
      selectedIndex: 0,
    },
  };
  protected comment: HTMLInputElement | HTMLTextAreaElement | null = null;
  /**
   * Temporally saved comment.
   */
  protected commentString: string = loadSpeakDraftFromStorage();
  /**
   * Temporal flag to focus on the comment input.
   */
  protected focus: boolean = false;
  public render() {
    const {
      gameInfo,
      roleInfo,
      players,
      size,
      kind,
      multiline,
      willOpen,
      noteOpen,
      logVisibility,
      rule,
      widePage,
      timer,
    } = this.props;
    const { additionalControlsShown, charCount } = this.state;
    // whether speech is allowed.
    const speakAllowed = !(roleInfo == null && !gameInfo.watchspeak);
    const nsecondSilent = (() => {
      if (roleInfo == null) {
        // not init
        return true;
      }
      const jobname = (roleInfo as any).jobname;
      const dead = (roleInfo as any).dead;
      const phase = (timer as any).name;

      // rule1 gamemaster
      if (jobname === '游戏管理员') {
        return true;
      }

      // rule2 silentphase
      if (dead == false && phase == '禁止发言') {
        return false;
      }

      return true;
    })();
    // list of speech kind.
    const speaks = roleInfo != null ? roleInfo.speak : ['day'];
    const playersMap = makeMapByKey(players, 'id');
    return (
      <I18n>
        {t => {
          return (
            <IsPhone>
              {isPhone => {
                // whether additional controls are actually hidden.
                const othersHidden = isPhone && !additionalControlsShown;
                return (
                  <>
                    <MainForm onSubmit={this.handleSubmit}>
                      {/* Comment input form. */}
                      <SpeakInputArea>
                        {!speakAllowed ? (
                          <SpeakInput
                            key="nonallowed-speakinput"
                            ref={e => (this.comment = e)}
                            type="text"
                            size={50}
                            disabled
                            value={t('game_client:speak.noWatchSpeak')}
                          />
                        ) : multiline ? (
                          <InputWithCountWrapper>
                            <SpeakTextArea
                              key="allowed-speakinput-multiline"
                              ref={e => (this.comment = e)}
                              id="speak-comment-multiline"
                              name="comment"
                              cols={50}
                              rows={4}
                              required
                              autoComplete="off"
                              defaultValue={this.commentString}
                              onChange={this.handleCommentChange}
                              onKeyDown={this.handleKeyDownComment as any}
                              onFocus={this.handleFocus}
                              onBlur={this.handleBlur}
                            />
                            <CharCount hasContent={charCount > 0}>
                              {charCount}
                            </CharCount>
                          </InputWithCountWrapper>
                        ) : (
                          <InputWithCountWrapper>
                            <SpeakInput
                              key="allowed-speakinput"
                              ref={e => (this.comment = e)}
                              id="speak-comment"
                              name="comment"
                              type="text"
                              size={50}
                              required
                              autoComplete="off"
                              defaultValue={this.commentString}
                              onChange={this.handleCommentChange}
                              onKeyDown={this.handleKeyDownComment}
                              onFocus={this.handleFocus}
                              onBlur={this.handleBlur}
                            />
                            <CharCount hasContent={charCount > 0}>
                              {charCount}
                            </CharCount>
                          </InputWithCountWrapper>
                        )}
                      </SpeakInputArea>
                      {/* Speak button. */}
                      <SpeakButtonArea>
                        <input
                          name="submitSpeak"
                          type="submit"
                          value={t('game_client:speak.say')}
                          disabled={!speakAllowed || !nsecondSilent}
                        />
                      </SpeakButtonArea>
                      {/* Speech-related controls. */}
                      <SpeakControlsArea hidden={othersHidden}>
                        {othersHidden ? (
                          <SpeakControlsSlim>
                            {t('game_client:speak.size.description')}:
                            {t(`game_client:speak.size.${size}`)}
                            {'　'}
                            {speakKindLabel(t, playersMap, kind || speaks[0])}
                          </SpeakControlsSlim>
                        ) : (
                          <>
                            {/* Speak size select control. */}
                            <LabeledControl
                              label={t('game_client:speak.size.description')}
                            >
                              <select
                                id="speak-size"
                                name="speakSize"
                                value={size}
                                onChange={this.handleSizeChange}
                              >
                                <option value="normal">
                                  {t('game_client:speak.size.normal')}
                                </option>
                                <option value="skyblue">
                                  {t('game_client:speak.size.skyblue')}
                                </option>
                                <option value="darkblue">
                                  {t('game_client:speak.size.darkblue')}
                                </option>
                                <option value="brown">
                                  {t('game_client:speak.size.brown')}
                                </option>
                                <option value="green">
                                  {t('game_client:speak.size.green')}
                                </option>
                                <option value="purple">
                                  {t('game_client:speak.size.purple')}
                                </option>
                                <option value="small">
                                  {t('game_client:speak.size.small')}
                                </option>
                                <option value="big">
                                  {t('game_client:speak.size.big')}
                                </option>
                              </select>
                            </LabeledControl>
                            {/* Speech kind selection. */}
                            <LabeledControl
                              label={t('game_client:speak.kind.description')}
                            >
                              <SpeakKindSelect
                                kinds={speaks}
                                current={kind}
                                id="speak-kind"
                                name="speakKind"
                                t={t}
                                playersMap={playersMap}
                                onChange={this.handleKindChange}
                              />
                            </LabeledControl>
                            {/* Multiline checkbox. */}
                            <label>
                              <input
                                type="checkbox"
                                id="multilinecheck"
                                name="multilinecheck"
                                checked={multiline}
                                onChange={this.handleMultilineChange}
                              />
                              {t('game_client:speak.multiline')}
                            </label>
                          </>
                        )}
                      </SpeakControlsArea>
                      {/* Other controls. */}
                      <OthersArea hidden={othersHidden}>
                        {/* Will open button. */}
                        <button type="button" onClick={this.handleWillClick}>
                          {willOpen
                            ? t('game_client:speak.will.close')
                            : t('game_client:speak.will.open')}
                        </button>
                        {/* Note open button. */}
                        <button type="button" onClick={this.handleNoteClick}>
                          {noteOpen
                            ? t('game_client:speak.note.close')
                            : t('game_client:speak.note.open')}
                        </button>
                        {/* Show rule button. */}
                        <RuleButton
                          t={t}
                          handleRuleClick={this.props.onRuleOpen}
                          disabled={!rule}
                          isPhone={isPhone}
                        />
                        {/* Log visibility control. */}
                        <LabeledControl
                          label={t(
                            'game_client:speak.logVisibility.description',
                          )}
                        >
                          <LogVisibilityControl
                            visibility={logVisibility}
                            day={gameInfo.day}
                            id="log-visibility"
                            name="logVisibility"
                            onUpdate={this.handleVisibilityUpdate}
                          />
                        </LabeledControl>
                        {/* Refuse revival button. */}
                        <button
                          type="button"
                          onClick={this.handleRefuseRevival}
                          disabled={gameInfo.status !== 'playing'}
                        >
                          {t('game_client:speak.refuseRevival')}
                        </button>
                        {/* Wide page checkbox. */}
                        {isPhone ? (
                          ''
                        ) : (
                          <label>
                            <input
                              type="checkbox"
                              id="widepagecheck"
                              name="widepagecheck"
                              checked={widePage}
                              onChange={this.handleWidepageChange}
                            />
                            {t('game_client:speak.widepage')}
                          </label>
                        )}
                        {this.renderFavoriteControl()}
                      </OthersArea>
                      <ButtonArea>
                        <ExpandButton
                          isPhone={isPhone}
                          additionalControlsShown={additionalControlsShown}
                          onClick={this.handleAdditionalControls}
                        />
                      </ButtonArea>
                    </MainForm>
                    <WillForm
                      hidden={othersHidden}
                      t={t}
                      open={willOpen}
                      will={(roleInfo && roleInfo.will) || undefined}
                      onWillChange={this.handleWillChange}
                    />
                    <NoteForm
                      hidden={othersHidden}
                      t={t}
                      open={noteOpen}
                      note={undefined}
                      players={players}
                      onNoteChange={this.handleNoteChange}
                    />
                    {/* Autocomplete dropdown */}
                    {this.state.autocomplete.show && (
                      <AutocompleteDropdown
                        items={this.state.autocomplete.items}
                        searchTerm={this.state.autocomplete.searchTerm}
                        position={this.state.autocomplete.position}
                        anchor={this.comment}
                        selectedIndex={this.state.autocomplete.selectedIndex}
                        onSelect={this.handleAutocompleteSelect}
                        onClose={this.handleAutocompleteClose}
                      />
                    )}
                  </>
                );
              }}
            </IsPhone>
          );
        }}
      </I18n>
    );
  }
  public componentDidMount() {}
  public componentDidUpdate() {
    // process the temporal flag to focus.
    if (this.focus && this.comment != null) {
      this.focus = false;
      this.comment.focus();
    }
  }
  /**
   * Forse a focus on speak input.
   */
  public setFocus() {
    if (this.comment != null) {
      this.comment.focus();
    }
  }
  /**
   * Append text to the comment input.
   */
  public appendToComment(text: string) {
    this.commentString += text;
    this.setState({ charCount: this.commentString.length });
    if (this.comment != null) {
      this.comment.value = this.commentString;
      this.comment.focus();
    }
    // Auto-save to localStorage.
    saveSpeakDraftToStorage(this.commentString);
  }
  /**
   * Handle submission of the speak form.
   */
  @bind
  protected handleSubmit(e: React.SyntheticEvent<HTMLFormElement>): void {
    const { kind, size, roleInfo, onInvalidSpeakKind } = this.props;
    e.preventDefault();

    if (roleInfo != null && !roleInfo.speak.includes(kind)) {
      this.props.onUpdate({
        kind: roleInfo.speak[0] || '',
      });
      onInvalidSpeakKind();
      return;
    }

    const query: SpeakQuery = {
      comment: this.commentString,
      mode: kind,
      // XXX compatibility! normal is represented as empty string.
      size:
        size === 'normal'
          ? ''
          : (size as
              | 'big'
              | 'small'
              | 'skyblue'
              | 'darkblue'
              | 'purple'
              | 'green'
              | 'brown'),
    };
    this.props.onSpeak(query);
    // reset the comment form.
    this.commentString = '';
    this.setState({ charCount: 0 });
    if (this.comment != null) {
      this.comment.value = '';
    }
    // Clear draft from localStorage after sending.
    clearSpeakDraftFromStorage();
    // Reset multiline state if not configured to keep.
    const multilineSettings = themeStore.savedTheme.phoneUI.multiline;
    if (multilineSettings && !multilineSettings.keepAfterSend) {
      this.props.onUpdate({
        multiline: false,
      });
    }
  }
  /**
   * Handle a change of comment input.
   */
  @bind
  protected handleCommentChange(
    e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void {
    const value = e.currentTarget.value;
    this.commentString = value;
    this.setState({ charCount: this.commentString.length });
    // Auto-save to localStorage.
    saveSpeakDraftToStorage(this.commentString);

    // Check for autocomplete trigger
    this.handleAutocompleteTrigger(e.currentTarget);
  }

  /**
   * Handle autocomplete trigger detection.
   * Supports multiple trigger characters: "、", "/"
   */
  @bind
  protected handleAutocompleteTrigger(
    input: HTMLInputElement | HTMLTextAreaElement,
  ): void {
    const value = input.value;
    const cursorPos = input.selectionStart || value.length;
    const shortcuts = this.state.autocomplete.shortcuts;

    // Supported trigger characters (user-configurable via settings)
    const triggerConfig = themeStore.savedTheme.phoneUI.autocompleteTrigger || {
      comma: true,
      slash: true,
      at: false,
    };
    const triggers: string[] = [];
    if (triggerConfig.comma) triggers.push('、');
    if (triggerConfig.slash) triggers.push('/');
    if (triggerConfig.at) triggers.push('@');

    // Find the last occurrence of any trigger character before cursor
    let lastTriggerIndex = -1;
    let triggerChar = '';

    for (const trigger of triggers) {
      const index = value.lastIndexOf(trigger, cursorPos);
      if (index > lastTriggerIndex) {
        lastTriggerIndex = index;
        triggerChar = trigger;
      }
    }

    if (lastTriggerIndex !== -1 && lastTriggerIndex < cursorPos) {
      // We have a trigger, get the search term (after the trigger char)
      const searchTerm = value.substring(lastTriggerIndex + 1, cursorPos);

      // Filter items based on search term
      const items = this.getFilteredItems(searchTerm, shortcuts);

      if (items.length > 0 || searchTerm.length > 0) {
        // Calculate dropdown position
        const position = this.calculateDropdownPosition(input);

        this.setState({
          autocomplete: {
            ...this.state.autocomplete,
            show: true,
            position,
            searchTerm,
            items,
            triggerStart: lastTriggerIndex,
            triggerChar,
            selectedIndex: 0,
          },
        });
        return;
      }
    }

    // No trigger or no results, hide autocomplete
    this.setState({
      autocomplete: {
        ...this.state.autocomplete,
        show: false,
        searchTerm: '',
        items: [],
        triggerStart: 0,
        triggerChar: '',
        selectedIndex: 0,
      },
    });
  }

  /**
   * Get filtered items based on search term.
   */
  @bind
  protected getFilteredItems(
    searchTerm: string,
    shortcuts: AutocompleteItem[],
  ): AutocompleteItem[] {
    const { players } = this.props;
    const items: AutocompleteItem[] = [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    // Add all players (no filtering by dead status)
    for (const player of players) {
      if (player.name.toLowerCase().includes(lowerSearchTerm)) {
        items.push({
          label: player.name,
          value: player.name,
          type: 'player',
          searchKey: player.name,
        });
      }
    }

    // Add matching shortcuts (match against searchKey, display label)
    for (const shortcut of shortcuts) {
      if (shortcut.searchKey.toLowerCase().includes(lowerSearchTerm)) {
        items.push(shortcut);
      }
    }

    return items;
  }

  /**
   * Calculate dropdown position based on input element.
   * Returns viewport coordinates (for position: fixed).
   */
  @bind
  protected calculateDropdownPosition(
    input: HTMLInputElement | HTMLTextAreaElement,
  ): { top: number; left: number } {
    const rect = input.getBoundingClientRect();
    const vv = (window as any).visualViewport;

    // On mobile with virtual keyboard, use visualViewport API
    if (vv) {
      const keyboardHeight = window.innerHeight - vv.height;
      const dropdownTop = rect.bottom - keyboardHeight + 4;
      return {
        top: dropdownTop,
        left: rect.left,
      };
    }

    // Desktop: getBoundingClientRect() already returns viewport coordinates
    // Just add a small gap (4px) below the input
    return {
      top: rect.bottom + 4,
      left: rect.left,
    };
  }

  /**
   * Handle autocomplete item selection.
   */
  @bind
  protected handleAutocompleteSelect(item: AutocompleteItem): void {
    const { autocomplete } = this.state;
    const before = this.commentString.substring(0, autocomplete.triggerStart);
    const after = this.commentString.substring(
      autocomplete.triggerStart + autocomplete.searchTerm.length + 1,
    );

    // Replace trigger + search term with selected value
    this.commentString = before + item.value + after;

    this.setState({
      charCount: this.commentString.length,
      autocomplete: {
        ...autocomplete,
        show: false,
        searchTerm: '',
        items: [],
        triggerStart: 0,
        triggerChar: '',
        selectedIndex: 0,
      },
    });

    if (this.comment != null) {
      this.comment.value = this.commentString;
      // Set cursor position after inserted value
      const newPos = autocomplete.triggerStart + item.value.length;
      this.comment.setSelectionRange(newPos, newPos);
      this.comment.focus();
    }

    // Auto-save to localStorage.
    saveSpeakDraftToStorage(this.commentString);
  }

  /**
   * Handle autocomplete close.
   */
  @bind
  protected handleAutocompleteClose(): void {
    this.setState({
      autocomplete: {
        ...this.state.autocomplete,
        show: false,
        searchTerm: '',
        items: [],
        triggerStart: 0,
        triggerChar: '',
        selectedIndex: 0,
      },
    });
  }

  /**
   * Get quick input shortcuts.
   */
  @bind
  protected getQuickInputShortcuts(): AutocompleteItem[] {
    return defaultQuickInputShortcuts;
  }
  /**
   * Handle a keydown event of comment input.
   */
  @bind
  protected handleKeyDownComment(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void {
    const { autocomplete } = this.state;

    // Handle autocomplete navigation
    if (autocomplete.show && autocomplete.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(
          autocomplete.selectedIndex + 1,
          autocomplete.items.length - 1,
        );
        this.setState({
          autocomplete: { ...autocomplete, selectedIndex: newIndex },
        });
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(autocomplete.selectedIndex - 1, 0);
        this.setState({
          autocomplete: { ...autocomplete, selectedIndex: newIndex },
        });
        return;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = Math.max(autocomplete.selectedIndex - 1, 0);
        this.setState({
          autocomplete: { ...autocomplete, selectedIndex: newIndex },
        });
        return;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = Math.min(
          autocomplete.selectedIndex + 1,
          autocomplete.items.length - 1,
        );
        this.setState({
          autocomplete: { ...autocomplete, selectedIndex: newIndex },
        });
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = autocomplete.items[autocomplete.selectedIndex];
        if (selectedItem) {
          this.handleAutocompleteSelect(selectedItem);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.handleAutocompleteClose();
        return;
      }
    }

    // Original keyboard handling
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      // Check if already in multiline mode
      if (this.props.multiline) {
        // In multiline mode, Shift+Enter sends the message
        e.preventDefault();

        // Check if speak button is disabled (禁言时间)
        const { roleInfo, gameInfo, timer } = this.props;
        const speakAllowed = !(roleInfo == null && !gameInfo.watchspeak);

        // Calculate nsecondSilent exactly as in render
        let nsecondSilent = true;
        if (roleInfo == null) {
          nsecondSilent = true;
        } else {
          const jobname = (roleInfo as any).jobname;
          const dead = (roleInfo as any).dead;
          const phase = (timer as any).name;

          // rule1 gamemaster
          if (jobname === '游戏管理员') {
            nsecondSilent = true;
          }
          // rule2 silentphase
          else if (dead == false && phase == '禁止发言') {
            nsecondSilent = false;
          } else {
            nsecondSilent = true;
          }
        }

        // Only submit if speak is allowed
        if (speakAllowed && nsecondSilent) {
          this.handleSubmit(e as any);
        }
        return;
      } else {
        // In single-line mode, this switches to multiline mode
        e.preventDefault();
        this.commentString += '\n';
        this.setState({ charCount: this.commentString.length });
        this.focus = true;
        this.props.onUpdate({
          multiline: true,
        });
      }
    }
  }
  /**
   * Handle a change of comment size.
   */
  @bind
  protected handleSizeChange(e: React.SyntheticEvent<HTMLSelectElement>): void {
    this.props.onUpdate({
      size: e.currentTarget.value as
        | 'small'
        | 'normal'
        | 'big'
        | 'skyblue'
        | 'darkblue'
        | 'purple'
        | 'green'
        | 'brown',
    });
  }
  /**
   * Handle a change of speech kind.
   */
  @bind
  protected handleKindChange(kind: string): void {
    this.props.onUpdate({
      kind,
    });
  }
  /**
   * Handle a change of multiline checkbox.
   */
  @bind
  protected handleMultilineChange(
    e: React.SyntheticEvent<HTMLInputElement>,
  ): void {
    this.props.onUpdate({
      multiline: e.currentTarget.checked,
    });
  }
  /**
   * Handle a change of wide page checkbox.
   */
  @bind
  protected handleWidepageChange(
    e: React.SyntheticEvent<HTMLInputElement>,
  ): void {
    this.props.onUpdate({
      widePage: e.currentTarget.checked,
    });
    localStorage.setItem('widepage', String(e.currentTarget.checked));
  }
  /**
   * Handle a click of favorite button.
   */
  @bind
  protected handleFavoriteClick(): void {
    const { favoriteState, onFavoriteToggle } = this.props;
    onFavoriteToggle(!favoriteState.favorite);
  }
  /**
   * Handle a click of will button.
   */
  @bind
  protected handleWillClick(): void {
    this.props.onUpdate({
      willOpen: !this.props.willOpen,
    });
  }

  private renderFavoriteControl(): React.ReactNode {
    const { favoriteState } = this.props;
    if (!favoriteState.available) {
      return null;
    }
    return (
      <button
        type="button"
        disabled={favoriteState.loading}
        onClick={this.handleFavoriteClick}
      >
        {favoriteState.loading
          ? '处理中...'
          : favoriteState.favorite
          ? '★ 已收藏'
          : '☆ 收藏本房间'}
      </button>
    );
  }
  /**
   * Handle a change to the will.
   */
  @bind
  protected handleWillChange(will: string): void {
    const { onUpdate, onWillChange } = this.props;
    // close will form.
    onUpdate({
      willOpen: false,
    });
    onWillChange(will);
  }
  /**
   * Handle a click of note button.
   */
  @bind
  protected handleNoteClick(): void {
    this.props.onUpdate({
      noteOpen: !this.props.noteOpen,
    });
  }
  /**
   * Handle a change to the note.
   */
  @bind
  protected handleNoteChange(note: string): void {
    const { onUpdate, onNoteChange } = this.props;
    // close note form.
    onUpdate({
      noteOpen: false,
    });
    onNoteChange(note);
  }
  /**
   * Handle an update of log visibility.
   */
  @bind
  protected handleVisibilityUpdate(v: LogVisibility): void {
    this.props.onUpdateLogVisibility(v);
  }
  /**
   * Handle a click of refuse revival button.
   */
  @bind
  protected handleRefuseRevival(): void {
    this.props.onRefuseRevival();
  }
  /**
   * Handle a click of additional controls button.
   */
  @bind
  protected handleAdditionalControls(): void {
    this.setState(s => ({
      additionalControlsShown: !s.additionalControlsShown,
    }));
  }
  /**
   * Handle a focus of speak input.
   */
  @bind
  protected handleFocus(): void {
    this.props.onFocus(true);
  }
  /**
   * Handle a blur of speak input.
   */
  @bind
  protected handleBlur(): void {
    this.props.onFocus(false);
  }
}

const ExpandButton = withTheme(
  ({
    theme,
    isPhone,
    additionalControlsShown,
    onClick,
  }: {
    theme: Theme;
    isPhone: boolean;
    additionalControlsShown: boolean;
    onClick: () => void;
  }) => {
    return (
      <SensitiveButton type="button" hidden={!isPhone} onClick={onClick}>
        <FontAwesomeIcon
          icon={
            additionalControlsShown !==
            (theme.user.speakFormPosition === 'normal')
              ? 'caret-square-down'
              : 'caret-square-up'
          }
        />
      </SensitiveButton>
    );
  },
);

const RuleButton = withTheme(
  ({
    theme,
    isPhone,
    t,
    handleRuleClick,
    disabled,
  }: {
    theme: Theme;
    t: TranslationFunction;
    handleRuleClick: (scroll: boolean) => void;
    isPhone: boolean;
    disabled: boolean;
  }) => (
    <button
      type="button"
      onClick={() =>
        handleRuleClick(isPhone && theme.user.speakFormPosition === 'fixed')
      }
      disabled={disabled}
    >
      {t('game_client:speak.rule')}
    </button>
  ),
);
