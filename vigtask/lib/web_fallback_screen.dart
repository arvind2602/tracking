import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_config.dart';

/// Shown on platforms where an in-app WebView is not available (web builds).
class WebFallbackScreen extends StatelessWidget {
  const WebFallbackScreen({super.key});

  Future<void> _openInBrowser() async {
    final uri = Uri.parse(kVigTaskUrl);
    await launchUrl(uri, mode: LaunchMode.platformDefault);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('VigTask')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.public, size: 72, color: Colors.blue),
              const SizedBox(height: 20),
              const Text(
                'VigTask is a mobile app.\n'
                'In-app browsing is not supported on this platform.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _openInBrowser,
                icon: const Icon(Icons.open_in_browser),
                label: const Text('Open in browser'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
