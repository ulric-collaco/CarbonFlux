import 'package:carbonflux_app/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App boot smoke test', (tester) async {
    await tester.pumpWidget(const CarbonFluxApp());
    expect(find.text('CarbonFlux'), findsOneWidget);
  });
}
