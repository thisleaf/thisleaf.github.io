/* 艦隊や装備のDOM操作など */

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT} from "./utility.mjs";
import {SupportShip, SupportShipData} from "./kc_support_ship.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";

export {
	SupportFleet,
};


// SupportFleet ------------------------------------------------------------------------------------
Object.assign(SupportFleet.prototype, {
	e_table           : null,
	e_supporttype_cell: null,
	e_cost_cell       : null,
	e_engagement      : null,
	e_formation       : null,
	e_targetpower     : null,
	e_batchset        : null,
	e_accuracy_cell   : null,
	
	// D&Dで使用される識別名
	name              : "",
	// 艦
	support_ships     : null,
	// ドラッグドロップのデータを仲介する外部オブジェクト
	dragdata_provider : null,
	// callback
	onchange          : null,
	
	create            : SupportFleet_create            ,
	create_cols       : SupportFleet_create_cols       ,
	create_thead      : SupportFleet_create_thead      ,
	set_draggable     : SupportFleet_set_draggable     ,
	get_support_type  : SupportFleet_get_support_type  ,
	get_ammocost_rate : SupportFleet_get_ammocost_rate ,
	refresh_display   : SupportFleet_refresh_display   ,
	get_ship_by_number: SupportFleet_get_ship_by_number,
	
	clear             : SupportFleet_clear             ,
	get_json          : SupportFleet_get_json          ,
	set_json          : SupportFleet_set_json          ,
	call_onchange     : SupportFleet_call_onchange     ,
	
	ev_click_batchset : SupportFleet_ev_click_batchset ,
	ev_change_sup     : SupportFleet_ev_change_sup     ,
	
	ev_dragstart_ship : SupportFleet_ev_dragstart_ship ,
	ev_dragover_ship  : SupportFleet_ev_dragover_ship  ,
	ev_drop_ship      : SupportFleet_ev_drop_ship      ,
	ev_dragend_ship   : SupportFleet_ev_dragend_ship   ,
	ev_dragstart_equip: SupportFleet_ev_dragstart_equip,
	ev_dragover_equip : SupportFleet_ev_dragover_equip ,
	ev_drop_equip     : SupportFleet_ev_drop_equip     ,
	ev_dragend_equip  : SupportFleet_ev_dragend_equip  ,
});

Object.assign(SupportFleet, {
	// 支援タイプ
	SUPPORT_UNABLED  : 0,
	SHELLING_SUPPORT : 1,
	AERIAL_SUPPORT   : 2,
	ASW_SUPPORT      : 3,
	ASW_IF_EQUIPPED  : 4, // 対潜装備を載せると対潜支援になる
	TORPEDO_SUPPORT  : 5,
	SAMECHARA_EXISTED: 6, // 同一キャラがいるので支援不可
});


// name はユニークに
function SupportFleet(arg_table, name){
	this.e_table = arg_table;
	this.name = name;
}

function SupportFleet_create(caption, def_priority){
	Util.remove_children(this.e_table);
	
	this.support_ships = new Array;
	this.create_cols();
	this.create_thead(caption);
	
	let _onchange_sup = e => this.ev_change_sup(e);
	
	for (let i=0; i<6; i++) {
		let sup = new SupportShip(i + 1, this.name + "_" + (i + 1));
		sup.create(def_priority);
		this.e_table.appendChild(sup.e_tbody);
		sup.onchange = _onchange_sup;
		this.support_ships.push(sup);
	}
	
	this.refresh_display();
}

function SupportFleet_create_cols(){
	let cols = new Array;
	for (let i=0; i<8; i++) cols.push(ELEMENT("col"));
	NODE(this.e_table, [NODE(ELEMENT("colgroup"), cols)]);
}

function SupportFleet_create_thead(caption){
	// 一括設定
	this.e_engagement = NODE(ELEMENT("select"), Global.ENGAGEMENT_FORM_DEFINITION.map(d => {
		let op = new Option(d.name, d.support);
		if (d.className) op.className = d.className;
		return op;
	}));
	this.e_engagement.selectedIndex = 1; // 反航戦
	this.e_engagement.addEventListener("change", e => Util.inherit_option_class(e.currentTarget));
	Util.inherit_option_class(this.e_engagement);
	
	this.e_formation = NODE(ELEMENT("select"), Global.FORMATION_DEFINITION.map(d => {
		let op = new Option(d.name, d.support);
		if (d.className) op.className = d.className;
		return op;
	}));
	this.e_formation.selectedIndex = 0; // 単縦陣
	this.e_formation.addEventListener("change", e => Util.inherit_option_class(e.currentTarget));
	Util.inherit_option_class(this.e_formation);
	
	this.e_targetpower = ELEMENT("input", {type: "number", className: "targetpower"});
	this.e_targetpower.min = 0;
	this.e_targetpower.max = 200;
	//this.e_targetpower.value = Global.SUPPORT_POWER_CAP + 1;
	this.e_batchset = ELEMENT("button", {textContent: "一括設定", className: "batchset"});
	this.e_batchset.addEventListener("click", e => this.ev_click_batchset(e));
	
	let thead = NODE(ELEMENT("thead"), [
		NODE(ELEMENT("tr"), [
			ELEMENT("th", {colSpan: 8, textContent: caption, className: "caption"})
		]),
		NODE(ELEMENT("tr"), [
			ELEMENT("th", {colSpan: 2, textContent: "支援タイプ"}),
			this.e_supporttype_cell = ELEMENT("td", "", "support_type"),
			NODE(ELEMENT("td", {colSpan: 4, className: "target"}), [
				this.e_formation,
				this.e_engagement,
				NODE(ELEMENT("span", {className: "postcap", title: "空にするとキャップ後は設定しない"}), [TEXT(" キャップ後")]),
				this.e_targetpower,
				this.e_batchset,
			]),
			this.e_accuracy_cell = ELEMENT("td", {className: "total_accuracy", title: "命中合計"}),
		]),
		NODE(ELEMENT("tr"), [
			ELEMENT("th", {colSpan: 2, textContent: "消費"}),
			this.e_cost_cell = ELEMENT("td", "", "cost"),
			ELEMENT("th", {colSpan: 2, textContent: "固定", className: "fixed_header"}),
			ELEMENT("th", {textContent: "装備"}),
			ELEMENT("th", {textContent: "攻撃力"}),
			ELEMENT("th", {textContent: "命中"}),
		]),
	]);
	
	this.e_table.appendChild(thead);
}

// ドラッグドロップを可能にする
// provider: DragdataProvider
function SupportFleet_set_draggable(provider){
	for (let i=0; i<this.support_ships.length; i++) {
		let sup = this.support_ships[i];
		
		let nc = sup.e_number_cell;
		nc.draggable = true;
		nc.addEventListener("dragstart", e => this.ev_dragstart_ship(e, sup));
		nc.addEventListener("dragover" , e => this.ev_dragover_ship(e, sup));
		nc.addEventListener("drop"     , e => this.ev_drop_ship(e, sup));
		nc.addEventListener("dragend"  , e => this.ev_dragend_ship(e, sup));
		
		for (let index=0; index<sup.e_dragdrop_cells.length; index++) {
			let dc = sup.e_dragdrop_cells[index];
			dc.draggable = true;
			dc.addEventListener("dragstart", e => this.ev_dragstart_equip(e, sup, index));
			dc.addEventListener("dragover" , e => this.ev_dragover_equip(e, sup, index));
			dc.addEventListener("drop"     , e => this.ev_drop_equip(e, sup, index));
			dc.addEventListener("dragend"  , e => this.ev_dragend_equip(e, sup, index));
		}
	}
	
	this.dragdata_provider = provider;
}

function SupportFleet_get_support_type(){
	let def = [
		{key: "駆逐艦"     , types: ["駆逐艦", "陽字号駆逐艦"]},
		{key: "空母系"     , types: ["正規空母", "装甲空母", "軽空母", "夜間作戦航空母艦", "近代化航空母艦"]},
		{key: "航空支援系A", types: ["水上機母艦", "揚陸艦"]},
		{key: "航空支援系B", types: ["航空戦艦", "改装航空戦艦", "航空巡洋艦", "補給艦"]},
		{key: "砲撃支援系" , types: ["戦艦", "重巡洋艦"]},
		{key: "軽空母"     , types: ["軽空母"]},
		{key: "対潜支援系" , types: ["軽空母", "水上機母艦", "補給艦", "揚陸艦", "軽巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦"]}, // 海防艦は別扱い
		{key: "海防艦"     , types: ["海防艦"]},
		{key: "戦艦系"     , types: ["戦艦", "航空戦艦", "改装航空戦艦"]},
		{key: "重巡系"     , types: ["重巡洋艦", "航空巡洋艦"]},
	];
	
	let count = new Object;
	let charanames = new Array;
	// キャラが重複しているかどうか
	let same_chara = false;
	
	def.forEach(d => count[d.key] = 0);
	
	for (let sup of this.support_ships) {
		let ssd = new SupportShipData;
		
		if (sup.get_data(ssd)) {
			let ship = sup.ship_selector.get_ship();
			for (let d of def) {
				if (d.types.indexOf(ship.shipType) >= 0) {
					count[d.key]++;
				}
			}
			
			let chara = sup.ship_selector.get_charaname();
			if (charanames.indexOf(chara) >= 0) {
				same_chara = true;
			} else {
				charanames.push(chara);
			}
		}
	}
	
	// 支援タイプ判定
	if (same_chara) {
		// キャラの重複
		return SupportFleet.SAMECHARA_EXISTED;
		
	} else if (count["駆逐艦"] < 2) {
		// 支援不可
		return SupportFleet.SUPPORT_UNABLED;
		
	} else if ( count["砲撃支援系"] == 0 ?
		count["空母系"] >= 1 || count["航空支援系A"] >= 2 || count["航空支援系B"] >= 2 :
		count["空母系"] + count["航空支援系A"] >= 2 )
	{
		// 航空支援・対潜支援哨戒
		// 厳密にはこれらの艦は対潜攻撃可能でなければならない
		if (count["軽空母"] >= 1 && count["対潜支援系"] + count["海防艦"] / 2 >= 2) {
			return SupportFleet.ASW_SUPPORT;
		}
		return SupportFleet.AERIAL_SUPPORT;
		
	} else if (count["戦艦系"] + count["重巡系"] / 3 >= 2 || count["重巡系"] == 4) {
		// 支援射撃
		return SupportFleet.SHELLING_SUPPORT;
		
	} else {
		// 支援長距離雷撃
		return SupportFleet.TORPEDO_SUPPORT;
	}
}

// 支援の消費弾薬の割合　この値をかけて切り上げたものが消費
// 同一の支援でも消費が異なる場合がある
function SupportFleet_get_ammocost_rate(){
	let def = [
		// 装甲空母は除外されている
		{key: "空母系", types: ["正規空母", "軽空母", "水上機母艦", "夜間作戦航空母艦", "近代化航空母艦"]},
	];
	
	let count = new Object;
	def.forEach(d => count[d.key] = 0);
	
	for (let sup of this.support_ships) {
		let ssd = new SupportShipData;
		
		if (sup.get_data(ssd)) {
			let ship = sup.ship_selector.get_ship();
			for (let d of def) {
				if (d.types.indexOf(ship.shipType) >= 0) {
					count[d.key]++;
				}
			}
		}
	}
	
	return count["空母系"] >= 3 ? 0.4 : 0.8;
}

// 支援タイプ、消費、合計命中値の表示を更新
function SupportFleet_refresh_display(){
	let type = this.get_support_type();
	// 支援不可(駆逐不足)は砲撃支援の消費とする
	let ammorate = type != SupportFleet.SUPPORT_UNABLED ? this.get_ammocost_rate() : 0.8;
	
	let type_text = "", type_class = "support_type";
	switch (type) {
	default:
	case SupportFleet.SUPPORT_UNABLED  : type_text = "支援不可 (要:駆逐艦2隻)"; type_class += " unabled"; break;
	case SupportFleet.SHELLING_SUPPORT : type_text = "砲撃支援"; type_class += " shelling"; break;
	case SupportFleet.AERIAL_SUPPORT   : type_text = "航空支援"; type_class += " aerial"; break;
	case SupportFleet.ASW_SUPPORT      : type_text = "対潜支援 / 航空支援"; type_class += " aerial_asw"; break;
	case SupportFleet.ASW_IF_EQUIPPED  : type_text = "航空支援 (対潜支援は要:対潜装備)"; type_class += " aerial"; break;
	case SupportFleet.TORPEDO_SUPPORT  : type_text = "雷撃支援"; type_class += " torpedo"; break;
	case SupportFleet.SAMECHARA_EXISTED: type_text = "支援不可 (同一艦が存在)"; type_class += " unabled"; break;
	}
	if (ammorate == 0.8) {
		switch (type) {
		case SupportFleet.AERIAL_SUPPORT   :
		case SupportFleet.ASW_SUPPORT      :
		case SupportFleet.ASW_IF_EQUIPPED  :
			type_text += " (弾薬消費80%)";
		}
	}
	
	this.e_supporttype_cell.textContent = type_text;
	this.e_supporttype_cell.className = type_class;
	
	let total_fuel = 0;
	let total_ammo = 0;
	let total_accuracy = 0;
	
	for (let sup of this.support_ships) {
		let ssd = new SupportShipData;
		if (sup.get_data(ssd)) {
			sup.set_ammocost_rate(ammorate);
			total_accuracy += ssd.get_accuracy();
			total_fuel += sup.get_fuelcost();
			total_ammo += sup.get_ammocost();
		}
	}
	
	let cost_html = total_fuel + total_ammo > 0 ?
		'燃料<span class="fuel">' + total_fuel + '</span> + 弾薬<span class="ammo">' +
		total_ammo + '</span> = <span class="fuelammo">' + (total_fuel + total_ammo) + '</span>' :
		"";
	
	this.e_cost_cell.innerHTML = cost_html;
	this.e_accuracy_cell.textContent = total_accuracy;
	this.e_accuracy_cell.classList.toggle("good", total_accuracy > 0);
}

function SupportFleet_get_ship_by_number(number){
	for (let sup of this.support_ships) {
		if (sup.number == number) return sup;
	}
	return null;
}

function SupportFleet_clear(priority){
	for (let sup of this.support_ships) {
		sup.clear(priority);
	}
	this.refresh_display();
}

function SupportFleet_get_json(){
	let ships = new Array;
	for (let sup of this.support_ships) {
		ships.push(sup.get_json());
	}
	return {ships: ships};
}

function SupportFleet_set_json(json){
	this.clear();
	
	let ships = json && json.ships;
	if (!ships) return;
	
	for (let i=0; i<this.support_ships.length; i++) {
		this.support_ships[i].set_json(ships[i]);
	}
	
	this.refresh_display();
}

function SupportFleet_call_onchange(){
	if (this.onchange) this.onchange.call(null);
}

function SupportFleet_ev_click_batchset(){
	let tp = Util.formstr_to_float(this.e_targetpower.value, -1, -1);
	
	if (!tp.error) {
		for (let sup of this.support_ships) {
			sup.set_target(this.e_engagement.selectedIndex, this.e_formation.selectedIndex, tp.value);
		}
		this.call_onchange();
	}
}

function SupportFleet_ev_change_sup(){
	this.refresh_display();
	this.call_onchange();
}


// ドラッグ＆ドロップ処理
// 艦のD&D
function SupportFleet_ev_dragstart_ship(e, sup){
	// ダミー
	e.dataTransfer.setData("page_token", Global.PAGE_TOKEN);
	// 実際のデータの受け渡しについては DragdataProvider を使用する
	this.dragdata_provider.set_data({
		type : "support_ship",
		fleet: this,
		sup  : sup,
	});
	
	let rect = e.currentTarget.getBoundingClientRect();
	let x = e.pageX - rect.left - window.scrollX;
	let y = e.pageY - rect.top - window.scrollY;
	
	e.dataTransfer.setDragImage(sup.e_tbody, x, y);
}

function SupportFleet_ev_dragover_ship(e, sup){
	let drag = this.dragdata_provider.get_data();
	
	if (drag && drag.type == "support_ship" && drag.sup != sup) {
		e.dataTransfer.dropEffect = "move";
		e.preventDefault();
	}
}

function SupportFleet_ev_drop_ship(e, sup){
	let drag = this.dragdata_provider.get_data();
	
	if (drag && drag.type == "support_ship" && drag.sup != sup) {
		sup.swap_data(drag.sup);
		
		this.refresh_display();
		if (drag.fleet != this) drag.fleet.refresh_display();
		
		this.call_onchange();
		e.preventDefault();
	}
}

function SupportFleet_ev_dragend_ship(){
	this.dragdata_provider.clear();
}


// 装備のD&D
function SupportFleet_ev_dragstart_equip(e, sup, index){
	if (!sup.is_index_available(index)) return;
	
	e.dataTransfer.setData("page_token", Global.PAGE_TOKEN);
	
	this.dragdata_provider.set_data({
		type : "support_ship_equipment",
		fleet: this,
		sup  : sup,
		index: index,
	});
}

function SupportFleet_ev_dragover_equip(e, sup, index){
	if (!sup.is_index_available(index)) return;
	
	let drag = this.dragdata_provider.get_data();
	
	if (drag && drag.type == "support_ship_equipment" && (drag.sup != sup || drag.index != index)) {
		let sup_data = sup.get_slot_info(index);
		let drag_data = drag.sup.get_slot_info(drag.index);
		
		// 入れ替え可能
		if ( (sup_data.equipable[drag_data.id] || drag_data.id == "") &&
			(drag_data.equipable[sup_data.id] || sup_data.id == "") )
		{
			e.dataTransfer.dropEffect = "move";
			e.preventDefault();
		}
	}
}

function SupportFleet_ev_drop_equip(e, sup, index){
	if (!sup.is_index_available(index)) return;
	
	let drag = this.dragdata_provider.get_data();
	
	if (drag && drag.type == "support_ship_equipment" && (drag.sup != sup || drag.index != index)) {
		let sup_data = sup.get_slot_info(index);
		let drag_data = drag.sup.get_slot_info(drag.index);
		
		// 入れ替え可能
		if ( (sup_data.equipable[drag_data.id] || drag_data.id == "") &&
			(drag_data.equipable[sup_data.id] || sup_data.id == "") )
		{
			sup_data.select.set_id_star(drag_data.id, drag_data.star);
			drag_data.select.set_id_star(sup_data.id, sup_data.star);
			sup.refresh_equipstatus();
			if (drag.sup != sup) drag.sup.refresh_equipstatus();
			this.refresh_display();
			if (drag.fleet != this) drag.fleet.refresh_display();
			
			this.call_onchange();
			e.preventDefault();
		}
	}
}

function SupportFleet_ev_dragend_equip(){
	this.dragdata_provider.clear();
}

