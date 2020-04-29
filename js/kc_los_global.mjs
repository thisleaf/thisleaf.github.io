// 索敵計算機定数

// 除外リスト
// 基地関係
export const IGNORE_CATEGORIES = [
	"陸上攻撃機",
	"陸軍戦闘機",
	"局地戦闘機",
	"陸上偵察機"
];

// 装備リストの割り振り
// 要素が列になる
export const HINT_TABLE_CATEGORY_DEF = [
	[
		{category: "水上偵察機", header_bgcolor: "#cfc"},
		{category: "多用途水上機/水上爆撃機", viewname: "水上爆撃機", header_bgcolor: "#cfc"},
		{category: "水上戦闘機", header_bgcolor: "#9f9"},
		{category: "対潜哨戒機", header_bgcolor: "#eff"},
		{category: "回転翼機"  , header_bgcolor: "#eff"},
	], [
		{category: "小型電探"  , header_bgcolor: "#ffc"},
		{category: "大型電探"  , header_bgcolor: "#ffc"},
		{category: "艦上偵察機", header_bgcolor: "#ff8"},
		{category: "噴式戦闘爆撃機", header_bgcolor: "#ff8"},
		{viewname: "その他", other: true, header_bgcolor: "#ddd"},
	], [
		{category: "艦上攻撃機", header_bgcolor: "#59f"},
		{category: "艦上爆撃機", header_bgcolor: "#f66"},
		{category: "艦上戦闘機", header_bgcolor: "#7f7"},
	]
];

// 索敵の係数定義
// (装備索敵値 + sqrt(装備改修値) * impr_factor) * factor
export const LOS_FACTOR_DEF = [
	{category: "水上偵察機", factor: 1.2, impr_factor: 1.2},
	{category: "多用途水上機/水上爆撃機", factor: 1.1, impr_factor: 1.15},
	{category: "艦上偵察機", factor: 1.0, impr_factor: 1.2},
	{category: "艦上攻撃機", factor: 0.8, impr_factor: 0},
	{category: "小型電探", factor: 0.6, impr_factor: 1.25},
	{category: "大型電探", factor: 0.6, impr_factor: 1.4},
];

export const LOS_FACTOR_OTHER = {factor: 0.6, impr_factor: 0};

// その他の種別ID
export const LOS_CATEGORY_OTHER_ID = 10000;

// 種別
export const LOS_CATEGORIES_DEF = [
	{id: 1, category: "水上偵察機"},
	{id: 2, category: "多用途水上機/水上爆撃機", viewname: "水上爆撃機"},
	{id: 3, category: "水上戦闘機"},
	{id: 4, category: "対潜哨戒機"},
	{id: 5, category: "回転翼機"},
	{id: 6, category: "小型電探"},
	{id: 7, category: "大型電探"},
	{id: 8, category: "艦上偵察機"},
	{id: 9, category: "噴式戦闘爆撃機"},
	{id: 10, category: "艦上攻撃機"},
	{id: 11, category: "艦上爆撃機"},
	{id: 12, category: "艦上戦闘機"},
	{id: LOS_CATEGORY_OTHER_ID, viewname: "その他", other: true},
];


// デフォルトの数
export const SHIP_COUNT_MAX = 12;
export const EQUIPMENT_ROW_DEFAULT = 12;
export const EQUIPMENT_ROW_MIN = 4;
export const EQUIPMENT_ROW_MAX = 48;
export const EQUIPMENT_ROW_EACH = 4;

export const NULL_ID = 0;
export const DIRECT_INPUT_ID = -1;


// 装備ボーナス
// 条件に当てはまるものはすべて合算
export const LOS_EQUIPBONUS_LASTMOD = "2020/04/28";

export const LOS_EQUIPBONUS = [
	{	// Late 298B
		equipment_id: 194,
		ship_names: [
			"Richelieu改",
			"Commandant Teste", "Commandant Teste改",
			"瑞穂", "瑞穂改",
			"神威", "神威改", "神威改母",
		],
		LoS: 2, accumulation: "可", effect: "艦娘索敵値に加算",
		
	}, { // 彩雲
		equipment_id: 54,
		ship_types: ["正規空母", "装甲空母", "軽空母"],
		ignore_ship_names: ["春日丸", "大鷹", "大鷹改", "神鷹", "神鷹改"],
		LoS: i => (i == 0 ? 0 : i == 2 ? 1 : null), accumulation: "不可", effect: "艦娘索敵値に加算",
		
	}, { // 試製景雲
		equipment_id: 151,
		ship_types: ["装甲空母"],
		LoS: i => Math.floor((i + 2) / 4), accumulation: "不可", effect: "艦娘索敵値に加算",
		text: "数値は暫定",
		
	}, { // 二式艦偵
		equipment_id: 61,
		ship_types: ["正規空母", "装甲空母", "軽空母"],
		ship_names: ["伊勢改二", "日向改二"],
		LoS: i => Math.floor((i + 2) / 4), accumulation: "不可", effect: "艦娘索敵値に加算",
	}, {
		equipment_id: 61,
		ship_names: ["瑞鳳改二乙", "鈴谷航改二", "熊野航改二"],
		LoS: i => (i >= 1 ? 1 : 0), accumulation: "不可", effect: "艦娘索敵値に加算",
	}, {
		equipment_id: 61,
		ship_names: ["飛龍", "飛龍改", "飛龍改二"],
		LoS: i => (i >= 1 ? 2 : 0), accumulation: "不可", effect: "艦娘索敵値に加算",
	}, {
		equipment_id: 61,
		ship_names: ["蒼龍", "蒼龍改", "蒼龍改二"],
		LoS: i => (i >= 8 ? 4 : i >= 1 ? 3 : 0), accumulation: "不可", effect: "艦娘索敵値に加算",
		
	}, {
		// SG レーダー(初期型)
		equipment_id: 315,
		ship_names: [
			"Fletcher", "Fletcher改", 
			"Johnston", "Johnston改",
			"Samuel B.Roberts", "Samuel B.Roberts改",
			"Colorado", "Colorado改",
			"Iowa", "Iowa改",
			"Saratoga", "Saratoga改", "Saratoga Mk.II", "Saratoga Mk.II Mod.2",
			"Intrepid", "Intrepid改",
			"Gambier Bay", "Gambier Bay改",
			"Houston", "Houston改",
			"Atlanta", "Atlanta改",
		],
		LoS: 4, accumulation: "可", effect: "索敵スコアには影響しない",
		
	}, { // 熟練見張員
		equipment_id: 129,
		jp_ship_types: ["駆逐艦"],
		LoS: 1, accumulation: "可", effect: "艦娘索敵値に加算",
	}, {
		equipment_id: 129,
		jp_ship_types: [
			"軽巡洋艦", "実験軽巡洋艦", "練習巡洋艦", "重雷装巡洋艦",
			"重巡洋艦", "航空巡洋艦",
		],
		LoS: 3, accumulation: "可", effect: "艦娘索敵値に加算",
		
	}, { // Swordfish(水上機型)
		equipment_id: 367,
		ship_names: [
			"Gotland", "Gotland改", "Gotland andra",
			"Commandant Teste", "Commandant Teste改",
			"瑞穂", "瑞穂改",
			"神威", "神威改", "神威改母",
		],
		LoS: 1, accumulation: "不明", effect: "艦娘索敵値に加算",
		
	}, { // Swordfish Mk.III改(水上機型)
		equipment_id: 368,
		ship_names: [
			"Gotland", "Gotland改",
		],
		LoS: 3, accumulation: "可", effect: "影響不明",
	}, {
		equipment_id: 368,
		ship_names: [
			"Gotland andra",
		],
		LoS_mul: [4, 7], effect: "影響不明",
	}, {
		equipment_id: 368,
		ship_names: [
			"Commandant Teste", "Commandant Teste改",
			"瑞穂", "瑞穂改",
			"神威", "神威改", "神威改母",
		],
		LoS: 2, accumulation: "可", effect: "影響不明",
		
	}, { // Swordfish Mk.III改(水上機型/熟練)
		equipment_id: 369,
		ship_names: [
			"Gotland", "Gotland改",
			"Commandant Teste", "Commandant Teste改",
		],
		LoS: 3, accumulation: "不明", effect: "影響不明",
	}, {
		equipment_id: 369,
		ship_names: [
			"Gotland andra",
		],
		LoS: 5, accumulation: "不明", effect: "影響不明",
	}, {
		equipment_id: 369,
		ship_names: [
			"瑞穂", "瑞穂改",
			"神威", "神威改", "神威改母",
		],
		LoS: 2, accumulation: "不明", effect: "影響不明",
		
	}, { // Swordfish Mk.II改(水偵型)
		equipment_id: 370,
		ship_names: [
			"Gotland", "Gotland改", "Gotland andra",
			"Nelson", "Nelson改",
		],
		LoS: 2, accumulation: "不明", effect: "艦娘索敵値に加算",
	}, {
		equipment_id: 370,
		ship_names: [
			"Commandant Teste", "Commandant Teste改",
			"瑞穂", "瑞穂改",
			"神威", "神威改", "神威改母",
		],
		LoS: 1, accumulation: "不明", effect: "艦娘索敵値に加算",
	}, {
		equipment_id: 370,
		ship_names: [
			"Warspite", "Warspite改",
		],
		LoS: 3, accumulation: "不明", effect: "艦娘索敵値に加算",
		
	}, { // Fairey Seafox改
		equipment_id: 371,
		ship_names: [
			"Gotland", "Gotland改",
		],
		LoS: 6, accumulation: "不明", effect: "影響不明",
	}, {
		equipment_id: 371,
		ship_names: [
			"Gotland andra",
		],
		LoS: 9, accumulation: "不明", effect: "影響不明",
	}, {
		equipment_id: 371,
		ship_names: [
			"Nelson", "Nelson改",
		],
		LoS: 5, accumulation: "不明", effect: "影響不明",
	}, {
		equipment_id: 371,
		ship_names: [
			"Commandant Teste", "Commandant Teste改",
		],
		LoS: 4, accumulation: "不明", effect: "影響不明",
	}, {
		equipment_id: 371,
		ship_names: [
			"Warspite", "Warspite改",
			"Richelieu", "Richelieu改",
		],
		LoS: 3, accumulation: "不明", effect: "影響不明",
	}
];

