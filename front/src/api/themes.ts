/**
 * API to fetch all themes and their skins for OpenAvatar mode.
 */

export interface ThemeSkin {
  theme: string;
  themeName: string;
  skinKey: string;
  name: string;
  avatar: string | string[];
  prize: string | string[];
}

export function getAllThemesSkins(): Promise<ThemeSkin[]> {
  return new Promise((resolve, reject) => {
    const ss = (window as any).ss;
    if (!ss) {
      reject('ss not available');
      return;
    }
    ss.rpc('game.themes.getAllThemesSkins', (result: any) => {
      if (result && result.error) {
        reject(result.error);
        return;
      }
      if (!result || !Array.isArray(result)) {
        reject('Invalid result');
        return;
      }
      resolve(result);
    });
  });
}
