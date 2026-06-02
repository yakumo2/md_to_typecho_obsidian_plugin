export interface MdToTypechoSettings {
	TYPECHO_BASEURL: string;
	TYPECHO_TOKEN: string;
	TYPECHO_UID: string;       // Typecho user ID for API auth
	TYPECHO_CATEGORIES: string; // comma-separated category names
	TYPECHO_DRAFT: boolean;    // publish as draft by default
}

export const DEFAULT_SETTINGS: MdToTypechoSettings = {
	TYPECHO_BASEURL: '',
	TYPECHO_TOKEN: '',
	TYPECHO_UID: '1',
	TYPECHO_CATEGORIES: '',
	TYPECHO_DRAFT: false,
};

let _settings: MdToTypechoSettings;

export function setSettings(settings: MdToTypechoSettings) {
	_settings = settings;
}

export function getSetting<K extends keyof MdToTypechoSettings>(name: K): MdToTypechoSettings[K] {
	return _settings[name];
}

export function getCategories(): string[] {
	const raw = _settings.TYPECHO_CATEGORIES;
	if (!raw) return [];
	return raw.split(',').map(s => s.trim()).filter(Boolean);
}
