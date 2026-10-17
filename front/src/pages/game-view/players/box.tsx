import * as React from 'react';
import { observer } from 'mobx-react';
import Color from 'color';
import { PlayerInfo } from '../defs';
import styled from '../../../util/styled';
import { Icon } from './icon';
import { FontAwesomeIcon } from '../../../util/icon';
import { bind } from 'bind-decorator';
import { notPhone, phone } from '../../../common/media';
import { TranslationFunction } from '../../../i18n';

export interface IPropPlayerBox {
  t: TranslationFunction;
  player: PlayerInfo;
  onEnableFilter(): void;
  onInsertName?(name: string): void;
}
/**
 * A box which shows one player.
 */
@observer
export class PlayerBox extends React.Component<IPropPlayerBox, {}> {
  public render() {
    const {
      t,
      player: {
        id,
        realid,
        realname,
        icon,
        name,
        anonymous,
        dead,
        jobname,
        winner,
        flags,
      },
      onInsertName,
    } = this.props;
    return (
      <Wrapper dead={dead} hasIcon={icon != null}>
        <Icon t={t} icon={icon} dead={dead} />
        <Name dead={dead}>
          {anonymous ? (
            name
          ) : (
            <a href={`/user/${realid ? realid : id}`}>{name}</a>
          )}
          {realname != null && !flags.includes('gm') ? (
            <RealName>{realname}</RealName>
          ) : null}
        </Name>
        <ToolIcons>
          {/* Plus icon for name insertion - hidden but functional */}
          {/* {onInsertName && (
            <span onClick={this.handleInsertNameClick}>
              <FontAwesomeIcon icon="plus" />
            </span>
          )} */}
          <span onClick={this.handleFilterClick}>
            <FontAwesomeIcon icon="search" />
          </span>
        </ToolIcons>
        <Jobname>
          {flags.length > 0
            ? flags.map(flag => (
                <div key={flag}>
                  [{t(`game_client:playerbox.flags.${flag}`)}]
                </div>
              ))
            : null}
          {jobname ? <div>{jobname}</div> : null}
        </Jobname>
        {winner != null ? (
          <Winner winner={winner}>
            {winner
              ? t('game_client:playerbox.win')
              : t('game_client:playerbox.lose')}
          </Winner>
        ) : null}
      </Wrapper>
    );
  }
  @bind
  private handleFilterClick() {
    // Handle a click of filter icon.
    this.props.onEnableFilter();
  }
  @bind
  private handleInsertNameClick() {
    const { player, onInsertName } = this.props;
    if (onInsertName) {
      onInsertName(player.name);
    }
  }
}

/**
 * Wrapper of player box.
 */
const Wrapper = styled.div<{
  dead: boolean;
  hasIcon: boolean;
}>`
  min-width: ${props => (props.hasIcon ? '8em' : '5em')};
  min-height: 2em;

  margin: 4px 0 4px 0.5em;
  padding: 0.2em;
  border: 1px solid
    ${({ theme }) =>
      Color(theme.globalStyle.color)
        .fade(0.6)
        .string()};

  display: grid;
  grid-template-columns: auto 1fr auto;

  background-color: ${props =>
    props.dead ? 'rgba(0, 0, 0, 0.1)' : 'transparent'};

  ${phone`
    font-size: calc(0.9 * var(--base-font-size));
  `};
  ${notPhone`
    &:first-child {
      margin-left: 0;
    }
  `};
`;

const Name = styled.span<{ dead: boolean }>`
  grid-column: 2;
  grid-row: 1;
  text-decoration: ${props => (props.dead ? 'line-through' : 'none')};
`;

const RealName = styled.span`
  display: block;
  font-size: 0.8em;
  font-weight: normal;
  opacity: 0.7;
`;

const ToolIcons = styled.span`
  grid-column: 3;
  grid-row: 1;
  cursor: pointer;
  margin: 0 0 0 0.3em;
  display: flex;
  gap: 0.3em;
  opacity: 0.5;
  transition: opacity 0.2s;

  ${Wrapper}:hover & {
    opacity: 1;
  }

  ${phone`
    margin-left: 1em;
  `};
`;

const Jobname = styled.div`
  grid-column: 2 / 4;
  grid-row: 2;
  font-weight: bold;
`;

const Winner = styled.div<{ winner: boolean }>`
  grid-column: 2 / 4;
  grid-row: 3;
  font-weight: bold;
  color: ${props => (props.winner ? 'red' : 'blue')};
`;
