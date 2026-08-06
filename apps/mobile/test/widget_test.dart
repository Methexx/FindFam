import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/app.dart';

void main() {
  testWidgets('FamShareApp renders', (WidgetTester tester) async {
    await tester.pumpWidget(const FamShareApp());

    expect(find.text('FamShare'), findsOneWidget);
  });
}
