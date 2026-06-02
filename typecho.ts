import axios from 'axios';
import { getSetting, getCategories } from './config.js';
import { Notice } from 'obsidian';

// ─── Typecho RESTful API types ────────────────────────────────────

interface TypechoPost {
	cid: number;
	title: string;
	slug: string;
	created: number;
	modified: number;
	text: string;
	order: number;
	authorId: number;
	template: string;
	type: 'post' | 'page';
	status: 'publish' | 'draft' | 'private';
	password: string;
	commentsNum: number;
	allowComment: number;
	allowPing: number;
	allowFeed: number;
	parent: number;
	uid: number;
	// After API call, categories and tags may be attached
	categoryIds?: string[];
	tags?: string[];
}

interface TypechoCategory {
	mid: number;
	name: string;
	slug: string;
	description: string;
	count: number;
	order: number;
	parent: number;
}

interface TypechoTag {
	mid: number;
	name: string;
	slug: string;
	description: string;
	count: number;
	order: number;
	parent: number;
}

interface CreatePostPayload {
	title: string;
	slug: string;
	markdown: string;       // Typecho RESTful accepts markdown directly
	text: string;           // Should be same as markdown since Typecho parses it
	category: string[];     // Category names
	tags: string[];         // Tag names
	authorId: number;
	status: 'publish' | 'draft' | 'private';
	allowComment: number;
	allowPing: number;
	allowFeed: number;
}

// ─── API helpers ──────────────────────────────────────────────────

function apiHeaders() {
	return {
		'Content-Type': 'application/json',
		// Typecho RESTful uses Basic Auth or token in header
		'Authorization': `Bearer ${getSetting('TYPECHO_TOKEN')}`,
	};
}

function apiUrl(path: string) {
	const base = getSetting('TYPECHO_BASEURL').replace(/\/$/, '');
	const p = path.startsWith('/') ? path : '/' + path;
	return `${base}${p}`;
}

// ─── Post operations ──────────────────────────────────────────────

/** Create a new post, returns cid on success, null on failure */
export async function createPost(
	title: string,
	markdown: string,
	tags: string[],
	status: 'publish' | 'draft' = 'publish'
): Promise<number | null> {
	const headers = apiHeaders();
	const categories = getCategories();
	const authorId = parseInt(getSetting('TYPECHO_UID')) || 1;
	const slug = `post-${Date.now()}`;

	const payload: CreatePostPayload = {
		title,
		slug,
		markdown,
		text: markdown,            // Typecho uses markdown as text
		category: categories,
		tags,
		authorId,
		status,
		allowComment: 1,
		allowPing: 1,
		allowFeed: 1,
	};

	try {
		const response = await axios.post(
			apiUrl('/api/v1/post'),
			payload,
			{ headers }
		);
		if (response.status === 200 || response.status === 201) {
			const cid = response.data?.cid || response.data?.data?.cid;
			new Notice('文章创建成功！', 5000);
			return cid;
		}
		new Notice(`文章创建失败，状态码：${response.status}`, 5000);
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
	tags: string[],
	status: 'publish' | 'draft' = 'publish'
): Promise<boolean> {
	const headers = apiHeaders();
	const categories = getCategories();

	const payload = {
		title,
		markdown,
		text: markdown,
		category: categories,
		tags,
		status,
	};

	try {
		const response = await axios.put(
			apiUrl(`/api/v1/post/${cid}`),
			payload,
			{ headers }
		);
		if (response.status === 200) {
			new Notice('文章更新成功！', 5000);
			return true;
		}
		new Notice(`文章更新失败，状态码：${response.status}`, 5000);
		return false;
	} catch (error: any) {
		const msg = error?.response?.data?.message || error?.message || '未知错误';
		console.error('更新文章失败:', error);
		new Notice(`文章更新失败: ${msg}`, 5000);
		return false;
	}
}

// ─── Image upload ─────────────────────────────────────────────────

/** Upload image to Typecho's built-in upload API, returns URL on success */
export async function uploadImage(
	app: any,
	filePath: string
): Promise<string | null> {
	const headers = {
		'Authorization': `Bearer ${getSetting('TYPECHO_TOKEN')}`,
	};

	try {
		const fileBuffer = await app.vault.adapter.readBinary(filePath);
		const fileName = filePath.split('/').pop() || 'image.png';

		const formData = new FormData();
		const blob = new Blob([fileBuffer], { type: 'image/png' });
		formData.append('file', blob, fileName);

		const response = await axios.post(
			apiUrl('/api/v1/upload'),
			formData,
			{ headers }
		);

		if (response.status === 200) {
			// Typecho upload API typically returns { url: "..." } or { data: { url: "..." } }
			return response.data?.url || response.data?.data?.url || null;
		}
		console.error('图片上传失败，状态码:', response.status);
		return null;
	} catch (error: any) {
		console.error('图片上传失败:', error);
		return null;
	}
}

// ─── Category operations ──────────────────────────────────────────

/** Get all categories */
export async function getCategories_list(): Promise<TypechoCategory[]> {
	const headers = apiHeaders();
	try {
		const response = await axios.get(
			apiUrl('/api/v1/category'),
			{ headers }
		);
		if (response.status === 200) {
			return response.data?.data || response.data || [];
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
		const response = await axios.get(
			apiUrl('/api/v1/tag'),
			{ headers }
		);
		if (response.status === 200) {
			return response.data?.data || response.data || [];
		}
		return [];
	} catch (error) {
		console.error('获取标签失败:', error);
		return [];
	}
}

// ─── Main publish logic ───────────────────────────────────────────

/**
 * Process images in markdown content: upload local images and replace their URLs.
 * Returns the modified markdown content.
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
			// Replace the local path with the uploaded URL
			result = result.replace(fullMatch, `![${altText}](${uploadedUrl})`);
		}
	}

	return result;
}

/**
 * Main entry: publish a markdown file from Obsidian vault to Typecho.
 */
export async function post_md(mdPath: string, app: any): Promise<void> {
	new Notice('开始发布文章到 Typecho...', 5000);

	const mdContent = await app.vault.adapter.read(mdPath);

	// Parse frontmatter using Obsidian's built-in API
	let title = mdPath.split('/').pop()?.replace('.md', '') || '';
	let tags: string[] = [];
	let cid: number | null = null;
	let status: 'publish' | 'draft' = getSetting('TYPECHO_DRAFT') ? 'draft' : 'publish';

	// Use Obsidian's processFrontMatter to extract metadata
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

		// Check for draft flag in frontmatter
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
		const success = await updatePost(cid, title, processedBody, tags, status);
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
				// Append typecho_cid to existing frontmatter
				const existingYaml = frontmatterMatch[1];
				if (!existingYaml.includes('typecho_cid:')) {
					const newYaml = existingYaml + `\ntypecho_cid: ${newCid}`;
					updatedContent = `---\n${newYaml}\n---${originalContent.slice(frontmatterMatch[0].length)}`;
				} else {
					updatedContent = originalContent;
				}
			} else {
				// Create new frontmatter
				const newFrontmatter = `---\ntitle: ${title}\ntypecho_cid: ${newCid}\ntags: []\n---\n`;
				updatedContent = newFrontmatter + originalContent;
			}

			await app.vault.adapter.write(mdPath, updatedContent);
			new Notice('文章发布成功！', 5000);
		}
	}
}
