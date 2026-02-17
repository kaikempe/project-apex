export const Colors = {
  // Background
  background: '#000000',        // OLED Black
  
  // Accents
  primary: '#007AFF',           // Electric Blue
  secondary: '#1A1A1A',         // Dark Grey for cards
  success: '#34C759',           // Green for PBs/Rank ups
  
  // Text
  textPrimary: '#FFFFFF',       // White
  textSecondary: '#8E8E93',     // Grey text
  
  // States
  warning: '#FF9500',           // Orange
  danger: '#FF3B30',            // Red
  error: '#FF3B30',             // Red (alias — many components use Colors.error)
};

export const Typography = {
  // Speed Display
  speedometer: {
    fontSize: 72,
    fontWeight: '700' as const,
    letterSpacing: -2,
  },
  
  // Unit labels
  unit: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 1,
  },
  
  // Segment names
  segmentTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  
  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
};