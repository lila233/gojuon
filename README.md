# 五十音记忆 (Gojūon Memory)

一个基于间隔重复算法（SRS）的日语五十音记忆应用，使用 Expo React Native 开发，支持 Android 和 Web 平台。

## 功能特性

- ✨ **智能记忆算法**：采用 SM-2 间隔重复算法（类似 Anki），科学高效
- 📚 **完整假名库**：包含 104 个假名（清音、浊音、半浊音、拗音）
- 🎨 **精美界面**：现代化设计，流畅卡片切换动画
- 🔊 **高质量发音**：使用 Google Cloud TTS 生成的 104 个日语发音文件
- 📊 **学习统计**：详细的学习数据和进度追踪
- ⚙️ **灵活设置**：可自定义学习模式、每日卡片数量等
- 💾 **数据备份**：Web 端直接下载/上传 JSON 文件，Android 端通过分享/剪贴板
- 🌓 **主题切换**：支持浅色/深色/跟随系统三种模式
- 🔔 **学习提醒**：可设置每日学习通知
- 🌐 **多平台支持**：Android APK + Web 版本

## 在线体验

- **Web 版本**：部署完成后会在此处更新链接

## 下载安装

- **Android APK**：在 [Releases](../../releases) 页面下载最新版本

## 技术栈

- **框架**：React Native 0.81 + Expo SDK 54
- **语言**：TypeScript
- **导航**：React Navigation (stack + bottom-tabs)
- **状态管理**：React Context API
- **存储**：AsyncStorage 本地存储
- **音频**：expo-av (本地 MP3) + expo-speech (TTS 备用)
- **构建**：EAS Build

## 快速开始

### 前置要求

- Node.js 18+
- npm
- Android 手机 + Expo Go 应用（开发用）

### 开发运行

```bash
# 进入项目目录
cd gojuon

# 安装依赖
npm install

# 启动开发服务器
npx expo start --port 8081

# 设置 ADB 端口转发（如果使用 USB 连接）
adb reverse tcp:8081 tcp:8081
```

在手机 Expo Go 中输入 `exp://127.0.0.1:8081` 连接。

### 构建发布

```bash
# 构建 Android APK
eas build --platform android --profile preview

# 构建 Web 版本
npx expo export --platform web
```

## 项目结构

```
gojuon/
├── App.tsx                 # 应用入口，导航配置
├── assets/audio/           # 104 个日语发音 MP3 文件
├── src/
│   ├── components/         # 可复用组件
│   ├── contexts/           # React Context (StudyContext, ThemeContext)
│   ├── data/               # 假名数据 + 音频映射
│   ├── screens/            # 页面组件
│   │   ├── HomeScreen      # 首页 - 学习进度和开始按钮
│   │   ├── StudyScreen     # 学习 - 卡片翻转和评分
│   │   ├── BrowseScreen    # 浏览 - 五十音图表
│   │   ├── StatsScreen     # 统计 - 学习数据
│   │   └── SettingsScreen  # 设置 - 主题/备份/通知
│   ├── storage/            # AsyncStorage 封装
│   ├── theme/              # 主题颜色定义
│   ├── types/              # TypeScript 类型
│   └── utils/              # 工具函数
│       ├── srs.ts          # SM-2 间隔重复算法
│       ├── audio.ts        # 音频播放服务
│       ├── backup.ts       # 数据备份服务
│       └── notifications.ts # 通知服务
├── dist/                   # Web 构建输出
└── eas.json                # EAS Build 配置
```

## 核心功能

### SM-2 间隔重复算法

- **5 级评分**：忘记(1) → 困难(2) → 一般(3) → 容易(4) → 完美(5)
- **动态间隔**：根据评分自动调整下次复习时间
  - 评分 1-2：重置进度，次日复习
  - 评分 3：缩短间隔 (×0.8)，更快复习
  - 评分 4：标准间隔递增
  - 评分 5：奖励更长间隔 (×1.3)
- **难度因子**：每张卡片有独立的难度权重（EF 最低 1.3）
- **间隔递进**：1天 → 6天 → round(interval × EF)

### 掌握判定标准

| 状态 | 条件 | 说明 |
|------|------|------|
| 新卡片 | 从未学习 | 等待首次学习 |
| 学习中 | repetitions < 2 | 刚开始学习或答错重置 |
| 复习中 | repetitions ≥ 2 | 有一定熟练度 |
| 已掌握 | repetitions ≥ 4 且 interval ≥ 14天 | 连续正确4次以上，间隔达到2周 |

### 音频系统

- 使用 Google Cloud TTS (Wavenet 日语女声) 预生成 104 个高质量发音文件
- 支持 TTS 实时合成作为备用方案
- 播放速度可调节 (0.85x)，发音更清晰

## 许可证

MIT License

---

**版本**: 1.3.0
