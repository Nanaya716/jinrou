import * as React from 'react';
import { createPortal } from 'react-dom';
import Color from 'color';
import styled, { withTheme } from '../../../util/styled';
import { Log, autolinkLogType } from '../defs';
import { Rule } from '../../../defs';
import { TranslationFunction, I18nInterp } from '../../../i18n';
import { phone, notPhone } from '../../../common/media';
import { Theme } from '../../../theme';
import { FixedSizeLogRow } from './elements';
import { CommentContent } from './comment';
import { StoredLog } from './log-store';
import { themeStore } from '../../../theme';

const SHORT_ID_DOUBLE_CLICK_DELAY = 300;
let currentShortIdClick: ((shortId: string) => void) | undefined;
let lastShortIdClickTime = 0;
let lastShortIdClick = '';
let shortIdClickResetTimer: number | null = null;

function handleShortIdDoubleClick(e: React.MouseEvent<HTMLElement>): boolean {
  const shortId = e.currentTarget.getAttribute('data-shortid');
  if (!shortId || !currentShortIdClick) {
    return false;
  }

  const now = Date.now();
  const timeDiff = now - lastShortIdClickTime;
  if (
    lastShortIdClick === shortId &&
    timeDiff < SHORT_ID_DOUBLE_CLICK_DELAY &&
    timeDiff > 0
  ) {
    currentShortIdClick(shortId);
    lastShortIdClickTime = 0;
    lastShortIdClick = '';
    if (shortIdClickResetTimer != null) {
      window.clearTimeout(shortIdClickResetTimer);
      shortIdClickResetTimer = null;
    }
    return true;
  }

  lastShortIdClickTime = now;
  lastShortIdClick = shortId;
  if (shortIdClickResetTimer != null) {
    window.clearTimeout(shortIdClickResetTimer);
  }
  shortIdClickResetTimer = window.setTimeout(() => {
    lastShortIdClickTime = 0;
    lastShortIdClick = '';
    shortIdClickResetTimer = null;
  }, SHORT_ID_DOUBLE_CLICK_DELAY);
  return false;
}

export interface IPropOneLog {
  /**
   * Translation function,
   * whose default namespace should be 'game_client'.
   */
  t: TranslationFunction;
  theme: Theme;
  /**
   * Class name attached to each log.
   */
  logClass: string;
  /**
   * Whether logs are rendered in fixed-size mode.
   */
  fixedSize: boolean;
  /**
   * Log to show.
   */
  log: Log;
  /**
   * Set of icon URLs for users.
   */
  icons: Record<string, string | undefined>;
  /**
   * Current rule setting.
   */
  rule: Rule | undefined;
  /**
   * Function to resolve log by shortId for reply reference.
   */
  resolveLogById?: (shortId: string) => StoredLog | null;
  /**
   * Callback for shortId click.
   */
  onShortIdClick?: (shortId: string) => void;
  /**
   * Callback for selecting a user from log name menu.
   */
  onLogUserFilter?: (userid: string) => void;
}

/**
 * Function to sanitize log text.
 * Removes Unicode bidi characters.
 */
function sanitizeLog(log: string): string {
  return log.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
}

/**
 * A component which shows one log.
 */
class OneLogInner extends React.PureComponent<IPropOneLog, {}> {
  public render() {
    const {
      t,
      logClass,
      fixedSize,
      log,
      rule,
      icons,
      resolveLogById,
      onShortIdClick,
      onLogUserFilter,
    } = this.props;
    currentShortIdClick = onShortIdClick;
    const baseClassName = logClass;
    const logUserid = 'userid' in log ? log.userid : undefined;
    const logUserAttrs =
      logUserid != null ? { 'data-log-userid': logUserid } : {};
    const classNameForMode = (mode: Log['mode']) =>
      `${baseClassName} ${logModeClass(mode)}`;
    const lineAttrs = (mode: Log['mode']) =>
      fixedSize
        ? ({
            className: classNameForMode(mode),
            ...logUserAttrs,
          } as Record<string, any>)
        : {};
    const partAttrs = (mode: Log['mode']) =>
      fixedSize
        ? {}
        : ({
            className: classNameForMode(mode),
            ...logUserAttrs,
          } as Record<string, any>);
    const renderLine = (mode: Log['mode'], children: React.ReactNode) =>
      fixedSize ? (
        <FixedSizeLogRow {...lineAttrs(mode)}>{children}</FixedSizeLogRow>
      ) : (
        <>{children}</>
      );

    if (log.mode === 'voteresult') {
      // log of vote result table
      return renderLine(
        log.mode,
        <>
          <Icon noName {...partAttrs(log.mode)} />
          <Name noName {...partAttrs(log.mode)} />
          <TableLogMain noName {...partAttrs(log.mode)}>
            <LogTable>
              {/* Vote result caption */}
              <caption>{t('log.voteResult.caption')}</caption>
              <tbody>
                {log.voteresult.map(({ id, name, voteto }) => {
                  const votecount = log.tos[id] || 0;
                  // Name of vote target
                  const vt = log.voteresult.filter(x => x.id === voteto)[0];
                  const targetname = (vt ? vt.name : '') || '';
                  return (
                    <tr key={id}>
                      <td>{sanitizeLog(name)}</td>
                      <td>{t('log.voteResult.count', { count: votecount })}</td>
                      <td>→{sanitizeLog(targetname)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </LogTable>
          </TableLogMain>
          <Time noName time={new Date(log.time)} {...partAttrs(log.mode)} />
        </>,
      );
    } else if (log.mode === 'probability_table') {
      // log of probability table for Quantum Werewwolf
      return renderLine(
        log.mode,
        <>
          <Icon noName {...partAttrs(log.mode)} />
          <Name noName {...partAttrs(log.mode)} />
          <TableLogMain noName {...partAttrs(log.mode)}>
            <LogTable>
              {/* Probability table caption */}
              <caption>{t('log.probabilityTable.caption')}</caption>
              <thead>
                <tr>
                  <th>{t('log.probabilityTable.name')}</th>
                  {rule &&
                  rule.rules.get('quantumwerewolf_diviner') === 'on' ? (
                    // Show probability for Diviner and Human separately.
                    <>
                      {/* 村人 */}
                      <th>{t('log.probabilityTable.Villager')}</th>
                      {/* 占い師 */}
                      <th>{t('log.probabilityTable.Diviner')}</th>
                    </>
                  ) : (
                    /* 人間 */
                    <th>{t('log.probabilityTable.Human')}</th>
                  )}
                  {/* 人狼 */}
                  <th>{t('log.probabilityTable.Werewolf')}</th>
                  {rule && rule.rules.get('quantumwerewolf_dead') !== 'no' ? (
                    /* 死亡 */
                    <th>{t('log.probabilityTable.dead')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {Object.keys(log.probability_table).map(id => {
                  const obj = log.probability_table[id];
                  return (
                    <ProbabilityTr dead={obj.dead === 1} key={id}>
                      <td>{sanitizeLog(obj.name)}</td>
                      <ProbTd prob={obj.Human} />
                      {rule &&
                      rule.rules.get('quantumwerewolf_diviner') === 'on' ? (
                        <ProbTd prob={obj.Diviner} />
                      ) : null}
                      <ProbTd prob={obj.Werewolf} />
                      {rule &&
                      rule.rules.get('quantumwerewolf_dead') !== 'no' ? (
                        <ProbTd prob={obj.dead} />
                      ) : null}
                    </ProbabilityTr>
                  );
                })}
              </tbody>
            </LogTable>
          </TableLogMain>
          <Time noName time={new Date(log.time)} {...partAttrs(log.mode)} />
        </>,
      );
    } else if (log.mode === 'poem') {
      const icon = icons[log.userid];
      const noName = icon == null;
      return renderLine(
        log.mode,
        <>
          <Icon noName={noName} {...partAttrs(log.mode)} />
          <Name noName={noName} {...partAttrs(log.mode)} />
          <Comment noName={noName} {...partAttrs(log.mode)}>
            <I18nInterp ns="game_client" k="log.poem.description">
              {{
                name: <b>{log.name}</b>,
                target: <b>{log.target}</b>,
              }}
            </I18nInterp>
            <PoemWrapper>{log.comment}</PoemWrapper>
          </Comment>
          <Time
            noName={noName}
            time={new Date(log.time)}
            {...partAttrs(log.mode)}
          />
        </>,
      );
    } else {
      const size = log.mode === 'nextturn' ? undefined : log.size;
      const icon = log.mode === 'nextturn' ? undefined : icons[log.userid];
      const nameText =
        log.mode === 'nextturn' || !log.name
          ? null
          : log.mode === 'monologue' || log.mode === 'heavenmonologue'
          ? t('log.monologue', { name: log.name }) + ':'
          : log.mode === 'will'
          ? t('log.will', { name: log.name }) + ':'
          : log.mode === 'streaming'
          ? t('log.streaming', { name: log.name }) + ':'
          : log.name + ':';
      // Auto-link URLs and room numbers in it.
      const noName = icon == null && !nameText;
      const commentProps = {
        size,
        mode: log.mode,
        noName,
        coloredBold: themeStore.savedTheme.phoneUI.coloredFontBold !== false,
        ...partAttrs(log.mode),
      };
      // Server's bug? comment may actually be null
      const comment = autolinkLogType.includes(log.mode) ? (
        <Comment {...commentProps}>
          <CommentContent
            comment={log.comment || ''}
            supplement={log.mode === 'nextturn' ? undefined : log.supplement}
            resolveLogById={resolveLogById}
          />
        </Comment>
      ) : (
        <Comment {...commentProps}>{sanitizeLog(log.comment)}</Comment>
      );
      return renderLine(
        log.mode,
        <>
          {/* icon */}
          <Icon noName={noName} {...partAttrs(log.mode)}>
            {icon != null ? <IconImage $src={icon} aria-hidden="true" /> : null}
          </Icon>
          <Name
            noName={noName}
            size={size}
            shortId={log.shortId}
            onShortIdClick={onShortIdClick}
            pickupUserid={logUserid}
            onLogUserFilter={onLogUserFilter}
            {...partAttrs(log.mode)}
          >
            {nameText ? sanitizeLog(nameText) : null}
          </Name>
          {comment}
          <Time
            noName={noName}
            time={new Date(log.time)}
            shortId={log.shortId}
            onShortIdClick={onShortIdClick}
            {...partAttrs(log.mode)}
          />
        </>,
      );
    }
  }
}

export const OneLog = withTheme(OneLogInner);

interface IPropProbabilityTr {
  dead: boolean;
}
/**
 * Tr element for dead player's probability.
 */
const ProbabilityTr = styled.tr<IPropProbabilityTr>`
  background-color: ${({ dead }) => (dead ? '#bbbbbb' : 'transparent')};
  color: ${({ dead }) => (dead ? 'black' : 'inherit')};
`;

interface IPropProbTd {
  prob: number;
}
function ProbTd({ prob }: IPropProbTd) {
  if (prob === 1) {
    return (
      <td>
        <b>100%</b>
      </td>
    );
  } else {
    return <td>{(prob * 100).toFixed(2)}%</td>;
  }
}

export interface LogStyle {
  /**
   * background color.
   */
  background: string;
  /**
   * text color.
   */
  color: string;
  /**
   * border color (if exists).
   */
  borderColor: string | null;
  /**
   * Whether text is bold.
   */
  bold?: true;
}
/**
 * ログ種類から色などを計算
 */
export function computeLogStyle(mode: Log['mode'], theme: Theme): LogStyle {
  switch (mode) {
    case 'audience': {
      return {
        background: theme.user.audience.bg,
        color: theme.user.audience.color,
        borderColor: '#eeffee',
      };
    }
    case 'couple': {
      return {
        background: theme.user.couple.bg,
        color: theme.user.couple.color,
        borderColor: '#eeffee',
      };
    }
    case 'day': {
      return {
        background: theme.user.day.bg,
        color: theme.user.day.color,
        borderColor: 'rgba(0, 0, 0, 0.2)',
      };
    }
    case 'fox': {
      return {
        background: theme.user.fox.bg,
        color: theme.user.fox.color,
        borderColor: null,
      };
    }
    case 'gm':
    case 'gmreply': {
      return {
        background: theme.user.gm1.bg,
        color: theme.user.gm1.color,
        borderColor: '#ffa8a8',
      };
    }
    case 'gmaudience':
    case 'gmheaven':
    case 'gmmonologue': {
      return {
        background: theme.user.gm2.bg,
        color: theme.user.gm2.color,
        borderColor: '#ffc68a',
      };
    }
    case 'heaven': {
      return {
        background: theme.user.heaven.bg,
        color: theme.user.heaven.color,
        borderColor: null,
      };
    }
    case 'heavenmonologue': {
      return {
        background: theme.user.heavenmonologue.bg,
        color: theme.user.heavenmonologue.color,
        borderColor: null,
      };
    }
    case 'half-day': {
      return {
        background: theme.user.half_day.bg,
        color: theme.user.half_day.color,
        borderColor: null,
      };
    }
    case 'helperwhisper': {
      return {
        background: theme.user.helperwhisper.bg,
        color: theme.user.helperwhisper.color,
        borderColor: '#e8e000',
      };
    }
    case 'hidden': {
      return {
        background: theme.user.hidden.bg,
        color: theme.user.hidden.color,
        borderColor: null,
      };
    }
    case 'inlog': {
      return {
        background: theme.user.inlog.bg,
        color: theme.user.inlog.color,
        bold: true,
        borderColor: '#00dce8',
      };
    }
    case 'madcouple': {
      return {
        background: theme.user.madcouple.bg,
        color: theme.user.madcouple.color,
        borderColor: '#eeffee',
      };
    }
    case 'monologue': {
      return {
        background: theme.user.monologue.bg,
        color: theme.user.monologue.color,
        borderColor: '#000066',
      };
    }
    case 'nextturn': {
      return {
        background: theme.user.nextturn.bg,
        color: theme.user.nextturn.color,
        bold: true,
        borderColor: '#aaaaaa',
      };
    }
    case 'poem': {
      return {
        background: theme.user.poem.bg,
        color: theme.user.poem.color,
        borderColor: '#e9546b',
      };
    }
    case 'prepare': {
      return {
        background: theme.user.heaven.bg,
        color: theme.user.heaven.color,
        borderColor: '#fffff8',
      };
    }
    case 'probability_table': {
      return {
        background: theme.user.probability_table.bg,
        color: theme.user.probability_table.color,
        borderColor: null,
      };
    }
    case 'streaming': {
      return {
        background: theme.user.streaming.bg,
        color: theme.user.streaming.color,
        borderColor: '#ffc68a',
      };
    }
    case 'system': {
      return {
        background: theme.user.system.bg,
        color: theme.user.system.color,
        bold: true,
        borderColor: '#aaaaaa',
      };
    }
    case 'userinfo': {
      return {
        background: theme.user.userinfo.bg,
        color: theme.user.userinfo.color,
        bold: true,
        borderColor: '#000070',
      };
    }
    case 'voteresult': {
      return {
        background: theme.user.day.bg,
        color: theme.user.day.color,
        borderColor: null,
      };
    }
    case 'voteto': {
      return {
        background: theme.user.voteto.bg,
        color: theme.user.voteto.color,
        bold: true,
        borderColor: '#007000',
      };
    }
    case 'werewolf': {
      return {
        background: theme.user.werewolf.bg,
        color: theme.user.werewolf.color,
        borderColor: '#000066',
      };
    }
    case 'will': {
      return {
        background: theme.user.will.bg,
        color: theme.user.will.color,
        borderColor: null,
      };
    }
    case 'skill':
    case 'emmaskill':
    case 'wolfskill':
    case 'eyeswolfskill':
    case 'draculaskill': {
      return {
        background: theme.user.skill.bg,
        color: theme.user.skill.color,
        bold: true,
        borderColor: '#800000',
      };
    }
  }
}

const logStyleModes: Array<Log['mode']> = [
  'audience',
  'couple',
  'day',
  'fox',
  'gm',
  'gmreply',
  'gmaudience',
  'gmheaven',
  'gmmonologue',
  'heaven',
  'heavenmonologue',
  'half-day',
  'helperwhisper',
  'hidden',
  'inlog',
  'madcouple',
  'monologue',
  'nextturn',
  'poem',
  'prepare',
  'probability_table',
  'streaming',
  'system',
  'userinfo',
  'voteresult',
  'voteto',
  'werewolf',
  'will',
  'skill',
  'emmaskill',
  'wolfskill',
  'eyeswolfskill',
  'draculaskill',
];

function logModeClass(mode: Log['mode']): string {
  return `jf-log-mode-${mode.replace(/_/g, '-')}`;
}

function cssValue(value: string): string {
  return value.replace(/[;{}]/g, '');
}

function logStyleCssVarsText(logStyle: LogStyle): string {
  const border = logStyle.borderColor
    ? `1px dashed ${logStyle.borderColor}`
    : 'none';
  return [
    `--jf-log-bg:${cssValue(logStyle.background)}`,
    `--jf-log-color:${cssValue(logStyle.color)}`,
    `--jf-log-border:${cssValue(border)}`,
    `--jf-log-weight:${logStyle.bold ? 'bold' : 'normal'}`,
  ].join(';');
}

const LogModeStyleInner = ({ theme }: { theme: Theme }) => (
  <style>
    {logStyleModes
      .map(mode => {
        const className = logModeClass(mode);
        return `.jf-log-list .${className}{${logStyleCssVarsText(
          computeLogStyle(mode, theme),
        )}}`;
      })
      .join('\n')}
  </style>
);

export const LogModeStyle = withTheme(LogModeStyleInner);

interface IPropLogPart {
  /**
   * Whether no name is given for this log.
   */
  noName?: boolean;
}

/**
 * Basic style of logcomponents.
 */
const LogPart = styled.div`
  background-color: var(--jf-log-bg);
  color: var(--jf-log-color);
  border-top: var(--jf-log-border);
  border-bottom: var(--jf-log-border);
  font-weight: var(--jf-log-weight);
  line-height: 1;
  overflow: hidden;
  word-break: break-all;
  overflow-wrap: break-word;
  word-break: break-word;
  padding: 1px 0;
  font-size: var(--base-font-size);
`;

/**
 * Icon box.
 */
const Icon = styled(LogPart)<IPropLogPart>`
  grid-column: 1;
  min-width: 8px;

  ${phone<IPropLogPart>`
    grid-row: ${({ noName }) => (noName ? 'span 1' : 'span 2')};
    ${({ noName }) => (noName ? '' : 'border-bottom: none;')}
  `};
`;

function cssUrl(src: string): string {
  return `url(${JSON.stringify(src)})`;
}

const IconImage = styled.span.attrs<{ $src: string }>(props => ({
  style: {
    backgroundImage: cssUrl(props.$src),
  },
}))<{ $src: string }>`
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: bottom;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
`;

/**
 * Username box.
 */
interface IPropName extends IPropLogPart {
  size?:
    | 'big'
    | 'small'
    | 'skyblue'
    | 'darkblue'
    | 'purple'
    | 'green'
    | 'brown';
  shortId?: string;
  onShortIdClick?: (shortId: string) => void;
  pickupUserid?: string;
  onLogUserFilter?: (userid: string) => void;
}

const NameInner = ({
  children,
  shortId,
  onShortIdClick,
  pickupUserid,
  onLogUserFilter,
  className,
  ...rest
}: IPropName & {
  className?: string;
  children?: React.ReactNode;
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 });
  const nameTextRef = React.useRef<HTMLSpanElement>(null);
  const menuRef = React.useRef<HTMLSpanElement>(null);
  const menuOpenTimerRef = React.useRef<number | null>(null);
  const canOpenMenu =
    pickupUserid != null && onLogUserFilter != null && children != null;
  const canUseShortId = shortId != null && onShortIdClick != null;

  const clearMenuOpenTimer = React.useCallback(() => {
    if (menuOpenTimerRef.current != null) {
      window.clearTimeout(menuOpenTimerRef.current);
      menuOpenTimerRef.current = null;
    }
  }, []);

  const updateMenuPosition = React.useCallback(() => {
    const anchor = nameTextRef.current;
    if (anchor == null) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 120;
    const left = Math.min(
      Math.max(4, rect.left),
      Math.max(4, window.innerWidth - menuWidth - 4),
    );
    setMenuPosition({
      top: rect.bottom + 4,
      left,
    });
  }, []);

  React.useEffect(() => {
    if (!menuOpen) {
      return;
    }
    let rafId: number | null = null;
    const updatePosition = () => {
      if (rafId != null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        updateMenuPosition();
        rafId = null;
      });
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current != null &&
        !menuRef.current.contains(target) &&
        nameTextRef.current != null &&
        !nameTextRef.current.contains(target)
      ) {
        clearMenuOpenTimer();
        setMenuOpen(false);
      }
    };
    updateMenuPosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [clearMenuOpenTimer, menuOpen, updateMenuPosition]);

  React.useEffect(() => {
    return clearMenuOpenTimer;
  }, [clearMenuOpenTimer]);

  const handleNameClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (canUseShortId && handleShortIdDoubleClick(e)) {
      clearMenuOpenTimer();
      setMenuOpen(false);
      return;
    }
    if (canOpenMenu) {
      clearMenuOpenTimer();
      menuOpenTimerRef.current = window.setTimeout(() => {
        updateMenuPosition();
        setMenuOpen(true);
        menuOpenTimerRef.current = null;
      }, SHORT_ID_DOUBLE_CLICK_DELAY);
    }
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleFilterClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    clearMenuOpenTimer();
    if (pickupUserid != null && onLogUserFilter != null) {
      onLogUserFilter(pickupUserid);
    }
    setMenuOpen(false);
  };

  return (
    <LogPart className={className} data-shortid={shortId} {...rest}>
      {canUseShortId || canOpenMenu ? (
        <NameText
          ref={nameTextRef}
          data-shortid={shortId}
          onClick={handleNameClick}
          style={{ cursor: 'pointer' }}
        >
          {children}
        </NameText>
      ) : (
        children
      )}
      {menuOpen
        ? createPortal(
            <NameMenu
              ref={menuRef}
              onClick={handleMenuClick}
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
            >
              <NameMenuButton type="button" onClick={handleFilterClick}>
                筛选发言
              </NameMenuButton>
            </NameMenu>,
            document.body,
          )
        : null}
    </LogPart>
  );
};

const Name = styled(NameInner)<IPropName>`
  grid-column: 2;
  max-width: 10em;
  overflow: hidden;
  position: relative;

  font-weight: bold;
  white-space: nowrap;
  word-wrap: break-word;
  text-align: right;
  ${({ size }) =>
    size === 'big' || size === 'small'
      ? 'line-height: 1.3;'
      : 'line-height: 1.3;'} ${phone<IPropLogPart>`
    ${({ noName }) => (noName ? 'display: none;' : '')}
    max-width: none;
    text-align: left;
    font-size: calc(0.75 * var(--base-font-size));
    border-bottom: none;
  `};
`;

/**
 * Name text wrapper for double-click interaction.
 * Only the text itself should be clickable, not the entire name area.
 */
const NameText = styled.span`
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  vertical-align: bottom;
`;

const NameMenu = styled.span`
  position: fixed;
  z-index: 9999;
  display: block;
  min-width: 6em;
  padding: 2px;
  background-color: ${({ theme }) => theme.globalStyle.background};
  border: 1px solid
    ${({ theme }) =>
      Color(theme.globalStyle.color)
        .fade(0.5)
        .string()};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
`;

const NameMenuButton = styled.button`
  width: 100%;
  padding: 3px 8px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.globalStyle.color};
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus {
    background-color: rgba(127, 127, 127, 0.2);
    outline: none;
  }
`;

/**
 * comment (main) box.
 */
const Main = styled(LogPart)<IPropLogPart>`
  grid-column: 3;

  ${phone<IPropLogPart>`
    grid-column: ${({ noName }) => (noName ? '2 / 3' : '2 / 4')};
    ${({ noName }) => (noName ? '' : 'border-top: none;')}
    padding-left: 0.3em;
  `};
`;

const TableLogMain = styled(Main)`
  line-height: normal;
`;

interface IPropComment {
  /**
   * Changed size of comment.
   */
  size?:
    | 'big'
    | 'small'
    | 'skyblue'
    | 'darkblue'
    | 'purple'
    | 'green'
    | 'brown';
  /**
   * Log mode for color application.
   */
  mode?: Log['mode'];
  /**
   * Whether colored font should apply bold.
   */
  coloredBold?: boolean;
}

const getFontSize = (
  size?:
    | 'big'
    | 'small'
    | 'skyblue'
    | 'darkblue'
    | 'purple'
    | 'green'
    | 'brown',
) =>
  size === 'big'
    ? 'calc(1.07 * var(--base-font-size))'
    : size === 'small'
    ? 'calc(1.25 * var(--base-font-size))'
    : 'var(--base-font-size)';

/**
 * Get font color based on size.
 */
const getFontColor = (
  size?:
    | 'big'
    | 'small'
    | 'skyblue'
    | 'darkblue'
    | 'purple'
    | 'green'
    | 'brown',
): string => {
  switch (size) {
    case 'skyblue':
      return '#00008B';
    case 'darkblue':
      return '#FFFFFF';
    case 'purple':
      return '#FFFFFF';
    case 'green':
      return '#FFFFFF';
    case 'brown':
      return '#FFFFFF';
    default:
      return 'inherit';
  }
};

/**
 * Get background color based on size.
 */
const getBackgroundColor = (
  size?:
    | 'big'
    | 'small'
    | 'skyblue'
    | 'darkblue'
    | 'purple'
    | 'green'
    | 'brown',
): string => {
  switch (size) {
    case 'skyblue':
      return '#87CEEB';
    case 'darkblue':
      return '#00008B';
    case 'purple':
      return '#800080';
    case 'green':
      return '#228B22';
    case 'brown':
      return '#8B4513';
    default:
      return 'inherit';
  }
};

/**
 * Log comment box.
 */
const Comment = styled(Main)<IPropComment>`
  white-space: pre-wrap;
  font-size: ${({ size }) => getFontSize(size)};
  letter-spacing: 0.02em;
  ${({ size, mode, coloredBold }) => {
    if (mode === 'day' || mode === 'gm') {
      const boldStyle = coloredBold !== false ? ' font-weight: bold;' : '';
      if (size === 'skyblue') {
        return `color: rgb(199, 21, 133) !important;${boldStyle}`;
      } else if (size === 'darkblue') {
        return `color: #0000CD !important;${boldStyle}`;
      } else if (size === 'purple') {
        return `color: #9400D3 !important;${boldStyle}`;
      } else if (size === 'green') {
        return `color: #04682f !important;${boldStyle}`;
      } else if (size === 'brown') {
        return `color: #A0522D !important;${boldStyle}`;
      }
    }
    return '';
  }}
  ${({ size }) =>
    size === 'big'
      ? 'font-weight: bold; line-height: 1.3;'
      : size === 'small'
      ? 'text-decoration: underline; font-weight: bold; line-height: 1.3;'
      : 'line-height: 1.3'};
`;

/**
 * Wrapper of poem in log.
 */
const PoemWrapper = styled.div`
  margin: 0.8em;
`;

interface IPropTime extends IPropLogPart {
  time: Date;
  className?: string;
  shortId?: string;
  onShortIdClick?: (shortId: string) => void;
}
const TimeInner = ({
  time,
  noName,
  className,
  shortId,
  onShortIdClick,
  ...rest
}: IPropTime) => {
  const year = time.getFullYear();
  const month = ('0' + (time.getMonth() + 1)).slice(-2);
  const day = ('0' + time.getDate()).slice(-2);
  const hour = ('0' + time.getHours()).slice(-2);
  const minute = ('0' + time.getMinutes()).slice(-2);
  const second = ('0' + time.getSeconds()).slice(-2);
  const str = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

  return (
    <LogPart className={className} {...rest}>
      <time
        data-shortid={shortId}
        style={{
          cursor: shortId && onShortIdClick ? 'pointer' : 'default',
          display: 'block',
          width: '100%',
        }}
        onClick={
          shortId && onShortIdClick ? handleShortIdDoubleClick : undefined
        }
      >
        {shortId && (
          <span style={{ opacity: 0.6 }}>
            {'>'}
            {shortId}
          </span>
        )}{' '}
        {str}
      </time>
    </LogPart>
  );
};

/**
 * Show time box.
 */
const Time = styled(TimeInner)`
  grid-column: 4;
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-end;
  padding-left: 2px;
  padding-right: 1ex;
  padding-bottom: 1px;

  white-space: nowrap;
  font-size: xx-small;
  text-align: right;

  ${phone<IPropTime>`
    grid-column: 3;
    font-size: xx-small;
    ${({ noName }) => (noName ? '' : 'border-bottom: none;')}
  `};
  ${notPhone`
    line-height: var(--base-font-size);
  `};
`;

/**
 * Table for logs.
 */
const LogTable = styled.table`
  ${phone`
    font-size: calc(0.88 * var(--base-font-size));
  `};
`;
