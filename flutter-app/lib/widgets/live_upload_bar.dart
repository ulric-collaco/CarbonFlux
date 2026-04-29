import 'package:flutter/material.dart';

import '../theme/carbonflux_theme.dart';

class LiveUploadBar extends StatelessWidget {
  const LiveUploadBar({
    super.key,
    required this.isUploading,
    required this.status,
  });

  final bool isUploading;
  final String? status;

  @override
  Widget build(BuildContext context) {
    final lowerStatus = status?.toLowerCase() ?? '';
    final failed = lowerStatus.contains('failed');
    final verified =
        lowerStatus.contains('verified') || lowerStatus.contains('anchored');
    final idle = !isUploading && status == null;
    final accent = failed
        ? CarbonFluxColors.red
        : isUploading
            ? CarbonFluxColors.blue
            : verified
                ? CarbonFluxColors.green
                : CarbonFluxColors.yellow;
    final headline = idle
        ? 'Backend link standing by'
        : isUploading
            ? 'Uploading live telemetry'
            : failed
                ? 'Backend upload needs attention'
                : 'Backend upload healthy';
    final detail = status ?? 'Monitoring sensor data stream';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            accent.withAlpha(26),
            CarbonFluxColors.bgSurface,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withAlpha(120), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: accent.withAlpha(22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: accent.withAlpha(34),
              shape: BoxShape.circle,
              border: Border.all(color: accent.withAlpha(120)),
            ),
            child: Center(
              child: isUploading
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: accent,
                      ),
                    )
                  : Icon(
                      failed
                          ? Icons.cloud_off_rounded
                          : verified
                              ? Icons.cloud_done_rounded
                              : Icons.sensors_rounded,
                      size: 20,
                      color: accent,
                    ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  headline.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.1,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  detail,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: CarbonFluxColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: accent.withAlpha(24),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: accent.withAlpha(90)),
            ),
            child: Text(
              idle
                  ? 'IDLE'
                  : isUploading
                      ? 'LIVE'
                      : failed
                          ? 'ERROR'
                          : 'OK',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 1,
                color: accent,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
