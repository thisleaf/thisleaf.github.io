// 艦の入力フォームとデータオブジェクト

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT} from "./utility.mjs";
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
	// form ほか
	e_lvluck          : null, // div
	e_lv              : null, // div
	e_lv_number       : null,
	e_luck            : null, // div
	e_luck_number     : null,
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
	
	// 装備可能情報 (EquipableInfo)
	equipable_info : null,
	// 装備ボーナス情報 (EquipmentBonus)
	equipment_bonus: null,
	
	// 左に表示する番号
	number: 0,
	// このオブジェクトを区別するID
	object_id: "",
	// 艦名(改造度合いを含む)
	name  : "",
	// レベル, 運
	level : -1,
	luck  : -1,

	// 弾薬消費割合
	ammocost_rate: 0.8,
	// callback
	onchange: null,
	
	// method
	set_name           : SupportShip_set_name           ,
	create             : SupportShip_create             ,
	create_tbody       : SupportShip_create_tbody       ,
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
	
	refresh_shipinfo    : SupportShip_refresh_shipinfo    ,
	refresh_lvluck      : SupportShip_refresh_lvluck      ,
	refresh_displaypower: SupportShip_refresh_displaypower,
	refresh_equipstatus : SupportShip_refresh_equipstatus ,
	
	// SupportShipData との変換
	get_data: SupportShip_get_data,
	set_data: SupportShip_set_data,
	
	// json
	get_json: SupportShip_get_json,
	set_json: SupportShip_set_json,
	
	// callback
	call_onchange : SupportShip_call_onchange,
	
	// event
	ev_change_ship     : SupportShip_ev_change_ship     ,
	ev_click_lvluck    : SupportShip_ev_click_lvluck    ,
	ev_click_exavail   : SupportShip_ev_click_exavail   ,
	ev_change_priority : SupportShip_ev_change_priority ,
	ev_change_target   : SupportShip_ev_change_target   ,
	ev_change_equipment: SupportShip_ev_change_equipment,
});


Object.assign(SupportShip, {
	default_level: 99,
	// 砲撃支援時、空母系とみなす shipType のリスト
	// ちなみに速吸は空母系ではない
	cv_shelling_types: [
		"軽空母", "正規空母", "装甲空母", "夜間作戦航空母艦", "近代化航空母艦"
	],
	dd_types: [
		"駆逐艦", "陽字号駆逐艦"
	],
	selector_dialog: null,
	
	get_border_power: SupportShip_static_get_border_power,
});


// SupportShip -------------------------------------------------------------------------------------
/**
 * 支援艦隊の一隻
 * @param {number} number 
 * @param {string} object_id 
 * @constructor
 * @todo write jsdoc
 */
function SupportShip(number, object_id){
	if (!object_id) debugger;
	
	this.number = number;
	this.object_id = object_id;
}

function SupportShip_set_name(name){
	this.name = name;
	this.equipment_bonus = new EquipmentBonus(name, true);
	
	// create() が呼んである場合
	if (this.ship_selector) {
		this.ship_selector.set_shipname(this.name);
		this.refresh_shipinfo();
	}
}

// DOMの生成
// ドラッグ＆ドロップ処理は他艦とも関係あるので SupportFleet に
function SupportShip_create(def_priority){
	// イベント関数など
	let _change_target    = e => this.ev_change_target(e);
	let _change_equipment = e => this.ev_change_equipment(e);
	
	let _renamer = eq => {
		let str = "[";
		if (this.is_cv_shelling()) {
			str += Util.float_to_string((eq.firepower + eq.torpedo + eq.bombing * 1.3) * 1.5, 2, 0);
		} else {
			str += eq.firepower;
		}
		if (this.equipment_bonus && this.equipment_bonus.bonus_exists(eq.number)) {
			str += "+";
		}
		str += "/" + eq.accuracy + "] " + Util.unescape_charref(eq.name);
		return str;
	};
	
	// 選択ダイアログ
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
	this.e_lvluck = NODE(ELEMENT("div.lvluck"), [
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
	
	// 火力目標
	this.e_engagement = NODE(ELEMENT("select"),
		Global.ENGAGEMENT_FORM_DEFINITION.map(d => {
			let op = new Option(d.name, d.support);
			if (d.className) op.className = d.className;
			return op;
		})
	);
	this.e_engagement.selectedIndex = 1; // 反航戦
	this.e_engagement.addEventListener("change", _change_target);
	
	this.e_formation = NODE(ELEMENT("select"),
		Global.FORMATION_DEFINITION.map(d => {
			let op = new Option(d.name, d.support);
			if (d.className) op.className = d.className;
			return op;
		})
	);
	this.e_formation.selectedIndex = 0; // 単縦陣
	this.e_formation.addEventListener("change", _change_target);
	
	this.e_targetpower = ELEMENT("input", {type: "number", className: "targetpower"});
	this.e_targetpower.min = 0;
	this.e_targetpower.max = 200;
	this.e_targetpower.value = Global.SUPPORT_POWER_CAP + 1;
	this.e_targetpower.addEventListener("change", _change_target);
	
	this.e_displaypower = ELEMENT("span", "", "displaypower");
	this.refresh_displaypower();
	
	// 装備欄
	this.equipable_info = new EquipableInfo("", true);
	this.e_slot_fixes = new Array;
	this.equipment_selects = new Array;
	
	for (let i=0; i<5; i++) {
		this.e_slot_fixes[i] = ELEMENT("input", {type: "checkbox"});
		this.e_slot_fixes[i].addEventListener("change", _change_equipment);
		this.equipment_selects[i] = new EquipmentSelect;
		this.equipment_selects[i].renamer = _renamer;
		this.equipment_selects[i].onchange = _change_equipment;
	}
	this.e_exslot_fix = ELEMENT("input", {type: "checkbox"});
	this.e_exslot_fix.addEventListener("change", _change_equipment);
	this.ex_equipment_select = new EquipmentSelect;
	this.ex_equipment_select.renamer = _renamer;
	this.ex_equipment_select.onchange = _change_equipment;
	
	// テーブル要素の生成
	this.create_tbody();
	
	if (this.name) {
		this.ship_selector.set_shipname(this.name);
	}
	this.refresh_shipinfo();
}

// DOM生成のうち、table部分
function SupportShip_create_tbody(){
	let tbody = document.createElement("tbody");
	
	this.e_number_cell = ELEMENT("td", {textContent: this.number, rowSpan: 8, className: "number"});
	
	let selector_cell = NODE(ELEMENT("td", {colSpan: 2, rowSpan: 2, className: "shipcell"}), [
		NODE(ELEMENT("div"), [
			this.ship_selector.e_shipname_div,
			NODE(ELEMENT("div", "", "lvluckex"), [
				this.e_lvluck,
				NODE(ELEMENT("div", "", "ex"), [
					NODE(document.createElement("label"), [
						this.e_exslot_available,
						TEXT("増設"),
					]),
				])
			]),
		]),
	]);
	
	let target_cell = NODE(ELEMENT("td", {colSpan: 1, rowSpan: 2, className: "targetcell"}), [
		this.e_formation,
		this.e_engagement,
		TEXT(" キャップ後"),
		this.e_targetpower,
		ELEMENT("br"),
		this.e_displaypower,
	]);
	
	this.e_dragdrop_cells = new Array;
	this.e_slot_firepower_cells = new Array;
	this.e_slot_accuracy_cells = new Array;
	for (let i=0; i<5; i++) {
		this.e_dragdrop_cells[i] = ELEMENT("td", {className: "eq_dragdrop n_all", textContent: "E" + (i + 1)});
		this.e_slot_firepower_cells[i] = Util.create_cell("td", "", 1, 1, "eq_firepower n_all");
		this.e_slot_accuracy_cells[i] = Util.create_cell("td", "", 1, 1, "eq_accuracy n_tb n_l");
	}
	this.e_dragdrop_cells[5]     = ELEMENT("td", {className: "eq_dragdrop n_all", textContent: "EX"});
	this.e_exslot_firepower_cell = Util.create_cell("td", "", 1, 1, "eq_firepower n_all");
	this.e_exslot_accuracy_cell  = Util.create_cell("td", "", 1, 1, "eq_accuracy n_tb n_l");
	this.e_total_firepower_cell  = Util.create_cell("td", "", 1, 1, "eq_firepower total n_t n_rl");
	this.e_total_accuracy_cell   = Util.create_cell("td", "", 1, 1, "eq_accuracy total n_t n_l");
	
	this.e_tbody = NODE(tbody, [
		Util.create_row([
			this.e_number_cell,
			selector_cell,
			ELEMENT("td", "", "eq_dragdrop_cell n_all"),
			ELEMENT("td", "", "eq_fix_cell n_all"),
			this.e_rawfirepower_eq_cell = NODE(ELEMENT("td", "", "equipmentcell raw n_rl n_b"), [TEXT("素火力")]),
			this.e_rawfirepower_cell = ELEMENT("td", "", "eq_firepower n_all"),
			this.e_rawaccuracy_cell = ELEMENT("td", {textContent: "", className: "eq_accuracy n_b n_l"}),
		]),
		Util.create_row([
			this.e_dragdrop_cells[0],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[0]]),
			NODE(ELEMENT("td", "", "n_all"), [
				this.equipment_selects[0].e_select,
				this.equipment_selects[0].e_star,
			]),
			this.e_slot_firepower_cells[0],
			this.e_slot_accuracy_cells[0],
		]),
		Util.create_row([
			NODE(ELEMENT("th", "", "priority"), [TEXT("優先度")]),
			NODE(ELEMENT("td"), [this.e_priority]),
			this.e_dragdrop_cells[1],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[1]]),
			NODE(ELEMENT("td", "", "n_all"), [
				this.equipment_selects[1].e_select,
				this.equipment_selects[1].e_star,
			]),
			this.e_slot_firepower_cells[1],
			this.e_slot_accuracy_cells[1],
		]),
		Util.create_row([
			Util.create_cell("th", "火力目標", 1, 2),
			target_cell,
			this.e_dragdrop_cells[2],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[2]]),
			NODE(ELEMENT("td", "", "n_all"), [
				this.equipment_selects[2].e_select,
				this.equipment_selects[2].e_star,
			]),
			this.e_slot_firepower_cells[2],
			this.e_slot_accuracy_cells[2],
		]),
		Util.create_row([
			this.e_dragdrop_cells[3],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[3]]),
			NODE(ELEMENT("td", "", "n_all"), [
				this.equipment_selects[3].e_select,
				this.equipment_selects[3].e_star,
			]),
			this.e_slot_firepower_cells[3],
			this.e_slot_accuracy_cells[3],
		]),
		this.e_5th_equipment_row = Util.create_row([
			Util.create_cell("td", "", 2, 1, "n_b"),
			this.e_dragdrop_cells[4],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[4]]),
			NODE(ELEMENT("td", "", "n_all"), [
				this.equipment_selects[4].e_select,
				this.equipment_selects[4].e_star,
			]),
			this.e_slot_firepower_cells[4],
			this.e_slot_accuracy_cells[4],
		]),
		this.e_exslot_equipment_row = Util.create_row([
			Util.create_cell("td", "", 2, 1, "n_tb"),
			this.e_dragdrop_cells[5],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_exslot_fix]),
			NODE(ELEMENT("td", "", "n_all"), [
				this.ex_equipment_select.e_select,
				this.ex_equipment_select.e_star,
			]),
			this.e_exslot_firepower_cell,
			this.e_exslot_accuracy_cell,
		]),
		Util.create_row([
			NODE(ELEMENT("th"), [TEXT("消費")]),
			this.e_cost_cell = ELEMENT("td", "", "cost"),
			ELEMENT("td", "", "n_t n_r"),
			ELEMENT("td", "", "n_t n_rl"),
			ELEMENT("td", {textContent: "合計", className: "equipmentcell total n_t n_rl"}),
			this.e_total_firepower_cell,
			this.e_total_accuracy_cell,
		]),
	]);
}


// 装備表示数の変更
// 非表示中のフォームは .hidden
// tr は .hidden_row
function SupportShip_set_equipment_count(count, show_exslot){
	for (let i=0; i<this.equipment_selects.length; i++) {
		if (i < count) {
			this.e_slot_fixes[i].classList.remove("hidden");
			this.equipment_selects[i].e_select.classList.remove("hidden");
			this.equipment_selects[i].e_star  .classList.remove("hidden");
		} else {
			this.e_slot_fixes[i].classList.add("hidden");
			this.equipment_selects[i].e_select.classList.add("hidden");
			this.equipment_selects[i].e_star  .classList.add("hidden");
		}
	}
	
	if (show_exslot) {
		this.e_exslot_fix.classList.remove("hidden");
		this.ex_equipment_select.e_select.classList.remove("hidden");
		this.ex_equipment_select.e_star  .classList.remove("hidden");
	} else {
		this.e_exslot_fix.classList.add("hidden");
		this.ex_equipment_select.e_select.classList.add("hidden");
		this.ex_equipment_select.e_star  .classList.add("hidden");
	}
	
	for (let i=0; i<this.e_dragdrop_cells.length; i++) {
		let text = "";
		if (i < count && i < 5) text = "E" + (i + 1);
		else if (show_exslot && i == 5) text = "EX";
		this.e_dragdrop_cells[i].textContent = text;
		this.e_dragdrop_cells[i].classList.toggle("eq_dragdrop", text != "");
	}
	
	let rowspan = 1 + 4 + 1;
	
	if (count >= 5) {
		this.e_5th_equipment_row.classList.remove("hidden_row");
		rowspan++;
	} else {
		this.e_5th_equipment_row.classList.add("hidden_row");
	}
	if (show_exslot) {
		this.e_exslot_equipment_row.classList.remove("hidden_row");
		rowspan++;
	} else {
		this.e_exslot_equipment_row.classList.add("hidden_row");
	}
	
	this.e_number_cell.rowSpan = rowspan;
}

// 艦が選択されているかどうか
function SupportShip_empty(){
	return this.ship_selector.empty();
}

// 空母系計算式かどうか
function SupportShip_is_cv_shelling(){
	return ( this.equipable_info &&
		this.equipable_info.ship &&
		SupportShip.cv_shelling_types.indexOf(this.equipable_info.ship.shipType) >= 0 );
}

/**
 * 駆逐艦かどうか
 * @return {boolean} 駆逐ならtrue
 * @method SupportShip.prototype.is_dd
 */
function SupportShip_is_dd(){
	return ( this.equipable_info &&
		this.equipable_info.ship &&
		SupportShip.dd_types.indexOf(this.equipable_info.ship.shipType) >= 0);
}

function SupportShip_set_target(en_index, fm_index, targetpower){
	this.e_engagement.selectedIndex = en_index;
	this.e_formation.selectedIndex = fm_index;
	if (targetpower >= 0) {
		this.e_targetpower.value = targetpower;
	}
	
	this.refresh_displaypower();
	this.refresh_equipstatus();
}

function SupportShip_set_ammocost_rate(new_rate){
	if (this.ammocost_rate != new_rate) {
		this.ammocost_rate = new_rate;
		this.refresh_equipstatus();
	}
}

function SupportShip_get_fuelcost(){
	let ship = this.ship_selector.get_ship();
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
	let ship = this.ship_selector.get_ship();
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
	this.set_name("");
	this.set_target(1, 0, 151);
	if (priority) {
		this.e_priority.value = priority;
	}
}

// データの入れ替え
// number とかは入れ替えない
function SupportShip_swap_data(ship){
	// 装備データについては SupportShipData を使うことにする
	let this_ssd = new SupportShipData;
	let ship_ssd = new SupportShipData;
	if (!this.get_data(this_ssd) || !ship.get_data(ship_ssd)) return;
	
	let _swap_property = (a, b, prop) => {
		let temp = a[prop];
		a[prop] = b[prop];
		b[prop] = temp;
	};
	
	// 入れ替え
	//_swap_property(this                   , ship                   , "ammocost_rate");
	_swap_property(this.e_exslot_available, ship.e_exslot_available, "checked"      );
	_swap_property(this.e_priority        , ship.e_priority        , "value"        );
	_swap_property(this.e_engagement      , ship.e_engagement      , "selectedIndex");
	_swap_property(this.e_formation       , ship.e_formation       , "selectedIndex");
	_swap_property(this.e_targetpower     , ship.e_targetpower     , "value"        );
	
	// set_name() で表示の更新・フォームも作り直される
	let this_name = this.name;
	this.set_name(ship.name);
	ship.set_name(this_name);
	
	// 装備をセット
	// (装備の)表示の更新も行われるはず
	this.set_data(ship_ssd);
	ship.set_data(this_ssd);
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
	if (level < 0) level = SupportShip.default_level;
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
	let ship = this.ship_selector.get_ship();
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
 * @method get_raw_accurac
 * @memberof SupportShip.prototype
 */
function SupportShip_get_raw_accuracy(){
	let level = this.get_level_info().level;
	let luck = this.get_luck_info().luck;
	return 2 * Math.sqrt(level) + 1.5 * Math.sqrt(luck);
}

// 艦情報を更新 (フォームから)
function SupportShip_refresh_shipinfo(suppress_refresh = false){
	let name = this.ship_selector.get_shipname();
	
	this.name = name;
	this.equipable_info.set_name(name);
	this.equipable_info.generate_equipables();
	
	let slot_count = this.equipable_info.get_slot_count();
	let exavail = name && this.e_exslot_available.checked;
	this.set_equipment_count(slot_count, exavail);
	
	for (let i=0; i<5; i++) {
		this.equipment_selects[i].recreate_options(this.equipable_info.slot_equipables[i], null, true);
	}
	this.ex_equipment_select.recreate_options(this.equipable_info.exslot_equipable, null, true);
	
	if (!suppress_refresh) {
		this.refresh_lvluck();
		this.refresh_displaypower();
		this.refresh_equipstatus();
	}
}

/**
 * レベル・運の欄(div)を更新
 * 変更された場合は refresh_equipstatus() の方も呼ぶ必要がある
 * ヘッダーのほうも変更の必要があるかも
 * @method refresh_lvluck
 * @memberof SupportShip.prototype
 */
function SupportShip_refresh_lvluck(){
	if (this.empty()) {
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

// 目標火力欄：表示火力の更新
// selectのクラスも設定
function SupportShip_refresh_displaypower(){
	let en = Util.formstr_to_float(this.e_engagement.value, 1, 1);
	let fm = Util.formstr_to_float(this.e_formation.value, 1, 1);
	let tp = Util.formstr_to_float(this.e_targetpower.value, 0, 0);
	
	let bp = SupportShip.get_border_power(en.value, fm.value, tp.value);
	let dp = bp - (5 + Global.SUPPORT_MODIFY);
	
	Util.remove_children(this.e_displaypower);
	
	if (bp > 0) {
		NODE(this.e_displaypower, [
			TEXT("基本攻撃力"),
			ELEMENT("span", {className: "power basic", textContent: bp}),
		]);
		if (!this.is_cv_shelling() && dp > 0) {
			NODE(this.e_displaypower, [
				TEXT(" (表示火力"),
				ELEMENT("span", {className: "power display", textContent: dp}),
				TEXT(")"),
			]);
		}
	} else {
		NODE(this.e_displaypower, [TEXT("条件なし")]);
	}
	
	Util.inherit_option_class(this.e_engagement);
	Util.inherit_option_class(this.e_formation);
}

// 装備火力等を更新
function SupportShip_refresh_equipstatus(){
	let ssd = new SupportShipData;
	let slot_count = this.equipable_info.get_slot_count();
	let ilim = this.equipment_selects.length + 1;
	
	let exists = this.get_data(ssd);
	
	if (exists) {
		this.e_rawfirepower_eq_cell.textContent = "素火力 (" + ssd.raw_firepower + ")";
		if (ssd.cv_shelling) {
			this.e_rawfirepower_cell.textContent = Util.float_to_string((ssd.raw_firepower + Global.SUPPORT_MODIFY) * 1.5 + 55, 2, 0);
		} else {
			this.e_rawfirepower_cell.textContent = ssd.raw_firepower + 5 + Global.SUPPORT_MODIFY;
		}
		// TODO: 基礎命中の表示
		// 混乱防止のため、探索に適用されるまで非表示
		// let raw_acc = this.get_raw_accuracy();
		// this.e_rawaccuracy_cell.textContent = Util.float_to_string(raw_acc, 0, -1);
		// this.e_rawaccuracy_cell.title = "2 * sqrt(Lv) + 1.5 * sqrt(運)\n= " + String(raw_acc);
		this.e_rawaccuracy_cell.textContent = "";

		ssd.calc_bonus();
		
	} else {
		this.e_rawfirepower_eq_cell.textContent = "素火力";
		this.e_rawfirepower_cell.textContent = "";
		this.e_rawaccuracy_cell.textContent = "";
		this.e_rawaccuracy_cell.title = "";
	}
	
	// 反映
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
	
	// TODO: 表示される命中合計に基礎命中を適用
	// 合計
	let tfp_text = "", tfp_hint = "", tac_text = "";
	let fpw_good = false, fpw_bad = false;
	let acc_good = false, acc_bad = false;
	if (exists) {
		let basic = ssd.get_basic_power();
		let final = ssd.get_final_power();
		let acc = ssd.get_accuracy();
		
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
		} else {
			tfp_hint += "攻撃不可";
		}
		tac_text = acc;
		
		fpw_good = basic > 0 && basic >= ssd.border_basic_power;
		fpw_bad = basic <= 0 || basic < ssd.border_basic_power;
		acc_good = acc > 0;
		acc_bad = acc < 0;
	}
	this.e_total_firepower_cell.textContent = tfp_text;
	this.e_total_firepower_cell.title = tfp_hint;
	this.e_total_accuracy_cell.textContent = tac_text;
	
	this.e_total_firepower_cell.classList.toggle("good", fpw_good);
	this.e_total_firepower_cell.classList.toggle("bad", fpw_bad);
	this.e_total_accuracy_cell.classList.toggle("good", acc_good);
	this.e_total_accuracy_cell.classList.toggle("bad", acc_bad);
	
	// 消費(砲撃支援)
	let cost_html = "";
	if (exists) {
		let fuel_cost = this.get_fuelcost();
		let ammo_cost = this.get_ammocost();
		cost_html = '燃料<span class="fuel">' + fuel_cost + '</span> + 弾薬<span class="ammo">' +
			ammo_cost + '</span> = <span class="fuelammo">' + (fuel_cost + ammo_cost) + '</span>';
	}
	this.e_cost_cell.innerHTML = cost_html;
}


function SupportShip_get_data(data){
	//data.support_ship = this;
	data.ship_object_id = this.object_id;
	data.ship_name = this.name;
	
	if (this.empty()) {
		return false;
	}
	
	let ship = this.equipable_info.ship;
	
	let pr = Util.formstr_to_int(this.e_priority.value, 12, 12);
	let en = Util.formstr_to_float(this.e_engagement.value, 1, 1);
	let fm = Util.formstr_to_float(this.e_formation.value, 1, 1);
	let tp = Util.formstr_to_float(this.e_targetpower.value, 0, 0);
	
	let bp = SupportShip.get_border_power(en.value, fm.value, tp.value);
	
	data.priority = pr.value;
	//data.power_modifier = en * fm;
	data.engagementform_modify = en.value;
	data.formation_modify = fm.value;
	data.level = this.get_level_info().level;
	data.luck = this.get_luck_info().luck;
	data.border_final_power = tp.value;
	data.border_basic_power = bp >= 1 ? bp : 1; // 最低1とする(0が攻撃不可を表す)
	data.raw_firepower = +this.equipable_info.ship.firepowerMax;
	data.raw_accuracy = this.get_raw_accuracy();
	data.cv_shelling = this.is_cv_shelling();
	
	data.slot_count       = this.equipable_info.get_slot_count();
	data.exslot_available = this.e_exslot_available.checked;
	
	let slots = new Array;
	let equipables = new Array;
	let fixes = new Array;
	
	for (let i=0; i<data.slot_count; i++) {
		let sel = this.equipment_selects[i];
		slots[i] = new EquipmentSlot(+sel.get_id(), null, sel.get_star());
		equipables[i] = this.equipable_info.slot_equipables[i];
		fixes[i] = this.e_slot_fixes[i].checked;
	}
	
	if (data.exslot_available) {
		let sel = this.ex_equipment_select;
		slots.push(new EquipmentSlot(+sel.get_id(), null, sel.get_star()));
		equipables.push(this.equipable_info.exslot_equipable);
		fixes.push(this.e_exslot_fix.checked);
	}
	
	data.allslot_equipment  = slots;
	data.allslot_equipables = equipables;
	data.allslot_fixes = fixes;
	
	data.equipment_bonus = this.equipment_bonus;
	
	return true;
}

// データのセットだが、これは装備のデータについてのみ
function SupportShip_set_data(data){
	for (let i=0; i<this.equipment_selects.length; i++) {
		let val = "", fix = false;
		let star = 0;
		
		// 通常スロット有効部
		if (i < data.slot_count) {
			val = data.allslot_equipment[i].equipment_id || "";
			fix = data.allslot_fixes[i];
			star = data.allslot_equipment[i].improvement;
		}
		
		this.equipment_selects[i].set_id_star(val, star);
		this.e_slot_fixes[i].checked = fix;
	}
	
	this.e_exslot_available.checked = data.exslot_available;
	
	let ex_val = "", ex_fix = false;
	let ex_star = 0;
	
	if (data.exslot_available) {
		let r = data.allslot_equipment.length - 1;
		ex_val = data.allslot_equipment[r].equipment_id || "";
		ex_fix = data.allslot_fixes[r];
		ex_star = data.allslot_equipment[r].improvement;
	}
	
	this.ex_equipment_select.set_id_star(ex_val, ex_star);
	this.e_exslot_fix.checked = ex_fix;
	
	this.refresh_equipstatus();
}

function SupportShip_get_json(){
	// 要素の追加や削除を考慮して表示名で保存しておくことにする
	function _text(select){
		return select.selectedIndex >= 0 ? select.options[select.selectedIndex].textContent : "";
	}
	
	return {
		name             : this.name,
		level            : this.level,
		luck             : this.luck,
		exslot_available : this.e_exslot_available.checked,
		priority         : this.e_priority.value,
		engagement       : _text(this.e_engagement),
		formation        : _text(this.e_formation),
		targetpower      : this.e_targetpower.value,
		slot_fixes       : this.e_slot_fixes.map(e => e.checked),
		exslot_fix       : this.e_exslot_fix.checked,
		equipment_ids    : this.equipment_selects.map(sel => sel.get_id()),
		equipment_stars  : this.equipment_selects.map(sel => sel.get_star()),
		ex_equipment_id  : this.ex_equipment_select.get_id(),
		ex_equipment_star: this.ex_equipment_select.get_star(),
	};
}

function SupportShip_set_json(json){
	this.clear();
	if (!json) return;
	
	function _set_by_text(select, text){
		for (let i=0; i<select.options.length; i++) {
			if (select.options[i].textContent == text) {
				select.selectedIndex = i;
				return;
			}
		}
	}
	function _foreach2(arr1, arr2, func){
		if (!arr1 || !arr2) return;
		for (let i=0; i<arr1.length; i++) {
			func(arr1[i], arr2[i]);
		}
	}
	
	this.set_name(json.name || "");
	this.level = json.level >= 0 ? json.level : -1;
	this.luck = json.luck >= 0 ? json.luck : -1;
	this.e_exslot_available.checked = json.exslot_available;
	this.e_priority.value = json.priority;
	_set_by_text(this.e_engagement, json.engagement);
	_set_by_text(this.e_formation, json.formation);
	this.e_targetpower.value = json.targetpower;
	_foreach2(this.e_slot_fixes, json.slot_fixes, (e, b) => e.checked = b);
	this.e_exslot_fix.checked = json.exslot_fix;
	_foreach2(this.equipment_selects, json.equipment_ids, (sel, id) => sel.set_id(id));
	_foreach2(this.equipment_selects, json.equipment_stars, (sel, star) => sel.set_star(star));
	this.ex_equipment_select.set_id(json.ex_equipment_id);
	this.ex_equipment_select.set_star(json.ex_equipment_star || 0);
	
	this.refresh_shipinfo();
}

function SupportShip_call_onchange(){
	if (this.onchange) this.onchange.call(null);
}


function SupportShip_ev_change_ship(name){
	this.set_name(name);
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
			this.refresh_lvluck();
			this.refresh_equipstatus();
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

function SupportShip_ev_click_exavail(){
	this.refresh_shipinfo();
	this.call_onchange();
}

function SupportShip_ev_change_priority(){
	this.call_onchange();
}

function SupportShip_ev_change_target(){
	this.refresh_displaypower();
	this.refresh_equipstatus();
	this.call_onchange();
}

function SupportShip_ev_change_equipment(){
	this.refresh_equipstatus();
	this.call_onchange();
}


// sqrtcap(bp * en * fm) >= tp なる最小の整数 bp を返す
// dp = bp - (5 + Global.SUPPORT_MODIFY) が表示火力になる
function SupportShip_static_get_border_power(engagement_form, formation, target_power){
	// 最初の bp はだいたいあっているが、計算誤差の都合で確定ではない
	// とはいえ、修正しても実際の艦これと合っているかは微妙ではあるが
	let bpmin = Damage.inv_sqrtcap(target_power, Global.SUPPORT_POWER_CAP) / formation / engagement_form;
	let bp = Math.ceil(bpmin);
	
	let f = bp => Damage.sqrtcap(bp * engagement_form * formation, Global.SUPPORT_POWER_CAP);
	
	if (f(bp) < target_power) bp++;
	else if (f(bp - 1) >= target_power) bp--;
	
	return bp;
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
				this.e_level = ELEMENT("input", {type: "number", min: 0, max: 175}),
				this.e_level_null= NODE(ELEMENT("span.button"), [TEXT("設定なし")]),
				this.e_level_1   = NODE(ELEMENT("span.button"), [TEXT("Lv1")]),
				this.e_level_99  = NODE(ELEMENT("span.button"), [TEXT("Lv99")]),
				this.e_level_max = NODE(ELEMENT("span.button"), [TEXT("Lv" + 175)]),
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
		this.e_level_max.addEventListener("click", e => this.ev_click_lvbtn("175"));
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

		let outofrange_level = !(1 <= level && level <= 175);
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

// SupportShipData ---------------------------------------------------------------------------------
// SupportShip のデータを計算用に
Object.assign(SupportShipData.prototype, {
	//support_ship: null,
	ship_object_id: "",
	ship_name     : "",
	
	// 優先度
	priority: 0,
	// 交戦形態等の修正
//	power_modifier: 1, // 乗算の順番が変わるが気にしないことにする
	// やっぱり気になったので
	engagementform_modify: 1,
	formation_modify     : 1,
	
	// レベル・運
	// 負数で初期値を表す
	level: -1,
	luck : -1,

	// 目標攻撃力
//	border_display_power: 150, // 表示火力だが、空母系が…
	border_basic_power: 150, // 基本攻撃力
	border_final_power: 150, // 最終攻撃力
	// 素火力
	raw_firepower: 0,
	// 基礎命中
	raw_accuracy : 0,
	// 空母系(計算式)かどうか
	cv_shelling  : false,
	// 空母系で艦載機がなくても攻撃可能として攻撃力を計算するか
	cv_force_attackable: false,
	
	// スロット数(増設除く)
	slot_count      : 0,
	// 増設が利用可能か
	exslot_available: false,
	
	// スロットの有効部のみを抽出
	// 増設が有効の場合は、ラストが増設であるものとする
	allslot_equipment : null, // array of EquipmentSlot
	allslot_equipables: null, // array of map: id -> bool
	allslot_fixes     : null, // array of bool
	
	equipment_bonus   : null, // EquipmentBonus
	
	clone              : SupportShipData_clone            ,
	clear_bonus        : SupportShipData_clear_bonus      ,
	calc_bonus         : SupportShipData_calc_bonus       ,
	get_display_power  : SupportShipData_get_display_power,
	get_basic_power    : SupportShipData_get_basic_power  ,
	get_final_power    : SupportShipData_get_final_power  ,
	get_bonus_firepower: SupportShipData_get_bonus_firepower,
	get_bonus_torpedo  : SupportShipData_get_bonus_torpedo,
	get_accuracy       : SupportShipData_get_accuracy     ,
	get_equipment_priority: SupportShipData_get_equipment_priority,
	sort_equipment     : SupportShipData_sort_equipment   ,
	is_upper_equipment : SupportShipData_is_upper_equipment,
	
	get_json_deckbuilder: SupportShipData_get_json_deckbuilder,
	get_json_MT: SupportShipData_get_json_MT,
	set_json_MT: SupportShipData_set_json_MT,
	
	eqab_compare        : SupportShipData_eqab_compare,
	has_irregular_exslot: SupportShipData_has_irregular_exslot,
	power_compare       : SupportShipData_power_compare,
	accuracy_compare    : SupportShipData_accuracy_compare,
	priority_compare    : SupportShipData_priority_compare,
});

Object.assign(SupportShipData, {
	power_compare       : SupportShipData_static_power_compare,
	accuracy_compare    : SupportShipData_accuracy_compare,
	priority_compare    : SupportShipData_priority_compare,
});

/**
 * @constructor
 */
function SupportShipData(){
}

// 複製
// deeply を指定すると、allslot_equipables と allslot_fixes についても配列の複製を行う
// (通常は読み取りのみのはず)
function SupportShipData_clone(deeply){
	let ssd = Object.assign(new SupportShipData, this);
	
	// 通常は allslot_equipment の内容だけ複製すればよい
	ssd.allslot_equipment = this.allslot_equipment.map(slot => slot.clone());
	
	if (deeply) {
		ssd.allslot_equipables = this.allslot_equipables.concat();
		ssd.allslot_fixes = this.allslot_fixes.concat();
	}
	
	return ssd;
}

function SupportShipData_clear_bonus(){
	for (let i=0; i<this.allslot_equipment.length; i++) {
		this.allslot_equipment[i].clear_bonus();
	}
}

function SupportShipData_calc_bonus(){
	this.equipment_bonus.get_bonus(this.allslot_equipment, false);
}

// 表示火力
// 先にボーナス値を計算しておく
function SupportShipData_get_display_power(){
	let power = this.raw_firepower;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let slot = this.allslot_equipment[i];
		if (slot.equipment_data) {
			power += slot.equipment_data.firepower + slot.bonus_firepower;
		}
	}
	return power;
}

// 基本攻撃力
// これも先にボーナス値を計算しておく
// 攻撃できないときは0、ただしスコア計算モードの場合は-1000される
function SupportShipData_get_basic_power(score_mode = false){
	if (this.cv_shelling) {
		let fire = this.raw_firepower;
		let torp = 0;
		let bomb = 0;
		let attackable = this.cv_force_attackable;
		
		for (let i=0; i<this.allslot_equipment.length; i++) {
			let slot = this.allslot_equipment[i];
			let data = slot.equipment_data;
			
			if (data) {
				fire += data.firepower + slot.bonus_firepower;
				torp += data.torpedo; //  + slot.bonus_torpedo; // ボーナスはないかも？
				bomb += data.bombing;
				
				if (!attackable) {
					// 艦攻・艦爆を一つは装備していないと攻撃できない
					//attackable = data.category == "艦上爆撃機" || data.category == "艦上攻撃機" || data.category == "噴式戦闘爆撃機";
					attackable = data.cv_attackable;
				}
			}
		}
		
		let power;
		if (attackable) {
			power = Math.floor((fire + torp + Math.floor(bomb * 1.3) + Global.SUPPORT_MODIFY) * 1.5) + 55;
		} else if (score_mode) {
			power = Math.floor((fire + torp + Math.floor(bomb * 1.3) + Global.SUPPORT_MODIFY) * 1.5) + 55 - 1000;
		} else {
			power = 0;
		}
		return power;
		
	} else {
		return this.get_display_power() + 5 + Global.SUPPORT_MODIFY;
	}
}

function SupportShipData_get_final_power(){
	let power = this.get_basic_power();
	let precap = power * this.engagementform_modify * this.formation_modify;
	return Math.floor(Damage.sqrtcap(precap, Global.SUPPORT_POWER_CAP));
}

function SupportShipData_get_bonus_firepower(){
	let fpw = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let slot = this.allslot_equipment[i];
		let data = slot.equipment_data;
		if (data) {
			fpw += slot.bonus_firepower;
		}
	}
	return fpw;
}

function SupportShipData_get_bonus_torpedo(){
	let tor = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let slot = this.allslot_equipment[i];
		let data = slot.equipment_data;
		if (data) {
			tor += slot.bonus_torpedo;
		}
	}
	return tor;
}

/**
 * 命中値 = floor(基礎命中 + 装備命中)
 * の予定だが探索の都合で基礎命中の反映はまだ
 * @method get_accuracy
 * @memberof SupportShipData.prototype
 * @todo 基礎命中の反映
 */ 
function SupportShipData_get_accuracy(){
	let acc = 0;
	// let acc = this.raw_accuracy;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let data = this.allslot_equipment[i].equipment_data;
		if (data) {
			acc += data.accuracy;
		}
	}
	return Math.floor(acc);
}

// 装備優先度の合計
function SupportShipData_get_equipment_priority(){
	let p = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let data = this.allslot_equipment[i].equipment_data;
		if (data) {
			p += data.priority;
		}
	}
	return p;
}

// 装備のソート
function SupportShipData_sort_equipment(sort_by, use_category){
	// 装備の比較(a, b: slot)
	let _compare_equip = (a, b) => {
		let eq_a = a.equipment_data;
		let eq_b = b.equipment_data;
		
		// 攻撃力 (降順)
		let c_pow = b.get_power_float(this.cv_shelling, true, true) - a.get_power_float(this.cv_shelling, true, true);
		// 命中 (降順)
		let c_acc = eq_b.accuracy - eq_a.accuracy;
		// id (昇順)
		let c_id = eq_a.number - eq_b.number;
		// 改修値 (降順)
		let c_star = b.improvement - a.improvement;
		// category (定義順)
		// use_category が true の場合にのみ、sort_by より優先して使用
		let c_cat = 0;
		if (use_category) {
			c_cat = _category_index(eq_a.category) - _category_index(eq_b.category);
		}
		
		return (
			sort_by == Global.SORT_BY_POWER    ? (c_cat || c_pow || c_acc || c_id || c_star) :
			sort_by == Global.SORT_BY_ACCURACY ? (c_cat || c_acc || c_pow || c_id || c_star) :
			/* sort_by == Global.SORT_BY_ID */   (c_cat || c_id || c_star || c_pow || c_acc)
		);
	};
	let _category_index = (cat) => {
		let index = Global.SORT_CATEGORY_DEF.indexOf(cat);
		if (index < 0) index = Global.SORT_CATEGORY_DEF.length;
		return index;
	};
	
	// slot の比較(i, j: 位置)
	// 正順-1/同値0/逆順1
	// 交換不可は同値としておく
	let _compare = (i, j) => {
		let a = this.allslot_equipment[i];
		let b = this.allslot_equipment[j];
		let eq_a = a.equipment_data;
		let eq_b = b.equipment_data;
		
		// 固定
		if (this.allslot_fixes[i] || this.allslot_fixes[j]) return 0;
		// 空チェック
		if (eq_a && !eq_b) return -1;
		if (!eq_a && eq_b) return 1;
		if (!eq_a && !eq_b) return 0;
		// 交換可能かどうか
		let eqab_a = this.allslot_equipables[i];
		let eqab_b = this.allslot_equipables[j];
		if (!eqab_a[b.equipment_id] || !eqab_b[a.equipment_id]) return 0;
		
		return _compare_equip(a, b);
	};
	let _check_and_swap = (i, j) => {
		if (_compare(i, j) > 0) {
			let a = this.allslot_equipment[i];
			this.allslot_equipment[i] = this.allslot_equipment[j];
			this.allslot_equipment[j] = a;
			return true;
		}
		return false;
	};
	
	// ボーナスは装備本数によっても変わるため、単体ボーナスのみ考慮してソートすることにする
	for (let i=0; i<this.allslot_equipment.length; i++) {
		this.equipment_bonus.get_independent_bonus(this.allslot_equipment[i]);
	}
	
	LOOP:
	for (;;) {
		// 隣り合うもの
		for (let i=0; i<this.allslot_equipment.length-1; i++) {
			let j = i + 1;
			if (_check_and_swap(i, j)) continue LOOP;
		}
		// 隣り合わないもの
		for (let i=0; i<this.allslot_equipment.length; i++)
		for (let j=i+2; j<this.allslot_equipment.length; j++)
		{
			if (_check_and_swap(i, j)) continue LOOP;
		}
		break;
	}
	
	this.calc_bonus();
}


// この艦に装備する際に、常に upper >= base と考えて良いかを判定する
// upper, base: 装備データオブジェクト(csv)
function SupportShipData_is_upper_equipment(upper, base){
	let upper_fpw = upper.firepower;
	let upper_tor = upper.torpedo;
	let base_fpw = base.firepower;
	let base_tor = base.torpedo;
	
	let bonus = this.equipment_bonus;
	
	// 装備優先度
	if (upper.priority < base.priority) return false;
	
	// シナジーボーナスについて
	if (bonus.assist_exists(base.number)) {
		// 同一種類のものでないならば不明とする
		if (!bonus.same_assist(upper.number, base.number)) return false;
	}
	
	if (bonus.bonus_exists(base.number)) {
		// 自身への装備ボーナスあり
		// どのくらいのボーナスがあるか分からないので、最大値で考えることにする
		let slot = new EquipmentSlot(base.number, base, 10);
		bonus.get_max_bonus(slot);
		base_fpw += slot.bonus_firepower;
		//base_tor += slot.bonus_torpedo;
	}
	// upperは最小値
	if (bonus.bonus_independent(upper.number)) {
		let slot = new EquipmentSlot(upper.number, upper, 0);
		bonus.get_independent_bonus(slot);
		upper_fpw += slot.bonus_firepower;
		//upper_tor += slot.bonus_torpedo;
	}
	
	// ステータス比較
	if ( this.cv_shelling
		?	upper_fpw      >= base_fpw &&
			upper_tor      >= base_tor &&
			upper.bombing  >= base.bombing &&
			upper.accuracy >= base.accuracy
		:	upper_fpw      >= base_fpw &&
			upper.accuracy >= base.accuracy )
	{
		return true;
	}
	
	return false;
}

// デッキビルダー形式
// IDが定義されていない場合は"0"
/* {
	id: '100', lv: 40, luck: -1,
	items:{ // 装備
		// id: ID, rf: 改修, mas: 熟練度
		i1:{id:1, rf: 4, mas:7},
		i2:{id:3, rf: 0},
		...,
		ix:{id:43} // 増設
	}
} */
function SupportShipData_get_json_deckbuilder(){
	let airplane_cates = [
		"艦上偵察機", "艦上攻撃機", "艦上爆撃機", "噴式戦闘爆撃機",
		"水上偵察機", "多用途水上機/水上爆撃機", "水上戦闘機",
	];
	
	let ship = EquipmentDatabase.csv_shiplist.find(d => d.name == this.ship_name);
	let json = {
		id: String(ship?.shipId || "0"),
		lv: this.level >= 0 ? this.level : 99,
		luck: this.luck >= 0 ? this.luck : -1,
		items: {},
	};
	
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let item_key;
		if (this.exslot_available && i == this.allslot_equipment.length - 1) {
			// 増設
			item_key = "ix";
		} else {
			item_key = "i" + (i + 1);
		}
		
		let slot = this.allslot_equipment[i];
		if (slot.equipment_id) {
			json.items[item_key] = {
				id: slot.equipment_id,
				rf: slot.improvement,
			};
			if (airplane_cates.indexOf(slot.equipment_data.category) >= 0) {
				json.items[item_key].mas = 7;
			}
		}
	}
	
	return json;
}

// サブスレッドへの転送用
function SupportShipData_get_json_MT(){
	// いくつかは変換する
	return {
		ship_object_id       : this.ship_object_id       ,
		ship_name            : this.ship_name            ,
		priority             : this.priority             ,
		engagementform_modify: this.engagementform_modify,
		formation_modify     : this.formation_modify     ,
		level: this.level,
		luck : this.luck,
		border_basic_power   : this.border_basic_power   ,
		border_final_power   : this.border_final_power   ,
		raw_firepower        : this.raw_firepower        ,
		raw_accuracy         : this.raw_accuracy         ,
		cv_shelling          : this.cv_shelling          ,
		cv_force_attackable  : this.cv_force_attackable  ,
		slot_count           : this.slot_count           ,
		exslot_available     : this.exslot_available     ,
		allslot_equipment    : this.allslot_equipment.map(s => s.get_json()),
		allslot_equipables   : this.allslot_equipables   ,
		allslot_fixes        : this.allslot_fixes        ,
		//equipment_bonus_name : this.equipment_bonus.name , // ship_name
	};
}

function SupportShipData_set_json_MT(json){
	this.ship_object_id       = json.ship_object_id       ,
	this.ship_name            = json.ship_name            ,
	this.priority             = json.priority             ,
	this.engagementform_modify= json.engagementform_modify,
	this.formation_modify     = json.formation_modify     ,
	this.level = this.level,
	this.luck  = this.luck,
	this.border_basic_power   = json.border_basic_power   ,
	this.border_final_power   = json.border_final_power   ,
	this.raw_firepower        = json.raw_firepower        ,
	this.raw_accuracy         = json.raw_accuracy         ,
	this.cv_shelling          = json.cv_shelling          ,
	this.cv_force_attackable  = json.cv_force_attackable  ,
	this.slot_count           = json.slot_count           ,
	this.exslot_available     = json.exslot_available     ,
	this.allslot_equipment    = json.allslot_equipment.map(d => {
		let sl = new EquipmentSlot();
		sl.set_json(d);
		return sl;
	}),
	this.allslot_equipables   = json.allslot_equipables   ,
	this.allslot_fixes        = json.allslot_fixes        ,
	this.equipment_bonus = new EquipmentBonus(json.ship_name, true);
}


// 2つの装備の、この艦への装備可能条件に関する包含関係
// ただし固定されているスロットは除く
// a, b: 装備ID
// mainslot: 通常の装備スロットについて
// exslot: 増設スロットについて
function SupportShipData_eqab_compare(a, b, mainslot = true, exslot = false){
	let a_inc_b = true; // bが装備可能⇒aが装備可能、a⊃b である
	let b_inc_a = true; // b⊃a
	
	let ibegin = mainslot ? 0 : this.slot_count;
	let iend   = exslot ? this.allslot_equipment.length : this.slot_count;
	
	for (let i=ibegin; i<iend; i++) {
		if (this.allslot_fixes[i]) continue;
		let eqab = this.allslot_equipables[i];
		
		if (eqab[a] && !eqab[b]) b_inc_a = false;
		if (eqab[b] && !eqab[a]) a_inc_b = false;
	}
	
	let c = 0;
	if (a_inc_b && b_inc_a) { // 同等
	} else if (a_inc_b) {     // a⊃b
		c = 1;
	} else if (b_inc_a) {     // b⊃a
		c = -1;
	} else {
/*
		// 含むでも含まれるでもない
		// 艦これのシステムならこれはないと仮定する
		// …が、増設に見張員が積めるようになってしまったので、夕張などで発生することに
		console.log("warning: 装備可能条件が仮定を満たさない");
		debugger;
*/
	}
	return c;
}

// 装備可能条件が特殊な(非固定)増設スロットを持つか
// 特殊とは、増設に装備可能だが通常の(非固定)スロットのいずれかに装備できない装備があること
// ids: 装備IDのリスト　省略すると全ての装備
function SupportShipData_has_irregular_exslot(ids = null){
	// 増設スロット位置
	let ex_index = this.slot_count;
	if (!this.exslot_available || this.allslot_fixes[ex_index]) return false;
	
	// 比較する通常スロットの位置
	let last_index = -1;
	for (let r=0; r<ex_index; r++) {
		let i = ex_index - r - 1;
		if (!this.allslot_fixes[i]) {
			last_index = i;
			break;
		}
	}
	if (last_index < 0) return false;
	
	let last_eqab = this.allslot_equipables[last_index];
	let ex_eqab = this.allslot_equipables[ex_index];
	let keys = ids || Object.keys(ex_eqab);
	
	for (let i=0; i<keys.length; i++) {
		if (ex_eqab[keys[i]] && !last_eqab[keys[i]]) return true;
	}
	
	return false;
}

// 砲撃戦火力で比較　装備ボーナスはなし
// a, b: 装備ID
// 厳密には、整数化の都合でこの順番にならない場合がある
function SupportShipData_power_compare(a, b){
	let da = EquipmentDatabase.equipment_data_map[a];
	let db = EquipmentDatabase.equipment_data_map[b];
	
	if (this.cv_shelling) {
		let _cv_power = eq => eq.firepower + eq.torpedo + eq.bombing * 1.3;
		return _cv_power(da) - _cv_power(db);
	} else {
		return da.firepower - db.firepower;
	}
}

// 命中値で比較
function SupportShipData_accuracy_compare(a, b){
	let da = EquipmentDatabase.equipment_data_map[a];
	let db = EquipmentDatabase.equipment_data_map[b];
	return da.accuracy - db.accuracy;
}

// 装備優先度
function SupportShipData_priority_compare(a, b){
	let da = EquipmentDatabase.equipment_data_map[a];
	let db = EquipmentDatabase.equipment_data_map[b];
	return da.priority - db.priority;
}

function SupportShipData_static_power_compare(a, b, cv_shelling){
	return SupportShipData_power_compare.call({cv_shelling: cv_shelling}, a, b);
}

