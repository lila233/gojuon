import fs from 'node:fs';
import path from 'node:path';

// Expo 的 web 导出会生成以根路径开头的资源引用（例如 `/_expo/...`）。
// GitHub Pages 通常部署在 `/<repo>` 子路径下，所以需要重写 `index.html` 的资源路径。
// 这个脚本用于本地预览时模拟 GH Pages 的路径修正，避免出现 404。

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const previewDir = path.join(repoRoot, 'gh-pages-preview', 'gojuon');
const appJsonPath = path.join(repoRoot, 'app.json');

if (!fs.existsSync(distDir)) {
  console.error('dist 不存在，请先运行: npx expo export --platform web');
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const rawBaseUrl = appJson?.expo?.web?.baseUrl ?? '';
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');

if (!normalizedBaseUrl || normalizedBaseUrl === '/') {
  console.error('未在 app.json 中检测到 expo.web.baseUrl，无法模拟 GH Pages 子路径。');
  process.exit(1);
}

const baseSegment = normalizedBaseUrl.replace(/^\//, '');

fs.rmSync(previewDir, { recursive: true, force: true });
fs.mkdirSync(previewDir, { recursive: true });

copyDir(distDir, previewDir);

const indexPath = path.join(previewDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const hrefRegex = new RegExp(`href=\"\\/(?!${escapeRegExp(baseSegment)}\\/)`, 'g');
const srcRegex = new RegExp(`src=\"\\/(?!${escapeRegExp(baseSegment)}\\/)`, 'g');

const patchedHtml = indexHtml
  .replace(hrefRegex, `href="${normalizedBaseUrl}/`)
  .replace(srcRegex, `src="${normalizedBaseUrl}/`);

fs.writeFileSync(indexPath, patchedHtml);

console.log('GH Pages 预览已生成：', previewDir);
console.log('请使用本地静态服务器访问该目录。');

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const srcPath = path.join(source, entry.name);
    const dstPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(srcPath);
      fs.symlinkSync(link, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
