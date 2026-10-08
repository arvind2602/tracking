import 'package:flutter/material.dart';

// Platforms with WebView support (Android/iOS/desktop) get the real WebView
// screen; platforms without it (web) get a fallback with an external link.
import 'home_stub.dart'
    if (dart.library.io) 'home_webview.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const VigTaskApp());
}

class VigTaskApp extends StatelessWidget {
  const VigTaskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VigTask',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
