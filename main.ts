import { App, Editor, MarkdownFileInfo, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { post_md } from './typecho.js';
import { setSettings, DEFAULT_SETTINGS, MdToTypechoSettings } from './config.js';

export default class MdToTypechoPlugin extends Plugin {
	settings!: MdToTypechoSettings;

	async onload() {
		await this.loadSettings();

		// Ribbon icon
		this.addRibbonIcon('upload-cloud', 'Publish to Typecho', () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const filePath = activeView.file?.path;
				if (filePath) {
					post_md(filePath, this.app);
				}
			}
		});

		// Command: Publish
		this.addCommand({
			id: 'publish-to-typecho',
			name: '发布当前笔记到 Typecho',
			editorCallback: (_editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				const filePath = ctx.file?.path;
				if (filePath) {
					post_md(filePath, this.app);
				}
			},
		});

		// Command: Publish as draft
		this.addCommand({
			id: 'publish-to-typecho-draft',
			name: '发布当前笔记到 Typecho（草稿）',
			editorCallback: async (_editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				const filePath = ctx.file?.path;
				if (filePath) {
					// Temporarily override draft setting
					const originalDraft = this.settings.TYPECHO_DRAFT;
					this.settings.TYPECHO_DRAFT = true;
					setSettings(this.settings);
					await post_md(filePath, this.app);
					this.settings.TYPECHO_DRAFT = originalDraft;
					setSettings(this.settings);
				}
			},
		});

		// Settings tab
		this.addSettingTab(new MdToTypechoSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		setSettings(this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MdToTypechoSettingTab extends PluginSettingTab {
	plugin: MdToTypechoPlugin;

	constructor(app: App, plugin: MdToTypechoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Typecho 博客设置' });

		new Setting(containerEl)
			.setName('Typecho 站点地址')
			.setDesc('Typecho 博客的根地址，例如 https://blog.example.com')
			.addText((text) =>
				text
					.setPlaceholder('https://blog.example.com')
					.setValue(this.plugin.settings.TYPECHO_BASEURL)
					.onChange(async (value) => {
						this.plugin.settings.TYPECHO_BASEURL = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('API Token')
			.setDesc('Typecho RESTful 插件的 API Token')
			.addText((text) =>
				text
					.setPlaceholder('your_api_token')
					.setValue(this.plugin.settings.TYPECHO_TOKEN)
					.onChange(async (value) => {
						this.plugin.settings.TYPECHO_TOKEN = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('用户 ID')
			.setDesc('Typecho 用户 ID，默认 1（通常是管理员）')
			.addText((text) =>
				text
					.setPlaceholder('1')
					.setValue(this.plugin.settings.TYPECHO_UID)
					.onChange(async (value) => {
						this.plugin.settings.TYPECHO_UID = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('默认分类')
			.setDesc('文章分类名称，多个用逗号分隔，例如：技术,随笔')
			.addText((text) =>
				text
					.setPlaceholder('技术,随笔')
					.setValue(this.plugin.settings.TYPECHO_CATEGORIES)
					.onChange(async (value) => {
						this.plugin.settings.TYPECHO_CATEGORIES = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('默认发布为草稿')
			.setDesc('开启后，默认发布为草稿而非公开发布')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.TYPECHO_DRAFT)
					.onChange(async (value) => {
						this.plugin.settings.TYPECHO_DRAFT = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl('h2', { text: '关于' });

		const aboutEl = containerEl.createEl('p');
		aboutEl.innerHTML = '从 Obsidian 发布 Markdown 文章到 Typecho 博客。<br/>原生 Markdown 支持，告别 HTML 转换。';

		containerEl.createEl('p', { text: '如果觉得有用，欢迎' });
		const emailLink = containerEl.createEl('a', {
			text: '给我发邮件',
			href: 'mailto:monkhead@126.com',
		});
	}
}
