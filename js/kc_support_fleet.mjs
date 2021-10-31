/* 艦隊や装備のDOM操作など */

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT, EL, _T} from "./utility.mjs";
import {SupportShip, SupportShipData} from "./kc_support_ship.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import {DOMDialog} from "./dom_dialog.mjs";

export {
	SupportFleet,
	SupportFleetTab,
};


// SupportFleet ------------------------------------------------------------------------------------
Object.assign(SupportFleet.prototype, {
	e_supporttype_cell: null,
	e_cost_cell       : null,
	e_engagement      : null,
	e_formation       : null,
	e_targetpower     : null,
	e_batchset        : null,
	e_batchset2       : null,
	e_accuracy_cell   : null,

	e_fleet_div       : null,
	e_header          : null,
	e_caption         : null,
	e_support_type    : null,
	e_fuelammo        : null,

	// D&Dで使用される識別名
	name              : "",
	// 表示される艦隊名
	fleet_name        : "",
	// 艦
	support_ships     : null,
	// ドラッグドロップのデータを仲介する外部オブジェクト
	dragdata_provider : null,
	// callback
	onchange          : null,
	
	create            : SupportFleet_create            ,
	set_draggable     : SupportFleet_set_draggable     ,
	set_fleet_name    : SupportFleet_set_fleet_name    ,
	get_fleet_name    : SupportFleet_get_fleet_name    ,
	set_column_count  : SupportFleet_set_column_count  ,
	get_support_type  : SupportFleet_get_support_type  ,
	get_ammocost_rate : SupportFleet_get_ammocost_rate ,
	refresh_display   : SupportFleet_refresh_display   ,
	refresh_target    : SupportFleet_refresh_target    ,
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

Object.defineProperties(SupportFleet.prototype, {
	onchange: {
		set: function (f){ this.addEventListener("change", f); }
	},
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


/**
 * 1艦隊を扱うクラス
 * @param {string} name ユニークな文字列
 * @constructor
 * @extends {EventTarget}
 */
function SupportFleet(name){
	Util.attach_event_target(this);
	this.name = name;
}

/**
 * @param {string} caption 
 * @param {number} def_priority 
 * @method SupportFleet#create
 */
function SupportFleet_create(caption, def_priority){
	this.support_ships = new Array;

	let onchange_sup = e => this.ev_change_sup(e);
	let onclick_target = e => this.dispatchEvent(new CustomEvent("click_target", {detail: e.detail}));
	
	for (let i=0; i<6; i++) {
		let sup = new SupportShip(i + 1, this.name + "_" + (i + 1));
		sup.create(def_priority);
		sup.addEventListener("change", onchange_sup);
		sup.addEventListener("click_target", onclick_target);
		this.support_ships.push(sup);
	}
	
	this.e_fleet_div = EL("div.support_fleet.support_" + this.name, [
		this.e_header = EL("div.fleetinfo", [
			this.e_caption = EL("div.caption"),
			EL("div.suptypebox", [
				EL("div.suptypelabel", [_T("支援タイプ")]),
				this.e_support_type = EL("div.support_type"),
			]),
			EL("div.pad"),
			this.e_cost = EL("div.cost"),
		]),
		...this.support_ships.map(ss => ss.e_panel),
	]);
	this.e_fleet_div.classList.add("column2");
	
	this.set_fleet_name(caption);
	this.refresh_display();
}


// ドラッグドロップを可能にする
// provider: DragdataProvider
function SupportFleet_set_draggable(provider){
	for (let i=0; i<this.support_ships.length; i++) {
		let sup = this.support_ships[i];
		
		let nc = sup.e_number_cell;
		nc.draggable = true;
		nc.addEventListener("dragstart", e => this.ev_dragstart_ship(e, sup));
		nc.addEventListener("dragend"  , e => this.ev_dragend_ship(e, sup));

		let panel = sup.e_panel;
		panel.addEventListener("dragover" , e => this.ev_dragover_ship(e, sup));
		panel.addEventListener("drop"     , e => this.ev_drop_ship(e, sup));
		
		for (let index=0; index<sup.e_dragdrop_cells.length; index++) {
			let dc = sup.e_dragdrop_cells[index];
			dc.draggable = true;
			dc.addEventListener("dragstart", e => this.ev_dragstart_equip(e, sup, index));
			dc.addEventListener("dragend"  , e => this.ev_dragend_equip(e, sup, index));

			let parent = dc.parentElement;
			parent.addEventListener("dragover" , e => this.ev_dragover_equip(e, sup, index));
			parent.addEventListener("drop"     , e => this.ev_drop_equip(e, sup, index));
		}
	}
	
	this.dragdata_provider = provider;
}

/**
 * @param {string} fname 
 * @alias SupportFleet#set_fleet_name
 */
function SupportFleet_set_fleet_name(fname){
	this.fleet_name = fname;
	this.e_caption.textContent = this.get_fleet_name();
}
/**
 * @param {boolean} [nodefault=false] デフォルトの名前を使用しない
 * @returns {string}
 */
function SupportFleet_get_fleet_name(nodefault = false){
	let name = this.fleet_name;
	if (!nodefault && name == "") name = "支援艦隊" + this.name;
	return name;
}

function SupportFleet_set_column_count(count){
	this.e_fleet_div.classList.toggle("column1", count == 1);
	this.e_fleet_div.classList.toggle("column2", count == 2);
	this.e_fleet_div.classList.toggle("column3", count == 3);
	this.e_fleet_div.classList.toggle("column6", count == 6);
}

function SupportFleet_get_support_type(){
	let def = [
		{key: "駆逐艦"     , types: ["駆逐艦", "陽字号駆逐艦"]},
		{key: "空母系"     , types: ["正規空母", "装甲空母", "軽空母", "夜間作戦航空母艦", "近代化航空母艦"]},
		{key: "航空支援系A", types: ["水上機母艦", "揚陸艦"]},
		{key: "航空支援系B", types: ["航空戦艦", "改装航空戦艦", "航空巡洋艦", "改装航空巡洋艦", "特殊改装航空巡洋艦", "補給艦"]},
		{key: "砲撃支援系" , types: ["戦艦", "巡洋戦艦", "重巡洋艦"]},
		{key: "軽空母"     , types: ["軽空母"]},
		{key: "対潜支援系" , types: ["軽空母", "水上機母艦", "補給艦", "揚陸艦", "軽巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦", "重改装軽巡洋艦"]}, // 海防艦は別扱い
		{key: "海防艦"     , types: ["海防艦"]},
		{key: "戦艦系"     , types: ["戦艦", "巡洋戦艦", "航空戦艦", "改装航空戦艦"]},
		{key: "重巡系"     , types: ["重巡洋艦", "航空巡洋艦", "改装航空巡洋艦", "特殊改装航空巡洋艦"]},
	];
	
	let count = new Object;
	let charanames = new Array;
	// キャラが重複しているかどうか
	let same_chara = false;
	
	def.forEach(d => count[d.key] = 0);
	
	for (let sup of this.support_ships) {
		let ssd = sup.get_ssd();
		
		if (!ssd.empty()) {
			let ship = ssd.ship;
			let st = ship.shipTypeI || ship.shipType;
			for (let d of def) {
				if (d.types.indexOf(st) >= 0) {
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
		let ssd = sup.get_ssd();
		
		if (!ssd.empty()) {
			let ship = sup.ship_selector.get_ship();
			let st = ship.shipTypeI || ship.shipType;
			for (let d of def) {
				if (d.types.indexOf(st) >= 0) {
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
	
	this.e_support_type.textContent = type_text;
	this.e_support_type.className = type_class;

	// this.e_supporttype_cell.textContent = type_text;
	// this.e_supporttype_cell.className = type_class;
	
	let total_fuel = 0;
	let total_ammo = 0;
	let total_accuracy = 0;
	
	for (let sup of this.support_ships) {
		let ssd = sup.get_ssd();
		if (!ssd.empty()) {
			sup.set_ammocost_rate(ammorate);
			total_accuracy += ssd.get_accuracy();
			total_fuel += sup.get_fuelcost();
			total_ammo += sup.get_ammocost();
		}
	}
	
	// let cost_html = total_fuel + total_ammo > 0 ?
	// 	'燃料<span class="fuel">' + total_fuel + '</span> + 弾薬<span class="ammo">' +
	// 	total_ammo + '</span> = <span class="fuelammo">' + (total_fuel + total_ammo) + '</span>' :
	// 	"";
	let cost_html = total_fuel + total_ammo > 0 ?
		'燃料<span class="fuel">' + total_fuel + '</span> 弾薬<span class="ammo">' +
		total_ammo + '</span><br>合計<span class="fuelammo">' + (total_fuel + total_ammo) + '</span>' :
		"";

	this.e_cost.innerHTML = cost_html;
	
	// this.e_cost_cell.innerHTML = cost_html;
	// this.e_accuracy_cell.textContent = total_accuracy;
	// this.e_accuracy_cell.classList.toggle("good", total_accuracy > 0);
}

/**
 * 目標表示を更新
 * 敵艦の情報が変化した場合など
 * @alias SupportFleet#refresh_target
 */
function SupportFleet_refresh_target(){
	for (let sup of this.support_ships) {
		sup.refresh(true);
	}
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
		ships.push(sup.get_ssd().get_json(false));
	}
	return {
		name: this.fleet_name,
		ships: ships,
	};
}

function SupportFleet_set_json(json){
	this.clear();
	this.set_fleet_name(json?.name ?? "");
	
	let ships = json && json.ships;
	if (!ships) return;
	
	for (let i=0; i<this.support_ships.length; i++) {
		let ssd = new SupportShipData();
		ssd.set_json(ships[i]);
		this.support_ships[i].set_ssd(ssd);
	}
	
	this.refresh_display();
}

function SupportFleet_call_onchange(){
	this.dispatchEvent(new CustomEvent("change", {detail: {fleet: this}}));
}

function SupportFleet_ev_click_batchset(_e, dd, not_dd){
	let tp = Util.formstr_to_float(this.e_targetpower.value, -1, -1);
	
	if (!tp.error) {
		for (let sup of this.support_ships) {
			if ((dd && sup.is_dd()) || (not_dd && !sup.is_dd())) {
				sup.set_target(this.e_engagement.selectedIndex, this.e_formation.selectedIndex, tp.value);
			}
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
	
	e.dataTransfer.setDragImage(sup.e_panel, x, y);
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

	let rect = e.currentTarget.getBoundingClientRect();
	let x = e.pageX - rect.left - window.scrollX;
	let y = e.pageY - rect.top - window.scrollY;
	
	e.dataTransfer.setDragImage(sup.e_equipment_rows[index + 1], x, y);
}

function SupportFleet_ev_dragover_equip(e, sup, index){
	if (!sup.is_index_available(index)) return;
	
	let drag = this.dragdata_provider.get_data();
	
	if (drag && drag.type == "support_ship_equipment" && (drag.sup != sup || drag.index != index)) {
		let sup_data = sup.get_slot_info(index);
		let drag_data = drag.sup.get_slot_info(drag.index);
		
		let copy = e.ctrlKey;
		// 入れ替え可能 or コピー可能(Ctrl)
		if ( (sup_data.equipable[drag_data.id] || drag_data.id == "") &&
			(copy || (drag_data.equipable[sup_data.id] || sup_data.id == "")) )
		{
			e.dataTransfer.dropEffect = copy ? "copy" : "move";
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

		// Ctrl押しながらでコピー、それ以外は入れ替え
		let copy = e.ctrlKey;
		
		if ( (sup_data.equipable[drag_data.id] || drag_data.id == "") &&
			(copy || (drag_data.equipable[sup_data.id] || sup_data.id == "")) )
		{
			sup_data.select.set_id_star(drag_data.id, drag_data.star);
			// formの変更なのでssdに通知
			sup.form_to_ssd();
			sup.refresh_equipstatus();
			sup.refresh_probs();

			if (!copy) {
				drag_data.select.set_id_star(sup_data.id, sup_data.star);
				drag.sup.form_to_ssd();
				drag.sup.refresh_equipstatus();
				drag.sup.refresh_probs();
			}

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


/**
 * 支援艦隊タブをコントロールするクラス
 * @extends {EventTarget}
 */
class SupportFleetTab extends EventTarget {
	// 設定
	shipcolumn = 2;
	alignment = 0; // 0:center, 1:left, 2:right
	// fleet_count は fleets.length
	// 表示列数
	fleetcolumn = 0;

	/**
	 * データ
	 * @type {SupportFleet[]}
	 */
	fleets = [];

	// DOM
	e_fleet_container;
	e_option_container;
	e_shipcolumn;
	e_alignment;
	e_fleetcount;

	// dragdrop
	dragdata_provider = new Util.DragdataProvider();

	static letters = "ABCDEFGHIJKLMNOP";
	static fleet_priors = [3, 6, 9];
	static other_prior = 12;
	static max_fleet_count = 8;


	constructor(fleet_container, option_container){
		super();

		this.e_fleet_container = fleet_container;
		this.e_option_container = option_container;

		// className
		fleet_container.classList.add("fleet_container");
		option_container.classList.add("fleet_display_option");

		// create option panel
		NODE(option_container, [
			EL("div.row", [
				this.e_shipcolumn = EL("div.button.shipcolumn"),
				this.e_alignment = EL("div.button.alignment"),
				this.e_fleetcount = EL("div.button.fleetcount", [_T("艦隊数設定")]),
			]),
		]);
		this.e_shipcolumn.addEventListener("click", e => this.toggleButton("shipcolumn"));
		this.e_alignment.addEventListener("click", e => this.toggleButton("alignment"));
		this.e_fleetcount.addEventListener("click", e => {
			let dialog = new FleetOptionDialog().create();
			dialog.fleet_count = this.fleets.length;
			dialog.column_count = this.fleetcolumn;
			dialog.names = this.fleets.map(fl => fl.get_fleet_name(true));
			dialog.resets = this.fleets.map(fl => false);

			dialog.show().then(result => {
				if (result == "ok") {
					this.setFleetCount(dialog.fleet_count);
					this.fleetcolumn = dialog.column_count;
					let names = dialog.names;
					let resets = dialog.resets;
					for (let i=0; i<names.length; i++) {
						this.fleets[i].set_fleet_name(names[i]);
						if (resets[i]) this.fleets[i].clear(this.getDefaultPriorityAt(i));
					}
					this.refreshArrangement();
					this.dispatchEvent(new CustomEvent("changeoption", {detail: {name: "fleetcount"}}));
				}
				dialog.dispose();
			});
		});

		// create default fleets
		this.setFleetCount(2);
		this.refreshArrangement();
	}
	/**
	 * index 艦隊目のデフォルト優先度
	 * @param {number} index 0が最初
	 */
	getDefaultPriorityAt(index){
		return SupportFleetTab.fleet_priors[index] ?? SupportFleetTab.other_prior;
	}
	/**
	 * 艦隊数を変更
	 * @param {number} count 
	 */
	setFleetCount(count){
		if (count > SupportFleetTab.max_fleet_count) debugger;

		for (let i=this.fleets.length; i<count; i++) {
			this.fleets[i] = new SupportFleet(SupportFleetTab.letters[i]);
			this.fleets[i].create("", this.getDefaultPriorityAt(i));
			this.fleets[i].set_draggable(this.dragdata_provider);
			SupportFleetTab.setEventTransfer(this.fleets[i], this, "change");
			SupportFleetTab.setEventTransfer(this.fleets[i], this, "click_target");
		}
		this.fleets.length = count;

		NODE(Util.remove_children(this.e_fleet_container), this.fleets.map(f => f.e_fleet_div));
	}

	clear(){
		for (let fleet of this.fleets) fleet.clear();
	}
	refresh_target(){
		for (let fleet of this.fleets) fleet.refresh_target();
	}
	refresh_display(){
		for (let fleet of this.fleets) fleet.refresh_display();
	}

	// 表示切り替えボタンをクリックした
	toggleButton(name){
		if (name == "shipcolumn") {
			this.shipcolumn = this.shipcolumn % 4 + 1;
		} else if (name == "alignment") {
			this.alignment = (this.alignment + 1) % 3;
		} else {
			debugger;
		}
		this.refreshArrangement();
		this.dispatchEvent(new CustomEvent("changeoption", {detail: {name: name}}));
	}
	/**
	 * オプションで設定する表示の適用
	 * オプションパネルの更新もする
	 */
	refreshArrangement(){
		let colspan = this.shipcolumn == 4 ? 6 : this.shipcolumn;
		for (let fl of this.fleets) {
			fl.set_column_count(colspan);
		}
		this.e_shipcolumn.textContent = colspan + "列";
		this.e_fleet_container.style.justifyContent = ["center", "left", "right"][this.alignment];
		this.e_alignment.textContent = ["中央", "左", "右"][this.alignment];
		let fixed = this.fleetcolumn > 0;
		this.e_fleet_container.style.gridTemplateColumns = fixed ? `repeat(${this.fleetcolumn}, auto)` : "";
		this.e_fleet_container.classList.toggle("autocolumn", !fixed);
	}

	setFleetsJson(json){
		let count = json?.length ?? 2;
		if (!(count >= 1)) count = 2;
		this.setFleetCount(count);
		for (let i=0; i<count; i++) {
			this.fleets[i].set_json(json?.[i]);
		}
	}
	getFleetsJson(){
		return this.fleets.map(f => f.get_json());
	}
	setOptionJson(json){
		let intval = (x, d, a, b) => {
			let v = Math.floor(x) || d;
			return v <= a ? a : v >= b ? b : v;
		};
		this.shipcolumn = intval(json?.shipcolumn, 2, 1, 4);
		this.alignment = intval(json?.alignment, 0, 0, 2);
		this.fleetcolumn = intval(json?.fleetcolumn, 0, 0, SupportFleetTab.max_fleet_count);
		this.refreshArrangement();
	}
	getOptionJson(){
		return {
			shipcolumn: this.shipcolumn,
			alignment: this.alignment,
			fleetcolumn: this.fleetcolumn,
		};
	}

	static setEventTransfer(child, parent, type){
		child.addEventListener( type, e => parent.dispatchEvent(new CustomEvent(e.type, {detail: e.detail})) );
	}
};


class FleetOptionDialog extends DOMDialog {
	get fleet_count(){
		return +this.e_fleet_count.value;
	}
	set fleet_count(n){
		this.e_fleet_count.value = n;
		this.setNamedivCount(n);
	}
	get column_count(){
		return +this.e_column_count.value;
	}
	set column_count(n){
		this.e_column_count.value = n;
	}
	get names(){
		return this.name_inputs.slice(0, this.fleet_count).map(input => input.value);
	}
	set names(arr){
		for (let i=0; i<this.name_inputs.length; i++) {
			this.name_inputs[i].value = arr[i] ?? "";
		}
	}
	get resets(){
		return this.reset_checkboxes.slice(0, this.fleet_count).map(input => input.checked);
	}
	set resets(arr){
		for (let i=0; i<this.reset_checkboxes.length; i++) {
			this.reset_checkboxes[i].checked = arr[i] ?? false;
		}
	}

	create(){
		super.create("modal", "艦隊数/艦隊名", true);
		this.e_inside.classList.add("fleetdialog");

		NODE(this.e_contents, [
			EL("div.countsrow.row", [
				EL("div.item", [
					_T("艦隊数 "),
					this.e_fleet_count = EL("select.fleetcount"),
				]),
				EL("div.item", [
					_T("表示列数 "),
					this.e_column_count = EL("select.columncount"),
				]),
			]),
			this.e_fleet_names = EL("div.fleetnames", [
				EL("div", [_T("艦隊名 / 艦隊のリセット")]),
			]),
			EL("div.comment", [
				_T("* 減らした分の艦隊のデータは消えます"),
			]),
			EL("div.toolbar", [
				this.e_ok = EL("button.ok", [_T("変更")]),
				this.e_cancel = EL("button.cancel", [_T("キャンセル")]),
			]),
		]);

		let name_rows = [];
		let name_inputs = [];
		let reset_checkboxes = [];
		const max_count = SupportFleetTab.max_fleet_count;

		this.e_column_count.appendChild(new Option("自動", 0));
		for (let i=0; i<max_count; i++) {
			let n = i + 1;
			let c = SupportFleetTab.letters[i];
			this.e_fleet_count.appendChild(new Option(n, n));
			this.e_column_count.appendChild(new Option(n, n));

			name_rows[i] = EL("div", [
				_T(n + ":"),
				name_inputs[i] = EL("input.fname", {type: "text", placeholder: "支援艦隊" + c, maxLength: 12}),
				EL("label", [
					reset_checkboxes[i] = EL("input", {type: "checkbox"}),
					_T("リセット"),
				]),
			]);
		}
		NODE(this.e_fleet_names, name_rows);
		this.name_rows = name_rows;
		this.name_inputs = name_inputs;
		this.reset_checkboxes = reset_checkboxes;

		this.e_fleet_count.value = 2;
		this.e_column_count.value = 0;
		this.setNamedivCount(2);

		this.e_fleet_count.addEventListener("change", e => this.setNamedivCount(this.fleet_count));
		this.add_dialog_button(this.e_ok, "ok");
		this.add_dialog_button(this.e_cancel, "cancel");
		this.addEventListener("show", e => this.move_to_center());

		return this;
	}

	setNamedivCount(count){
		for (let i=0; i<this.name_rows.length; i++) {
			// this.namerows[i].style.visibility = i < count ? "visible" : "hidden";
			this.name_rows[i].style.display = i < count ? "block" : "none";
		}
	}
};

