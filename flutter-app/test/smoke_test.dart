import 'package:carbonflux_app/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('App boot smoke test', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      const ProviderScope(child: CarbonFluxApp()),
    );

    expect(find.text('CARBONFLUX'), findsOneWidget);
  });
}
