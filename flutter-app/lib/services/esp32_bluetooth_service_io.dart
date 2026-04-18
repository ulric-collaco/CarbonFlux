import 'dart:async';
import 'dart:convert';

import 'package:flutter_blue_plus/flutter_blue_plus.dart';

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
  static final Guid _serviceUuid = Guid('6f4e0001-5f8a-4d8d-9f4f-3a7c8e3d1001');
  static final Guid _statusUuid = Guid('6f4e0002-5f8a-4d8d-9f4f-3a7c8e3d1001');
  static final Guid _commandUuid = Guid('6f4e0003-5f8a-4d8d-9f4f-3a7c8e3d1001');
  static final Guid _readingUuid = Guid('6f4e0004-5f8a-4d8d-9f4f-3a7c8e3d1001');

  static const Duration _scanDuration = Duration(seconds: 6);
  static const Duration _connectTimeout = Duration(seconds: 10);

  BluetoothDevice? _device;
  BluetoothCharacteristic? _statusChar;
  BluetoothCharacteristic? _commandChar;
  BluetoothCharacteristic? _readingChar;

  Future<List<DiscoveredBluetoothDevice>> scanDevices() async {
    final adapterState = await FlutterBluePlus.adapterState.first;
    if (adapterState != BluetoothAdapterState.on) {
      throw Esp32BluetoothException('Bluetooth is off. Turn it on and retry.');
    }

    final found = <String, DiscoveredBluetoothDevice>{};
    final sub = FlutterBluePlus.scanResults.listen((results) {
      for (final result in results) {
        final name = _displayName(result);
        final lower = name.toLowerCase();
        final isLikely =
            lower.contains('carbonflux') || lower.contains('esp32');

        found[result.device.remoteId.str] = DiscoveredBluetoothDevice(
          id: result.device.remoteId.str,
          name: name,
          rssi: result.rssi,
          isLikelyTarget: isLikely,
        );
      }
    });

    await FlutterBluePlus.stopScan();
    await FlutterBluePlus.startScan(timeout: _scanDuration);
    await Future.delayed(_scanDuration + const Duration(milliseconds: 200));
    await FlutterBluePlus.stopScan();
    await sub.cancel();

    final devices = found.values.toList()
      ..sort((a, b) {
        if (a.isLikelyTarget != b.isLikelyTarget) {
          return a.isLikelyTarget ? -1 : 1;
        }
        return b.rssi.compareTo(a.rssi);
      });

    return devices;
  }

  Future<DeviceStatus> connectAndReadStatus(String deviceId) async {
    final target = BluetoothDevice.fromId(deviceId);

    try {
      await target.connect(timeout: _connectTimeout);
    } on FlutterBluePlusException catch (error) {
      // Ignore "already connected" and continue.
      final description = (error.description ?? '').toLowerCase();
      if (!description.contains('already connected')) {
        throw Esp32BluetoothException(
          'Bluetooth connect failed: ${error.description ?? 'unknown error'}',
        );
      }
    }

    _device = target;
    await _discoverCharacteristics();
    return getStatus();
  }

  Future<DeviceStatus> getStatus() async {
    final statusChar = _statusChar;
    if (statusChar == null) {
      throw Esp32BluetoothException(
          'Not connected to a CarbonFlux BLE device.');
    }

    final payload = await statusChar.read();
    final decoded = _decodeJson(payload);
    if (!decoded.containsKey('state')) {
      throw Esp32BluetoothException('Invalid BLE status payload.');
    }

    return DeviceStatus.fromJson({
      ...decoded,
      'timestamp': decoded['uptime_s'] ?? decoded['timestamp'] ?? 0,
    });
  }

  Future<SensorReading> getReading() async {
    final readingChar = _readingChar;
    if (readingChar == null) {
      throw Esp32BluetoothException(
          'Not connected to a CarbonFlux BLE device.');
    }

    final payload = await readingChar.read();
    final decoded = _decodeJson(payload);
    if (decoded['error'] != null) {
      throw Esp32BluetoothException(decoded['error'].toString());
    }

    return SensorReading.fromJson(decoded);
  }

  Future<DeviceStatus> sendCommand(String command) async {
    final commandChar = _commandChar;
    if (commandChar == null) {
      throw Esp32BluetoothException(
          'Not connected to a CarbonFlux BLE device.');
    }

    await commandChar.write(utf8.encode(command), withoutResponse: false);
    await Future.delayed(const Duration(milliseconds: 220));
    return getStatus();
  }

  Future<void> disconnect() async {
    final device = _device;
    _statusChar = null;
    _commandChar = null;
    _readingChar = null;
    _device = null;

    if (device != null) {
      await device.disconnect();
    }
  }

  void dispose() {
    unawaited(disconnect());
  }

  Future<void> _discoverCharacteristics() async {
    final device = _device;
    if (device == null) {
      throw Esp32BluetoothException('Missing Bluetooth device.');
    }

    final services = await device.discoverServices();
    for (final service in services) {
      if (service.uuid != _serviceUuid) continue;

      for (final characteristic in service.characteristics) {
        if (characteristic.uuid == _statusUuid) {
          _statusChar = characteristic;
        } else if (characteristic.uuid == _commandUuid) {
          _commandChar = characteristic;
        } else if (characteristic.uuid == _readingUuid) {
          _readingChar = characteristic;
        }
      }
    }

    if (_statusChar == null || _commandChar == null || _readingChar == null) {
      throw Esp32BluetoothException(
        'Connected device is missing CarbonFlux BLE characteristics.',
      );
    }
  }

  Map<String, dynamic> _decodeJson(List<int> raw) {
    try {
      final decoded = jsonDecode(utf8.decode(raw));
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // handled below
    }
    throw Esp32BluetoothException('Invalid BLE JSON payload.');
  }

  String _displayName(ScanResult result) {
    final platformName = result.device.platformName.trim();
    if (platformName.isNotEmpty) {
      return platformName;
    }
    final advName = result.advertisementData.advName.trim();
    if (advName.isNotEmpty) {
      return advName;
    }
    return 'Unknown Device';
  }
}
