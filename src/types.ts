/**
 * Minimal structural shape of the bits of `react-native-purchases` this
 * package touches. We deliberately do NOT `import type` from
 * `react-native-purchases` so the package typechecks (and ships) even
 * when the host app pins a different major. At runtime we resolve the
 * real module via `require('react-native-purchases')` (or an instance
 * the caller passes in) — see {@link SyncOptions.purchases}.
 *
 * Every setter returns `Promise<void>` in current RevenueCat SDKs, but
 * we accept `void` too so older synchronous-ish builds still satisfy the
 * type.
 */
export interface PurchasesLike {
  isConfigured(): Promise<boolean> | boolean;
  setAttributes(attributes: Record<string, string | null>): Promise<void> | void;
  setMediaSource(mediaSource: string | null): Promise<void> | void;
  setCampaign(campaign: string | null): Promise<void> | void;
  setAdGroup(adGroup: string | null): Promise<void> | void;
  setAd(ad: string | null): Promise<void> | void;
  setKeyword(keyword: string | null): Promise<void> | void;
}

/**
 * Flat string→string attribution map — exactly what
 * `SignalSealSDK.getAttributionParams()` returns. This package never
 * imports `@signalseal/react-native`; the caller fetches the params and
 * hands them in.
 */
export type AttributionParams = Record<string, string>;

/**
 * The shape produced by {@link buildRevenueCatAttributes}: RevenueCat's
 * reserved campaign fields broken out from everything else, which goes
 * through `Purchases.setAttributes` verbatim.
 */
export interface RevenueCatAttributePlan {
  /** Drives `Purchases.setMediaSource`. `null` ⇒ don't call it. */
  mediaSource: string | null;
  /** Drives `Purchases.setCampaign`. */
  campaign: string | null;
  /** Drives `Purchases.setAdGroup`. */
  adGroup: string | null;
  /** Drives `Purchases.setAd`. */
  ad: string | null;
  /** Drives `Purchases.setKeyword`. */
  keyword: string | null;
  /** Everything else — passed to `Purchases.setAttributes`. */
  custom: Record<string, string>;
}

export interface SyncOptions {
  /**
   * The `react-native-purchases` module (or anything matching
   * {@link PurchasesLike}). Defaults to `require('react-native-purchases').default`.
   * Pass your already-imported `Purchases` if you'd rather not have this
   * package resolve it (e.g. monorepo dedupe paranoia).
   */
  purchases?: PurchasesLike;
  /**
   * Poll `Purchases.isConfigured()` before writing. RevenueCat drops
   * attribute calls made before `configure()`. Default `true`.
   */
  waitForConfigured?: boolean;
  /** Max time to wait for `isConfigured()`. Default `15000` ms. */
  waitTimeoutMs?: number;
  /** Poll interval while waiting. Default `500` ms. */
  pollIntervalMs?: number;
  /**
   * Optional logger. Receives short status strings. Defaults to a no-op
   * — pass `console.log` (or your logger) to see what happened.
   */
  log?: (message: string) => void;
}

export type SyncSkipReason = 'purchases-not-configured' | 'no-attribution-params';

export type SyncResult =
  | {
      synced: true;
      /** The reserved/custom split that was sent to RevenueCat. */
      plan: RevenueCatAttributePlan;
    }
  | {
      synced: false;
      reason: SyncSkipReason;
    };
