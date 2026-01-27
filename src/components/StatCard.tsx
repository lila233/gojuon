import React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface StatCardProps {
  title: string;
  value: number;
  color: string;
  icon: string;
  cardBg: string;
  textColor: string;
  subtitleColor: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  color,
  icon,
  cardBg,
  textColor,
  subtitleColor,
}) => {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: cardBg }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.statTitle, { color: subtitleColor }]}>{title}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statCard: {
    width: (width - 60) / 2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
