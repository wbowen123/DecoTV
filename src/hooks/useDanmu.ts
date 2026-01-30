/* eslint-disable no-console */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DanmuItem {
  /** 弹幕出现时间（秒） */
  time: number;
  /** 弹幕文本 */
  text: string;
  /** 弹幕颜色（十六进制） */
  color?: string;
  /** 弹幕类型：0-滚动 1-顶部 2-底部 */
  mode?: number;
  /** 弹幕边框颜色 */
  border?: boolean;
}

export interface DanmuSettings {
  /** 是否启用外部弹幕 */
  enabled: boolean;
  /** 弹幕字体大小 */
  fontSize: number;
  /** 弹幕速度（秒） */
  speed: number;
  /** 弹幕透明度 0-1 */
  opacity: number;
  /** 弹幕显示区域 0-1 */
  margin: [number, number];
  /** 启用的弹幕模式：0-滚动 1-顶部 2-底部 */
  modes: number[];
  /** 是否开启防重叠 */
  antiOverlap: boolean;
  /** 是否显示弹幕 */
  visible: boolean;
}

export interface UseDanmuOptions {
  /** 豆瓣 ID */
  doubanId?: number | string;
  /** 影片标题 */
  title?: string;
  /** 影片年份 */
  year?: string;
  /** 当前集数 */
  episode?: number;
  /** 是否自动加载弹幕 */
  autoLoad?: boolean;
}

export interface UseDanmuResult {
  /** 弹幕列表 */
  danmuList: DanmuItem[];
  /** 弹幕设置 */
  settings: DanmuSettings;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 弹幕总数 */
  total: number;
  /** 加载弹幕 */
  loadDanmu: () => Promise<void>;
  /** 更新设置 */
  updateSettings: (newSettings: Partial<DanmuSettings>) => void;
  /** 切换弹幕可见性 */
  toggleVisible: () => void;
  /** 切换外部弹幕开关 */
  toggleEnabled: () => void;
  /** 清空弹幕 */
  clearDanmu: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  ENABLED: 'enable_external_danmu',
  FONT_SIZE: 'danmaku_fontSize',
  SPEED: 'danmaku_speed',
  OPACITY: 'danmaku_opacity',
  MARGIN: 'danmaku_margin',
  MODES: 'danmaku_modes',
  ANTI_OVERLAP: 'danmaku_antiOverlap',
  VISIBLE: 'danmaku_visible',
} as const;

const DEFAULT_SETTINGS: DanmuSettings = {
  enabled: false,
  fontSize: 25,
  speed: 5,
  opacity: 0.8,
  margin: [0, 0.5],
  modes: [0, 1, 2],
  antiOverlap: true,
  visible: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 从 localStorage 读取弹幕设置
 */
function loadSettingsFromStorage(): DanmuSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    return {
      enabled: localStorage.getItem(STORAGE_KEYS.ENABLED) === 'true',
      fontSize: parseInt(
        localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '25',
        10,
      ),
      speed: parseFloat(localStorage.getItem(STORAGE_KEYS.SPEED) || '5'),
      opacity: parseFloat(localStorage.getItem(STORAGE_KEYS.OPACITY) || '0.8'),
      margin: JSON.parse(
        localStorage.getItem(STORAGE_KEYS.MARGIN) || '[0, 0.5]',
      ),
      modes: JSON.parse(
        localStorage.getItem(STORAGE_KEYS.MODES) || '[0, 1, 2]',
      ),
      antiOverlap: localStorage.getItem(STORAGE_KEYS.ANTI_OVERLAP) !== 'false',
      visible: localStorage.getItem(STORAGE_KEYS.VISIBLE) !== 'false',
    };
  } catch (e) {
    console.warn('[useDanmu] 读取设置失败:', e);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 保存弹幕设置到 localStorage
 */
function saveSettingsToStorage(settings: DanmuSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEYS.ENABLED, String(settings.enabled));
    localStorage.setItem(STORAGE_KEYS.FONT_SIZE, String(settings.fontSize));
    localStorage.setItem(STORAGE_KEYS.SPEED, String(settings.speed));
    localStorage.setItem(STORAGE_KEYS.OPACITY, String(settings.opacity));
    localStorage.setItem(STORAGE_KEYS.MARGIN, JSON.stringify(settings.margin));
    localStorage.setItem(STORAGE_KEYS.MODES, JSON.stringify(settings.modes));
    localStorage.setItem(
      STORAGE_KEYS.ANTI_OVERLAP,
      String(settings.antiOverlap),
    );
    localStorage.setItem(STORAGE_KEYS.VISIBLE, String(settings.visible));
  } catch (e) {
    console.warn('[useDanmu] 保存设置失败:', e);
  }
}

/**
 * 生成弹幕缓存 Key
 */
function getDanmuCacheKey(
  doubanId?: number | string,
  title?: string,
  year?: string,
  episode?: number,
): string {
  if (doubanId) {
    return `danmu_cache_${doubanId}_${episode || 1}`;
  }
  return `danmu_cache_${title}_${year}_${episode || 1}`;
}

/**
 * 从缓存读取弹幕
 */
function getDanmuFromCache(cacheKey: string): DanmuItem[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // 缓存 30 分钟有效
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        return data;
      }
    }
  } catch (e) {
    console.warn('[useDanmu] 读取缓存失败:', e);
  }
  return null;
}

/**
 * 保存弹幕到缓存
 */
function saveDanmuToCache(cacheKey: string, data: DanmuItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch (e) {
    console.warn('[useDanmu] 保存缓存失败:', e);
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 弹幕管理 Hook
 * 负责外部弹幕的加载、缓存、设置管理
 */
export function useDanmu(options: UseDanmuOptions = {}): UseDanmuResult {
  const { doubanId, title, year, episode = 1, autoLoad = true } = options;

  // 状态
  const [danmuList, setDanmuList] = useState<DanmuItem[]>([]);
  const [settings, setSettings] = useState<DanmuSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // 防抖控制
  const loadingRef = useRef(false);
  const lastLoadParamsRef = useRef<string>('');

  // 初始化：从 localStorage 读取设置
  useEffect(() => {
    const savedSettings = loadSettingsFromStorage();
    setSettings(savedSettings);
  }, []);

  // 生成当前参数的唯一标识
  const getLoadParams = useCallback(() => {
    return `${doubanId}_${title}_${year}_${episode}`;
  }, [doubanId, title, year, episode]);

  // 加载弹幕
  const loadDanmu = useCallback(async () => {
    // 没有足够的参数
    if (!doubanId && !title) {
      console.log('[useDanmu] 参数不足，跳过加载');
      return;
    }

    // 弹幕未启用
    if (!settings.enabled) {
      console.log('[useDanmu] 弹幕未启用，跳过加载');
      return;
    }

    // 防止重复加载
    const currentParams = getLoadParams();
    if (loadingRef.current) {
      console.log('[useDanmu] 正在加载中，跳过');
      return;
    }

    // 检查缓存
    const cacheKey = getDanmuCacheKey(doubanId, title, year, episode);
    const cached = getDanmuFromCache(cacheKey);
    if (cached && lastLoadParamsRef.current === currentParams) {
      console.log('[useDanmu] 使用缓存弹幕:', cached.length);
      setDanmuList(cached);
      setTotal(cached.length);
      return;
    }

    loadingRef.current = true;
    lastLoadParamsRef.current = currentParams;
    setLoading(true);
    setError(null);

    try {
      // 构建请求参数
      const params = new URLSearchParams();
      if (doubanId) params.set('doubanId', String(doubanId));
      if (title) params.set('title', title);
      if (year) params.set('year', year);
      params.set('episode', String(episode));

      const response = await fetch(`/api/danmu-external?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(data.message || '获取弹幕失败');
      }

      const danmuData: DanmuItem[] = data.data || [];
      console.log('[useDanmu] 加载弹幕成功:', danmuData.length);

      // 保存到缓存
      saveDanmuToCache(cacheKey, danmuData);

      setDanmuList(danmuData);
      setTotal(danmuData.length);
    } catch (e) {
      console.error('[useDanmu] 加载弹幕失败:', e);
      setError(e instanceof Error ? e.message : '加载失败');
      setDanmuList([]);
      setTotal(0);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [doubanId, title, year, episode, settings.enabled, getLoadParams]);

  // 当参数变化且启用弹幕时自动加载
  useEffect(() => {
    if (autoLoad && settings.enabled) {
      loadDanmu();
    }
  }, [autoLoad, settings.enabled, doubanId, title, year, episode, loadDanmu]);

  // 更新设置
  const updateSettings = useCallback((newSettings: Partial<DanmuSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettingsToStorage(updated);
      return updated;
    });
  }, []);

  // 切换弹幕可见性
  const toggleVisible = useCallback(() => {
    setSettings((prev) => {
      const updated = { ...prev, visible: !prev.visible };
      saveSettingsToStorage(updated);
      return updated;
    });
  }, []);

  // 切换外部弹幕开关
  const toggleEnabled = useCallback(() => {
    setSettings((prev) => {
      const updated = { ...prev, enabled: !prev.enabled };
      saveSettingsToStorage(updated);
      return updated;
    });
  }, []);

  // 清空弹幕
  const clearDanmu = useCallback(() => {
    setDanmuList([]);
    setTotal(0);
    setError(null);
  }, []);

  return {
    danmuList,
    settings,
    loading,
    error,
    total,
    loadDanmu,
    updateSettings,
    toggleVisible,
    toggleEnabled,
    clearDanmu,
  };
}

export default useDanmu;
