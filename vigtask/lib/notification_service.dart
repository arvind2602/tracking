import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'app_config.dart';
import 'firebase_options.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  debugPrint('FCM Background message handled: ${message.messageId}');
}

/// Wraps Firebase Cloud Messaging + local notifications so pushes can be
/// displayed while the app is in the foreground and opened into the WebView.
class NotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'vigtask_high_importance_channel',
    'VigTask Notifications',
    description: 'Important VigTask notifications and updates.',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  static Future<void> initialize({
    Function(String link)? onNotificationTap,
  }) async {
    try {
      // 1. Initialize Firebase
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );

      // 2. Register background handler
      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );

      // 3. Request permissions (Android 13+ / iOS)
      final NotificationSettings settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      debugPrint('FCM user granted permission: ${settings.authorizationStatus}');

      // 4. Local notifications configuration (foreground display)
      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const darwinSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: darwinSettings,
      );

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          final payload = response.payload;
          if (payload != null &&
              payload.isNotEmpty &&
              onNotificationTap != null) {
            onNotificationTap(payload);
          }
        },
      );

      // 5. High-importance Android channel
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(_channel);
      }

      // 6. iOS foreground presentation options
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 7. Foreground messages (notification payloads and data payloads)
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final notification = message.notification;
        final data = message.data;
        final title =
            notification?.title ?? data['title']?.toString() ?? 'Notification';
        final body =
            notification?.body ?? data['message']?.toString() ?? '';
        final link = data['link']?.toString() ?? '';

        if (notification != null || data.isNotEmpty) {
          _localNotifications.show(
            message.messageId?.hashCode ??
                DateTime.now().millisecondsSinceEpoch.remainder(100000),
            title,
            body,
            NotificationDetails(
              android: AndroidNotificationDetails(
                _channel.id,
                _channel.name,
                channelDescription: _channel.description,
                importance: Importance.max,
                priority: Priority.high,
                icon: '@mipmap/ic_launcher',
                playSound: true,
                enableVibration: true,
              ),
              iOS: const DarwinNotificationDetails(
                presentAlert: true,
                presentBadge: true,
                presentSound: true,
              ),
            ),
            payload: link,
          );
        }
      });

      // 8. Notification opened while app is in background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final link = message.data['link']?.toString();
        if (link != null && link.isNotEmpty && onNotificationTap != null) {
          onNotificationTap(link);
        }
      });

      // 9. App launched from terminated state by a notification
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        final link = initialMessage.data['link']?.toString();
        if (link != null && link.isNotEmpty && onNotificationTap != null) {
          onNotificationTap(link);
        }
      }

      // 10. Subscribe to the global broadcast topic
      await _messaging.subscribeToTopic(kVigTaskGlobalTopic);
    } catch (e) {
      debugPrint('Error initializing NotificationService: $e');
    }
  }

  static Future<String?> getToken() async {
    try {
      if (Platform.isIOS) {
        // On iOS the APNs token must be available before the FCM token.
        String? apnsToken = await _messaging.getAPNSToken();
        if (apnsToken == null) {
          await Future.delayed(const Duration(milliseconds: 500));
          apnsToken = await _messaging.getAPNSToken();
        }
      }
      return await _messaging.getToken();
    } catch (e) {
      debugPrint('Error getting FCM token: $e');
      return null;
    }
  }

  static Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      debugPrint('FCM successfully subscribed to topic: $topic');
    } catch (e) {
      debugPrint('FCM error subscribing to topic $topic: $e');
    }
  }

  static Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      debugPrint('FCM successfully unsubscribed from topic: $topic');
    } catch (e) {
      debugPrint('FCM error unsubscribing from topic $topic: $e');
    }
  }
}
