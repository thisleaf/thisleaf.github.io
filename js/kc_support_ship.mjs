// 艦の入力フォームとデータオブジェクト

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT} from "./utility.mjs";
import {ShipSelector} from "./kc_ship_selector.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import * as Damage from "./kc_damage_utility.mjs";

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
	// 艦名(改造度合いを含む)
	name  : "",
	
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
	set_target         : SupportShip_set_target,
	set_ammocost_rate  : SupportShip_set_ammocost_rate,
	get_fuelcost       : SupportShip_get_fuelcost,
	get_ammocost       : SupportShip_get_ammocost,
	clear              : SupportShip_clear,
	swap_data          : SupportShip_swap_data,
	is_index_available : SupportShip_is_index_available,
	get_slot_info      : SupportShip_get_slot_info,
	
	refresh_shipinfo    : SupportShip_refresh_shipinfo    ,
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
	ev_click_exavail   : SupportShip_ev_click_exavail   ,
	ev_change_priority : SupportShip_ev_change_priority ,
	ev_change_target   : SupportShip_ev_change_target   ,
	ev_change_equipment: SupportShip_ev_change_equipment,
});


Object.assign(SupportShip, {
	// 砲撃支援時、空母系とみなす shipType のリスト
	// ちなみに速吸は空母系ではない
	cv_shelling_types: [
		"軽空母", "正規空母", "装甲空母"
	],
	
	get_border_power: SupportShip_static_get_border_power,
});


// SupportShip -------------------------------------------------------------------------------------
function SupportShip(number, name){
	this.number = number;
	if (name) this.set_name(name);
}

function SupportShip_set_name(name){
	this.name = name;
	this.equipment_bonus = new EquipmentBonus(name);
	
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
		str += "/" + eq.accuracy + "] " + eq.name;
		return str;
	};
	
	// 艦の選択・補強増設
	this.ship_selector = new ShipSelector;
	this.ship_selector.onchange = name => this.ev_change_ship(name);
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
		Global.ENGAGEMENT_FORM_DEFINITION.map(d => new Option(d.name, d.support))
	);
	this.e_engagement.selectedIndex = 1; // 反航戦
	this.e_engagement.addEventListener("change", _change_target);
	
	this.e_formation = NODE(ELEMENT("select"),
		Global.FORMATION_DEFINITION.map(d => new Option(d.name, d.support))
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
	this.equipable_info = new EquipableInfo;
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
		this.ship_selector.e_chara_select,
		this.ship_selector.e_class_select,
		ELEMENT("br"),
		this.ship_selector.e_ship_select,
		NODE(document.createElement("label"), [
			this.e_exslot_available,
			TEXT("補強増設"),
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
			ELEMENT("td", {textContent: "", className: "eq_accuracy n_b n_l"}),
		]),
		Util.create_row([
			this.e_dragdrop_cells[0],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[0]]),
			NODE(ELEMENT("td", "", "n_all"), [this.equipment_selects[0].e_select]),
			this.e_slot_firepower_cells[0],
			this.e_slot_accuracy_cells[0],
		]),
		Util.create_row([
			NODE(ELEMENT("th", "", "priority"), [TEXT("優先度")]),
			NODE(ELEMENT("td"), [this.e_priority]),
			this.e_dragdrop_cells[1],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[1]]),
			NODE(ELEMENT("td", "", "n_all"), [this.equipment_selects[1].e_select]),
			this.e_slot_firepower_cells[1],
			this.e_slot_accuracy_cells[1],
		]),
		Util.create_row([
			Util.create_cell("th", "火力目標", 1, 2),
			target_cell,
			this.e_dragdrop_cells[2],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[2]]),
			NODE(ELEMENT("td", "", "n_all"), [this.equipment_selects[2].e_select]),
			this.e_slot_firepower_cells[2],
			this.e_slot_accuracy_cells[2],
		]),
		Util.create_row([
			this.e_dragdrop_cells[3],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[3]]),
			NODE(ELEMENT("td", "", "n_all"), [this.equipment_selects[3].e_select]),
			this.e_slot_firepower_cells[3],
			this.e_slot_accuracy_cells[3],
		]),
		this.e_5th_equipment_row = Util.create_row([
			Util.create_cell("td", "", 2, 1, "n_b"),
			this.e_dragdrop_cells[4],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_slot_fixes[4]]),
			NODE(ELEMENT("td", "", "n_all"), [this.equipment_selects[4].e_select]),
			this.e_slot_firepower_cells[4],
			this.e_slot_accuracy_cells[4],
		]),
		this.e_exslot_equipment_row = Util.create_row([
			Util.create_cell("td", "", 2, 1, "n_tb"),
			this.e_dragdrop_cells[5],
			NODE(ELEMENT("td", "", "eq_fix n_all"), [this.e_exslot_fix]),
			NODE(ELEMENT("td", "", "n_all"), [this.ex_equipment_select.e_select]),
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
		} else {
			this.e_slot_fixes[i].classList.add("hidden");
			this.equipment_selects[i].e_select.classList.add("hidden");
		}
	}
	
	if (show_exslot) {
		this.e_exslot_fix.classList.remove("hidden");
		this.ex_equipment_select.e_select.classList.remove("hidden");
	} else {
		this.e_exslot_fix.classList.add("hidden");
		this.ex_equipment_select.e_select.classList.add("hidden");
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
	return ship ? Math.ceil(+ship.fuel * 0.5) : 0;
}

function SupportShip_get_ammocost(){
	let ship = this.ship_selector.get_ship();
	return ship ? Math.ceil(+ship.ammo * this.ammocost_rate) : 0;
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
	return data;
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
		this.refresh_displaypower();
		this.refresh_equipstatus();
	}
}

// 目標火力欄：表示火力の更新
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
		
		ssd.calc_bonus();
		
	} else {
		this.e_rawfirepower_eq_cell.textContent = "素火力";
		this.e_rawfirepower_cell.textContent = "";
	}
	
	// 反映
	for (let i=0; i<ilim; i++) {
		let enabled = i < slot_count || (ssd.exslot_available && i == ilim - 1);
		
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
	data.support_ship = this;
	
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
	data.border_final_power = tp.value;
	data.border_basic_power = bp >= 1 ? bp : 1; // 最低1とする(0が攻撃不可を表す)
	data.raw_firepower = +this.equipable_info.ship.firepowerMax;
	data.cv_shelling = this.is_cv_shelling();
	
	data.slot_count       = this.equipable_info.get_slot_count();
	data.exslot_available = this.e_exslot_available.checked;
	
	let slots = new Array;
	let equipables = new Array;
	let fixes = new Array;
	
	for (let i=0; i<data.slot_count; i++) {
		slots[i] = new EquipmentSlot(+this.equipment_selects[i].e_select.value, null, 0);
		equipables[i] = this.equipable_info.slot_equipables[i];
		fixes[i] = this.e_slot_fixes[i].checked;
	}
	
	if (data.exslot_available) {
		slots.push(new EquipmentSlot(+this.ex_equipment_select.e_select.value, null, 0));
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
		
		// 通常スロット有効部
		if (i < data.slot_count) {
			val = data.allslot_equipment[i].equipment_id || "";
			fix = data.allslot_fixes[i];
		}
		
		this.equipment_selects[i].e_select.value = val;
		this.e_slot_fixes[i].checked = fix;
	}
	
	this.e_exslot_available.checked = data.exslot_available;
	
	let ex_val = "", ex_fix = false;
	
	if (data.exslot_available) {
		let r = data.allslot_equipment.length - 1;
		ex_val = data.allslot_equipment[r].equipment_id || "";
		ex_fix = data.allslot_fixes[r];
	}
	
	this.ex_equipment_select.e_select.value = ex_val;
	this.e_exslot_fix.checked = ex_fix;
	
	this.refresh_equipstatus();
}

function SupportShip_get_json(){
	// 要素の追加や削除を考慮して表示名で保存しておくことにする
	function _text(select){
		return select.selectedIndex >= 0 ? select.options[select.selectedIndex].textContent : "";
	}
	
	return {
		name            : this.name,
		exslot_available: this.e_exslot_available.checked,
		priority        : this.e_priority.value,
		engagement      : _text(this.e_engagement),
		formation       : _text(this.e_formation),
		targetpower     : this.e_targetpower.value,
		slot_fixes      : this.e_slot_fixes.map(e => e.checked),
		exslot_fix      : this.e_exslot_fix.checked,
		equipment_ids   : this.equipment_selects.map(sel => sel.get_id()),
		ex_equipment_id : this.ex_equipment_select.get_id(),
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
	this.e_exslot_available.checked = json.exslot_available;
	this.e_priority.value = json.priority;
	_set_by_text(this.e_engagement, json.engagement);
	_set_by_text(this.e_formation, json.formation);
	this.e_targetpower.value = json.targetpower;
	_foreach2(this.e_slot_fixes, json.slot_fixes, (e, b) => e.checked = b);
	this.e_exslot_fix.checked = json.exslot_fix;
	_foreach2(this.equipment_selects, json.equipment_ids, (sel, id) => sel.set_id(id));
	this.ex_equipment_select.set_id(json.ex_equipment_id);
	
	this.refresh_shipinfo();
}

function SupportShip_call_onchange(){
	if (this.onchange) this.onchange.call(null);
}


function SupportShip_ev_change_ship(name){
	this.set_name(name);
	this.call_onchange();
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


// SupportShipData ---------------------------------------------------------------------------------
// SupportShip のデータを計算用に
Object.assign(SupportShipData.prototype, {
	support_ship: null,
	
	// 優先度
	priority: 0,
	// 交戦形態等の修正
//	power_modifier: 1, // 乗算の順番が変わるが気にしないことにする
	// やっぱり気になったので
	engagementform_modify: 1,
	formation_modify     : 1,
	
	// 目標攻撃力
//	border_display_power: 150, // 表示火力だが、空母系が…
	border_basic_power: 150, // 基本攻撃力
	border_final_power: 150, // 最終攻撃力
	// 素火力
	raw_firepower: 0,
	// 空母系(計算式)かどうか
	cv_shelling  : false,
	
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
	sort_equipment     : SupportShipData_sort_equipment   ,
	is_upper_equipment : SupportShipData_is_upper_equipment,
});


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
	this.equipment_bonus.get_bonus(this.allslot_equipment);
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
// 攻撃できないときは0
function SupportShipData_get_basic_power(){
	if (this.cv_shelling) {
		let fire = this.raw_firepower;
		let torp = 0;
		let bomb = 0;
		let attackable = false;
		
		for (let i=0; i<this.allslot_equipment.length; i++) {
			let slot = this.allslot_equipment[i];
			let data = slot.equipment_data;
			
			if (data) {
				fire += data.firepower + slot.bonus_firepower;
				torp += data.torpedo + slot.bonus_torpedo; // ボーナス値については不明だが一応
				bomb += data.bombing;
				
				if (!attackable) {
					// 艦攻・艦爆を一つは装備していないと攻撃できない
					//attackable = data.category == "艦上爆撃機" || data.category == "艦上攻撃機" || data.category == "噴式戦闘爆撃機";
					attackable = data.cv_attackable;
				}
			}
		}
		
		return attackable ? Math.floor((fire + torp + Math.floor(bomb * 1.3) + Global.SUPPORT_MODIFY) * 1.5) + 55 : 0;
		
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

// 命中値
function SupportShipData_get_accuracy(){
	let acc = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let data = this.allslot_equipment[i].equipment_data;
		if (data) {
			acc += data.accuracy;
		}
	}
	return acc;
}

// 装備のソート
function SupportShipData_sort_equipment(){
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
		// 同装備
		if (eq_a == eq_b) return 0;
		// 空チェック
		if (eq_a && !eq_b) return -1;
		if (!eq_a && eq_b) return 1;
		if (!eq_a && !eq_b) return 0;
		// 交換可能かどうか
		let eqab_a = this.allslot_equipables[i];
		let eqab_b = this.allslot_equipables[j];
		if (!eqab_a[b.equipment_id] || !eqab_b[a.equipment_id]) return 0;
		
		// 攻撃力
		let c = b.get_power_float(this.cv_shelling, true, true) - a.get_power_float(this.cv_shelling, true, true);
		// 命中
		if (c == 0) c = eq_b.accuracy - eq_a.accuracy;
		// id
		if (c == 0) c = eq_a.number - eq_b.number;
		return c;
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
	
	// シナジーボーナスについて
	if (bonus.assist_exists(base.number)) {
		// 同一種類のものでないならば不明とする
		if (!bonus.same_assist(upper.number, base.number)) return false;
	}
	
	if (bonus.bonus_exists(base.number)) {
		// 自身への装備ボーナスあり
		// どのくらいのボーナスがあるか分からないので、最大値で考えることにする
		let slot = new EquipmentSlot(base.number, base);
		bonus.get_max_bonus(slot);
		base_fpw += slot.bonus_firepower;
		base_tor += slot.bonus_torpedo;
	}
	// upperは最小値
	if (bonus.bonus_independent(upper.number)) {
		let slot = new EquipmentSlot(upper.number, upper);
		bonus.get_independent_bonus(slot);
		upper_fpw += slot.bonus_firepower;
		upper_tor += slot.bonus_torpedo;
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

