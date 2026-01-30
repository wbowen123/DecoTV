'use client';

import { ChevronLeft, ChevronRight, Film } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useCallback, useRef, useState } from 'react';

import type { DoubanRecommendation } from '@/hooks/useDoubanInfo';

// ============================================================================
// Types
// ============================================================================

interface MovieRecommendationsProps {
  /** 推荐影片列表 */
  recommendations: DoubanRecommendation[];
  /** 是否正在加载 */
  loading?: boolean;
  /** 最多显示数量 */
  maxDisplay?: number;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 推荐影片卡片
 */
const RecommendationCard = memo(function RecommendationCard({
  recommendation,
}: {
  recommendation: DoubanRecommendation;
}) {
  const [imageError, setImageError] = useState(false);
  const posterUrl =
    recommendation.images?.medium || recommendation.images?.small || '';

  return (
    <Link
      href={`/douban?id=${recommendation.id}`}
      className='flex flex-col items-center shrink-0 w-28 group'
    >
      {/* 海报 */}
      <div className='relative w-24 h-36 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-md group-hover:shadow-lg transition-all duration-200 group-hover:scale-105'>
        {posterUrl && !imageError ? (
          <Image
            src={posterUrl}
            alt={recommendation.title}
            fill
            className='object-cover'
            referrerPolicy='no-referrer'
            onError={() => setImageError(true)}
            sizes='96px'
          />
        ) : (
          <div className='w-full h-full flex items-center justify-center'>
            <Film className='w-8 h-8 text-gray-400 dark:text-gray-500' />
          </div>
        )}

        {/* 悬浮遮罩 */}
        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200' />
      </div>

      {/* 标题 */}
      <p className='mt-2 text-xs font-medium text-gray-900 dark:text-gray-100 text-center line-clamp-2 w-full group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors'>
        {recommendation.title}
      </p>
    </Link>
  );
});

/**
 * 骨架屏加载状态
 */
const Skeleton = memo(function Skeleton({ count = 6 }: { count?: number }) {
  return (
    <div className='space-y-3'>
      <div className='h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded' />
      <div className='flex gap-4 overflow-hidden'>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className='flex flex-col items-center shrink-0 w-28 animate-pulse'
          >
            <div className='w-24 h-36 bg-gray-200 dark:bg-gray-700 rounded-lg' />
            <div className='mt-2 h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded' />
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * 空状态
 */
const EmptyState = memo(function EmptyState() {
  return null; // 没有推荐时不显示任何内容
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 推荐影片组件
 * 横向滚动卡片列表
 */
function MovieRecommendationsComponent({
  recommendations,
  loading = false,
  maxDisplay = 10,
}: MovieRecommendationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -240 : 240;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  if (loading) {
    return <Skeleton count={6} />;
  }

  const displayRecommendations = recommendations.slice(0, maxDisplay);

  if (displayRecommendations.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className='space-y-3'>
      {/* 标题 */}
      <h3 className='text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
        <Film className='w-5 h-5' />
        相关推荐
      </h3>

      {/* 滚动容器 */}
      <div className='relative'>
        {/* 左箭头 */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className='absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all'
            aria-label='向左滚动'
          >
            <ChevronLeft className='w-5 h-5 text-gray-600 dark:text-gray-300' />
          </button>
        )}

        {/* 右箭头 */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className='absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all'
            aria-label='向右滚动'
          >
            <ChevronRight className='w-5 h-5 text-gray-600 dark:text-gray-300' />
          </button>
        )}

        {/* 推荐列表 */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className='flex gap-4 overflow-x-auto pb-2 scrollbar-hide'
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {displayRecommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const MovieRecommendations = memo(MovieRecommendationsComponent);

export default MovieRecommendations;
