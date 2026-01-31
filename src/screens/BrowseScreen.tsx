import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBar } from '../contexts/TabBarContext';
import { kanaData } from '../data/kana';
import { audioService } from '../utils/audio';
import { Kana } from '../types';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40 - 32) / 5;

type KanaCategory = 'seion' | 'dakuon' | 'handakuon' | 'yoon';

const GOJUON_GRID = [
  ['a', 'i', 'u', 'e', 'o'],
  ['ka', 'ki', 'ku', 'ke', 'ko'],
  ['sa', 'shi', 'su', 'se', 'so'],
  ['ta', 'chi', 'tsu', 'te', 'to'],
  ['na', 'ni', 'nu', 'ne', 'no'],
  ['ha', 'hi', 'fu', 'he', 'ho'],
  ['ma', 'mi', 'mu', 'me', 'mo'],
  ['ya', null, 'yu', null, 'yo'],
  ['ra', 'ri', 'ru', 're', 'ro'],
  ['wa', null, null, null, 'wo'],
  ['n', null, null, null, null],
];

const DAKUON_GRID = [
  ['ga', 'gi', 'gu', 'ge', 'go'],
  ['za', 'ji', 'zu', 'ze', 'zo'],
  ['da', 'dji', 'dzu', 'de', 'do'],
  ['ba', 'bi', 'bu', 'be', 'bo'],
];

const HANDAKUON_GRID = [
  ['pa', 'pi', 'pu', 'pe', 'po'],
];

const YOON_GRID = [
  ['kya', null, 'kyu', null, 'kyo'],
  ['sha', null, 'shu', null, 'sho'],
  ['cha', null, 'chu', null, 'cho'],
  ['nya', null, 'nyu', null, 'nyo'],
  ['hya', null, 'hyu', null, 'hyo'],
  ['mya', null, 'myu', null, 'myo'],
  ['rya', null, 'ryu', null, 'ryo'],
  ['gya', null, 'gyu', null, 'gyo'],
  ['ja', null, 'ju', null, 'jo'],
  ['bya', null, 'byu', null, 'byo'],
  ['pya', null, 'pyu', null, 'pyo'],
];

const categoryNames: Record<KanaCategory, string> = {
  seion: '清音',
  dakuon: '濁音',
  handakuon: '半濁音',
  yoon: '拗音',
};

const CATEGORY_GRIDS: Record<string, (string | null)[][]> = {
  dakuon: DAKUON_GRID,
  handakuon: HANDAKUON_GRID,
  yoon: YOON_GRID,
};

export default function BrowseScreen({ navigation }: { navigation: any }) {
  const { theme, isDark } = useTheme();
  const { handleScroll } = useTabBar();
  const insets = useSafeAreaInsets();
  const [selectedKana, setSelectedKana] = useState<Kana | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });
  const flipAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cardRefs = useRef<{ [key: string]: View | null }>({});
  const selectedKanaRef = useRef<Kana | null>(null);
  const flipCardRef = useRef<() => void>(() => {});

  const categories: KanaCategory[] = ['dakuon', 'handakuon', 'yoon'];

  const getKanaById = (id: string) => kanaData.find(k => k.id === id);

  const handleKanaPress = async (kana: Kana, ref: View | null) => {
    if (ref) {
      ref.measureInWindow((x, y, width, height) => {
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2 - 40;
        const cardCenterX = x + width / 2;
        const cardCenterY = y + height / 2;

        setCardPosition({ x: cardCenterX - centerX, y: cardCenterY - centerY });
        translateAnim.setValue({ x: cardCenterX - centerX, y: cardCenterY - centerY });

        setSelectedKana(kana);
        setIsFlipped(false);
        flipAnim.setValue(0);
        scaleAnim.setValue(0);

        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }),
          Animated.spring(translateAnim, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
    // 不在打开卡片时播放音频，等用户翻转到背面再播放
  };

  const flipCard = async () => {
    // 解锁移动端音频（首次交互时）
    await audioService.unlock();
    // 停止当前播放的音频，防止重叠
    await audioService.stop();

    const nextIsFlipped = !isFlipped;
    const toValue = nextIsFlipped ? 1 : 0;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    if (nextIsFlipped && selectedKana) {
      void audioService.speakKana(selectedKana);
    }
    setIsFlipped(nextIsFlipped);
  };

  flipCardRef.current = () => {
    void flipCard();
  };

  useEffect(() => {
    selectedKanaRef.current = selectedKana;
  }, [selectedKana]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: any) => {
      if (event.repeat) return;
      if (!selectedKanaRef.current) return;
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        flipCardRef.current();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: { x: cardPosition.x, y: cardPosition.y },
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedKana(null);
      setIsFlipped(false);
      flipAnim.setValue(0);
    });
  };

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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => handleScroll(e.nativeEvent.contentOffset.y)} scrollEventThrottle={16}>
        <View style={[styles.headerSection, { marginTop: insets.top + 20 }]}>
          <Text style={[styles.titleMain, { color: theme.text }]}>五十音図</Text>
          <View style={[styles.titleLine, { backgroundColor: theme.text }]} />
          <Text style={[styles.titleSub, { color: theme.textSecondary }]}>
            Gojūon Chart
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>清音</Text>
          <View style={styles.tableContainer}>
            {GOJUON_GRID.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.tableRow}>
                {row.map((id, colIndex) => {
                  const kana = id ? getKanaById(id) : null;
                  const refKey = id || `empty-${colIndex}`;
                  return (
                    <View
                      key={colIndex}
                      ref={(ref) => { if (id) cardRefs.current[refKey] = ref; }}
                    >
                      <Pressable
                        style={[
                          styles.tableCell,
                          kana ? { backgroundColor: theme.card, borderColor: theme.border } : { backgroundColor: 'transparent' }
                        ]}
                        disabled={!kana}
                        onPress={() => kana && handleKanaPress(kana, cardRefs.current[refKey])}
                        android_ripple={null}
                      >
                        {kana && (
                          <>
                            <Text style={[styles.cellKana, { color: theme.text }]}>{kana.hiragana}</Text>
                            <Text style={[styles.cellRomaji, { color: theme.textTertiary }]}>{kana.romaji}</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {categories.map(category => (
          <View key={category} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {categoryNames[category]}
            </Text>
            <View style={styles.tableContainer}>
              {CATEGORY_GRIDS[category].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.tableRow}>
                  {row.map((id, colIndex) => {
                    const kana = id ? getKanaById(id) : null;
                    const refKey = id || `${category}-empty-${rowIndex}-${colIndex}`;
                    return (
                      <View
                        key={colIndex}
                        ref={(ref) => { if (id) cardRefs.current[refKey] = ref; }}
                      >
                        <Pressable
                          style={[
                            styles.tableCell,
                            kana ? { backgroundColor: theme.card, borderColor: theme.border } : { backgroundColor: 'transparent' }
                          ]}
                          disabled={!kana}
                          onPress={() => kana && handleKanaPress(kana, cardRefs.current[refKey])}
                          android_ripple={null}
                        >
                          {kana && (
                            <>
                              <Text style={[styles.cellKana, { color: theme.text }]}>{kana.hiragana}</Text>
                              <Text style={[styles.cellRomaji, { color: theme.textTertiary }]}>{kana.romaji}</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {selectedKana && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={closeModal}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  { translateX: translateAnim.x },
                  { translateY: translateAnim.y },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            <TouchableOpacity activeOpacity={0.9} onPress={flipCard}>
              <View style={styles.modalCard}>
                <Animated.View
                  style={[
                    styles.modalCardFace,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    { transform: [{ rotateY: frontInterpolate }] },
                  ]}
                >
                  <Text style={[styles.modalKanaText, { color: theme.text }]}>
                    {selectedKana.hiragana}
                  </Text>
                  <Text selectable={false} style={[styles.modalHint, { color: theme.textTertiary }]}>
                    点击翻转
                  </Text>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.modalCardFace,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    { transform: [{ rotateY: backInterpolate }] },
                  ]}
                >
                  <Text style={[styles.modalRomaji, { color: theme.primary }]}>
                    {selectedKana.romaji}
                  </Text>
                  <Text style={[styles.modalKatakana, { color: theme.text }]}>
                    {selectedKana.katakana}
                  </Text>
                  <Text style={[styles.modalType, { color: theme.textTertiary }]}>
                    {categoryNames[selectedKana.type as KanaCategory]}
                  </Text>
                </Animated.View>
              </View>
            </TouchableOpacity>

            {/* 简约播放按钮 */}
            <TouchableOpacity
              style={[styles.playButton, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => audioService.speakKana(selectedKana)}
            >
              <Text style={[styles.playButtonText, { color: theme.text }]}>
                再生
              </Text>
            </TouchableOpacity>

            {/* 关闭提示 */}
            <Text selectable={false} style={[styles.closeHint, { color: theme.textTertiary }]}>
              点击空白处关闭
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // 标题
  headerSection: {
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  titleMain: {
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: 6,
  },
  titleLine: {
    width: 40,
    height: 2,
    marginVertical: 12,
  },
  titleSub: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },

  // 区块
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: 16,
  },

  // 表格
  tableContainer: {
    gap: 6,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  tableCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellKana: {
    fontSize: 22,
    fontWeight: '300',
  },
  cellRomaji: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '400',
  },

  // 模态框
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    alignItems: 'center',
  },
  modalCard: {
    width: 260,
    height: 340,
  },
  modalCardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  modalKanaText: {
    fontSize: 100,
    fontWeight: '200',
  },
  modalHint: {
    fontSize: 12,
    marginTop: 20,
    fontWeight: '400',
    letterSpacing: 1,
  },
  modalRomaji: {
    fontSize: 32,
    fontWeight: '400',
    marginBottom: 16,
    letterSpacing: 2,
  },
  modalKatakana: {
    fontSize: 64,
    fontWeight: '200',
    marginBottom: 12,
  },
  modalType: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2,
  },

  // 播放按钮 - 简约风格
  playButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 4,
  },

  // 关闭提示
  closeHint: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
