import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { Kana } from '../types';
import { audioFiles } from '../data/audioMap';

// 获取 baseUrl（用于 GitHub Pages 等子路径部署）
const rawBaseUrl = Constants.expoConfig?.web?.baseUrl || '';
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
const effectiveBaseUrl = resolveBaseUrl();

function withBaseUrl(uri: string): string {
  if (!effectiveBaseUrl || !uri.startsWith('/')) return uri;
  return `${effectiveBaseUrl}${uri}`;
}

function resolveBaseUrl(): string {
  if (Platform.OS !== 'web') return '';
  if (!normalizedBaseUrl) return '';
  if (typeof window === 'undefined') return normalizedBaseUrl;

  const path = window.location.pathname || '';
  if (path === normalizedBaseUrl || path.startsWith(`${normalizedBaseUrl}/`)) {
    return normalizedBaseUrl;
  }

  // 当部署在根路径时，不应用 baseUrl
  return '';
}

/**
 * 获取音频源 URI
 */
function getAudioUri(kanaId: string): string | null {
  const moduleRef = audioFiles[kanaId];
  if (!moduleRef) return null;

  if (Platform.OS === 'web') {
    // Web 平台统一使用 Asset 解析后的 URI
    const asset = Asset.fromModule(moduleRef);
    const uri = asset.uri;
    console.log('[Audio] Web Asset URI:', uri);
    return withBaseUrl(uri);
  }

  // Native 平台使用 Asset
  const asset = Asset.fromModule(moduleRef);
  return asset.localUri || asset.uri;
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
    console.log('[Audio] Playing kana:', kana.id, 'URI:', audioUri);

    if (audioUri) {
      try {
        isPlaying = true;
        await this.playAudio(audioUri);
      } catch (error) {
        console.error('[Audio] Local audio failed:', error);
        isPlaying = false;
      }
    } else {
      console.error('[Audio] No audio file found for kana:', kana.id);
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
          console.log('[Audio] Creating HTML5 Audio with URI:', uri);
          const audio = new Audio(uri);
          audio.playbackRate = 0.85;
          audio.volume = 1.0;

          audio.onended = () => {
            isPlaying = false;
            resolve();
          };

          audio.onerror = (e) => {
            isPlaying = false;
            console.error('[Audio] HTML5 Audio error event:', e, 'src:', audio.src, 'error:', audio.error);
            reject(new Error(`Audio playback failed: ${audio.error?.message || 'unknown'}`));
          };

          audio.oncanplaythrough = () => {
            console.log('[Audio] Audio can play through');
          };

          audio.play().catch(e => {
            isPlaying = false;
            console.error('[Audio] play() rejected:', e);
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
    return isPlaying;
  },
};
