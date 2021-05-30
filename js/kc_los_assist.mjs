// 入力補助β

import {
	IGNORE_CATEGORIES,
	HINT_TABLE_CATEGORY_DEF,
	LOS_FACTOR_DEF,
	LOS_FACTOR_OTHER,
	LOS_CATEGORY_OTHER_ID,
	LOS_CATEGORIES_DEF,
	SHIP_COUNT_MAX,
	EQUIPMENT_ROW_DEFAULT,
	EQUIPMENT_ROW_MIN,
	EQUIPMENT_ROW_MAX,
	EQUIPMENT_ROW_EACH,
	NULL_ID,
	DIRECT_INPUT_ID,
	LOS_EQUIPBONUS_LASTMOD,
	LOS_EQUIPBONUS,
} from "./kc_los_global.mjs";
import {
	DOM,
	ELEMENT,
	NODE,
	TEXT,
	remove_children,
	get_csv_last_modified,
	strYMD,
	formstr_to_int,
	formstr_to_float,
	unescape_charref,
	DragdataProvider,
} from "./utility.mjs";
import {
	refresh_score,
} from "./kc_los.mjs";
import {
	save_losdata,
} from "./kc_los_io.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import {DOMDialog} from "./dom_dialog.mjs";
import {ShipSelector, ShipSelectorDialog} from "./kc_ship_selector.mjs";

export {
	init_assist,
};


// csvデータ
let csv_equiplist = null;

let ship_selector = null;
let bonus_showing_name = "";


// 入力補助β初期化 --------------------------------------------------------------------------------
function init_assist(arg_csv_shiplist, arg_csv_equiplist){
	DOMDialog.initialize();
	ShipSelector.initialize(arg_csv_shiplist, null, null, shiplos_available);

	ship_selector = new ShipSelector("popup", new ShipSelectorDialog().create());
	let e_cell = DOM("assist_ship_cell");
	e_cell.insertBefore(ship_selector.e_shipname_div, e_cell.firstElementChild);

	csv_equiplist = arg_csv_equiplist;
	
	// 最終更新日
	let lastmod_text = "";
	let last_modified = get_csv_last_modified(arg_csv_shiplist);
	if (last_modified) {
		lastmod_text += "艦娘データ: " + strYMD(last_modified) + "\n";
	}
	if (LOS_EQUIPBONUS_LASTMOD) {
		lastmod_text += "装備ボーナス: " + LOS_EQUIPBONUS_LASTMOD + "\n";
	}
	
	let th = DOM("assist_header");
	if (th && lastmod_text) {
		th.title = "最終更新日\n" + lastmod_text;
	}
	
	// イベントの設定
	ship_selector.addEventListener("change", ev_change_ship_select)
	DOM("ship_level").addEventListener("change", ev_change_level);
	DOM("equip_bonus").addEventListener("change", ev_change_bonus);
	DOM("append_assist_los").addEventListener("click", ev_click_append_los);
	
	refresh_assist_los();
	refresh_bonus_info();
}

// 索敵値が利用可能か
function shiplos_available(ship){
	return ship.LoS0 != "" && ship.LoS99 != "";
}


// イベント ----------------------------------------------------------------------------------------
function ev_change_ship_select(){
	refresh_assist_los();
	refresh_bonus_info();
}

function ev_change_level(){
	refresh_assist_los();
}

function ev_change_bonus(){
	refresh_assist_los();
}

function ev_click_append_los(){
	let los = get_assist_los();
	let bonus = get_assist_los_bonus();
	if (los < 0 && bonus < 0) return;
	
	// 空き枠に追加
	// 0は空きとみなす、エラーはスルー
	for (let i=1; i<=SHIP_COUNT_MAX; i++) {
		let e = DOM("ship_los_" + i);
		
		if (formstr_to_int(e.value, 0, -1).value == 0) {
			e.value = los + bonus;
			break;
		}
	}
	
	refresh_score();
	save_losdata();
}


// DOM ---------------------------------------------------------------------------------------------
// 入力補助の艦娘索敵値
// ボーナスは含まない
// エラーは負数
function get_assist_los(){
	let e_level = DOM("ship_level");
	let level = formstr_to_int(e_level.value, -1, -1);
	
	// let ship_name = DOM("ship_select").value;
	// let ship = shipname_map[ship_name];
	let ship = ship_selector.get_ship();
	
	if (level.value <= 0 || !ship) return -1;
	
	let los0 = +ship.LoS0;
	let los99 = +ship.LoS99;
	return Math.floor(los0 + (los99 - los0) * level.value / 99);
}


// 装備ボーナス値
// エラーは負数
function get_assist_los_bonus(){
	let e_bonus = DOM("equip_bonus");
	let bonus = formstr_to_int(e_bonus.value, 0, -1);
	return bonus.value;
}


function refresh_assist_los(){
	let los = get_assist_los();
	let bonus = get_assist_los_bonus();
	let text = "";
	
	if (los >= 0 && bonus >= 0) {
		text = los + bonus;
		if (bonus > 0) {
			text += " (" + los + "+" + bonus + ")";
		}
	}
	
	DOM("assist_los").textContent = text;
}


// 装備ボーナス情報を更新
// 現在表示中の場合は更新しない
function refresh_bonus_info(){
	let select_name = ship_selector.get_shipname();
	if (select_name == bonus_showing_name) return;
	bonus_showing_name = select_name;
	
	let cell = DOM("bonus_info");
	remove_children(cell);
	
	let select_ship = ship_selector.get_ship();
	if (!select_ship) return;
	
	let jp_def = EquipmentDatabase.init_jp_def();
	
	// shipType
	let st = select_ship.shipTypeI || select_ship.shipType;
	
	let bonus_list = new Array;
	
	INFO:
	for (let info of LOS_EQUIPBONUS) {
		if (info.ignore_ship_names && info.ignore_ship_names.indexOf(select_name) >= 0){
			continue;
		}
		let effect = false;
		if (info.ship_names && info.ship_names.indexOf(select_name) >= 0) {
			effect = true;
		}
		if (info.ship_types && info.ship_types.indexOf(st) >= 0) {
			effect = true;
		}
		if (info.jp_ship_types && jp_def[select_ship.className] && info.jp_ship_types.indexOf(st) >= 0) {
			effect = true;
		}
		if (info.ship_classes && info.ship_classes.includes(select_ship.className)) {
			effect = true;
		}
		if (!effect) continue;
		
		// infoのボーナスが有効
		let obj = {info: info};
		
		if (info.LoS) {
			let params = new Array(11);
			if (typeof info.LoS == "number") {
				params.fill(info.LoS);
			} else if (info.LoS instanceof Array) {
				params.fill(null);
				let lim = Math.min(info.LoS.length, params.length);
				for (let i=0; i<lim; i++) {
					if (typeof info.LoS[i] == "number") params[i] = info.LoS[i];
				}
			} else if (info.LoS instanceof Function) {
				for (let i=0; i<=10; i++) {
					params[i] = info.LoS(i);
				}
			}
			
			obj.params = params;
			
			// 合算可能なら合算する
			for (let b of bonus_list) {
				if (_show_total(b, obj)) {
					for (let i=0; i<=10; i++) {
						b.params[i] += params[i];
					}
					continue INFO;
				}
			}
			
		} else if (info.LoS_mul) {
			// 積んだ数によって異なる
			obj.multiple = info.LoS_mul;
			
		} else {
			continue INFO;
		}
		
		bonus_list.push(obj);
	}
	
	// 合算条件
	function _show_total(a, b){
		return (
			   a.info.equipment_id == b.info.equipment_id
			&& a.viewname == b.viewname
			&& equal_array(a.equipment_id_list, b.equipment_id_list)
			&& a.info.accumulation == b.info.accumulation
			&& a.info.effect == b.info.effect
			&& a.params
			&& b.params
			&& a.params.indexOf(null) < 0
			&& b.params.indexOf(null) < 0
		);
	}
	function equal_array(a, b){
		if (!a && !b) return true;
		if (!a || !b || a.length != b.length) return false;
		for (let i=0; i<a.length; i++) {
			if (a[i] != b[i]) return false;
		}
		return true;
	}
	
	// 表示
	if (bonus_list.length >= 1) {
		for (let b of bonus_list) {
			let div;

			// 装備名
			if (b.info.equipment_id_list) {
				let options = b.info.equipment_id_list.map(id => {
					let eq = csv_equiplist.find(x => +x.number == id);
					if (!eq) {
						console.log("装備IDが不正", b.info.equipment_id);
						return null;
					}
					return new Option(eq.name);
				});
				let name = b.info.viewname ? unescape_charref(b.info.viewname) + " " : "";
				div = NODE(ELEMENT("div"), [
					NODE(ELEMENT("span.assist_weapon"), [TEXT(unescape_charref(name))]),
					NODE(ELEMENT("select.nameinfo"), options),
					TEXT(": "),
				]);

			} else {
				let eq = csv_equiplist.find(x => +x.number == b.info.equipment_id);
				if (!eq) {
					console.log("装備IDが不正", b.info.equipment_id);
					continue;
				}
				div = NODE(ELEMENT("div"), [
					NODE(ELEMENT("span.assist_weapon"), [TEXT(unescape_charref(eq.name))]),
					TEXT(": "),
				]);
			}
			
			if (b.params && b.params.some(x => x !== b.params[0])) {
				// selectを作って表示する
				let select = ELEMENT("select");
				
				for (let i=0; i<=10; i++) {
					// nullが返ってきたものは情報なし
					if (b.params[i] !== null) {
						let text = "★" + i + ": 索敵+" + b.params[i];
						select.appendChild(new Option(text, b.params[i]));
					}
				}
				div.appendChild(select);
				
			} else if (b.multiple) {
				// これもselect
				let select = ELEMENT("select");
				
				for (let i=0; i<b.multiple.length; i++) {
					let text = (i + 1) + "個: 索敵+" + b.multiple[i];
					select.appendChild(new Option(text, b.multiple[i]));
				}
				div.appendChild(select);
				
			} else {
				// どの改修値でも同じ
				let span = document.createElement("span");
				span.textContent = "索敵+" + b.params[0];
				div.appendChild(span);
			}
			
			let text = "";
			if (!b.multiple) text += " / 累積" + b.info.accumulation;
			text += " / " + b.info.effect;
			if (b.info.text) text += " / " + b.info.text;
			
			div.appendChild(document.createTextNode(text));
			
			cell.appendChild(div);
		}
		
	} else {
		cell.textContent = "装備ボーナス情報はありません";
	}
}


