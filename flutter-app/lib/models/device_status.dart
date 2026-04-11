class DeviceStatus {
  const DeviceStatus({
    required this.deviceId,
    required this.state,
    required this.timestamp,
    this.statusMessage,
  });

  final String deviceId;
  final String state;
  final int timestamp;
  final String? statusMessage;

  factory DeviceStatus.fromJson(Map<String, dynamic> json) {
    return DeviceStatus(
      deviceId: (json['device_id'] ?? 'unknown').toString(),
      state: (json['state'] ?? 'UNKNOWN').toString(),
      timestamp: _toInt(json['timestamp']),
      statusMessage: json['message']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'device_id': deviceId,
      'state': state,
      'timestamp': timestamp,
      if (statusMessage != null) 'message': statusMessage,
    };
  }

  static int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}
