import { i18n } from '../../i18n';
import { ServerConnectionStore } from './store';
import { ServerConnection } from './component';
import * as React from 'react';
import { mountReact } from '../../util/react-root';

export interface IPlaceOptions {
  i18n: i18n;
  node: HTMLElement;
  connected?: boolean;
}
export interface IPlaceResult {
  store: ServerConnectionStore;
  unmount: () => void;
}
export function place({ i18n, node, connected }: IPlaceOptions): IPlaceResult {
  const store = new ServerConnectionStore();

  if (connected != null) {
    // it has initial connectedness.
    store.setConnection(connected);
  }

  const com = <ServerConnection i18n={i18n} store={store} />;
  const root = mountReact(node, com);

  const unmount = () => {
    root.unmount();
  };
  return { store, unmount };
}
