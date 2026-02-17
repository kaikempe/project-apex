import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Timer, X, Check } from 'lucide-react-native';
import { Colors } from '../theme/colors';

export interface SprintMode {
  id: string;
  label: string;
  startSpeed: number;
  endSpeed: number;
  unit: 'kmh' | 'mph';
}

export const SPRINT_MODES: SprintMode[] = [
  { id: '0-100', label: '0-100 km/h', startSpeed: 0, endSpeed: 100, unit: 'kmh' },
  { id: '0-200', label: '0-200 km/h', startSpeed: 0, endSpeed: 200, unit: 'kmh' },
  { id: '100-200', label: '100-200 km/h', startSpeed: 100, endSpeed: 200, unit: 'kmh' },
];

interface SprintModeSelectorProps {
  selectedMode: SprintMode | null;
  onSelectMode: (mode: SprintMode | null) => void;
  isSprintActive: boolean;
}

export const SprintModeSelector: React.FC<SprintModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  isSprintActive,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleButtonPress = () => {
    console.log('⏱️ Sprint button pressed');
    setShowMenu(true);
  };

  const handleSelectMode = (mode: SprintMode) => {
    console.log('⏱️ Selected mode:', mode.label);
    onSelectMode(mode);
    setShowMenu(false);
  };

  const handleClearMode = () => {
    console.log('⏱️ Mode cleared');
    onSelectMode(null);
    setShowMenu(false);
  };

  return (
    <>
      {/* Floating Button - positioned above the bottom bar */}
      <TouchableOpacity
        style={[
          styles.button,
          selectedMode && styles.buttonActive,
          isSprintActive && styles.buttonRunning,
        ]}
        onPress={handleButtonPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Timer
          size={24}
          color={isSprintActive ? Colors.success : selectedMode ? Colors.primary : Colors.textSecondary}
        />
        {selectedMode && (
          <Text style={[styles.buttonLabel, isSprintActive && styles.buttonLabelRunning]}>
            {selectedMode.id}
          </Text>
        )}
      </TouchableOpacity>

      {/* Mode Selection Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Sprint Timer</Text>
              <TouchableOpacity onPress={() => setShowMenu(false)}>
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuOptions}>
              {SPRINT_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.menuOption,
                    selectedMode?.id === mode.id && styles.menuOptionSelected,
                  ]}
                  onPress={() => handleSelectMode(mode)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuOptionContent}>
                    <Text
                      style={[
                        styles.menuOptionLabel,
                        selectedMode?.id === mode.id && styles.menuOptionLabelSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                    <Text style={styles.menuOptionDesc}>
                      {mode.startSpeed === 0 ? 'Standing start' : 'Rolling start'}
                    </Text>
                  </View>
                  {selectedMode?.id === mode.id && (
                    <Check size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {selectedMode && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearMode}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButtonText}>Disable Sprint Timer</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Button positioned above the bottom stats bar
  button: {
    position: 'absolute',
    bottom: 85,
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.textSecondary + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  buttonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '20',
  },
  buttonRunning: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '20',
  },
  buttonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  buttonLabelRunning: {
    color: Colors.success,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: 300,
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    padding: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuOptions: {
    gap: 10,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  menuOptionContent: {
    flex: 1,
  },
  menuOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  menuOptionLabelSelected: {
    color: Colors.primary,
  },
  menuOptionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.error + '15',
    borderRadius: 10,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
});
