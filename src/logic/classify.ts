import { ClassifiedItem, RawItem } from '../types';
import { ITEMS_DB } from '../data/items';

export function classifyItems(
  rawItems: RawItem[],
  // 추후 확장성을 위해 goal 파라미터 구조 유지
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _goal?: {
    targetWorkshops?: string[];
    targetCrafts?: string[];
    minKeepMats?: Record<string, number>;
  }
): ClassifiedItem[] {
  return rawItems.map((item) => {
    const dbItem = ITEMS_DB[item.name];

    // 1. 메타데이터가 없는 경우 -> 보수적 KEEP
    if (!dbItem) {
      return {
        ...item,
        action: "KEEP",
        reason: "Unknown item: Keep just in case",
        category: "unknown"
      };
    }

    // 2. 중요 재료 (Quest, Workshop, Crafting, Special Vendor)
    if (
      dbItem.usedForQuests ||
      dbItem.usedForWorkshop ||
      dbItem.usedForCrafting ||
      dbItem.usedForSpecialVendor
    ) {
      const minKeep = dbItem.defaultKeepMin || 1;
      if (item.qty <= minKeep) {
        return {
          ...item,
          action: "KEEP",
          reason: `Essential material (Hold at least ${minKeep})`,
          category: dbItem.category
        };
      } else {
        return {
          ...item,
          action: "MAYBE",
          reason: `Have enough (>${minKeep}), maybe sell excess?`,
          category: dbItem.category
        };
      }
    }

    // 3. 일반 재료/탄약 (Ammo, Material)
    if (dbItem.category === "ammo" || dbItem.category === "material") {
      const baseMin = dbItem.defaultKeepMin || 10;
      const recycleThreshold = baseMin * 2;
      
      if (item.qty > recycleThreshold) {
        return {
          ...item,
          action: "RECYCLE",
          reason: `Excessive amount (>${recycleThreshold})`,
          category: dbItem.category
        };
      } else {
        return {
          ...item,
          action: "KEEP",
          reason: "Standard supply",
          category: dbItem.category
        };
      }
    }

    // 4. 그 외 (Misc, etc)
    const defaultMin = dbItem.defaultKeepMin ?? 1;
    if (item.qty > defaultMin) {
      return {
        ...item,
        action: "MAYBE",
        reason: `Above reserve (${defaultMin})`,
        category: dbItem.category
      };
    }

    return {
      ...item,
      action: "KEEP",
      reason: "Reserve stock",
      category: dbItem.category
    };
  });
}
