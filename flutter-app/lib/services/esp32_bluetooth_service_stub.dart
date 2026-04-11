import '../models/device_status.dart';
import '../models/sensor_reading.dart';

class Esp32BluetoothException implements Exception {
  Esp32BluetoothException(this.message);

  final String message;

  @override
  String toString() => message;
}

class DiscoveredBluetoothDevice {
  const DiscoveredBluetoothDevice({
    required this.id,
    required this.name,
    required this.rssi,
    required this.isLikelyTarget,
  });

  final String id;
  final String name;
  final int rssi;
  final bool isLikelyTarget;
}

class Esp32BluetoothService {
  Future<List<DiscoveredBluetoothDevice>> scanDevices() async {
    return const [];
  }

  Future<DeviceStatus> connectAndReadStatus(String deviceId) async {
    throw Esp32BluetoothException(
      'Bluetooth is not supported on this platform build.',
    );
  }

  Future<DeviceStatus> getStatus() async {
    throw Esp32BluetoothException(
      'Bluetooth is not supported on this platform build.',
    );
  }

  Future<SensorReading> getReading() async {
    throw Esp32BluetoothException(
      'Bluetooth is not supported on this platform build.',
    );
  }

  Future<DeviceStatus> sendCommand(String command) async {
    throw Esp32BluetoothException(
      'Bluetooth is not supported on this platform build.',
    );
  }

  Future<void> disconnect() async {}

  void dispose() {}
}
