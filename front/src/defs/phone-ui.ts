export type PhoneFontSize = 'large' | 'normal' | 'small' | 'very-small';
export type SpeakFormPosition = 'normal' | 'fixed';
/**
 * Which characters trigger the name autocomplete in speak form.
 */
export interface AutocompleteTriggerConfig {
  comma: boolean;
  slash: boolean;
  at: boolean;
}
/**
 * Multiline speak form settings.
 */
export interface MultilineSettings {
  /** Whether multiline mode is enabled by default. */
  defaultEnabled: boolean;
  /** Whether to keep multiline state after sending. If false, resets to single-line. */
  keepAfterSend: boolean;
}
/**
 * Setting object for smartphone UI.
 * @package
 */
export interface PhoneUISettings {
  use: boolean;
  fontSize: PhoneFontSize;
  speakFormPosition: SpeakFormPosition;
  autocompleteTrigger: AutocompleteTriggerConfig;
  multiline: MultilineSettings;
  /** Whether colored font (skyblue/darkblue/purple/green/brown) applies bold. */
  coloredFontBold: boolean;
}
