/**
 * Set of handlers related to room prelude controls.
 */
export interface RoomControlHandlers {
  /**
   * Handler for room entry.
   * @param user Data of user when the room is blind.
   * @param user.selectedSkin For OpenAvatar mode: { theme: string, skinKey: string }
   * @param user.customName For OpenAvatar custom mode: custom name
   * @param user.customIcon For OpenAvatar custom mode: custom avatar URL
   */
  join(user: {
    name: string;
    icon: string | null;
    selectedSkin?: { theme: string; skinKey: string };
    customName?: string;
    customIcon?: string;
  }): void;
  /**
   * Handler for room leave.
   */
  unjoin(): void;
  /**
   * Handler for ready/unready button.
   */
  ready(): void;
  /**
   * Handler for helper button.
   */
  helper(userid: string | null): void;
  /**
   * Open game start button.
   */
  openGameStart(): void;
  /**
   * kick button.
   */
  kick(obj: { id: string; noentry: boolean }): void;
  /**
   * Remove fomr kick list.
   */
  kickRemove(users: string[]): void;
  /**
   * Reset everyone's ready button.
   */
  resetReady(): void;
  /**
   * Room discard button.
   */
  discard(): void;
  /**
   * Make a new room with same settings button.
   */
  newRoom(): void;
}

/**
 * Role data for OpenAvatar selection
 */
export interface OpenAvatarRole {
  theme: string;
  themeName: string;
  skinKey: string;
  name: string;
  avatar: string | string[];
  prize: string | string[];
}
