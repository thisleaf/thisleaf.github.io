/* 装備関係
EquipmentDatabase
	データベース
	
EquipableInfo
	装備可能かどうかなどの判定
	データは csv に定義しておく
	
EquipmentSelect
	EquipableInfo からフォームを作成
	
EquipmentSlot
	装備スロットの情報を表す。改修値や装備ボーナスのデータを仲介する
	
EquipmentBonusData
EquipmentBonus
	装備ボーナスを得る
*/

import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT} from "./utility.mjs";

export {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
};


// EquipmentDatabase -------------------------------------------------------------------------------
// 装備のデータベース　色々なクラスで使われる
// 最初に初期化しておく
Object.assign(EquipmentDatabase, {
	// 無変換のデータ
	csv_equiplist_raw: null,
	csv_equipable_raw: null,
	// csvのデータ
	// 基本的には無変換と同じだが、文字列が数値に変換されていたりする
	csv_shiplist  : null,
	csv_equiplist : null,
	csv_equipable : null,
	csv_equipbonus: null,
	// 装備ボーナス
	bonusdata_array: null, // EquipmentBonusData[]
	// map: 装備ID -> 装備データ(csv)
	equipment_data_map: null,
	// 装備IDの最大値
	// 初期化でも利用するため、最初のほうで設定しなければならない
	equipment_max_number: 0,
	
	initialized: false,
	init_jp_def: EquipmentDatabase_init_jp_def,
	initialize : EquipmentDatabase_initialize,
	
	// マルチスレッド用
	// 通常のオブジェクトは共有できないのでコピーする必要がある
	get_data: EquipmentDatabase_get_data,
	set_data: EquipmentDatabase_set_data,
});


Object.assign(EquipmentDatabase, {
	eqab_special_def: {
		// key を value の配列の要素に置き換える
		// 系で統一
		"軽巡系": ["軽巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦", "兵装実験軽巡", "重雷装巡洋艦", "練習巡洋艦"],
		"重巡系": ["重巡洋艦", "航空巡洋艦"],
		"空母系": ["軽空母", "正規空母", "装甲空母", "夜間作戦航空母艦", "近代化航空母艦"],
		"潜水系": ["潜水艦", "潜水空母"],
		"航空戦艦系": ["航空戦艦", "改装航空戦艦"],
	},
	
	// 日本艦
	// 該当する型名を指定
	jp_classes_def: [
		// 駆逐
		"初春型", "吹雪型", "夕雲型", "島風型", "改白露型",
		"暁型", "朝潮型", "白露型", "睦月型", "神風型",
		"秋月型", "綾波型", "陽炎型", "松型",
		// 軽巡級
		"夕張型", "大淀型", "天龍型", "川内型", "球磨型",
		"長良型", "阿賀野型", "香取型",
		// 重巡・航巡
		"利根型", "古鷹型", "妙高型", "最上型", "青葉型",
		"高雄型",
		// 潜水艦
		"三式潜航輸送艇", "巡潜3型", "巡潜乙型", "巡潜乙型改二", "巡潜甲型改二",
		"海大VI型", "潜特型(伊400型潜水艦)",
		// 戦艦・航空戦艦
		"伊勢型", "大和型", "扶桑型", "改金剛型", "改伊勢型",
		"金剛型", "長門型",
		// 空母
		"加賀型", "大鳳型", "大鷹型", "春日丸級", "祥鳳型",
		"翔鶴型", "蒼龍型", "赤城型", "雲龍型", "飛鷹型",
		"飛龍型", "鳳翔型", "龍驤型", "龍鳳型",
		"改赤城型", "改加賀型",
		// 水母
		"千歳型", "日進型", "瑞穂型", "秋津洲型",
		// 海防艦
		"占守型", "御蔵型", "択捉型", "日振型", "丁型海防艦",
		// ほか
		"大鯨型", "改風早型", "明石型", "特種船丙型", "神威型",
		"陸軍特種船(R1)",
	],
	
	// 上の日本艦を表すmap: class->boolean
	jp_classes_map: null,
});


function EquipmentDatabase(){
}

function EquipmentDatabase_init_jp_def(){
	// jp_classes_map の生成
	if (!EquipmentDatabase.jp_classes_map) {
		let jp = new Object;
		for (let name of EquipmentDatabase.jp_classes_def) {
			jp[name] = true;
		}
		EquipmentDatabase.jp_classes_map = jp;
	}
	return EquipmentDatabase.jp_classes_map;
}

function EquipmentDatabase_initialize(csv_shiplist, csv_equiplist_raw, csv_equipable_raw, csv_equipbonus){
	EquipmentDatabase.csv_shiplist      = csv_shiplist;
	EquipmentDatabase.csv_equiplist_raw = csv_equiplist_raw;
	EquipmentDatabase.csv_equipable_raw = csv_equipable_raw;
	EquipmentDatabase.csv_equipbonus    = csv_equipbonus;
	
	EquipmentDatabase.init_jp_def();
	
	for (let i=0; i<csv_shiplist.length; i++) {
		csv_shiplist[i].temporary_id = i + 1;
	}
	
	// 数値に変換する
	// ひとまず装備リストのみ
	let csv_equiplist = new Array;
	let number_props = [
		"number",
		"firepower", "torpedo", "bombing", "antiair", "ASW", "LoS", "accuracy", "evasion", "armor",
		// "radius", "antibomber", "interception",
	];
	// 空母の攻撃条件を満たす装備か
	let cv_attackable_cates = ["艦上爆撃機", "艦上攻撃機", "噴式戦闘爆撃機"];
	
	let max_number = 0;
	for (let i=0; i<csv_equiplist_raw.length; i++) {
		let eq = Object.assign(new Object, csv_equiplist_raw[i]);
		for (let prop of number_props) eq[prop] = +eq[prop];
		eq.cv_attackable = cv_attackable_cates.indexOf(eq.category) >= 0;
		csv_equiplist.push(eq);
		
		if (max_number < eq.number) max_number = eq.number;
	}
	EquipmentDatabase.csv_equiplist = csv_equiplist;
	EquipmentDatabase.equipment_max_number = max_number;
	
	if (max_number > 65535) debugger;
	
	// csv_equipable
	// 色々文字列で保有しているが、ひとまず次のものだけ配列変換
	// shipTypes -> shipTypesArray    "高速戦艦"はそのまま
	// forSupport がないものは無視とする
	
	let sp_def = EquipmentDatabase.eqab_special_def;
	let csv_equipable = new Array;
	
	for (let d of csv_equipable_raw) {
		if (!+d.forSupport) continue;
		
		let eqab = Object.assign(new Object, d);
		let types = new Array;
		
		if (eqab.shipTypes) {
			eqab.shipTypes.split("|").forEach(x => {
				if (x) {
					if (sp_def.hasOwnProperty(x)) {
						types = types.concat(sp_def[x]);
					} else {
						types.push(x);
					}
				}
			});
		}
		
		eqab.shipTypesArray = types;
		csv_equipable.push(eqab);
	}
	EquipmentDatabase.csv_equipable = csv_equipable;
	
	
	let bonusdata_array = new Array;
	for (let d of csv_equipbonus) {
		bonusdata_array.push(new EquipmentBonusData(d));
	}
	EquipmentDatabase.bonusdata_array = bonusdata_array;
	
	let eqmap = new Object;
	for (let d of csv_equiplist) {
		eqmap[+d.number] = d;
	}
	eqmap[0] = null; // 念の為
	EquipmentDatabase.equipment_data_map = eqmap;
	
	EquipmentDatabase.initialized = true;
}

// postMessage() するデータ
// postMessage() の際にコピーされるはず
// SharedArrayBuffer はそのまま転送してよい
function EquipmentDatabase_get_data(){
	if (!EquipmentDatabase.initialized) debugger;
	
	return {
		csv_equiplist_raw   : EquipmentDatabase.csv_equiplist_raw   ,
		csv_equipable_raw   : EquipmentDatabase.csv_equipable_raw   ,
		csv_shiplist        : EquipmentDatabase.csv_shiplist        ,
		csv_equiplist       : EquipmentDatabase.csv_equiplist       ,
		csv_equipable       : EquipmentDatabase.csv_equipable       ,
		csv_equipbonus      : EquipmentDatabase.csv_equipbonus      ,
		bonusdata_array     : EquipmentDatabase.bonusdata_array     ,
		equipment_data_map  : EquipmentDatabase.equipment_data_map  ,
		equipment_max_number: EquipmentDatabase.equipment_max_number,
		initialized         : EquipmentDatabase.initialized         ,
	};
}

function EquipmentDatabase_set_data(data){
	Object.assign(EquipmentDatabase, data);
	
	// bonusdata_array だけ変換が必要
	let arr = EquipmentDatabase.bonusdata_array;
	for (let i=0; i<arr.length; i++) {
		let bonus = new EquipmentBonusData();
		Object.assign(bonus, arr[i]);
		arr[i] = bonus;
	}
}


// EquipableInfo -----------------------------------------------------------------------------------
Object.assign(EquipableInfo.prototype, {
	name: "",
	ship: null,
	
	// 装備可能かどうかを示す ID から boolean への map
	slot_equipables : null, // array
	exslot_equipable: null,
	
	set_name           : EquipableInfo_set_name,
	get_slot_count     : EquipableInfo_get_slot_count,
	generate_equipables: EquipableInfo_generate_equipables,
});


function EquipableInfo(name){
	if (name) {
		this.set_name(name);
		this.generate_equipables();
	}
}

function EquipableInfo_set_name(name){
	this.name = name;
	this.ship = name ? EquipmentDatabase.csv_shiplist.find(x => x.name == name) : null;
}

function EquipableInfo_get_slot_count(){
	return !this.ship ? -1 : this.ship.slot ? +this.ship.slot : this.ship.shipType == "駆逐艦" ? 3 : 4;
}

// 装備可能かどうかを示すオブジェクトの生成
function EquipableInfo_generate_equipables(){
	this.slot_equipables = new Array;
	this.exslot_equipable = null;
	
	let slot_count = this.get_slot_count();
	
	for (let i=0; i<slot_count+1; i++) {
		let exslot = i == slot_count;
		let equipable = new Object;
		
		for (let d of EquipmentDatabase.csv_equipable) {
			// 艦条件
			let matched = false;
			
			if (d.shipNames) {
				matched = d.shipNames == "*" || d.shipNames.split("|").indexOf(this.name) >= 0;
			}
			if (d.classNames && !matched) {
				let cls = d.classNames.split("|");
				matched = cls.indexOf(this.ship.className) >= 0;
			}
			if (d.shipTypes && !matched) {
				let types = d.shipTypesArray;
				matched = types.indexOf(this.ship.shipType) >= 0;
				
				if (!matched && this.ship.shipType == "戦艦" && this.ship.speed == "高速" && types.indexOf("高速戦艦") >= 0) {
					matched = true;
				}
			}
			
			if (!matched) continue;
			
			// スロット条件
			// "*" は増設も含め全て
			if (!d.slots) {
				// 空は増設以外全て
				if (exslot) continue;
				
			} else if (d.slots != "*") {
				// スロット指定 (|区切り、増設は"-1")
				let slot_text = exslot ? "-1" : String(i + 1);
				if (d.slots.split("|").indexOf(slot_text) < 0) continue;
			}
			
			// 装備可能性
			let value = +d.equipable;
			
			if (d.equipIds) {
				if (d.equipIds == "*") {
					// "全て装備できない"のみ有効とする
					if (!value) {
						equipable = new Object;
					}
				} else {
					for (let id of d.equipIds.split("|")) {
						equipable[id] = value;
					}
				}
			}
			
			if (d.equipCategories) {
				let cates = d.equipCategories.split("|");
				
				for (let eq of EquipmentDatabase.csv_equiplist) {
					if (cates.indexOf(eq.category) >= 0) {
						equipable[eq.number] = value;
					}
				}
			}
		}
		
		if (!exslot) {
			this.slot_equipables[i] = equipable;
		} else {
			this.exslot_equipable = equipable;
		}
	}
}


// EquipmentSelect ---------------------------------------------------------------------------------
// select を管理
// value は装備の図鑑番号
// 改修値の選択も管理(optional)
Object.assign(EquipmentSelect.prototype, {
	// DOM
	e_select: null,
	e_star  : null,
	// 関連付いた EquipableInfo の map
	infomap : null,
	// 装備名のカスタマイズ用コールバック関数。renamer(equip)
	renamer : null,
	// callback (後方互換用)
	onchange: null,
	
	recreate_options: EquipmentSelect_recreate_options,
	get_id          : EquipmentSelect_get_id          ,
	set_id          : EquipmentSelect_set_id          ,
	get_star        : EquipmentSelect_get_star        ,
	set_star        : EquipmentSelect_set_star        ,
	set_id_star     : EquipmentSelect_set_id_star     ,
	ev_change_select: EquipmentSelect_ev_change_select,
});

EquipmentSelect.className = "equipment";
EquipmentSelect.star_className = "star";


function EquipmentSelect(){
	this.e_select = ELEMENT("select");
	this.e_select.className = EquipmentSelect.className;
	this.e_select.addEventListener("change", e => this.ev_change_select(e));
	
	this.e_star = ELEMENT("select");
	this.e_star.className = EquipmentSelect.star_className;
	this.e_star.addEventListener("change", e => this.ev_change_select(e));
	
	// 改修値の方は作っておく
	for (let i=0; i<=10; i++) {
		this.e_star.appendChild(new Option("★" + i, i));
	}
	this.e_star.selectedIndex = 0;
	
	Util.attach_event_target(this);
	this.addEventListener("change", e => {
		if (this.onchange) this.onchange.call(null);
	});
}

// リストを再生成
// データは EquipableInfo で使用したものを流用
// infomap   : 装備可能情報 (EquipableInfo の map)  nullだと装備なしだけになる
// rest_cates: カテゴリー制限。カテゴリー名の配列 or null
// grouping  : optionをカテゴリー名でグループ化する
// new_value : 生成後この値にする。nullなら今までの値を引き継ごうとする
function EquipmentSelect_recreate_options(infomap, rest_cates, grouping, new_value){
	let old_value = this.e_select.value;
	let found_old_value = false;
	
	Util.remove_children(this.e_select);
	
	// 装備なし
	this.e_select.appendChild(new Option("-", ""));
	
	let groups = new Array;
	let groups_map = new Object;
	
	for (let eq of EquipmentDatabase.csv_equiplist) {
		if (!infomap || !infomap[eq.number]) continue;
		
		// カテゴリー制限
		if (rest_cates) {
			if (rest_cates.indexOf(eq.category) < 0) continue;
		}
		
		let parent;
		
		if (grouping) {
			parent = groups_map[eq.category];
			if (!parent) {
				parent = ELEMENT("optgroup");
				parent.label = eq.category;
				groups.push(parent);
				groups_map[eq.category] = parent;
			}
		} else {
			parent = this.e_select;
		}
		
		let name = this.renamer ? this.renamer.call(null, eq) : eq.name;
		parent.appendChild(new Option(name, eq.number));
		
		if (eq.number == old_value) found_old_value = true;
	}
	
	if (grouping) {
		for (let gr of groups) {
			this.e_select.appendChild(gr);
		}
	}
	
	if (new_value || found_old_value) {
		this.e_select.value = new_value || old_value;
	} else {
		this.e_select.selectedIndex = 0;
	}
	
	this.infomap = infomap;
}

// 未選択時は空文字
function EquipmentSelect_get_id(){
	return this.e_select.value;
}

function EquipmentSelect_set_id(id){
	this.e_select.value = id;
	if (this.e_select.selectedIndex < 0) {
		this.e_select.value = "";
	}
}

// 改修値の整数
// ただし、装備が選択されていない場合は0
function EquipmentSelect_get_star(){
	return (this.e_select.value ? +this.e_star.value : 0);
}

function EquipmentSelect_set_star(star){
	this.e_star.value = star;
	if (this.e_star.selectedIndex < 0) {
		this.e_star.value = "0";
	}
}

// 同時
function EquipmentSelect_set_id_star(id, star){
	this.set_id(id);
	this.set_star(star);
}

function EquipmentSelect_ev_change_select(e){
	this.dispatchEvent(new CustomEvent("change"));
}


// EquipmentSlot -----------------------------------------------------------------------------------
// Equipableのグローバル変数を参照
Object.assign(EquipmentSlot.prototype, {
	equipment_id   : 0, // 0 で装備なし
	improvement    : 0, // 改修値
	equipment_data : null,
	
	same_index     : 0, // ボーナスの計算用
	
	bonus_firepower: 0,
	bonus_torpedo  : 0,
	bonus_antiair  : 0,
	bonus_ASW      : 0,
	bonus_evasion  : 0,
	bonus_LoS      : 0,
	bonus_armor    : 0,
	
	// 未使用
	// plane_count
	// plane_count_max
	// proficiency
	
	clone                : EquipmentSlot_clone,
	set_equipment        : EquipmentSlot_set_equipment,
	set_equipment_from   : EquipmentSlot_set_equipment_from,
	clear_bonus          : EquipmentSlot_clear_bonus,
	swap_equipment       : EquipmentSlot_swap_equipment,
	is_upper_or_equal    : EquipmentSlot_is_upper_or_equal,
	is_upper_or_equal_raw: EquipmentSlot_is_upper_or_equal_raw,
	
	// ボーナス値は保存されない
	get_json: EquipmentSlot_get_json,
	set_json: EquipmentSlot_set_json,
	
	get_power_min  : EquipmentSlot_get_power_min,
	get_power_float: EquipmentSlot_get_power_float,
	get_power_max  : EquipmentSlot_get_power_max,
});


function EquipmentSlot(id = 0, data = null, impr = 0){
	if (id) {
		this.set_equipment(id, data, impr);
	}
}

function EquipmentSlot_clone(){
	return Object.assign(new EquipmentSlot, this);
}

// dataには装備データ(nullでもよい)
function EquipmentSlot_set_equipment(id, data = null, star = 0){
	this.equipment_id = id;
	this.improvement = star;
	this.equipment_data = data || (id > 0 ? EquipmentDatabase.equipment_data_map[id] : null);
}

function EquipmentSlot_set_equipment_from(slot){
	this.set_equipment(slot.equipment_id, slot.equipment_data, slot.improvement);
}

function EquipmentSlot_clear_bonus(){
	this.bonus_firepower = 0;
	this.bonus_torpedo   = 0;
	this.bonus_antiair   = 0;
	this.bonus_ASW       = 0;
	this.bonus_evasion   = 0;
	this.bonus_LoS       = 0;
	this.bonus_armor     = 0;
}

function EquipmentSlot_swap_equipment(argv){
	// 装備を入れ替える
	// ボーナス値はそのまま
	let temp = this.equipment_id;
	this.equipment_id = argv.equipment_id;
	argv.equipment_id = temp;
	
	temp = this.improvement;
	this.improvement = argv.improvement;
	argv.improvement = temp;
	
	temp = this.equipment_data;
	this.equipment_data = argv.equipment_data;
	argv.equipment_data = temp;
}

// bの上位互換とみなしてよいか (火力と命中について)
// ボーナス値も含める　シナジーには注意
function EquipmentSlot_is_upper_or_equal(b, cv_shelling){
	let t_eq = this.equipment_data;
	let b_eq = b.equipment_data;
	
	let t_fpw = t_eq.firepower + this.bonus_firepower;
	let b_fpw = b_eq.firepower + b.bonus_firepower;
	
	return cv_shelling ? (
		t_fpw         >= b_fpw &&
		t_eq.torpedo  >= b_eq.torpedo &&
		t_eq.bombing  >= b_eq.bombing &&
		t_eq.accuracy >= b_eq.accuracy
	) : (
		t_fpw         >= b_fpw &&
		t_eq.accuracy >= b_eq.accuracy
	);
}

// ボーナス値を含めない
function EquipmentSlot_is_upper_or_equal_raw(b, cv_shelling){
	let t_eq = this.equipment_data;
	let b_eq = b.equipment_data;
	
	let t_fpw = t_eq.firepower;
	let b_fpw = b_eq.firepower;
	
	return cv_shelling ? (
		t_fpw         >= b_fpw &&
		t_eq.torpedo  >= b_eq.torpedo &&
		t_eq.bombing  >= b_eq.bombing &&
		t_eq.accuracy >= b_eq.accuracy
	) : (
		t_fpw         >= b_fpw &&
		t_eq.accuracy >= b_eq.accuracy
	);
}

function EquipmentSlot_get_json(){
	return {
		equipment_id: this.equipment_id,
		improvement : this.improvement,
	};
}

function EquipmentSlot_set_json(json){
	let id = +json.equipment_id || 0;
	let star = +json.improvement;
	if (!(0 <= star && star <= 10)) star = 0;
	this.set_equipment(id, null, star);
}

function EquipmentSlot_get_power_min(cv_shelling){
	let eq = this.equipment_data;
	return ( eq
		? ( cv_shelling
			? Math.floor((eq.firepower + this.bonus_firepower + eq.torpedo /*+ this.bonus_torpedo*/ + Math.floor(eq.bombing * 1.3)) * 1.5)
			: eq.firepower + this.bonus_firepower )
		: 0
	);
}

// 攻撃力の概算
// 素ステータスのみ、ボーナス値のみも計算可能
function EquipmentSlot_get_power_float(cv_shelling, base = true, bonus = true){
	let eq = this.equipment_data;
	let fpw = (base ? eq.firepower : 0) + (bonus ? this.bonus_firepower : 0);
	let tor = (base ? eq.torpedo : 0) /*+ (bonus ? this.bonus_torpedo : 0)*/;
	let bom = base ? eq.bombing : 0;
	return ( eq
		? ( cv_shelling
			? (fpw + tor + bom * 1.3) * 1.5
			: fpw )
		: 0
	);
}

function EquipmentSlot_get_power_max(cv_shelling){
	let eq = this.equipment_data;
	return ( eq
		? ( cv_shelling
			? Math.ceil((eq.firepower + this.bonus_firepower + eq.torpedo /*+ this.bonus_torpedo*/ + Math.ceil(eq.bombing * 1.3)) * 1.5)
			: eq.firepower + this.bonus_firepower )
		: 0
	);
}


// EquipmentBonusData ------------------------------------------------------------------------------
Object.assign(EquipmentBonusData.prototype, {
	// 適用する装備ID
	// 複数の場合は equipment_id=0, equipment_id_array がIDの配列になる(一つの場合後者はnull)
	equipment_id: 0, // omit
	equipment_id_array: null, // omit
	// 適用する装備IDかどうかを判定するmap
	equipment_id_map: null,
	// 何本目に適用するか
	// 旧式　今は null
	count_map: null, // map: count -> bool, omit
	// ビットデータの形　下(0x01)が1本目
	count_bit: 0,
	// これまでのボーナスを無効にするか
	reset: false,
	// このボーナスをグループ化するか
	// グループ化しない場合は指定した各装備にボーナスが独立して与えられるが
	// グループ化すると同一種のボーナスとみなされる
	grouping: false,
	// ship条件 map: shipname -> bool, map: shipid -> bool
	shipname_map: null, // omit
	shipid_map  : null,
	// 複合ボーナス条件その1/その2　map: equipid -> bool
	// nullでない場合、ここで指定されている装備を同時に装備しているときのみ有効
	subequip_map1: null,
	subequip_map2: null,
	// ボーナス値の配列
	// map: 改修値 -> ボーナス値
	firepower: null,
	torpedo  : null,
	antiair  : null,
	ASW      : null,
	evasion  : null,
	LoS      : null,
	armor    : null,
	//accuracy: null,
	// 一応元のデータへの参照を
	line: null,
	
	// method
	set_csv_line: EquipmentBonusData_set_csv_line,
	independent : EquipmentBonusData_independent,
});

Object.assign(EquipmentBonusData, {
	// 改修値によってボーナスが変わらない場合のボーナス値の配列
	// 高速化のため
	constant_bonus: new Array, // array of bonus array
});


// csvのデータを変換し、高速化を図る
function EquipmentBonusData(line){
	if (line) {
		this.set_csv_line(line);
	}
}

function EquipmentBonusData_set_csv_line(line){
	let max_number = EquipmentDatabase.equipment_max_number;
	if (max_number == 0) debugger;
	
	// SharedArrayBuffer/ArrayBufferを使用する
	const array_buffer_mode = true;
	const use_shared_buffer = true;
	// 一時IDを使ってメモリーを節約する
	const shipid_mode = true;
	// 旧式の個数判定用オブジェクトを作る
	const init_count_map = false;
	
	// bytes
	let shipid_bufsize = EquipmentDatabase.csv_shiplist.length + 1;
	let buffer_size = (max_number + 1) * 4 + 11 * 7 + shipid_bufsize;
	if (init_count_map) buffer_size += 7;
	buffer_size = Math.ceil(buffer_size / 4) * 4; // なんとなく4の倍数にしておく
	
	let buffer = null;
	let assigned_size = 0;
	
	if (array_buffer_mode) {
		if (use_shared_buffer) {
			try {
				buffer = new SharedArrayBuffer(buffer_size);
			} catch (e) {}
		}
		if (!buffer) {
			try {
				buffer = new ArrayBuffer(buffer_size);
			} catch (e2) {}
		}
		// 節約のため保存しないでおく
		//this.buffer = buffer;
	}
	
	let _assign_bool_map = (length) => {
		if (!buffer) return new Object();
		
		let begin = assigned_size;
		let size = length;
		if (begin + size > buffer_size) {
			throw new Error("バッファサイズが足りません");
		}
		let ptr = new Int8Array(buffer, begin, length);
		assigned_size = begin + size;
		return ptr;
	};
	let _assign_short_array = (length) => {
		if (!buffer) return new Array(length);
		// アライメントを考慮する
		let begin = Math.ceil(assigned_size / 2) * 2;
		let size = length * 2;
		if (begin + size > buffer_size) {
			throw new Error("バッファサイズが足りません");
		}
		let ptr = new Uint16Array(buffer, begin, length);
		assigned_size = begin + size;
		return ptr;
	};
	
	{
		let arr = line.equipId.split("|");
		this.equipment_id_map = arr.reduce((a, c) => {
			let num = +c;
			if (!(1 <= num && num <= max_number)) debugger;
			a[num] = true;
			return a;
		}, _assign_bool_map(max_number + 1));
	}
	
	
	if (init_count_map) {
		this.count_map = _assign_bool_map(7);
	}
	this.count_bit = 0;
	let arr = line.countAt.split("|");
	for (let i=1; i<=6; i++) {
		let b = !line.countAt || line.countAt == "*" || arr.some(x => x == i);
		if (init_count_map) {
			this.count_map[i] = b;
		}
		if (b) {
			this.count_bit |= 1 << (i - 1);
		}
	}
	
	this.reset = +line.reset;
	this.grouping = +line.grouping;
	
	let names  = line.shipNames && line.shipNames.split("|");
	let substr_names = names && names.filter(x => /^\[.+\]$/.test(x)).map(x => x.substr(1, x.length - 2));
	let not_names    = names && names.filter(x => /^!/.test(x)).map(x => x.substr(1));
	let not_substr_names = not_names && not_names.filter(x => /^\[.+\]$/.test(x)).map(x => x.substr(1, x.length - 2));
	
	let types  = line.shipTypes && line.shipTypes.split("|");
	let jp_types = types && types.filter(x => /^日本/.test(x)).map(x => x.substr(2));
	let jp_def = EquipmentDatabase.jp_classes_map;
	
	let cnames_raw   = line.classNames && line.classNames.split("|");
	let kaini_cnames = cnames_raw && cnames_raw.filter(x => /改二$/.test(x)).map(x => x.substr(0, x.length - 2));
	let cnames       = cnames_raw && cnames_raw.filter(x => !/改二$/.test(x));
	
	if (shipid_mode) {
		this.shipid_map = _assign_bool_map(shipid_bufsize);
	} else {
		this.shipname_map = new Object;
	}
	
	for (let ship of EquipmentDatabase.csv_shiplist) {
		let hit = (
			(names && names.indexOf(ship.name) >= 0) ||
			(substr_names && substr_names.findIndex(ss => ship.name.indexOf(ss) >= 0) >= 0) ||
			(cnames && cnames.indexOf(ship.className) >= 0) ||
			(jp_types && jp_def[ship.className] && jp_types.indexOf(ship.shipType) >= 0) ||
			(kaini_cnames && /改二$/.test(ship.name) && kaini_cnames.indexOf(ship.className) >= 0) ||
			(types && types.indexOf(ship.shipType) >= 0)
		);
		if (hit) {
			// not
			let hit_ignore = (
				(not_names && not_names.indexOf(ship.name) >= 0)
				|| (not_substr_names && not_substr_names.findIndex(ss => ship.name.indexOf(ss) >= 0) >= 0)
			);
			if (hit_ignore) hit = false;
		}
		if (this.shipname_map) {
			this.shipname_map[ship.name] = hit;
		}
		if (this.shipid_map) {
			this.shipid_map[ship.temporary_id] = hit;
		}
	}
	
	let subids1   = line.subEquipIds && line.subEquipIds.split("|");
	let subcates1 = line.subEquipCategories && line.subEquipCategories.split("|");
	let aa_radar1 = subcates1 && subcates1.indexOf("対空電探") >= 0;
	let sf_radar1 = subcates1 && subcates1.indexOf("水上電探") >= 0;
	
	let subids2   = line.subEquipIds2 && line.subEquipIds2.split("|");
	let subcates2 = line.subEquipCategories2 && line.subEquipCategories2.split("|");
	let aa_radar2 = subcates2 && subcates2.indexOf("対空電探") >= 0;
	let sf_radar2 = subcates2 && subcates2.indexOf("水上電探") >= 0;
	
	let sub1 = _assign_bool_map(max_number + 1);
	let sub1_count = 0;
	let sub2 = _assign_bool_map(max_number + 1);
	let sub2_count = 0;
	
	function _eq_match(eq, ids, cates, aa, sf){
		return (
			(ids && ids.findIndex(x => x == eq.number) >= 0) ||
			(cates && cates.indexOf(eq.category) >= 0) ||
			/電探$/.test(eq.category) && (
				(aa && +eq.antiair >= 1) ||
				(sf && +eq.LoS >= 5)
			)
		);
	}
	
	for (let eq of EquipmentDatabase.csv_equiplist) {
		sub1[eq.number] = _eq_match(eq, subids1, subcates1, aa_radar1, sf_radar1);
		if (sub1[eq.number]) sub1_count++;
		sub2[eq.number] = _eq_match(eq, subids2, subcates2, aa_radar2, sf_radar2);
		if (sub2[eq.number]) sub2_count++;
	}
	this.subequip_map1 = sub1_count >= 1 ? sub1 : null;
	this.subequip_map2 = sub2_count >= 1 ? sub2 : null;
	
	function _by_impr(str){
		let ret;
		let constant = /^\d+$/.test(str);
		
		if (constant && EquipmentBonusData.constant_bonus[str]) {
			ret = EquipmentBonusData.constant_bonus[str];
			
		} else {
			ret = _assign_bool_map(11);
			let sp = str.split("|");
			for (let i=0; i<=10; i++) {
				// 空の場合一つ下の改修値のものを引き継ぐ
				ret[i] = sp.length == 1 ? +sp[0] : sp[i] ? +sp[i] : i > 0 ? ret[i-1] : 0;
			}
			if (constant) {
				EquipmentBonusData.constant_bonus[str] = ret;
			}
		}
		return ret;
	}
	
	this.firepower = _by_impr(line.firepower);
	this.torpedo   = _by_impr(line.torpedo);
	this.antiair   = _by_impr(line.antiair);
	this.ASW       = _by_impr(line.ASW);
	this.evasion   = _by_impr(line.evasion);
	this.LoS       = _by_impr(line.LoS);
	this.armor     = _by_impr(line.armor);
	
	this.line = line;
}


// 単体ボーナス(累積可能)であるか
// 他のスロットの装備によらないのであれば改修値でボーナスが変わってもよい
function EquipmentBonusData_independent(){
/*
	// 旧式と同値かチェックするコード
	let _old = () => {
		if (this.subequip_map1) return false;
	
		for (let n=1; n<=6; n++) {
			if (!this.count_map[n]) return false;
		}
		return true;
	};
	let b1 = this.subequip_map1 == null && this.count_bit == 0x3f;
	let b2 = _old();
	
	if (b1 != b2) debugger;
*/
	
	// 6個目まですべて
	return this.subequip_map1 == null && this.count_bit == 0x3f;
}


// EquipmentBonus ----------------------------------------------------------------------------------
// 艦に対する装備ボーナスの一覧や計算
Object.assign(EquipmentBonus.prototype, {
	name: "",
	ship: null,
	
	// 「支援艦隊」モード
	// 支援に関係ないボーナスは無視する
	support_mode: false,
	
	// shipに関するボーナス情報
	bonus_data_array: null, // array of EquipmentBonusData
	bonus_data_map  : null, // map: equipId -> array of EquipmentBonusData
	// 他の装備にボーナスを与える装備の情報
	assist_data_map : null, // map: id -> EquipmentBonusData[] (重複あり)
	
	// method
	set_name             : EquipmentBonus_set_name,
	get_bonus            : EquipmentBonus_get_bonus,
	get_independent_bonus: EquipmentBonus_get_independent_bonus,
	get_max_bonus        : EquipmentBonus_get_max_bonus,
	
	bonus_exists         : EquipmentBonus_bonus_exists,
	assist_exists        : EquipmentBonus_assist_exists,
	assist_3p_exists     : EquipmentBonus_assist_3p_exists,
	bonus_concerns       : EquipmentBonus_bonus_concerns,
	bonus_independent    : EquipmentBonus_bonus_independent,
	bonus_synergy_main   : EquipmentBonus_bonus_synergy_main,
	same_assist          : EquipmentBonus_same_assist,
});


function EquipmentBonus(name, sup = false){
	if (sup) this.support_mode = sup;
	if (name) {
		this.set_name(name);
	}
}

function EquipmentBonus_set_name(name){
	let max_number = EquipmentDatabase.equipment_max_number;
	
	this.name = name;
	this.ship = EquipmentDatabase.csv_shiplist.find(x => x.name == name);
	this.bonus_data_array = new Array;
	this.bonus_data_map = new Object;
	this.assist_data_map = new Object;
	
	let _assist = (data, submap) => {
		if (!submap) return;
		
		for (let key=1; key<=max_number; key++) {
			if (submap[key]) {
				let arr = this.assist_data_map[key];
				if (!arr) {
					arr = new Array;
					this.assist_data_map[key] = arr;
				}
				arr.push(data);
			}
		}
	};
	let _simple = (data, id) => {
		if (id > 0) {
			let arr = this.bonus_data_map[id];
			if (!arr) {
				arr = new Array;
				this.bonus_data_map[id] = arr;
			}
			arr.push(data);
		}
	};
	
	for (let data of EquipmentDatabase.bonusdata_array) {
		if ( (data.shipname_map && data.shipname_map[this.ship.name])
			|| (data.shipid_map && data.shipid_map[this.ship.temporary_id]) )
		{
			// 支援艦隊の場合、火力ボーナスしか意味がない
			if (this.support_mode && data.firepower[10] == 0) {
				continue;
			}
			
			this.bonus_data_array.push(data);
			
			for (let i=1; i<=max_number; i++) {
				if (data.equipment_id_map[i]) _simple(data, i);
			}
/*
			_simple(data, data.equipment_id);
			if (data.equipment_id_array) {
				data.equipment_id_array.forEach(id => _simple(data, id));
			}
*/
			
			_assist(data, data.subequip_map1);
			_assist(data, data.subequip_map2);
		}
	}
}

// こちらの関数群では改修値によるソートは行わない
// 改修値が影響し、かつ本数制限がある場合には呼び出し元で大きいものからソートしておく
function EquipmentBonus_get_bonus(slot_array, synergy_only = false){
	for (let i=0; i<slot_array.length; i++) {
		slot_array[i].same_index = 1;
	}
	for (let i=0; i<slot_array.length; i++) {
		let c = slot_array[i].same_index;
		if (c == 1) {
			let id = slot_array[i].equipment_id;
			if (id != 0) {
				for (let j=i+1; j<slot_array.length; j++) {
					if (slot_array[j].equipment_id == id) {
						slot_array[j].same_index = ++c;
					}
				}
			}
		}
	}
	
	for (let i=0; i<slot_array.length; i++) {
		let slot = slot_array[i];
		slot.clear_bonus();
		
		let arr = this.bonus_data_map[slot.equipment_id];
		if (!arr) continue;
		
		for (let j=0; j<arr.length; j++) {
			let data = arr[j];
			
			let count;
			if (data.grouping) {
				// グループ化されたボーナス
				// しょうがないので毎回カウントする
				let group = data.equipment_id_map;
				count = 1;
				for (let p=0; p<i; p++) {
					if (group[ slot_array[p].equipment_id ]) count++;
				}
			} else {
				count = slot.same_index;
			}
			
			/*
			{	// 旧式と同値かチェックするコード
				let b1 = data.count_map[count];
				let b2 = (data.count_bit & (1 << (count - 1))) != 0;
				if (b1 != b2) debugger;
			}
			*/
			
			if ((data.count_bit & (1 << (count - 1))) == 0) continue;
			
			if (data.subequip_map1) {
				let pos1 = 0;
				for (; pos1<slot_array.length; pos1++) {
					// 同一装備は選択できない
					if (pos1 == i) continue;
					// 装備中
					if (data.subequip_map1[ slot_array[pos1].equipment_id ]) break;
				}
				if (pos1 >= slot_array.length) continue;
				
				if (data.subequip_map2) {
					let pos2 = 0;
					for (; pos2<slot_array.length; pos2++) {
						// 同一装備は選択できない
						if (pos2 == i || pos2 == pos1) continue;
						// 装備中
						if (data.subequip_map2[ slot_array[pos2].equipment_id ]) break;
					}
					if (pos2 >= slot_array.length) continue;
				}
				// 厳密にはこのチェックで漏れる可能性はあるが、そういった複雑な条件は書かない（分割する）こととする
				// 具体的にはsub1とsub2に同じ装備が含まれる場合
			} else {
				// シナジーのみ
				if (synergy_only && data.independent()) continue;
			}
			
			// チェックを通過、このボーナスが有効
			if (data.reset) {
				slot.bonus_firepower = data.firepower[slot.improvement];
				slot.bonus_torpedo   = data.torpedo[slot.improvement];
				slot.bonus_antiair   = data.antiair[slot.improvement];
				slot.bonus_ASW       = data.ASW[slot.improvement];
				slot.bonus_evasion   = data.evasion[slot.improvement];
				slot.bonus_LoS       = data.LoS[slot.improvement];
				slot.bonus_armor     = data.armor[slot.improvement];
			} else {
				slot.bonus_firepower += data.firepower[slot.improvement];
				slot.bonus_torpedo   += data.torpedo[slot.improvement];
				slot.bonus_antiair   += data.antiair[slot.improvement];
				slot.bonus_ASW       += data.ASW[slot.improvement];
				slot.bonus_evasion   += data.evasion[slot.improvement];
				slot.bonus_LoS       += data.LoS[slot.improvement];
				slot.bonus_armor     += data.armor[slot.improvement];
			}
		}
	}
}

// 単体ボーナス(累積可能)のみをセット
function EquipmentBonus_get_independent_bonus(slot){
	slot.clear_bonus();
	
	let arr = this.bonus_data_map[slot.equipment_id];
	if (!arr) return;
	
	for (let i=0; i<arr.length; i++) {
		let data = arr[i];
		if (!data.independent()) continue;
		
		if (data.reset) {
			slot.bonus_firepower = data.firepower[slot.improvement];
			slot.bonus_torpedo   = data.torpedo[slot.improvement];
			slot.bonus_antiair   = data.antiair[slot.improvement];
			slot.bonus_ASW       = data.ASW[slot.improvement];
			slot.bonus_evasion   = data.evasion[slot.improvement];
			slot.bonus_LoS       = data.LoS[slot.improvement];
			slot.bonus_armor     = data.armor[slot.improvement];
		} else {
			slot.bonus_firepower += data.firepower[slot.improvement];
			slot.bonus_torpedo   += data.torpedo[slot.improvement];
			slot.bonus_antiair   += data.antiair[slot.improvement];
			slot.bonus_ASW       += data.ASW[slot.improvement];
			slot.bonus_evasion   += data.evasion[slot.improvement];
			slot.bonus_LoS       += data.LoS[slot.improvement];
			slot.bonus_armor     += data.armor[slot.improvement];
		}
	}
}

// 全てのボーナスを加算
// 一部には負数のボーナスがあるが、あまり深く考えないこととする
function EquipmentBonus_get_max_bonus(slot){
	slot.clear_bonus();
	
	let arr = this.bonus_data_map[slot.equipment_id];
	if (!arr) return;
	
	for (let i=0; i<arr.length; i++) {
		let data = arr[i];
		if (data.reset) {
			slot.bonus_firepower = data.firepower[slot.improvement];
			slot.bonus_torpedo   = data.torpedo[slot.improvement];
			slot.bonus_antiair   = data.antiair[slot.improvement];
			slot.bonus_ASW       = data.ASW[slot.improvement];
			slot.bonus_evasion   = data.evasion[slot.improvement];
			slot.bonus_LoS       = data.LoS[slot.improvement];
			slot.bonus_armor     = data.armor[slot.improvement];
		} else {
			slot.bonus_firepower += data.firepower[slot.improvement];
			slot.bonus_torpedo   += data.torpedo[slot.improvement];
			slot.bonus_antiair   += data.antiair[slot.improvement];
			slot.bonus_ASW       += data.ASW[slot.improvement];
			slot.bonus_evasion   += data.evasion[slot.improvement];
			slot.bonus_LoS       += data.LoS[slot.improvement];
			slot.bonus_armor     += data.armor[slot.improvement];
		}
	}
}

// idへの装備ボーナスが存在するか
function EquipmentBonus_bonus_exists(id){
	return Boolean(this.bonus_data_map[id]);
}

function EquipmentBonus_assist_exists(id){
	return Boolean(this.assist_data_map[id]);
}

// 3点シナジーを与える装備かどうか
function EquipmentBonus_assist_3p_exists(id){
	let syn_3p = false;
	let arr = this.assist_data_map[id];
	if (arr) {
		for (let i=0; i<arr.length; i++) {
			if (arr[i].subequip_map1 && arr[i].subequip_map2) {
				syn_3p = true;
				break;
			}
		}
	}
	return syn_3p;
}

// 装備ボーナスに関係する装備か
function EquipmentBonus_bonus_concerns(id){
	return Boolean(this.bonus_data_map[id] || this.assist_data_map[id]);
}

// 単体ボーナス(累積可能)のみであるかどうか
// 他の装備へボーナスを乗せる場合は含まない
function EquipmentBonus_bonus_independent(id){
	let arr = this.bonus_data_map[id];
	if (arr && !this.assist_data_map[id]) {
		// さらに、本数でもボーナスが変わらないなら真
		for (let i=0; i<arr.length; i++) {
			if (!arr[i].independent()) return false;
		}
		return true;
		
	} else {
		return false;
	}
}

// 複合ボーナスがあるか  複数本ボーナスの場合も含む
// 他の装備へボーナスを乗せる場合は含まない
function EquipmentBonus_bonus_synergy_main(id){
	return this.bonus_exists(id) && !this.bonus_independent(id);
}

// 同一のシナジーを与える(副)装備である
// 若干微妙な判定だが問題はあまりないはず
function EquipmentBonus_same_assist(id1, id2){
	let assist1 = this.assist_data_map[id1];
	let assist2 = this.assist_data_map[id2];
	
	if (!assist1 || !assist2 || assist1.length != assist2.length) {
		return false;
	}
	
	for (let i=0; i<assist1.length; i++) {
		let bonus1 = assist1[i];
		let bonus2 = assist2[i];
		//if (bonus1 != bonus2 || !bonus1[1] || bonus1[2] || bonus1[3] || bonus1[4] || bonus1[5] || bonus1[6])
		if (bonus1 != bonus2)
		{
			return false;
		}
	}
	return true;
}

