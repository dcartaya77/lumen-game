/**
 * Subconjunto tipado de la API oficial `telegram-web-app.js`.
 * Referencia: https://core.telegram.org/bots/webapps
 * Solo incluye lo que LUMEN usa; se amplía según necesidad.
 */

export interface TgThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  section_separator_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TgSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TgInitDataUnsafe {
  user?: TgUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

export type TgCloudCallback<T> = (error: string | null, result?: T) => void;

export interface TgCloudStorage {
  setItem(key: string, value: string, cb?: TgCloudCallback<boolean>): TgCloudStorage;
  getItem(key: string, cb: TgCloudCallback<string>): TgCloudStorage;
  getItems(keys: string[], cb: TgCloudCallback<Record<string, string>>): TgCloudStorage;
  removeItem(key: string, cb?: TgCloudCallback<boolean>): TgCloudStorage;
  removeItems(keys: string[], cb?: TgCloudCallback<boolean>): TgCloudStorage;
  getKeys(cb: TgCloudCallback<string[]>): TgCloudStorage;
}

export type TgImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type TgNotificationType = 'error' | 'success' | 'warning';

export interface TgHapticFeedback {
  impactOccurred(style: TgImpactStyle): TgHapticFeedback;
  notificationOccurred(type: TgNotificationType): TgHapticFeedback;
  selectionChanged(): TgHapticFeedback;
}

export interface TgBackButton {
  isVisible: boolean;
  show(): TgBackButton;
  hide(): TgBackButton;
  onClick(cb: () => void): TgBackButton;
  offClick(cb: () => void): TgBackButton;
}

export type TgEventName =
  | 'themeChanged'
  | 'viewportChanged'
  | 'safeAreaChanged'
  | 'contentSafeAreaChanged'
  | 'backButtonClicked'
  | 'activated'
  | 'deactivated'
  | 'fullscreenChanged';

export interface TgWebApp {
  initData: string;
  initDataUnsafe: TgInitDataUnsafe;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TgThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  isActive?: boolean;
  isFullscreen?: boolean;
  safeAreaInset?: TgSafeAreaInset;
  contentSafeAreaInset?: TgSafeAreaInset;
  isVerticalSwipesEnabled?: boolean;
  headerColor: string;
  backgroundColor: string;
  BackButton: TgBackButton;
  HapticFeedback: TgHapticFeedback;
  CloudStorage?: TgCloudStorage;

  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  enableVerticalSwipes?(): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  lockOrientation?(): void;
  unlockOrientation?(): void;
  onEvent(event: TgEventName, handler: () => void): void;
  offEvent(event: TgEventName, handler: () => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  shareToStory?(mediaUrl: string, params?: { text?: string }): void;
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb?: (ok: boolean) => void): void;
  ready(): void;
  expand(): void;
  close(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}
