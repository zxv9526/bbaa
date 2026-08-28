import React, { useState, useEffect, useRef } from 'react';
import { Card, Suit, Rank } from '../types';
import {
  batchSaveCardAssets,
  clearAllCardAssets,
  getSkinCoverageCount,
  parseFileNameToKey,
  getCustomCardAsset,
  subscribeToSkinChanges,
  CardSkinAsset
} from '../lib/cardSkin';
import { CardView } from './CardView';
import { sounds } from '../sound';
import {
  X,
  Upload,
  Palette,
  CheckCircle2,
  Trash2,
  Sparkles,
  Info,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react';

interface CardSkinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CardSkinModal({ isOpen, onClose }: CardSkinModalProps) {
  if (!isOpen) return null;

  const [stats, setStats] = useState(getSkinCoverageCount());
  const [selectedSuit, setSelectedSuit] = useState<Suit | 'ALL'>('ALL');
  const [dragOver, setDragOver] = useState(false);
  const [uploadLog, setUploadLog] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToSkinChanges(() => {
      setStats(getSkinCoverageCount());
    });
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const validFiles = list.filter(f =>
      /\.(png|svg|webp|jpe?g)$/i.test(f.name)
    );

    if (validFiles.length === 0) {
      setUploadLog('⚠️ 未检测到有效的图片文件，支持 .png, .svg, .webp, .jpg 格式。');
      return;
    }

    const loadedEntries: CardSkinAsset[] = [];
    let successCount = 0;

    for (const file of validFiles) {
      try {
        const key = parseFileNameToKey(file.name);
        if (!key) continue;

        if (file.name.toLowerCase().endsWith('.svg')) {
          const text = await file.text();
          if (text.includes('<svg')) {
            loadedEntries.push({ key, content: text, type: 'svg' });
            successCount++;
          }
        } else {
          // PNG, WEBP, JPG converted to Data URL
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          loadedEntries.push({ key, content: dataUrl, type: 'data_url' });
          successCount++;
        }
      } catch (err) {
        console.error('Error reading card image file:', file.name, err);
      }
    }

    if (loadedEntries.length > 0) {
      await batchSaveCardAssets(loadedEntries);
      sounds.playDeal();
      setUploadLog(`🎉 成功导入 ${successCount} 张卡牌图片！已即时应用到牌局。`);
      setStats(getSkinCoverageCount());
    } else {
      setUploadLog(
        '⚠️ 未能正确识别文件名。请参考命名规范（如 10_of_clubs.png, ace_of_spades.png, back.png）。'
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleClearAll = async () => {
    if (
      window.confirm(
        '确定要清空所有已上传的自定义扑克卡牌吗？将恢复默认外观或使用 public/cards/ 目录下的静态图片。'
      )
    ) {
      await clearAllCardAssets();
      sounds.playCardPick();
      setUploadLog('已清空自定义卡牌缓存。');
      setStats(getSkinCoverageCount());
    }
  };

  // Generate 52 cards for overview grid
  const allSuits: Suit[] = ['S', 'H', 'C', 'D'];
  const suitsToDisplay = selectedSuit === 'ALL' ? allSuits : [selectedSuit];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold">
              🎨
            </div>
            <div>
              <h3 className="font-black text-lg text-white">
                扑克牌图片与自定义皮肤管理
              </h3>
              <p className="text-xs text-slate-400">
                支持 PNG / SVG / WebP 扑克牌识别、拖拽上传与全套 53 张卡牌预览
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-indigo-500 bg-indigo-500/10 scale-102'
                : 'border-slate-700 hover:border-indigo-500/80 bg-slate-950/50 hover:bg-slate-950/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.svg,.webp,.jpg,.jpeg"
              className="hidden"
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />

            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div className="font-black text-white text-base sm:text-lg mb-1">
              点击选择 或 直接将扑克牌图片 (PNG / SVG) 拖拽至此处
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              支持单张、多选或一次性拖入全部 53 张扑克卡牌（52张牌 + 1张牌背），即传即用，全局生效！
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
              <span className="font-bold text-slate-300">自动识别命名标准:</span>
              <code className="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded">
                10_of_clubs.png (梅花10)
              </code>
              <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded">
                ace_of_spades.png (黑桃A)
              </code>
              <code className="bg-slate-800 text-rose-300 px-1.5 py-0.5 rounded">
                king_of_diamonds.png (方块K)
              </code>
              <code className="bg-slate-800 text-pink-300 px-1.5 py-0.5 rounded">
                queen_of_hearts.png (红桃Q)
              </code>
              <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded">
                back.png (牌背)
              </code>
            </div>
          </div>

          {/* Feedback Log */}
          {uploadLog && (
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs font-bold flex items-center justify-between">
              <span>{uploadLog}</span>
              <button
                onClick={() => setUploadLog('')}
                className="text-slate-400 hover:text-white text-xs underline"
              >
                关闭提示
              </button>
            </div>
          )}

          {/* Status & Coverage Bar */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">
                当前卡牌覆盖状态:{' '}
                <span className="font-black text-white text-sm">
                  {stats.uploaded} / {stats.total} 张
                </span>{' '}
                {stats.hasBack && (
                  <span className="ml-2 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    ✓ 自定义牌背已就绪
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {stats.uploaded > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 清空上传记录
                </button>
              )}
            </div>
          </div>

          {/* Local Folder Directory Note */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              本地/静态文件加载规范:
            </div>
            <p className="leading-relaxed">
              系统会自动读取项目根目录的{' '}
              <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">
                public/cards/
              </code>{' '}
              目录下的图片文件，支持{' '}
              <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">
                10_of_clubs.png
              </code>
              、
              <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">
                ace_of_spades.png
              </code>
              、
              <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">
                back.png
              </code>{' '}
              等标准格式，若某张牌未提供图片，将平滑回退到高清矢量样式，无需担心报错。
            </p>
          </div>

          {/* Cards Gallery Preview Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                全套 52 张扑克卡牌与牌背实时预览
              </div>

              {/* Suit Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                {[
                  { id: 'ALL', label: '全部' },
                  { id: 'S', label: '♠ 黑桃' },
                  { id: 'H', label: '♥ 红桃' },
                  { id: 'C', label: '♣ 梅花' },
                  { id: 'D', label: '♦ 方块' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedSuit(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      selectedSuit === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Render Grid */}
            <div className="space-y-4 bg-slate-950/60 p-4 rounded-3xl border border-slate-800/80">
              {/* Back Card Preview */}
              {selectedSuit === 'ALL' && (
                <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
                  <div className="text-xs font-bold text-slate-400 w-24">牌背 (back.png):</div>
                  <CardView isFaceDown size="md" />
                  <div className="text-xs text-slate-400">
                    {stats.hasBack ? (
                      <span className="text-emerald-400 font-bold">
                        ✓ 已成功识别自定义牌背 (back.png / back.svg)
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        当前使用默认 13 水暗金纹理牌背（可上传 back.png 替换）
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 52 Cards by Suit */}
              {suitsToDisplay.map(s => {
                const suitName =
                  s === 'S'
                    ? '黑桃 ♠ (spades)'
                    : s === 'H'
                    ? '红桃 ♥ (hearts)'
                    : s === 'C'
                    ? '梅花 ♣ (clubs)'
                    : '方块 ♦ (diamonds)';
                const isRed = s === 'H' || s === 'D';

                return (
                  <div key={s} className="space-y-2">
                    <div
                      className={`text-xs font-black ${
                        isRed ? 'text-rose-400' : 'text-slate-300'
                      }`}
                    >
                      {suitName} (A ~ 2)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(r => {
                        const card: Card = { id: `${r}-${s}`, rank: r as Rank, suit: s };
                        return (
                          <div key={card.id} className="relative group">
                            <CardView card={card} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            支持 10_of_clubs, ace_of_spades, king_of_diamonds, back.png 等全部 53 张扑克图片。
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow"
          >
            完成并返回对局
          </button>
        </div>
      </div>
    </div>
  );
}
