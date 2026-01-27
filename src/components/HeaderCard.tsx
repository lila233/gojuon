import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderCardProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const HeaderCard: React.FC<HeaderCardProps> = ({ 
  title, 
  subtitle, 
  children, 
  style 
}) => {
  const { theme } = useTheme();

  return (
    <LinearGradient
      colors={[theme.primary, theme.primaryDark]}
      style={[styles.card, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 30,
    borderRadius: 24,
    marginBottom: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 32, // Default size, can be overridden or adjusted
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, // Default size
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
});
