// 艦の入力フォームとデータオブジェクト

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, EL, TEXT, _T, BRTEXT, HTML} from "./utility.mjs";
import {ShipSelector, ShipSelectorDialog} from "./kc_ship_selector.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import * as Damage from "./kc_damage_utility.mjs";
import {DOMDialog} from "./dom_dialog.mjs";
import {SupportShipData} from "./kc_support_ship_data.mjs";
import {EnemyStatus, EnemyStatusData} from "./kc_enemy_status.mjs";

export {
	SupportShip,
	SupportShipData,
};


// SupportShip -------------------------------------------------------------------------------------
// 支援艦隊の1艦
Object.assign(SupportShip.prototype, {
	// DOMオブジェクト
	// tbodyにまとめる
	e_tbody       : null,

	e_panel: null,

	// row
	e_5th_equipment_row    : null,
	e_exslot_equipment_row : null,
	// cell
	e_number_cell          : null,
	e_rawfirepower_eq_cell : null,
	e_rawfirepower_cell    : null,
	e_dragdrop_cells       : null, // array
	e_slot_firepower_cells : null, // array
	e_slot_accuracy_cells  : null, // array
	e_exslot_firepower_cell: null,
	e_exslot_accuracy_cell : null,
	e_total_firepower_cell : null,
	e_total_accuracy_cell  : null,
	e_cost_cell            : null,
	e_equipment_rows       : null, // array
	e_fuel: null,
	e_ammo: null,

	e_target_div: null,
	e_target_button: null,
	
	// form ほか
	e_lvluck          : null, // div
	e_lv              : null, // div
	e_lv_number       : null,
	e_luck            : null, // div
	e_luck_number     : null,
	e_condition_good  : null,
	e_exslot_available: null,
	e_priority        : null,
	e_engagement      : null,
	e_formation       : null,
	e_targetpower     : null,
	e_displaypower    : null, // span
	e_slot_fixes      : null, // array of input
	e_exslot_fix      : null,
	// 艦選択管理オブジェクト
	ship_selector : null,
	// 装備欄
	// 装備スロット数によらず常に用意しておく
	equipment_selects  : null, // array of EquipmentSelect
	ex_equipment_select: null, // EquipmentSelect
	
	// 左に表示する番号
	number: 0,
	// このオブジェクトを区別するID
	object_id: "",
	// データ (SupportShipData)
	// 外部からのアクセスには get_ssd(), set_ssd() を利用すること
	ssd: null,
	// 装備フォームに対応する艦名
	equipform_shipname: "",

	// 艦名(改造度合いを含む)
		// name  : "",
	// レベル, 運 (入力値)
		// level : -1,
		// luck  : -1,

	// 弾薬消費割合
	ammocost_rate: 0.8,
	
	// method
	set_name           : SupportShip_set_name,
	create             : SupportShip_create,
	create_panel       : SupportShip_create_panel,
	set_equipment_count: SupportShip_set_equipment_count,
	empty              : SupportShip_empty,
	is_cv_shelling     : SupportShip_is_cv_shelling,
	is_dd              : SupportShip_is_dd,
	set_target         : SupportShip_set_target,
	set_ammocost_rate  : SupportShip_set_ammocost_rate,
	get_fuelcost       : SupportShip_get_fuelcost,
	get_ammocost       : SupportShip_get_ammocost,
	clear              : SupportShip_clear,
	swap_data          : SupportShip_swap_data,
	is_index_available : SupportShip_is_index_available,
	get_slot_info      : SupportShip_get_slot_info,
	get_level_info: SupportShip_get_level_info,
	set_level     : SupportShip_set_level,
	get_luck_info : SupportShip_get_luck_info,
	set_luck      : SupportShip_set_luck,
	get_raw_accuracy: SupportShip_get_raw_accuracy,
	get_formation_value: SupportShip_get_formation_value,
	
	recreate_equipform : SupportShip_recreate_equipform,
	refresh            : SupportShip_refresh,
	refresh_shipinfo   : SupportShip_refresh_shipinfo,
	refresh_lvluck     : SupportShip_refresh_lvluck,
	refresh_target     : SupportShip_refresh_target,
	refresh_equipstatus: SupportShip_refresh_equipstatus,
	refresh_probs      : SupportShip_refresh_probs,
	
	form_to_ssd: SupportShip_form_to_ssd,
	ssd_to_form: SupportShip_ssd_to_form,
	match_ssd: SupportShip_match_ssd,

	// SupportShipData との変換
	get_ssd: SupportShip_get_ssd,
	set_ssd: SupportShip_set_ssd,

	// get_ssd_dep : SupportShip_get_ssd_dep,
	get_data: null,
	set_data: null,
	
	// json
	// ssdを使用するように変更
	get_json: null,
	set_json: null,
	
	// callback
	call_onchange : SupportShip_call_onchange,
	
	// event
	ev_change_ship     : SupportShip_ev_change_ship     ,
	ev_click_lvluck    : SupportShip_ev_click_lvluck    ,
	ev_change_cond     : SupportShip_ev_change_cond     ,
	ev_click_exavail   : SupportShip_ev_click_exavail   ,
	ev_change_priority : SupportShip_ev_change_priority ,
	ev_change_target   : SupportShip_ev_change_target   ,
	ev_change_equipment: SupportShip_ev_change_equipment,
});

// 主に後方互換
Object.defineProperties(SupportShip.prototype, {
	name: {
		get: function (){ return this.ssd.get_name(); },
		set: function (n){ this.set_name(n); debugger; },
	},
	level: {
		get: function (){ return this.ssd.input_level; },
		set: function (n){ this.ssd.input_level = n; }
	},
	luck: {
		get: function (){ return this.ssd.input_luck; },
		set: function (n){ this.ssd.input_luck = n; }
	},
	// 装備可能情報 (EquipableInfo)
	equipable_info : { get: function (){ return this.ssd.equipable_info; } },
	// 装備ボーナス情報 (EquipmentBonus)
	equipment_bonus: { get: function (){ return this.ssd.equipment_bonus; } },
	// callback
	onchange: {
		set: function (f){ this.addEventListener("change", f); }
	},
});


Object.assign(SupportShip, {
	selector_dialog: null,
	
	ss_to_ssd_json: SupportShip_ss_to_ssd_json,
});


// SupportShip -------------------------------------------------------------------------------------
/**
 * 支援艦隊の一隻
 * @param {number} number 
 * @param {string} object_id 
 * @constructor
 * @extends {EventTarget}
 */
function SupportShip(number, object_id){
	Util.attach_event_target(this);
	if (!object_id) debugger;
	
	this.number = number;
	this.object_id = object_id;

	this.ssd = new SupportShipData("");
}

/**
 * 艦名を設定
 * @param {string} name
 * @method SupportShip#set_name
 */
function SupportShip_set_name(name){
	this.ssd.set_name(name);

	// create() が呼んである場合
	if (this.ship_selector) {
		this.ssd_to_form();
	}
}

/**
 * DOMの生成
 * ドラッグ＆ドロップ処理は他艦とも関係あるので SupportFleet に
 * @param {number} def_priority 
 * @method SupportShip#create
 */
function SupportShip_create(def_priority){
	// イベント関数など
	let _change_target    = e => this.ev_change_target(e);
	let _change_equipment = e => this.ev_change_equipment(e);
	
	let _renamer = eq => {
		let str = ""; 
/*
		str += "[";
		if (this.ssd.cv_shelling) {
			str += Util.float_to_string((eq.firepower + eq.torpedo + eq.bombing * 1.3) * 1.5, 2, 0);
		} else {
			str += eq.firepower;
		}
		if (this.equipment_bonus && this.equipment_bonus.bonus_exists(eq.number)) {
			str += "+";
		}
		str += "/" + eq.accuracy + "] ";
*/
		str += Util.unescape_charref(eq.name);
		return str;
	};
	
	// 艦娘選択ダイアログ
	let dialog = SupportShip.selector_dialog;
	if (!dialog) {
		dialog = new ShipSelectorDialog();
		dialog.create("", ShipSelectorDialog.support_shipcode_def, ShipSelectorDialog.support_hidden_groups);
		dialog.e_hidden_groups_label.title = "軽巡ほか";
		SupportShip.selector_dialog = dialog;
	}
	
	// 艦の選択・補強増設
	this.ship_selector = new ShipSelector("popup", dialog);
	this.ship_selector.onchange = name => this.ev_change_ship(name);
	this.e_lvluck = NODE(ELEMENT("div.lvluck.row"), [
		this.e_lv = NODE(ELEMENT("div.lv"), [
			TEXT("Lv"),
			this.e_lv_number = ELEMENT("span.lvnum"),
		]),
		this.e_luck = NODE(ELEMENT("div.luck"), [
			TEXT("運"),
			this.e_luck_number = ELEMENT("span.lucknum"),
		]),
	]);
	this.e_lvluck.addEventListener("click", e => this.ev_click_lvluck(e));
	this.e_condition_good = ELEMENT("input", {type: "checkbox"});
	this.e_condition_good.addEventListener("change", e => this.ev_change_cond(e));
	this.e_exslot_available = ELEMENT("input", {type: "checkbox"});
	this.e_exslot_available.addEventListener("change", e => this.ev_click_exavail(e));
	
	// 優先度
	this.e_priority = ELEMENT("select", "", "priority");
	for (let i=1; i<=12; i++) {
		let name = i;
		if (i == 1) name += " (高)";
		if (i == 12) name += " (低)";
		this.e_priority.appendChild(new Option(name, i));
	}
	this.e_priority.selectedIndex = (1 <= def_priority && def_priority <= 12) ? def_priority - 1 : 0;
	this.e_priority.addEventListener("change", e => this.ev_change_priority(e));
	
	// 装備欄
	this.e_slot_fixes = new Array;
	this.equipment_selects = new Array;
	
	for (let i=0; i<5; i++) {
		this.e_slot_fixes[i] = ELEMENT("input.eq_fix", {type: "checkbox"});
		this.e_slot_fixes[i].addEventListener("change", _change_equipment);
		this.equipment_selects[i] = new EquipmentSelect;
		this.equipment_selects[i].renamer = _renamer;
		this.equipment_selects[i].onchange = _change_equipment;
	}
	this.e_exslot_fix = ELEMENT("input.eq_fix", {type: "checkbox"});
	this.e_exslot_fix.addEventListener("change", _change_equipment);
	this.ex_equipment_select = new EquipmentSelect;
	this.ex_equipment_select.renamer = _renamer;
	this.ex_equipment_select.onchange = _change_equipment;
	
	this.create_panel();
	
	if (!this.ssd.empty()) {
		this.ship_selector.set_shipname(this.ssd.get_name());
	}
	this.refresh();
}

/**
 * パネルの生成
 * @method SupportShip#create_panel
 */
function SupportShip_create_panel(){
	this.e_panel = NODE(ELEMENT("div.panel"), [
		// 番号、名前等
		NODE(ELEMENT("div.panelheader.row"), [
			this.e_number_cell = NODE(ELEMENT("div.number.hvcenter"), [TEXT(this.number)]),
			this.ship_selector.e_shipname_div,
			NODE(ELEMENT("div.column.m2"), [
				this.e_lvluck,
				NODE(ELEMENT("div.row"), [
					NODE(ELEMENT("label"), [this.e_condition_good, TEXT("キラ")]),
					NODE(ELEMENT("label"), [this.e_exslot_available, TEXT("増設")]),
				]),
			]),
			NODE(ELEMENT("div.fuelammo.column.gap3.m2"), [
				NODE(ELEMENT("div"), [TEXT("燃"), this.e_fuel = ELEMENT("span.fuel")]),
				NODE(ELEMENT("div"), [TEXT("弾"), this.e_ammo = ELEMENT("span.ammo")]),
			]),
			NODE(ELEMENT("div.column.hcenter.m2.hidden"), [
				NODE(ELEMENT("div.poweracc.row"), [
					this.e_total_firepower_cell = ELEMENT("div.power.total"),
					this.e_total_accuracy_cell = ELEMENT("div.acc.total"),
				]),
			]),
		]),
		// 優先度、目標設定
		NODE(ELEMENT("div.row.gap4.topborder"), [
			NODE(ELEMENT("div.priority.column.vcenter"), [
				NODE(ELEMENT("div"), [TEXT("優先度")]),
				NODE(ELEMENT("div"), [this.e_priority]),
			]),
			this.e_target_div = EL("div.goal.grow", [
				this.e_target_button = EL("span.button.mr", [TEXT("目標")]),
			]),
		]),
		// ツール
		NODE(ELEMENT("div.tools.row.gap3.topborder.hidden"), [
			ELEMENT("span.button", {textContent: "探索"}),
			ELEMENT("span.button", {textContent: "分析"}),
			ELEMENT("div.grow"),
			ELEMENT("span.button", {textContent: "装備解除"}),
		]),
		// 対仮想敵
		this.e_venemy_row = EL("div.venemy.column.topborder", [
			this.e_venemy_probs_row = EL("div.probs.row",
				this.e_venemy_probs = [
					EL("div.damage_lv4"),
					EL("div.damage_lv3"),
					EL("div.damage_lv2"),
					EL("div.damage_lv1"),
					EL("div.damage_lv0"),
					EL("div.miss"),
				]
			),
			this.e_venemy_probbar_row = EL("div.probbar.row", 
				this.e_venemy_bars = [
					EL("div.bar.damage_lv4"),
					EL("div.bar.damage_lv3"),
					EL("div.bar.damage_lv2"),
					EL("div.bar.damage_lv1"),
					EL("div.bar.damage_lv0"),
					EL("div.bar.miss"),
				]
			),
		]),
		// 火力
		EL("div.fpwrow.row.topborder", [
			EL("div.label", [_T("キャップ後")]),
			this.e_postcap_power = EL("div.postcaps.grow"),
			EL("div.grow"),
			EL("div.label", [_T("表示火力")]),
			this.e_display_power = EL("div.display_power"),
			this.e_total_power = EL("div.total.eq_power"),
			this.e_total_acc = EL("div.total.eq_acc"),
		]),
	]);

	// 装備
	let e_eqrows = ELEMENT("div.eqrows.column.topborder");
	let eqrows = [];
	let dds = [];
	let fpws = [];
	let accs = [];

	// 素火力行
	eqrows.push(
		NODE(ELEMENT("div.row"), [
			this.e_rawfirepower_eq_cell = ELEMENT("div.shipbase"),
			this.e_rawfirepower_cell = ELEMENT("div.eq_power"),
			this.e_rawaccuracy_cell = ELEMENT("div.eq_acc"),
		])
	);
	// 通常装備
	for (let i=0; i<5; i++) {
		eqrows.push(
			NODE(ELEMENT("div.row"), [
				dds[i] = NODE(ELEMENT("div.eq_dragdrop"), [TEXT("E" + (i + 1))]),
				this.e_slot_fixes[i],
				this.equipment_selects[i].e_select,
				this.equipment_selects[i].e_star,
				fpws[i] = ELEMENT("div.eq_power"),
				accs[i] = ELEMENT("div.eq_acc"),
			])
		);
	}
	// 増設装備
	eqrows.push(
		NODE(ELEMENT("div.row"), [
			dds[5] = NODE(ELEMENT("div.eq_dragdrop"), [TEXT("EX")]),
			this.e_exslot_fix,
			this.ex_equipment_select.e_select,
			this.ex_equipment_select.e_star,
			fpws[5] = ELEMENT("div.eq_power"),
			accs[5] = ELEMENT("div.eq_acc"),
		])
	);
	this.e_exslot_firepower_cell = fpws[5];
	this.e_exslot_accuracy_cell  = accs[5];
	this.e_dragdrop_cells = dds;
	this.e_slot_firepower_cells = fpws;
	this.e_slot_accuracy_cells = accs;
	this.e_equipment_rows = eqrows;

	this.e_target_button.addEventListener("click", _e => {
		let detail = {src: this};
		this.dispatchEvent(new CustomEvent("click_target", {detail: detail}));
	});
	
	NODE(e_eqrows, eqrows);
	this.e_panel.appendChild(e_eqrows);
}

/**
 * 装備表示数の変更
 * 非表示中のフォームは .hidden
 * // tr は .hidden_row
 * @param {number} count 通常スロット数
 * @param {boolean} show_exslot 増設
 * @method SupportShip#set_equipment_count
 */
function SupportShip_set_equipment_count(count, show_exslot){
	// 素火力を含む行オブジェクト
	let ilast = this.e_equipment_rows.length - 1;
	for (let i=0; i<ilast; i++) {
		this.e_equipment_rows[i].classList.toggle("hidden", i > count);
	}
	// 増設
	this.e_equipment_rows[ilast].classList.toggle("hidden", !show_exslot);
}

/**
 * 艦が選択されているかどうか
 * @returns {boolean}
 * @alias SupportShip#empty
 */
function SupportShip_empty(){
	return this.ssd.empty();
}
/**
 * @returns {boolean}
 * @method SupportShip#is_cv_shelling
 */
function SupportShip_is_cv_shelling(){
	return this.ssd.is_cv_shelling();
}
/**
 * @return {boolean}
 * @method SupportShip#is_dd
 */
function SupportShip_is_dd(){
	return this.ssd.is_dd();
}

// 一括設定用関数
/** @deprecated */
function SupportShip_set_target(en_index, fm_index, targetpower){
	this.e_engagement.selectedIndex = en_index;
	this.e_formation.selectedIndex = fm_index;
	if (targetpower >= 0) {
		this.e_targetpower.value = targetpower;
	}
	
	this.refresh_equipstatus();
}

function SupportShip_set_ammocost_rate(new_rate){
	if (this.ammocost_rate != new_rate) {
		this.ammocost_rate = new_rate;
		this.refresh_shipinfo();
	}
}

function SupportShip_get_fuelcost(){
	let ship = this.ssd.ship;
	let cost = 0;
	if (ship) {
		cost = Math.ceil(+ship.fuel * 0.5);
		if (this.get_level_info().married) {
			cost = Math.max(Math.floor(cost * 0.85), 1);
		}
	}
	return cost;
}

function SupportShip_get_ammocost(){
	let ship = this.ssd.ship;
	let cost = 0;
	if (ship) {
		cost = Math.ceil(+ship.ammo * this.ammocost_rate);
		if (this.get_level_info().married) {
			cost = Math.max(Math.floor(cost * 0.85), 1);
		}
	}
	return cost;
}

function SupportShip_clear(priority){
	let ssd = new SupportShipData("");
	if (priority) {
		ssd.priority = priority;
	} else {
		ssd.priority = +this.e_priority.value;
	}
	this.set_ssd(ssd);
}

/**
 * データの入れ替え
 * number とかは入れ替えない
 * @param {SupportShip} ship 
 * @method SupportShip#swap_data
 */
function SupportShip_swap_data(ship){
	let this_ssd = this.get_ssd();
	this.set_ssd(ship.get_ssd());
	ship.set_ssd(this_ssd);
}

// 常に5スロ+増設の分のオブジェクトを用意しているが、その index 番目が現在入力可能かどうか
function SupportShip_is_index_available(index){
	let slot_count = this.equipable_info.get_slot_count();
	let exavail = this.e_exslot_available.checked;
	return (0 <= index && index < slot_count) || (exavail && index == 5);
}

// index からスロットの情報を得る
// index == 5 が増設
function SupportShip_get_slot_info(index){
	if (!this.is_index_available(index)) return null;
	
	let data = new Object;
	if (index != 5) {
		data.equipable = this.equipable_info.slot_equipables[index];
		data.select = this.equipment_selects[index];
	} else {
		data.equipable = this.equipable_info.exslot_equipable;
		data.select = this.ex_equipment_select;
	}
	data.id = data.select.get_id();
	data.star = data.select.get_star();
	return data;
}

// レベル情報
function SupportShip_get_level_info(){
	let level = this.level;
	if (level < 0) level = SupportShipData.default_level;
	return {
		level     : level,
		raw_level : this.level,
		is_default: this.level < 0,
		married   : level >= 100,
	};
}
function SupportShip_set_level(level){
	this.level = +level >= 0 ? +level : -1;
}

// 運の情報
function SupportShip_get_luck_info(){
	let ship = this.ssd.ship;
	let luck = this.luck;
	let min_luck = ship?.luckMin ? +ship.luckMin : -1;
	let max_luck = ship?.luckMax ? +ship.luckMax : -1;

	// 負数はデフォルト値
	if (luck < 0) luck = min_luck;

	let in_range = luck >= 1;

	if (min_luck > 0) {
		in_range &&= min_luck <= luck;
	}
	if (max_luck > 0) {
		in_range &&= luck <= max_luck;
	}

	return {
		luck    : luck,
		raw_luck: this.luck,
		min_luck: min_luck, // 未入力の場合は -1
		max_luck: max_luck, // 同様
		in_range: in_range, // 範囲外が確定しているとき false
		is_default: this.luck < 0, // 初期値の場合 true
	};
}
function SupportShip_set_luck(luck){
	this.luck = +luck >= 0 ? +luck : -1;
}

/**
 * @method SupportShip#get_raw_accuracy
 */
function SupportShip_get_raw_accuracy(){
	let level = this.get_level_info().level;
	let luck = this.get_luck_info().luck;
	return 2 * Math.sqrt(level) + 1.5 * Math.sqrt(luck);
}

/**
 * @method SupportShip#get_formation_value
 */
function SupportShip_get_formation_value(){
	let name = this.e_formation.value;
	let d = Global.FORMATION_DEFINITION.find(def => def.name == name);
	return d ? d.support : 1;
}


/**
 * 装備フォームを再生成する
 * ssd.equipable_info を利用
 * @param {boolean} [force_recreate=false] 強制的に再生成する
 * @method SupportShip#recreate_equipform
 */
function SupportShip_recreate_equipform(force_recreate = false){
	let name = this.ssd.get_name();

	if (force_recreate || name != this.equipform_shipname) {
		let info = this.ssd.equipable_info;
		for (let i=0; i<5; i++) {
			this.equipment_selects[i].recreate_options(info.slot_equipables[i], null, true);
		}
		this.ex_equipment_select.recreate_options(info.exslot_equipable, null, true);
		this.equipform_shipname = name;
	}
}


/**
 * 全ての表示を更新する
 * フォームには関与しない
 * @param {boolean} [recalc_ssd=false] ssdの一時変数を再計算。敵艦情報が変わった場合など
 * @method SupportShip#refresh
 */
function SupportShip_refresh(recalc_ssd = false){
	if (recalc_ssd) this.ssd.set_cachevars();
	this.refresh_shipinfo();
	this.refresh_lvluck();
	this.refresh_target();
	this.refresh_equipstatus();
	this.refresh_probs();
}


/**
 * その他の表示の更新
 * @method SupportShip#refresh_shipinfo
 */
function SupportShip_refresh_shipinfo(){
	// 消費(砲撃支援)
	let exists = !this.ssd.empty();
	this.e_fuel.textContent = exists ? this.get_fuelcost() : 0;
	this.e_ammo.textContent = exists ? this.get_ammocost() : 0;
}

/**
 * レベル・運の欄(div)を更新
 * 変更された場合は refresh_equipstatus() の方も呼ぶ必要がある
 * ヘッダーのほうも変更の必要があるかも
 * @method SupportShip#refresh_lvluck
 */
function SupportShip_refresh_lvluck(){
	if (this.ssd.empty()) {
		this.e_lv_number.textContent = " -";
		this.e_lv.classList.toggle("inputted", false);
		this.e_lv.classList.toggle("married", false);
		this.e_luck_number.textContent = " -";
		this.e_luck.classList.toggle("inputted", false);
		this.e_luck.classList.toggle("error", false);

	} else {
		let lvinfo = this.get_level_info();
		let luckinfo = this.get_luck_info();

		this.e_lv_number.textContent = lvinfo.level;
		this.e_lv.classList.toggle("inputted", !lvinfo.is_default);
		this.e_lv.classList.toggle("married", lvinfo.married);
		this.e_luck_number.textContent = luckinfo.luck;
		this.e_luck.classList.toggle("inputted", !luckinfo.is_default);
		this.e_luck.classList.toggle("error", !luckinfo.in_range);
	}
}

/**
 * 探索目標の更新
 * @method SupportShip#refresh_target
 */
function SupportShip_refresh_target(){
	let e_target_div = this.e_target_div;
	Util.remove_children(e_target_div);

	// [探索目標] 陣形 / 交戦形態
	let sfm = this.ssd.attack_score.atk_formation_def;
	let efm = this.ssd.attack_score.def_formation_def;
	let eng = this.ssd.attack_score.engagementform_def;

	NODE(e_target_div, [
		this.e_target_button,
		EL("span.self." + sfm.className, [TEXT(sfm.name)]),
		TEXT(" vs "),
		EL("span.enemy." + efm.className, [TEXT(efm.name)]),
		TEXT(" / "),
		EL("span." + eng.className, [TEXT(eng.name)]),
		EL("br"),
	]);

	if (this.ssd.targeting_mode == Global.TARGETING_VENEMY) {
		// 仮想敵モード
		let name = "";
		let st = null;

		if (this.ssd.target_id == EnemyStatus.ID_EMPTY) {
			name = "(未選択)";
		} else if (this.ssd.target_id == EnemyStatus.ID_DIRECTINPUT) {
			name = "直接入力";
			st = EnemyStatusData.createDirectInput(this.ssd.target_hp, this.ssd.target_armor, this.ssd.target_evasion, this.ssd.target_luck);
		} else {
			name = this.ssd.target_id + ": ";
			st = EquipmentDatabase.enemy_status.getStatus(this.ssd.target_id);
			name += st.csv_exists ? st.csv.name : "?";
		}
		if (st) {
			st.default_value = "??";
			name += " (HP" + st.HP + "/装甲" + st.armor + "/回避" + st.evasion + "/運" + st.luck + ")";
		}

		let damage_text = "";
		let app = "";
		if (st && st.HP >= 1) {
			if (this.ssd.need_damage == 0) {
				damage_text = "命中率";

			} else {
				damage_text = "ダメージ" + this.ssd.need_damage + "以上の確率";

				let borders = this.ssd.attack_score.getNeedBorders();
				let damage_names = ["撃沈", "大破以上", "中破以上"];
				for (let i=0; i<damage_names.length; i++) {
					if (this.ssd.need_damage == borders[i]) {
						app = damage_names[i];
						break;
					}
				}
			}
		}
		if (app) app = " (" + app + ")";
		
		NODE(e_target_div, [
			_T(name),
			EL("br"),
			_T(damage_text + app),
		]);
		
	} else {
		// 火力目標モード
		let postcap = this.ssd.targeting_mode == Global.TARGETING_POSTCAP;
		let border = this.ssd.border_power;
		let fm = this.ssd.attack_score.formation_power;
		let en = this.ssd.attack_score.engagement_power;
		let bp = postcap ?
			SupportShipData.postcap_to_base(en, fm, border) :
			SupportShipData.precap_to_base(en, fm, border);
		let dp = bp - (5 + Global.SUPPORT_MODIFY);
		
		NODE(e_target_div, [
			_T((postcap ? "キャップ後" : "キャップ前") + "攻撃力"),
			EL("span.border_power", [TEXT(this.ssd.border_power)]),
			_T("以上"),
			EL("br"),
		]);
		
		if (bp > 0) {
			NODE(e_target_div, [
				_T("基本攻撃力"),
				EL("span.basic_power", [_T(bp)]),
			]);
			if (!this.ssd.empty() && !this.ssd.cv_shelling && dp > 0) {
				NODE(e_target_div, [
					_T(" (表示火力"),
					EL("span.display_power", [_T(dp)]),
					_T(")"),
				]);
			}
		} else {
			NODE(e_target_div, [_T("火力条件なし")]);
		}
	}
}

/**
 * 装備に関する部分の表示を更新
 * @method SupportShip#refresh_equipstatus
 */
function SupportShip_refresh_equipstatus(){
	let ssd = this.ssd;
	let slot_count = ssd.slot_count;
	let ilim = this.equipment_selects.length + 1;
	let exists = !this.ssd.empty();
	let exavail = exists && this.e_exslot_available.checked;
	// 装備表示数
	this.set_equipment_count(slot_count, exavail);
	
	// 素火力行
	if (exists) {
		this.e_rawfirepower_eq_cell.textContent = "素火力 (" + ssd.raw_firepower + ") / 基礎命中 (Lv" + ssd.level + " 運" + ssd.luck +")";
		// 基礎火力
		if (ssd.cv_shelling) {
			this.e_rawfirepower_cell.textContent = Util.float_to_string((ssd.raw_firepower + Global.SUPPORT_MODIFY) * 1.5 + 55, 2, 0);
		} else {
			this.e_rawfirepower_cell.textContent = ssd.raw_firepower + 5 + Global.SUPPORT_MODIFY;
		}
		// 基礎命中
		this.e_rawaccuracy_cell.textContent = Util.float_to_string(ssd.raw_accuracy, 0, -1);

	} else {
		this.e_rawfirepower_eq_cell.textContent = "素火力 / 基礎命中";
		this.e_rawfirepower_cell.textContent = "";
		this.e_rawaccuracy_cell.textContent = "";
	}

	// 装備のステータスと装備ボーナス
	ssd.calc_bonus();

	for (let i=0; i<ilim; i++) {
		// let enabled = i < slot_count || (ssd.exslot_available && i == ilim - 1);
		let fpcell = i < 5 ? this.e_slot_firepower_cells[i] : this.e_exslot_firepower_cell;
		let accell = i < 5 ? this.e_slot_accuracy_cells[i] : this.e_exslot_accuracy_cell;
		
		let slot = null;
		if (i < slot_count) {
			slot = ssd.allslot_equipment[i];
		} else if (ssd.exslot_available && i == ilim - 1) {
			slot = ssd.allslot_equipment[ssd.allslot_equipment.length - 1];
		}
		
		let fpcell_text = "";
		let accell_text = "";
		
		if (slot && slot.equipment_data) {
			let eq = slot.equipment_data;
			fpcell_text = Util.float_to_string(slot.get_power_float(ssd.cv_shelling, true, false), ssd.cv_shelling ? 2 : 0, 0);
			accell_text = eq.accuracy;
			
			let bonus = slot.get_power_float(ssd.cv_shelling, false, true);
			if (bonus != 0) {
				fpcell_text += bonus > 0 ? "+" : "";
				fpcell_text += Util.float_to_string(bonus, ssd.cv_shelling ? 1 : 0, 0);
			}
		}
		
		fpcell.textContent = fpcell_text;
		accell.textContent = accell_text;
	}
	
	// 合計
	let tfp_text = "", tfp_hint = "", tac_text = "";
	let fpw_good = false, fpw_bad = false, fpw_between = false, fpw_cl1bad = false;
	let acc_good = false, acc_bad = false, acc_between = false;
	let dpw_text = "-";
	let finals_text = "-";

	if (exists) {
		let basic = ssd.get_basic_power();
		let eq_acc = ssd.get_equipment_accuracy();
		let acc = Math.floor(ssd.get_accuracy());
		
		tfp_text = basic;
		if (basic > 0) {
			let _get_final = en_name => {
				let en_def = Global.ENGAGEMENT_FORM_DEFINITION.find(d => d.name == en_name);
				if (!en_def) return "-";
				let precap = basic * en_def.support * ssd.formation_modify;
				return Math.floor(Damage.sqrtcap(precap, Global.SUPPORT_POWER_CAP));
			};
			
			tfp_hint += "表示火力 " + ssd.get_display_power() + "\n";
			tfp_hint += "最終攻撃力\n";
			tfp_hint += _get_final("同航戦") + " / ";
			tfp_hint += _get_final("反航戦") + " / ";
			tfp_hint += _get_final("T字不利") + " / ";
			tfp_hint += _get_final("T字有利") + "\n";
			tfp_hint += "(同航/反航/T不利/T有利)\n";
			
			dpw_text = ssd.get_display_power();
			finals_text = _get_final("同航戦") + " / ";
			finals_text += _get_final("反航戦") + " / ";
			finals_text += _get_final("T字不利") + " / ";
			finals_text += _get_final("T字有利");
		} else {
			tfp_hint += "攻撃不可";
		}
		tac_text = Util.float_to_string(eq_acc + ssd.raw_accuracy, 0, -1);
		
		if (ssd.targeting_mode == Global.TARGETING_VENEMY) {
			// 仮想敵モードの場合
			if (ssd.attack_score.good()) {
				// 火力
				let inf = SupportShipData.postcap_to_base(ssd.attack_score.engagement_power, ssd.attack_score.formation_power, ssd.attack_score.power_infimum);
				let inf2 = SupportShipData.postcap_to_base(ssd.attack_score.engagement_power, ssd.attack_score.formation_power, Math.ceil(ssd.attack_score.power_infimum / 1.5));
				fpw_good = basic > 0 && basic >= ssd.border_basic_power;
				fpw_bad = basic <= 0 || basic <= inf2;
				fpw_cl1bad = !fpw_bad && basic <= inf;
				fpw_between = !(fpw_good || fpw_cl1bad || fpw_bad);
				// 命中
				acc_good = acc >= ssd.attack_score.accuracy_supremum;
				acc_bad = acc <= ssd.attack_score.accuracy_infimum;
				acc_between = !(acc_good || acc_bad);
			}

		} else {
			fpw_good = basic > 0 && basic >= ssd.border_basic_power;
			fpw_bad = basic <= 0 || basic < ssd.border_basic_power;
			acc_good = eq_acc >= 0;
			acc_bad = eq_acc < 0;
		}
	}
	this.e_total_firepower_cell.textContent = tfp_text;
	this.e_total_firepower_cell.title = tfp_hint;
	this.e_total_accuracy_cell.textContent = tac_text;
	
	this.e_total_firepower_cell.classList.toggle("good", fpw_good);
	this.e_total_firepower_cell.classList.toggle("bad", fpw_bad);
	this.e_total_accuracy_cell.classList.toggle("good", acc_good);
	this.e_total_accuracy_cell.classList.toggle("bad", acc_bad);
	
	// キャップ後火力行
	this.e_postcap_power.textContent = finals_text;
	this.e_postcap_power.title = "同航戦 / 反航戦 / T字不利 / T字有利";
	this.e_display_power.textContent = dpw_text;
	this.e_total_power.textContent = tfp_text;
	this.e_total_power.classList.toggle("good", fpw_good);
	this.e_total_power.classList.toggle("between", fpw_between);
	this.e_total_power.classList.toggle("cl1bad", fpw_cl1bad);
	this.e_total_power.classList.toggle("bad", fpw_bad);
	this.e_total_acc.textContent = tac_text;
	this.e_total_acc.classList.toggle("good", acc_good);
	this.e_total_acc.classList.toggle("between", acc_between);
	this.e_total_acc.classList.toggle("bad", acc_bad);
}

/**
 * ダメージの確率表示を更新
 * @alias SupportShip#refresh_probs
 */
function SupportShip_refresh_probs(){
	let noprob = this.ssd.empty() || this.ssd.targeting_mode != Global.TARGETING_VENEMY || !this.ssd.attack_score.good();

	this.ssd.calc_bonus();
	let final = this.ssd.get_final_power();
	let acc = this.ssd.get_accuracy();
	// 攻撃不可 (空母など)
	if (final <= 0) noprob = true;
	let probs = noprob ? new Array(5).fill(0) : this.ssd.attack_score.getProbs(final, acc);

	let set = (text_div, bar_div, p, text_over = "") => {
		let text = text_over || (p > 0 ? Util.float_to_string(p * 100, 1) + "%" : "");
		let size = Util.float_to_string(p * 100, 3) + "%";
		text_div.textContent = text;
		text_div.classList.toggle("exists", text != "");
		text_div.style.flexBasis = size;
		bar_div.style.flexBasis = size;
	};

	let hints = [];
	let miss = 1;
	for (let i=0; i<probs.length; i++) {
		set(this.e_venemy_probs[i], this.e_venemy_bars[i], probs[i]);
		miss -= probs[i];
		if (probs[i] > 0) {
			hints.push(Damage.DAMAGE_KEYS_R[i] + ": " + Util.float_to_string(probs[i] * 100, 3) + "%");
		}
	}
	set(this.e_venemy_probs[probs.length], this.e_venemy_bars[probs.length], miss, noprob ? "N/A" : "");
	if (!noprob) {
		hints.push("miss: " + Util.float_to_string(miss * 100, 3) + "%");
	}
	this.e_venemy_row.title = hints.join("\n");
}

/**
 * フォーム(DOM)のデータをthis.ssdへ
 * キラ、増設、優先度、装備、固定状態 (、艦名)
 * @method SupportShip#form_to_ssd
 */
function SupportShip_form_to_ssd(){
	let ssd = this.ssd;
	ssd.condition_good = this.e_condition_good.checked;
	ssd.priority = Util.formstr_to_int(this.e_priority.value, 12, 12).value;
	ssd.exslot_available = this.e_exslot_available.checked;

	let ids = new Array(6).fill(0);
	let stars = new Array(6).fill(0);
	let fixes = new Array(6).fill(false);

	if (!ssd.empty()) {
		for (let i=0; i<ssd.slot_count; i++) {
			let sel = this.equipment_selects[i];
			ids[i] = +sel.get_id();
			stars[i] = sel.get_star();
			fixes[i] = this.e_slot_fixes[i].checked;
		}
		
		if (ssd.exslot_available) {
			let i = 5, sel = this.ex_equipment_select;
			ids[i] = +sel.get_id();
			stars[i] = sel.get_star();
			fixes[i] = this.e_exslot_fix.checked;
		}
	}
	
	ssd.equipment_ids = ids;
	ssd.equipment_stars = stars;
	ssd.equipment_fixes = fixes;

	// 名前は同期するはずだが念の為
	ssd.set_name(this.ship_selector.get_shipname());
	// ssd.set_cachevars(); // set_name()で呼ばれる
}

/**
 * this.ssdのデータをフォームに
 * 表示は自動更新
 * @method SupportShip#ssd_to_form
 */
function SupportShip_ssd_to_form(){
	let ssd = this.ssd;
	this.e_condition_good.checked = ssd.condition_good;
	this.e_priority.value = ssd.priority;
	this.e_exslot_available.checked = ssd.exslot_available;

	if (this.ship_selector.get_shipname() != ssd.get_name()) {
		this.ship_selector.set_shipname(ssd.get_name());
	}
	// 装備フォームの再生成
	this.recreate_equipform();

	// 装備フォームにデータをセット
	for (let i=0; i<this.equipment_selects.length; i++) {
		let val = "", fix = false;
		let star = 0;
		// 通常スロット有効部
		if (i < ssd.slot_count) {
			val = ssd.equipment_ids[i] || "";
			fix = ssd.equipment_fixes[i] ?? false;
			star = ssd.equipment_stars[i] ?? 0;
		}
		this.equipment_selects[i].set_id_star(val, star);
		this.e_slot_fixes[i].checked = fix;
	}

	// 増設
	let ex_val = "", ex_fix = false;
	let ex_star = 0;
	if (ssd.exslot_available && !ssd.empty()) {
		let r = 5;
		ex_val = ssd.equipment_ids[r] || "";
		ex_fix = ssd.equipment_fixes[r] ?? false;
		ex_star = ssd.equipment_stars[r] ?? 0;
	}
	this.ex_equipment_select.set_id_star(ex_val, ex_star);
	this.e_exslot_fix.checked = ex_fix;

	// 表示の更新
	this.refresh();
}

/**
 * このオブジェクトに対応するssdかどうか
 * @param {SupportShipData} ssd 
 * @returns {boolean}
 * @alias SupportShip#match_ssd
 */
function SupportShip_match_ssd(ssd){
	return this.object_id == ssd.ship_object_id;
}

/**
 * SupportShipData 形式でデータのコピーを得る
 * @returns {SupportShipData}
 * @method SupportShip#get_ssd
 */
function SupportShip_get_ssd(){
	let ssd = this.ssd.clone();
	ssd.ship_object_id = this.object_id;
	delete ssd.cv_force_attackable;
	return ssd;
}

/**
 * SupportShipData 形式でデータを設定する
 * @param {SupportShipData} ssd
 * @method SupportShip#set_ssd
 */
function SupportShip_set_ssd(ssd){
	this.ssd = ssd.clone();
	this.ssd_to_form();
}

/**
 * 旧JSON(SupportShip用)を新JSON(SupportShipData用)に変換
 * @param {*} src
 * @returns {*}
 * @alias SupportShip.ss_to_ssd_json
 */
function SupportShip_ss_to_ssd_json(src){
	if (!src) return null;

	let ship = EquipmentDatabase.csv_shiplist.find(d => d.name == src.name);
	let json = Object.assign({}, src, {
		ship_id: ship?.shipId,
		input_level: src.level,
		input_luck : src.luck,
		priority : +src.priority,
		exslot_available: src.exslot_available ? 1 : 0,
	});

	let duparray = (out, arr, type, len = out.length) => {
		for (let i=0; i<len; i++) {
			out[i] = arr?.[i] ?? out[i];
			if (type) out[i] = type(out[i]);
		}
		return out;
	};

	json.equipment_ids = duparray(new Array(6).fill(0), json.equipment_ids, Number);
	json.equipment_stars = duparray(new Array(6).fill(0), json.equipment_stars, Number);
	json.equipment_fixes = duparray(new Array(6).fill(0), json.slot_fixes, Number);
	json.equipment_ids[5] = +(json.ex_equipment_id ?? 0);
	json.equipment_stars[5] = +(json.ex_equipment_star ?? 0);
	json.equipment_fixes[5] = +(json.exslot_fix ?? 0);

	json.self_formation = Global.FORMATION_DEFINITION_EX.find(x => x.keys?.includes(json.formation))?.id ?? 1;
	json.engagementform = Global.ENGAGEMENT_FORM_DEFINITION.find(x => x.keys?.includes(json.engagement))?.id ?? 1;
	json.targeting_mode = Global.TARGETING_POSTCAP;
	json.border_power   = +(json.targetpower ?? SupportShipData.prototype.border_power);
	// 他はデフォルト値

	// 不要なプロパティ
	let dels = [
		"name", "level", "luck",
		"ex_equipment_id", "ex_equipment_star", "slot_fixes", "exslot_fix",
		"formation", "engagement", "targetpower",
	];
	for (let key of dels) delete json[key];

	return json;
}

/**
 * changeイベントをdispatch
 * @method SupportShip#call_onchange
 * @protected
 */
function SupportShip_call_onchange(){
	this.dispatchEvent(new CustomEvent("change"));
}


function SupportShip_ev_change_ship(name){
	this.ssd.set_name(name);
	this.ssd_to_form();
	this.call_onchange();
}

function SupportShip_ev_click_lvluck(e){
	if (this.empty()) return;

	let dialog = new SupportShipLvLuckDialog(this);
	dialog.create();
	dialog.show().then(code => {
		if (code == "ok") {
			this.set_level(dialog.level);
			this.set_luck(dialog.luck);
			this.ssd.set_cachevars();
			this.refresh_shipinfo();
			this.refresh_lvluck();
			this.refresh_equipstatus();
			this.refresh_probs();
			this.call_onchange();
		}
		dialog.dispose();
	});

	// e_lvluck の右に表示
	let rect = this.e_lvluck.getBoundingClientRect();
	let x = rect.right;
	let y = rect.top - dialog.e_bar.offsetHeight - 1;
	dialog.move_to(x, y);
}

function SupportShip_ev_change_cond(){
	this.form_to_ssd();
	this.refresh_equipstatus();
	this.refresh_probs();
	this.call_onchange();
}

function SupportShip_ev_click_exavail(){
	this.form_to_ssd();
	this.refresh_equipstatus();
	this.refresh_probs();
	this.call_onchange();
}

function SupportShip_ev_change_priority(){
	this.form_to_ssd();
	this.call_onchange();
}

function SupportShip_ev_change_target(){
	this.refresh_target();
	this.refresh_equipstatus();
	this.refresh_probs();
	this.call_onchange();
}

function SupportShip_ev_change_equipment(){
	this.form_to_ssd();
	this.refresh_equipstatus();
	this.refresh_probs();
	this.call_onchange();
}


/**
 * レベルと運の入力ダイアログ
 * @extends DOMDialog
 */
class SupportShipLvLuckDialog extends DOMDialog {
	sship;
	e_level;
	e_level_1;
	e_level_99;
	e_level_max;
	e_luck;
	e_luck_min;
	e_luck_max;
	e_basic_accuracy;
	e_ok;
	e_cancel;

	// sshipのデータ
	level_info;
	luck_info;

	/**
	 * @param {SupportShip} [sship]
	 */
	constructor(sship = null){
		super();
		this.sship = sship;
	}
	/**
	 * DOMの作成
	 */
	create(){
		super.create("modal", "Lv/運", true);
		this.e_inside.classList.add("lvluck");

		NODE(this.e_contents, [
			NODE(ELEMENT("div"), [
				NODE(ELEMENT("span.tag"), [TEXT("Lv")]),
				this.e_level = ELEMENT("input", {type: "number", min: 0, max: Global.MAX_SHIP_LEVEL}),
				this.e_level_null= NODE(ELEMENT("span.button"), [TEXT("設定なし")]),
				this.e_level_1   = NODE(ELEMENT("span.button"), [TEXT("Lv1")]),
				this.e_level_99  = NODE(ELEMENT("span.button"), [TEXT("Lv99")]),
				this.e_level_max = NODE(ELEMENT("span.button"), [TEXT("Lv" + Global.MAX_SHIP_LEVEL)]),
			]),
			NODE(ELEMENT("div"), [
				NODE(ELEMENT("span.tag"), [TEXT("運")]),
				this.e_luck = ELEMENT("input", {type: "number", min: 0, max: 255}),
				this.e_luck_null= NODE(ELEMENT("span.button"), [TEXT("設定なし")]),
				this.e_luck_min = NODE(ELEMENT("span.button"), [TEXT("初期")]),
				this.e_luck_max = NODE(ELEMENT("span.button"), [TEXT("最大")]),
			]),
			NODE(ELEMENT("div.text"), [
				NODE(ELEMENT("span", {title: "2 * sqrt(Lv) + 1.5 * sqrt(運)"}), [
					TEXT("基礎命中 "),
					this.e_basic_accuracy = ELEMENT("span"),
				]),
				ELEMENT("br"),
				TEXT("設定なしの場合 Lvは99 運は初期値"),
			]),
			NODE(ELEMENT("div.button_div"), [
				this.e_ok     = NODE(ELEMENT("button.ok"), [TEXT("変更")]),
				this.e_cancel = NODE(ELEMENT("button.cancel"), [TEXT("キャンセル")]),
			]),
		]);

		this.e_level.addEventListener("input", e => this.ev_input(e));
		this.e_level_null.addEventListener("click", e => this.ev_click_lvbtn(""));
		this.e_level_1.addEventListener("click", e => this.ev_click_lvbtn("1"));
		this.e_level_99.addEventListener("click", e => this.ev_click_lvbtn("99"));
		this.e_level_max.addEventListener("click", e => this.ev_click_lvbtn(String(Global.MAX_SHIP_LEVEL)));
		this.e_luck.addEventListener("input", e => this.ev_input(e));
		this.e_luck_null.addEventListener("click", e => this.ev_click_luckbtn(""));
		this.e_luck_min.addEventListener("click", e => this.ev_click_luckbtn("min"));
		this.e_luck_max.addEventListener("click", e => this.ev_click_luckbtn("max"));
		this.add_dialog_button(this.e_ok, "ok");
		this.add_dialog_button(this.e_cancel, "cancel");
		this.addEventListener("show", e => this.ev_show(e));
	}
	/**
	 * ダイアログの表示を更新
	 */
	refresh_info(){
		let level = Util.formstr_to_int(this.e_level.value, -1, NaN).value;
		let luck = Util.formstr_to_int(this.e_luck.value, -1, NaN).value;
		if (level < 0) level = 99;
		if (luck < 0 && this.luck_info) luck = this.luck_info.min_luck;

		let text = "-";
		let hint_text = "";
		if (level >= 0 && luck >= 0) {
			let acc = 2 * Math.sqrt(level) + 1.5 * Math.sqrt(luck);
			text = Util.float_to_string(acc, 3, -1);
			hint_text = "2 * sqrt(Lv) + 1.5 * sqrt(運)\n= " + String(acc);
		}
		this.e_basic_accuracy.textContent = text;
		this.e_basic_accuracy.title = hint_text;

		let outofrange_level = !(1 <= level && level <= Global.MAX_SHIP_LEVEL);
		let outofrange_luck = ( this.luck_info
			&& !(this.luck_info.min_luck <= luck && luck <= this.luck_info.max_luck) );
		this.e_level.classList.toggle("error", outofrange_level);
		this.e_luck.classList.toggle("error", outofrange_luck);

		this.e_luck_min.textContent = "初期" + (this.luck_info?.min_luck || "");
		this.e_luck_max.textContent = "最大" + (this.luck_info?.max_luck || "");
	}
	/**
	 * 入力されたレベル　エラーや空文字は-1
	 * @return {number}
	 */
	get level(){
		return Util.formstr_to_int(this.e_level?.value, -1, -1).value;
	}
	/**
	 * 入力された運　エラーや空文字は-1
	 * @return {number}
	 */
	get luck(){
		return Util.formstr_to_int(this.e_luck?.value, -1, -1).value;
	}

	/**
	 * showイベント
	 * sshipからデータを取ってきてセット
	 * @param {Event} _e 
	 * @private
	 */
	ev_show(_e){
		this.level_info = this.sship.get_level_info();
		this.luck_info = this.sship.get_luck_info();

		let rawlv = this.level_info.raw_level;
		this.e_level.value = rawlv >= 0 ? rawlv : "";
		this.e_level.placeholder = "99";

		// 範囲外も入力可
		// this.e_luck.min = this.luck_info.min_luck > 0 ? this.luck_info.min_luck : 0;
		// this.e_luck.max = this.luck_info.max_luck > 0 ? this.luck_info.max_luck : 255;
		let rawluc =this.luck_info.raw_luck;
		this.e_luck.value = rawluc >= 0 ? rawluc : "";
		this.e_luck.placeholder = this.luck_info.min_luck > 0 ? this.luck_info.min_luck : "";

		this.refresh_info();
	}
	/**
	 * フォーム変更時のイベント
	 * @param {Event} _e
	 * @private
	 */
	ev_input(_e){
		this.refresh_info();
	}
	/**
	 * レベルの入力ボタンをクリック
	 * @param {string} level_str
	 * @private
	 */
	ev_click_lvbtn(level_str){
		this.e_level.value = level_str;
		this.refresh_info();
	}
	/**
	 * 運の入力ボタンをクリック
	 * @param {string} luck_str 設定する文字列だが"min"で初期値、"max"で最大値
	 * @private
	 */
	ev_click_luckbtn(luck_str){
		let luck = luck_str;
		if (luck_str == "min") {
			if (!this.luck_info) return;
			luck = this.luck_info.min_luck;
		} else if (luck_str == "max") {
			if (!this.luck_info) return;
			luck = this.luck_info.max_luck;
		}
		this.e_luck.value = luck;
		this.refresh_info();
	}
};
