import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/device_status.dart';
import '../models/sensor_reading.dart';

class DiscoveredEsp32Device {
  const DiscoveredEsp32Device({required this.ip, required this.status});

  final String ip;
  final DeviceStatus status;
}

class Esp32ApiException implements Exception {
  Esp32ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class Esp32ApiService {
  Esp32ApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  static const Duration _timeout = Duration(seconds: 4);
  static const Duration _discoveryTimeout = Duration(milliseconds: 650);

  Uri _uri(String ip, String path, [Map<String, String>? query]) {
    return Uri.http(ip, path, query);
  }

  Future<Map<String, dynamic>> _getJson(Uri uri, {Duration? timeout}) async {
    try {
      final response = await _client.get(uri).timeout(timeout ?? _timeout);
      if (response.statusCode != 200) {
        throw Esp32ApiException('ESP32 returned HTTP ${response.statusCode}');
      }

      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      throw Esp32ApiException('Unexpected response format.');
    } on FormatException {
      throw Esp32ApiException('Invalid JSON response from ESP32.');
    } on http.ClientException {
      throw Esp32ApiException('Network error. Check WiFi connection.');
    } on Exception catch (error) {
      if (error is Esp32ApiException) rethrow;
      throw Esp32ApiException('Request failed: $error');
    }
  }

  Future<List<Map<String, dynamic>>> _getJsonList(Uri uri) async {
    try {
      final response = await _client.get(uri).timeout(_timeout);
      if (response.statusCode != 200) {
        throw Esp32ApiException('ESP32 returned HTTP ${response.statusCode}');
      }

      final decoded = jsonDecode(response.body);
      if (decoded is List) {
        return decoded.whereType<Map<String, dynamic>>().toList();
      }
      throw Esp32ApiException('Unexpected stream response format.');
    } on FormatException {
      throw Esp32ApiException('Invalid JSON response from ESP32.');
    } on http.ClientException {
      throw Esp32ApiException('Network error. Check WiFi connection.');
    } on Exception catch (error) {
      if (error is Esp32ApiException) rethrow;
      throw Esp32ApiException('Request failed: $error');
    }
  }

  Future<DeviceStatus> getStatus(String ip) async {
    final json = await _getJson(_uri(ip, '/status'));
    return DeviceStatus.fromJson(json);
  }

  Future<List<DiscoveredEsp32Device>> discoverDevices({String? hintIp}) async {
    final candidates = _buildDiscoveryCandidates(hintIp);
    if (candidates.isEmpty) return const [];

    const batchSize = 24;
    final found = <DiscoveredEsp32Device>[];

    for (var index = 0; index < candidates.length; index += batchSize) {
      final end = (index + batchSize < candidates.length)
          ? index + batchSize
          : candidates.length;
      final batch = candidates.sublist(index, end);

      final scanned = await Future.wait(
        batch.map((ip) async {
          try {
            final json = await _getJson(
              _uri(ip, '/status'),
              timeout: _discoveryTimeout,
            );

            if (!json.containsKey('state')) return null;
            final status = DeviceStatus.fromJson(json);
            return DiscoveredEsp32Device(ip: ip, status: status);
          } catch (_) {
            return null;
          }
        }),
      );

      found.addAll(scanned.whereType<DiscoveredEsp32Device>());

      // Stop early once we find one or more matching devices.
      if (found.isNotEmpty) {
        return found;
      }
    }

    return found;
  }

  List<String> _buildDiscoveryCandidates(String? hintIp) {
    final candidates = <String>[];
    final seen = <String>{};

    void add(String ip) {
      if (seen.add(ip)) {
        candidates.add(ip);
      }
    }

    // Known static targets from firmware first.
    add('192.168.43.77');
    add('192.168.1.77');

    // Common hotspot and home-router guesses.
    const commonPrefixes = <String>[
      '192.168.43',
      '192.168.1',
      '192.168.0',
      '10.0.0',
      '172.20.10',
    ];

    for (final prefix in commonPrefixes) {
      add('$prefix.77');
      add('$prefix.120');
      add('$prefix.100');
      add('$prefix.200');
    }

    final hintPrefix = _extractPrefix(hintIp);
    if (hintPrefix != null) {
      for (var host = 2; host <= 60; host++) {
        add('$hintPrefix.$host');
      }
      add('$hintPrefix.77');
      add('$hintPrefix.120');
      add('$hintPrefix.200');
    }

    for (final prefix in commonPrefixes) {
      for (var host = 2; host <= 30; host++) {
        add('$prefix.$host');
      }
    }

    return candidates;
  }

  String? _extractPrefix(String? ip) {
    if (ip == null) return null;
    final parts = ip.trim().split('.');
    if (parts.length != 4) return null;

    final octets = <int>[];
    for (final p in parts) {
      final value = int.tryParse(p);
      if (value == null || value < 0 || value > 255) return null;
      octets.add(value);
    }

    return '${octets[0]}.${octets[1]}.${octets[2]}';
  }

  Future<SensorReading> getReading(String ip) async {
    final json = await _getJson(_uri(ip, '/reading'));
    return SensorReading.fromJson(json);
  }

  Future<List<SensorReading>> getStream(String ip) async {
    final jsonList = await _getJsonList(_uri(ip, '/stream'));
    return jsonList.map(SensorReading.fromJson).toList();
  }

  Future<DeviceStatus> sendCommand(String ip, String command) async {
    final json = await _getJson(_uri(ip, '/command', {'cmd': command}));
    return DeviceStatus.fromJson(json);
  }

  void dispose() {
    _client.close();
  }
}
