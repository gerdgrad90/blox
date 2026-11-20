import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Coins,
  Gem,
  ShoppingBag,
  Check,
  Sparkles,
  Shield,
  Shirt,
  Smile,
  Zap,
  Eye,
  CloudCheck,
  AlertCircle,
} from 'lucide-react';
import { CharacterSkin } from '../game/types';
import {
  SHOP_CATALOG,
  ShopItem,
  getStoredOwnedItems,
  mergeWithStarterItems,
  saveStoredOwnedItems,
} from '../game/shop';
import { sound } from '../game/audio';
import { AvatarPortraitIcon } from './AvatarPortraitIcon';

interface ShopModalProps {
  currentSkin: CharacterSkin;
  coins: number;
  gems: number;
  ownedItems?: string[];
  isCloudSynced?: boolean;
  onOwnedItemsChange?: (updatedOwned: string[]) => void;
  onUpdateSkin: (newSkin: CharacterSkin) => void;
  onSpendCurrency: (coins: number, gems: number) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  currentSkin,
  coins,
  gems,
  ownedItems: propOwnedItems,
  isCloudSynced = false,
  onOwnedItemsChange,
  onUpdateSkin,
  onSpendCurrency,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'hat' | 'outfit' | 'face' | 'gear'>('all');
  const [localOwned, setLocalOwned] = useState<string[]>(() =>
    mergeWithStarterItems(propOwnedItems || getStoredOwnedItems())
  );
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (propOwnedItems) {
      setLocalOwned(mergeWithStarterItems(propOwnedItems));
    }
  }, [propOwnedItems]);

  const ownedItems = propOwnedItems ? mergeWithStarterItems(propOwnedItems) : localOwned;

  const handleBuyOrEquip = (item: ShopItem) => {
    const isFree = item.priceCoins === 0 && item.priceGems === 0;
    const isOwned = isFree || ownedItems.includes(item.id);

    if (!isOwned) {
      if (coins < item.priceCoins || gems < item.priceGems) {
        sound.playPlaceBlock();
        const needCoins = Math.max(0, item.priceCoins - coins);
        const needGems = Math.max(0, item.priceGems - gems);
        const parts: string[] = [];
        if (needCoins > 0) parts.push(`${needCoins} монет`);
        if (needGems > 0) parts.push(`${needGems} крист.`);
        setFeedbackMsg(`Для покупки «${item.name}» нужно ещё ${parts.join(' и ')}. Собирайте их на карте или в квестах!`);
        setPreviewItem(item);
        return;
      }

      // Deduct currency & unlock
      onSpendCurrency(item.priceCoins, item.priceGems);
      const updatedOwned = mergeWithStarterItems([...ownedItems, item.id]);
      setLocalOwned(updatedOwned);
      saveStoredOwnedItems(updatedOwned);
      onOwnedItemsChange?.(updatedOwned);
      sound.playAchievement();
      setFeedbackMsg(`Куплено и надето: «${item.name}»! Скин синхронизирован.`);
    } else {
      sound.playCoin();
      setFeedbackMsg(`Надето: «${item.name}»! Скин синхронизирован.`);
    }

    setPreviewItem(null);

    // Equip item properties
    const updatedSkin: CharacterSkin = {
      ...currentSkin,
      ...item.skinProperty,
    };
    onUpdateSkin(updatedSkin);
  };

  const filteredItems = SHOP_CATALOG.filter(
    (item) => activeTab === 'all' || item.type === activeTab
  );

  const isEquipped = (item: ShopItem) => {
    if (item.type === 'hat') {
      if (item.id === 'gold_crown') {
        return currentSkin.hat === 'crown' || currentSkin.hat === 'gold_crown';
      }
      return currentSkin.hat === item.skinProperty.hat;
    }
    if (item.type === 'outfit') {
      return (
        currentSkin.shirt === item.skinProperty.shirt ||
        (item.skinProperty.outfit !== 'classic' && currentSkin.outfit === item.skinProperty.outfit)
      );
    }
    if (item.type === 'face') {
      if (item.id === 'smile') return currentSkin.face === 'smile' || currentSkin.face === 'happy';
      return currentSkin.face === item.skinProperty.face;
    }
    if (item.type === 'gear') return currentSkin.backpack === item.skinProperty.backpack;
    return false;
  };

  const headerPreviewSkin: CharacterSkin = previewItem
    ? { ...currentSkin, ...previewItem.skinProperty }
    : currentSkin;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-5xl max-h-[94dvh] bg-slate-950 border-2 border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarPortraitIcon
              skin={headerPreviewSkin}
              size="md"
              interactive={false}
              className="border-2 border-amber-400/70 shrink-0"
              title="Предпросмотр вашего скина"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <ShoppingBag size={20} className="text-amber-400" />
                  <span>Магазин Blox Catalog</span>
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isCloudSynced
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  }`}
                >
                  <CloudCheck size={11} />
                  <span>{isCloudSynced ? 'Синхронизация в облаке' : 'Синхронизация активна'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {previewItem
                  ? `Примерка: ${previewItem.name} (нажмите «Сбросить» или купите предмет)`
                  : 'Все предметы поддерживают 3D-примерку, покупку и мгновенную синхронизацию'}
              </p>
            </div>
          </div>

          {/* Currency Display & Close */}
          <div className="flex items-center gap-3">
            {previewItem && (
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
              >
                Сбросить примерку
              </button>
            )}

            <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Coins size={16} className="text-amber-400 fill-amber-400" />
                <span className="font-mono-numbers">{coins.toLocaleString()}</span>
              </div>
              <div className="w-px h-4 bg-slate-800" />
              <div
                title="💎 Кристаллы — ГИПЕР РЕДКИЕ! За 10 💎 можно сменить никнейм."
                className="flex items-center gap-1.5 text-cyan-300"
              >
                <Gem size={16} className="text-cyan-400 fill-cyan-400" />
                <span className="font-mono-numbers">{gems.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть магазин"
              className="w-10 h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Catalog Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800/80 bg-slate-900/30 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[
              { id: 'all', label: `Все (${SHOP_CATALOG.length})`, icon: Sparkles },
              { id: 'hat', label: 'Шляпы', icon: Shield },
              { id: 'outfit', label: 'Одежда', icon: Shirt },
              { id: 'face', label: 'Лица', icon: Smile },
              { id: 'gear', label: 'Снаряжение', icon: Zap },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`min-h-[40px] flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Status / Feedback Banner */}
        {feedbackMsg && (
          <div className="mx-3.5 sm:mx-6 mt-3 px-3.5 py-2 rounded-2xl bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Item Grid */}
        <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredItems.map((item) => {
            const isFree = item.priceCoins === 0 && item.priceGems === 0;
            const isOwned = isFree || ownedItems.includes(item.id);
            const equipped = isEquipped(item);
            const isPreviewing = previewItem?.id === item.id;
            const canAfford = coins >= item.priceCoins && gems >= item.priceGems;
            const itemPreviewSkin: CharacterSkin = {
              ...currentSkin,
              ...item.skinProperty,
            };

            return (
              <div
                key={item.id}
                data-testid={`shop-item-${item.id}`}
                className={`group relative rounded-3xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                  equipped
                    ? 'bg-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/10'
                    : isPreviewing
                    ? 'bg-sky-500/10 border-sky-400/70 shadow-lg'
                    : isOwned
                    ? 'bg-slate-900/85 border-slate-700/80 hover:border-slate-600'
                    : 'bg-slate-900/65 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Preview + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AvatarPortraitIcon
                      skin={itemPreviewSkin}
                      size="md"
                      interactive={false}
                      className="border border-slate-700 group-hover:scale-105 transition-transform"
                    />
                    <span className="text-2xl select-none">{item.icon}</span>
                  </div>
                  {equipped ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300">
                      <Check size={12} /> Надето
                    </span>
                  ) : isOwned ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-400">
                      Доступно
                    </span>
                  ) : isPreviewing ? (
                    <span className="px-2 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-[10px] font-bold text-sky-300">
                      Примерка
                    </span>
                  ) : null}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1">
                  <h3 className="font-bold text-sm text-white">{item.name}</h3>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{item.description}</p>
                </div>

                {/* Price & Action */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80 mt-auto">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black">
                      {item.priceCoins > 0 && (
                        <span
                          className={`flex items-center gap-1 ${
                            coins >= item.priceCoins || isOwned ? 'text-amber-300' : 'text-rose-400'
                          }`}
                        >
                          <Coins size={13} className="text-amber-400 fill-amber-400" /> {item.priceCoins}
                        </span>
                      )}
                      {item.priceGems > 0 && (
                        <span
                          className={`flex items-center gap-1 ${
                            gems >= item.priceGems || isOwned ? 'text-cyan-300' : 'text-rose-400'
                          }`}
                        >
                          <Gem size={13} className="text-cyan-400 fill-cyan-400" /> {item.priceGems}
                        </span>
                      )}
                      {isFree && (
                        <span className="text-emerald-400 font-bold text-xs">Бесплатно</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isOwned && (
                        <button
                          type="button"
                          onClick={() => setPreviewItem(isPreviewing ? null : item)}
                          title="Примерить в 3D"
                          className={`p-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                            isPreviewing
                              ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                          }`}
                        >
                          <Eye size={14} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleBuyOrEquip(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black shadow transition-all cursor-pointer ${
                          equipped
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                            : isOwned
                            ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                            : canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {equipped ? 'Надето' : isOwned ? 'Надеть' : canAfford ? 'Купить' : 'Не хватает'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
