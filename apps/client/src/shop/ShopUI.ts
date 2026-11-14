import { WEAPONS, WEAPON_IDS, type WeaponCategory, type WeaponId } from '../game/WeaponCatalog';
import type { PlayerRecord } from '../network/Multiplayer';
import SHOP from '../../../../packages/shared/ShopRules.json';

type Category = WeaponCategory | 'all';
const categories: Record<Category, { name: string; icon: string; subtitle: string }> = {
  all: { name: '所有武器', icon: '◈', subtitle: 'ARSENAL' },
  pistol: { name: '手槍', icon: '⌁', subtitle: 'SIDEARMS' },
  smg: { name: '衝鋒槍', icon: '≋', subtitle: 'SUBMACHINE' },
  ar: { name: '突擊步槍', icon: '⟿', subtitle: 'ASSAULT' },
  lmg: { name: '輕／重機槍', icon: '▱', subtitle: 'SUPPRESSION' },
  sniper: { name: '狙擊步槍', icon: '⊕', subtitle: 'PRECISION' }
};
const escapeHTML = (value: string): string => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c] || c));
const money = (amount: number) => '$' + amount.toLocaleString('en-US');
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const fill = (value: number, max: number) => Math.round(clamp(value / max * 100, 0, 100));
const stat = (title: string, value: string, progress: number) =>
  `<div class="shop-stat"><div><span>${title}</span><strong>${value}</strong></div><i><b style="width:${progress}%"></b></i></div>`;

export class ShopUI {
  readonly root: HTMLDivElement;
  isOpen = false;
  private selected: Category = 'all';
  private focused: WeaponId = 'magnum';
  private data: PlayerRecord | null = null;
  private phase = 'lobby';
  private remainingMs = 0;
  private remainingSeconds = -1;
  private lastSignature = '';

  constructor(
    private readonly buy: (sku: string) => void,
    private readonly equip: (id: WeaponId) => void,
    private readonly closeCallback: () => void
  ) {
    this.root = document.createElement('div');
    this.root.id = 'shop-panel';
    this.root.className = 'hidden';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', '武器補給商店');
    this.root.setAttribute('aria-modal', 'true');
    document.body.append(this.root);
    this.root.addEventListener('click', event => {
      const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      if (action === 'close') { this.close(); return; }
      if (action === 'tab' && el.dataset.category) {
        this.selected = el.dataset.category as Category;
        this.render();
        return;
      }
      if (action === 'focus' && el.dataset.sku) {
        this.focused = el.dataset.sku as WeaponId;
        this.render();
        return;
      }
      if (action === 'buy' && el.dataset.sku) this.buy(el.dataset.sku);
      if (action === 'equip' && el.dataset.sku) this.equip(el.dataset.sku as WeaponId);
    });
  }

  toggle(p: PlayerRecord | null): void { this.isOpen ? this.close() : this.open(p); }
  open(p: PlayerRecord | null): void {
    this.data = p;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
  }
  close(silent = false): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.lastSignature = '';
    if (!silent) this.closeCallback();
  }
  setContext(phase: string, remainingMs: number): void {
    const changed = phase !== this.phase;
    this.phase = phase;
    if (changed && this.isOpen) this.render();
    this.setRemaining(remainingMs);
  }
  setRemaining(value: number): void {
    this.remainingMs = Math.max(0, value);
    const seconds = Math.ceil(this.remainingMs / 1000);
    if (seconds === this.remainingSeconds) return;
    this.remainingSeconds = seconds;
    const timer = this.root.querySelector<HTMLElement>('[data-shop-time]');
    if (timer) timer.textContent = `00:${String(seconds).padStart(2, '0')}`;
    const line = this.root.querySelector<HTMLElement>('[data-shop-progress]');
    if (line) line.style.width = `${fill(this.remainingMs, SHOP.intermissionMs)}%`;
  }
  update(p: PlayerRecord | null): void {
    this.data = p;
    const signature = JSON.stringify([
      p?.money, p?.armor, p?.hp, p?.maxHp, p?.level,
      p?.weaponId, p?.inSafehouse, p?.downed, p?.reserve, p?.owned,
      this.phase
    ]);
    if (this.isOpen && signature !== this.lastSignature) this.render();
  }

  private render(): void {
    const p = this.data;
    const balance = p?.money ?? 0;
    const armor = p?.armor ?? 0;
    const hp = p?.hp ?? 100;
    const maxHp = p?.maxHp ?? 100;
    const safeWindow = this.phase === 'intermission';
    const canPurchase = !!p && !p.downed && (safeWindow || p.inSafehouse);
    const focus = WEAPONS[this.focused];
    const ownedFocus = p?.owned?.includes(this.focused) ?? false;
    const equippedFocus = p?.weaponId === this.focused;

    const tabs = (Object.entries(categories) as [Category, typeof categories[Category]][])
      .map(([key, info]) => `<button type="button" class="shop-category ${this.selected === key ? 'active' : ''}"
          data-action="tab" data-category="${key}" aria-pressed="${this.selected === key}">
          <span class="shop-category-icon">${info.icon}</span>
          <span><strong>${info.name}</strong><small>${info.subtitle}</small></span>
          <span class="shop-category-count">${key === 'all' ? WEAPON_IDS.length : WEAPON_IDS.filter(id => WEAPONS[id].category === key).length}</span>
        </button>`).join('');

    const cards = WEAPON_IDS.filter(id => this.selected === 'all' || WEAPONS[id].category === this.selected)
      .map(id => {
        const w = WEAPONS[id];
        const owned = p?.owned?.includes(id) ?? false;
        const equipped = p?.weaponId === id;
        const canAfford = balance >= w.price;
        const badge = equipped ? '已裝備' : owned ? '已擁有' : canAfford ? '可購買' : '金錢不足';
        const badgeClass = equipped ? 'equipped' : owned ? 'owned' : canAfford ? 'affordable' : 'locked';
        return `<button type="button" class="shop-weapon-tile ${id === this.focused ? 'active' : ''}"
          data-action="focus" data-sku="${id}" aria-pressed="${id === this.focused}">
          <div class="shop-tile-top"><span>${categories[w.category].subtitle} / ${escapeHTML(id.toUpperCase())}</span>
            <span class="shop-tile-badge ${badgeClass}">${badge}</span></div>
          <div class="shop-tile-art"><div class="weapon-silhouette ${w.category}"><i></i><b></b></div></div>
          <strong class="shop-tile-name">${escapeHTML(w.name)}</strong>
          <div class="shop-tile-bottom"><span>${owned ? '已解鎖' : money(w.price)}</span>
            <span>DMG ${w.damage} · ${w.magazine} 發</span></div>
        </button>`;
      }).join('');

    const focusAction = ownedFocus ? 'equip' : 'buy';
    const focusLabel = equippedFocus ? '✓ 目前使用中' : ownedFocus ? '裝備武器' : `購買武器 · ${money(focus.price)}`;
    const focusDisabled = equippedFocus || (!ownedFocus && (!canPurchase || balance < focus.price));
    const armorCost = Math.ceil(Math.max(0, 100 - armor) * SHOP.armorPricePerPoint);
    const ammoSpec = p?.weaponId ? WEAPONS[p.weaponId as WeaponId] : null;
    const ammoFull = !ammoSpec || ammoSpec.category === 'pistol' || (p?.reserve ?? 0) >= ammoSpec.reserve;
    const medkitFull = hp >= maxHp;
    const buyingNote = safeWindow
      ? '安全採購期：全隊可在任何位置補給，倒數結束才開始下一波。'
      : p?.inSafehouse
        ? '已進入安全屋範圍，可以購買武器和補給。'
        : '戰鬥期間請返回中央安全屋（12m 範圍）購物。';

    this.root.innerHTML = `<div class="shop-window">
      <header class="shop-header">
        <div class="shop-identity"><span class="shop-logo">D<span>4</span></span><div>
          <p class="shop-kicker">DEADLINE FOUR / SURVIVOR SUPPLY</p>
          <h2>戰術補給站 <em>TACTICAL ARMORY</em></h2>
        </div></div>
        <div class="shop-header-tools">
          ${safeWindow ? `<div class="shop-round-timer"><span>距離第 ${this.phase === 'intermission' ? '下一' : ''} 波</span><strong data-shop-time>00:${String(Math.ceil(this.remainingMs / 1000)).padStart(2, '0')}</strong></div>` : '<span class="shop-location-badge">安全屋補給系統</span>'}
          <button class="close-shop" type="button" data-action="close" aria-label="關閉商店">✕ <span>關閉 · B</span></button>
        </div>
      </header>
      ${safeWindow ? `<div class="shop-timer-track"><div data-shop-progress style="width:${fill(this.remainingMs, SHOP.intermissionMs)}%"></div></div>` : ''}
      <div class="shop-account"><div><small>可用現金 / CASH</small><strong class="cash">${money(balance)}</strong></div>
        <div><small>等級 / LEVEL</small><strong>LV ${p?.level ?? 1}</strong></div>
        <div><small>目前生命</small><strong>${Math.ceil(hp)} <span>/ ${maxHp}</span></strong></div>
        <div><small>防護裝甲</small><strong>${Math.round(armor)} <span>/ 100</span></strong></div>
        <div class="shop-access ${canPurchase ? 'ready' : 'denied'}">${canPurchase ? '● 商店開放中' : '● 目前無法購買'}</div>
      </div>
      <div class="shop-body">
        <nav class="shop-sidebar" aria-label="武器分類"><div class="shop-section-title">武器分類 <small>CATEGORIES</small></div>${tabs}
          <div class="shop-sidebar-tip"><strong>採購提醒</strong><p>${buyingNote}</p></div>
        </nav>
        <main class="shop-inventory"><div class="shop-section-title">武器展示 <small>${this.selected === 'all' ? 'ALL EQUIPMENT' : categories[this.selected].subtitle}</small></div>
          <div class="shop-weapon-grid">${cards}</div>
        </main>
        <aside class="shop-inspector"><div class="shop-section-title">武器詳情 <small>INSPECTION</small></div>
          <div class="shop-detail-brand">${categories[focus.category].subtitle} / ${escapeHTML(this.focused.toUpperCase())}</div>
          <h3>${escapeHTML(focus.name)}</h3>
          <div class="shop-preview"><div class="weapon-silhouette ${focus.category}"><i></i><b></b></div></div>
          <div class="shop-selected-price">${ownedFocus ? '已擁有' : money(focus.price)}
            <span>${focus.automatic ? '連射武器' : '半自動武器'}</span></div>
          <div class="shop-detail-stats">
            ${stat('單發傷害', String(focus.damage), fill(focus.damage, 60))}
            ${stat('射速', `${focus.rpm} RPM`, fill(focus.rpm, 1000))}
            ${stat('彈匣', `${focus.magazine} 發`, fill(focus.magazine, 120))}
            ${stat('換彈時間', `${(focus.reloadMs / 1000).toFixed(2)} 秒`, 100 - fill(focus.reloadMs, 6500))}
            ${stat('穿透能力', `${focus.penetration} 層`, fill(focus.penetration, 3))}
          </div>
          <button class="shop-primary-action" type="button" data-action="${focusAction}" data-sku="${this.focused}"
            ${focusDisabled ? 'disabled' : ''}>${focusLabel}</button>
          <div class="shop-detail-hint">${ownedFocus ? '已解鎖武器可免費切換裝備' : canPurchase ? '消費將由伺服器核對金額' : '目前僅可檢視武器'}</div>
        </aside>
      </div>
      <footer class="shop-supplies"><div class="shop-supplies-head"><strong>戰場補給</strong><small>FIELD SUPPLIES · 補給購買即時生效</small></div>
        <div class="shop-supply-items">
          <div class="shop-supply"><span class="shop-supply-icon">▣</span><div><strong>護甲修復</strong><small>補滿至 100 護甲值</small></div>
            <button type="button" data-action="buy" data-sku="armor" ${!canPurchase || armor >= 100 || balance < armorCost ? 'disabled' : ''}>${armor >= 100 ? '已滿' : money(armorCost)}</button></div>
          <div class="shop-supply"><span class="shop-supply-icon">✚</span><div><strong>急救補給</strong><small>恢復最多 ${SHOP.medkitHeal} HP</small></div>
            <button type="button" data-action="buy" data-sku="medkit" ${!canPurchase || medkitFull || balance < SHOP.medkitCost ? 'disabled' : ''}>${medkitFull ? '已滿' : money(SHOP.medkitCost)}</button></div>
          <div class="shop-supply"><span class="shop-supply-icon">▥</span><div><strong>彈藥補充</strong><small>補滿目前主武器備彈</small></div>
            <button type="button" data-action="buy" data-sku="ammo" ${!canPurchase || ammoFull || balance < SHOP.ammoCost ? 'disabled' : ''}>${ammoFull ? '無需補給' : money(SHOP.ammoCost)}</button></div>
        </div>
      </footer>
    </div>`;
    this.lastSignature = JSON.stringify([
      p?.money, p?.armor, p?.hp, p?.maxHp, p?.level,
      p?.weaponId, p?.inSafehouse, p?.downed, p?.reserve, p?.owned,
      this.phase
    ]);
    this.remainingSeconds = -1;
    this.setRemaining(this.remainingMs);
  }
}
