
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from './IconSymbol';

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  mode?: 'date' | 'time';
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export function DatePickerModal({ visible, value, mode = 'date', onConfirm, onCancel }: DatePickerModalProps) {
  const [tempDate, setTempDate] = React.useState(value);

  React.useEffect(() => {
    if (visible) {
      setTempDate(value);
    }
  }, [visible, value]);

  if (Platform.OS === 'web') {
    // Web-specific implementation using HTML input
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'date' ? 'Select Date' : 'Select Time'}
              </Text>
              <TouchableOpacity onPress={onCancel}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <input
                type={mode}
                value={
                  mode === 'date'
                    ? tempDate.toISOString().split('T')[0]
                    : `${String(tempDate.getHours()).padStart(2, '0')}:${String(tempDate.getMinutes()).padStart(2, '0')}`
                }
                onChange={(e) => {
                  if (mode === 'date') {
                    const newDate = new Date(e.target.value);
                    setTempDate(newDate);
                  } else {
                    const [hours, minutes] = e.target.value.split(':');
                    const newDate = new Date(tempDate);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setTempDate(newDate);
                  }
                }}
                style={{
                  width: '100%',
                  padding: 16,
                  fontSize: 16,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.card,
                  color: colors.text,
                }}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={() => onConfirm(tempDate)}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Native implementation (iOS/Android)
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'date' ? 'Select Date' : 'Select Time'}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={tempDate}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (selectedDate) {
                setTempDate(selectedDate);
              }
            }}
            style={{ backgroundColor: colors.background }}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={() => onConfirm(tempDate)}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  inputContainer: {
    padding: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
