import * as React from 'react';

import { MyPage } from './component';
import { i18n, I18nProvider } from '../../i18n';
import { Store } from './store';
import { UserProfile, BanInfo, PrizeInfo } from './defs';
import { mountReact } from '../../util/react-root';

/**
 * Options to place.
 */
export type IPlaceOptions = {
  i18n: i18n;
  /**
   * Node to place.
   */
  node: HTMLElement;
  /**
   * Initial profile of user.
   */
  profile: UserProfile;
  /**
   * Ban information
   */
  ban: BanInfo | null;
  /**
   * prize information
   */
  prize: PrizeInfo;
  /**
   * Initial state of mailConfirmSecurity
   */
  mailConfirmSecurity: boolean;
} & Omit<React.ComponentProps<typeof MyPage>, 'store'>;

export interface IPlaceResult {
  unmount: () => void;
  store: Store;
}

export function place({
  i18n,
  node,
  profile,
  ban,
  prize,
  mailConfirmSecurity,
  ...props
}: IPlaceOptions): IPlaceResult {
  const store = new Store({
    profile,
    mailConfirmSecurity,
    ban,
    prize,
  });
  const com = (
    <I18nProvider i18n={i18n}>
      <MyPage store={store} {...props} />
    </I18nProvider>
  );

  const root = mountReact(node, com);

  const unmount = () => {
    root.unmount();
  };

  return { unmount, store };
}
