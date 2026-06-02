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

- [Typecho](https://typecho.org/) 博客（v1.2.1+）
- [RESTful 插件](https://github.com/typecho-fans/plugins/tree/master/Restful) 已安装并启用

## 本地开发环境搭建（Docker）

```bash
# 从本地构建
docker compose up -d

# 在构建目录下需要：
# - Dockerfile
# - docker-compose.yml
# - typecho.zip（v1.2.1 Release zip）
# - usr/plugins/Restful/（插件目录）
```

## Typecho RESTful API 文档

### 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/posts` | 文章列表 |
| GET | `/api/post/{id}` | 单篇文章 |
| POST | `/api/post/create` | 创建/更新文章 |
| GET | `/api/category` | 分类列表 |
| GET | `/api/tag` | 标签列表 |
| GET | `/api/pages` | 独立页面列表 |

### 认证

所有请求需要携带 `token` HTTP Header：

```
token: your-api-token
```

**注意：** 不是 `Authorization: Bearer xxx`，而是自定义 `token` Header。

### 创建文章

```
POST /api/post/create
Content-Type: application/json
token: your-api-token

{
  "title": "文章标题",
  "text": "Markdown 正文内容...",
  "authorId": 1,
  "slug": "optional-slug",
  "mid": "1,2"        // 分类 ID，逗号分隔（可选）
}
```

响应：
```json
{"status":"success","message":"","data": 3}
```
返回值为文章的 `cid`。

### Markdown 渲染

**关键细节：** Typecho 检测 Markdown 的方式是检查文章 `text` 字段是否以 `<!--markdown-->` 注释开头。因此调用 API 创建文章时，必须给 `text` 加此前缀：

```
'<!--markdown-->' + markdownContent
```

不加的话文章正文会以 Markdown 源码形式直接输出（`##`、`![img]` 等不渲染）。

### 图片上传

Typecho RESTful 插件没有提供图片上传端点。上传图片需要通过 Typecho 内部机制实现。在插件层面，有两种方式：

#### 方案 A：通过 PHP CLI 在服务器端上传（推荐用于开发测试）

1. 在服务器上直接复制图片到 `usr/uploads/{YEAR}/{MONTH}/` 目录
2. 构造 URL：`{siteUrl}/usr/uploads/{YEAR}/{MONTH}/{filename}`

```php
$targetPath = '/var/www/html/usr/uploads/' . date('Y/m') . '/' . $filename;
copy($sourcePath, $targetPath);
$url = Typecho\Common::url('usr/uploads/' . date('Y/m') . '/' . $filename, $options->siteUrl);
```

#### 方案 B：从 Obsidian 插件直接上传（推荐用于生产环境）

插件通过 Typecho 的 PHP Session 认证后（`/index.php/action/upload` multipart POST），但 Typecho 有 CSRF 保护，需要先获取 security token。

### 路由配置

RESTful 插件依赖 Typecho 的 URL 重写（Rewrite）功能。

需要配置 Apache：
```
# .htaccess
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [L]
```

并在 Apache 配置中启用 `AllowOverride All`：
```
<Directory /var/www/html>
    AllowOverride All
</Directory>
```

### Typecho 内部机制（插件开发参考）

| 机制 | 说明 |
|------|------|
| 插件激活 | 通过 DB 的 `plugins` 选项存储 `['activated' => [...], 'handles' => [...]]` |
| 路由表 | `routingTable` 选项，包含所有路由配置，每个路由需包含 `url`、`widget`、`action`、`regx`、`format`、`params` |
| 自动加载 | 带 `_` 的类名（如 `Restful_Action`）自动按插件模式从 `usr/plugins/{Name}/Action.php` 加载 |
| 数据表 | `typecho_contents` 的 `markdown` 列在 v1.2.1 **不存在**，由 `<!--markdown-->` 前缀控制渲染 |
| 会话认证 | 使用 Typecho 自有的 Cookie 机制（非 PHP Session），Cookie 前缀为 `md5(siteUrl)` |
| Widget 调度 | Router::dispatch() 匹配路由后调用 `Widget::widget()` 创建实例，然后调用 `$widget->{$action}()` |

## RESTful 插件已知问题

1. **`__call` 魔术方法缺失**（已修复）：Typecho 1.2.1 的 Router::dispatch 会调用 `$widget->posts()` 而非 `$widget->postsAction()`，需要在 `Action.php` 中手动添加 `__call` 方法转发。
2. **`<!--markdown-->` 前缀缺失**（已修复）：创建文章时不加此前缀会导致 Markdown 源码直接输出。
3. **`hash_hmac` Deprecated 警告**（已修复）：`hash_hmac("sha256", $data, null)` 中的 `null` 需要改为 `""`。
4. **路由注册依赖插件激活流程**：直接写 DB 跳过 `activate()` 会导致路由表不完整，需要在路由条目中加入 `regx` 编译后的正则。

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
