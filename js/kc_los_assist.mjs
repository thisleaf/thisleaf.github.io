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
	LOS_EQUIPBONUS,
} from "./kc_los_global.mjs";
import {
	DOM,
	ELEMENT,
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


export {
	init_assist,
	recreate_chara_name,
	recreate_chara_name_by_form,
	recreate_ship_select,
	recreate_ship_select_by_form,
	get_assist_los,
	get_assist_los_bonus,
	refresh_assist_los,
	refresh_bonus_info,
};


// 艦種リスト
// この表示順になる、ここにないものは最後尾
// keys に配列を指定すると viewname に置き換える
const ASSIST_GROUPING_DEF = [
	{viewname: "戦艦"},
	{viewname: "航空戦艦", keys: ["航空戦艦", "改装航空戦艦"]},
	{viewname: "正規空母", keys: ["正規空母", "装甲空母"]},
	{viewname: "軽空母"},
	
	{viewname: "重巡洋艦"},
	{viewname: "航空巡洋艦"},
	{viewname: "軽巡洋艦", keys: ["軽巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦", "兵装実験軽巡"]},
	{viewname: "重雷装巡洋艦"},
	{viewname: "練習巡洋艦"},

	{viewname: "駆逐艦 (神風型)"},
	{viewname: "駆逐艦 (睦月型)"},
	{viewname: "駆逐艦 (吹雪型)"},
	{viewname: "駆逐艦 (綾波型)"},
	{viewname: "駆逐艦 (暁型)"},
	{viewname: "駆逐艦 (初春型)"},
	{viewname: "駆逐艦 (白露型)", keys: ["駆逐艦 (白露型)", "駆逐艦 (改白露型)"]},
	{viewname: "駆逐艦 (朝潮型)"},
	{viewname: "駆逐艦 (陽炎型)"},
	{viewname: "駆逐艦 (夕雲型)"},
	{viewname: "駆逐艦 (秋月型)"},
	{viewname: "駆逐艦 (島風型)"},
	{viewname: "駆逐艦 (海外艦)"},

	{viewname: "海防艦"},
	
	{viewname: "潜水艦", keys: ["潜水艦", "潜水空母"]},
	{viewname: "水上機母艦"},
	{viewname: "補給艦"},
	
	{viewname: "潜水母艦"},
	{viewname: "揚陸艦"},
	{viewname: "工作艦"},
];

// 駆逐艦 (海外艦) に分類される型名
const ASSIST_GROUPING_FOREIGN_DD = [
	"J級",
	"Z1型",
	"Maestrale級",
	"Ташкент級",
	"John C.Butler級",
	"Fletcher級",
];

// これに追加しておくとデフォルトの改造度選択が変わる
const DEFAULT_SELECT_SHIPS = [
	"夕張改二特"
];


// csvデータ
let csv_shiplist = null;
let csv_equiplist = null;

// ASSIST_GROUPING_DEFから生成
// keysで指定された置換先
let grouping_replacer = new Object;

// 現在の艦名→データ
let shipname_map = new Object;
// 現在の艦名→改造前データ
let shipbefore_map = new Object;

// キャラごとのデータ
let character_data = new Array;
// 艦のタイプで分類
let charagroup_data = new Array;
let charagroup_map = new Object;


// class -------------------------------------------------------------------------------------------
Object.assign(Character.prototype, {
	// 最初の改造段階の名前など
	name: "",
	className: "",
	// データ　改造順
	ships: null,
});

function Character(ship){
	this.ships = new Array;
	
	if (ship) {
		this.name = ship.name;
		this.className = ship.className;
		this.ships.push(ship);
	}
}


// キャラと艦情報のペア
// 艦からキャラを参照する場合などに
function CharacterShip(chara, ship){
	this.character = chara;
	this.ship = ship;
}


Object.assign(Charagroup.prototype, {
	group_name: "",
	// CharacterShip(キャラ, 初期選択艦名) の配列
	cslist: null,
	// 未改造の艦種と一致していないもの
	sub_cslist: null,
});

function Charagroup(name){
	this.group_name = name;
	// charactershipの配列
	this.cslist = new Array;
	this.sub_cslist = new Array;
}



// 入力補助β初期化 --------------------------------------------------------------------------------
function init_assist(arg_csv_shiplist, arg_csv_equiplist){
	csv_shiplist = arg_csv_shiplist;
	csv_equiplist = arg_csv_equiplist;
	
	// grouping_replacer
	for (let x of ASSIST_GROUPING_DEF) {
		if (x.keys) {
			for (let name of x.keys) {
				grouping_replacer[name] = x.viewname;
			}
		}
	}
	
	for (let ship of csv_shiplist) {
		// 索敵値が入力されていないものは無視
		if (!shiplos_available(ship)) continue;
		
		shipname_map[ship.name] = ship;
		
		// 改造可能
		if (ship.upgrade && /^(.+)\((\d+)\)$/.test(ship.upgrade)) {
			let name = RegExp.$1;
			//let level = RegExp.$2;
			shipbefore_map[name] = ship;
		}
	}
	
	
	for (let ship of csv_shiplist) {
		if (!shiplos_available(ship)) continue;
		
		if (!shipbefore_map.hasOwnProperty(ship.name)) {
			// 改造元がない
			let chara = new Character(ship);
			
			let s = ship;
			for (let j=0; j<20; j++) {
				// s の改造先を登録
				if (s.upgrade && /^(.+)\((\d+)\)$/.test(s.upgrade)) {
					s = shipname_map[RegExp.$1];
					
					if (!s) break;
					if (chara.ships.findIndex(x => x == s) >= 0) break;
					
					chara.ships.push(s);
					
				} else {
					break;
				}
			}
			
			character_data.push(chara);
			
			// 艦型への登録
			// 途中で艦種が変わる場合は複数登録する
			// 基本的に最終段階だが、別途指定されている場合はそっち
			let append_list = new Object;
			let last_key = get_shipgroup_name(chara.ships[chara.ships.length - 1]);
			
			for (let j=0; j<chara.ships.length; j++) {
				let ship = chara.ships[j];
				let key = get_shipgroup_name(ship);
				
				let dt = append_list[key];
				if (!dt) {
					dt = {
						//first_type: j == 0,   // 未改造のタイプと一致
						last_type: key == last_key, // 最終改造のタイプと一致
						ships: new Array,     // 艦リスト
						specified_ship: null, // DEFAULT_SELECT_SHIPSで指定されている
					};
					append_list[key] = dt;
				}
				
				dt.ships.push(ship);
				if (DEFAULT_SELECT_SHIPS.findIndex(name => name == ship.name) >= 0) {
					dt.specified_ship = ship;
				}
			}
			
			for (let key in append_list) {
				let dt = append_list[key];
				let ship = dt.specified_ship || dt.ships[dt.ships.length - 1];
				
				let cgrp = charagroup_map[key];
				if (!cgrp) {
					cgrp = new Charagroup(key);
					charagroup_data.push(cgrp);
					charagroup_map[key] = cgrp;
				}
				
				let cs = new CharacterShip(chara, ship);
				if (dt.last_type) {
					cgrp.cslist.push(cs);
				} else {
					cgrp.sub_cslist.push(cs);
				}
			}
		}
	}
	
	// charagroup_dataのソート
	let ordering = ASSIST_GROUPING_DEF.map(x => x.viewname);
	
	charagroup_data.sort(function (a, b){
		let ia = ordering.indexOf(a.group_name);
		let ib = ordering.indexOf(b.group_name);
		
		if (ia >= 0 && ib >= 0) {
			return ia - ib;
			
		} else if (ia >= 0 || ib >= 0) {
			// どっちかが-1なので反転させればよい
			return -(ia - ib);
			
		} else {
			// 辞書順
			return a.group_name < b.group_name ? -1 : a.group_name == b.group_name ? 0 : 1;
		}
	});
	
	// N番艦でソートしようかと思ったが艦型が混ざっていて面倒になったやつ
/*
	function _class_name(x){
		return (x.className == "改白露型" ? "白露型" : x.className);
	}
	function _class_number(x){
		return (
			x.classNumber == "" ? 100000 :
			x.className == "改白露型" ? Number(x.classNumber) + 6 :
			  Number(x.classNumber)
		);
	}
	function _number_sorter(a, b){
		return _class_number(a.ship) - _class_number(b.ship);
	}
	function _namenumber_sorter(a, b){
		let aname = _class_name(a.ship);
		let bname = _class_name(b.ship);
		return (
			aname < bname ? -1 :
			aname > bname ? 1  :
			  _class_number(a.ship) - _class_number(b.ship)
		);
	}
	
	for (let cgr of charagroup_data) {
		cgr.cslist.sort(_namenumber_sorter);
		cgr.sub_cslist.sort(_namenumber_sorter);
	}
*/
	
	
	let e_chara_name = DOM("chara_name");
	let e_chara_restriction = DOM("chara_restriction");
	let e_ship_select = DOM("ship_select");
	
	recreate_chara_name(null, true, null);
	recreate_ship_select_by_form();
	
	// 艦種絞り込み
	remove_children(e_chara_restriction);
	
	let rs = new Option("- 艦種絞り込み", "");
	e_chara_restriction.appendChild(rs);
	
	for (let i=0; i<charagroup_data.length; i++) {
		let rs = new Option(charagroup_data[i].group_name, charagroup_data[i].group_name);
		e_chara_restriction.appendChild(rs);
	}
	
	// 最終更新日
	let last_modified = get_csv_last_modified(csv_shiplist);
	let th = DOM("assist_header");
	if (last_modified && th) {
		th.title = "データの最終更新日: " + strYMD(last_modified);
	}
	
	// イベントの設定
	e_chara_name.addEventListener("change", ev_change_chara_name);
	e_chara_restriction.addEventListener("change", ev_change_chara_restriction);
	e_ship_select.addEventListener("change", ev_change_ship_select);
	DOM("ship_level").addEventListener("change", ev_change_level);
	DOM("equip_bonus").addEventListener("change", ev_change_bonus);
	DOM("append_assist_los").addEventListener("click", ev_click_append_los);
	
	refresh_assist_los();
	refresh_bonus_info();
}

// 艦から
function get_shipgroup_name(ship){
	let key = ship.shipType;
	
	if (key == "駆逐艦") {
		// 駆逐艦は数が多いので型で分類
		if (ASSIST_GROUPING_FOREIGN_DD.findIndex(x => x == ship.className) >= 0) {
			// 海外艦
			key += " (海外艦)";
		} else {
			key += " (" + ship.className + ")";
		}
	}
	
	if (grouping_replacer.hasOwnProperty(key)) {
		key = grouping_replacer[key];
	}
	
	return key;
}

// 索敵値が利用可能か
function shiplos_available(ship){
	return ship.LoS0 != "" && ship.LoS99 != "";
}


// イベント ----------------------------------------------------------------------------------------
function ev_change_chara_name(){
	recreate_ship_select_by_form();
	refresh_assist_los();
	refresh_bonus_info();
}

function ev_change_chara_restriction(){
	recreate_chara_name_by_form();
	refresh_assist_los();
	refresh_bonus_info();
}

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
// キャラリストを再生成
// 艦名リストも更新
// selectのvalueは キャラ名,艦名
// キャラ名は未改造のときの艦名、艦名はデフォルトの選択肢
// restrict_classes: 型名による制限
// grouping: optgroupをつくる
function recreate_chara_name(restrict_classes, grouping, new_value){
	let e_chara_name = DOM("chara_name");
	let old_value = e_chara_name.value;
	let found_old_value = false;
	
	remove_children(e_chara_name);
	
	for (let i=0; i<charagroup_data.length; i++) {
		if (restrict_classes) {
			if (restrict_classes.indexOf(charagroup_data[i].group_name) < 0) {
				continue;
			}
		}
		
		let parent, group_name;
		let count = 0;
		
		if (grouping) {
			parent = document.createElement("optgroup");
			parent.label = charagroup_data[i].group_name;
			group_name = charagroup_data[i].group_name;
		} else {
			parent = e_chara_name;
			group_name = "";
		}
		
		function _create(list, bk){
			for (let i=0; i<list.length; i++) {
				let name = list[i].character.name;
				let value = list[i].character.name + "," + list[i].ship.name;
				if (bk) name = "(" + name + ")";
				
				parent.appendChild(new Option(name, value));
				
				if (value == old_value) {
					found_old_value = true;
				}
				count++;
			}
		}
		
		_create(charagroup_data[i].cslist, false);
		_create(charagroup_data[i].sub_cslist, true);
		
		if (grouping && count > 0) {
			e_chara_name.appendChild(parent);
		}
	}
	
	if (new_value || found_old_value) {
		e_chara_name.value = new_value ? new_value : old_value;
	} else {
		e_chara_name.selectedIndex = 0;
	}
	
	recreate_ship_select_by_form();
}


function recreate_chara_name_by_form(){
	let e_rest = DOM("chara_restriction");
	let restrict = e_rest.value ? [e_rest.value] : null;
	recreate_chara_name(restrict, !restrict);
}


// 艦名リスト
function recreate_ship_select(chara_name, select_name){
	let e_ship_select = DOM("ship_select");
	let chara = character_data.find(x => x.name == chara_name);
	
	if (!chara) {
		console.log("ないぽい:", chara_name);
		return;
	}
	
	remove_children(e_ship_select);
	
	for (let i=0; i<chara.ships.length; i++) {
		e_ship_select.appendChild(new Option(chara.ships[i].name, chara.ships[i].name));
		
		if (chara.ships[i].name == select_name) {
			e_ship_select.selectedIndex = i;
		}
	}
}


// フォームを読み取って艦名リスト更新
function recreate_ship_select_by_form(){
	let e_chara_name = DOM("chara_name");
	if (/,/.test(e_chara_name.value)) {
		recreate_ship_select(RegExp.leftContext, RegExp.rightContext);
	}
}


// 入力補助の艦娘索敵値
// ボーナスは含まない
// エラーは負数
function get_assist_los(){
	let e_level = DOM("ship_level");
	let level = formstr_to_int(e_level.value, -1, -1);
	
	let ship_name = DOM("ship_select").value;
	let ship = shipname_map[ship_name];
	
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
	let select_name = DOM("ship_select").value;
	let select_ship = shipname_map[select_name];
	if (select_name == refresh_bonus_info.showing_name || !select_ship) return;
	
	// shipType
	
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
		if (info.ship_types && info.ship_types.indexOf(select_ship.shipType) >= 0) {
			effect = true;
		}
		if (!effect) continue;
		
		// infoのボーナスが有効
		let params = new Array(11);
		if (typeof info.LoS == "number") {
			params.fill(info.LoS);
		} else {
			for (let i=0; i<=10; i++) {
				params[i] = info.LoS(i);
			}
		}
		
		let obj = {info: info, params: params};
		// 合算可能なら合算する
		for (let b of bonus_list) {
			if (_show_total(b, obj)) {
				for (let i=0; i<=10; i++) {
					b.params[i] += params[i];
				}
				continue INFO;
			}
		}
		
		bonus_list.push(obj);
	}
	
	// 合算条件
	function _show_total(a, b){
		return (
			   a.info.equipment_id == b.info.equipment_id
			&& a.info.accumulation == b.info.accumulation
			&& a.info.effect == b.info.effect
			&& a.params.indexOf(null) < 0
			&& b.params.indexOf(null) < 0
		);
	}
	
	// 表示
	let cell = DOM("bonus_info");
	remove_children(cell);
	
	if (bonus_list.length >= 1) {
		for (let b of bonus_list) {
			// 装備
			let eq = csv_equiplist.find(x => +x.number == b.info.equipment_id);
			if (!eq) {
				console.log("装備IDが不正", b.info.equipment_id);
				continue;
			}
			
			let div = document.createElement("div");
			div.textContent = unescape_charref(eq.name) + ": ";
			
			if (b.params.some(x => x !== b.params[0])) {
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
				
			} else {
				// どの改修値でも同じ
				let span = document.createElement("span");
				span.textContent = "索敵+" + b.params[0];
				div.appendChild(span);
			}
			
			let text = " / 累積" + b.info.accumulation;
			text += " / " + b.info.effect;
			if (b.info.text) text += " / " + b.info.text;
			
			div.appendChild(document.createTextNode(text));
			
			cell.appendChild(div);
		}
		
	} else {
		cell.textContent = "装備ボーナス情報はありません";
	}
	
	refresh_bonus_info.showing_name = select_name;
}


