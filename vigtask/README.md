# VigTask

Flutter WebView wrapper for **[https://vigtask.vercel.app/](https://vigtask.vercel.app/)** (Vighnotech Project Tracker).

On Android/iOS the app renders the site full-screen in a WebView with:

- **External links** — anything outside `vigtask.vercel.app` opens in the device browser (`mailto:`, `tel:`, `whatsapp:` etc. too)
- **Blob downloads** — `blob:` downloads are extracted to a temp file and opened natively
- **File uploads** — file choosers go through a native Android picker (`com.vigtask.app/file_picker` method channel)
- **Geolocation** — Android location permission prompt wired to WebView geolocation requests
- **Push notifications** — Firebase Cloud Messaging + local notifications (foreground display, tap-to-open links)
- **Back button** — Android back navigates WebView history first
- **Native bridge** — the page can detect the wrapper (`window.isNativeApp`, `window.onNativeAppReady(platform)`) and use the `FCMBridge` JS channel (`GET_FCM_TOKEN`, `SUBSCRIBE_TOPIC:<topic>`)

Web builds show a fallback screen with an "Open in browser" button (WebView is not available in browsers). Desktop folders exist but `webview_flutter` only runs on mobile.

## Project identity

| Setting | Value |
|---|---|
| App name | VigTask |
| Android applicationId | `com.vigtask.app` |
| iOS/macOS bundle id | `com.vigtask.app` |
| FCM channel | `vigtask_high_importance_channel` |
| FCM broadcast topic | `global` |

## Run / build

```bash
flutter pub get
flutter run                 # device/emulator
flutter build apk --debug   # Android APK
flutter build web           # web fallback
```

## Firebase / push notifications

Already configured by the FlutterFire CLI against Firebase project
**`vigtask-app`**:

| File | Purpose |
|---|---|
| `lib/firebase_options.dart` | Generated options (android/ios/web) |
| `android/app/google-services.json` | Android config |
| `ios/Runner/GoogleService-Info.plist` | iOS config (add to the Runner target in Xcode on a Mac) |
| Gradle | `com.google.gms.google-services` enabled in `settings.gradle.kts` + `app/build.gradle.kts` |

App IDs: android `1:300685608803:android:27cd996345892a5ec67556`,
ios `1:300685608803:ios:2561c7e29ea6bc75c67556`,
web `1:300685608803:web:ce1883050706d104c67556`.

Remaining manual steps:

- **iOS**: upload your APNs key to Firebase (Project settings → Cloud Messaging) and run `flutter build ios` on a Mac
- **Sending**: your backend needs a Firebase service account to send to topic `global`

## Release signing (Android)

Create `android/key.properties` to sign release builds (otherwise the debug key
is used):

```properties
keyAlias=upload
keyPassword=***
storeFile=C:/path/to/upload-keystore.jks
storePassword=***
```

## App icon

The default Flutter icon is used. To replace it: add `assets/icon.png`, set
`image_path` in `flutter_launcher_icons.yaml`, then run
`dart run flutter_launcher_icons`.

## Reference

Structure follows `kes_alumni` (KES Alumni app) — same WebView patterns,
notification service, and native file-picker channel.
