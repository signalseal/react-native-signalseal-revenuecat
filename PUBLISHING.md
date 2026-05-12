# Releasing — @signalseal/react-native-revenuecat

This is a **pure-JS** package — no native artefacts, no lockstep with the
iOS/Android/core SDKs. Releasing is just a version bump + `npm publish`.

## What ships

```
@signalseal/react-native-revenuecat/
├── lib/   # compiled TS → JS + d.ts (built on release; gitignored)
├── src/   # TS source (shipped for source maps)
└── README.md
```

`react-native-purchases` is the **only** peer dependency — never bundled. The
package does not import `@signalseal/react-native`; callers fetch attribution
params with `getAttributionParams()` and pass them to `syncAttributes()`.

## Steps

1. Bump `package.json#version` (semver — this package versions independently).
2. `npm run build` (runs `tsc` → `lib/`).
3. `npm publish --access public`.

## Compatibility notes

- The RevenueCat reserved-attribute setters used here (`setMediaSource`,
  `setCampaign`, `setAdGroup`, `setAd`, `setKeyword`, `setAttributes`,
  `isConfigured`) have been stable since `react-native-purchases` v4. The
  peer range is `>=7.0.0` only to keep the supported surface small — widen it
  if a customer needs an older line.
- The source-key list (`signalseal_*`, click IDs, `deeplink_id`) tracks
  `SignalSealSDK.getAttributionParams()`. If the core SDK adds a new
  attribution key worth forwarding, update `RESERVED_FIELDS` /
  `EXTRA_CUSTOM_KEYS` in `src/index.ts` and cut a new release — no core-SDK
  release is required for that.
