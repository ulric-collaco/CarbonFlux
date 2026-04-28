import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../models/sensor_reading.dart';
import '../providers/app_providers.dart';
import '../providers/carbonflux_controller.dart';
import '../widgets/error_banner.dart';
import '../widgets/ppm_line_chart.dart';
import '../widgets/reading_card.dart';
import '../widgets/state_badge.dart';
import '../widgets/live_upload_bar.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});
  static const double _violationThresholdPpm = 1000;

  Future<void> _runDetectionCycle(
    BuildContext context,
    CarbonfluxController controller,
    CarbonfluxAppState state,
  ) async {
    final didWarmup = state.lastWarmupCompletedAt == null ||
        DateTime.now().difference(state.lastWarmupCompletedAt!) >
            const Duration(minutes: 30);
    final ok = await controller.startDetectionCycle();
    if (!context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(ok
            ? (didWarmup
                ? 'Cycle done: warmup + 15s detection + stop.'
                : 'Cycle done: reused warmup, 15s detection + stop.')
            : 'Detection cycle failed.'),
        backgroundColor: ok ? const Color(0xFF0B6B53) : const Color(0xFF8A1F28),
      ),
    );
  }

  String _lastWarmupLabel(DateTime? ts) {
    if (ts == null) return 'never';
    return DateFormat('HH:mm:ss').format(ts);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(carbonfluxControllerProvider);
    final controller = ref.read(carbonfluxControllerProvider.notifier);

    final status = state.status;
    final latest = state.latestReading;
    final currentState = status?.state ?? 'UNKNOWN';
    final analyticsReadings = state.streamReadings.isNotEmpty
        ? state.streamReadings
        : state.readingHistory;
    final analytics = _StreamAnalytics.fromReadings(
      analyticsReadings,
      threshold: _violationThresholdPpm,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('CarbonFlux Control Center'),
        actions: [
          IconButton(
            onPressed: controller.disconnect,
            tooltip: 'Disconnect',
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 800),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (state.errorMessage != null) ...[
                    ErrorBanner(
                      message: state.errorMessage!,
                      onDismiss: controller.clearError,
                    ),
                    const SizedBox(height: 12),
                  ],
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF111722),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF1F2A3A)),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Wrap(
                      runSpacing: 16,
                      spacing: 18,
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              status?.deviceId ??
                                  latest?.deviceId ??
                                  'carbonflux-001',
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              state.statusMessage,
                              style: const TextStyle(color: Color(0xFF90A0B9)),
                            ),
                          ],
                        ),
                        StateBadge(state: currentState),
                        if (currentState == 'WARMUP')
                          _MetricChip(
                            label: 'WARMUP',
                            value: '${state.warmupRemainingSeconds}s',
                            color: Colors.amberAccent,
                          ),
                        if (currentState == 'DETECTING' ||
                            currentState == 'STOPPED')
                          _MetricChip(
                            label: 'READINGS',
                            value: state.streamReadings.isNotEmpty
                                ? state.streamReadings.length.toString()
                                : state.readingHistory.length.toString(),
                            color: Colors.cyanAccent,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: (state.isCommandInFlight ||
                                  state.isDetectionCycleRunning)
                              ? null
                              : () => _runDetectionCycle(
                                  context, controller, state),
                          icon: state.isDetectionCycleRunning
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.play_circle_outline_rounded),
                          label: Text(
                            state.isDetectionCycleRunning
                                ? 'Running 15s Detection Cycle...'
                                : 'Start Detection',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Last warmup: ${_lastWarmupLabel(state.lastWarmupCompletedAt)}',
                    style:
                        const TextStyle(color: Color(0xFF90A0B9), fontSize: 12),
                  ),
                  
                  if (state.uploadingStatus != null || state.isUploading)
                    LiveUploadBar(
                      isUploading: state.isUploading,
                      status: state.uploadingStatus,
                    ),
                    
                  const SizedBox(height: 14),
                  if (latest != null) ReadingCard(reading: latest),
                  const SizedBox(height: 14),
                  Container(
                    height: 300,
                    decoration: BoxDecoration(
                      color: const Color(0xFF111722),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF1F2A3A)),
                    ),
                    padding: const EdgeInsets.fromLTRB(12, 12, 16, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'PPM Trend (Live)',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              currentState,
                              style: TextStyle(color: stateColor(currentState)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Expanded(
                            child:
                                PpmLineChart(readings: state.readingHistory)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF111722),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF1F2A3A)),
                    ),
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'Stream View',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w700),
                            ),
                            const Spacer(),
                            TextButton.icon(
                              onPressed: controller.refreshStream,
                              icon: const Icon(Icons.refresh_rounded),
                              label: const Text('Refresh'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _MetricChip(
                              label: 'MAX PPM',
                              value: analytics.maxPpm.toStringAsFixed(1),
                              color: Colors.cyanAccent,
                            ),
                            _MetricChip(
                              label: 'AVG PPM',
                              value: analytics.avgPpm.toStringAsFixed(1),
                              color: const Color(0xFF7CD4FF),
                            ),
                            _MetricChip(
                              label: 'VIOLATIONS',
                              value: analytics.violationCount.toString(),
                              color: analytics.violationCount > 0
                                  ? Colors.redAccent
                                  : Colors.greenAccent,
                            ),
                            _MetricChip(
                              label: 'LAST VIOLATION',
                              value: analytics.lastViolationPpm == null
                                  ? 'none'
                                  : '${analytics.lastViolationPpm!.toStringAsFixed(1)} ppm',
                              color: analytics.lastViolationPpm == null
                                  ? const Color(0xFF90A0B9)
                                  : Colors.redAccent,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (state.streamReadings.isEmpty)
                          const Text(
                            'No stream data loaded yet.',
                            style: TextStyle(color: Color(0xFF90A0B9)),
                          )
                        else
                          ...state.streamReadings.reversed.take(8).map((r) {
                            final high = r.ppmProxy > _violationThresholdPpm;
                            return ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'PPM ${r.ppmProxy.toStringAsFixed(1)} | ADC ${r.rawAdc}',
                                    ),
                                  ),
                                  if (high)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.redAccent.withAlpha(46),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color:
                                              Colors.redAccent.withAlpha(165),
                                        ),
                                      ),
                                      child: const Text(
                                        'VIOLATION',
                                        style: TextStyle(
                                          color: Colors.redAccent,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              subtitle:
                                  Text('nonce ${r.nonce} | ts ${r.timestamp}'),
                              trailing: high
                                  ? const Icon(Icons.warning_amber_rounded,
                                      color: Colors.redAccent)
                                  : const Icon(Icons.check_circle_outline,
                                      color: Colors.greenAccent),
                            );
                          }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withAlpha(38),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(128)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(fontSize: 11)),
          const SizedBox(width: 8),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }
}

class _StreamAnalytics {
  const _StreamAnalytics({
    required this.maxPpm,
    required this.avgPpm,
    required this.violationCount,
    required this.lastViolationPpm,
  });

  final double maxPpm;
  final double avgPpm;
  final int violationCount;
  final double? lastViolationPpm;

  factory _StreamAnalytics.fromReadings(
    List<SensorReading> readings, {
    required double threshold,
  }) {
    if (readings.isEmpty) {
      return const _StreamAnalytics(
        maxPpm: 0,
        avgPpm: 0,
        violationCount: 0,
        lastViolationPpm: null,
      );
    }

    var max = 0.0;
    var sum = 0.0;
    var violations = 0;
    double? lastViolation;

    for (final reading in readings) {
      final ppm = reading.ppmProxy;
      if (ppm > max) max = ppm;
      sum += ppm;
      if (ppm > threshold) {
        violations += 1;
        lastViolation = ppm;
      }
    }

    return _StreamAnalytics(
      maxPpm: max,
      avgPpm: sum / readings.length,
      violationCount: violations,
      lastViolationPpm: lastViolation,
    );
  }
}
