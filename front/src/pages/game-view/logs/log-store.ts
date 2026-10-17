import '../../../util/mobx-config';
import { observable, action, computed, makeObservable } from 'mobx';
import { Log, LogVisibility } from '../defs';

/**
 * Log with additional information
 */
export type StoredLog = Log & {
  /**
   * Id of log which is unique.
   */
  logid: number;
  /**
   * Day of this log.
   */
  day: number;
};

/**
 * Chunk of logs by day.
 */
export interface LogChunk {
  day: number;
  logs: StoredLog[];
  blocks: StoredLogBlock[];
}

/**
 * Stable block of logs for rendering.
 */
export interface StoredLogBlock {
  blockId: number;
  logs: StoredLog[];
}

export const logBlockSize = 100;

/**
 * Store of logs.
 */
export class LogStore {
  @observable
  public chunks: LogChunk[] = [
    {
      day: 1,
      logs: [],
      blocks: [
        {
          blockId: 1,
          logs: [],
        },
      ],
    },
  ];
  /**
   * Whether initial log is loaded.
   */
  @observable
  public loaded: boolean = false;
  /**
   * Current day of log.
   */
  private currentDay: number = 1;
  /**
   * Last id of log.
   */
  private lastLogId = 0;
  /**
   * Last id of log block.
   */
  private lastBlockId = 1;

  /**
   * Map of shortId to log for quick lookup.
   * This avoids O(n) lookup performance issues.
   */
  private shortIdIndex = new Map<string, StoredLog>();

  constructor() {
    makeObservable(this);
  }

  /**
   * Number of all logs.
   */
  @computed
  public get allLogNumber(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.logs.length, 0);
  }

  /**
   * Add a log to the store.
   */
  @action
  public addLog(log: Log): void {
    // If log is a nextturn log, update current day.
    if (log.mode === 'nextturn' && !log.finished && !log.night) {
      this.currentDay = log.day;
      const lastChunk = this.chunks[this.chunks.length - 1];
      if (lastChunk == null || lastChunk.logs.length > 0) {
        this.chunks.push({
          day: this.currentDay,
          logs: [],
          blocks: [
            {
              blockId: ++this.lastBlockId,
              logs: [],
            },
          ],
        });
      } else {
        lastChunk.day = this.currentDay;
      }
    }
    // current chunk of logs.
    const chunk: LogChunk = this.chunks[this.chunks.length - 1];

    // Id log log is its index in the logs array.
    const logid = ++this.lastLogId;
    const stored: StoredLog = {
      ...log,
      logid,
      day: this.currentDay,
    };
    chunk.logs.push(stored);
    this.getActiveBlock(chunk).logs.push(stored);

    // Add to shortId index for quick lookup
    if (stored.shortId) {
      this.shortIdIndex.set(stored.shortId, stored);
    }
  }
  /**
   * Reset logs.
   */
  @action
  public reset(): void {
    this.currentDay = 1;
    this.lastLogId = 0;
    this.lastBlockId = 0;
    this.chunks = [
      {
        day: 1,
        logs: [],
        blocks: [
          {
            blockId: ++this.lastBlockId,
            logs: [],
          },
        ],
      },
    ];
    this.shortIdIndex.clear();
  }
  /**
   * Reset logs with initial data.
   */
  @action
  public initializeLogs(logs: Log[]): void {
    this.reset();
    this.loaded = true;
    for (const l of logs) {
      this.addLog(l);
    }
  }
  /**
   * Iterate over all logs.
   */
  public *iterateLogs(visibility?: LogVisibility): IterableIterator<StoredLog> {
    if (visibility == null || visibility.type === 'all') {
      // Iterate all logs.
      for (const chunk of this.chunks) {
        yield* chunk.logs;
      }
      return;
    }
    if (visibility.type === 'one') {
      // Iterate over a chunk.
      for (const chunk of this.chunks) {
        if (chunk.day < visibility.day) {
          continue;
        } else if (chunk.day > visibility.day) {
          break;
        }
        yield* chunk.logs;
      }
      return;
    }
    // today
    yield* this.chunks[this.chunks.length - 1].logs;
  }

  /**
   * Find a log by shortId.
   * Returns null if not found.
   */
  public findByShortId(shortId: string): StoredLog | null {
    const result = this.shortIdIndex.get(shortId);
    return result !== undefined ? result : null;
  }

  /**
   * Get the active block of the given chunk.
   */
  private getActiveBlock(chunk: LogChunk): StoredLogBlock {
    const lastBlock = chunk.blocks[chunk.blocks.length - 1];
    if (lastBlock != null && lastBlock.logs.length < logBlockSize) {
      return lastBlock;
    }
    const newBlock: StoredLogBlock = {
      blockId: ++this.lastBlockId,
      logs: [],
    };
    chunk.blocks.push(newBlock);
    return newBlock;
  }
}
