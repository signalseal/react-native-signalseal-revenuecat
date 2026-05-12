# @signalseal/react-native-revenuecat

Forwards the attribution SignalSeal resolved for an install onto the current
RevenueCat subscriber as [subscriber attributes][rc-attrs] — so RevenueCat (and
everything downstream of it) can tie subscription revenue back to the ad
campaign that drove the install.

Pure JavaScript. No native code, nothing bundled. Its only peer dependency is
`react-native-purchases` — it does *not* import `@signalseal/react-native`. You
fetch the params yourself and hand them in.

## Install

```bash
npm install @signalseal/react-native-revenuecat
# peer (you already have it):
npm install react-native-purchases
```

## Usage

```ts
import { SignalSealSDK } from '@signalseal/react-native';
import * as SignalSealRevenueCat from '@signalseal/react-native-revenuecat';

const attributes = await SignalSealSDK.getAttributionParams();
await SignalSealRevenueCat.syncAttributes(attributes);
```

Call it once at startup, after `SignalSealSDK.configure()`. Order relative to
`Purchases.configure()` doesn't matter — `syncAttributes` polls
`Purchases.isConfigured()` before writing anything. If the install was organic
(no campaign matched), nothing is written. Safe to call more than once —
RevenueCat merges attribute writes.

## API

### `syncAttributes(attributes, options?) → Promise<SyncResult>`

`attributes` is whatever `SignalSealSDK.getAttributionParams()` returned
(`Record<string, string> | null`).

| Option | Default | Notes |
| --- | --- | --- |
| `purchases` | the `react-native-purchases` default export | Inject your own `Purchases`-shaped object (useful for tests). |
| `waitForConfigured` | `true` | Poll `Purchases.isConfigured()` first (RevenueCat drops attribute calls made before `configure()`). |
| `waitTimeoutMs` | `15000` | |
| `pollIntervalMs` | `500` | |
| `log` | no-op | Pass `console.log` to see what happened. |

Returns either `{ synced: true, plan }` or `{ synced: false, reason }` where
`reason` is `'purchases-not-configured'` or `'no-attribution-params'`. It never
throws — individual RevenueCat call failures are logged via `options.log` and
skipped.

## Requirements

- `react-native-purchases` **≥ 7.0.0**
- Any version of `@signalseal/react-native` that exposes
  `getAttributionParams()` (≥ 0.2.0) — but this package never imports it.

## License

MIT

[rc-attrs]: https://www.revenuecat.com/docs/customers/customer-attributes
