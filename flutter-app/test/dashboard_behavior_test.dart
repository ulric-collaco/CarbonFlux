import 'package:carbonflux_app/models/device_status.dart';
import 'package:carbonflux_app/models/sensor_reading.dart';
import 'package:carbonflux_app/providers/app_providers.dart';
import 'package:carbonflux_app/providers/carbonflux_controller.dart';
import 'package:carbonflux_app/screens/dashboard_screen.dart';
import 'package:carbonflux_app/services/backend_service.dart';
import 'package:carbonflux_app/services/fake_esp32_services.dart';
import 'package:carbonflux_app/theme/carbonflux_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('warmup remaining seconds uses a 30 second window', () {
    final state = CarbonfluxAppState(
      status: const DeviceStatus(
        deviceId: 'carbonflux-001',
        state: 'WARMUP',
        timestamp: 0,
      ),
      warmupStartedAt: DateTime.now().subtract(const Duration(seconds: 10)),
    );

    expect(state.warmupRemainingSeconds, inInclusiveRange(19, 20));
  });

  testWidgets(
    'dashboard keeps upload status visible and removes stream view',
    (tester) async {
      final state = CarbonfluxAppState(
        isConnected: true,
        status: const DeviceStatus(
          deviceId: 'carbonflux-001',
          state: 'READY',
          timestamp: 0,
        ),
        latestReading: const SensorReading(
          deviceId: 'carbonflux-001',
          state: 'READY',
          rawAdc: 412,
          ppmProxy: 412,
          nonce: 7,
          timestamp: 1,
          hash: 99,
        ),
        readingHistory: const [
          SensorReading(
            deviceId: 'carbonflux-001',
            state: 'READY',
            rawAdc: 412,
            ppmProxy: 412,
            nonce: 7,
            timestamp: 1,
            hash: 99,
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            carbonfluxControllerProvider.overrideWith(
              (ref) => _TestCarbonfluxController(state),
            ),
          ],
          child: MaterialApp(
            theme: CarbonFluxTheme.dark(),
            home: const DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('STREAM VIEW'), findsNothing);
      expect(find.text('Monitoring sensor data stream'), findsOneWidget);
    },
  );
}

class _TestCarbonfluxController extends CarbonfluxController {
  _TestCarbonfluxController(CarbonfluxAppState initialState)
      : super(
          FakeEsp32ApiService(),
          FakeEsp32BluetoothService(),
          BackendService(),
        ) {
    state = initialState;
  }
}
