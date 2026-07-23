import * as React from 'react';
import { i18n, I18nProvider } from '../../i18n';
import {
  MarkdownButton,
  MarkdownToolbar,
  TemplateControls,
  VillageRulesRichEditor,
  VillageRulesRichEditorSurface,
  Wrapper,
} from './elements';
import {
  Controls,
  ControlsWrapper,
  ControlsName,
  ControlsDescription,
  ControlsHeader,
  ControlsMain,
  InlineControl,
} from '../../common/forms/controls-wrapper';
import { Input } from '../../common/forms/text';
import { RadioButtons } from '../../common/forms/radio';
import { useI18n } from '../../i18n/react';
import { NewRoomStore } from './store';
import { observer } from 'mobx-react-lite';
import { FontAwesomeIcon } from '../../util/icon';
import { NormalButton, WideButton } from '../../common/button';
import { CheckButton } from '../../common/forms/check-button';
import { Select } from '../../common/forms/select';
import { showConfirmDialog } from '../../dialog';

export interface ThemeDoc {
  /**
   * displayed name of theme.
   */
  name: string;
  /**
   * ID of theme.
   */
  value: string;
}

export interface IPropNewRoom {
  themes: ThemeDoc[];
  store: NewRoomStore;
  roomDefaults?: {
    villageRules?: string;
  };
  onCreate(query: unknown): void;
}

interface VillageRuleTemplate {
  id: string;
  name: string;
  content: string;
  updatedAt: string;
}

const villageRuleTemplatesStorageKey = 'jinrou-village-rule-templates';

function loadVillageRuleTemplates(): VillageRuleTemplate[] {
  try {
    const raw = localStorage.getItem(villageRuleTemplatesStorageKey);
    if (raw == null) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (template): template is VillageRuleTemplate =>
        typeof template?.id === 'string' &&
        typeof template?.name === 'string' &&
        typeof template?.content === 'string' &&
        typeof template?.updatedAt === 'string',
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

function saveVillageRuleTemplates(templates: VillageRuleTemplate[]): void {
  localStorage.setItem(
    villageRuleTemplatesStorageKey,
    JSON.stringify(templates),
  );
}

function appendVillageRuleInline(parent: HTMLElement, text: string): void {
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      parent.appendChild(strong);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

function renderVillageRulesEditor(root: HTMLElement, content: string): void {
  root.replaceChildren();
  let radioGroup = 0;
  let previousWasRadio = false;
  for (const line of content.split(/\r?\n/)) {
    if (line === '---') {
      root.appendChild(document.createElement('br'));
      continue;
    }
    const checkbox = line.match(/^- \[([ xX])\] (.*)$/);
    const radio = line.match(/^- \(([ xX])\) (.*)$/);
    const bullet = line.match(/^- (.*)$/);
    const heading = line.match(/^(#{1,2}) (.*)$/);
    let node: HTMLElement;

    if (heading) {
      node = document.createElement(heading[1] === '#' ? 'h3' : 'h4');
      appendVillageRuleInline(node, heading[2]);
    } else if (checkbox || radio) {
      if (radio && !previousWasRadio) {
        radioGroup += 1;
      }
      node = document.createElement('label');
      const input = document.createElement('input');
      input.type = checkbox ? 'checkbox' : 'radio';
      input.name = radio ? `village-rule-radio-${radioGroup}` : '';
      input.checked = (checkbox || radio)![1].toLowerCase() === 'x';
      input.contentEditable = 'false';
      node.appendChild(input);
      appendVillageRuleInline(node, (checkbox || radio)![2]);
      node.appendChild(document.createTextNode('\u200B'));
    } else {
      node = document.createElement('div');
      if (bullet) {
        node.appendChild(document.createTextNode('• '));
        appendVillageRuleInline(node, bullet[1]);
      } else if (line) {
        appendVillageRuleInline(node, line);
      } else {
        node.appendChild(document.createElement('br'));
      }
    }
    root.appendChild(node);
    previousWasRadio = radio != null;
  }
  ensureVillageRuleCaretAnchors(root);
}

function ensureVillageRuleCaretAnchors(root: HTMLElement): void {
  root.querySelectorAll('label').forEach(label => {
    const input = label.querySelector<HTMLInputElement>('input');
    if (input != null && !label.textContent?.includes('\u200B')) {
      label.appendChild(document.createTextNode('\u200B'));
    }
    if (input != null) {
      label.style.fontWeight = input.checked ? 'bold' : 'normal';
    }
  });
  const lastNode = root.lastChild;
  if (
    lastNode?.nodeType !== Node.TEXT_NODE ||
    !lastNode.textContent?.includes('\u200B')
  ) {
    // Keep an editable caret position after a final non-editable choice control.
    root.appendChild(document.createTextNode('\u200B'));
  }
}

function serializeVillageRuleInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\u200B/g, '');
  }
  if (!(node instanceof HTMLElement) || node.tagName === 'INPUT') {
    return '';
  }
  if (node.tagName === 'BR') {
    return '';
  }
  const content = Array.from(node.childNodes)
    .map(serializeVillageRuleInline)
    .join('');
  return node.tagName === 'STRONG' || node.tagName === 'B'
    ? `**${content}**`
    : content;
}

function isVillageRuleChoice(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.querySelector('input') != null;
}

function serializeVillageRulesEditor(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .flatMap(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        return [(node.textContent || '').replace(/\u200B/g, '')];
      }
      if (!(node instanceof HTMLElement)) {
        return [];
      }
      if (node.tagName === 'BR') {
        return ['---'];
      }
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        return Array.from(node.querySelectorAll(':scope > li')).map(
          item => `- ${serializeVillageRuleInline(item)}`,
        );
      }
      const input = node.querySelector<HTMLInputElement>('input');
      if (input?.type === 'checkbox') {
        return [
          `- [${input.checked ? 'x' : ' '}] ${serializeVillageRuleInline(
            node,
          )}`,
        ];
      }
      if (input?.type === 'radio') {
        return [
          `- (${input.checked ? 'x' : ' '}) ${serializeVillageRuleInline(
            node,
          )}`,
        ];
      }
      const content = serializeVillageRuleInline(node).replace(/^•\s*/, '');
      if (node.tagName === 'H3') {
        return [`# ${content}`];
      }
      if (node.tagName === 'H4') {
        return [`## ${content}`];
      }
      return [content];
    })
    .join('\n');
}

function VillageRulesRichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const renderedValueRef = React.useRef<string | null>(null);
  const sync = React.useCallback(() => {
    if (editorRef.current != null) {
      ensureVillageRuleCaretAnchors(editorRef.current);
      const next = serializeVillageRulesEditor(editorRef.current);
      renderedValueRef.current = next;
      onChange(next);
    }
  }, [onChange]);

  React.useEffect(() => {
    if (editorRef.current != null && renderedValueRef.current !== value) {
      renderVillageRulesEditor(editorRef.current, value);
      renderedValueRef.current = value;
    }
  }, [value]);

  const runCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    sync();
  };
  const insertList = () => {
    const editor = editorRef.current;
    editor?.focus();
    if (!editor?.textContent?.replace(/\u200B/g, '').trim()) {
      document.execCommand('insertHTML', false, '<ul><li>项目</li></ul>');
    } else {
      document.execCommand('insertUnorderedList');
    }
    sync();
  };
  const preserveSelection = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };
  const insertLayoutBreak = () => {
    const editor = editorRef.current;
    if (editor == null) {
      return;
    }
    const selection = window.getSelection();
    let line = selection?.anchorNode || null;
    while (line?.parentNode != null && line.parentNode !== editor) {
      line = line.parentNode;
    }
    const lineBreak = document.createElement('br');
    if (line != null && line !== editor) {
      editor.insertBefore(lineBreak, line.nextSibling);
    } else {
      editor.appendChild(lineBreak);
    }
    const range = document.createRange();
    range.setStartAfter(lineBreak);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    sync();
  };
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = e.currentTarget;
    const selection = window.getSelection();
    let line = selection?.anchorNode || null;
    while (line?.parentNode != null && line.parentNode !== editor) {
      line = line.parentNode;
    }
    if (
      e.key === 'Backspace' &&
      selection?.isCollapsed &&
      isVillageRuleChoice(line) &&
      selection.rangeCount > 0
    ) {
      const beforeCaret = selection.getRangeAt(0).cloneRange();
      beforeCaret.selectNodeContents(line);
      beforeCaret.setEnd(selection.anchorNode!, selection.anchorOffset);
      if (!beforeCaret.toString()) {
        e.preventDefault();
        const previous = line.previousSibling;
        const next = line.nextSibling;
        line.remove();
        if (next instanceof HTMLBRElement && !isVillageRuleChoice(previous)) {
          next.remove();
        }
        const range = document.createRange();
        if (next?.parentNode === editor) {
          range.setStartBefore(next);
        } else if (previous?.parentNode === editor) {
          range.setStartAfter(previous);
        } else {
          range.setStart(editor, 0);
        }
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        sync();
        return;
      }
    }
    if (e.key !== 'Enter' || e.shiftKey) {
      return;
    }
    if (!(line instanceof HTMLElement)) {
      return;
    }
    const radio = line.querySelector<HTMLInputElement>('input[type="radio"]');
    if (radio != null) {
      e.preventDefault();
      const option = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = radio.name;
      input.contentEditable = 'false';
      const text = document.createTextNode('选项');
      option.append(input, text, document.createTextNode('\u200B'));
      editor?.insertBefore(option, line.nextSibling);
      const range = document.createRange();
      range.selectNodeContents(text);
      selection?.removeAllRanges();
      selection?.addRange(range);
      sync();
      return;
    }
    if (line.querySelector('input') != null) {
      e.preventDefault();
      insertLayoutBreak();
    }
  };
  const insertChoice = (type: 'checkbox' | 'radio') => {
    editorRef.current?.focus();
    const checkbox = '<input type="checkbox" contenteditable="false">';
    const radioGroup = `village-rule-radio-${Date.now()}`;
    const radio = `<input type="radio" name="${radioGroup}" contenteditable="false">`;
    const content =
      type === 'checkbox'
        ? `<label>${checkbox}选项\u200B</label>`
        : `<label>${radio}选项一\u200B</label><label>${radio}选项二\u200B</label>`;
    document.execCommand('insertHTML', false, content);
    sync();
  };

  return (
    <VillageRulesRichEditor>
      <MarkdownToolbar aria-label="村规格式工具">
        <MarkdownButton
          type="button"
          title="加粗"
          onMouseDown={preserveSelection}
          onClick={() => runCommand('bold')}
        >
          加粗
        </MarkdownButton>
        <MarkdownButton
          type="button"
          title="项目列表"
          onMouseDown={preserveSelection}
          onClick={insertList}
        >
          列表
        </MarkdownButton>
        <MarkdownButton
          type="button"
          title="多选项"
          onMouseDown={preserveSelection}
          onClick={() => insertChoice('checkbox')}
        >
          多选
        </MarkdownButton>
        <MarkdownButton
          type="button"
          title="单选项"
          onMouseDown={preserveSelection}
          onClick={() => insertChoice('radio')}
        >
          单选
        </MarkdownButton>
        <MarkdownButton
          type="button"
          title="强制换行"
          onMouseDown={preserveSelection}
          onClick={insertLayoutBreak}
        >
          换行
        </MarkdownButton>
      </MarkdownToolbar>
      <VillageRulesRichEditorSurface
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={sync}
        onChange={sync}
        onKeyDown={handleEditorKeyDown}
        onPaste={e => {
          e.preventDefault();
          document.execCommand(
            'insertText',
            false,
            e.clipboardData.getData('text/plain'),
          );
          sync();
        }}
      />
    </VillageRulesRichEditor>
  );
}

export const NewRoom: React.FunctionComponent<IPropNewRoom> = observer(
  ({ themes, store, roomDefaults, onCreate }) => {
    const t = useI18n('newroom_client');
    const nameInputRef = React.useRef<HTMLInputElement | null>(null);
    const passwordInputRef = React.useRef<HTMLInputElement | null>(null);
    const commentInputRef = React.useRef<HTMLInputElement | null>(null);
    const maxNumberInputRef = React.useRef<HTMLInputElement | null>(null);
    const themeSelectRef = React.useRef<HTMLSelectElement | null>(null);
    const templateSelectRef = React.useRef<HTMLSelectElement | null>(null);
    const [villageRuleTemplates, setVillageRuleTemplates] = React.useState<
      VillageRuleTemplate[]
    >(() => loadVillageRuleTemplates());
    const [villageRules, setVillageRules] = React.useState(
      roomDefaults?.villageRules || '',
    );
    // memory of whether submit button was explicitly clicked (or pressed).
    const enterPressedRef = React.useRef(false);

    React.useEffect(() => {
      // initialize store with saved jobs.
      if (localStorage.savedRule) {
        try {
          const savedRule = JSON.parse(localStorage.savedRule);
          if ('number' === typeof savedRule.maxnumber) {
            if (maxNumberInputRef.current != null) {
              maxNumberInputRef.current.value = String(savedRule.maxnumber);
            }
          }
          if ('string' === typeof savedRule.blind) {
            store.setBlind(savedRule.blind);
          }
          if ('boolean' === typeof savedRule.gm) {
            store.setGm(savedRule.gm);
          }
          if ('boolean' === typeof savedRule.watchspeak) {
            store.setWatchSpeak(savedRule.watchspeak);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }, []);
    const applyVillageRuleTemplate = React.useCallback(
      (selectedId: string) => {
        const template = villageRuleTemplates.find(t => t.id === selectedId);
        if (template != null) {
          setVillageRules(template.content);
        }
      },
      [villageRuleTemplates],
    );
    const saveVillageRuleTemplate = React.useCallback(() => {
      const name = window.prompt(t('villageRules.templateNamePrompt'));
      const normalizedName = name?.trim();
      if (!normalizedName) {
        return;
      }
      const content = villageRules;
      const now = new Date().toISOString();
      setVillageRuleTemplates(current => {
        const oldTemplate = current.find(t => t.name === normalizedName);
        const nextTemplate = {
          id:
            oldTemplate?.id ||
            `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,
          name: normalizedName,
          content,
          updatedAt: now,
        };
        const next = [
          nextTemplate,
          ...current.filter(t => t.name !== normalizedName),
        ];
        saveVillageRuleTemplates(next);
        return next;
      });
    }, [t, villageRules]);
    const deleteVillageRuleTemplate = React.useCallback(() => {
      const selectedId = templateSelectRef.current?.value;
      if (!selectedId) {
        return;
      }
      setVillageRuleTemplates(current => {
        const next = current.filter(t => t.id !== selectedId);
        saveVillageRuleTemplates(next);
        return next;
      });
      if (templateSelectRef.current != null) {
        templateSelectRef.current.value = '';
      }
    }, []);
    const passwordOptions = React.useMemo(
      () => [
        {
          value: 'no',
          label: t('password.no'),
        },
        {
          value: 'yes',
          label: t('password.yes'),
        },
      ],
      [t],
    );
    const blindOptions = React.useMemo(
      () => [
        {
          value: '',
          label: t('blind.no'),
        },
        {
          value: 'yes',
          label: t('game_client:roominfo.blind'),
        },
        {
          value: 'complete',
          label: t('game_client:roominfo.blindComplete'),
        },
      ],
      [t],
    );
    const gmOptions = React.useMemo(
      () => [
        {
          value: 'no',
          label: t('gm.no'),
        },
        {
          value: 'yes',
          label: t('gm.yes'),
        },
      ],
      [t],
    );
    const watchSpeakOptions = React.useMemo(
      () => [
        {
          value: 'no',
          label: t('watchSpeak.no'),
        },
        {
          value: 'yes',
          label: t('watchSpeak.yes'),
        },
      ],
      [t],
    );
    const keydownHandler = (e: React.KeyboardEvent<HTMLFormElement>) => {
      const target = e.target as HTMLInputElement;
      if (e.key !== 'Enter') {
        return;
      }
      if (target.tagName === 'INPUT' && target.type === 'submit') {
        // allow because user explicitly pressed the submit button.
        enterPressedRef.current = false;
      } else {
        enterPressedRef.current = true;
      }
    };
    const submitHandler = (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      const confirmed = !enterPressedRef.current
        ? Promise.resolve(true)
        : showConfirmDialog({
            title: t('title'),
            message: t('confirm.message'),
            yes: t('confirm.yes'),
            no: t('confirm.no'),
          });
      enterPressedRef.current = false;

      confirmed.then(c => {
        if (!c) {
          // canceled by used
          return;
        }

        const getValue = (ref: { current: { value: string } | null }) => {
          return ref.current != null ? ref.current.value : '';
        };
        const query = {
          name: getValue(nameInputRef),
          usepassword: store.usePassword ? 'on' : '',
          password: store.usePassword ? getValue(passwordInputRef) : void 0,
          comment: getValue(commentInputRef),
          villageRules,
          number: getValue(maxNumberInputRef),
          blind: store.blind,
          theme: getValue(themeSelectRef),
          ownerGM: store.gm ? 'yes' : '',
          watchspeak: store.watchSpeak ? 'on' : 'off',
        };
        onCreate(query);
      });
    };
    return (
      <Wrapper>
        <h1>
          {t('title')}
          {'　'}
          <InlineControl>
            <CheckButton
              slim
              checked={store.descriptionShown}
              onChange={value => store.setDescriptionShown(value)}
            >
              {t('showDescriptionButton')}
            </CheckButton>
          </InlineControl>
        </h1>
        <form onSubmit={submitHandler} onKeyDown={keydownHandler}>
          <ControlsWrapper>
            {/* title input */}
            <ControlsHeader>
              <ControlsName>{t('roomname.title')}</ControlsName>
            </ControlsHeader>
            <ControlsMain>
              <Input type="text" required name="room-name" ref={nameInputRef} />
            </ControlsMain>
            {/* password settings */}
            <ControlsHeader>
              <ControlsName>{t('password.title')}</ControlsName>
              {store.descriptionShown ? (
                <ControlsDescription>
                  {t('password.description')}
                </ControlsDescription>
              ) : null}
            </ControlsHeader>
            <ControlsMain>
              <RadioButtons
                onChange={value => store.setUsePassword(value === 'yes')}
                current={store.usePassword ? 'yes' : 'no'}
                options={passwordOptions}
              />
              {!store.usePassword ? null : (
                <>
                  <FontAwesomeIcon icon="lock" />{' '}
                  <Input
                    type="text"
                    required
                    size={30}
                    placeholder={t('password.placeholder')}
                    ref={passwordInputRef}
                  />
                </>
              )}
            </ControlsMain>
            {/* comment input */}
            <ControlsHeader>
              <ControlsName>{t('comment.title')}</ControlsName>
              {store.descriptionShown ? (
                <ControlsDescription>
                  {t('comment.description')}
                </ControlsDescription>
              ) : null}
            </ControlsHeader>
            <ControlsMain>
              <Input type="text" name="room-comment" ref={commentInputRef} />
            </ControlsMain>
            {/* village rules input */}
            <ControlsHeader>
              <ControlsName>{t('villageRules.title')}</ControlsName>
              {store.descriptionShown ? (
                <ControlsDescription>
                  {t('villageRules.description')}
                </ControlsDescription>
              ) : null}
            </ControlsHeader>
            <ControlsMain>
              <VillageRulesRichTextEditor
                value={villageRules}
                onChange={setVillageRules}
              />
              <TemplateControls>
                <Select
                  ref={templateSelectRef}
                  onChange={e => applyVillageRuleTemplate(e.target.value)}
                >
                  <option value="">{t('villageRules.template.none')}</option>
                  {villageRuleTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
                <NormalButton type="button" onClick={saveVillageRuleTemplate}>
                  {t('villageRules.template.save')}
                </NormalButton>
                <NormalButton type="button" onClick={deleteVillageRuleTemplate}>
                  {t('villageRules.template.delete')}
                </NormalButton>
              </TemplateControls>
            </ControlsMain>
          </ControlsWrapper>
          {/* max number of room. */}
          <Controls
            title={t('maxnumber.title')}
            description={
              store.descriptionShown ? t('maxnumber.description') : void 0
            }
            compact={!store.descriptionShown}
          >
            <Input
              type="number"
              size={10}
              defaultValue="30"
              min="5"
              ref={maxNumberInputRef}
            />
          </Controls>
          {/* blind mode */}
          <Controls
            title={t('blind.title')}
            description={
              store.descriptionShown ? t('blind.description') : void 0
            }
            compact={!store.descriptionShown}
          >
            <RadioButtons
              onChange={value => store.setBlind(value as any)}
              current={store.blind}
              options={blindOptions}
            />
          </Controls>
          {/* theme */}
          {themes.length > 0 ? (
            <Controls
              title={t('theme.title')}
              description={
                store.descriptionShown ? t('theme.description') : void 0
              }
              compact={!store.descriptionShown}
            >
              <Select ref={themeSelectRef}>
                <option value="">{t('theme.none')}</option>
                {themes.map(theme => (
                  <option key={theme.value} value={theme.value}>
                    {theme.name}
                  </option>
                ))}
              </Select>
            </Controls>
          ) : null}
          {/* gm */}
          <Controls
            title={t('gm.title')}
            description={store.descriptionShown ? t('gm.description') : void 0}
            compact={!store.descriptionShown}
          >
            <RadioButtons
              onChange={value => store.setGm(value === 'yes')}
              current={store.gm ? 'yes' : 'no'}
              options={gmOptions}
            />
          </Controls>
          {/* watchSpeak */}
          <Controls
            title={t('watchSpeak.title')}
            description={
              store.descriptionShown ? t('watchSpeak.description') : void 0
            }
            compact={!store.descriptionShown}
          >
            <RadioButtons
              onChange={value => store.setWatchSpeak(value === 'yes')}
              current={store.watchSpeak ? 'yes' : 'no'}
              options={watchSpeakOptions}
            />
          </Controls>
          <WideButton type="submit" disabled={store.formDisabled}>
            {t('create')}
          </WideButton>
        </form>
      </Wrapper>
    );
  },
);
