import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/esp32_api_service.dart';
import '../services/esp32_bluetooth_service.dart';
import 'carbonflux_controller.dart';

final esp32ApiServiceProvider = Provider<Esp32ApiService>((ref) {
  final service = Esp32ApiService();
  ref.onDispose(service.dispose);
  return service;
});

final esp32BluetoothServiceProvider = Provider<Esp32BluetoothService>((ref) {
  final service = Esp32BluetoothService();
  ref.onDispose(service.dispose);
  return service;
});

final carbonfluxControllerProvider =
    StateNotifierProvider<CarbonfluxController, CarbonfluxAppState>((ref) {
  return CarbonfluxController(
    ref.read(esp32ApiServiceProvider),
    ref.read(esp32BluetoothServiceProvider),
  );
});
