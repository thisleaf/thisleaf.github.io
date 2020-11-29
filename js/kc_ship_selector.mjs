// 艦名のselectを管理
/*
	使用する前に ShipSelector.initialize(艦データ [, ...]) を呼ぶ
	ShipSelector がメイン
*/

import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT} from "./utility.mjs";

export {
	Character,
	CharacterShip,
	Shipgroup,
	ShipSelector,
};


// 艦種リスト(default)
// この表示順になる、ここにないものは最後尾
// keys に配列を指定すると viewname に置き換える
const SHIP_GROUPING_DEF = [
	{viewname: "戦艦"},
	{viewname: "航空戦艦", keys: ["航空戦艦", "改装航空戦艦"]},
	{viewname: "正規空母", keys: ["正規空母", "装甲空母", "夜間作戦航空母艦", "近代化航空母艦"]},
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
	{viewname: "駆逐艦 (陽炎型)", keys: ["駆逐艦 (改陽炎型)", "陽字号駆逐艦"]},
	{viewname: "駆逐艦 (夕雲型)"},
	{viewname: "駆逐艦 (秋月型)"},
	{viewname: "駆逐艦 (島風型)"},
	{viewname: "駆逐艦 (松型)"},
	{viewname: "駆逐艦 (海外艦)"},

	{viewname: "海防艦"},
	
	{viewname: "潜水艦", keys: ["潜水艦", "潜水空母"]},
	{viewname: "水上機母艦"},
	{viewname: "補給艦"},
	
	{viewname: "潜水母艦"},
	{viewname: "揚陸艦"},
	{viewname: "工作艦"},
];

// "駆逐艦 (海外艦)" に分類される型名
const SHIP_GROUPING_FOREIGN_DD = [
	"J級",
	"Z1型",
	"Maestrale級",
	"Ташкент級",
	"John C.Butler級",
	"Fletcher級",
];

// キャラ名の定義
// 通常は未改造の名前が使われる
// {viewname: 表示名, basename: 未改造名}
const CHARACTER_NAME_DEF = [
	{viewname: "Italia/Littorio", basename: "Littorio"},
	{viewname: "大鷹/春日丸", basename: "春日丸"},
	{viewname: "龍鳳/大鯨", basename: "大鯨"},
	{viewname: "呂500/U-511", basename: "U-511"},
	{viewname: "伊504/UIT-25/Luigi Torelli", basename: "Luigi Torelli"},
];

// これに追加しておくとデフォルトの改造度選択が変わる
const DEFAULT_SELECT_SHIPS = [
	"夕張改二特"
];


// Character ---------------------------------------------------------------------------------------
// キャラクターを表す
// 各改造段階ごとの艦データをもつ
Object.assign(Character.prototype, {
	// 最初の改造段階の名前
	original_name: "",
	original_className: "",
	// 艦データ　改造順
	ships: null,
});

function Character(orig_ship){
	this.ships = new Array;
	
	if (orig_ship) {
		this.original_name = orig_ship.name;
		this.original_className = orig_ship.className;
		this.ships.push(orig_ship);
	}
}


// CharacterShip -----------------------------------------------------------------------------------
// キャラクターと艦情報のペア
// 艦からキャラクターを参照する場合などに使用
function CharacterShip(chara, ship){
	this.character = chara;
	this.ship = ship;
}


// Shipgroup --------------------------------------------------------------------------------------
// 艦の集合
// キャラ情報も使うことが多いはずなので、CharacterShip の配列を要素とするものとする
Object.assign(Shipgroup.prototype, {
	// このグループの名前
	group_name: "",
	// リストとサブリスト。CharacterShip の配列
	cslist: null,
	sub_cslist: null,
});

function Shipgroup(name){
	if (name) this.group_name = name;
	this.cslist = new Array;
	this.sub_cslist = new Array;
}


// ShipSelector ------------------------------------------------------------------------------------
// DOM要素を管理
Object.assign(ShipSelector.prototype, {
	/* EventTargetを継承
		change: ユーザーによってフォームが変更された detailに艦名
	*/
	
	// "-" (なし) を選択肢に出現させる
	empty_option: true,
	
	// DOM
	e_class_select: null,
	e_chara_select: null,
	e_ship_select : null,
	
	// method
	recreate_class_select: ShipSelector_recreate_class_select,
	recreate_chara_select: ShipSelector_recreate_chara_select,
	recreate_ship_select : ShipSelector_recreate_ship_select,
	
	recreate_chara_select_by_form: ShipSelector_recreate_chara_select_by_form,
	recreate_ship_select_by_form : ShipSelector_recreate_ship_select_by_form,
	
	// 現在選択されている艦の名前など
	get_classname: ShipSelector_get_classname,
	get_charaname: ShipSelector_get_charaname,
	get_shipname : ShipSelector_get_shipname,
	get_ship     : ShipSelector_get_ship,
	empty        : ShipSelector_empty,
	swap_data    : ShipSelector_swap_data,
	
	// 艦名などをセット
	set_shipname: ShipSelector_set_shipname,
	
	// イベント
	ev_change_class: ShipSelector_ev_change_class,
	ev_change_chara: ShipSelector_ev_change_chara,
	ev_change_ship : ShipSelector_ev_change_ship,
	
	// onchange を呼ぶ
	call_onchange: ShipSelector_call_onchange,
	
	// DOMイベントによって変更された場合に callback
	//onchange: null,
});

// 後方互換
// 引数の扱いが異なる
Object.defineProperties(ShipSelector.prototype, {
	onchange: {
		set: function (func){
			if (func) this.addEventListener("change", e => func(e.detail));
		},
	},
});

Object.assign(ShipSelector, {
	// initialize() を呼ぶことでセットされる
	// ShipSelector 以外で扱う場合は const として扱うこと
	grouping_def          : null,
	classname_replacer    : null, // map
	name_to_ship          : null, // map
	name_to_prevships     : null, // map
	character_data        : null, // array
	shipgroup_data        : null, // array
	groupname_to_shipgroup: null, // map
	initialized           : false,
	
	get_shipgroup_name    : null,
	
	initialize: ShipSelector__initialize,
});


function ShipSelector(){
	if (!ShipSelector.initialized) {
		console.log("warning: ShipSelectorが初期化されていません");
		debugger;
		throw new Error("内部エラー");
	}
	
	Util.attach_event_target(this);
	
	this.e_class_select = ELEMENT("select", "", "shipclass");
	this.e_chara_select = ELEMENT("select", "", "character");
	this.e_ship_select  = ELEMENT("select", "", "shipselect");
	
	this.recreate_class_select();
	this.recreate_chara_select(null, true, null);
	//this.recreate_ship_select_by_form(); // 上で呼ばれる
	
	// イベント
	this.e_class_select.addEventListener("change", e => this.ev_change_class(e));
	this.e_chara_select.addEventListener("change", e => this.ev_change_chara(e));
	this.e_ship_select.addEventListener("change", e => this.ev_change_ship(e));
}


// 利用する変数の初期化を行う
// shiplist : 艦データ(csv)
// [optional] arg_grouping_def: 艦種リスト　指定しないとSHIP_GROUPING_DEF
// [optional] arg_default_select  : デフォルトで選択する艦名(Array)
// [optional] ship_checker    : 艦データの確認関数　真を返した艦データのみ有効とする(function)
function ShipSelector__initialize(shiplist, arg_grouping_def, arg_default_select, ship_checker){
	if (ShipSelector.initialized) return;
	
	// 艦種分類定義
	let grouping_def = arg_grouping_def || SHIP_GROUPING_DEF;
	// デフォルトの改造度選択
	let default_select = arg_default_select || DEFAULT_SELECT_SHIPS;
	
	// 艦型の置換
	// もしこれに登録がある場合は置き換える
	let classname_replacer = new Object;
	
	for (let x of grouping_def) {
		if (x.keys) {
			for (let name of x.keys) {
				classname_replacer[name] = x.viewname;
			}
		}
	}
	
	// 艦名は unique である
	// 艦名→艦データ
	let name_to_ship = new Object;
	// 艦名→改造元の配列(コンバートなど、複数ある場合がある)
	let name_to_prevships = new Object;
	
	let upgrade_reg = /^(.+)\((?:Lv)?(\d+)\)$/i;
	
	for (let ship of shiplist) {
		// 条件を満たさない艦は無視する
		// (値の入力が不足している場合など)
		if (ship_checker && !ship_checker(ship)) continue;
		
		name_to_ship[ship.name] = ship;
		
		// 改造可能
		if (ship.upgrade && upgrade_reg.test(ship.upgrade)) {
			let name = RegExp.$1;
			let level = RegExp.$2;
			
			// 新しく追加したプロパティは _ で始まるものとする
			ship._upgrade_level = +level;
			
			let arr = name_to_prevships[name] || new Array;
			arr.push(ship);
			name_to_prevships[name] = arr;
		}
	}
	
	
	// キャラクターごとに分類する
	// キャラ名は未改造時の艦名とする
	let character_data = new Array;
	// 艦型ごとに分類
	let shipgroup_data = new Array;
	let groupname_to_shipgroup = new Array;
	
	for (let ship of shiplist) {
		if (ship_checker && !ship_checker(ship)) continue;
		
		if (!name_to_prevships[ship.name]) {
			// ship には改造元がない = オリジナル
			let chara = new Character(ship);
			
			let cur = ship;
			for (let j=0; j<20; j++) {
				// cur の改造先を登録
				if (cur.upgrade && upgrade_reg.test(cur.upgrade)) {
					cur = name_to_ship[RegExp.$1];
					
					if (!cur) break;
					// 既に登録済み(コンバートなど)
					if (chara.ships.findIndex(x => x == cur) >= 0) break;
					
					chara.ships.push(cur);
					
				} else {
					break;
				}
			}
			
			character_data.push(chara);
			
			// 艦型から艦を参照するデータへの登録
			// 途中で艦種が変わる場合は複数登録する
			let append_list = new Object;
			let last_key = _get_shipgroup_name(chara.ships[chara.ships.length - 1]);
			
			for (let j=0; j<chara.ships.length; j++) {
				let ship = chara.ships[j];
				let key = _get_shipgroup_name(ship);
				
				let dt = append_list[key];
				if (!dt) {
					dt = {
						//first_type: j == 0,         // 未改造のタイプと一致
						last_type: key == last_key, // 最終改造のタイプと一致
						ships: new Array,           // 艦リスト
						specified_ship: null,       // default_selectで指定されている
					};
					append_list[key] = dt;
				}
				
				dt.ships.push(ship);
				if (default_select && default_select.findIndex(name => name == ship.name) >= 0) {
					dt.specified_ship = ship;
				}
			}
			
			for (let key in append_list) {
				let dt = append_list[key];
				let ship = dt.specified_ship || dt.ships[dt.ships.length - 1];
				
				let grp = groupname_to_shipgroup[key];
				if (!grp) {
					grp = new Shipgroup(key);
					shipgroup_data.push(grp);
					groupname_to_shipgroup[key] = grp;
				}
				
				let cs = new CharacterShip(chara, ship);
				// 最終改造と同型ならば cslist に、そうでないなら sub_cslist に
				if (dt.last_type) {
					grp.cslist.push(cs);
				} else {
					grp.sub_cslist.push(cs);
				}
			}
		}
	}
	
	// shipgroup_dataのソート
	let ordering = grouping_def.map(x => x.viewname);
	
	shipgroup_data.sort(function (a, b){
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
	
	// 準備OK
	Object.assign(ShipSelector, {
		grouping_def          : grouping_def          ,
		classname_replacer    : classname_replacer    ,
		name_to_ship          : name_to_ship          ,
		name_to_prevships     : name_to_prevships     ,
		character_data        : character_data        ,
		shipgroup_data        : shipgroup_data        ,
		groupname_to_shipgroup: groupname_to_shipgroup,
		initialized           : true                  ,
		get_shipgroup_name    : _get_shipgroup_name   ,
	});
	
	
	// 艦からグループ名(艦型)
	function _get_shipgroup_name(ship){
		if (!ship) return "";
		
		let key = ship.shipType;
		
		if (key == "駆逐艦") {
			// 駆逐艦は数が多いので型で分類
			if (SHIP_GROUPING_FOREIGN_DD.findIndex(x => x == ship.className) >= 0) {
				// 海外艦
				key += " (海外艦)";
			} else {
				key += " (" + ship.className + ")";
			}
		}
		
		if (classname_replacer[key]) {
			key = classname_replacer[key];
		}
		return key;
	}
}


// 艦型リストを再生成
// 再っていうけど1回しか呼ばないかも
function ShipSelector_recreate_class_select(){
	let shipgroup_data = ShipSelector.shipgroup_data;
	Util.remove_children(this.e_class_select);
	
	let rs = new Option("- 艦種絞り込み", "");
	this.e_class_select.appendChild(rs);
	
	for (let i=0; i<shipgroup_data.length; i++) {
		let rs = new Option(shipgroup_data[i].group_name, shipgroup_data[i].group_name);
		this.e_class_select.appendChild(rs);
	}
	this.e_class_select.selectedIndex = 0;
}


// キャラリストを再生成
// 艦名リストも更新
// selectのvalueは キャラ名,艦名
// キャラ名は未改造のときの艦名、艦名はデフォルトの選択肢
// restrict_classes: 型名による制限
// grouping: optgroupをつくる
function ShipSelector_recreate_chara_select(restrict_classes, grouping, new_value){
	let shipgroup_data = ShipSelector.shipgroup_data;
	
	let old_value = this.e_chara_select.value;
	let found_old_value = false;
	
	Util.remove_children(this.e_chara_select);
	
	if (this.empty_option) {
		this.e_chara_select.appendChild(new Option("-", ""));
	}
	
	for (let i=0; i<shipgroup_data.length; i++) {
		if (restrict_classes) {
			if (restrict_classes.indexOf(shipgroup_data[i].group_name) < 0) {
				continue;
			}
		}
		
		let parent, group_name;
		let count = 0;
		
		if (grouping) {
			parent = document.createElement("optgroup");
			parent.label = shipgroup_data[i].group_name;
			group_name = shipgroup_data[i].group_name;
		} else {
			parent = this.e_chara_select;
			group_name = "";
		}
		
		function _create(list, bk){
			for (let i=0; i<list.length; i++) {
				let name = list[i].character.original_name;
				let def = CHARACTER_NAME_DEF.find(d => d.basename == name);
				if (def) name = def.viewname;
				
				let value = list[i].character.original_name + "," + list[i].ship.name;
				if (bk) name = "(" + name + ")";
				
				parent.appendChild(new Option(name, value));
				
				if (value == old_value) {
					found_old_value = true;
				}
				count++;
			}
		}
		
		_create(shipgroup_data[i].cslist, false);
		_create(shipgroup_data[i].sub_cslist, true);
		
		if (grouping && count > 0) {
			this.e_chara_select.appendChild(parent);
		}
	}
	
	if (new_value || found_old_value) {
		this.e_chara_select.value = new_value ? new_value : old_value;
	} else {
		this.e_chara_select.selectedIndex = 0;
	}
	
	this.recreate_ship_select_by_form();
}



// 艦名リスト
function ShipSelector_recreate_ship_select(chara_name, select_name){
	if (!chara_name) {
		// からっぽ！
		Util.remove_children(this.e_ship_select);
		this.e_ship_select.appendChild(new Option("-", ""));
		return;
	}
	
	let chara = ShipSelector.character_data.find(x => x.original_name == chara_name);
	
	if (!chara) {
		console.log("ないぽい:", chara_name);
		return;
	}
	
	Util.remove_children(this.e_ship_select);
	
	for (let i=0; i<chara.ships.length; i++) {
		this.e_ship_select.appendChild(new Option(chara.ships[i].name, chara.ships[i].name));
		
		if (chara.ships[i].name == select_name) {
			this.e_ship_select.selectedIndex = i;
		}
	}
}


// フォームを読み取って更新
function ShipSelector_recreate_chara_select_by_form(){
	let restrict = this.e_class_select.value ? [this.e_class_select.value] : null;
	this.recreate_chara_select(restrict, !restrict);
}

function ShipSelector_recreate_ship_select_by_form(){
	if (/,/.test(this.e_chara_select.value)) {
		this.recreate_ship_select(RegExp.leftContext, RegExp.rightContext);
	} else {
		this.recreate_ship_select("", "");
	}
}


function ShipSelector_get_classname(){
	return this.e_class_select.value;
}

function ShipSelector_get_charaname(){
	return /,/.test(this.e_chara_select.value) ? RegExp.leftContext : "";
}

function ShipSelector_get_shipname(){
	return this.e_ship_select.value;
}

function ShipSelector_get_ship(){
	return ShipSelector.name_to_ship[this.get_shipname()];
}

function ShipSelector_empty(){
	return this.e_ship_select.value == "";
}

// データの入れ替え
function ShipSelector_swap_data(sel){
	let this_name = this.get_shipname();
	let sel_name = sel.get_shipname();
	if (this_name == sel_name) return;
	
	let temp = this.empty_option;
	this.empty_option = sel.empty_option;
	sel.empty_option = temp;
	
	this.set_shipname(sel_name);
	sel.set_shipname(this_name);
}


// 艦名をセット
// 艦型もセットできるときはする
function ShipSelector_set_shipname(shipname, groupname, set_group){
	if (!shipname) {
		// clear
		this.e_chara_select.value = "";
		this.recreate_ship_select("");
		return;
	}
	
	let ship = ShipSelector.name_to_ship[shipname];
	let group = ShipSelector.groupname_to_shipgroup[groupname];
	
	if (!group) {
		groupname = ShipSelector.get_shipgroup_name(ship);
		group = ShipSelector.groupname_to_shipgroup[groupname];
	}
	
	let origship = ship;
	for (let i=0; i<20; i++) {
		let prevs = ShipSelector.name_to_prevships[origship.name];
		if (!prevs) break;
		
		// 最も改造レベルの低いもの
		origship = prevs.reduce(function (acc, cur){
			return cur._upgrade_level < acc._upgrade_level ? cur : acc;
		});
	}
	
	// 艦型をセット
	if (set_group) {
		this.e_class_select.value = groupname;
		
		if (this.e_class_select.selectedIndex < 0) {
			// 艦型としてない
			console.log("warning: 内部エラー(存在しない艦型)", groupname);
			this.e_class_select.value = "";
		}
		this.recreate_chara_select_by_form();
	}
	
	// キャラクターをセット
	// ちょっとややこしいが
	let primary = group.cslist.find(x => x.character.original_name == origship.name);
	if (!primary) {
		primary = group.sub_cslist.find(x => x.character.original_name == origship.name);
	}
	let chara_value = origship.name + "," + primary.ship.name;
	
	this.e_chara_select.value = chara_value;
	
	if (this.e_chara_select.selectedIndex < 0) {
		// キャラクターがない(艦型が不正とか)
		this.e_class_select.value = "";
		this.recreate_chara_select_by_form();
		this.e_chara_select.value = chara_value;
	}
	
	// 改造度をセット
	this.recreate_ship_select_by_form();
	this.e_ship_select.value = ship.name;
}


// イベント ----------------------------------------------------------------------------------------
function ShipSelector_ev_change_class(e){
	this.recreate_chara_select_by_form();
	this.call_onchange();
}

function ShipSelector_ev_change_chara(e){
	this.recreate_ship_select_by_form();
	this.call_onchange();
}

function ShipSelector_ev_change_ship(e){
	this.call_onchange();
}


function ShipSelector_call_onchange(){
/*
	if (this.onchange) {
		this.onchange.call(null, this.e_ship_select.value);
	}
*/
	this.dispatchEvent(new CustomEvent("change", {detail: this.e_ship_select.value}));
}

