import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, ReviewResult, StudySession } from '../types';

const CARDS_KEY = '@gojuon_cards';
const REVIEWS_KEY = '@gojuon_reviews';
const SESSIONS_KEY = '@gojuon_sessions';
const SETTINGS_KEY = '@gojuon_settings';

export const storage = {
  async getCards(): Promise<Card[]> {
    const data = await AsyncStorage.getItem(CARDS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async saveCards(cards: Card[]): Promise<void> {
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  },

  async getReviews(): Promise<ReviewResult[]> {
    const data = await AsyncStorage.getItem(REVIEWS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async addReview(review: ReviewResult): Promise<void> {
    const reviews = await this.getReviews();
    reviews.push(review);
    await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  },

  async getSessions(): Promise<StudySession[]> {
    const data = await AsyncStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async addSession(session: StudySession): Promise<void> {
    const sessions = await this.getSessions();
    const existingIndex = sessions.findIndex(s => s.date === session.date);

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },

  async getSettings(): Promise<any> {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : {
      dailyNewCards: 20,
      dailyReviews: 100,
      showRomaji: true,
      studyMode: 'both',
      kanaScope: 'all',
      notificationsEnabled: false,
      notificationTime: { hour: 20, minute: 0 },
      shuffleCards: true,
      cloudSyncEnabled: false,
    };
  },

  async saveSettings(settings: any): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      CARDS_KEY,
      REVIEWS_KEY,
      SESSIONS_KEY,
      SETTINGS_KEY,
    ]);
  },
};
