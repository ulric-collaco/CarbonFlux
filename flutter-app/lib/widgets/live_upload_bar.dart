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
    if (!isUploading && status == null) {
      return const SizedBox.shrink();
    }

    final failed = status != null && status!.toLowerCase().contains('failed');
    final verified =
        status != null && status!.toLowerCase().contains('verified');
    final accent = failed ? CarbonFluxColors.red : CarbonFluxColors.green;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: CarbonFluxColors.bgSurface,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: accent.withValues(alpha: 0.65), width: 1.5),
      ),
      child: Row(
        children: [
          if (isUploading && !failed && !verified) ...[
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: accent,
              ),
            ),
            const SizedBox(width: 12),
          ] else if (failed) ...[
            const Icon(Icons.error_outline,
                size: 20, color: CarbonFluxColors.red),
            const SizedBox(width: 12),
          ] else if (verified) ...[
            const Icon(
              Icons.check_circle_outline,
              size: 20,
              color: CarbonFluxColors.green,
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Text(
              status ?? 'Processing...',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: CarbonFluxColors.textPrimary,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
