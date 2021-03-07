// 装備ボーナスデータを閲覧

import {DOM, NODE, TEXT, ELEMENT} from "./utility.mjs";
import * as Util from "./utility.mjs";
import {ShipSelector, ShipSelectorDialog} from "./kc_ship_selector.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {DOMDialog} from "./dom_dialog.mjs";

export {
	BonusViewer,
};


// BonusViewer -------------------------------------------------------------------------------------
// 結局tableが楽そう
class BonusViewer {
	// DOM
	e_container;
	e_data_div;
	ship_selector;
	// 装備ボーナスデータ
	bonus;
	// 装備可能かどうか
	// 装備不可能なものについてのデータが存在する場合がある
	equipables;
	
	constructor(container){
		if (container) this.create(container);
	}
	set_name(name){
		this.ship_selector.set_shipname(name);
		this.bonus.set_name(name);
		this.equipables.set_name(name);
		this.equipables.generate_equipables();
	}
};

Object.defineProperties(BonusViewer.prototype, {
	create : {value: BonusViewer_create},
	refresh: {value: BonusViewer_refresh},
	ev_change_ship: {value: BonusViewer_ev_change_ship},
});

Object.defineProperties(BonusViewer, {
	header_definition: {value: [
		{name: "名前", className: "indep_name", colSpan: 3},
		{name: "n個目", className: "nth"},
		{name: "改修値", className: "star"},
		{name: "火力", propName: "firepower", className: "param"},
		{name: "雷装", propName: "torpedo", className: "param"},
		//{name: "爆装", propName: "bombing", className: "param"}, // ない
		{name: "対空", propName: "antiair", className: "param"},
		{name: "対潜", propName: "ASW", className: "param"},
		{name: "索敵", propName: "LoS", className: "param"},
		{name: "命中", propName: "accuracy", className: "param"},
		{name: "回避", propName: "evasion", className: "param"},
		{name: "装甲", propName: "armor", className: "param"},
		{name: "射程", propName: "range", className: "param"},
	]},
});

Object.defineProperties(BonusViewer, {
	// パラメータ名
	// header_definition から生成するので分割
	param_keys: {value: BonusViewer.header_definition.reduce(
		(a, c) => {
			if (c.propName) a.push(c.propName);
			return a;
		}, []
	)},
});


function BonusViewer_create(container){
	this.e_container = container;
	this.ship_selector = new ShipSelector("popup", new ShipSelectorDialog().create());
	this.bonus = new EquipmentBonus("", false);
	this.equipables = new EquipableInfo("", false);
	
	NODE(this.e_container, [
		NODE(ELEMENT("div"), [
			NODE(ELEMENT("div.selector"), [
				this.ship_selector.e_shipname_div,
			]),
		]),
		
		this.e_table = NODE(ELEMENT("table", "", "bonus_viewer_table"), [
			this.e_thead = ELEMENT("thead"),
			this.e_indep_tbody = ELEMENT("tbody", "", "indep_tbody"),
			this.e_synergy_tbody = ELEMENT("tbody", "", "synergy_tbody"),
		]),
	]);
	
	// ヘッダーは作っておく
	let colSpan = BonusViewer.header_definition.reduce((a, c) => a + (c.colSpan || 1), 0);
	let thead_elems = BonusViewer.header_definition.map(def => ELEMENT("th", {
		textContent: def.name,
		className  : (def.className || "") + " " + (def.propName || ""),
		colSpan    : def.colSpan || 1,
	}));
	
	NODE(this.e_thead, [
		NODE(ELEMENT("tr", "", "header"), thead_elems),
	]);
	NODE(this.e_indep_tbody, [
		NODE(ELEMENT("tr", "", "header"), [
			ELEMENT("th", {className: "indep_header", textContent: "独立ボーナス", colSpan: colSpan}),
		]),
	]);
	NODE(this.e_synergy_tbody, [
		NODE(ELEMENT("tr", "", "header"), [
			ELEMENT("th", {className: "synergy_header", textContent: "シナジーボーナス", colSpan: colSpan}),
		]),
	]);
	
	// event
	this.ship_selector.addEventListener("change", e => this.ev_change_ship(e));
}


function BonusViewer_refresh(){
	// ヘッダー行を残してクリア
	let remove_rows = (tbody) => {
		while (tbody.rows.length >= 2) {
			tbody.removeChild(tbody.lastChild);
		}
	};
	remove_rows(this.e_indep_tbody);
	remove_rows(this.e_synergy_tbody);
	
	if (!this.bonus.bonus_data_array) return;
	
	
	let db_map = EquipmentDatabase.equipment_data_map;
	// パラメータ名リスト
	let props = BonusViewer.param_keys;
	
	let strings_to_cells = (strings) => {
		let out = [];
		for (let str of strings) {
			if (str === null) {
				if (out.length > 0) {
					out[out.length - 1].colSpan++;
				}
			} else {
				let td = ELEMENT("td");
				td.innerText = str;
				out.push(td);
			}
		}
		return out;
	};
	
	let is_same_bonus = (d, a, b) => {
		for (let i=0; i<props.length; i++) {
			if (d[props[i]][a] != d[props[i]][b]) return false;
		}
		return true;
	};
	
	
	let row_gens = [];
	for (let d of this.bonus.bonus_data_array) {
		let generator = new BonusRowGenerator();
		if (!generator.set_data(d, this.equipables)) continue;
		
		for (let gen of generator.split()) {
			// 合算モード
			for (let x of row_gens) {
				if (x.equal_type(gen)) {
					x.add(gen);
					gen = null;
					break;
				}
			}
			
			if (gen) row_gens.push(gen);
		}
	}
	row_gens = row_gens.filter(gen => !gen.empty());
	
	// ID順
	row_gens.sort((a, b) => a.compare_main_ids(b));
	
	let indep_row_gens = row_gens.filter(gen => gen.independent);
	let synergy_row_gens = row_gens.filter(gen => !gen.independent);
	let indep_rows = indep_row_gens.flatMap(gen => gen.create_rows());
	let synergy_rows = synergy_row_gens.flatMap(gen => gen.create_rows());
	
	NODE(this.e_indep_tbody, indep_rows);
	NODE(this.e_synergy_tbody, synergy_rows);
}

function BonusViewer_ev_change_ship(e){
	this.set_name(e.detail);
	this.refresh();
}


// BonusRowGenerator -------------------------------------------------------------------------------
// 結構ややこしいのでクラスにする
class BonusRowGenerator {
	// equipment_idの配列 (idは昇順/ないならnull)
	main_ids;
	sub1_ids;
	sub2_ids;
	// (temporary) ship id
	//ship_ids;
	// グループ化
	grouping;
	// 独立ボーナス
	independent;
	// n個目のデータ配列
	counts;
	// 改修値 -> パラメータ配列
	param_arrays;
	// ボーナスデータへの参照、addを使っても変化しない
	bonus_data;
	
	equal_type(b){
		return BonusRowGenerator.equal_array(this.main_ids, b.main_ids) &&
			BonusRowGenerator.equal_array(this.sub1_ids, b.sub1_ids) &&
			BonusRowGenerator.equal_array(this.sub2_ids, b.sub2_ids) &&
			this.grouping == b.grouping &&
			this.independent == b.independent &&
			BonusRowGenerator.equal_array(this.counts, b.counts);
	}
	
	compare_main_ids(b){
		let c = 0;
		let ilim = Math.max(this.main_ids.length, b.main_ids.length);
		for (let i=0; i<ilim; i++) {
			let a_id = this.main_ids[i] || 0;
			let b_id = b.main_ids[i] || 0;
			c = a_id - b_id;
			if (c != 0) return c;
		}
		return c;
	}
	
	
	static equal_array(a, b){
		if (!a && !b) return true;
		if (!a || !b || a.length != b.length) return false;
		for (let i=0; i<a.length; i++) {
			if (a[i] != b[i]) return false;
		}
		return true;
	}
};

Object.defineProperties(BonusRowGenerator.prototype, {
	clone          : {value: BonusRowGenerator_clone          },
	set_data       : {value: BonusRowGenerator_set_data       },
	split          : {value: BonusRowGenerator_split          },
	add            : {value: BonusRowGenerator_add            },
	create_rows    : {value: BonusRowGenerator_create_rows    },
	is_same_by_star: {value: BonusRowGenerator_is_same_by_star},
	empty          : {value: BonusRowGenerator_empty          },
});


function BonusRowGenerator_clone(){
	let clone_array = arr => (arr && arr.concat());
	
	let dup = new BonusRowGenerator();
	dup.main_ids = clone_array(this.main_ids);
	dup.sub1_ids = clone_array(this.sub1_ids);
	dup.sub2_ids = clone_array(this.sub2_ids);
	dup.grouping = this.grouping;
	dup.independent = this.independent;
	dup.counts = clone_array(this.counts);
	dup.param_arrays = this.param_arrays.map(v => Object.assign({}, v));
	dup.bonus_data = this.bonus_data;
	return dup;
}

function BonusRowGenerator_set_data(bonus_data, equipables){
	// あとで
	let is_eqab = id => {
		//return equipables.slot_equipables[0]?.[id] || equipables.exslot_equipable?.[id];
		return true;
	};
	let get_id_array = id_map => {
		if (!id_map) return null;
		let ids = [];
		id_map.forEach((c, i) => c && is_eqab(i) && ids.push(i));
		return ids.length > 0 ? ids : null;
	};
	
	this.main_ids = get_id_array(bonus_data.equipment_id_map);
	this.sub1_ids = get_id_array(bonus_data.subequip_map1);
	this.sub2_ids = get_id_array(bonus_data.subequip_map2);
	
	this.grouping = bonus_data.grouping;
	this.independent = bonus_data.independent();
	
	this.counts = [];
	for (let c=1; c<=6; c++) {
		if (bonus_data.count_bit & (1 << (c - 1))) {
			this.counts.push(c);
		}
	}
	
	// param_arrays[i][key] で、改修値 i の key パラメータを表す
	this.param_arrays = [];
	for (let i=0; i<=10; i++) {
		let pa = {};
		for (let key of BonusViewer.param_keys) {
			pa[key] = bonus_data[key][i];
		}
		this.param_arrays[i] = pa;
	}
	
	this.bonus_data = bonus_data;
	return this.main_ids != null;
}

function BonusRowGenerator_split(){
	// main_ids が複数あって、grouping でない場合は分割する
	let out = [];
	
	if (!this.grouping && this.main_ids.length >= 2) {
		for (let i=0; i<this.main_ids.length; i++) {
			let gen = this.clone();
			gen.main_ids[0] = this.main_ids[i];
			gen.main_ids.length = 1;
			out.push(gen);
		}
	} else {
		out.push(this);
	}
	
	return out;
}

function BonusRowGenerator_add(b){
	if (!this.equal_type(b)) debugger;
	
	for (let s=0; s<=10; s++) {
		let pa = this.param_arrays[s];
		let pb = b.param_arrays[s];
		
		for (let key of BonusViewer.param_keys) {
			pa[key] += pb[key];
		}
	}
}

// trの配列を返す
function BonusRowGenerator_create_rows(){
	let equip_name = id => {
		let data = EquipmentDatabase.equipment_data_map[id];
		return data ? Util.unescape_charref(data.name) : "";
	};
	let equip_name_list = (ids, def_text) => {
		if (def_text == "水上電探" || def_text == "対空電探" || def_text == "対空機銃") {
			return def_text;
		}
		if (ids) {
			return ids.map(id => equip_name(id)).join("\n");
		}
		return "";
	};
	
	let rows = [];
	
	for (let m=0; m<this.main_ids.length; m++) {
		let current_cells = [];
		
		// 名前
		if (this.independent) {
			current_cells.push( ELEMENT("td", {className: "indep_name", innerText: equip_name(this.main_ids[m]), colSpan: 3}) );
			
		} else {
			if (this.grouping) {
				let text = equip_name_list(this.main_ids, "");
				current_cells.push(ELEMENT("td", {className: "synergy_name", innerText: text}));
				current_cells.push(ELEMENT("td", "", "synergy_name"));
				current_cells.push(ELEMENT("td", "", "synergy_name"));
				
			} else {
				let sub1_text = equip_name_list(this.sub1_ids, this.bonus_data.line.subEquipCategories);
				let sub2_text = equip_name_list(this.sub2_ids, this.bonus_data.line.subEquipCategories2);
				current_cells.push( ELEMENT("td", {className: "synergy_name", innerText: equip_name(this.main_ids[m])}) );
				current_cells.push( ELEMENT("td", {className: "synergy_name", innerText: sub1_text}) );
				current_cells.push( ELEMENT("td", {className: "synergy_name", innerText: sub2_text}) );
			}
		}
		
		// nth
		let nth_text = 
			this.counts
			.map(c => ({begin: c, end: c+1}))
			.reduce((a, c) => {
				let back = a[a.length - 1];
				if (back && back.end == c.begin) { back.end = c.end; } else { a.push(c); }
				return a;
			}, [])
			.map(c => (
				c.begin == 1 && c.end - 1 == 6 ? "*" : 
				c.begin == c.end - 1 ? c.begin :
				  `${c.begin}~${c.end-1}`
			) )
			.join(",");
		
		current_cells.push( ELEMENT("td", {className: "nth", innerText: nth_text}) );
		
		// 改修, パラメータ
		let begin_s = 0;
		while (begin_s <= 10) {
			// 改修値 begin_s のボーナスと同一である範囲
			let end_s = begin_s + 1;
			for (; end_s<=10; end_s++) {
				if (!this.is_same_by_star(begin_s, end_s)) break;
			}
			// [begin_s, end_s - 1] が同一
			
			let cells = new Array;
			let star_str = (
				//begin_s == 0 && end_s - 1 == 10 ? "*" :
				begin_s == end_s - 1 ? `★${begin_s}` :
				  `★${begin_s}~${end_s-1}`
			);
			cells.push(ELEMENT("td", {className: "star", innerText: star_str}));
			
			for (let key of BonusViewer.param_keys) {
				let param = this.param_arrays[begin_s][key];
				let param_str = param > 0 ? "+" + param : param < 0 ? param : "";
				let cname = "param " + key;
				if (param < 0) cname += " minus";
				
				cells.push(ELEMENT("td", {className: cname, innerText: param_str}));
			}
			
			let tr;
			if (begin_s == 0) {
				tr = NODE(ELEMENT("tr"), current_cells.concat(cells));
			} else {
				current_cells.forEach(cell => cell.rowSpan = (cell.rowSpan || 1) + 1);
				tr = NODE(ELEMENT("tr"), cells);
			}
			rows.push(tr);
			
			begin_s = end_s;
		}
		
		if (this.grouping) break;
	}
	
	return rows;
}

function BonusRowGenerator_is_same_by_star(a, b){
	for (let key of BonusViewer.param_keys) {
		if (this.param_arrays[a][key] != this.param_arrays[b][key]) {
			return false;
		}
	}
	return true;
}

function BonusRowGenerator_empty(){
	if (this.main_ids.length == 0) return true;
	
	for (let i=0; i<=10; i++) {
		for (let key of BonusViewer.param_keys) {
			if (this.param_arrays[i][key] != 0) {
				return false;
			}
		}
	}
	
	return true;
}

