/**
 * @fileoverview グローバルに使える定数・変数定義
 * @module Global
 */

/**
 * 最大レベル
 * @type {number}
 */
export const MAX_SHIP_LEVEL = 175;
/**
 * 攻撃力キャップ(支援艦隊)
 * @type {number}
 */ 
export const SUPPORT_POWER_CAP = 170;
/**
 * 砲撃支援補正
 * @type {number}
 */ 
export const SUPPORT_MODIFY = -1;

/**
 * 交戦形態
 * @type {Array.<{name:string, support:number, className:string}>}
 */
export const ENGAGEMENT_FORM_DEFINITION = [
	{name: "同航戦" , support: 1.0, className: "parallel"},
	{name: "反航戦" , support: 0.8, className: "head_on"},
	{name: "T字不利", support: 0.6, className: "t_disadvantage"},
	{name: "T字有利", support: 1.2, className: "t_advantage"},
];

/**
 * 陣形
 * @type {Array.<{name:string, support:number, className:string}>}
 */
export const FORMATION_DEFINITION = [
	{viewname: "単縦陣 (vs通常)", name: "単縦陣", support: 1.0 , className: "line_ahead"},
	{viewname: "複縦陣 (vs通常)", name: "複縦陣", support: 0.8 , className: "double_line"},
	{viewname: "輪形陣 (vs通常)", name: "輪形陣", support: 0.7 , className: "diamond"},
	{viewname: "梯形陣 (vs通常)", name: "梯形陣", support: 0.75, className: "echelon"},
	{viewname: "単横陣 (vs通常)", name: "単横陣", support: 0.6 , className: "line_abreast"},
	{viewname: "警戒陣 (vs通常)", name: "警戒陣", support: 0.5 , className: "vanguard"},
	// 連合艦隊はどれも同じっぽい？
	{name: "連合艦隊", support: 1.0, className: "combined"},
];

// wiki: 交戦形態補正、攻撃側陣形補正、損傷補正の3つは左側の補正から順に乗算。

/**
 * @typedef SupportOwnEquipmentDef
 * @prop {?string} viewname 表示名、省略するとcategory
 * @prop {?string} category メインのカテゴリー(省略可)
 * @prop {?Array.<string>} cates カテゴリー名の配列(表示はカテゴリーごと)
 * @prop {?Array.<number>} ids ID指定(IDの配列)
 * @prop {?boolean} airplane 航空機かどうか
 * @prop {?boolean} ignore_zero_param 寄与しない装備は無視
 */
/**
 * 装備の表示と分類<br>
 * 「すべて」での表示順はここで現れた順番になる<br>
 * 装備の重複はないと仮定する
 * @type {Array.<SupportOwnEquipmentDef>}
 */
export const SUPPORT_EQUIPLIST_DEF = [
	{category: "小型電探"},
	{category: "大型電探"},
	{category: "小口径主砲"},
	{category: "中口径主砲"},
	{category: "大口径主砲"},
	{category: "副砲"},
	{viewname: "艦爆/噴式", cates: ["艦上爆撃機", "噴式戦闘爆撃機"], airplane: true},
	{viewname: "艦攻", category: "艦上攻撃機", airplane: true},
	{viewname: "艦偵", category: "艦上偵察機", airplane: true},
	{viewname: "瑞雲", category: "多用途水上機/水上爆撃機", airplane: true},
	{viewname: "機銃ほか", cates: ["対空機銃", "水上艦要員", "司令部施設"], ignore_zero_param: true},
//	{category: "航空要員"},
];

/**
 * 装備の詳細で表示するパラメータ
 * @type {Array.<{viewname, key, show_zero}>}
 */
export const SUPPORT_EQUIPDETAIL_PARAMS = [
	{viewname: "火力", key: "firepower", show_zero: true},
	{viewname: "雷装", key: "torpedo", show_zero: false},
	{viewname: "爆装", key: "bombing", show_zero: false},
	{viewname: "対空", key: "antiair", show_zero: false},
	{viewname: "対潜", key: "ASW", show_zero: false},
	{viewname: "索敵", key: "LoS", show_zero: false},
	{viewname: "命中", key: "accuracy", show_zero: true},
	{viewname: "回避", key: "evasion", show_zero: false},
	{viewname: "装甲", key: "armor", show_zero: false},
	{viewname: "対爆", key: "antibomber", show_zero: false},
	{viewname: "迎撃", key: "interception", show_zero: false},
];

// ソート順
export const SORT_BY_ID       = 1;
export const SORT_BY_POWER    = 2;
export const SORT_BY_ACCURACY = 3;

/**
 * ソートのカテゴリーの順番定義
 * ここにないものは後ろ
 * @type {Array.<string>}
 */
export const SORT_CATEGORY_DEF = [
	"大口径主砲",
	"中口径主砲",
	"小口径主砲",
	"艦上攻撃機",
	"艦上爆撃機",
	"噴式戦闘爆撃機",
	"艦上偵察機",
	"水上偵察機",
	"多用途水上機/水上爆撃機",
	"水上戦闘機",
	"副砲",
	"大型電探",
	"小型電探",
	"水上艦要員",
	"司令部施設",
	"対空機銃",
];


/** 装備の優先順位定義<br>
 * 大和電探＞大型電探＞小型電探<br>
 * 51砲＞大口径主砲<br>
 * 噴式＞艦攻・艦爆<br>
 * 副砲＞ほか<br>
 * など
 * @type {Array.<{value, ids, cates, is_default}>}
 */
export const EQUIP_PRIORITY_DEF = [
	// 上が優先、該当なしは0
	// 大和電探
	{value: 4, ids: [142]},
	// 大型電探
	{value: 2, cates: ["大型電探"]},
	// 51砲
	{value: 2, ids: [128, 281]},
	// 噴式
	{value: 1, cates: ["噴式戦闘爆撃機"]},
	// 副砲、中口径主砲
	{value: 1, cates: ["副砲", "中口径主砲"]},
	// 熟練見張員
	// {value: 1, ids: [129]},
	// 水雷戦隊 熟練見張員
	{value: -0.5, ids: [412]},
	// 精鋭水雷戦隊 司令部
	{value: -1, ids: [413]},
	// 該当なし
	{value: 0, is_default: true},
];

/** LocalStorage に保存するデータのバージョン
 * @type {number}
 */
export const SUPPORT_SAVEDATA_VERSION = 2;

/** ページの読込ごとに変更される定数
 * @type {number}
 */
export const PAGE_TOKEN = Math.floor(Math.random() * 0xffffffff).toString(16);

/**
 * 各種設定のデフォルト値
 * @type {Object}
 */
export const DefaultSettings = {
	ThreadMax: 32,
	ThreadKeepTime: 30000,
	ThreadDestroyInterval: 5000,
	MultiThreading: false,
	ThreadCountMode: "auto",
	CustomThreadCount: navigator.hardwareConcurrency || 1,
	ThreadKeepAlive: true,
	PriorityOption: "separate",
	AnnealingIteration100: 100,
	AnnealingIterationMin100: 10,
	AnnealingIterationMax100: 2000,
};

/**
 * 各種設定
 * @namespace
 * @prop {number} ThreadMax 最大スレッド数
 * @prop {number} ThreadKeepTime 実行していないワーカーの生存時間(msec)
 * @prop {number} ThreadDestroyInterval チェック間隔
 * @prop {boolean} MultiThreading マルチスレッド探索を利用する
 * @prop {("auto"|"custom")} ThreadCountMode スレッド数の指定
 * @prop {number} CustomThreadCount "custom" の場合のスレッド数
 * @prop {boolean} ThreadKeepAlive 探索後待機状態に移行、時間経過で解放
 * @prop {("separate"|"entire")} PriorityOption 優先度の扱い
 * @prop {number} AnnealingIteration100 焼きなまし 反復回数倍率*100
 * @prop {number} AnnealingIterationMin100 AnnealingIteration100の最小値(readonly)
 * @prop {number} AnnealingIterationMax100 AnnealingIteration100の最大値(readonly)
 */
export const Settings = Object.create(DefaultSettings);

