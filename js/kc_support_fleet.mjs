/* 艦隊や装備のDOM操作など */

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT} from "./utility.mjs";
import {SupportShip, SupportShipData} from "./kc_support_ship.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";

export {
	OwnEquipment,
	OwnEquipmentData,
	OwnEquipmentForms,
	SupportFleet,
};


// OwnEquipment ------------------------------------------------------------------------------------
Object.assign(OwnEquipment.prototype, {
	id        : 0,
	e_main_use: null,
	e_total   : null,
	
	onchange : null,
	
	get_data: OwnEquipment_get_data,
	set_data: OwnEquipment_set_data,
	get_json: OwnEquipment_get_json,
	set_json: OwnEquipment_set_json,
	
	ev_change: OwnEquipment_ev_change,
});


function OwnEquipment(number){
	this.id = number;
	this.e_main_use = ELEMENT("input", {type: "number", className: "using"});
	this.e_total = ELEMENT("input", {type: "number", className: "total"});
	
	this.e_main_use.min = 0;
	this.e_main_use.max = 99;
	this.e_main_use.value = 0;
	this.e_total.min = 0;
	this.e_total.max = 99;
	this.e_total.value = 0;
	
	let _change = e => this.ev_change(e);
	this.e_main_use.addEventListener("change", _change);
	this.e_total.addEventListener("change", _change);
}

function OwnEquipment_get_data(data){
	let v_using = Util.formstr_to_int(this.e_main_use.value, 0, 0);
	let v_total = Util.formstr_to_int(this.e_total.value, 0, 0);
	
	data.id = this.id;
	data.main_use = v_using.value;
	data.total = v_total.value;
	
	return v_using.good() && v_total.good() && data.total >= data.main_use;
}

function OwnEquipment_set_data(data){
	this.e_main_use.value = data.main_use;
	this.e_total.value = data.total;
}

function OwnEquipment_get_json(){
	return {
		id      : this.id,
		main_use: this.e_main_use.value,
		total   : this.e_total.value,
	};
}

function OwnEquipment_set_json(json){
	if (!json) return false;
	
	this.id               = json.id       || 0;
	this.e_main_use.value = json.main_use || 0;
	this.e_total.value    = json.total    || 0;
	return true;
}

function OwnEquipment_ev_change(e){
	//save_userdata();
	if (this.onchange) this.onchange.call(null, e);
}


// OwnEquipmentData --------------------------------------------------------------------------------
// フォームから読み取った所持数データ
Object.assign(OwnEquipmentData.prototype, {
	// form data
	id      : 0,
	main_use: 0,
	total   : 0,
	// 計算用
	//support_use: 0, // 支援艦隊で使用している数　fixedも含む omit
	remaining  : 0, // 装備されていない数
	fixed      : 0, // 固定の数
	
	clone: OwnEquipmentData_clone,
	remaining_max: OwnEquipmentData_remaining_max,
});

Object.assign(OwnEquipmentData, {
	// sorter
	power_greater   : OwnEquipmentData_static_power_greater   ,
	accuracy_greater: OwnEquipmentData_static_accuracy_greater,
	inc_greater     : OwnEquipmentData_static_inc_greater     ,
});


function OwnEquipmentData(id){
	if (id) {
		this.id = id;
	}
}

function OwnEquipmentData_remaining_max(){
	return this.total - this.main_use;
}

function OwnEquipmentData_clone(){
	return Object.assign(new OwnEquipmentData, this);
}

// sorter
function OwnEquipmentData_static_power_greater(a, b, cv_shelling){
	function _cv_power(eq){ return eq.firepower + eq.torpedo + eq.bombing * 1.3; }
	let da = EquipmentDatabase.equipment_data_map[a.id];
	let db = EquipmentDatabase.equipment_data_map[b.id];
	
	let c = cv_shelling ? _cv_power(db) - _cv_power(da) : db.firepower - da.firepower;
	if (c == 0) c = db.accuracy - da.accuracy;
	return c;
}

function OwnEquipmentData_static_accuracy_greater(a, b, cv_shelling){
	function _cv_power(eq){ return eq.firepower + eq.torpedo + eq.bombing * 1.3; }
	let da = EquipmentDatabase.equipment_data_map[a.id];
	let db = EquipmentDatabase.equipment_data_map[b.id];
	
	let c = db.accuracy - da.accuracy;
	if (c == 0) c = cv_shelling ? _cv_power(db) - _cv_power(da) : db.firepower - da.firepower;
	return c;
}

// 装備可能条件に関する包含関係 a⊃b
function OwnEquipmentData_static_inc_greater(a, b, ssd){
	let a_inc_b = true; // bが装備可能⇒aが装備可能、a⊃b である
	let b_inc_a = true; // b⊃a
	
	for (let i=0; i<ssd.allslot_equipment.length; i++) {
		if (ssd.allslot_fixes[i]) continue;
		let eqab = ssd.allslot_equipables[i];
		
		if (eqab[a.id] && !eqab[b.id]) b_inc_a = false;
		if (eqab[b.id] && !eqab[a.id]) a_inc_b = false;
	}
	
	let c = 0;
	if (a_inc_b && b_inc_a) { // 同等
	} else if (a_inc_b) {     // a⊃b
		c = -1;
	} else if (b_inc_a) {     // b⊃a
		c = 1;
	} else {
		// 含むでも含まれるでもない
		// 艦これのシステムならこれはないと仮定する
		console.log("warning: 装備可能条件が仮定を満たさない");
		debugger;
	}
	return c;
}


// OwnEquipmentForms -------------------------------------------------------------------------------
// OwnEquipment を生成してDOMに配置・管理する
Object.assign(OwnEquipmentForms.prototype, {
	e_container  : null,
	e_clear_main : null,
	e_clear_total: null,
	e_toggle     : null,
	
	own_equipment_list  : null, // array of OwnEquipment
	container_visibility: true, // 表示状態
	
	// callback: func(form_change)
	onchange : null,
	
	create      : OwnEquipmentForms_create,
	show        : OwnEquipmentForms_show,
	hide        : OwnEquipmentForms_hide,
	set_visible : OwnEquipmentForms_set_visible,
	get_own_list: OwnEquipmentForms_get_own_list,
	clear_error : OwnEquipmentForms_clear_error,
	clear_form  : OwnEquipmentForms_clear_form,
	get_json    : OwnEquipmentForms_get_json,
	set_json    : OwnEquipmentForms_set_json,
	
	ev_change_form : OwnEquipmentForms_ev_change_form,
	ev_click_toggle: OwnEquipmentForms_ev_click_toggle,
});

function OwnEquipmentForms(){
	this.e_container   = DOM("own_equipment");
	this.e_clear_main  = DOM("clear_main_equipcount");
	this.e_clear_total = DOM("clear_equipcount");
	this.e_toggle      = DOM("hide_owns");
	
	this.e_toggle.addEventListener("click", e => this.ev_click_toggle(e));
	this.set_visible(true);
}

function OwnEquipmentForms_show(){
	this.set_visible(true);
}

function OwnEquipmentForms_hide(){
	this.set_visible(false);
}

function OwnEquipmentForms_set_visible(visible){
	this.e_toggle.textContent = visible ? "非表示" : "表示";
	Util.change_style(DOM("style_changer"), ".equipment_input", visible ? "" : "display: none;");
	this.container_visibility = visible;
}

// 探索で使用するためのフォームデータを読み取って返す
// エラー発生時は null かつフォームにエラークラスが設定される
function OwnEquipmentForms_get_own_list(){
	let good = true;
	let own_list = new Array;
	
	for (let own of this.own_equipment_list) {
		let data = new OwnEquipmentData;
		if (!own.get_data(data)) {
			good = false;
			// エラー表示
			own.e_main_use.classList.add("error");
			own.e_total.classList.add("error");
		}
		own_list.push(data);
	}
	
	return good ? own_list : null;
}

function OwnEquipmentForms_clear_error(){
	for (let own of this.own_equipment_list) {
		own.e_main_use.classList.remove("error");
		own.e_total.classList.remove("error");
	}
}

function OwnEquipmentForms_clear_form(main, total){
	for (let own of this.own_equipment_list) {
		if (main) own.e_main_use.value = 0;
		if (total) own.e_total.value = 0;
	}
}

function OwnEquipmentForms_get_json(old){
	// 一応古いデータを引き継ぐ
	let res = old || new Object;
	if (!(res.own_list instanceof Array)) res.own_list = new Array;
	
	this.own_equipment_list.forEach(x => {
		let obj = x.get_json();
		let p = res.own_list.findIndex(y => y.id == obj.id);
		if (p < 0) p = res.own_list.length;
		res.own_list[p] = obj;
	});
	
	res.visibility = this.container_visibility;
	return res;
}

function OwnEquipmentForms_set_json(json){
	if (!json || !json.own_list) return;
	
	let own_list = json.own_list;
	let map = new Object;
	this.own_equipment_list.forEach(x => map[x.id] = x);
	
	for (let i=0; i<own_list.length; i++) {
		if (own_list[i]) {
			let own = map[own_list[i].id];
			if (own) {
				own.set_json(own_list[i]);
			}
		}
	}
	
	this.set_visible(json.visibility);
}

function OwnEquipmentForms_create(){
	this.own_equipment_list = new Array;  // array of OwnEquipment
	
	let _onchange = e => this.ev_change_form(e);
	
	for (let def of Global.SUPPORT_EQUIPLIST_DEF) {
		this.e_container.appendChild( NODE(ELEMENT("h3", "", def.className), [
			TEXT(def.category)
		]) );
		
		for (let d of EquipmentDatabase.csv_equiplist) {
			if (d.category == def.category) {
				if (def.ignore_zero_param) {
					// 火力か命中がついているもののみ
					if (d.firepower == 0 && d.accuracy == 0) continue;
				}
				
				let own = new OwnEquipment(d.number);
				let name_hint = Util.unescape_charref(d.name) + "\n";
				if (def.airplane) {
					name_hint += "火力" + d.firepower + "/雷装" + d.torpedo;
					name_hint += "/爆装" + d.bombing + "/命中" + d.accuracy;
				} else {
					name_hint += "火力" + d.firepower + "/命中" + d.accuracy;
				}
				
				let item = NODE(ELEMENT("div", "", "own_equipment_item " + def.className), [
					NODE(ELEMENT("span", {className: "item_name", title: name_hint}), [
						TEXT(Util.unescape_charref(d.name)),
					]),
					NODE(ELEMENT("span", "", "item_count"), [
						own.e_main_use,
						TEXT("/"),
						own.e_total,
					]),
				]);
				
				this.e_container.appendChild(item);
				
				own.onchange = _onchange;
				this.own_equipment_list.push(own);
			}
		}
	}
}

function OwnEquipmentForms_ev_change_form(e){
	if (this.onchange) this.onchange.call(null, true);
}

function OwnEquipmentForms_ev_click_toggle(e){
	this.set_visible(!this.container_visibility);
	if (this.onchange) this.onchange.call(null, false);
}


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
		let sup = new SupportShip(i + 1);
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
	this.e_engagement = NODE(ELEMENT("select"), Global.ENGAGEMENT_FORM_DEFINITION.map(d => new Option(d.name, d.support)));
	this.e_engagement.selectedIndex = 1; // 反航戦
	this.e_formation = NODE(ELEMENT("select"), Global.FORMATION_DEFINITION.map(d => new Option(d.name, d.support)));
	this.e_formation.selectedIndex = 0; // 単縦陣
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
		{key: "駆逐艦"     , types: ["駆逐艦"]},
		{key: "空母系"     , types: ["正規空母", "装甲空母", "軽空母", "夜間作戦航空母艦", "近代化航空母艦"]},
		{key: "航空支援系A", types: ["水上機母艦", "揚陸艦"]},
		{key: "航空支援系B", types: ["航空戦艦", "改装航空戦艦", "航空巡洋艦", "補給艦"]},
		{key: "砲撃支援系" , types: ["戦艦", "重巡洋艦"]},
		{key: "軽空母"     , types: ["軽空母"]},
		{key: "対潜支援系" , types: ["軽空母", "水上機母艦", "補給艦", "揚陸艦", "軽巡洋艦", "軽(航空)巡洋艦"]}, // 海防艦は別扱い
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
			sup_data.select.e_select.value = drag_data.id;
			drag_data.select.e_select.value = sup_data.id;
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

