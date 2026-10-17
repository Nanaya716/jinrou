import { css } from '../util/styled';
import {
  CSSObject,
  InterpolationFunction,
  ThemedStyledProps,
  Interpolation,
  FlattenInterpolation,
} from 'styled-components';
import * as React from 'react';
import { Theme } from '../theme';

// media queries

/**
 * Width of viewport to switch phone mode and pc mode.
 */
const phoneWidth = 600;

/**
 * Query string to switch to phone mode.
 */
const phoneQuery = `max-width: ${phoneWidth}px`;

/**
 * Inverse of phone query.
 */
const notPhoneQuery = `min-width: ${phoneWidth + 1}px`;

/**
 * Type of custom css interpolator.
 */
type MediaFunction = <P extends object>(
  first:
    | TemplateStringsArray
    | CSSObject
    | InterpolationFunction<ThemedStyledProps<P, Theme>>,
  ...interpolations: Array<Interpolation<ThemedStyledProps<P, Theme>>>
) => FlattenInterpolation<ThemedStyledProps<P, Theme>>;

const applyCss = css as (...args: any[]) => ReturnType<typeof css>;

/**
 * Media query for smartphones.
 */
export const phone: MediaFunction = (...args) =>
  css`
    @media (${phoneQuery}) {
      ${applyCss(...args)};
    }
  `;

/**
 * Media query for non-smartphones.
 */
export const notPhone: MediaFunction = (...args) => css`
  @media (${notPhoneQuery}) {
    ${applyCss(...args)};
  }
`;

/**
 * Component which watches query.
 */
export class IsPhone extends React.Component<
  {
    children: (isPhone: boolean) => React.ReactNode;
  },
  {
    isPhone: boolean;
  }
> {
  public state = { isPhone: false };
  private mediaQueryList = window.matchMedia(`(${phoneQuery})`);
  private eventHandler: (() => void) | null = null;
  public render() {
    const {
      props: { children },
      state: { isPhone },
    } = this;

    return children(isPhone);
  }
  public componentDidMount() {
    const { mediaQueryList } = this;
    this.eventHandler = () => {
      this.setState({
        isPhone: mediaQueryList.matches,
      });
    };
    // reflect current matching state of media query.
    this.eventHandler();

    if ('addEventListener' in mediaQueryList) {
      mediaQueryList.addEventListener('change', this.eventHandler);
    } else {
      mediaQueryList.addListener(this.eventHandler);
    }
  }
  public componentWillUnmount() {
    if (this.eventHandler != null) {
      if ('removeEventListener' in this.mediaQueryList) {
        this.mediaQueryList.removeEventListener('change', this.eventHandler);
      } else {
        this.mediaQueryList.removeListener(this.eventHandler);
      }
    }
  }
}
