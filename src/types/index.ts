export type KanaType = 'hiragana' | 'katakana';

export interface Kana {
  id: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  type: 'seion' | 'dakuon' | 'handakuon' | 'yoon';
  row: string;
}

export interface Card {
  id: string;
  kanaId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number | null;
  lapses: number;
  firstLearnedAt?: number; // 首次学习时间戳，用于准确计算每日新卡片限制
}

export interface ReviewResult {
  cardId: string;
  timestamp: number;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  timeSpent: number;
}

export interface StudySession {
  date: string;
  cardsReviewed: number;
  correctCount: number;
  averageTime: number;
}

export interface UserProgress {
  totalCards: number;
  masteredCards: number;
  learningCards: number;
  newCards: number;
  studyStreak: number;
  lastStudyDate: string | null;
}

export interface Settings {
  dailyNewCards: number;
  dailyReviews: number;
  showRomaji: boolean;
  studyMode: 'hiragana' | 'katakana' | 'both';
  kanaScope?: 'all' | 'seion' | 'no_katakana';
  themeMode?: 'light' | 'dark' | 'auto';
  notificationsEnabled?: boolean;
  notificationTime?: { hour: number; minute: number };
  shuffleCards?: boolean;
  lastBackupTime?: number;
}

export interface BackupData {
  cards: Card[];
  reviews: ReviewResult[];
  sessions: StudySession[];
  settings: Settings;
  backupVersion: number;
  lastModified: number;
}

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
