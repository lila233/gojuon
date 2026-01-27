// 书道美学 - Shodō Aesthetics
// 灵感来自日本传统书法、和纸质感与墨的层次

export const lightTheme = {
  primary: '#2D2D2D', // 墨 - Sumi ink
  primaryDark: '#1A1A1A', // 濃墨 - Dense ink
  background: '#F5F1EB', // 和紙 - Washi paper
  card: '#FDFBF7', // 白和紙 - White washi
  text: '#1C1C1C', // 墨色 - Ink black
  textSecondary: '#5C5C5C', // 薄墨 - Diluted ink
  textTertiary: '#8C8C8C', // 淡墨 - Faint ink
  border: '#E0DCD4', // 紙の縁 - Paper edge
  success: '#4A7C59', // 松葉 - Pine needle
  warning: '#B8860B', // 金茶 - Golden brown
  error: '#8B4049', // 朱 - Vermilion
  info: '#4A6B8A', // 藍鼠 - Indigo gray
  purple: '#6B5B73', // 藤鼠 - Wisteria gray
  accent: '#C9A66B', // 金 - Gold accent
};

export const darkTheme = {
  primary: '#D4C5B0', // 生成り - Natural beige
  primaryDark: '#B8A78C', // 枯色 - Withered color
  background: '#1A1816', // 漆黒 - Lacquer black
  card: '#252220', // 墨色 - Charcoal
  text: '#E8E4DC', // 白練 - Off-white
  textSecondary: '#A09890', // 灰白 - Ash white
  textTertiary: '#6B6560', // 鼠 - Mouse gray
  border: '#3A3633', // 檜皮 - Cypress bark
  success: '#7BA788', // 若竹 - Young bamboo
  warning: '#D4A45A', // 黄金 - Gold
  error: '#C47070', // 紅梅 - Red plum
  info: '#7A9BB8', // 空色 - Sky blue
  purple: '#9A8BA8', // 藤 - Wisteria
  accent: '#D4A45A', // 金 - Gold accent
};

export type Theme = typeof lightTheme;
