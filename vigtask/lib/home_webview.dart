import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'app_config.dart';
import 'notification_service.dart';

/// Full WebView home screen for platforms that support it (Android/iOS/desktop).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final WebViewController controller;
  static const MethodChannel _filePickerChannel =
      MethodChannel('com.vigtask.app/file_picker');

  /// Loads the VigTask web app.
  @override
  void initState() {
    super.initState();

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      // The page posts base64 blob payloads here so they can be saved/opened
      // natively (downloads that would otherwise stay inside the WebView).
      ..addJavaScriptChannel(
        'BlobDownload',
        onMessageReceived: (JavaScriptMessage message) async {
          try {
            final Map<String, dynamic> json = jsonDecode(message.message);
            final String base64data = json['data'];
            final String fileName = json['fileName'];

            final parts = base64data.split(',');
            if (parts.length == 2) {
              final bytes = base64Decode(parts[1]);
              final dir = await getTemporaryDirectory();
              final String type = parts[0].split(';')[0].split(':')[1];
              String extension = '';
              if (type == 'application/pdf') {
                extension = '.pdf';
              } else if (type == 'image/jpeg') {
                extension = '.jpg';
              } else if (type == 'image/png') {
                extension = '.png';
              }

              final file = File('${dir.path}/$fileName$extension');
              await file.writeAsBytes(bytes);
              await OpenFilex.open(file.path);
            }
          } catch (e) {
            debugPrint('Error downloading blob: $e');
          }
        },
      )
      // Bridge used by the web app to fetch the FCM token / subscribe to
      // topics from JavaScript. Channel names match the reference app so the
      // same web-side integration code works unchanged.
      ..addJavaScriptChannel(
        'FCMBridge',
        onMessageReceived: (JavaScriptMessage message) async {
          if (message.message == 'GET_FCM_TOKEN') {
            final token = await NotificationService.getToken();
            final platform = Platform.isIOS ? 'ios' : 'android';
            if (token != null) {
              controller.runJavaScript('''
                if (typeof window.onNativeFcmTokenReceived === 'function') {
                  window.onNativeFcmTokenReceived("$token", "$platform");
                }
              ''');
            }
          } else if (message.message.startsWith('SUBSCRIBE_TOPIC:')) {
            final topic =
                message.message.substring('SUBSCRIBE_TOPIC:'.length).trim();
            if (topic.isNotEmpty) {
              await NotificationService.subscribeToTopic(topic);
            }
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (String url) {
            // Tell the web app it is running inside the native wrapper.
            final platform = Platform.isIOS ? 'ios' : 'android';
            controller.runJavaScript('''
              window.isNativeApp = true;
              window.nativePlatform = "$platform";
              if (typeof window.onNativeAppReady === 'function') {
                window.onNativeAppReady("$platform");
              }
            ''');
          },
          onNavigationRequest: (NavigationRequest request) {
            final url = request.url;

            // Custom schemes (mailto:, tel:, intent:, whatsapp: ...) and other
            // protocols are handed to the OS.
            if (!url.startsWith('http') && !url.startsWith('blob:')) {
              _launchExternal(url);
              return NavigationDecision.prevent;
            }

            // Any http(s) URL outside the VigTask origin opens in the browser.
            if (url.startsWith('http') &&
                !url.startsWith(kVigTaskOrigin) &&
                url != 'about:blank') {
              _launchExternal(url);
              return NavigationDecision.prevent;
            }

            // Blob URLs never navigate; extract their content and open it.
            if (url.startsWith('blob:')) {
              controller.runJavaScript(_blobExtractorJs(url));
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(kVigTaskUrl));

    // Geolocation permission prompts (Android).
    if (controller.platform is AndroidWebViewController) {
      final androidController = controller.platform as AndroidWebViewController;
      androidController.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (GeolocationPermissionsRequestParams params) async {
          final status = await Permission.location.request();
          return GeolocationPermissionsResponse(
            allow: status.isGranted,
            retain: false,
          );
        },
      );

      // File uploads go through a native chooser (Android).
      androidController.setOnShowFileSelector(
        (FileSelectorParams params) async {
          try {
            final bool allowMultiple = params.mode == FileSelectorMode.openMultiple;
            final List<dynamic> result = await _filePickerChannel.invokeMethod(
              'pickFile',
              {'allowMultiple': allowMultiple},
            );
            return result.cast<String>();
          } catch (e) {
            debugPrint('File selector error: $e');
            return [];
          }
        },
      );
    }

    // Push notifications: tapping a notification opens its link in the WebView.
    NotificationService.initialize(
      onNotificationTap: _openFromNotificationLink,
    );
  }

  Future<void> _launchExternal(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('Could not launch $url: $e');
    }
  }

  /// Opens a notification link inside the WebView. Absolute URLs are used as
  ///-is; relative links are resolved against the VigTask origin.
  void _openFromNotificationLink(String link) {
    if (link.isEmpty) return;
    final Uri parsed = Uri.parse(link);
    final String target = parsed.hasScheme
        ? link
        : '$kVigTaskOrigin${link.startsWith('/') ? '' : '/'}$link';
    controller.loadRequest(Uri.parse(target));
  }

  /// JavaScript that converts a blob: URL into a base64 payload posted back to
  /// the [BlobDownload] channel.
  static String _blobExtractorJs(String url) => '''
    (function() {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '$url', true);
      xhr.responseType = 'blob';
      xhr.onload = function(e) {
        if (this.status == 200) {
          var blob = this.response;
          var reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = function() {
            var base64data = reader.result;
            var fileName = 'downloaded_document_' + new Date().getTime();
            BlobDownload.postMessage(JSON.stringify({
              data: base64data,
              fileName: fileName
            }));
          };
        }
      };
      xhr.send();
    })();
  ''';

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;
        if (await controller.canGoBack()) {
          await controller.goBack();
        } else {
          if (context.mounted) {
            Navigator.of(context).pop();
          }
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: WebViewWidget(controller: controller),
        ),
      ),
    );
  }
}
