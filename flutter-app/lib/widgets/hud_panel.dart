import 'package:flutter/material.dart';

import '../theme/carbonflux_theme.dart';

class HudPanel extends StatelessWidget {
  const HudPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.accentColor,
    this.backgroundColor = CarbonFluxColors.bgSurface,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? accentColor;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: backgroundColor,
        border: Border.all(color: CarbonFluxColors.border),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Stack(
        children: [
          if (accentColor != null)
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(width: 3, color: accentColor),
            ),
          Padding(
            padding: EdgeInsets.only(left: accentColor == null ? 0 : 3),
            child: Padding(
              padding: padding,
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

class HudHeader extends StatelessWidget {
  const HudHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title.toUpperCase(), style: CarbonFluxText.section),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle!, style: CarbonFluxText.mono),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 12),
          trailing!,
        ],
      ],
    );
  }
}
