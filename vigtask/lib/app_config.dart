/// Central configuration for the VigTask app.
library;

/// Origin of the VigTask web app (no trailing slash).
const String kVigTaskOrigin = 'https://vigtask.vercel.app';

/// Full URL loaded when the app starts.
const String kVigTaskUrl = '$kVigTaskOrigin/';

/// Name of the FCM topic every device subscribes to for broadcast pushes.
const String kVigTaskGlobalTopic = 'global';
