import type { Db } from 'mongodb';

import { getEditableBooking, reprice, saveEdit } from './bookings';
import { HttpError } from './http';
import { syncPromotion } from './promotions';

interface Option {
  skuId: number;
  label: string;
}

interface Sellable {
  sellableType: 'SKU' | 'COMBO';
  sellableId: number;
  code: string;
  name: string;
  category: 'COMBOS' | 'POPCORN' | 'DRINKS' | 'SNACKS';
  description?: string;
  price: number;
  size?: string;
  /** Combos: pick `min`..`max` different options from `options` (e.g. the drink). */
  choice?: { groupCode: string; min: number; max: number; options: Option[] };
}

const DRINKS: Option[] = [
  { skuId: 11, label: 'Coca-Cola' },
  { skuId: 12, label: 'Sprite' },
  { skuId: 13, label: 'Nước cam' },
];

// The menu is part of the app's configuration (no admin screen manages it).
const MENU: Sellable[] = [
  { sellableType: 'COMBO', sellableId: 1, code: 'COMBO1', name: 'Combo Solo', category: 'COMBOS', description: '1 bắp vừa + 1 nước ngọt', price: 79_000, choice: { groupCode: 'DRINK', min: 1, max: 1, options: DRINKS } },
  { sellableType: 'COMBO', sellableId: 2, code: 'COMBO2', name: 'Combo Đôi', category: 'COMBOS', description: '1 bắp lớn + 2 nước ngọt', price: 129_000, choice: { groupCode: 'DRINK', min: 2, max: 2, options: DRINKS } },
  { sellableType: 'COMBO', sellableId: 3, code: 'COMBO3', name: 'Combo Party', category: 'COMBOS', description: '2 bắp lớn + 4 nước ngọt + 1 nachos phô mai', price: 249_000 },
  { sellableType: 'COMBO', sellableId: 4, code: 'COMBO4', name: 'Combo Nachos & Hot Dog', category: 'COMBOS', description: '1 nachos phô mai + 2 hot dog + 2 nước ngọt', price: 169_000, choice: { groupCode: 'DRINK', min: 2, max: 2, options: DRINKS } },
  { sellableType: 'COMBO', sellableId: 5, code: 'COMBO5', name: 'Combo Caramel', category: 'COMBOS', description: '1 bắp caramel + 1 snack khoai tây + 1 nước cam', price: 109_000 },
  { sellableType: 'SKU', sellableId: 21, code: 'POP-M', name: 'Bắp rang bơ vừa', category: 'POPCORN', price: 45_000, size: 'M' },
  { sellableType: 'SKU', sellableId: 22, code: 'POP-L', name: 'Bắp rang bơ lớn', category: 'POPCORN', price: 59_000, size: 'L' },
  { sellableType: 'SKU', sellableId: 11, code: 'COLA', name: 'Coca-Cola', category: 'DRINKS', price: 29_000, size: 'L' },
  { sellableType: 'SKU', sellableId: 12, code: 'SPRITE', name: 'Sprite', category: 'DRINKS', price: 29_000, size: 'L' },
  { sellableType: 'SKU', sellableId: 13, code: 'ORANGE', name: 'Nước cam', category: 'DRINKS', price: 29_000, size: 'L' },
  { sellableType: 'SKU', sellableId: 14, code: 'WATER', name: 'Nước suối', category: 'DRINKS', price: 20_000 },
  { sellableType: 'SKU', sellableId: 31, code: 'NACHOS', name: 'Nachos phô mai', category: 'SNACKS', description: 'Bánh nachos giòn kèm sốt phô mai', price: 49_000 },
  { sellableType: 'SKU', sellableId: 32, code: 'HOTDOG', name: 'Hot dog', category: 'SNACKS', description: 'Xúc xích nướng, bánh mì mềm', price: 39_000 },
];

export function catalog() {
  return MENU.map((m) => ({
    sellableType: m.sellableType,
    sellableId: m.sellableId,
    code: m.code,
    name: m.name,
    category: m.category,
    description: m.description,
    price: m.price,
    currency: 'VND',
    availability: 'AVAILABLE',
    size: m.size,
    components: (m.choice?.options ?? []).map((o) => ({
      groupCode: m.choice!.groupCode,
      allowedSkuId: o.skuId,
      skuCode: o.label,
      label: o.label,
      quantity: 1,
      minSelect: m.choice!.min,
      maxSelect: m.choice!.max,
    })),
  }));
}

export interface CartItem {
  sellableType: 'SKU' | 'COMBO';
  sellableId: number;
  quantity: number;
  selections?: { groupCode: string; skuIds: number[] }[];
}

/** Replaces the concessions of a pending booking with `items` (an empty list clears them). */
export async function setConcessions(db: Db, userId: string, bookingId: string, items: CartItem[]) {
  const b = await getEditableBooking(db, bookingId, userId);

  const seen = new Set<string>();
  b.concessions = items.map((item) => {
    const key = `${item.sellableType}:${item.sellableId}`;
    if (seen.has(key)) throw new HttpError(400, 'Mỗi món chỉ xuất hiện một lần trong giỏ.');
    seen.add(key);

    const menuItem = MENU.find((m) => m.sellableType === item.sellableType && m.sellableId === item.sellableId);
    if (!menuItem) throw new HttpError(400, 'Có món không còn trong thực đơn.');

    let options: string | undefined;
    if (menuItem.choice) {
      const { groupCode, min, max, options: allowed } = menuItem.choice;
      const picked = [...new Set(item.selections?.find((s) => s.groupCode === groupCode)?.skuIds ?? [])];
      const labels = picked.map((id) => allowed.find((o) => o.skuId === id)?.label);
      if (labels.some((l) => !l)) throw new HttpError(400, `Lựa chọn của ${menuItem.name} không hợp lệ.`);
      if (picked.length < min || picked.length > max) {
        throw new HttpError(400, `Vui lòng chọn ${min === max ? min : `${min}–${max}`} loại nước cho ${menuItem.name}.`);
      }
      options = labels.join(', ');
    }

    const amount = menuItem.price * item.quantity;
    return { itemCode: menuItem.code, itemName: menuItem.name, options, quantity: item.quantity, unitPrice: menuItem.price, discountAmount: 0, finalAmount: amount };
  });

  // Subtotals first: the promotion is judged against the new lines.
  Object.assign(b, reprice(b));
  syncPromotion(b);
  return saveEdit(db, b);
}

// ── Suggested food for a group (AI quick booking) ───────────────────────────

export interface SuggestedItem extends CartItem {
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  options?: string;
}

const suggestion = (code: string, quantity: number, drinkIds: number[] = []): SuggestedItem => {
  const m = MENU.find((x) => x.code === code)!;
  const selections = m.choice ? [{ groupCode: m.choice.groupCode, skuIds: drinkIds.slice(0, m.choice.max) }] : undefined;
  const options = m.choice ? drinkIds.slice(0, m.choice.max).map((id) => m.choice!.options.find((o) => o.skuId === id)?.label).join(', ') : undefined;
  return { sellableType: m.sellableType, sellableId: m.sellableId, quantity, selections, code: m.code, name: m.name, description: m.description, unitPrice: m.price, options };
};

/**
 * One combo line per kind that fits the group: Solo for one, Đôi for two, Party for four, combined for
 * other sizes (e.g. 3 = Đôi + Solo, 6 = Party + Đôi). Drinks default to Coca-Cola / Sprite.
 */
export function combosForParty(partySize: number): SuggestedItem[] {
  const n = Math.max(1, Math.min(8, partySize));
  const party = Math.floor(n / 4);
  const rest = n % 4;
  const items: SuggestedItem[] = [];
  if (party) items.push(suggestion('COMBO3', party));
  const duo = Math.floor(rest / 2);
  if (duo) items.push(suggestion('COMBO2', duo, [11, 12]));
  if (rest % 2) items.push(suggestion('COMBO1', 1, [11]));
  return items;
}
