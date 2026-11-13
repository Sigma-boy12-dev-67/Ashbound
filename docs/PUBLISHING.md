# Publishing Ashbound

> **Honest status.** The game has been tested in desktop Chromium (menus, all three stages, all three bosses,
> victory, death, phone-size touch layout, ~40,000 fast-forwarded ticks without errors). It has **not** been built
> or run on a real Android device or in the Microsoft Store packaging pipeline — those builds need tools and
> accounts that only you have. Do a full playthrough on a real phone and a real Windows PC before submitting.

## Before you start (both stores)
1. **Pick your identity.** Replace `com.yourstudio.ashbound` in `capacitor.config.json` with your own reverse-domain ID
   (it cannot be changed after the first Play upload). Fill in `<YOUR NAME>`, `<YOUR EMAIL>`, `<DATE>` in `docs/PRIVACY.md`.
2. **Host the privacy policy** at a public URL (GitHub Pages works) — both stores ask for it.
3. **Developer accounts:** Google Play Console (one-time fee) and Microsoft Partner Center (one-time fee).
   Brand-new personal Play accounts may have to run a closed test with a minimum number of testers for a set period
   before production access — check the current rule in Play Console.
4. **Originality.** All code, art, music and sound in this project are original and generated at runtime; there are no
   third-party assets. The title "Ashbound" is not checked against trademarks — search the stores and the USPTO/EUIPO
   databases yourself before committing to the name. Choose a licence for the code if you want one.
5. **Release hygiene:** bump `VERSION` in `sw.js` and `version` in `package.json` for every release.

## Android — Google Play (Capacitor)
Prereqs: Node 18+, Android Studio (includes the SDK + JDK 17).
```
npm install
npm run android:add        # builds ./www and creates ./android (first time only)
npm run android:open       # opens Android Studio
```
Then in `android/app/src/main/AndroidManifest.xml`, on the `<activity>` element add:
```
android:screenOrientation="sensorLandscape"
```
For immersive fullscreen, in `MainActivity.java` add (inside the class; import
`androidx.core.view.WindowCompat`, `androidx.core.view.WindowInsetsControllerCompat`, `android.view.WindowManager`):
```java
@Override public void onWindowFocusChanged(boolean hasFocus) {
  super.onWindowFocusChanged(hasFocus);
  if (hasFocus) {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  }
}
```
Launcher icons: in Android Studio use *File → New → Image Asset* with `icons/icon-maskable-512.png` as the foreground source.

Build the release: *Build → Generate Signed App Bundle* → **Android App Bundle (.aab)**. Create a keystore and **back it up
somewhere safe** (losing it can lock you out of updates; enrol in Play App Signing when prompted).

After code changes: `npm run android:sync`, then rebuild.

**Play Console checklist**
- Create app → Game, free, no ads, no in-app purchases.
- Store listing: short description, full description, **icon** `store/play-icon-512.png`, **feature graphic**
  `store/feature-graphic-1024x500.png`, **phone screenshots** `store/screenshot-*.png` (1920×1080, landscape).
- Content rating: complete the IARC questionnaire (fantasy violence; no blood-realism, gambling, or user content).
- Data safety: **no data collected, no data shared**. Privacy-policy URL from above.
- Target audience: 13+ is the safe choice (not designed for children).
- Upload the `.aab` to Internal testing first, test on a real device, then promote to production.
- Make sure the target API level meets Play's current requirement (Capacitor 6 defaults are fine at time of writing;
  if Play rejects it, update `@capacitor/*` and rebuild).

## Windows — Microsoft Store (PWABuilder, MSIX)
The easiest supported route is to host the game and package it with PWABuilder.
1. Host the contents of `www/` (run `npm run build:www`) on any HTTPS static host — GitHub Pages, Netlify,
   Cloudflare Pages. The game works from a sub-path because all URLs are relative.
2. Go to **pwabuilder.com**, enter your URL, confirm the manifest + service worker checks are green.
3. Choose **Windows → Store package**, fill in your Partner Center publisher identity (Package ID, Publisher ID,
   publisher display name — copy them from *Partner Center → Product identity*), download the `.msixbundle`/`.msix`.
4. Partner Center → new product → **MSIX or PWA app** → upload the package. Provide listing text, the screenshots in
   `store/` (1920×1080), the icon, age rating (IARC), and the privacy policy URL. Select Xbox/Desktop device families
   only if you have tested them (desktop is what the package targets).
5. Test the packaged app locally with the Windows App Certification Kit before submitting.

Gamepad (Xbox controller) works through the browser Gamepad API; fullscreen is available from the title menu.

## Known limitations / things to verify on your own devices
- **Audio** is synthesized with the Web Audio API and starts after the first tap or key press (browser rule).
- **Performance** on low-end Android phones is untested. If it stutters, the first things to reduce are particle counts
  in `js/world.js` and the lighting overlays in `js/worlddraw.js`.
- **Touch layout** was verified in a 844×390 emulated phone; check it on real hardware, including notched phones.
- **Balance** is a first pass. Run `tools/deep.js`-style tests after any tuning, and consider tweaking boss HP in
  `js/bosses.js` and stage multipliers (`hpMul`, `dmgMul`) in `js/data.js` after play-testing.
- No cloud saves: progress lives in local storage and is lost if the app data is cleared or the app is uninstalled.
