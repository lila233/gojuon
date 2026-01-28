import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Kana, Settings, Quality } from '../types';
import { storage } from '../storage';
import { kanaData } from '../data/kana';
import {
  initializeCard,
  reviewCard,
  getDueCards,
  getNewCards,
  getCardsByStatus,
} from '../utils/srs';
import { getLocalDateKey, normalizeDateKey } from '../utils/date';

interface Progress {
  new: number;
  learning: number;
  review: number;
  mastered: number;
  total: number;
  dueToday: number;
}

interface StudyContextType {
  cards: Card[];
  currentCard: Card | null;
  studyQueue: Card[];
  isLoading: boolean;
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  startStudySession: () => void;
  submitReview: (quality: Quality, timeSpentMs?: number) => Promise<boolean | undefined>;
  getKanaForCard: (card: Card) => Kana | undefined;
  getProgress: () => Progress;
  loadData: () => Promise<void>;
  totalQueueSize: number;
  completedInSession: number;
}

const defaultSettings: Settings = {
  dailyNewCards: 20,
  dailyReviews: 100,
  showRomaji: true,
  studyMode: 'both',
  kanaScope: 'all',
  themeMode: 'auto',
  notificationsEnabled: false,
  notificationTime: { hour: 20, minute: 0 },
  shuffleCards: true,
};

function normalizeCardsByKana(cards: Card[]): Card[] {
  const kanaIdSet = new Set(kanaData.map(k => k.id));
  const cardMap = new Map<string, Card>();

  cards.forEach(card => {
    if (!kanaIdSet.has(card.kanaId)) {
      return;
    }
    const existing = cardMap.get(card.kanaId);
    if (!existing) {
      cardMap.set(card.kanaId, card);
      return;
    }

    const existingLast = existing.lastReview ?? 0;
    const currentLast = card.lastReview ?? 0;
    if (currentLast > existingLast) {
      cardMap.set(card.kanaId, card);
      return;
    }

    if (currentLast === existingLast && card.repetitions > existing.repetitions) {
      cardMap.set(card.kanaId, card);
    }
  });

  kanaData.forEach(kana => {
    if (!cardMap.has(kana.id)) {
      cardMap.set(kana.id, initializeCard(kana.id));
    }
  });

  return Array.from(cardMap.values());
}

function getEligibleKanaIds(settings: Settings): Set<string> {
  if (settings.kanaScope === 'seion') {
    return new Set(kanaData.filter(k => k.type === 'seion').map(k => k.id));
  }
  return new Set(kanaData.map(k => k.id));
}

function filterCardsByScope(cards: Card[], settings: Settings): Card[] {
  const eligibleIds = getEligibleKanaIds(settings);
  return cards.filter(card => eligibleIds.has(card.kanaId));
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [studyQueue, setStudyQueue] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [totalQueueSize, setTotalQueueSize] = useState(0);
  const [completedInSession, setCompletedInSession] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const savedSettings = await storage.getSettings();
    const mergedSettings = { ...defaultSettings, ...savedSettings };
    const savedCards = await storage.getCards();
    const finalCards = normalizeCardsByKana(savedCards);
    
    // Save cleaned data back to storage if it changed
    if (finalCards.length !== savedCards.length) {
      await storage.saveCards(finalCards);
    }

    setCards(finalCards);
    setSettings(mergedSettings);
    setIsLoading(false);
  };

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const nextSettings = { ...settings, ...updates };
    setSettings(nextSettings);
    await storage.saveSettings(nextSettings);
  }, [settings]);

  const startStudySession = useCallback(() => {
    const eligibleCards = filterCardsByScope(cards, settings);
    const dueCards = getDueCards(eligibleCards);
    const newCards = getNewCards(eligibleCards, settings.dailyNewCards);
    let queue = [...dueCards, ...newCards].slice(0, settings.dailyReviews);

    if (settings.shuffleCards) {
      queue = shuffleArray(queue);
    }

    setStudyQueue(queue);
    setTotalQueueSize(queue.length);
    setCompletedInSession(0);

    if (queue.length > 0) {
      setCurrentCard(queue[0]);
    } else {
      setCurrentCard(null);
    }
  }, [cards, settings]);

  const submitReview = useCallback(async (quality: Quality, timeSpentMs: number = 0) => {
    if (!currentCard) return;

    const { card: updatedCard, isCorrect } = reviewCard({
      card: currentCard,
      quality,
    });

    const updatedCards = cards.map(c =>
      c.id === updatedCard.id ? updatedCard : c
    );

    // 先更新内存状态（立即响应UI）
    setCards(updatedCards);
    const remainingQueue = studyQueue.slice(1);
    setStudyQueue(remainingQueue);
    setCompletedInSession(prev => prev + 1);

    if (remainingQueue.length > 0) {
      setCurrentCard(remainingQueue[0]);
    } else {
      setCurrentCard(null);
    }

    // 后台并行保存（不阻塞UI）
    const todayStr = getLocalDateKey();
    const savePromise = (async () => {
      const [sessions] = await Promise.all([
        storage.getSessions(),
        storage.saveCards(updatedCards),
        storage.addReview({
          cardId: updatedCard.id,
          timestamp: Date.now(),
          quality,
          timeSpent: timeSpentMs,
        }),
      ]);

      const normalizedSessions = sessions.map(session => ({
        ...session,
        date: normalizeDateKey(session.date),
      }));
      let todaySession = normalizedSessions.find(s => s.date === todayStr);

      if (!todaySession) {
        todaySession = {
          date: todayStr,
          cardsReviewed: 0,
          correctCount: 0,
          averageTime: 0,
        };
      }

      const timeSpentSec = timeSpentMs / 1000;
      const newTotalTime = (todaySession.averageTime * todaySession.cardsReviewed) + timeSpentSec;

      todaySession.cardsReviewed += 1;
      if (isCorrect) {
        todaySession.correctCount += 1;
      }
      todaySession.averageTime = newTotalTime / todaySession.cardsReviewed;

      await storage.addSession(todaySession);
    })();

    // 等待保存完成
    await savePromise;

    return isCorrect;
  }, [currentCard, cards, studyQueue]);

  const kanaMap = useMemo(() => {
    const map = new Map<string, Kana>();
    kanaData.forEach(k => map.set(k.id, k));
    return map;
  }, []);

  const getKanaForCard = useCallback((card: Card): Kana | undefined => {
    return kanaMap.get(card.kanaId);
  }, [kanaMap]);

  const getProgress = useCallback((): Progress => {
    const eligibleCards = filterCardsByScope(cards, settings);
    const status = getCardsByStatus(eligibleCards);
    const dueCards = getDueCards(eligibleCards);
    const newCards = getNewCards(eligibleCards, settings.dailyNewCards);

    return {
      new: status.new.length,
      learning: status.learning.length,
      review: status.review.length,
      mastered: status.mastered.length,
      total: eligibleCards.length,
      dueToday: Math.min(dueCards.length + newCards.length, settings.dailyReviews),
    };
  }, [cards, settings]);

  return (
    <StudyContext.Provider
      value={{
        cards,
        currentCard,
        studyQueue,
        isLoading,
        settings,
        updateSettings,
        startStudySession,
        submitReview,
        getKanaForCard,
        getProgress,
        loadData,
        totalQueueSize,
        completedInSession,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) {
    throw new Error('useStudy must be used within StudyProvider');
  }
  return context;
}
