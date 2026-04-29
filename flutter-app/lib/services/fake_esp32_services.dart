import 'dart:async';
import 'dart:math';

import '../models/device_status.dart';
import '../models/sensor_reading.dart';
import '../providers/carbonflux_controller.dart';
import 'esp32_api_service.dart';
import 'esp32_bluetooth_service.dart';

class FakeEsp32State {
  static String state = 'STANDBY';
  static int nonce = 0;
  static DateTime? warmupStart;

  static void reset() {
    state = 'STANDBY';
    nonce = 0;
    warmupStart = null;
  }

  static void tick() {
    if (state == 'WARMUP' && warmupStart != null) {
      if (DateTime.now().difference(warmupStart!) >
          carbonFluxWarmupDuration) {
        state = 'READY';
      }
    }
  }

  static SensorReading generateReading() {
    nonce++;
    final r = Random();
    final basePpm = 400.0 + r.nextDouble() * 200;
    final isSpike = r.nextDouble() > 0.85; // 15% chance of a spike
    final ppm = isSpike ? 500.0 + r.nextDouble() * 500 : basePpm;

    return SensorReading(
      deviceId: 'MOCK-DEVICE',
      state: state,
      ppmProxy: ppm,
      rawAdc: (ppm * 0.8).toInt(),
      nonce: nonce,
      timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      hash: 123456789,
    );
  }

  static DeviceStatus processCommand(String command) {
    if (command == 'START_WARMUP') {
      state = 'WARMUP';
      warmupStart = DateTime.now();
    } else if (command == 'START_DETECT') {
      if (state == 'READY' || state == 'STANDBY') {
        state = 'DETECTING';
      }
    } else if (command == 'STOP') {
      state = 'STOPPED';
    } else if (command == 'RESET') {
      reset();
    }
    return DeviceStatus(
      deviceId: 'MOCK-DEVICE',
      state: state,
      timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
    );
  }
}

class FakeEsp32ApiService extends Esp32ApiService {
  @override
  Future<DeviceStatus> getStatus(String ip) async {
    await Future.delayed(const Duration(milliseconds: 300));
    FakeEsp32State.tick();
    return DeviceStatus(
      deviceId: 'MOCK-DEVICE',
      state: FakeEsp32State.state,
      timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
    );
  }

  @override
  Future<List<DiscoveredEsp32Device>> discoverDevices({String? hintIp}) async {
    await Future.delayed(const Duration(seconds: 1));
    return const [
      DiscoveredEsp32Device(
        ip: '192.168.0.77',
        status: DeviceStatus(
          deviceId: 'MOCK-DEVICE',
          state: 'STANDBY',
          timestamp: 0,
        ),
      )
    ];
  }

  @override
  Future<SensorReading> getReading(String ip) async {
    await Future.delayed(const Duration(milliseconds: 100));
    FakeEsp32State.tick();
    return FakeEsp32State.generateReading();
  }

  @override
  Future<List<SensorReading>> getStream(String ip) async {
    await Future.delayed(const Duration(milliseconds: 800));
    FakeEsp32State.tick();
    return List.generate(5, (_) => FakeEsp32State.generateReading());
  }

  @override
  Future<DeviceStatus> sendCommand(String ip, String command) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return FakeEsp32State.processCommand(command);
  }
}

class FakeEsp32BluetoothService extends Esp32BluetoothService {
  @override
  Future<List<DiscoveredBluetoothDevice>> scanDevices() async {
    await Future.delayed(const Duration(seconds: 2));
    return const [
      DiscoveredBluetoothDevice(
        id: 'MOCK-BLE-MAC',
        name: 'CarbonFlux-MockBLE',
        rssi: -50,
        isLikelyTarget: true,
      )
    ];
  }

  @override
  Future<DeviceStatus> connectAndReadStatus(String deviceId) async {
    await Future.delayed(const Duration(seconds: 1));
    return DeviceStatus(
      deviceId: 'MOCK-DEVICE',
      state: FakeEsp32State.state,
      timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
    );
  }

  @override
  Future<DeviceStatus> getStatus() async {
    await Future.delayed(const Duration(milliseconds: 200));
    FakeEsp32State.tick();
    return DeviceStatus(
      deviceId: 'MOCK-DEVICE',
      state: FakeEsp32State.state,
      timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
    );
  }

  @override
  Future<SensorReading> getReading() async {
    await Future.delayed(const Duration(milliseconds: 100));
    FakeEsp32State.tick();
    return FakeEsp32State.generateReading();
  }

  @override
  Future<DeviceStatus> sendCommand(String command) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return FakeEsp32State.processCommand(command);
  }

  @override
  Future<void> disconnect() async {
    await Future.delayed(const Duration(milliseconds: 200));
    FakeEsp32State.reset();
  }
}
