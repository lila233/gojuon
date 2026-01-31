import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '../contexts/StudyContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBar } from '../contexts/TabBarContext';
import { storage } from '../storage';
import { StudySession } from '../types';

export default function StatsScreen() {
  const { getProgress } = useStudy();
  const { theme } = useTheme();
  const { handleScroll } = useTabBar();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const progress = getProgress();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await storage.getSessions();
    setSessions(data.slice(-7).reverse());
  };

  const totalReviewed = sessions.reduce((sum, s) => sum + s.cardsReviewed, 0);
  const avgAccuracy = sessions.length > 0
    ? sessions.reduce((sum, s) => {
        const acc = s.cardsReviewed > 0 ? s.correctCount / s.cardsReviewed : 0;
        return sum + acc;
      }, 0) / sessions.length * 100
    : 0;

  const progressPercent = progress.total > 0 ? (progress.mastered / progress.total) * 100 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => handleScroll(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>

        {/* 标题 */}
        <View style={styles.headerSection}>
          <Text style={[styles.titleMain, { color: theme.text }]}>統計</Text>
          <View style={[styles.titleLine, { backgroundColor: theme.text }]} />
          <Text style={[styles.titleSub, { color: theme.textSecondary }]}>
            Statistics
          </Text>
        </View>

        {/* 核心数据 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {totalReviewed}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
              総復習
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {avgAccuracy.toFixed(0)}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
              正確率
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {sessions.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
              学習日
            </Text>
          </View>
        </View>

        {/* 掌握情况 */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            掌握状況
          </Text>

          <View style={styles.masteryList}>
            <MasteryItem
              label="已掌握"
              value={progress.mastered}
              total={progress.total}
              theme={theme}
            />
            <MasteryItem
              label="复习中"
              value={progress.review}
              total={progress.total}
              theme={theme}
            />
            <MasteryItem
              label="学习中"
              value={progress.learning}
              total={progress.total}
              theme={theme}
            />
            <MasteryItem
              label="未学习"
              value={progress.new}
              total={progress.total}
              theme={theme}
            />
          </View>

          {/* 总进度 */}
          <View style={styles.totalProgress}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                総進捗
              </Text>
              <Text style={[styles.progressValue, { color: theme.text }]}>
                {progressPercent.toFixed(0)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%`, backgroundColor: theme.primary }
                ]}
              />
            </View>
          </View>
        </View>

        {/* 最近记录 */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            最近七日
          </Text>

          {sessions.length > 0 ? (
            <View style={styles.sessionList}>
              {sessions.map((session, index) => (
                <SessionRow
                  key={index}
                  session={session}
                  theme={theme}
                  isLast={index === sessions.length - 1}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                暂无学习记录
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textTertiary }]}>
                开始学习后这里会显示你的进度
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

function MasteryItem({ label, value, total, theme }: {
  label: string;
  value: number;
  total: number;
  theme: any;
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;

  return (
    <View style={styles.masteryItem}>
      <View style={styles.masteryHeader}>
        <Text style={[styles.masteryLabel, { color: theme.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.masteryValue, { color: theme.text }]}>
          {value}
        </Text>
      </View>
      <View style={[styles.masteryTrack, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.masteryFill,
            { width: `${percent}%`, backgroundColor: theme.primary }
          ]}
        />
      </View>
    </View>
  );
}

function SessionRow({ session, theme, isLast }: {
  session: StudySession;
  theme: any;
  isLast: boolean;
}) {
  const accuracy = session.cardsReviewed > 0
    ? (session.correctCount / session.cardsReviewed) * 100
    : 0;

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
    }
    return dateStr;
  };

  return (
    <View style={[
      styles.sessionRow,
      !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border }
    ]}>
      <View style={styles.sessionLeft}>
        <Text style={[styles.sessionDate, { color: theme.text }]}>
          {formatDate(session.date)}
        </Text>
        <Text style={[styles.sessionDetail, { color: theme.textTertiary }]}>
          {session.cardsReviewed} 张 · {session.averageTime.toFixed(1)}s/张
        </Text>
      </View>
      <Text style={[styles.sessionAccuracy, { color: theme.text }]}>
        {accuracy.toFixed(0)}%
      </Text>
    </View>
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

  // 核心数据行
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '200',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },

  // 区块
  section: {
    paddingVertical: 24,
    borderTopWidth: 1,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: 20,
  },

  // 掌握情况
  masteryList: {
    gap: 16,
  },
  masteryItem: {
    gap: 8,
  },
  masteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masteryLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  masteryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  masteryTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
  },

  // 总进度
  totalProgress: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  progressValue: {
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

  // 学习记录
  sessionList: {
    gap: 0,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  sessionLeft: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 2,
  },
  sessionDetail: {
    fontSize: 12,
    fontWeight: '400',
  },
  sessionAccuracy: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 1,
  },

  // 空状态
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: '400',
  },
});
