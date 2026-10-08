import 'package:flutter/material.dart';

import 'web_fallback_screen.dart';

/// Fallback home screen used when the platform has no WebView support (web).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebFallbackScreen();
  }
}
