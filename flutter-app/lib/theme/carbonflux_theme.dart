import 'package:flutter/material.dart';

class CarbonFluxColors {
  const CarbonFluxColors._();

  static const bgBase = Color(0xFF0D0D0D);
  static const bgSurface = Color(0xFF111111);
  static const bgCard = Color(0xFF1A1A1A);
  static const bgHover = Color(0xFF222222);
  static const border = Color(0xFF2A2A2A);
  static const borderBright = Color(0xFF333333);
  static const yellow = Color(0xFFFFD600);
  static const green = Color(0xFF00FF6A);
  static const orange = Color(0xFFFF8C00);
  static const red = Color(0xFFFF2D2D);
  static const blue = Color(0xFF00AAFF);
  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF888888);
  static const textMuted = Color(0xFF555555);
  static const textDim = Color(0xFF333333);
}

class CarbonFluxTheme {
  const CarbonFluxTheme._();

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    const colors = ColorScheme.dark(
      primary: CarbonFluxColors.yellow,
      secondary: CarbonFluxColors.green,
      surface: CarbonFluxColors.bgSurface,
      error: CarbonFluxColors.red,
      onPrimary: CarbonFluxColors.bgBase,
      onSurface: CarbonFluxColors.textPrimary,
    );

    return base.copyWith(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: CarbonFluxColors.bgBase,
      colorScheme: colors,
      textTheme: base.textTheme.apply(
        bodyColor: CarbonFluxColors.textPrimary,
        displayColor: CarbonFluxColors.textPrimary,
        fontFamily: 'Barlow',
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: CarbonFluxColors.bgBase,
        foregroundColor: CarbonFluxColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: CarbonFluxColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
        ),
      ),
      cardTheme: const CardThemeData(
        color: CarbonFluxColors.bgSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: CarbonFluxColors.border),
          borderRadius: BorderRadius.all(Radius.circular(6)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: CarbonFluxColors.border,
        thickness: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: CarbonFluxColors.bgSurface,
        labelStyle: const TextStyle(color: CarbonFluxColors.textSecondary),
        hintStyle: const TextStyle(color: CarbonFluxColors.textMuted),
        prefixIconColor: CarbonFluxColors.textSecondary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: CarbonFluxColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: CarbonFluxColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: CarbonFluxColors.yellow),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: CarbonFluxColors.yellow,
          foregroundColor: CarbonFluxColors.bgBase,
          disabledBackgroundColor: CarbonFluxColors.yellow.withAlpha(48),
          disabledForegroundColor: CarbonFluxColors.textMuted,
          minimumSize: const Size(48, 46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w900,
            letterSpacing: 0.7,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: CarbonFluxColors.yellow,
          disabledForegroundColor: CarbonFluxColors.textMuted,
          minimumSize: const Size(48, 46),
          side: const BorderSide(color: CarbonFluxColors.borderBright),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: CarbonFluxColors.yellow,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return CarbonFluxColors.yellow.withAlpha(34);
            }
            return CarbonFluxColors.bgSurface;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return CarbonFluxColors.yellow;
            }
            return CarbonFluxColors.textSecondary;
          }),
          side: WidgetStateProperty.all(
            const BorderSide(color: CarbonFluxColors.borderBright),
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          ),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? CarbonFluxColors.yellow
              : CarbonFluxColors.textMuted;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? CarbonFluxColors.yellow.withAlpha(64)
              : CarbonFluxColors.bgCard;
        }),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: CarbonFluxColors.bgSurface,
        selectedColor: CarbonFluxColors.yellow.withAlpha(34),
        disabledColor: CarbonFluxColors.bgCard,
        labelStyle: const TextStyle(color: CarbonFluxColors.textSecondary),
        side: const BorderSide(color: CarbonFluxColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: CarbonFluxColors.bgCard,
        contentTextStyle: TextStyle(color: CarbonFluxColors.textPrimary),
      ),
    );
  }
}

class CarbonFluxText {
  const CarbonFluxText._();

  static const display = TextStyle(
    fontSize: 42,
    fontWeight: FontWeight.w900,
    letterSpacing: 1.4,
    height: 0.95,
  );

  static const section = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w900,
    letterSpacing: 1.0,
  );

  static const label = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.7,
    color: CarbonFluxColors.textMuted,
  );

  static const mono = TextStyle(
    fontFamily: 'monospace',
    fontSize: 12,
    color: CarbonFluxColors.textSecondary,
    letterSpacing: 0.4,
  );
}
