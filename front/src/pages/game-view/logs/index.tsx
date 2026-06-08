import * as React from 'react';
import { observer } from 'mobx-react';
import { LogVisibility } from '../defs';
import { Rule } from '../../../defs';

import { LogModeStyle, OneLog } from './log';
import { StoredLog, LogStore, StoredLogBlock } from './log-store';
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
   * User ids which can be used for pickup filtering.
   */
  pickupUserids: string[];
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

function uniqueValues(values: string[]): string[] {
  const result: string[] = [];
  const appeared = new Set<string>();
  for (const value of values) {
    if (appeared.has(value)) {
      continue;
    }
    appeared.add(value);
    result.push(value);
  }
  return result;
}

function PickupStyle({ userids }: { userids: string[] }) {
  return (
    <style>
      {uniqueValues(userids)
        .map(userid =>
          [
            `.jf-log-list[data-log-pickup-userid=${cssString(
              userid,
            )}] .jf-log{opacity:0.3;}`,
            `.jf-log-list[data-log-pickup-userid=${cssString(
              userid,
            )}] .jf-log[data-log-userid=${cssString(
              userid,
            )}]:not(.jf-log-mode-system){opacity:1;}`,
          ].join('\n'),
        )
        .join('\n')}
    </style>
  );
}

class LogStyleRules extends React.PureComponent<{
  pickupUserids: string[];
}> {
  public render() {
    return (
      <>
        <LogModeStyle />
        <PickupStyle userids={this.props.pickupUserids} />
      </>
    );
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
      pickupUserids,
      onResetLogPickup,
      onShortIdClick,
    } = this.props;
    const { renderingState } = this.state;

    if (!logs.loaded) {
      return null;
    }

    const fixedSize = true;
    const latestChunk = logs.chunks[logs.chunks.length - 1];
    const latestBlock =
      latestChunk != null
        ? latestChunk.blocks[latestChunk.blocks.length - 1]
        : null;
    const activeBlockId = latestBlock != null ? latestBlock.blockId : null;
    /*
     * number of logs to render (not pending).
     */
    const renderedLogs = logs.allLogNumber - renderingState.pendingLogNumber;

    let renderedLogCount = 0;
    return (
      <>
        <LogStyleRules pickupUserids={pickupUserids} />
        <LogWrapper
          className="jf-log-list"
          fixedSize={fixedSize}
          data-log-pickup-userid={logPickup != null ? logPickup : undefined}
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
                blocks={chunk.blocks}
                renderedNumber={chunkRenderedLogs}
                visible={visible}
                fixedSize={fixedSize}
                icons={icons}
                rule={rule}
                activeBlockId={activeBlockId}
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
     * Stable blocks in this chunk.
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
     * Id of the block that can still receive new logs.
     */
    activeBlockId: number | null;
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
      blocks,
      visible,
      fixedSize,
      renderedNumber,
      rule,
      icons,
      activeBlockId,
      resolveLogById,
      onShortIdClick,
    } = this.props;
    if (!visible && !fixedSize) {
      return null;
    }

    const chunkContent = (
      <I18n namespace="game_client">
        {t =>
          makeRenderedBlocks(blocks, renderedNumber).map(entry => {
            const BlockComponent =
              entry.block.blockId === activeBlockId
                ? ActiveLogBlock
                : HistoricalLogBlock;
            return (
              <BlockComponent
                key={entry.block.blockId}
                logClass={logClass}
                block={entry.block}
                start={entry.start}
                end={entry.end}
                fixedSize={fixedSize}
                icons={icons}
                rule={rule}
                t={t}
                resolveLogById={resolveLogById}
                onShortIdClick={onShortIdClick}
              />
            );
          })
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

function makeRenderedBlocks(
  blocks: StoredLogBlock[],
  renderedNumber: number,
): Array<{
  block: StoredLogBlock;
  start: number;
  end: number;
}> {
  const result: Array<{
    block: StoredLogBlock;
    start: number;
    end: number;
  }> = [];
  let remaining = renderedNumber;
  for (let idx = blocks.length - 1; idx >= 0; idx--) {
    const block = blocks[idx];
    const renderedInBlock = Math.max(0, Math.min(block.logs.length, remaining));
    remaining -= block.logs.length;
    if (renderedInBlock <= 0) {
      continue;
    }
    result.push({
      block,
      start: block.logs.length - renderedInBlock,
      end: block.logs.length,
    });
  }
  return result;
}

interface IPropLogBlock {
  /**
   * Class attached to each log.
   */
  logClass: string;
  /**
   * Log block to render.
   */
  block: StoredLogBlock;
  /**
   * Start index of this block.
   */
  start: number;
  /**
   * End index of this block.
   */
  end: number;
  /**
   * Whether logs are rendered in fixed-size mode.
   */
  fixedSize: boolean;
  /**
   * Icon of each user.
   */
  icons: Record<string, string | undefined>;
  /**
   * Current rule.
   */
  rule: Rule | undefined;
  /**
   * Translation function.
   */
  t: TranslationFunction;
  /**
   * Function to resolve log by shortId for reply reference.
   */
  resolveLogById?: (shortId: string) => StoredLog | null;
  /**
   * Callback for shortId click.
   */
  onShortIdClick?: (shortId: string) => void;
}

class BaseLogBlock<P extends IPropLogBlock> extends React.PureComponent<P> {
  public render() {
    const {
      logClass,
      block,
      start,
      end,
      fixedSize,
      icons,
      rule,
      t,
      resolveLogById,
      onShortIdClick,
    } = this.props;
    const children: React.ReactNode[] = [];
    for (let idx = end - 1; idx >= start; idx--) {
      const log = block.logs[idx];
      children.push(
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
        />,
      );
    }
    return <LogBlockWrapper>{children}</LogBlockWrapper>;
  }
}

class ActiveLogBlock extends BaseLogBlock<IPropLogBlock> {}

class HistoricalLogBlock extends BaseLogBlock<IPropLogBlock> {}
