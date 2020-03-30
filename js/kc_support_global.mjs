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
export const SUPPORT_EQUIPLIST_DEF = [
	{category: "大型電探", className: "radar_L"},
	{category: "小型電探", className: "radar_S"},
	{category: "大口径主砲", className: "maingun_L"},
	{category: "中口径主砲", className: "maingun_M", default_hidden: true},
	{category: "小口径主砲", className: "maingun_S", default_hidden: true},
	{category: "副砲", className: "secgun", default_hidden: true},
	{category: "艦上爆撃機", className: "cv_bomber", airplane: true},
	{category: "噴式戦闘爆撃機", className: "cv_jet", airplane: true},
	{category: "艦上攻撃機", className: "cv_attacker", airplane: true},
	{category: "対空機銃", className: "antiair", ignore_zero_param: true},
	{category: "水上艦要員", className: "personnel", ignore_zero_param: true},
//	{category: "航空要員", className: "antiair"},
];

// LocalStorage に保存するデータのバージョン
export const SUPPORT_SAVEDATA_VERSION = 1;

// ページの読込ごとに変更される定数
export const PAGE_TOKEN = Math.floor(Math.random() * 0xffffffff).toString(16);
