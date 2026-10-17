import { ColorName } from './color-profile';

/**
 * Content of tabs.
 * @package
 */
export type Tab = ColorSettingTab | PhoneUITab | CustomizeTab;

/**
 * Name of tab.
 */
export type TabName = Tab['page'];

/**
 * Color setting tab.
 */
export interface ColorSettingTab {
  page: 'color';
  editing: boolean;
  colorFocus: null | {
    key: ColorName;
    type: 'color' | 'bg';
  };
}

/**
 * Phone UI settings tab.
 */
export interface PhoneUITab {
  page: 'phone';
}

/**
 * Customize settings tab.
 */
export interface CustomizeTab {
  page: 'customize';
}
