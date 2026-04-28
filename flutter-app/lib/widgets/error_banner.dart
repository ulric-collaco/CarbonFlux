import 'package:flutter/material.dart';

import '../theme/carbonflux_theme.dart';

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message, this.onDismiss});

  final String message;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: CarbonFluxColors.red.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: CarbonFluxColors.red.withValues(alpha: 0.65)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: CarbonFluxColors.red),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: const TextStyle(color: Colors.white)),
          ),
          if (onDismiss != null)
            IconButton(
              onPressed: onDismiss,
              icon: const Icon(Icons.close_rounded, color: Colors.white70),
              visualDensity: VisualDensity.compact,
            ),
        ],
      ),
    );
  }
}
