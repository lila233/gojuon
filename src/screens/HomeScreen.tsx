import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '../contexts/StudyContext';
import { useTheme } from '../contexts/ThemeContext';
import { kanaData } from '../data/kana';
import { Kana } from '../types';
import { storage } from '../storage';
import { audioService } from '../utils/audio';
import { getLocalDateKey, normalizeDateKey } from '../utils/date';

const TIPS = [
  "平假名主要用于日语中的本土词汇和语法成分",
  "片假名主要用于外来语、拟声词和强调",
  "浊音是在右上角加上两点，半浊音是加上圆圈",
  "拗音是由辅音和半元音结合而成的音节",
  "促音「っ」表示停顿一拍，不发音",
  "长音表示元音拉长一拍",
  "日语句子的基本语序是：主语 - 宾语 - 谓语",
];

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { getProgress, startStudySession, settings } = useStudy();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = getProgress();
  const canStartStudy = progress.dueToday > 0;
  const [dailyKana, setDailyKana] = useState<Kana | null>(null);
  const [dailyTip, setDailyTip] = useState('');
  const [weeklyActivity, setWeeklyActivity] = useState<boolean[]>(new Array(7).fill(false));
  const [currentDateStr, setCurrentDateStr] = useState('');

  useEffect(() => {
    const today = new Date();
    setCurrentDateStr(`${today.getMonth() + 1}月${today.getDate()}日`);
    const dateStr = today.toDateString();
    const seed = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const kanaIndex = seed % (kanaData.length || 1);
    setDailyKana(kanaData[kanaIndex]);

    const tipIndex = seed % TIPS.length;
    setDailyTip(TIPS[tipIndex]);

    loadActivity();
  }, []);

  const loadActivity = async () => {
    const sessions = await storage.getSessions();
    const sessionDates = new Set(sessions.map(s => normalizeDateKey(s.date)));
    const activity = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = getLocalDateKey(d);
      activity.push(sessionDates.has(dateString));
    }
    setWeeklyActivity(activity);
  };

  const handleStartStudy = () => {
    if (!canStartStudy) return;
    startStudySession();
    navigation.navigate('Study');
  };

  const playDailyAudio = () => {
    if (dailyKana) {
      audioService.speakKana(dailyKana);
    }
  };

  const progressPercent = progress.total > 0
    ? (progress.mastered / progress.total) * 100
    : 0;

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const today = new Date().getDay();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar hidden={true} />
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>

        {/* 标题区域 - 书法风格 */}
        <View style={styles.headerSection}>
          <Text style={[styles.titleMain, { color: theme.text }]}>五十音</Text>
          <View style={[styles.titleLine, { backgroundColor: theme.text }]} />
          <Text style={[styles.titleSub, { color: theme.textSecondary }]}>
            Gojūon
          </Text>
        </View>

        {/* 今日状态 - 简洁数字 */}
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={[styles.statusNumber, { color: theme.text }]}>
              {progress.dueToday}
            </Text>
            <Text style={[styles.statusLabel, { color: theme.textTertiary }]}>
              待学习
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statusItem}>
            <Text style={[styles.statusNumber, { color: theme.text }]}>
              {progress.mastered}
            </Text>
            <Text style={[styles.statusLabel, { color: theme.textTertiary }]}>
              已掌握
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statusItem}>
            <Text style={[styles.statusNumber, { color: theme.text }]}>
              {progress.total}
            </Text>
            <Text style={[styles.statusLabel, { color: theme.textTertiary }]}>
              全部
            </Text>
          </View>
        </View>

        {/* 开始学习按钮 - 墨色风格 */}
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: theme.primary },
            !canStartStudy && styles.startButtonDisabled
          ]}
          onPress={handleStartStudy}
          activeOpacity={0.85}
          disabled={!canStartStudy}
        >
          <Text style={[styles.startButtonText, { color: isDark ? theme.background : '#FDFBF7' }]}>
            {canStartStudy ? '開始' : '完了'}
          </Text>
          <Text style={[styles.startButtonSub, { color: isDark ? theme.textTertiary : 'rgba(253,251,247,0.7)' }]}>
            {canStartStudy ? `${progress.dueToday} 張` : '明日再来'}
          </Text>
        </TouchableOpacity>

        {/* 周活动记录 - 简约点阵 */}
        <View style={[styles.activitySection, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            本週
          </Text>
          <View style={styles.activityDots}>
            {weeklyActivity.map((active, i) => {
              const dayIndex = (today - 6 + i + 7) % 7;
              return (
                <View key={i} style={styles.activityDay}>
                  <View
                    style={[
                      styles.activityDot,
                      {
                        backgroundColor: active ? theme.primary : theme.border,
                        opacity: active ? 1 : 0.4
                      }
                    ]}
                  />
                  <Text style={[styles.activityDayText, { color: theme.textTertiary }]}>
                    {weekDays[dayIndex]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 今日假名 - 卡片风格 */}
        {dailyKana && (
          <TouchableOpacity
            style={[styles.kanaCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={playDailyAudio}
            activeOpacity={0.9}
          >
            <View style={styles.kanaCardHeader}>
              <Text style={[styles.kanaCardDate, { color: theme.textTertiary }]}>
                {currentDateStr}
              </Text>
              <Text style={[styles.kanaCardLabel, { color: theme.textSecondary }]}>
                今日一字
              </Text>
            </View>

            <View style={styles.kanaCardContent}>
              <View style={styles.kanaDisplay}>
                <Text style={[styles.kanaLarge, { color: theme.text }]}>
                  {dailyKana.hiragana}
                </Text>
                <Text style={[styles.kanaSmall, { color: theme.textSecondary }]}>
                  {dailyKana.katakana}
                </Text>
              </View>
              <View style={styles.kanaInfo}>
                <Text style={[styles.romajiText, { color: theme.primary }]}>
                  {dailyKana.romaji}
                </Text>
                <Text style={[styles.kanaType, { color: theme.textTertiary }]}>
                  {dailyKana.type} · {dailyKana.row}行
                </Text>
              </View>
            </View>

            <View style={[styles.kanaCardFooter, { borderTopColor: theme.border }]}>
              <Text style={[styles.playHint, { color: theme.textTertiary }]}>
                点击播放发音
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 进度条 - 细线风格 */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              総進捗
            </Text>
            <Text style={[styles.progressPercent, { color: theme.text }]}>
              {progressPercent.toFixed(0)}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%`, backgroundColor: theme.primary },
              ]}
            />
          </View>
        </View>

        {/* 小贴士 - 引用风格 */}
        <View style={[styles.tipSection, { borderLeftColor: theme.textTertiary }]}>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            {dailyTip}
          </Text>
        </View>

        {/* 底部留白 */}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },

  // 标题
  headerSection: {
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  titleMain: {
    fontSize: 56,
    fontWeight: '200',
    letterSpacing: 8,
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

  // 状态行
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusNumber: {
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1,
  },
  statusDivider: {
    width: 1,
    height: 32,
  },

  // 开始按钮
  startButton: {
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 32,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 12,
    marginBottom: 4,
  },
  startButtonSub: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 2,
  },

  // 周活动
  activitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  activityDots: {
    flexDirection: 'row',
    gap: 16,
  },
  activityDay: {
    alignItems: 'center',
    gap: 6,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityDayText: {
    fontSize: 10,
    fontWeight: '400',
  },

  // 假名卡片
  kanaCard: {
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: 32,
    overflow: 'hidden',
  },
  kanaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  kanaCardDate: {
    fontSize: 12,
    fontWeight: '400',
  },
  kanaCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  kanaCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  kanaDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 24,
  },
  kanaLarge: {
    fontSize: 72,
    fontWeight: '300',
  },
  kanaSmall: {
    fontSize: 28,
    fontWeight: '300',
    marginLeft: 12,
  },
  kanaInfo: {
    flex: 1,
  },
  romajiText: {
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: 2,
    marginBottom: 4,
  },
  kanaType: {
    fontSize: 12,
    fontWeight: '400',
  },
  kanaCardFooter: {
    borderTopWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  playHint: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1,
  },

  // 进度
  progressSection: {
    marginBottom: 32,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },

  // 小贴士
  tipSection: {
    borderLeftWidth: 2,
    paddingLeft: 16,
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
