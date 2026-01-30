/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ============================================================================
// Types
// ============================================================================

interface DanmuItem {
  time: number;
  text: string;
  color?: string;
  mode?: number;
}

interface DanmuResponse {
  code: number;
  message: string;
  data: DanmuItem[];
  total: number;
  source?: string;
}

// ============================================================================
// Constants
// ============================================================================

// 弹幕源配置
const DANMU_SOURCES = {
  // 弹幕多平台（需要匹配标题）
  DANDAN: 'https://api.dandanplay.net/api/v2',
  // 备用弹幕源
  BILIBILI: 'https://api.bilibili.com',
} as const;

// 用户代理
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ============================================================================
// 弹幕获取函数
// ============================================================================

/**
 * 从弹弹Play API 搜索匹配的番剧/影片
 */
async function searchDandanPlay(
  title: string,
  episode: number,
): Promise<{ animeId: number; episodeId: number } | null> {
  try {
    const url = `${DANMU_SOURCES.DANDAN}/search/episodes?anime=${encodeURIComponent(title)}&episode=${episode}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      next: { revalidate: 3600 }, // 缓存 1 小时
    });

    if (!response.ok) {
      console.log('[Danmu] 弹弹Play 搜索失败:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.hasMore && data.animes && data.animes.length > 0) {
      const anime = data.animes[0];
      const episodes = anime.episodes || [];

      // 尝试匹配集数
      const targetEpisode =
        episodes.find(
          (ep: any) =>
            ep.episodeTitle?.includes(`第${episode}`) ||
            ep.episodeTitle?.includes(`${episode}集`) ||
            ep.episodeTitle?.includes(`E${episode}`) ||
            ep.episodeTitle?.includes(`EP${episode}`),
        ) || episodes[0];

      if (targetEpisode) {
        return {
          animeId: anime.animeId,
          episodeId: targetEpisode.episodeId,
        };
      }
    }

    console.log('[Danmu] 弹弹Play 未找到匹配结果');
    return null;
  } catch (error) {
    console.error('[Danmu] 弹弹Play 搜索出错:', error);
    return null;
  }
}

/**
 * 从弹弹Play获取弹幕
 */
async function getDandanPlayDanmu(episodeId: number): Promise<DanmuItem[]> {
  try {
    const url = `${DANMU_SOURCES.DANDAN}/comment/${episodeId}?withRelated=true&chConvert=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      next: { revalidate: 300 }, // 缓存 5 分钟
    });

    if (!response.ok) {
      console.log('[Danmu] 弹弹Play 获取弹幕失败:', response.status);
      return [];
    }

    const data = await response.json();
    const comments = data.comments || [];

    console.log('[Danmu] 弹弹Play 获取到弹幕:', comments.length);

    // 转换弹幕格式
    // 弹弹Play 格式: p = "time,mode,color,userId"
    return comments
      .map((comment: any) => {
        const p = comment.p?.split(',') || [];
        const time = parseFloat(p[0]) || 0;
        const mode = parseInt(p[1]) || 1;
        const colorNum = parseInt(p[2]) || 16777215;

        // 转换颜色为十六进制
        const color = '#' + colorNum.toString(16).padStart(6, '0');

        // 转换模式: 1-滚动 4-底部 5-顶部 -> 0-滚动 1-顶部 2-底部
        let danmuMode = 0;
        if (mode === 4) danmuMode = 2; // 底部
        if (mode === 5) danmuMode = 1; // 顶部

        return {
          time,
          text: comment.m || '',
          color,
          mode: danmuMode,
        };
      })
      .filter((d: DanmuItem) => d.text.length > 0);
  } catch (error) {
    console.error('[Danmu] 弹弹Play 获取弹幕出错:', error);
    return [];
  }
}

/**
 * 通过豆瓣ID获取弹幕（先搜索匹配再获取）
 */
async function getDanmuByDoubanId(
  doubanId: string,
  title: string,
  episode: number,
): Promise<DanmuItem[]> {
  // 使用标题搜索弹弹Play
  const matchResult = await searchDandanPlay(title, episode);

  if (matchResult) {
    return getDandanPlayDanmu(matchResult.episodeId);
  }

  return [];
}

/**
 * 通过标题获取弹幕
 */
async function getDanmuByTitle(
  title: string,
  year: string,
  episode: number,
): Promise<DanmuItem[]> {
  // 尝试带年份搜索
  let matchResult = await searchDandanPlay(`${title} ${year}`, episode);

  // 如果没找到，尝试只用标题
  if (!matchResult) {
    matchResult = await searchDandanPlay(title, episode);
  }

  if (matchResult) {
    return getDandanPlayDanmu(matchResult.episodeId);
  }

  return [];
}

/**
 * 弹幕去重和清洗
 */
function cleanDanmuList(danmuList: DanmuItem[]): DanmuItem[] {
  const seen = new Set<string>();
  const result: DanmuItem[] = [];

  for (const danmu of danmuList) {
    // 清理弹幕文本
    const cleanText = danmu.text.trim().replace(/\s+/g, ' ').slice(0, 100); // 限制长度

    if (!cleanText) continue;

    // 生成去重 key（时间精确到0.5秒 + 文本）
    const timeKey = Math.floor(danmu.time * 2);
    const dedupeKey = `${timeKey}_${cleanText}`;

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    result.push({
      ...danmu,
      text: cleanText,
    });
  }

  // 按时间排序
  result.sort((a, b) => a.time - b.time);

  return result;
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
): Promise<NextResponse<DanmuResponse>> {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  const doubanId = searchParams.get('doubanId') || '';
  const title = searchParams.get('title') || '';
  const year = searchParams.get('year') || '';
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  console.log('[Danmu API] 请求参数:', { doubanId, title, year, episode });

  // 参数验证
  if (!title && !doubanId) {
    return NextResponse.json({
      code: 400,
      message: '缺少必要参数: title 或 doubanId',
      data: [],
      total: 0,
    });
  }

  try {
    let danmuList: DanmuItem[] = [];
    let source = 'none';

    // 优先使用豆瓣ID + 标题搜索
    if (doubanId && title) {
      danmuList = await getDanmuByDoubanId(doubanId, title, episode);
      if (danmuList.length > 0) {
        source = 'dandanplay';
      }
    }

    // fallback: 使用标题 + 年份搜索
    if (danmuList.length === 0 && title) {
      danmuList = await getDanmuByTitle(title, year, episode);
      if (danmuList.length > 0) {
        source = 'dandanplay';
      }
    }

    // 清洗和去重
    const cleanedList = cleanDanmuList(danmuList);

    const duration = Date.now() - startTime;
    console.log(
      `[Danmu API] 完成: ${cleanedList.length} 条弹幕, 耗时 ${duration}ms, 来源: ${source}`,
    );

    return NextResponse.json({
      code: 200,
      message: 'success',
      data: cleanedList,
      total: cleanedList.length,
      source,
    });
  } catch (error) {
    console.error('[Danmu API] 错误:', error);
    return NextResponse.json({
      code: 500,
      message: error instanceof Error ? error.message : '服务器错误',
      data: [],
      total: 0,
    });
  }
}
