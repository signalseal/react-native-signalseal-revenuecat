/**
 * @signalseal/react-native-revenuecat
 *
 * Forwards SignalSeal attribution onto the current RevenueCat subscriber
 * as attributes — RevenueCat's reserved campaign fields (`$mediaSource`,
 * `$campaign`, `$adGroup`, `$ad`, `$keyword`) via the dedicated setters,
 * and everything else (the `signalseal_*` keys, raw ad-network click
 * IDs, `deeplink_id`) as custom attributes.
 *
 * The package's only dependency is `react-native-purchases` (peer). It
 * does NOT import `@signalseal/react-native` — you fetch the params with
 * `SignalSealSDK.getAttributionParams()` and pass them in. No native
 * code, nothing bundled.
 *
 *     const attributes = await SignalSealSDK.getAttributionParams();
 *     await SignalSealRevenueCat.syncAttributes(attributes);
 */
import Purchases from 'react-native-purchases';
import type {
  AttributionParams,
  PurchasesLike,
  RevenueCatAttributePlan,
  SyncOptions,
  SyncResult,
} from './types';

export type {
  AttributionParams,
  PurchasesLike,
  RevenueCatAttributePlan,
  SyncOptions,
  SyncResult,
  SyncSkipReason,
} from './types';

/**
 * Reserved-attribute mapping. Each RevenueCat setter is fed the first
 * non-empty value found across `sources`, in order — id keys win over
 * name keys (ids are stable; names get edited in ad managers), falling
 * back to the name only when the id is absent.
 */
const RESERVED_FIELDS = [
  { field: 'mediaSource', setter: 'setMediaSource', sources: ['signalseal_adnetwork', 'signalseal_media_source'] },
  { field: 'campaign', setter: 'setCampaign', sources: ['signalseal_campaign_id', 'signalseal_campaign_name'] },
  { field: 'adGroup', setter: 'setAdGroup', sources: ['signalseal_adgroup_id', 'signalseal_adgroup_name'] },
  { field: 'ad', setter: 'setAd', sources: ['signalseal_ad_id', 'signalseal_ad_name'] },
  { field: 'keyword', setter: 'setKeyword', sources: ['signalseal_keyword'] },
] as const;

/** Raw ad-network click IDs forwarded verbatim as custom attributes. */
const CLICK_ID_KEYS = ['fbclid', 'fbp', 'gclid', 'wbraid', 'gbraid', 'ttclid'] as const;

/** Non-prefixed keys we still want to carry through as custom attributes. */
const EXTRA_CUSTOM_KEYS = new Set<string>(['deeplink_id', ...CLICK_ID_KEYS]);

const DEFAULT_WAIT_TIMEOUT_MS = 15_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

function normalize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length === 0 ? null : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function firstNonEmpty(params: AttributionParams, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = normalize(params[key]);
    if (v !== null) return v;
  }
  return null;
}

/**
 * Pure mapping from SignalSeal attribution params to a RevenueCat
 * attribute plan. Internal — the package's only public entry point is
 * {@link syncAttributes}.
 */
function buildRevenueCatAttributes(params: AttributionParams | null | undefined): RevenueCatAttributePlan {
  const plan: RevenueCatAttributePlan = {
    mediaSource: null,
    campaign: null,
    adGroup: null,
    ad: null,
    keyword: null,
    custom: {},
  };
  if (!params) return plan;

  for (const { field, sources } of RESERVED_FIELDS) {
    plan[field] = firstNonEmpty(params, sources);
  }

  for (const [key, raw] of Object.entries(params)) {
    if (!key.startsWith('signalseal_') && !EXTRA_CUSTOM_KEYS.has(key)) continue;
    const value = normalize(raw);
    if (value !== null) plan.custom[key] = value;
  }

  return plan;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForConfigured(
  purchases: PurchasesLike,
  timeoutMs: number,
  pollMs: number,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  // Always do at least one check, even with a zero timeout.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (await purchases.isConfigured()) return true;
    } catch {
      // isConfigured shouldn't throw, but if it does, treat as "not yet".
    }
    if (Date.now() >= deadline) return false;
    await sleep(pollMs);
  }
}

/**
 * Write SignalSeal attribution params onto the current RevenueCat
 * subscriber. Fetch the params yourself and pass them in:
 *
 * ```ts
 * import { SignalSealSDK } from '@signalseal/react-native';
 * import * as SignalSealRevenueCat from '@signalseal/react-native-revenuecat';
 *
 * const attributes = await SignalSealSDK.getAttributionParams();
 * await SignalSealRevenueCat.syncAttributes(attributes);
 * ```
 *
 * Safe to call more than once (RevenueCat merges attribute writes). A
 * `null`/organic param bag writes nothing. Never throws — individual
 * RevenueCat call failures are logged via `options.log` and skipped.
 * By default it first polls `Purchases.isConfigured()` (RevenueCat drops
 * attribute calls made before `configure()`); pass
 * `{ waitForConfigured: false }` if you've already gated on that.
 */
export async function syncAttributes(
  attributes: AttributionParams | null | undefined,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const log = options.log ?? (() => {});
  // `react-native-purchases` exposes its API as static methods on the
  // default export, which structurally satisfies `PurchasesLike`.
  const purchases: PurchasesLike = options.purchases ?? (Purchases as unknown as PurchasesLike);

  if (!attributes || Object.keys(attributes).length === 0) {
    return { synced: false, reason: 'no-attribution-params' };
  }

  if (options.waitForConfigured !== false) {
    const ok = await waitForConfigured(
      purchases,
      options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    );
    if (!ok) {
      log('[signalseal/revenuecat] Purchases.isConfigured() never true — skipping');
      return { synced: false, reason: 'purchases-not-configured' };
    }
  }

  const plan = buildRevenueCatAttributes(attributes);

  // Reserved fields first (RevenueCat treats these specially in its
  // downstream integrations), then the catch-all custom bag.
  for (const { field, setter } of RESERVED_FIELDS) {
    const value = plan[field];
    if (value === null) continue;
    try {
      await (purchases[setter] as (v: string | null) => Promise<void> | void)(value);
    } catch (err) {
      log(`[signalseal/revenuecat] ${setter}() failed: ${String(err)}`);
    }
  }

  if (Object.keys(plan.custom).length > 0) {
    try {
      await purchases.setAttributes(plan.custom);
    } catch (err) {
      log(`[signalseal/revenuecat] setAttributes() failed: ${String(err)}`);
    }
  }

  log(
    `[signalseal/revenuecat] synced ${Object.keys(plan.custom).length} custom attr(s)` +
      (plan.mediaSource ? ` (media source "${plan.mediaSource}")` : ' (organic)'),
  );
  return { synced: true, plan };
}

export default syncAttributes;
