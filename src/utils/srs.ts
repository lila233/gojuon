import { Card } from '../types';

const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const EASY_BONUS = 1.3;
const HARD_INTERVAL_MULTIPLIER = 0.8; // quality=3 时缩短间隔，更快复习

export interface ReviewInput {
  card: Card;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface ReviewOutput {
  card: Card;
  isCorrect: boolean;
}

export function reviewCard({ card, quality }: ReviewInput): ReviewOutput {
  const now = Date.now();
  const isCorrect = quality >= 3;

  let newEaseFactor = card.easeFactor;
  let newInterval = card.interval;
  let newRepetitions = card.repetitions;
  let newLapses = card.lapses;

  // 记录首次学习时间（从新卡片变为已学习状态）
  const firstLearnedAt = card.firstLearnedAt ?? (card.lastReview === null ? now : undefined);

  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1;
    newLapses += 1;
    newEaseFactor = Math.max(
      MIN_EASE_FACTOR,
      card.easeFactor - 0.2
    );
  } else {
    newRepetitions += 1;

    newEaseFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor);

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(card.interval * newEaseFactor);

      // EASY_BONUS 和 HARD_INTERVAL_MULTIPLIER 只应用于第3次及以后的复习
      // 前两次复习间隔是固定的（1天、6天），符合标准 SM-2 算法
      if (quality === 5) {
        newInterval = Math.round(newInterval * EASY_BONUS);
      } else if (quality === 3) {
        newInterval = Math.max(1, Math.round(newInterval * HARD_INTERVAL_MULTIPLIER));
      }
    }
  }

  const nextReview = now + newInterval * 24 * 60 * 60 * 1000;

  const updatedCard: Card = {
    ...card,
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    lapses: newLapses,
    lastReview: now,
    nextReview,
    firstLearnedAt,
  };

  return {
    card: updatedCard,
    isCorrect,
  };
}

export function initializeCard(kanaId: string): Card {
  return {
    id: `card_${kanaId}`,
    kanaId,
    easeFactor: INITIAL_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    nextReview: Date.now(),
    lastReview: null,
    lapses: 0,
  };
}

export function getDueCards(cards: Card[]): Card[] {
  const now = Date.now();
  return cards.filter(card => card.nextReview <= now && card.lastReview !== null);
}

export function getNewCards(cards: Card[], limit: number = 20): Card[] {
  // 计算今天学习的新卡片数量（使用 firstLearnedAt 准确判断）
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  // 统计今天首次学习的卡片数量（无论之后是否答错被重置）
  const newCardsLearnedTodayCount = cards.filter(card =>
    card.firstLearnedAt !== undefined &&
    card.firstLearnedAt >= todayStartMs
  ).length;

  // 剩余可学的新卡片数量
  const remainingLimit = Math.max(0, limit - newCardsLearnedTodayCount);

  return cards
    .filter(card => card.lastReview === null)
    .slice(0, remainingLimit);
}

export function getCardsByStatus(cards: Card[]) {
  return {
    // 新卡片：从未学习过
    new: cards.filter(card => card.lastReview === null),
    // 学习中：已学习但还不熟练（repetitions < 2，包括回答错误被重置的）
    learning: cards.filter(card =>
      card.lastReview !== null &&
      card.repetitions < 2
    ),
    // 复习中：有一定熟练度但未达到掌握标准
    review: cards.filter(card =>
      card.lastReview !== null &&
      card.repetitions >= 2 &&
      !(card.repetitions >= 4 && card.interval >= 14)
    ),
    // 已掌握：连续正确 4 次以上，且间隔 >= 14 天
    mastered: cards.filter(card =>
      card.repetitions >= 4 &&
      card.interval >= 14
    ),
  };
}
