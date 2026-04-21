import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/backend_service.dart';
import '../services/esp32_api_service.dart';
import '../services/esp32_bluetooth_service.dart';
import '../services/fake_esp32_services.dart';
import 'carbonflux_controller.dart';

final mockModeProvider = StateProvider<bool>((ref) => false);

final esp32ApiServiceProvider = Provider<Esp32ApiService>((ref) {
  if (ref.watch(mockModeProvider)) return FakeEsp32ApiService();
  final service = Esp32ApiService();
  ref.onDispose(service.dispose);
  return service;
});

final esp32BluetoothServiceProvider = Provider<Esp32BluetoothService>((ref) {
  if (ref.watch(mockModeProvider)) return FakeEsp32BluetoothService();
  final service = Esp32BluetoothService();
  ref.onDispose(service.dispose);
  return service;
});

final backendServiceProvider = Provider<BackendService>((ref) {
  final service = BackendService();
  ref.onDispose(service.dispose);
  return service;
});

final carbonfluxControllerProvider =
    StateNotifierProvider<CarbonfluxController, CarbonfluxAppState>((ref) {
  return CarbonfluxController(
    ref.watch(esp32ApiServiceProvider),
    ref.watch(esp32BluetoothServiceProvider),
    ref.watch(backendServiceProvider),
  );
});

