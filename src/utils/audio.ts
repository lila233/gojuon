import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { Kana } from '../types';
import { audioFiles } from '../data/audioMap';

// 获取 baseUrl（用于 GitHub Pages 等子路径部署）
const baseUrl = Constants.expoConfig?.web?.baseUrl || '';
const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

function withBaseUrl(uri: string): string {
  if (!normalizedBaseUrl || !uri.startsWith('/')) return uri;
  return `${normalizedBaseUrl}${uri}`;
}

/**
 * 获取音频源 - Web 平台使用 URI 路径，原生平台使用 require()
 */
function getAudioSource(kanaId: string): any {
  const moduleRef = audioFiles[kanaId];
  if (!moduleRef) return null;
  if (Platform.OS === 'web') {
    // Web 平台：通过 Asset 获取带哈希的构建路径
    const asset = Asset.fromModule(moduleRef);
    const uri = asset.localUri || asset.uri;
    if (!uri) return null;
    return { uri: withBaseUrl(uri) };
  }
  // 原生平台：使用 require() 的音频文件
  return moduleRef;
}

// 音频播放器实例缓存
let currentSound: Audio.Sound | null = null;
let isAudioInitialized = false;
const soundCache = new Map<string, Audio.Sound>();
let isAllPreloaded = false;
let isUserInteracted = false;
let isPlaying = false;  // 防止重复播放

function isCachedSound(sound: Audio.Sound | null): boolean {
  if (!sound) return false;
  for (const cached of soundCache.values()) {
    if (cached === sound) return true;
  }
  return false;
}

/**
 * 初始化音频模式 - 必须在播放前调用
 */
async function initAudio(): Promise<void> {
  if (isAudioInitialized) return;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    isAudioInitialized = true;
    console.log('[Audio] Initialized successfully');
  } catch (error) {
    console.error('[Audio] Failed to initialize:', error);
  }
}

/**
 * 解锁音频 - 在用户首次交互时调用，用于解决移动端自动播放限制
 */
async function unlockAudio(): Promise<void> {
  if (isUserInteracted) return;
  isUserInteracted = true;

  await initAudio();

  // 尝试通过 Web Audio API 解锁（移动浏览器需要）
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        // 创建一个短暂的静音缓冲区并播放
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        // 恢复被暂停的 AudioContext
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        console.log('[Audio] Web AudioContext unlocked');
      }
    } catch (e) {
      console.warn('[Audio] Web AudioContext unlock failed:', e);
    }
  }

  // 同时尝试 expo-av 的解锁方式
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA' },
      { shouldPlay: true, volume: 0.01 }
    );
    await sound.unloadAsync();
    console.log('[Audio] Expo audio unlocked for mobile');
  } catch (e) {
    // 忽略解锁失败
  }
}

export const audioService = {
  /**
   * 解锁音频播放（移动端需要用户交互后调用）
   */
  async unlock(): Promise<void> {
    await unlockAudio();
  },

  /**
   * 播放假名的本地音频文件
   * 如果本地文件不存在或播放失败，则回退到 TTS
   */
  async speakKana(kana: Kana): Promise<void> {
    // 防止重复播放
    if (isPlaying) {
      console.log('[Audio] Already playing, skipping');
      return;
    }

    const audioSource = getAudioSource(kana.id);

    if (audioSource) {
      try {
        isPlaying = true;
        const played = await this.playCachedSound(kana.id);
        if (!played) {
          await this.playLocalAudio(audioSource);
        }
      } catch (error) {
        console.error('[Audio] Local audio failed, falling back to TTS:', error);
        isPlaying = false;
        // 本地音频失败时回退到 TTS
        await this.speak(kana.hiragana, 'ja-JP');
      }
    } else {
      // 没有本地音频文件，使用 TTS
      await this.speak(kana.hiragana, 'ja-JP');
    }
  },

  /**
   * 播放本地音频文件
   */
  async playLocalAudio(audioSource: any): Promise<void> {
    // 确保音频模式已初始化
    await initAudio();

    try {
      // 停止当前正在播放的音频
      if (currentSound) {
        try {
          await currentSound.stopAsync();
          if (!isCachedSound(currentSound)) {
            await currentSound.unloadAsync();
          }
        } catch (e) {
          // 忽略卸载错误
        }
        currentSound = null;
      }

      // 创建新的音频实例
      const { sound } = await Audio.Sound.createAsync(
        audioSource,
        {
          shouldPlay: false,
          rate: 0.85,
          shouldCorrectPitch: true,
          volume: 1.0,
        }
      );
      currentSound = sound;

      // 播放音频
      await sound.playAsync();

      // 等待播放完成后自动卸载
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          isPlaying = false;
          sound.unloadAsync().catch(() => {});
          if (currentSound === sound) {
            currentSound = null;
          }
        }
      });
    } catch (error) {
      console.error('[Audio] Error playing audio:', error);
      throw error;
    }
  },

  /**
   * 预加载全部音频文件
   */
  async preloadAll(): Promise<void> {
    if (isAllPreloaded) return;
    await initAudio();

    // 获取所有 kanaId 列表
    const kanaIds = Object.keys(audioFiles);
    await Promise.all(kanaIds.map(async (kanaId) => {
      if (soundCache.has(kanaId)) return;
      try {
        const audioSource = getAudioSource(kanaId);
        const { sound } = await Audio.Sound.createAsync(
          audioSource,
          {
            shouldPlay: false,
            rate: 0.85,
            shouldCorrectPitch: true,
            volume: 1.0,
          }
        );
        soundCache.set(kanaId, sound);
      } catch (error) {
        console.warn('[Audio] Preload failed:', kanaId, error);
      }
    }));
    isAllPreloaded = true;
  },

  /**
   * 播放缓存的音频（如果存在）
   */
  async playCachedSound(kanaId: string): Promise<boolean> {
    const cachedSound = soundCache.get(kanaId);
    if (!cachedSound) return false;
    await initAudio();

    if (currentSound && currentSound !== cachedSound) {
      try {
        await currentSound.stopAsync();
        if (!isCachedSound(currentSound)) {
          await currentSound.unloadAsync();
        }
      } catch (e) {
        // 忽略卸载错误
      }
    }

    currentSound = cachedSound;
    try {
      await currentSound.setPositionAsync(0);
    } catch (e) {
      // 忽略错误
    }

    await currentSound.playAsync();

    // 使用播放状态回调重置 isPlaying 标志
    currentSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        isPlaying = false;
      }
    });

    return true;
  },

  /**
   * 使用 TTS 朗读文本（作为备用方案）
   */
  async speak(text: string, language: string = 'ja-JP'): Promise<void> {
    const options = {
      language,
      pitch: 1.0,
      rate: 0.7,
    };

    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        ...options,
        onDone: () => resolve(),
        onError: (error) => {
          console.error('[Audio] TTS error:', error);
          reject(error);
        },
      });
    });
  },

  /**
   * 停止当前播放
   */
  async stop(): Promise<void> {
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        if (!isCachedSound(currentSound)) {
          await currentSound.unloadAsync();
        }
      } catch (e) {
        // 忽略错误
      }
      currentSound = null;
    }
    Speech.stop();
  },

  /**
   * 检查是否正在播放
   */
  async isSpeaking(): Promise<boolean> {
    if (currentSound) {
      try {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          return true;
        }
      } catch (e) {
        // 忽略错误
      }
    }
    return Speech.isSpeakingAsync();
  },
};
