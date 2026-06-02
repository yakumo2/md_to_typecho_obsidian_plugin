# md-to-typecho

从 Obsidian 发布 Markdown 文章到 Typecho 博客的插件。

## 特点

- 🎯 **原生 Markdown 支持** — 无需 HTML 转换，直接以 Markdown 格式发布
- 🖼️ **图片自动上传** — 本地图片自动上传到 Typecho，远程图片保留原链接
- 🏷️ **Frontmatter 支持** — 自动读取标题、标签、分类
- 🔄 **增量更新** — 首次发布后写入 `typecho_cid`，后续更新同一文章
- 📝 **草稿模式** — 支持发布为草稿，支持命令和设置两种方式切换

## 安装

### BRAT 安装（推荐）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 在 BRAT 设置中添加 Beta Plugin：`yakumo2/md_to_typecho_obsidian_plugin`
3. 启用插件

### 手动安装

从 [GitHub Release](https://github.com/yakumo2/md_to_typecho_obsidian_plugin/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放入 `.obsidian/plugins/md-to-typecho/` 目录。

## 使用

### 设置

1. 打开插件设置
2. 填写 Typecho 站点地址（如 `https://blog.example.com`）
3. 填写 RESTful 插件的 API Token
4. 设置用户 ID（默认 1）
5. 设置默认分类（可选，逗号分隔）

### 发布

- 点击左侧栏的云上传图标
- 或使用命令面板：`发布当前笔记到 Typecho`
- 草稿发布：`发布当前笔记到 Typecho（草稿）`

### Frontmatter

文章支持以下 Frontmatter 字段：

```yaml
---
title: 文章标题
tags:
  - 标签1
  - 标签2
typecho_cid: 123  # 自动写入，用于更新
status: publish   # publish / draft / private
draft: true       # 快捷草稿标记
---
```

## 前置要求

- Typecho 博客
- [Typecho RESTful 插件](https://github.com/typecho-fans/plugins/tree/master/Restful) 已安装并启用

## 对比 md-to-halo

| | md-to-halo | md-to-typecho |
|---|---|---|
| 博客引擎 | Halo (Java) | Typecho (PHP) |
| 服务器内存 | 800MB+ | ~50MB |
| 文章格式 | HTML（需转换） | Markdown（原生） |
| 图片上传 | EasyImage2（独立） | Typecho 内置 |
| 依赖 | axios, markdown-it, js-yaml | axios |

## 许可

MIT
