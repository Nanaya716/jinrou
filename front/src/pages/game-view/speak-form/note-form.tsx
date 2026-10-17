import * as React from 'react';
import styled from '../../../util/styled';
import { bind } from '../../../util/bind';
import { TranslationFunction } from '../../../i18n';
import { PlayerInfo } from '../defs';
import { themeStore } from '../../../theme';
import { AutocompleteDropdown, AutocompleteItem } from './autocomplete';

interface IPropNoteForm {
  t: TranslationFunction;
  hidden?: boolean;
  /**
   * Whether the note form is open.
   */
  open: boolean;
  /**
   * Content of note.
   */
  note: string | undefined;
  /**
   * List of players currently in the room.
   */
  players: PlayerInfo[];
  /**
   * Handle of note update.
   */
  onNoteChange: (content: string) => void;
}

interface AutocompleteState {
  show: boolean;
  position: { top: number; left: number };
  searchTerm: string;
  items: AutocompleteItem[];
  triggerStart: number;
  triggerChar: string;
  shortcuts: AutocompleteItem[];
  selectedIndex: number;
}

interface NoteFormState {
  autocomplete: AutocompleteState;
}

const defaultQuickInputShortcuts: AutocompleteItem[] = [
  { label: '●', value: '●', type: 'shortcut', searchKey: '黑' },
  { label: '○', value: '○', type: 'shortcut', searchKey: '白' },
];

// Storage key for note.
const NOTE_STORAGE_KEY = 'jinrou-note-content';

/**
 * Load note from localStorage.
 */
function loadNoteFromStorage(): string {
  try {
    return localStorage.getItem(NOTE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Save note to localStorage.
 */
function saveNoteToStorage(content: string): void {
  try {
    localStorage.setItem(NOTE_STORAGE_KEY, content);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Maximum history size for undo.
 */
const MAX_HISTORY = 50;

/**
 * Form of note.
 */
export class NoteForm extends React.PureComponent<
  IPropNoteForm,
  NoteFormState
> {
  public state: NoteFormState = {
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
  protected textareaRef = React.createRef<HTMLTextAreaElement>();
  /**
   * History stack for undo functionality.
   */
  protected history: string[] = [];
  /**
   * Current history index.
   */
  protected historyIndex: number = -1;
  /**
   * Last saved value for detecting real changes.
   */
  protected lastSavedValue: string = '';

  public render() {
    const { t, hidden, open, players } = this.props;

    // Get note presets from translation.
    const presets1 = (t as any)('game_client:speak.note.notePresets', {
      returnObjects: true,
    });
    const presets2 = (t as any)('game_client:speak.notePresets', {
      returnObjects: true,
    });

    const presets = Array.isArray(presets1) ? undefined : presets1 || presets2;

    return (
      <Wrapper hidden={hidden} open={!hidden && open}>
        <Content>
          <p>{t('game_client:speak.note.message')}</p>
          <p>
            <textarea
              ref={this.textareaRef}
              id="note-content"
              name="noteContent"
              onChange={this.handleChange}
              onKeyDown={this.handleKeyDown}
            />
          </p>
          <PresetsSection>
            <PresetsTitle>{t('game_client:speak.note.insert')}</PresetsTitle>
            <CategorySection>
              <CategoryLabel>
                {t('game_client:speak.note.players')}
              </CategoryLabel>
              <PresetsGrid>
                {players.map(player => (
                  <PresetButton
                    key={player.id}
                    type="button"
                    onClick={() => this.insertText(player.name)}
                  >
                    {player.name}
                  </PresetButton>
                ))}
              </PresetsGrid>
            </CategorySection>
            {presets && (
              <>
                {presets.roles &&
                  Array.isArray(presets.roles) &&
                  presets.roles.length > 0 && (
                    <CategorySection>
                      <CategoryLabel>快捷短语</CategoryLabel>
                      <PresetsGrid>
                        {presets.roles.map((preset: any, index: number) => (
                          <PresetButton
                            key={`role-${index}`}
                            type="button"
                            onClick={() =>
                              this.insertText(
                                typeof preset === 'string'
                                  ? preset
                                  : preset.label || preset.value,
                              )
                            }
                          >
                            {typeof preset === 'string' ? preset : preset.label}
                          </PresetButton>
                        ))}
                      </PresetsGrid>
                    </CategorySection>
                  )}
                {presets.newline && (
                  <CategorySection>
                    <CategoryLabel>操作</CategoryLabel>
                    <PresetsGrid>
                      {presets.paste && (
                        <PresetButton
                          type="button"
                          onClick={() => this.pasteFromClipboard()}
                        >
                          {presets.paste}
                        </PresetButton>
                      )}
                      {presets.undo && (
                        <PresetButton type="button" onClick={() => this.undo()}>
                          {presets.undo}
                        </PresetButton>
                      )}
                      {presets.redo && (
                        <PresetButton type="button" onClick={() => this.redo()}>
                          {presets.redo}
                        </PresetButton>
                      )}
                      <PresetButton
                        type="button"
                        onClick={() => this.insertNewline()}
                      >
                        {presets.newline}
                      </PresetButton>
                    </PresetsGrid>
                  </CategorySection>
                )}
              </>
            )}
          </PresetsSection>
        </Content>
        {this.state.autocomplete.show && (
          <AutocompleteDropdown
            items={this.state.autocomplete.items}
            searchTerm={this.state.autocomplete.searchTerm}
            position={this.state.autocomplete.position}
            anchor={this.textareaRef.current}
            selectedIndex={this.state.autocomplete.selectedIndex}
            onSelect={this.handleAutocompleteSelect}
            onClose={this.handleAutocompleteClose}
          />
        )}
      </Wrapper>
    );
  }

  public componentDidUpdate(prevProps: IPropNoteForm): void {
    const { current } = this.textareaRef;
    const savedNote = loadNoteFromStorage();

    if (this.props.open && !prevProps.open) {
      // Load from localStorage when opening.
      if (current != null && current.value !== savedNote) {
        current.value = savedNote;
        // Initialize history with loaded content.
        this.history = [savedNote];
        this.historyIndex = 0;
        this.lastSavedValue = savedNote;
      }
    }
  }

  /**
   * Save current state to history before making changes.
   * @param force - If true, save even if value hasn't changed
   */
  @bind
  protected saveToHistory(force: boolean = false): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    const currentValue = textarea.value;

    // Don't save if the value hasn't changed from last saved (unless forced).
    if (!force && this.lastSavedValue === currentValue) {
      return;
    }

    // If we're not at the end of history, remove everything after current index.
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add to history.
    this.history.push(currentValue);
    this.lastSavedValue = currentValue;

    // Limit history size.
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  /**
   * Insert text at cursor position or append to the end.
   */
  @bind
  protected insertText(text: string): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    // Save current state to history before inserting.
    this.saveToHistory();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const newValue = value.substring(0, start) + text + value.substring(end);

    textarea.value = newValue;
    textarea.focus();

    // Set cursor after inserted text.
    const newCursorPos = start + text.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Save the new state to history as well (so we can undo back to the state before this insert).
    this.history.push(newValue);
    this.lastSavedValue = newValue;
    this.historyIndex++;

    // Auto-save after inserting text.
    saveNoteToStorage(newValue);
  }

  /**
   * Handle autocomplete trigger detection.
   */
  @bind
  protected handleAutocompleteTrigger(textarea: HTMLTextAreaElement): void {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart || value.length;
    const shortcuts = this.state.autocomplete.shortcuts;

    const triggerConfig = themeStore.savedTheme.phoneUI.autocompleteTrigger || {
      comma: true,
      slash: true,
      at: false,
    };
    const triggers: string[] = [];
    if (triggerConfig.comma) triggers.push('、');
    if (triggerConfig.slash) triggers.push('/');
    if (triggerConfig.at) triggers.push('@');

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
      const searchTerm = value.substring(lastTriggerIndex + 1, cursorPos);
      const items = this.getFilteredItems(searchTerm, shortcuts);

      if (items.length > 0 || searchTerm.length > 0) {
        this.setState({
          autocomplete: {
            ...this.state.autocomplete,
            show: true,
            position: this.calculateDropdownPosition(textarea),
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
   * Get filtered autocomplete items.
   */
  @bind
  protected getFilteredItems(
    searchTerm: string,
    shortcuts: AutocompleteItem[],
  ): AutocompleteItem[] {
    const items: AutocompleteItem[] = [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    for (const player of this.props.players) {
      if (player.name.toLowerCase().includes(lowerSearchTerm)) {
        items.push({
          label: player.name,
          value: player.name,
          type: 'player',
          searchKey: player.name,
        });
      }
    }

    for (const shortcut of shortcuts) {
      if (shortcut.searchKey.toLowerCase().includes(lowerSearchTerm)) {
        items.push(shortcut);
      }
    }

    return items;
  }

  /**
   * Calculate dropdown position based on the note textarea.
   */
  @bind
  protected calculateDropdownPosition(
    textarea: HTMLTextAreaElement,
  ): { top: number; left: number } {
    const rect = textarea.getBoundingClientRect();
    const vv = (window as any).visualViewport;

    if (vv) {
      const keyboardHeight = window.innerHeight - vv.height;
      return {
        top: rect.bottom - keyboardHeight + 4,
        left: rect.left,
      };
    }

    return {
      top: rect.bottom + 4,
      left: rect.left,
    };
  }

  /**
   * Insert selected autocomplete item into the note.
   */
  @bind
  protected handleAutocompleteSelect(item: AutocompleteItem): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    const { autocomplete } = this.state;
    const value = textarea.value;
    const before = value.substring(0, autocomplete.triggerStart);
    const after = value.substring(
      autocomplete.triggerStart + autocomplete.searchTerm.length + 1,
    );
    const newValue = before + item.value + after;

    this.saveToHistory();

    textarea.value = newValue;
    const newPos = autocomplete.triggerStart + item.value.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();

    this.history.push(newValue);
    this.lastSavedValue = newValue;
    this.historyIndex++;
    saveNoteToStorage(newValue);

    this.setState({
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
  }

  /**
   * Close autocomplete dropdown.
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
   * Handle keyboard navigation for note autocomplete.
   */
  @bind
  protected handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    const { autocomplete } = this.state;

    if (!autocomplete.show || autocomplete.items.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.setState({
        autocomplete: {
          ...autocomplete,
          selectedIndex: Math.min(
            autocomplete.selectedIndex + 1,
            autocomplete.items.length - 1,
          ),
        },
      });
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.setState({
        autocomplete: {
          ...autocomplete,
          selectedIndex: Math.max(autocomplete.selectedIndex - 1, 0),
        },
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItem = autocomplete.items[autocomplete.selectedIndex];
      if (selectedItem) {
        this.handleAutocompleteSelect(selectedItem);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.handleAutocompleteClose();
    }
  }

  /**
   * Insert newline at cursor position.
   */
  @bind
  protected insertNewline(): void {
    this.insertText('\n');
  }

  /**
   * Undo last operation.
   */
  @bind
  protected undo(): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    // First, save current state to history if it hasn't been saved.
    if (textarea.value !== this.lastSavedValue) {
      this.saveToHistory();
    }

    // Check if we can undo.
    if (this.historyIndex <= 0) {
      // Already at the beginning, nothing to undo.
      return;
    }

    // Move back in history.
    this.historyIndex--;

    // Restore previous state.
    const previousValue = this.history[this.historyIndex];
    textarea.value = previousValue;
    textarea.focus();

    // Update last saved value.
    this.lastSavedValue = previousValue;

    // Save to localStorage after undo.
    saveNoteToStorage(previousValue);
  }

  /**
   * Redo last undone operation.
   */
  @bind
  protected redo(): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    // Check if we can redo.
    if (this.historyIndex >= this.history.length - 1) {
      // Already at the end, nothing to redo.
      return;
    }

    // Move forward in history.
    this.historyIndex++;

    // Restore next state.
    const nextValue = this.history[this.historyIndex];
    textarea.value = nextValue;
    textarea.focus();

    // Update last saved value.
    this.lastSavedValue = nextValue;

    // Save to localStorage after redo.
    saveNoteToStorage(nextValue);
  }

  /**
   * Paste from clipboard.
   */
  @bind
  protected async pasteFromClipboard(): Promise<void> {
    const textarea = this.textareaRef.current;
    if (!textarea) return;

    try {
      // Try to read from clipboard API
      const text = await navigator.clipboard.readText();
      this.insertText(text);
    } catch {
      // Fallback: use document.execCommand
      textarea.focus();
      document.execCommand('paste');
      // Save to localStorage after paste.
      const newValue = textarea.value;
      saveNoteToStorage(newValue);
      // Also save to history.
      this.saveToHistory();
    }
  }

  /**
   * Handle a change to the textarea (auto-save).
   */
  @bind
  protected handleChange(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const content = e.currentTarget.value;
    // Auto-save to localStorage on every change.
    saveNoteToStorage(content);
    // Save to history when manually editing.
    this.saveToHistory();
    this.handleAutocompleteTrigger(e.currentTarget);
  }
}

/**
 * Wrapper of note form.
 */
const Wrapper = styled.div<{ open: boolean }>`
  transition: height 250ms ease-out;
  display: ${({ open }) => (open ? 'block' : 'none')};
  margin: 0 -8px;
  overflow-y: auto;
  background-color: #636363;
  color: #ffffff;
`;

const Content = styled.div`
  margin: 0.4em;

  textarea {
    width: 40em;
    max-width: 100%;
    height: 6em;
    vertical-align: text-bottom;
    resize: vertical;
  }
`;

const PresetsSection = styled.div`
  margin-top: 0.8em;
  padding-top: 0.8em;
  border-top: 1px solid #888888;
`;

const PresetsTitle = styled.div`
  font-weight: bold;
  margin-bottom: 0.5em;
`;

const CategorySection = styled.div`
  margin-bottom: 0.6em;
`;

const CategoryLabel = styled.div`
  font-size: 0.9em;
  color: #cccccc;
  margin-bottom: 0.3em;
`;

const PresetsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
`;

const PresetButton = styled.button`
  padding: 0.2em 0.6em;
  font-size: 0.85em;
  background-color: #4a4a4a;
  color: #ffffff;
  border: 1px solid #666666;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: #5a5a5a;
    border-color: #888888;
  }

  &:active {
    background-color: #3a3a3a;
  }
`;
