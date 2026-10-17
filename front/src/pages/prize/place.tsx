import * as React from 'react';

import { PrizeStore } from './store';
import { PrizePage } from './component';
import { i18n, addResource } from '../../i18n';
import { Prize, PrizeUtil, NowPrize } from './defs';
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
   * Initial list of prizes
   */
  initialPrizes: Prize[];
  /**
   * Initial setting of currently set prizes
   */
  nowPrize: NowPrize[];
  prizeUtil: PrizeUtil;
  /**
   * Function to query update of prize.
   * Returns a Promise of possible error message.
   */
  onUsePrize: (nowPrize: NowPrize[]) => Promise<string | null>;
}
export interface IPlaceResult {
  unmount: () => void;
  store: PrizeStore;
}

export async function place({
  i18n,
  node,
  initialPrizes,
  nowPrize,
  prizeUtil,
  onUsePrize,
}: IPlaceOptions): Promise<IPlaceResult> {
  await addResource('prize_client', i18n);
  i18n.setDefaultNamespace('prize_client');

  const store = new PrizeStore(prizeUtil);
  store.setPrizes(initialPrizes);
  store.setNowPrize(nowPrize);

  const com = <PrizePage i18n={i18n} store={store} onUsePrize={onUsePrize} />;

  const root = mountReact(node, com);

  const unmount = () => {
    root.unmount();
  };

  return { unmount, store };
}
