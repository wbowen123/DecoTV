'use client';

import {
  Eye,
  EyeOff,
  Gauge,
  Layers,
  MessageSquare,
  RotateCcw,
  Settings,
  Type,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import type { DanmuSettings } from '@/hooks/useDanmu';

// ============================================================================
// Types
// ============================================================================

interface DanmuSettingsPanelProps {
  /** 是否打开面板 */
  isOpen: boolean;
  /** 关闭面板回调 */
  onClose: () => void;
  /** 当前设置 */
  settings: DanmuSettings;
  /** 更新设置回调 */
  onSettingsChange: (settings: Partial<DanmuSettings>) => void;
  /** 弹幕总数 */
  danmuTotal?: number;
  /** 是否正在加载 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 手动加载弹幕 */
  onLoadDanmu?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

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

const MODE_OPTIONS = [
  { value: 0, label: '滚动' },
  { value: 1, label: '顶部' },
  { value: 2, label: '底部' },
];

// ============================================================================
// Sub Components
// ============================================================================

const SliderControl = memo(function SliderControl({
  label,
  icon: Icon,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
          <Icon className='w-4 h-4' />
          <span>{label}</span>
        </div>
        <span className='text-sm font-medium text-green-600 dark:text-green-400'>
          {value}
          {unit}
        </span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500'
      />
    </div>
  );
});

const ModeToggle = memo(function ModeToggle({
  modes,
  onChange,
}: {
  modes: number[];
  onChange: (modes: number[]) => void;
}) {
  const toggleMode = (mode: number) => {
    if (modes.includes(mode)) {
      // 至少保留一种模式
      if (modes.length > 1) {
        onChange(modes.filter((m) => m !== mode));
      }
    } else {
      onChange([...modes, mode].sort());
    }
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
        <Layers className='w-4 h-4' />
        <span>弹幕类型</span>
      </div>
      <div className='flex gap-2'>
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => toggleMode(option.value)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${
              modes.includes(option.value)
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
});

const SwitchControl = memo(function SwitchControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className='flex items-center justify-between'>
      <span className='text-sm text-gray-700 dark:text-gray-300'>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

function DanmuSettingsPanelComponent({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  danmuTotal = 0,
  loading = false,
  error = null,
  onLoadDanmu,
}: DanmuSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<DanmuSettings>(settings);

  // 同步外部设置
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // 更新本地设置并通知父组件
  const updateSetting = useCallback(
    <K extends keyof DanmuSettings>(key: K, value: DanmuSettings[K]) => {
      const newSettings = { ...localSettings, [key]: value };
      setLocalSettings(newSettings);
      onSettingsChange({ [key]: value });
    },
    [localSettings, onSettingsChange],
  );

  // 重置为默认设置
  const resetSettings = useCallback(() => {
    setLocalSettings(DEFAULT_SETTINGS);
    onSettingsChange(DEFAULT_SETTINGS);
  }, [onSettingsChange]);

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div className='fixed inset-0 bg-black/50 z-40' onClick={onClose} />

      {/* 面板 */}
      <div className='fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col'>
        {/* 头部 */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
              <MessageSquare className='w-5 h-5 text-green-600 dark:text-green-400' />
            </div>
            <div>
              <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                弹幕设置
              </h2>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {settings.enabled
                  ? loading
                    ? '正在加载弹幕...'
                    : error
                      ? '加载失败'
                      : `已加载 ${danmuTotal} 条弹幕`
                  : '外部弹幕已关闭'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        {/* 内容区域 */}
        <div className='flex-1 overflow-y-auto p-4 space-y-6'>
          {/* 外部弹幕开关 */}
          <div className='p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3'>
            <SwitchControl
              label='启用外部弹幕'
              checked={localSettings.enabled}
              onChange={(v) => updateSetting('enabled', v)}
            />
            {localSettings.enabled && (
              <SwitchControl
                label='显示弹幕'
                checked={localSettings.visible}
                onChange={(v) => updateSetting('visible', v)}
              />
            )}
          </div>

          {/* 手动加载按钮 */}
          {localSettings.enabled && onLoadDanmu && (
            <button
              onClick={onLoadDanmu}
              disabled={loading}
              className='w-full py-2.5 px-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2'
            >
              {loading ? (
                <>
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  加载中...
                </>
              ) : (
                <>
                  <RotateCcw className='w-4 h-4' />
                  重新加载弹幕
                </>
              )}
            </button>
          )}

          {/* 弹幕样式设置 */}
          {localSettings.enabled && (
            <>
              <div className='space-y-4'>
                <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                  <Settings className='w-4 h-4' />
                  弹幕样式
                </h3>

                <SliderControl
                  label='字体大小'
                  icon={Type}
                  value={localSettings.fontSize}
                  min={12}
                  max={40}
                  unit='px'
                  onChange={(v) => updateSetting('fontSize', v)}
                />

                <SliderControl
                  label='弹幕速度'
                  icon={Gauge}
                  value={localSettings.speed}
                  min={1}
                  max={10}
                  unit='s'
                  onChange={(v) => updateSetting('speed', v)}
                />

                <SliderControl
                  label='透明度'
                  icon={localSettings.opacity > 0.5 ? Eye : EyeOff}
                  value={Math.round(localSettings.opacity * 100)}
                  min={10}
                  max={100}
                  unit='%'
                  onChange={(v) => updateSetting('opacity', v / 100)}
                />

                <SliderControl
                  label='显示区域'
                  icon={Layers}
                  value={Math.round(localSettings.margin[1] * 100)}
                  min={25}
                  max={100}
                  unit='%'
                  onChange={(v) => updateSetting('margin', [0, v / 100])}
                />
              </div>

              <div className='space-y-4'>
                <ModeToggle
                  modes={localSettings.modes}
                  onChange={(v) => updateSetting('modes', v)}
                />

                <SwitchControl
                  label='防重叠'
                  checked={localSettings.antiOverlap}
                  onChange={(v) => updateSetting('antiOverlap', v)}
                />
              </div>
            </>
          )}
        </div>

        {/* 底部操作 */}
        <div className='p-4 border-t border-gray-200 dark:border-gray-700 space-y-2'>
          <button
            onClick={resetSettings}
            className='w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors'
          >
            恢复默认设置
          </button>
        </div>
      </div>
    </>
  );
}

export const DanmuSettingsPanel = memo(DanmuSettingsPanelComponent);
export default DanmuSettingsPanel;
