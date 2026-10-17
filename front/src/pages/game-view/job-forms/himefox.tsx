import * as React from 'react';
import { FormContentProps } from './defs';

/**
 * Make a form for HimeFox sacrifice selection (first step).
 */
export function makeHimeFoxSacrificeForm({ t }: FormContentProps<'HimeFox'>) {
  const content = <p>{t('game_client_form:HimeFox.sacrifice.description')}</p>;
  const buttons = (
    <input
      name="himefoxSacrifice"
      type="submit"
      value={t('game_client_form:HimeFox.sacrifice.button')}
    />
  );
  return {
    content,
    buttons,
  };
}

/**
 * Make a form for HimeFox nekikill target selection (second step).
 */
export function makeNekikillTargetForm({
  t,
}: FormContentProps<'NekikillTarget'>) {
  const content = <p>{t('game_client_form:HimeFox.nekikill.description')}</p>;
  const buttons = (
    <input
      name="nekikillTarget"
      type="submit"
      value={t('game_client_form:HimeFox.nekikill.button')}
    />
  );
  return {
    content,
    buttons,
  };
}
