import 'package:flutter/material.dart';

import '../theme/carbonflux_theme.dart';

class ControlButton extends StatelessWidget {
  const ControlButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.color,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: color.withValues(alpha: 0.16),
        foregroundColor: color,
        disabledBackgroundColor: color.withValues(alpha: 0.06),
        disabledForegroundColor: CarbonFluxColors.textMuted,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        side: BorderSide(color: color.withValues(alpha: 0.6)),
      ),
      icon: Icon(icon ?? Icons.play_arrow_rounded, size: 18),
      label: Text(
        label.toUpperCase(),
        style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.7),
      ),
    );
  }
}
