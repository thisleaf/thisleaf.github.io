// グローバルに使える定数・変数定義

// 攻撃力キャップ
export const SUPPORT_POWER_CAP = 150;
// 砲撃支援補正
export const SUPPORT_MODIFY = -1;

// 交戦形態
export const ENGAGEMENT_FORM_DEFINITION = [
	{name: "同航戦" , support: 1.0},
	{name: "反航戦" , support: 0.8},
	{name: "T字不利", support: 0.6},
	{name: "T字有利", support: 1.2},
];

// 陣形
export const FORMATION_DEFINITION = [
	{name: "単縦陣", support: 1.0},
	{name: "複縦陣", support: 0.8},
	{name: "輪形陣", support: 0.7},
	{name: "梯形陣", support: 0.75},
	{name: "単横陣", support: 0.6},
	{name: "警戒陣", support: 0.5},
	// 連合艦隊はどれも同じっぽい？
	{name: "連合艦隊", support: 1.0},
];

// wiki: 交戦形態補正、攻撃側陣形補正、損傷補正の3つは左側の補正から順に乗算。

// 装備の表示と分類
/*
viewname: 表示名、省略するとcategory
category: メインのカテゴリー(省略可)
cates: カテゴリー名の配列(表示はカテゴリーごと)
ids: ID指定(IDの配列)
tab_class_name: 
airplane: 航空機かどうか
ignore_zero_param: 寄与しない装備は無視

「すべて」での表示順はここで現れた順番になる
装備の重複はないと仮定する
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
	{viewname: "機銃/見張員", cates: ["対空機銃", "水上艦要員"], ignore_zero_param: true},
//	{category: "航空要員"},
];

// 表示するパラメータ
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

// ソートのカテゴリーの順番定義
// ここにないものは後ろ
export const SORT_CATEGORY_DEF = [
	"大口径主砲",
	"中口径主砲",
	"小口径主砲",
	"艦上攻撃機",
	"艦上爆撃機",
	"噴式戦闘爆撃機",
	"副砲",
	"大型電探",
	"小型電探",
	"水上艦要員",
	"対空機銃",
];


/* 装備の優先順位定義
大和電探＞大型電探＞小型電探
51砲＞大口径主砲
噴式＞艦攻・艦爆
副砲＞ほか
など
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
	// 該当なし
	{value: 0, is_default: true},
];

// LocalStorage に保存するデータのバージョン
export const SUPPORT_SAVEDATA_VERSION = 2;

// ページの読込ごとに変更される定数
export const PAGE_TOKEN = Math.floor(Math.random() * 0xffffffff).toString(16);

// 各種設定
export const DefaultSettings = {
	// マルチスレッドの設定
	// 最大スレッド数
	ThreadMax: 32,
	// 実行していないワーカーの生存時間(msec)
	ThreadKeepTime: 30000,
	// チェック間隔
	ThreadDestroyInterval: 5000,
	// マルチスレッド探索を利用する
	MultiThreading: false,
	// スレッド数の指定 "auto": 自動, "custom": 指定
	ThreadCountMode: "auto",
	// "custom" の場合のスレッド数
	CustomThreadCount: navigator.hardwareConcurrency || 1,
	// 探索後待機状態に移行、時間経過で解放
	ThreadKeepAlive: true,
	
	// 焼きなまし
	// 反復回数倍率*100
	AnnealingIteration100: 100,
	AnnealingIterationMin100: 10,
	AnnealingIterationMax100: 2000,
};

export const Settings = Object.create(DefaultSettings);

