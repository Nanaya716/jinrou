import { assertNever } from '../../../util/assert-never';

/**
 * priority of normal speak kinds. Lower priority for earlier occurence in speak kind list.
 */
const normalSpeakKindPriority: Record<string, number | undefined> = {
  prepare: 0,
  audience: 1,
  day: 10,
  werewolf: 20,
  couple: 21,
  madcouple: 22,
  fox: 23,
  monologue: 50,
  gm: 100,
  gmheaven: 101,
  gmaudience: 102,
  gmmonologue: 103,
};

/**
 * Get the priority of given speak kind.
 */
export function getSpeakKindPriority(kind: string): number {
  const normalPriority = normalSpeakKindPriority[kind];
  if (normalPriority != null) {
    return normalPriority;
  }
  if (kind.startsWith('gmreply_')) {
    // gm thing
    return 105;
  } else if (kind.startsWith('helperwhisper_')) {
    // helper
    return 40;
  } else {
    // unknown
    return 1000;
  }
}

/**
 * State of speaking form.
 */
export interface SpeakState {
  /**
   * Size of comment.
   */
  size:
    | 'small'
    | 'normal'
    | 'big'
    | 'skyblue'
    | 'darkblue'
    | 'purple'
    | 'green'
    | 'brown';
  /**
   * Kind of speech.
   */
  kind: string;
  /**
   * Multiline or not.
   */
  multiline: boolean;
  /**
   * Whether will form is open.
   */
  willOpen: boolean;
  /**
   * Whether note form is open.
   */
  noteOpen: boolean;
  /**
   * Whether use wide page.
   */
  widePage: boolean;
}

/**
 * State of the room favorite control.
 */
export interface FavoriteState {
  /**
   * Whether the current user can favorite this room.
   */
  available: boolean;
  /**
   * Whether this room is already favorited by current user.
   */
  favorite: boolean;
  /**
   * Whether a favorite request is running.
   */
  loading: boolean;
}
