
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { colors } from '@/styles/commonStyles';

interface AnimatedGaugeChartProps {
  wins: number;
  losses: number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

export function AnimatedGaugeChart({ wins, losses }: AnimatedGaugeChartProps) {
  const needleRotation = useRef(new Animated.Value(0)).current;
  
  const total = wins + losses;
  
  // Calculate needle position based on wins/losses ratio
  // -90 degrees = red (all losses), 0 degrees = middle (even), +90 degrees = green (all wins)
  const calculateNeedleAngle = () => {
    if (total === 0) return 0; // Middle position when no data
    
    const winRatio = wins / total;
    const angle = (winRatio - 0.5) * 180; // Maps 0-1 to -90 to +90
    return angle;
  };
  
  const targetAngle = calculateNeedleAngle();
  
  useEffect(() => {
    console.log('AnimatedGaugeChart - Wins:', wins, 'Losses:', losses, 'Target Angle:', targetAngle);
    
    // Animate needle to target position
    Animated.spring(needleRotation, {
      toValue: targetAngle,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [wins, losses, targetAngle, needleRotation]);
  
  // SVG dimensions
  const width = 300;
  const height = 200;
  const centerX = width / 2;
  const centerY = height - 40;
  const radius = 120;
  
  // Create arc paths for the gauge
  const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    
    const startX = centerX + radius * Math.cos(startRad);
    const startY = centerY + radius * Math.sin(startRad);
    const endX = centerX + radius * Math.cos(endRad);
    const endY = centerY + radius * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  };
  
  // Red arc (left side, 0-90 degrees)
  const redArcPath = createArcPath(0, 90, radius);
  
  // Yellow arc (middle, 90-135 degrees)
  const yellowArcPath = createArcPath(90, 135, radius);
  
  // Green arc (right side, 135-180 degrees)
  const greenArcPath = createArcPath(135, 180, radius);
  
  // Needle length
  const needleLength = radius - 20;
  
  // Calculate status text
  let statusText = 'Even';
  let statusColor = colors.warning;
  
  if (total > 0) {
    if (wins > losses) {
      statusText = 'More Wins';
      statusColor = colors.success;
    } else if (losses > wins) {
      statusText = 'More Losses';
      statusColor = colors.error;
    }
  }
  
  const winsText = `${wins}`;
  const lossesText = `${losses}`;
  const totalText = `${total}`;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wins vs Losses</Text>
      
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background arc */}
        <Path
          d={createArcPath(0, 180, radius)}
          stroke={colors.cardBorder}
          strokeWidth={20}
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Red section (losses) */}
        <Path
          d={redArcPath}
          stroke={colors.error}
          strokeWidth={20}
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Yellow section (moderate) */}
        <Path
          d={yellowArcPath}
          stroke={colors.warning}
          strokeWidth={20}
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Green section (wins) */}
        <Path
          d={greenArcPath}
          stroke={colors.success}
          strokeWidth={20}
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Center circle */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={12}
          fill={colors.card}
          stroke={colors.border}
          strokeWidth={2}
        />
        
        {/* Animated needle */}
        <G rotation={needleRotation} origin={`${centerX}, ${centerY}`}>
          <Line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - needleLength}
            stroke={colors.text}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle
            cx={centerX}
            cy={centerY - needleLength}
            r={6}
            fill={colors.text}
          />
        </G>
        
        {/* Labels */}
        <Text
          x={centerX - radius + 20}
          y={centerY + 30}
          fontSize={14}
          fontWeight="600"
          fill={colors.error}
          textAnchor="start"
        >
          Low
        </Text>
        
        <Text
          x={centerX}
          y={centerY - radius - 10}
          fontSize={14}
          fontWeight="600"
          fill={colors.warning}
          textAnchor="middle"
        >
          Moderate
        </Text>
        
        <Text
          x={centerX + radius - 20}
          y={centerY + 30}
          fontSize={14}
          fontWeight="600"
          fill={colors.success}
          textAnchor="end"
        >
          High
        </Text>
      </Svg>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: statusColor }]}>{statusText}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>{winsText}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.error }]}>{lossesText}</Text>
          <Text style={styles.statLabel}>Losses</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalText}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
});
