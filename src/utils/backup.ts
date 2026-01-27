import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../storage';
import { Card, ReviewResult, StudySession, Settings, BackupData } from '../types';
import { normalizeDateKey } from './date';

const BACKUP_VERSION = 1;

export type BackupStatus = 'idle' | 'processing' | 'success' | 'error';

export interface BackupResult {
  success: boolean;
  message: string;
  timestamp?: number;
}

export const backupService = {
  async exportData(): Promise<BackupData> {
    const [cards, reviews, sessions, settings] = await Promise.all([
      storage.getCards(),
      storage.getReviews(),
      storage.getSessions(),
      storage.getSettings(),
    ]);

    return {
      cards,
      reviews,
      sessions,
      settings,
      backupVersion: BACKUP_VERSION,
      lastModified: Date.now(),
    };
  },

  async importData(data: BackupData): Promise<BackupResult> {
    if (!data || !data.backupVersion) {
      return { success: false, message: '无效的备份数据' };
    }

    if (data.backupVersion > BACKUP_VERSION) {
      return { success: false, message: '数据版本过高，请更新应用' };
    }

    const localData = await this.exportData();
    const mergedData = this.mergeData(localData, data);

    await Promise.all([
      storage.saveCards(mergedData.cards),
      this.saveReviews(mergedData.reviews),
      this.saveSessions(mergedData.sessions),
      storage.saveSettings({ ...mergedData.settings, lastBackupTime: Date.now() }),
    ]);

    return {
      success: true,
      message: '导入成功',
      timestamp: Date.now(),
    };
  },

  mergeData(local: BackupData, remote: BackupData): BackupData {
    const mergedCards = this.mergeCards(local.cards, remote.cards);
    const mergedReviews = this.mergeReviews(local.reviews, remote.reviews);
    const mergedSessions = this.mergeSessions(local.sessions, remote.sessions);
    const mergedSettings = remote.lastModified > local.lastModified
      ? { ...local.settings, ...remote.settings }
      : { ...remote.settings, ...local.settings };

    return {
      cards: mergedCards,
      reviews: mergedReviews,
      sessions: mergedSessions,
      settings: mergedSettings,
      backupVersion: BACKUP_VERSION,
      lastModified: Math.max(local.lastModified, remote.lastModified),
    };
  },

  mergeCards(local: Card[], remote: Card[]): Card[] {
    const cardMap = new Map<string, Card>();

    local.forEach(card => cardMap.set(card.id, card));

    remote.forEach(card => {
      const existing = cardMap.get(card.id);
      if (!existing) {
        cardMap.set(card.id, card);
      } else {
        const localLastReview = existing.lastReview || 0;
        const remoteLastReview = card.lastReview || 0;
        if (remoteLastReview > localLastReview) {
          cardMap.set(card.id, card);
        }
      }
    });

    return Array.from(cardMap.values());
  },

  mergeReviews(local: ReviewResult[], remote: ReviewResult[]): ReviewResult[] {
    const reviewSet = new Set<string>();
    const merged: ReviewResult[] = [];

    const getKey = (r: ReviewResult) => `${r.cardId}-${r.timestamp}`;

    [...local, ...remote].forEach(review => {
      const key = getKey(review);
      if (!reviewSet.has(key)) {
        reviewSet.add(key);
        merged.push(review);
      }
    });

    return merged.sort((a, b) => a.timestamp - b.timestamp);
  },

  mergeSessions(local: StudySession[], remote: StudySession[]): StudySession[] {
    const sessionMap = new Map<string, StudySession>();

    local.forEach(session => {
      const normalizedDate = normalizeDateKey(session.date);
      sessionMap.set(normalizedDate, { ...session, date: normalizedDate });
    });

    remote.forEach(session => {
      const normalizedDate = normalizeDateKey(session.date);
      const existing = sessionMap.get(normalizedDate);
      if (!existing || session.cardsReviewed > existing.cardsReviewed) {
        sessionMap.set(normalizedDate, { ...session, date: normalizedDate });
      }
    });

    return Array.from(sessionMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  async saveReviews(reviews: ReviewResult[]): Promise<void> {
    await AsyncStorage.setItem('@gojuon_reviews', JSON.stringify(reviews));
  },

  async saveSessions(sessions: StudySession[]): Promise<void> {
    await AsyncStorage.setItem('@gojuon_sessions', JSON.stringify(sessions));
  },

  getExportJson(data: BackupData): string {
    return JSON.stringify(data, null, 2);
  },

  parseImportJson(json: string): BackupData | null {
    try {
      const data = JSON.parse(json);
      // 兼容旧版 syncVersion 字段
      if (data.syncVersion && !data.backupVersion) {
        data.backupVersion = data.syncVersion;
      }
      return data;
    } catch {
      return null;
    }
  },

  formatBackupTime(timestamp: number | undefined): string {
    if (!timestamp) return '从未备份';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },
};
