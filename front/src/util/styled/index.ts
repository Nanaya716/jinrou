// Customization of styled-components.
import * as styledComponents from 'styled-components';
import {
  ThemedStyledComponentsModule,
  StyledFunction,
} from 'styled-components';

import { Theme } from '../../theme';
import { makeThemeProvider } from './theme';

const {
  default: styled,
  css,
  keyframes,
  ThemeProvider: InternalThemeProvider,
  withTheme,
} = styledComponents as ThemedStyledComponentsModule<Theme>;

const ThemeProvider = makeThemeProvider(InternalThemeProvider);

export { css, keyframes, ThemeProvider, withTheme, StyledFunction };
export default styled;
