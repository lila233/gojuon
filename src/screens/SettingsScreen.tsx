import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { storage } from '../storage';
import { useTheme } from '../contexts/ThemeContext';
import { useStudy } from '../contexts/StudyContext';
import { notificationService } from '../utils/notifications';
import { backupService, BackupStatus } from '../utils/backup';
import { Settings } from '../types';

export default function SettingsScreen() {
  const { theme, setThemeMode, themeMode, isDark } = useTheme();
  const { loadData, settings, updateSettings } = useStudy();
  const insets = useSafeAreaInsets();
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle');
  const [showNumberPicker, setShowNumberPicker] = useState<'dailyNewCards' | 'dailyReviews' | null>(null);
  const kanaScope = settings.kanaScope ?? 'all';

  const numberPickerOptions = {
    dailyNewCards: { title: '每日新卡片', options: [3, 5, 10, 15, 20, 30, 999] },
    dailyReviews: { title: '每日复习上限', options: [10, 20, 30, 50, 100, 999] },
  };

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    await updateSettings({ [key]: value } as Partial<Settings>);
  };

  const setKanaScope = async (scope: Settings['kanaScope']) => {
    await updateSettings({ kanaScope: scope });
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await notificationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert('权限被拒绝', '请在系统设置中允许通知权限');
        return;
      }
      const time = settings.notificationTime || { hour: 20, minute: 0 };
      await notificationService.scheduleDailyReminder(time.hour, time.minute);
      Alert.alert('成功', `已设置每日 ${time.hour}:${time.minute.toString().padStart(2, '0')} 的学习提醒`);
    } else {
      await notificationService.cancelAllReminders();
    }
    updateSetting('notificationsEnabled', enabled);
  };

  const handleExportData = async () => {
    setBackupStatus('processing');
    try {
      const data = await backupService.exportData();
      const json = backupService.getExportJson(data);

      if (Platform.OS === 'web') {
        // Web 平台：直接下载文件
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gojuon-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // 原生平台：使用分享
        await Share.share({
          message: json,
          title: '五十音记忆数据备份',
        });
      }

      setBackupStatus('success');
      updateSetting('lastBackupTime', Date.now());
      setTimeout(() => setBackupStatus('idle'), 2000);
    } catch (error) {
      setBackupStatus('error');
      Alert.alert('导出失败', '无法导出数据，请重试');
      setTimeout(() => setBackupStatus('idle'), 2000);
    }
  };

  const handleImportData = async () => {
    if (Platform.OS === 'web') {
      // Web 平台：使用文件选择器
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          setBackupStatus('processing');
          const text = await file.text();
          const data = backupService.parseImportJson(text);

          if (!data) {
            setBackupStatus('error');
            window.alert('无效的数据格式，请确保选择的是有效的备份 JSON 文件');
            setTimeout(() => setBackupStatus('idle'), 2000);
            return;
          }

          const result = await backupService.importData(data);
          if (result.success) {
            setBackupStatus('success');
            window.alert('导入成功！');
            await loadData();
          } else {
            setBackupStatus('error');
            window.alert('导入失败：' + result.message);
          }
          setTimeout(() => setBackupStatus('idle'), 2000);
        } catch (error) {
          setBackupStatus('error');
          window.alert('导入失败：无法读取文件');
          setTimeout(() => setBackupStatus('idle'), 2000);
        }
      };
      input.click();
    } else {
      // 原生平台：使用 Alert 从剪贴板导入
      Alert.alert(
        '导入数据',
        '请将备份的 JSON 数据粘贴到剪贴板，然后点击确定导入。\n\n注意：导入会与现有数据合并，不会覆盖。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '从剪贴板导入',
            onPress: async () => {
              try {
                const clipboardContent = await Clipboard.getStringAsync();
                if (!clipboardContent) {
                  Alert.alert('错误', '剪贴板为空');
                  return;
                }
                const data = backupService.parseImportJson(clipboardContent);
                if (!data) {
                  Alert.alert('错误', '无效的数据格式');
                  return;
                }
                setBackupStatus('processing');
                const result = await backupService.importData(data);
                if (result.success) {
                  setBackupStatus('success');
                  Alert.alert('成功', result.message);
                  await loadData();
                } else {
                  setBackupStatus('error');
                  Alert.alert('导入失败', result.message);
                }
                setTimeout(() => setBackupStatus('idle'), 2000);
              } catch (error) {
                setBackupStatus('error');
                Alert.alert('导入失败', '无法读取剪贴板数据');
                setTimeout(() => setBackupStatus('idle'), 2000);
              }
            },
          },
        ]
      );
    }
  };

  const executeReset = async () => {
    try {
      await storage.clearAll();
      await loadData();
      Alert.alert('重置成功', '应用数据已恢复初始状态。');
    } catch (e) {
      Alert.alert('重置失败', '发生未知错误');
    }
  };

  const handleReset = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('危险操作警告\n\n确定要重置所有学习数据吗？此操作不可恢复，您的所有学习进度都将丢失。');
      if (confirmed) {
        executeReset();
      }
    } else {
      Alert.alert(
        '危险操作警告',
        '确定要重置所有学习数据吗？此操作不可恢复，您的所有学习进度都将丢失。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定重置',
            style: 'destructive',
            onPress: executeReset,
          },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>

        {/* 标题 */}
        <View style={styles.headerSection}>
          <Text style={[styles.titleMain, { color: theme.text }]}>設定</Text>
          <View style={[styles.titleLine, { backgroundColor: theme.text }]} />
          <Text style={[styles.titleSub, { color: theme.textSecondary }]}>
            Settings
          </Text>
        </View>

        {/* 外观设置 */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            外観
          </Text>

          <View style={styles.optionGroup}>
            <OptionButton
              label="浅色"
              selected={themeMode === 'light'}
              onPress={() => setThemeMode('light')}
              theme={theme}
            />
            <OptionButton
              label="深色"
              selected={themeMode === 'dark'}
              onPress={() => setThemeMode('dark')}
              theme={theme}
            />
            <OptionButton
              label="跟随系统"
              selected={themeMode === 'auto'}
              onPress={() => setThemeMode('auto')}
              theme={theme}
            />
          </View>
        </View>

        {/* 学习设置 */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            学習設定
          </Text>

          <SettingRow
            label="每日新卡片"
            value={settings.dailyNewCards === 999 ? '无限' : settings.dailyNewCards.toString()}
            onPress={() => setShowNumberPicker('dailyNewCards')}
            theme={theme}
          />
          <SettingRow
            label="每日复习上限"
            value={settings.dailyReviews === 999 ? '无限' : settings.dailyReviews.toString()}
            onPress={() => setShowNumberPicker('dailyReviews')}
            theme={theme}
          />

          <SettingToggle
            label="显示罗马音"
            value={settings.showRomaji}
            onValueChange={(value) => updateSetting('showRomaji', value)}
            theme={theme}
          />
          <SettingToggle
            label="卡片乱序学习"
            value={settings.shuffleCards ?? true}
            onValueChange={(value) => updateSetting('shuffleCards', value)}
            theme={theme}
          />
          <SettingToggle
            label="每日学习提醒"
            value={settings.notificationsEnabled || false}
            onValueChange={toggleNotifications}
            theme={theme}
          />

          {settings.notificationsEnabled && (
            <View style={[styles.infoNote, { borderLeftColor: theme.textTertiary }]}>
              <Text style={[styles.infoNoteText, { color: theme.textSecondary }]}>
                提醒时间：每天 {settings.notificationTime?.hour || 20}:{(settings.notificationTime?.minute || 0).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>

        {/* 假名范围 */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            仮名範囲
          </Text>

          <View style={styles.optionGroup}>
            <OptionButton
              label="全部假名"
              selected={kanaScope === 'all'}
              onPress={() => setKanaScope('all')}
              theme={theme}
            />
            <OptionButton
              label="仅清音"
              selected={kanaScope === 'seion'}
              onPress={() => setKanaScope('seion')}
              theme={theme}
            />
          </View>
        </View>

        {/* 数据备份 */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              数据備份
            </Text>
            {backupStatus === 'processing' && (
              <ActivityIndicator size="small" color={theme.primary} />
            )}
            {backupStatus === 'success' && (
              <Text style={[styles.statusIcon, { color: theme.success }]}>done</Text>
            )}
          </View>

          {settings.lastBackupTime && (
            <Text style={[styles.lastSync, { color: theme.textTertiary }]}>
              上次备份: {backupService.formatBackupTime(settings.lastBackupTime)}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: theme.border }]}
              onPress={handleExportData}
              disabled={backupStatus === 'processing'}
            >
              <Text style={[styles.outlineButtonText, { color: theme.text }]}>导出</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: theme.border }]}
              onPress={handleImportData}
              disabled={backupStatus === 'processing'}
            >
              <Text style={[styles.outlineButtonText, { color: theme.text }]}>导入</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 危险操作 */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            危険操作
          </Text>

          <TouchableOpacity
            style={[styles.dangerButton, { borderColor: theme.error }]}
            onPress={handleReset}
          >
            <Text style={[styles.dangerButtonText, { color: theme.error }]}>
              重置所有数据
            </Text>
          </TouchableOpacity>
        </View>

        {/* 页脚 */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textTertiary }]}>
            五十音記憶 v1.2.0
          </Text>
          <Text style={[styles.footerHint, { color: theme.textTertiary }]}>
            使用间隔重复算法帮助你高效记忆日语假名
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </View>

      {/* 数字选择器 */}
      <Modal
        visible={showNumberPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNumberPicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {showNumberPicker ? numberPickerOptions[showNumberPicker].title : ''}
            </Text>

            <View style={styles.modalOptions}>
              {showNumberPicker && numberPickerOptions[showNumberPicker].options.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.modalOption,
                    { borderColor: theme.border },
                    settings[showNumberPicker] === num && {
                      borderColor: theme.primary,
                      backgroundColor: isDark ? 'rgba(212,197,176,0.1)' : 'rgba(45,45,45,0.05)'
                    },
                  ]}
                  onPress={() => {
                    updateSetting(showNumberPicker, num);
                    setShowNumberPicker(null);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      { color: theme.textSecondary },
                      settings[showNumberPicker] === num && { color: theme.text },
                    ]}
                  >
                    {num === 999 ? '无限制' : num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowNumberPicker(null)}
            >
              <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function OptionButton({ label, selected, onPress, theme }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.optionButton,
        { borderColor: theme.border },
        selected && { borderColor: theme.text, backgroundColor: 'rgba(0,0,0,0.03)' },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.optionButtonText,
          { color: theme.textSecondary },
          selected && { color: theme.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SettingRow({ label, value, onPress, theme }: {
  label: string;
  value: string;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: theme.border }]}
      onPress={onPress}
    >
      <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.settingRight}>
        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>{value}</Text>
        <Text style={[styles.settingArrow, { color: theme.textTertiary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function SettingToggle({ label, value, onValueChange, theme }: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  theme: any;
}) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#fff"
      />
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

  // 区块
  section: {
    paddingVertical: 24,
    borderTopWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: 16,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: '500',
  },

  // 选项组
  optionGroup: {
    gap: 10,
  },
  optionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 2,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },

  // 设置行
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '400',
    marginRight: 8,
  },
  settingArrow: {
    fontSize: 20,
    fontWeight: '300',
  },

  // 信息提示
  infoNote: {
    marginTop: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
  },
  infoNoteText: {
    fontSize: 12,
    fontWeight: '400',
  },

  // 上次同步
  lastSync: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 16,
    marginTop: -8,
  },

  // 按钮行
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  outlineButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 1,
  },

  // 危险按钮
  dangerButton: {
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '400',
  },

  // 页脚
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 8,
  },
  footerHint: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },

  // 模态框
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 2,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 2,
  },
  modalOptions: {
    gap: 8,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '400',
  },
  modalClose: {
    marginTop: 20,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '400',
  },
});
