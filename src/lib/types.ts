export type Zone = 'main' | 'extra' | 'side';
export type CardCategory = 'Monster' | 'Spell' | 'Trap';
export interface Card {
  id: number;
  name: string;
  type: string;
  category: CardCategory;
  frame: string;
  description: string;
  attribute: string | null;
  race: string;
  level: number | null;
  atk: number | null;
  def: number | null;
  archetype: string | null;
  image: string;
  imageSmall: string;
  limit: number;
  extra: boolean;
}
export interface Entry {
  cardId: number;
  zone: Zone;
  quantity: number;
}
export interface Deck {
  id: string;
  name: string;
  entries: Entry[];
  version: number;
  updatedAt: string;
}
export interface CatalogStatus {
  source: 'demo' | 'ygoprodeck' | 'file';
  count: number;
  updatedAt: string;
  banlist: string;
  banlistVersion?: string;
}
export interface CatalogResponse {
  cards: Card[];
  total: number;
  page: number;
  pages: number;
  archetypes: string[];
  races: string[];
  status: CatalogStatus;
}
