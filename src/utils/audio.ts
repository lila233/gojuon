import { useAudioPlayer, AudioPlayer } from 'expo-audio';
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
 * 获取音频源 URI
 */
function getAudioUri(kanaId: string): string | null {
  const moduleRef = audioFiles[kanaId];
  if (!moduleRef) return null;

  const asset = Asset.fromModule(moduleRef);
  const uri = asset.localUri || asset.uri;
  if (!uri) return null;

  if (Platform.OS === 'web') {
    return withBaseUrl(uri);
  }
  return uri;
}

// 当前播放器实例
let currentPlayer: AudioPlayer | null = null;
let isUserInteracted = false;
let isPlaying = false;

/**
 * 解锁音频 - 在用户首次交互时调用
 */
async function unlockAudio(): Promise<void> {
  if (isUserInteracted) return;
  isUserInteracted = true;

  // Web 平台通过 Web Audio API 解锁
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        console.log('[Audio] Web AudioContext unlocked');
      }
    } catch (e) {
      console.warn('[Audio] Web AudioContext unlock failed:', e);
    }
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
   */
  async speakKana(kana: Kana): Promise<void> {
    // 防止重复播放
    if (isPlaying) {
      console.log('[Audio] Already playing, skipping');
      return;
    }

    const audioUri = getAudioUri(kana.id);

    if (audioUri) {
      try {
        isPlaying = true;
        await this.playAudio(audioUri);
      } catch (error) {
        console.error('[Audio] Local audio failed, falling back to TTS:', error);
        isPlaying = false;
        await this.speak(kana.hiragana, 'ja-JP');
      }
    } else {
      await this.speak(kana.hiragana, 'ja-JP');
    }
  },

  /**
   * 播放音频文件
   */
  async playAudio(uri: string): Promise<void> {
    try {
      // 停止当前播放
      await this.stop();

      // 创建 HTML5 Audio（跨平台兼容方案）
      if (Platform.OS === 'web') {
        return new Promise((resolve, reject) => {
          const audio = new Audio(uri);
          audio.playbackRate = 0.85;
          audio.volume = 1.0;

          audio.onended = () => {
            isPlaying = false;
            resolve();
          };

          audio.onerror = (e) => {
            isPlaying = false;
            reject(new Error('Audio playback failed'));
          };

          audio.play().catch(e => {
            isPlaying = false;
            reject(e);
          });

          (currentPlayer as any) = audio;
        });
      } else {
        // Android/iOS 使用 expo-av 的简单方式
        const { Audio } = await import('expo-av');

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          {
            shouldPlay: true,
            rate: 0.85,
            shouldCorrectPitch: true,
            volume: 1.0,
          }
        );

        (currentPlayer as any) = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            isPlaying = false;
            sound.unloadAsync().catch(() => {});
          }
        });
      }
    } catch (error) {
      isPlaying = false;
      throw error;
    }
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
        onDone: () => {
          isPlaying = false;
          resolve();
        },
        onError: (error) => {
          isPlaying = false;
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
    isPlaying = false;

    if (currentPlayer) {
      try {
        if (Platform.OS === 'web') {
          const audio = currentPlayer as any;
          if (audio && audio.pause) {
            audio.pause();
            audio.currentTime = 0;
          }
        } else {
          const sound = currentPlayer as any;
          if (sound && sound.stopAsync) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        }
      } catch (e) {
        // 忽略错误
      }
      currentPlayer = null;
    }

    Speech.stop();
  },

  /**
   * 预加载音频（空实现，保持 API 兼容）
   */
  async preloadAll(): Promise<void> {
    // 新实现不需要预加载
    console.log('[Audio] Preload skipped (using on-demand loading)');
  },

  /**
   * 检查是否正在播放
   */
  async isSpeaking(): Promise<boolean> {
    if (isPlaying) return true;
    return Speech.isSpeakingAsync();
  },
};
