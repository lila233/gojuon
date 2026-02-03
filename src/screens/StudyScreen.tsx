import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStudy } from '../contexts/StudyContext';
import { useTheme } from '../contexts/ThemeContext';
import { audioService } from '../utils/audio';
import { Quality } from '../types';

interface RatingButtonProps {
  label: string;
  quality: Quality;
  color: string;
  onPress: () => void;
}

export default function StudyScreen({ navigation }: { navigation: any }) {
  const { currentCard, studyQueue, submitReview, getKanaForCard, totalQueueSize, completedInSession, settings } = useStudy();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showTips, setShowTips] = useState(Platform.OS === 'web');
  const flipAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const cardStartedAtRef = useRef<number | null>(null);
  const isFlippedRef = useRef(isFlipped);

  const kana = currentCard ? getKanaForCard(currentCard) : null;
  const showRomaji = settings.showRomaji ?? true;
  const effectiveMode = settings.studyMode;

  const lastValidData = useRef<{ card: typeof currentCard, kana: typeof kana }>({
    card: currentCard,
    kana: kana
  });

  if (currentCard && kana) {
    lastValidData.current = { card: currentCard, kana: kana };
  }

  const displayCard = currentCard || lastValidData.current.card;
  const displayKana = kana || lastValidData.current.kana;

  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  useEffect(() => {
    if (currentCard) {
      setIsFlipped(false);
      flipAnim.setValue(0);
      cardStartedAtRef.current = Date.now();

      slideAnim.setValue(50);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentCard]);

  const playAudio = async () => {
    const currentKana = currentCard ? getKanaForCard(currentCard) : null;
    if (currentKana) {
      await audioService.speakKana(currentKana);
    }
  };

  const flipCard = async () => {
    // 解锁移动端音频（首次交互时）
    await audioService.unlock();

    const nextIsFlipped = !isFlipped;
    const toValue = nextIsFlipped ? 1 : 0;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();

    if (nextIsFlipped) {
      void playAudio();
      // 翻转后隐藏提示
      if (showTips) setShowTips(false);
    }
    setIsFlipped(nextIsFlipped);
  };

  const handleReview = async (quality: Quality) => {
    const isLastCard = studyQueue.length <= 1;
    const timeSpentMs = cardStartedAtRef.current ? Date.now() - cardStartedAtRef.current : 0;

    if (isLastCard) {
      lastValidData.current = { card: currentCard, kana: kana };
      // 不等待存储完成，立即导航返回
      submitReview(quality, timeSpentMs);
      navigation.navigate('Main' as never);
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        await submitReview(quality, timeSpentMs);
        setIsFlipped(false);
        flipAnim.setValue(0);
      });
    }
  };

  const flipCardRef = useRef(flipCard);
  flipCardRef.current = flipCard;
  const reviewRef = useRef(handleReview);
  reviewRef.current = handleReview;
  isFlippedRef.current = isFlipped;

  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  // 使用 useFocusEffect 确保只在页面聚焦时监听快捷键
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;

      const onKeyDown = (event: any) => {
        if (event.repeat) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          navigationRef.current.navigate('Main' as never);
          return;
        }
        if (event.key === ' ' || event.code === 'Space') {
          event.preventDefault();
          flipCardRef.current();
          return;
        }
        if (!isFlippedRef.current) return;
        if (event.key === '1') {
          event.preventDefault();
          reviewRef.current(1);
        } else if (event.key === '2') {
          event.preventDefault();
          reviewRef.current(2);
        } else if (event.key === '3') {
          event.preventDefault();
          reviewRef.current(3);
        } else if (event.key === '4') {
          event.preventDefault();
          reviewRef.current(4);
        } else if (event.key === '5') {
          event.preventDefault();
          reviewRef.current(5);
        }
      };

      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [])
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: () => { },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) < 10 && Math.abs(gestureState.dx) < 10) {
          flipCardRef.current();
        }
      },
    })
  ).current;

  if (!displayCard || !displayKana) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: theme.background, paddingTop: insets.top + 20 }]}>
        <StatusBar hidden={true} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>今日学习已完成</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>明天再来继续吧</Text>
        <TouchableOpacity
          style={[styles.emptyButton, { borderColor: theme.border }]}
          onPress={() => navigation.navigate('Main' as never)}
        >
          <Text style={[styles.emptyButtonText, { color: theme.text }]}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPercent = totalQueueSize > 0
    ? (completedInSession / totalQueueSize) * 100
    : 0;
  const frontKanaText = effectiveMode === 'katakana' ? displayKana.katakana : displayKana.hiragana;
  const backKanaText = effectiveMode === 'katakana' ? displayKana.hiragana : displayKana.katakana;
  const showBackKana = effectiveMode !== 'hiragana';

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar hidden={true} />

      <View style={[styles.header, { marginTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>学習中</Text>

        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {completedInSession}/{totalQueueSize}
        </Text>
      </View>

      {/* 进度条 */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>
      </View>

      {/* 键盘快捷键提示 - 仅 Web 端显示 */}
      {Platform.OS === 'web' && showTips && (
        <View style={[styles.tipsContainer, { borderColor: theme.border }]}>
          <View style={styles.tipRow}>
            <View style={[styles.keyBadge, { backgroundColor: theme.border }]}>
              <Text style={[styles.keyText, { color: theme.text }]}>Space</Text>
            </View>
            <Text style={[styles.tipText, { color: theme.textSecondary }]}>翻转</Text>
          </View>
          <View style={[styles.tipDivider, { backgroundColor: theme.border }]} />
          <View style={styles.tipRow}>
            <View style={[styles.keyBadge, { backgroundColor: theme.border }]}>
              <Text style={[styles.keyText, { color: theme.text }]}>1-5</Text>
            </View>
            <Text style={[styles.tipText, { color: theme.textSecondary }]}>评分</Text>
          </View>
          <View style={[styles.tipDivider, { backgroundColor: theme.border }]} />
          <View style={styles.tipRow}>
            <View style={[styles.keyBadge, { backgroundColor: theme.border }]}>
              <Text style={[styles.keyText, { color: theme.text }]}>Esc</Text>
            </View>
            <Text style={[styles.tipText, { color: theme.textSecondary }]}>退出</Text>
          </View>
        </View>
      )}

      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ translateX: slideAnim }],
            opacity: opacityAnim,
          }
        ]}
      >
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.cardFace,
              { backgroundColor: theme.card, borderColor: theme.border },
              { transform: [{ rotateY: frontInterpolate }] },
            ]}
            {...panResponder.panHandlers}
          >
            <Text style={[styles.frontKana, { color: theme.text }]}>
              {frontKanaText}
            </Text>
            <Text style={[styles.hintText, { color: theme.textTertiary }]}>
              点击翻转
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.cardFace,
              { backgroundColor: theme.card, borderColor: theme.border },
              { transform: [{ rotateY: backInterpolate }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={flipCard}
              style={styles.backContentWrapper}
            >
              <View style={styles.backContent}>
                {showRomaji && (
                  <Text style={[styles.backRomaji, { color: theme.primary }]}>
                    {displayKana.romaji}
                  </Text>
                )}
                {showBackKana && (
                  <Text style={[styles.backKatakana, { color: theme.text }]}>
                    {backKanaText}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.playButton, { borderColor: theme.border }]}
                  onPress={playAudio}
                >
                  <Text style={[styles.playButtonText, { color: theme.text }]}>再生</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            <View style={styles.typeBadgeContainer}>
              <Text style={[styles.typeBadge, { color: theme.textSecondary }]}>
                {displayKana.type}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.flipBackArea}
              onPress={flipCard}
              activeOpacity={1}
            >
              <Text style={[styles.flipBackText, { color: theme.textTertiary }]}>
                ↩
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      <View
        style={[
          styles.ratingContainer,
          {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 8,
            backgroundColor: theme.background,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          },
        ]}
      >
        <View style={styles.ratingButtons}>
          <RatingButton label="忘" quality={1} color={theme.error} onPress={() => handleReview(1)} disabled={!isFlipped} />
          <RatingButton label="难" quality={2} color={theme.warning} onPress={() => handleReview(2)} disabled={!isFlipped} />
          <RatingButton label="中" quality={3} color="#B8A78C" onPress={() => handleReview(3)} disabled={!isFlipped} />
          <RatingButton label="易" quality={4} color={theme.success} onPress={() => handleReview(4)} disabled={!isFlipped} />
          <RatingButton label="完" quality={5} color={theme.info} onPress={() => handleReview(5)} disabled={!isFlipped} />
        </View>
      </View>
    </View>
  );
}

interface ExtendedRatingButtonProps extends RatingButtonProps {
  disabled?: boolean;
}

function RatingButton({ label, quality, color, onPress, disabled }: ExtendedRatingButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.ratingButton, { borderColor: color, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={[styles.ratingButtonText, { color }]}>{label}</Text>
      <Text style={[styles.ratingButtonQuality, { color }]}>{quality}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '300',
    marginBottom: 8,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontSize: 14,
    marginBottom: 24,
    fontWeight: '400',
  },
  emptyButton: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 2,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '400',
    minWidth: 50,
    textAlign: 'right',
  },

  // Progress bar
  progressBarContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },

  // Tips
  tipsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 12,
  },
  keyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  keyText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  tipText: {
    fontSize: 11,
    fontWeight: '400',
  },

  // Card
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 0.75,
    position: 'relative',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  frontKana: {
    fontSize: 140,
    fontWeight: '200',
    includeFontPadding: false,
    marginBottom: 20,
  },
  hintText: {
    fontSize: 12,
    position: 'absolute',
    bottom: 30,
    fontWeight: '400',
    letterSpacing: 1,
  },
  backContentWrapper: {
    flex: 1,
    width: '100%',
  },
  backContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
  },
  backRomaji: {
    fontSize: 36,
    fontWeight: '400',
    letterSpacing: 2,
  },
  backKatakana: {
    fontSize: 100,
    fontWeight: '200',
    includeFontPadding: false,
  },
  playButton: {
    marginTop: 10,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 4,
  },
  typeBadgeContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1,
  },
  flipBackArea: {
    position: 'absolute',
    top: 14,
    right: 18,
    padding: 6,
  },
  flipBackText: {
    fontSize: 18,
  },

  // Rating
  ratingContainer: {
    width: '100%',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonText: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 2,
  },
  ratingButtonQuality: {
    fontSize: 11,
    fontWeight: '400',
  },
});
