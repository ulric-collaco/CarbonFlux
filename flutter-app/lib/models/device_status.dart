class DeviceStatus {
  const DeviceStatus({
    required this.deviceId,
    required this.state,
    required this.timestamp,
    this.statusMessage,
    this.ip,
  });

  final String deviceId;
  final String state;
  final int timestamp;
  final String? statusMessage;
  final String? ip;

  factory DeviceStatus.fromJson(Map<String, dynamic> json) {
    return DeviceStatus(
      deviceId: (json['device_id'] ?? 'unknown').toString(),
      state: (json['state'] ?? 'UNKNOWN').toString(),
      timestamp: _toInt(json['timestamp']),
      statusMessage: json['message']?.toString(),
      ip: json['ip']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'device_id': deviceId,
      'state': state,
      'timestamp': timestamp,
      if (statusMessage != null) 'message': statusMessage,
      if (ip != null) 'ip': ip,
    };
  }

  static int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}
