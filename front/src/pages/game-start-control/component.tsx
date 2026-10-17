import { observer } from 'mobx-react';
import * as React from 'react';
import styled, { ThemeProvider } from '../../util/styled';
import { themeStore } from '../../theme';

import { WideButton } from '../../common/button';
import { showConfirmDialog, showMessageDialog } from '../../dialog';
import { Select } from '../../common/forms/select';
import {
  CastingDefinition,
  LabeledGroup,
  RoleCategoryDefinition,
  RuleGroup,
} from '../../defs';
import { bind } from '../../util/bind';
import {
  findLabeledGroupItem,
  SelectLabeledGroup,
  IPropSelectLabeledGroup,
} from '../../util/labeled-group';
import { ReactCtor } from '../../util/react-type';

import { JobsString, PlayerNumberError } from './jobs-string';
import { gameStart } from './logic';
import { RuleControl } from './rule-control';
import { SelectRoles } from './select-roles';
import { CastingStore } from './store';

import { i18n, I18n, I18nProvider } from '../../i18n';
import { AppStyling } from '../../styles/phone';

interface GameStartTemplate {
  id: string;
  name: string;
  rule: string;
  updatedAt: string;
}

interface IStateCasting {
  templates: GameStartTemplate[];
  selectedTemplateId: string;
}

const gameStartTemplatesStorageKey = 'jinrou-game-start-templates';

function loadGameStartTemplates(): GameStartTemplate[] {
  try {
    const raw = localStorage.getItem(gameStartTemplatesStorageKey);
    if (raw == null) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (template): template is GameStartTemplate =>
        typeof template?.id === 'string' &&
        typeof template?.name === 'string' &&
        typeof template?.rule === 'string' &&
        typeof template?.updatedAt === 'string',
    );
  } catch {
    return [];
  }
}

function saveGameStartTemplates(templates: GameStartTemplate[]): void {
  try {
    localStorage.setItem(
      gameStartTemplatesStorageKey,
      JSON.stringify(templates),
    );
  } catch {
    // Ignore storage errors.
  }
}

const StatusLine = styled.div`
  position: sticky;
  top: 0;

  padding: 0.3em;
  background-color: ${props => props.theme.user.day.bg || 'transparent'};
`;

interface IPropCasting {
  /**
   * i18n instance.
   */
  i18n: i18n;
  /**
   * store.
   */
  store: CastingStore;
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
   * Categories including hidden roles.
   */
  allCategories: RoleCategoryDefinition[];
  /**
   * Definition of rules.
   */
  ruledefs: RuleGroup;
  /**
   * Event of pressing gamestart button.
   */
  onStart: (query: Record<string, string>) => void;
  /**
   * Save current draft.
   */
  onDraftSave: () => void;
}

@observer
export class Casting extends React.Component<IPropCasting, IStateCasting> {
  public state: IStateCasting = {
    templates: loadGameStartTemplates(),
    selectedTemplateId: '',
  };
  public render() {
    const {
      i18n,
      store,
      roles,
      castings,
      categories,
      allCategories,
      ruledefs,
    } = this.props;
    const {
      playersNumber,
      currentCasting,
      jobNumbers,
      jobInclusions,
      categoryNumbers,
      ruleObject,
    } = store;

    // Check whether current number of players is admissible.
    const { min = undefined, max = undefined } =
      currentCasting.suggestedPlayersNumber || {};
    const minReq = Math.max(min || -Infinity, store.requiredPlayersNumber);

    // Specialized generic component.
    const SLG: ReactCtor<
      IPropSelectLabeledGroup<CastingDefinition, string>,
      {}
    > = SelectLabeledGroup;

    // XXX some of themes are not provided!
    const theme = {
      user: themeStore.themeObject,
      teamColors: {},
    };

    return (
      <ThemeProvider theme={theme} mode={null}>
        <I18nProvider i18n={i18n}>
          <I18n namespace="game_client">
            {t => {
              // status line indicating jobs.
              const warning =
                max && max < playersNumber ? (
                  <p>
                    <PlayerNumberError t={t} maxNumber={max} />
                  </p>
                ) : minReq > playersNumber ? (
                  <p>
                    <PlayerNumberError t={t} minNumber={minReq} />
                  </p>
                ) : null;
              // name of this casting.
              const castingName = t(
                `casting:castingName.${store.currentCasting.id}`,
              );
              const castingTitle = t(
                `casting:castingTitle.${store.currentCasting.id}`,
              );
              return (
                <Wrapper>
                  <StatusLine>
                    {t('gamestart.info.playerNumber', { count: playersNumber })}
                    {' - '}
                    {castingName}
                    {store.currentCasting.noShow ? null : (
                      <>
                        {' / '}
                        <JobsString
                          t={t}
                          i18n={i18n}
                          jobNumbers={jobNumbers}
                          categoryNumbers={categoryNumbers}
                          roles={roles}
                          categories={allCategories}
                        />
                      </>
                    )}
                    {warning}
                  </StatusLine>
                  <fieldset>
                    <legend>{t('gamestart.control.roles')}</legend>

                    <p>
                      <SLG
                        name="castingDefinition"
                        items={castings}
                        value={currentCasting.id}
                        getGroupLabel={(x: string) => ({
                          key: x,
                          label: t(`casting:castingGroupName.${x}._name`),
                        })}
                        getOptionKey={({ id }: CastingDefinition) => id}
                        makeOption={(obj: CastingDefinition) => {
                          return (
                            <option
                              value={obj.id}
                              title={t(`casting:castingTitle.${obj.id}`)}
                            >
                              {t(`casting:castingName.${obj.id}`)}
                            </option>
                          );
                        }}
                        onChange={this.handleCastingChange}
                      />
                      {'　'}
                      <b>{castingName}</b>: {castingTitle}
                    </p>
                    {currentCasting.roleSelect ? (
                      <SelectRoles
                        categories={categories}
                        t={t}
                        jobNumbers={jobNumbers}
                        jobInclusions={jobInclusions}
                        categoryNumbers={categoryNumbers}
                        roleExclusion={currentCasting.roleExclusion || false}
                        noFill={currentCasting.noFill || false}
                        useCategory={currentCasting.category || false}
                        onUpdate={this.handleJobUpdate}
                        onCategoryUpdate={this.handleCategoryUpdate}
                      />
                    ) : null}
                  </fieldset>
                  {/* Controls for rules. */}
                  <fieldset>
                    <legend>{t('gamestart.control.rules')}</legend>
                    <RuleControl
                      t={t}
                      ruledefs={ruledefs}
                      ruleObject={ruleObject}
                      suggestedOptions={currentCasting.suggestedOptions}
                      onUpdate={this.handleRuleUpdate}
                    />
                  </fieldset>
                  <fieldset>
                    <legend>{t('gamestart.template.title')}</legend>
                    <TemplateControls>
                      <Select
                        value={this.state.selectedTemplateId}
                        onChange={this.handleTemplateChange}
                      >
                        <option value="">{t('gamestart.template.none')}</option>
                        {this.state.templates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </Select>
                      <TemplateButton
                        type="button"
                        onClick={this.handleTemplateSave}
                      >
                        {t('gamestart.template.save')}
                      </TemplateButton>
                      <TemplateButton
                        type="button"
                        disabled={!this.state.selectedTemplateId}
                        onClick={this.handleTemplateApply}
                      >
                        {t('gamestart.template.apply')}
                      </TemplateButton>
                      <TemplateButton
                        type="button"
                        disabled={!this.state.selectedTemplateId}
                        onClick={this.handleTemplateDelete}
                      >
                        {t('gamestart.template.delete')}
                      </TemplateButton>
                    </TemplateControls>
                  </fieldset>
                  {/* Game start button */}
                  <div>
                    <WideButton onClick={this.handleGameStart}>
                      {t('gamestart.control.start')}
                    </WideButton>
                  </div>
                </Wrapper>
              );
            }}
          </I18n>
        </I18nProvider>
      </ThemeProvider>
    );
  }
  public componentDidCatch(err: any) {
    console.error(err);
  }
  @bind
  protected handleCastingChange(value: CastingDefinition): void {
    this.props.store.setCurrentCasting(value);
    this.props.onDraftSave();
  }
  @bind
  protected handleJobUpdate(
    role: string,
    value: number,
    included: boolean,
  ): void {
    this.props.store.updateJobNumber(role, value, included);
    this.props.onDraftSave();
  }
  @bind
  protected handleCategoryUpdate(cat: string, value: number): void {
    this.props.store.updateCategoryNumber(cat, value);
    this.props.onDraftSave();
  }
  @bind
  protected handleRuleUpdate(rule: string, value: string): void {
    this.props.store.updateRule(rule, value);
    this.props.onDraftSave();
  }
  @bind
  protected handleTemplateChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void {
    this.setState({ selectedTemplateId: event.target.value });
  }
  @bind
  protected handleTemplateSave(): void {
    const name = window.prompt(
      this.props.i18n.t('game_client:gamestart.template.namePrompt') as string,
    );
    const normalizedName = name?.trim();
    if (!normalizedName) {
      return;
    }
    const rule = this.props.store.serializedRule;
    const now = new Date().toISOString();
    this.setState(current => {
      const oldTemplate = current.templates.find(
        template => template.name === normalizedName,
      );
      const template: GameStartTemplate = {
        id:
          oldTemplate?.id ||
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
        name: normalizedName,
        rule,
        updatedAt: now,
      };
      const templates = [
        template,
        ...current.templates.filter(item => item.name !== normalizedName),
      ];
      saveGameStartTemplates(templates);
      return { templates, selectedTemplateId: template.id };
    });
  }
  @bind
  protected async handleTemplateApply(): Promise<void> {
    const template = this.state.templates.find(
      item => item.id === this.state.selectedTemplateId,
    );
    if (template == null) {
      return;
    }
    const { castings, i18n, store } = this.props;
    const preview = this.makeTemplatePreview(template.rule);
    if (preview == null) {
      await showMessageDialog({
        modal: true,
        title: i18n.t('game_client:gamestart.template.title') as string,
        message: i18n.t('game_client:gamestart.template.invalid') as string,
        ok: i18n.t('game_client:gamestart.template.close') as string,
      });
      return;
    }
    const accepted = await showConfirmDialog({
      modal: true,
      title: i18n.t('game_client:gamestart.template.previewTitle', {
        name: template.name,
      }) as string,
      message: preview,
      yes: i18n.t('game_client:gamestart.template.apply') as string,
      no: i18n.t('game_client:gamestart.template.cancel') as string,
    });
    if (!accepted) {
      return;
    }
    store.loadSerializedRule(
      template.rule,
      castingId =>
        findLabeledGroupItem(castings, item => item.id === castingId) || null,
    );
    this.props.onDraftSave();
  }
  @bind
  protected handleTemplateDelete(): void {
    const selectedTemplateId = this.state.selectedTemplateId;
    if (!selectedTemplateId) {
      return;
    }
    this.setState(current => {
      const templates = current.templates.filter(
        template => template.id !== selectedTemplateId,
      );
      saveGameStartTemplates(templates);
      return { templates, selectedTemplateId: '' };
    });
  }
  protected makeTemplatePreview(rule: string): string | null {
    try {
      const parsed = JSON.parse(rule);
      if (typeof parsed?.casting !== 'string') {
        return null;
      }
      const { i18n } = this.props;
      const lines = [
        i18n.t('game_client:gamestart.template.preview.casting', {
          name: i18n.t(`casting:castingName.${parsed.casting}`),
        }),
      ];
      const appendValues = (key: string, values: Record<string, unknown>) => {
        const entries = Object.entries(values || {}).filter(
          ([, value]) => value !== 0 && value !== '' && value !== false,
        );
        if (entries.length > 0) {
          lines.push(
            `${i18n.t(
              `game_client:gamestart.template.preview.${key}`,
            )}: ${entries
              .map(([name, value]) => `${name}=${value}`)
              .join(', ')}`,
          );
        }
      };
      appendValues('roles', parsed.jobNumbers);
      appendValues('categories', parsed.categoryNumbers);
      appendValues('rules', parsed.rules);
      return lines.join('\n');
    } catch {
      return null;
    }
  }
  @bind
  protected async handleGameStart(): Promise<void> {
    const { i18n, roles, categories, ruledefs, store, onStart } = this.props;
    const query = await gameStart({
      i18n: this.props.i18n,
      roles,
      categories,
      ruledefs,
      store,
    });

    if (query != null) {
      onStart(query);
    }
  }
}

const Wrapper = styled(AppStyling)`
  margin-bottom: 1.2em;
`;

const TemplateControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em;
`;

const TemplateButton = styled.button`
  padding: 0.35em 0.6em;
`;
