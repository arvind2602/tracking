import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vigtask/web_fallback_screen.dart';

void main() {
  testWidgets('fallback screen renders with open-in-browser action',
      (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: WebFallbackScreen()));

    expect(find.text('VigTask'), findsWidgets);
    expect(find.text('Open in browser'), findsOneWidget);
    expect(find.byIcon(Icons.public), findsOneWidget);
  });
}
