import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_providers.dart';
import '../providers/carbonflux_controller.dart';

class ConnectionScreen extends ConsumerStatefulWidget {
  const ConnectionScreen({super.key});

  @override
  ConsumerState<ConnectionScreen> createState() => _ConnectionScreenState();
}

class _ConnectionScreenState extends ConsumerState<ConnectionScreen> {
  late final TextEditingController _ipController;
  bool _autoWifiDiscoveryTriggered = false;

  @override
  void initState() {
    super.initState();
    final saved = ref.read(carbonfluxControllerProvider).savedIp;
    _ipController = TextEditingController(text: saved ?? '');

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _autoDiscoverWifi();
    });
  }

  @override
  void dispose() {
    _ipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(carbonfluxControllerProvider);
    final controller = ref.read(carbonfluxControllerProvider.notifier);
    final isMockMode = ref.watch(mockModeProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          Row(
            children: [
              const Text('Mock Mode (Test)',
                  style: TextStyle(color: Colors.amber, fontSize: 12)),
              Switch(
                value: isMockMode,
                activeThumbColor: Colors.amber,
                onChanged: (val) {
                  ref.read(mockModeProvider.notifier).state = val;
                },
              ),
            ],
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.factory_outlined,
                    size: 50,
                    color: Color(0xFF32D9FF),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'CarbonFlux',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Industrial Emission Monitor',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF91A0B9), fontSize: 14),
                  ),
                  const SizedBox(height: 20),
                  SegmentedButton<ConnectionTransport>(
                    segments: const [
                      ButtonSegment<ConnectionTransport>(
                        value: ConnectionTransport.wifi,
                        icon: Icon(Icons.wifi_rounded),
                        label: Text('WiFi'),
                      ),
                      ButtonSegment<ConnectionTransport>(
                        value: ConnectionTransport.bluetooth,
                        icon: Icon(Icons.bluetooth_rounded),
                        label: Text('Bluetooth'),
                      ),
                    ],
                    selected: {state.transport},
                    onSelectionChanged: (selection) {
                      final next = selection.first;
                      controller.setTransport(next);
                      if (next == ConnectionTransport.wifi) {
                        _autoDiscoverWifi(force: true);
                      }
                    },
                  ),
                  const SizedBox(height: 18),
                  if (state.transport == ConnectionTransport.wifi)
                    _buildWifiSection(state, controller)
                  else
                    _buildBluetoothSection(state, controller),
                  if (state.errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      state.errorMessage!,
                      style: const TextStyle(color: Colors.redAccent),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _autoDiscoverWifi({bool force = false}) {
    final state = ref.read(carbonfluxControllerProvider);
    if (state.transport != ConnectionTransport.wifi) return;
    if (!force && _autoWifiDiscoveryTriggered) return;

    _autoWifiDiscoveryTriggered = true;
    ref
        .read(carbonfluxControllerProvider.notifier)
        .discoverWifiDevices(hintIp: _ipController.text);
  }

  Widget _buildWifiSection(
    CarbonfluxAppState state,
    CarbonfluxController controller,
  ) {
    final suggestions = _buildWifiSuggestions(_ipController.text.trim());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _ipController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'ESP32 IP Address',
            hintText: '192.168.1.77',
            prefixIcon: Icon(Icons.router_rounded),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final ip in suggestions)
              ActionChip(
                label: Text(ip),
                onPressed: () => setState(() => _ipController.text = ip),
              ),
          ],
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: state.isConnecting
              ? null
              : () => controller.connect(_ipController.text),
          icon: state.isConnecting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.wifi_tethering_rounded),
          label:
              Text(state.isConnecting ? 'Connecting...' : 'Connect via WiFi'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: (state.isConnecting || state.isDiscoveringWifi)
              ? null
              : () =>
                  controller.discoverWifiDevices(hintIp: _ipController.text),
          icon: state.isDiscoveringWifi
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.travel_explore_rounded),
          label: Text(
            state.isDiscoveringWifi ? 'Scanning WiFi...' : 'Find ESP32 on WiFi',
          ),
        ),
        if (state.discoveredWifiDevices.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text(
            'Discovered IPs',
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF91A0B9),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          for (final device in state.discoveredWifiDevices)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                color: const Color(0xFF111722),
                child: ListTile(
                  dense: true,
                  leading: const Icon(
                    Icons.memory_rounded,
                    color: Color(0xFF32D9FF),
                  ),
                  title: Text(device.ip),
                  subtitle: Text(
                      '${device.status.deviceId} • ${device.status.state}'),
                  trailing: TextButton(
                    onPressed: state.isConnecting
                        ? null
                        : () {
                            _ipController.text = device.ip;
                            controller.connect(device.ip);
                          },
                    child: const Text('Use'),
                  ),
                ),
              ),
            ),
        ],
        if (state.savedIp != null && !state.isConnecting) ...[
          const SizedBox(height: 6),
          OutlinedButton.icon(
            onPressed: controller.reconnectSavedIp,
            icon: const Icon(Icons.history_rounded),
            label: Text('Reconnect ${state.savedIp}'),
          ),
        ],
      ],
    );
  }

  Widget _buildBluetoothSection(
    CarbonfluxAppState state,
    CarbonfluxController controller,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Scan nearby BLE devices and connect to CarbonFlux-ESP32.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF91A0B9)),
        ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          onPressed: (state.isConnecting || state.isDiscoveringBluetooth)
              ? null
              : controller.discoverBluetoothDevices,
          icon: state.isDiscoveringBluetooth
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.bluetooth_searching_rounded),
          label: Text(
            state.isDiscoveringBluetooth
                ? 'Scanning Bluetooth...'
                : 'Scan Bluetooth Devices',
          ),
        ),
        if (state.discoveredBluetoothDevices.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text(
            'Nearby Bluetooth Devices',
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF91A0B9),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          for (final device in state.discoveredBluetoothDevices)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                color: const Color(0xFF111722),
                child: ListTile(
                  dense: true,
                  leading: Icon(
                    device.isLikelyTarget
                        ? Icons.bluetooth_connected_rounded
                        : Icons.bluetooth_rounded,
                    color: device.isLikelyTarget
                        ? const Color(0xFF32D9FF)
                        : const Color(0xFF91A0B9),
                  ),
                  title: Text(device.name),
                  subtitle: Text('${device.id} • RSSI ${device.rssi}'),
                  trailing: TextButton(
                    onPressed: state.isConnecting
                        ? null
                        : () => controller.connect(device.id),
                    child: Text(device.isLikelyTarget ? 'Connect' : 'Use'),
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }

  List<String> _buildWifiSuggestions(String input) {
    final out = <String>{
      '192.168.43.77',
      '192.168.1.77',
      '192.168.1.120',
      '10.0.0.77',
    };

    final parts = input.split('.');
    if (parts.length == 4) {
      final p0 = int.tryParse(parts[0]);
      final p1 = int.tryParse(parts[1]);
      final p2 = int.tryParse(parts[2]);
      if (p0 != null && p1 != null && p2 != null) {
        out.add('$p0.$p1.$p2.77');
        out.add('$p0.$p1.$p2.120');
        out.add('$p0.$p1.$p2.200');
      }
    }

    return out.toList();
  }
}
