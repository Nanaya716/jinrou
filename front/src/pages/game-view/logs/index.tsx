import * as React from 'react';
import { observer } from 'mobx-react';
import { LogVisibility } from '../defs';
import { Rule } from '../../../defs';

import { LogModeStyle, OneLog } from './log';
import { StoredLog, StoredLogBlock, LogStore } from './log-store';
import { mapReverse } from '../../../util/map-reverse';
import { I18n, TranslationFunction } from '../../../i18n';
import {
  LogWrapper,
  FixedSizeChunkWrapper,
  LogBlockWrapper,
  PendingLogMessage,
} from './elements';
import { LogsRenderingState } from './store';

export interface IPropLogs {
  /**
   * All logs.
   */
  logs: LogStore;
  /**
   * Visibility of logs.
   */
  visibility: LogVisibility;
  /**
   * Picked-up user id.
   */
  logPickup: string | null;
  /**
   * Icons of users.
   */
  icons: Record<string, string | undefined>;
  /**
   * Current rule setting.
   */
  rule: Rule | undefined;
  /**
   * Callback for resetting log pickup filter (triggered by double-click).
   */
  onResetLogPickup(): void;
  /**
   * Callback for shortId click.
   */
  onShortIdClick?: (shortId: string) => void;
}

export interface IStateLogs {
  renderingState: LogsRenderingState;
}

function cssString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\A ')
    .replace(/\r/g, '\\D ')}"`;
}

function PickupStyle({ userid }: { userid: string | null }) {
  if (userid == null) {
    return null;
  }
  return (
    <style>
      {[
        `.jf-log-list[data-log-pickup-active="true"] .jf-log{opacity:0.3;}`,
        `.jf-log-list[data-log-pickup-active="true"] .jf-log[data-log-userid=${cssString(
          userid,
        )}]:not(.jf-log-mode-system){opacity:1;}`,
      ].join('\n')}
    </style>
  );
}

class StaticLogStyleRules extends React.PureComponent {
  public render() {
    return <LogModeStyle />;
  }
}

/**
 * Shows all logs.
 */
@observer
export class Logs extends React.Component<IPropLogs, IStateLogs> {
  /**
   * Classname attached to each log.
   */
  private readonly logClass = 'jf-log';
  /**
   * Double-click detection state for resetting log pickup.
   */
  private wrapperLastClickTime = 0;
  private wrapperClickTimeout: number | null = null;

  constructor(props: IPropLogs) {
    super(props);
    this.state = {
      // what if logs is updated?
      // (getDerivedStateFromProps)
      renderingState: new LogsRenderingState(this.props.logs),
    };
  }
  public componentDidUpdate(prevProps: IPropLogs) {
    if (!prevProps.logs.loaded && this.props.logs.loaded) {
      this.state.renderingState.reset(this.props.logs.allLogNumber);
    }
  }
  public componentWillUnmount() {
    this.state.renderingState.dispose();
    // Clear timeout if exists
    if (this.wrapperClickTimeout != null) {
      window.clearTimeout(this.wrapperClickTimeout);
    }
  }

  /**
   * Resolve log by shortId for reply reference.
   * This is a performance-optimized lookup using the shortId index.
   * Returns the StoredLog object directly to avoid JSON serialization overhead.
   */
  private resolveLogById = (shortId: string): StoredLog | null => {
    return this.props.logs.findByShortId(shortId);
  };

  /**
   * Handle click for double-click detection to reset log pickup.
   * This is compatible with both desktop and mobile devices.
   */
  private handleLogWrapperClick = () => {
    const now = Date.now();
    const timeDiff = now - this.wrapperLastClickTime;
    const delay = 300;

    if (timeDiff < delay && timeDiff > 0) {
      // Double-click detected
      this.props.onResetLogPickup();
      this.wrapperLastClickTime = 0;
      if (this.wrapperClickTimeout != null) {
        window.clearTimeout(this.wrapperClickTimeout);
        this.wrapperClickTimeout = null;
      }
    } else {
      // Potential single-click, wait for second click
      if (this.wrapperClickTimeout != null) {
        window.clearTimeout(this.wrapperClickTimeout);
      }
      this.wrapperClickTimeout = window.setTimeout(() => {
        this.wrapperLastClickTime = 0;
        this.wrapperClickTimeout = null;
      }, delay);
      this.wrapperLastClickTime = now;
    }
  };

  public render() {
    const {
      logs,
      rule,
      icons,
      visibility,
      logPickup,
      onResetLogPickup,
      onShortIdClick,
    } = this.props;
    const { renderingState } = this.state;

    if (!logs.loaded) {
      return null;
    }

    const fixedSize = true;
    /*
     * number of logs to render (not pending).
     */
    const renderedLogs = logs.allLogNumber - renderingState.pendingLogNumber;

    let renderedLogCount = 0;
    return (
      <>
        <StaticLogStyleRules />
        <PickupStyle userid={logPickup} />
        <LogWrapper
          className="jf-log-list"
          fixedSize={fixedSize}
          data-log-pickup-active={logPickup != null ? 'true' : undefined}
          onClick={this.handleLogWrapperClick}
        >
          {mapReverse(logs.chunks, (chunk, i) => {
            // Decide whether this chunk should be shown.
            const visible =
              visibility.type === 'all' ||
              (visibility.type === 'today'
                ? i === logs.chunks.length - 1
                : chunk.day === visibility.day);

            // number of logs in this chunk
            // which should be rendered.
            const chunkRenderedLogs = Math.max(
              0,
              Math.min(chunk.logs.length, renderedLogs - renderedLogCount),
            );
            renderedLogCount += chunk.logs.length;
            return (
              <LogChunk
                key={`${chunk.day}:${i}`}
                logClass={this.logClass}
                logs={chunk.logs}
                blocks={chunk.blocks}
                renderedNumber={chunkRenderedLogs}
                visible={visible}
                fixedSize={fixedSize}
                icons={icons}
                rule={rule}
                resolveLogById={this.resolveLogById}
                onShortIdClick={onShortIdClick}
              />
            );
          })}
          {renderingState.pendingLogNumber > 0 ? (
            <PendingLogMessage>正在读取...</PendingLogMessage>
          ) : null}
        </LogWrapper>
      </>
    );
  }
}

/**
 * Show chunk of logs.
 */
class LogChunk extends React.PureComponent<
  {
    /**
     * Class attached to each log.
     */
    logClass: string;
    /**
     * Logs in this chunk.
     */
    logs: StoredLog[];
    /**
     * Stable log blocks in this chunk.
     */
    blocks: StoredLogBlock[];
    /**
     * Whether this chunk is visible.
     */
    visible: boolean;
    /**
     * Whether logs are rendered in fixed-size mode.
     */
    fixedSize: boolean;
    /**
     * Number of logs to render.
     */
    renderedNumber: number;
    /**
     * Icon of each user.
     */
    icons: Record<string, string | undefined>;
    /**
     * Current rule.
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
  },
  {}
> {
  public render() {
    const {
      logClass,
      logs,
      blocks,
      visible,
      fixedSize,
      renderedNumber,
      rule,
      icons,
      resolveLogById,
      onShortIdClick,
    } = this.props;
    if (!visible && !fixedSize) {
      return null;
    }
    const chunkContent = (
      <I18n namespace="game_client">
        {t =>
          fixedSize
            ? mapReverse(
                selectRenderedBlocks(blocks, renderedNumber),
                block => (
                  <LogBlock
                    key={block.blockId}
                    logClass={logClass}
                    logs={block.logs}
                    logLength={block.logs.length}
                    lastLogId={
                      block.logs.length > 0
                        ? block.logs[block.logs.length - 1].logid
                        : 0
                    }
                    fixedSize={fixedSize}
                    t={t}
                    rule={rule}
                    icons={icons}
                    resolveLogById={resolveLogById}
                    onShortIdClick={onShortIdClick}
                  />
                ),
              )
            : mapReverse(selectRenderedLogs(logs, renderedNumber), log => (
                <OneLog
                  key={log.logid}
                  logClass={logClass}
                  t={t}
                  fixedSize={fixedSize}
                  log={log}
                  rule={rule}
                  icons={icons}
                  resolveLogById={resolveLogById}
                  onShortIdClick={onShortIdClick}
                />
              ))
        }
      </I18n>
    );
    if (fixedSize) {
      return (
        <FixedSizeChunkWrapper visible={visible}>
          {chunkContent}
        </FixedSizeChunkWrapper>
      );
    } else {
      return chunkContent;
    }
  }
}

function selectRenderedLogs(
  logs: StoredLog[],
  renderedNumber: number,
): StoredLog[] {
  return renderedNumber >= logs.length
    ? logs
    : renderedNumber > 0
    ? logs.slice(-renderedNumber)
    : [];
}

function selectRenderedBlocks(
  blocks: StoredLogBlock[],
  renderedNumber: number,
): StoredLogBlock[] {
  if (renderedNumber <= 0) {
    return [];
  }
  const result: StoredLogBlock[] = [];
  let remaining = renderedNumber;
  for (let i = blocks.length - 1; i >= 0 && remaining > 0; i--) {
    const block = blocks[i];
    const take = Math.min(block.logs.length, remaining);
    const logs =
      take === block.logs.length ? block.logs : block.logs.slice(-take);
    if (logs.length > 0) {
      result.push({
        blockId: block.blockId,
        logs,
      });
    }
    remaining -= take;
  }
  result.reverse();
  return result;
}

class LogBlock extends React.PureComponent<{
  /**
   * Class attached to each log.
   */
  logClass: string;
  /**
   * Logs in this block.
   */
  logs: StoredLog[];
  /**
   * Number of logs in this block, used to detect in-place log array updates.
   */
  logLength: number;
  /**
   * Last log id in this block, used to detect appended logs.
   */
  lastLogId: number;
  /**
   * Whether logs are rendered in fixed-size mode.
   */
  fixedSize: boolean;
  /**
   * Translation function.
   */
  t: TranslationFunction;
  /**
   * Icon of each user.
   */
  icons: Record<string, string | undefined>;
  /**
   * Current rule.
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
}> {
  public render() {
    const {
      logClass,
      logs,
      fixedSize,
      t,
      rule,
      icons,
      resolveLogById,
      onShortIdClick,
    } = this.props;
    return (
      <LogBlockWrapper>
        {mapReverse(logs, log => (
          <OneLog
            key={log.logid}
            logClass={logClass}
            t={t}
            fixedSize={fixedSize}
            log={log}
            rule={rule}
            icons={icons}
            resolveLogById={resolveLogById}
            onShortIdClick={onShortIdClick}
          />
        ))}
      </LogBlockWrapper>
    );
  }
}
