import * as React from 'react';
import { UserSettingsStore } from '../store';
import { withProps } from 'recompose';
import { TranslationFunction } from '../../../i18n';
import { ThemeStore, themeStore } from '../../../theme';
import { observer } from 'mobx-react';
import { withTranslationFunction } from '../../../i18n/react';
import { Controls } from '../../../common/forms/controls-wrapper';
import { Wrapper } from './elements';
import { CheckButton } from '../../../common/forms/check-button';
import { CustomizeTab } from '../defs/tabs';
import { AutocompleteTriggerConfig, MultilineSettings } from '../../../defs';

export interface IPropCustomizeDisp {
  page: CustomizeTab;
  store: UserSettingsStore;
}

interface IPropCustomizeDispInner {
  t: TranslationFunction;
  page: CustomizeTab;
  store: UserSettingsStore;
  themeStore: ThemeStore;
  onTriggerToggle: (key: keyof AutocompleteTriggerConfig) => void;
  onMultilineChange: (key: keyof MultilineSettings) => void;
  onColoredFontBoldToggle: () => void;
}

const defaultTrigger: AutocompleteTriggerConfig = {
  comma: true,
  slash: true,
  at: false,
};

const defaultMultiline: MultilineSettings = {
  defaultEnabled: false,
  keepAfterSend: true,
};

const addProps = withProps(({ store }: IPropCustomizeDisp) => ({
  themeStore,
  onTriggerToggle: (key: keyof AutocompleteTriggerConfig) => {
    const current =
      themeStore.savedTheme.phoneUI.autocompleteTrigger || defaultTrigger;
    themeStore.update({
      phoneUI: {
        ...themeStore.savedTheme.phoneUI,
        autocompleteTrigger: {
          ...current,
          [key]: !current[key],
        },
      },
    });
    themeStore.saveToStorage();
  },
  onMultilineChange: (key: keyof MultilineSettings) => {
    const current = themeStore.savedTheme.phoneUI.multiline || defaultMultiline;
    themeStore.update({
      phoneUI: {
        ...themeStore.savedTheme.phoneUI,
        multiline: {
          ...current,
          [key]: !current[key],
        },
      },
    });
    themeStore.saveToStorage();
  },
  onColoredFontBoldToggle: () => {
    const current = themeStore.savedTheme.phoneUI.coloredFontBold !== false;
    themeStore.update({
      phoneUI: {
        ...themeStore.savedTheme.phoneUI,
        coloredFontBold: !current,
      },
    });
    themeStore.saveToStorage();
  },
}));

const CustomizeDispInner = observer(
  ({
    t,
    onTriggerToggle,
    onMultilineChange,
    onColoredFontBoldToggle,
    themeStore,
  }: IPropCustomizeDispInner) => {
    const trigger =
      themeStore.savedTheme.phoneUI.autocompleteTrigger || defaultTrigger;
    const multiline =
      themeStore.savedTheme.phoneUI.multiline || defaultMultiline;
    const coloredFontBold =
      themeStore.savedTheme.phoneUI.coloredFontBold !== false;
    return (
      <Wrapper>
        <Controls
          title={t('customize.trigger.title')}
          description={t('customize.trigger.description')}
        >
          {(['comma', 'slash', 'at'] as const).map(key => (
            <CheckButton
              key={key}
              checked={trigger[key]}
              onChange={() => onTriggerToggle(key)}
            >
              {t(`customize.trigger.${key}`)}
            </CheckButton>
          ))}
        </Controls>
        <Controls
          title={t('customize.multiline.title')}
          description={t('customize.multiline.description')}
        >
          <CheckButton
            checked={multiline.defaultEnabled}
            onChange={() => onMultilineChange('defaultEnabled')}
          >
            {t('customize.multiline.defaultEnabled')}
          </CheckButton>
          <CheckButton
            checked={multiline.keepAfterSend}
            onChange={() => onMultilineChange('keepAfterSend')}
          >
            {t('customize.multiline.keepAfterSend')}
          </CheckButton>
        </Controls>
        <Controls
          title={t('customize.coloredFontBold.title')}
          description={t('customize.coloredFontBold.description')}
        >
          <CheckButton
            checked={coloredFontBold}
            onChange={onColoredFontBoldToggle}
          >
            {t('customize.coloredFontBold.label')}
          </CheckButton>
        </Controls>
      </Wrapper>
    );
  },
);

/**
 * Component of customize settings.
 */
export const CustomizeDisp = withTranslationFunction(
  addProps(CustomizeDispInner),
);
