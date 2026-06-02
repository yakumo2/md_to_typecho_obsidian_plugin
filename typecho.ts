import axios from 'axios';
import { getSetting, getCategories } from './config.js';
import { Notice } from 'obsidian';

// ─── Typecho RESTful API types ────────────────────────────────────

interface TypechoApiResponse<T = any> {
	status: 'success' | 'error';
	message: string;
	data: T;
}

interface TypechoPost {
	cid: number;
	title: string;
	slug: string;
	text: string; // rendered HTML
	permalink: string;
	type: 'post' | 'page';
	status?: 'publish' | 'draft' | 'private';
	password?: string;
	authorId?: number;
	created?: number;
	modified?: number;
}

interface TypechoCategory {
	mid: number;
	name: string;
	slug: string;
	type: string;
	description: string;
	count: number;
	order: number;
	parent: number;
	permalink: string;
}

interface TypechoTag {
	mid: number;
	name: string;
	slug: string;
	type: string;
	description: string;
	count: number;
	permalink: string;
}

// ─── API helpers ──────────────────────────────────────────────────

function apiHeaders() {
	return {
		'Content-Type': 'application/json',
		// Typecho RESTful 插件使用自定义 token header，不是 Authorization
		'token': getSetting('TYPECHO_TOKEN'),
	};
}

function apiUrl(path: string) {
	const base = getSetting('TYPECHO_BASEURL').replace(/\/$/, '');
	const p = path.startsWith('/') ? path : '/' + path;
	return `${base}${p}`;
}

// ─── Post operations ──────────────────────────────────────────────

/** Create or update a post, returns cid on success, null on failure */
export async function createPost(
	title: string,
	markdown: string,
	tags: string[],
	status: 'publish' | 'draft' = 'publish',
): Promise<number | null> {
	const headers = apiHeaders();
	const categories = getCategories();
	const authorId = parseInt(getSetting('TYPECHO_UID')) || 1;

	// Typecho RESTful 创建/更新走同一个端点 POST /api/post/create
	// text 必须以 <!--markdown--> 开头才能触发 Markdown 渲染
	const payload: Record<string, any> = {
		title,
		text: '<!--markdown-->' + markdown,
		authorId,
		status,
	};

	// 如果有分类（mid），则传递
	if (categories.length > 0) {
		payload.mid = categories.join(',');
	}

	try {
		const response = await axios.post<TypechoApiResponse<number>>(
			apiUrl('/api/post/create'),
			payload,
			{ headers },
		);
		if (response.data?.status === 'success') {
			const cid = response.data?.data;
			new Notice('文章创建成功！', 5000);
			return cid;
		}
		new Notice(`文章创建失败: ${response.data?.message || '未知错误'}`, 5000);
		return null;
	} catch (error: any) {
		const msg = error?.response?.data?.message || error?.message || '未知错误';
		console.error('创建文章失败:', error);
		new Notice(`文章创建失败: ${msg}`, 5000);
		return null;
	}
}

/** Update an existing post by cid */
export async function updatePost(
	cid: number,
	title: string,
	markdown: string,
	status: 'publish' | 'draft' = 'publish',
): Promise<boolean> {
	const headers = apiHeaders();
	const authorId = parseInt(getSetting('TYPECHO_UID')) || 1;

	const payload = {
		cid,
		title,
		text: '<!--markdown-->' + markdown,
		authorId,
		status,
	};

	try {
		const response = await axios.post<TypechoApiResponse<number>>(
			apiUrl('/api/post/create'),
			payload,
			{ headers },
		);
		if (response.data?.status === 'success') {
			new Notice('文章更新成功！', 5000);
			return true;
		}
		new Notice(`文章更新失败: ${response.data?.message || '未知错误'}`, 5000);
		return false;
	} catch (error: any) {
		const msg = error?.response?.data?.message || error?.message || '未知错误';
		console.error('更新文章失败:', error);
		new Notice(`文章更新失败: ${msg}`, 5000);
		return false;
	}
}

// ─── Image upload ─────────────────────────────────────────────────

/**
 * 上传图片到 Typecho
 *
 * Typecho RESTful 插件没有提供图片上传端点。
 * 这里通过 Typecho 内置的 action/upload 接口上传，
 * 需要先进行 Cookie 认证（通过 curl 模拟登录）
 *
 * 当前简化实现：将图片复制到 usr/uploads/ 目录
 * 完整实现需要走 Typecho 的 Cookie 认证流程
 */
export async function uploadImage(
	_app: any,
	_filePath: string,
): Promise<string | null> {
	// 暂未实现。需要方案：
	// 方案 A: PHP 后端 proxy，由服务端从 Obsidian 拉取图片后放入 usr/uploads/
	// 方案 B: 在 Obsidian 端用 cookie 登录后 multipart POST 到 /index.php/action/upload
	// 方案 C: 通过 WebDAV/SSH 直接写入 usr/uploads/ 目录
	new Notice('图片上传暂未实现，将保留本地路径', 3000);
	return null;
}

// ─── Category operations ──────────────────────────────────────────

/** Get all categories with their mid */
export async function getCategories_list(): Promise<TypechoCategory[]> {
	const headers = apiHeaders();
	try {
		const response = await axios.get<TypechoApiResponse<TypechoCategory[]>>(
			apiUrl('/api/category'),
			{ headers },
		);
		if (response.data?.status === 'success') {
			return response.data.data;
		}
		return [];
	} catch (error) {
		console.error('获取分类失败:', error);
		return [];
	}
}

/** Get all tags */
export async function getTags(): Promise<TypechoTag[]> {
	const headers = apiHeaders();
	try {
		const response = await axios.get<TypechoApiResponse<TypechoTag[]>>(
			apiUrl('/api/tag'),
			{ headers },
		);
		if (response.data?.status === 'success') {
			return response.data.data;
		}
		return [];
	} catch (error) {
		console.error('获取标签失败:', error);
		return [];
	}
}

// ─── Image processing ─────────────────────────────────────────────

/**
 * 处理 Markdown 中的图片：上传本地图片，替换为远程 URL。
 * 返回处理后的 Markdown 内容。
 */
async function processImages(mdContent: string, mdPath: string, app: any): Promise<string> {
	const imagePattern = /!\[(.*?)\]\((.*?)\)/g;
	let match;
	let result = mdContent;

	while ((match = imagePattern.exec(mdContent)) !== null) {
		const fullMatch = match[0];
		const altText = match[1];
		let imgUrl = match[2];

		// Skip remote images
		if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
			continue;
		}

		// Resolve local path
		if (imgUrl.startsWith('./')) {
			imgUrl = imgUrl.slice(2);
		}

		const folderPath = mdPath.includes('/')
			? mdPath.split('/').slice(0, -1).join('/') + '/'
			: '';

		const imagePath = `${folderPath}${imgUrl}`;
		const uploadedUrl = await uploadImage(app, imagePath);

		if (uploadedUrl) {
			result = result.replace(fullMatch, `![${altText}](${uploadedUrl})`);
		}
	}

	return result;
}

// ─── Main publish logic ───────────────────────────────────────────

/**
 * 主入口：将 Obsidian 中的 Markdown 文件发布到 Typecho。
 */
export async function post_md(mdPath: string, app: any): Promise<void> {
	new Notice('开始发布文章到 Typecho...', 5000);

	const mdContent = await app.vault.adapter.read(mdPath);

	// Parse frontmatter
	let title = mdPath.split('/').pop()?.replace('.md', '') || '';
	let tags: string[] = [];
	let cid: number | null = null;
	let status: 'publish' | 'draft' = getSetting('TYPECHO_DRAFT') ? 'draft' : 'publish';

	const frontmatterMatch = mdContent.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const yaml = frontmatterMatch[1];

		const titleMatch = yaml.match(/^title:\s*(.*)$/m);
		if (titleMatch) title = titleMatch[1].trim().replace(/^["']|["']$/g, '');

		const tagsMatch = yaml.match(/^tags:\s*\n(?:\s*-\s*.*\n?)+/m);
		if (tagsMatch) {
			tags = tagsMatch[0]
				.split('\n')
				.filter((line: string) => line.trim().startsWith('-'))
				.map((tag: string) => tag.trim().slice(2).trim().replace(/^["']|["']$/g, ''));
		}

		const cidMatch = yaml.match(/^typecho_cid:\s*(\d+)/m);
		if (cidMatch) cid = parseInt(cidMatch[1]);

		const statusMatch = yaml.match(/^status:\s*(publish|draft|private)/m);
		if (statusMatch) status = statusMatch[1] as 'publish' | 'draft';

		const draftMatch = yaml.match(/^draft:\s*(true|false)/m);
		if (draftMatch && draftMatch[1] === 'true') status = 'draft';
	}

	// Extract body (without frontmatter)
	const body = frontmatterMatch
		? mdContent.slice(frontmatterMatch[0].length).trim()
		: mdContent.trim();

	// Process images: upload local ones and replace URLs
	const processedBody = await processImages(body, mdPath, app);

	if (cid) {
		// ── Update existing post ──
		const success = await updatePost(cid, title, processedBody, status);
		if (success) {
			new Notice('文章发布成功！', 5000);
		}
	} else {
		// ── Create new post ──
		const newCid = await createPost(title, processedBody, tags, status);
		if (newCid) {
			// Write typecho_cid back to frontmatter
			const originalContent = await app.vault.adapter.read(mdPath);
			let updatedContent: string;

			if (frontmatterMatch) {
				const existingYaml = frontmatterMatch[1];
				if (!existingYaml.includes('typecho_cid:')) {
					const newYaml = existingYaml + `\ntypecho_cid: ${newCid}`;
					updatedContent = `---\n${newYaml}\n---${originalContent.slice(frontmatterMatch[0].length)}`;
				} else {
					updatedContent = originalContent;
				}
			} else {
				const newFrontmatter = `---\ntitle: ${title}\ntypecho_cid: ${newCid}\ntags: []\n---\n`;
				updatedContent = newFrontmatter + originalContent;
			}

			await app.vault.adapter.write(mdPath, updatedContent);
			new Notice('文章发布成功！', 5000);
		}
	}
}
