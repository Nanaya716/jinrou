import * as React from 'react';

import { TopPage } from './component';
import { i18n } from '../../i18n';
import { LoginHandler, SignupHandler } from './def';
import { mountReact } from '../../util/react-root';

/**
 * Options to place.
 */
export interface IPlaceOptions {
  i18n: i18n;
  /**
   * Node to place.
   */
  node: HTMLElement;
  /**
   * handler of login.
   */
  onLogin: LoginHandler;
  /**
   * handler of signup.k
   */
  onSignup: SignupHandler;
}
export interface IPlaceResult {
  unmount: () => void;
}

export function place({
  i18n,
  node,
  onLogin,
  onSignup,
}: IPlaceOptions): IPlaceResult {
  const com = <TopPage i18n={i18n} onLogin={onLogin} onSignup={onSignup} />;

  const root = mountReact(node, com);

  const unmount = () => {
    root.unmount();
  };

  return { unmount };
}
