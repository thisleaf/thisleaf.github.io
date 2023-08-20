// 艦名のselectを管理
/*
	使用する前に ShipSelector.initialize(艦データ [, ...]) を呼ぶ
	ShipSelector がメイン
*/

import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT} from "./utility.mjs";
import {DOMDialog} from "./dom_dialog.mjs";
import {RomajiSearch} from "./romaji_search.mjs";

export {
	Character,
	CharacterShip,
	Shipgroup,
	ShipSelector,
	ShipSelectorDialog,
};


// 艦種リスト(default)
// この表示順になる、ここにないものは最後尾
// keys に配列を指定すると viewname に置き換える
const SHIP_GROUPING_DEF = [
	{viewname: "戦艦", keys: ["戦艦", "巡洋戦艦"]},
	{viewname: "航空戦艦", keys: ["航空戦艦", "改装航空戦艦"]},
	{viewname: "正規空母", keys: ["正規空母", "装甲空母", "夜間作戦航空母艦", "近代化航空母艦"]},
	{viewname: "軽空母"},
	
	{viewname: "重巡洋艦"},
	{viewname: "航空巡洋艦", keys: ["航空巡洋艦", "改装航空巡洋艦", "特殊改装航空巡洋艦"]},
	{viewname: "軽巡洋艦", keys: ["軽巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦", "兵装実験軽巡", "重改装軽巡洋艦"]},
	{viewname: "重雷装巡洋艦"},
	{viewname: "練習巡洋艦"},

	{viewname: "駆逐艦 (神風型)"},
	{viewname: "駆逐艦 (睦月型)"},
	{viewname: "駆逐艦 (吹雪型)"},
	{viewname: "駆逐艦 (綾波型)"},
	{viewname: "駆逐艦 (暁型)"},
	{viewname: "駆逐艦 (初春型)"},
	{viewname: "駆逐艦 (白露型)", keys: ["駆逐艦 (白露型)", "駆逐艦 (改白露型)", "駆逐艦 (改装白露型)"]},
	{viewname: "駆逐艦 (朝潮型)"},
	{viewname: "駆逐艦 (陽炎型)", keys: ["駆逐艦 (改陽炎型)", "駆逐艦 (改装陽炎型)", "陽字号駆逐艦"]},
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
	mode: "",
	
	// "-" (なし) を選択肢に出現させる
	empty_option: true,
	// 検索の入力文字列
	//query_text: "",
	// 現在選択している艦 (popup mode)
	popup_selected_shipname: null,
	popup_selected_charaname: null,
	// popup用ダイアログ
	popup_dialog: null,
	
	// DOM
	e_class_select: null,
	e_chara_select: null,
	e_ship_select : null,
	e_shipname_div: null,
	
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
	
	// onchange を呼ぶ
	call_onchange: ShipSelector_call_onchange,
	
	// イベント
	ev_change_class: ShipSelector_ev_change_class,
	ev_change_chara: ShipSelector_ev_change_chara,
	ev_change_ship : ShipSelector_ev_change_ship,
	ev_click_shipnamediv: ShipSelector_ev_click_shipnamediv,
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
	name_to_converts      : null,
	name_to_character     : null,
	character_data        : null, // array
	shipgroup_data        : null, // array
	groupname_to_shipgroup: null, // map
	initialized           : false,
	
	get_shipgroup_name    : null,
	
	initialize: ShipSelector__initialize,
});


/**
 * 艦娘選択フォーム<br>
 * select modeではselectを使って艦種/艦娘名/艦名を選択<br>
 *   e_class_select, e_chara_select, e_ship_selectを配置<br>
 * popup modeではクリックしてポップアップを立ち上げて選択<br>
 *   e_shipname_divを配置<br>
 * <br>
 * EventTargetを継承<br>
 *   change: ユーザーによってフォームが変更された detailに艦名
 * 
 * @param {("select"|"popup")} [mode="select"] 動作モード
 * @param {ShipSelectorDialog} [dialog=null] popup mode用のダイアログ popup modeでは必ず指定
 * @constructor
 * @mixes EventTarget
 */
function ShipSelector(mode = "select", dialog = null){
	if (!ShipSelector.initialized) {
		console.log("warning: ShipSelectorが初期化されていません");
		debugger;
		throw new Error("内部エラー");
	}
	
	Util.attach_event_target(this);
	
	/**
	 * 動作モード
	 * @member {("select"|"popup")}
	 * @readonly
	 */
	this.mode = mode;
	
	if (mode == "select") {
		/**
		 * 艦種絞り込み select.shipclass
		 * @member {HTMLSelectElement}
		 * @readonly
		 */
		this.e_class_select = ELEMENT("select", "", "shipclass");
		/**
		 * キャラ名 select.character
		 * @member
		 * @readonly
		 */
		this.e_chara_select = ELEMENT("select", "", "character");
		/**
		 * 艦名 select.shipselect
		 * @member
		 * @readonly
		 */
		this.e_ship_select  = ELEMENT("select", "", "shipselect");
		
		this.recreate_class_select();
		this.recreate_chara_select(null, true, null);
		//this.recreate_ship_select_by_form(); // 上で呼ばれる
		
		// イベント
		this.e_class_select.addEventListener("change", e => this.ev_change_class(e));
		this.e_chara_select.addEventListener("change", e => this.ev_change_chara(e));
		this.e_ship_select.addEventListener("change", e => this.ev_change_ship(e));
		
	} else if (mode == "popup") {
		/**
		 * @member {ShipSelectorDialog}
		 */
		this.popup_dialog = dialog;
		/**
		 * 艦名 (popup mode) div.shipnamediv クリックするとポップアップを表示
		 * @member
		 * @readonly
		 */
		this.e_shipname_div = ELEMENT("div", "", "shipnamediv");
		this.set_shipname(null);
		
		this.e_shipname_div.addEventListener("click", e => this.ev_click_shipnamediv());
		
	} else {
		debugger;
		throw new Error("内部エラー: ShipSelector() の引数が不正");
	}
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
	// 改造にコンバート指定がついている場合は追加しない
	let name_to_prevships_nc = new Object;
	
	let upgrade_reg = /^(.+)\((?:Lv)?(\d+)(?:,(\w+))?\)$/i;
	
	for (let ship of shiplist) {
		// 条件を満たさない艦は無視する
		// (値の入力が不足している場合など)
		if (ship_checker && !ship_checker(ship)) continue;
		
		name_to_ship[ship.name] = ship;
		
		// 改造可能
		let m = ship.upgrade && upgrade_reg.exec(ship.upgrade);
		if (m) {
			let name = m[1];
			let level = m[2];
			// 特殊なフラグ
			// c: コンバートで元に戻すことを明示的に指定
			//    最初の改造度に戻す場合に必要
			let spflags = m[3]?.toLowerCase() ?? "";
			
			// 新しく追加したプロパティは _ で始まるものとする
			ship._upgrade_level = +level;
			
			let arr = name_to_prevships[name] || (name_to_prevships[name] = []);
			arr.push(ship);

			if (!spflags.includes("c")) {
				let arr2 = name_to_prevships_nc[name] || (name_to_prevships_nc[name] = []);
				arr2.push(ship);
			}
		}
	}
	
	
	// キャラクターごとに分類する
	// キャラ名は未改造時の艦名とする
	let character_data = new Array;
	// 艦型ごとに分類
	let shipgroup_data = new Array;
	let groupname_to_shipgroup = new Array;
	// コンバートが存在する場合はコンバート可能な艦のリスト(自分を含む)
	let name_to_converts = {};
	// 艦名→キャラ
	let name_to_character = {};
	
	for (let ship of shiplist) {
		if (ship_checker && !ship_checker(ship)) continue;
		
		if (!name_to_prevships_nc[ship.name]) {
			// ship には改造元がない = オリジナル
			let chara = new Character(ship);
			name_to_character[ship.name] = chara;
			
			let cur = ship;
			for (let j=0; j<20; j++) {
				// cur の改造先を登録
				if (cur.upgrade && upgrade_reg.test(cur.upgrade)) {
					cur = name_to_ship[RegExp.$1];
					
					if (!cur) break;
					// 既に登録済み(コンバートなど)
					let index = chara.ships.findIndex(x => x == cur);
					if (index >= 0) {
						let convs = chara.ships.slice(index);
						for (let c of convs) {
							name_to_converts[c.name] = convs;
						}
						break;
					}
					
					chara.ships.push(cur);
					name_to_character[cur.name] = chara;
					
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
		name_to_prevships_nc  : name_to_prevships_nc  ,
		name_to_converts      : name_to_converts      ,
		name_to_character     : name_to_character     ,
		character_data        : character_data        ,
		shipgroup_data        : shipgroup_data        ,
		groupname_to_shipgroup: groupname_to_shipgroup,
		initialized           : true                  ,
		get_shipgroup_name    : _get_shipgroup_name   ,
	});

	// 艦からグループ名(艦型)
	function _get_shipgroup_name(ship){
		if (!ship) return "";
		
		let key = ship.shipTypeI || ship.shipType;
		
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
	console.assert(this.mode == "select");
	
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
	console.assert(this.mode == "select");
	
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
	console.assert(this.mode == "select");
	
	let restrict = this.e_class_select.value ? [this.e_class_select.value] : null;
	this.recreate_chara_select(restrict, !restrict);
}

function ShipSelector_recreate_ship_select_by_form(){
	console.assert(this.mode == "select");
	
	if (/,/.test(this.e_chara_select.value)) {
		this.recreate_ship_select(RegExp.leftContext, RegExp.rightContext);
	} else {
		this.recreate_ship_select("", "");
	}
}

function ShipSelector_get_classname(){
	console.assert(this.mode == "select");
	return this.e_class_select.value;
}

function ShipSelector_get_charaname(){
	if (this.mode == "select") {
		return /,/.test(this.e_chara_select.value) ? RegExp.leftContext : "";
	} else {
		let chara = ShipSelector.name_to_character[this.get_shipname()];
		return chara?.original_name;
	}
}

function ShipSelector_get_shipname(){
	if (this.mode == "select") {
		return this.e_ship_select.value;
	} else if (this.mode == "popup") {
		return this.popup_selected_shipname;
	}
	return null;
}

function ShipSelector_get_ship(){
	return ShipSelector.name_to_ship[this.get_shipname()];
}

// 空かどうか
function ShipSelector_empty(){
	return this.mode == "select" ? this.e_ship_select.value == "" : !this.get_shipname();
}

// データの入れ替え
function ShipSelector_swap_data(sel){
	let this_name = this.get_shipname();
	let sel_name = sel.get_shipname();
	if (this_name == sel_name) return;
	
/*
	let temp = this.empty_option;
	this.empty_option = sel.empty_option;
	sel.empty_option = temp;
*/
	
	this.set_shipname(sel_name);
	sel.set_shipname(this_name);
}


// 艦名をセット
// 艦型もセットできるときはする
function ShipSelector_set_shipname(shipname, groupname, set_group){
	if (this.mode == "popup") {
		this.popup_selected_shipname = shipname;
		
		if (shipname) {
			this.e_shipname_div.textContent = shipname;
			this.e_shipname_div.classList.remove("empty");
		} else {
			this.e_shipname_div.textContent = "(empty)";
			this.e_shipname_div.classList.add("empty");
		}
		
		return;
	}
	
	//console.assert(this.mode == "select");
	
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

function ShipSelector_call_onchange(){
	this.dispatchEvent(new CustomEvent("change", {detail: this.get_shipname()}));
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

function ShipSelector_ev_click_shipnamediv(e){
	this.popup_dialog.set_selected_name(this.get_shipname());
	this.popup_dialog.show_empty_button = this.empty_option;
	this.popup_dialog.autoclose_mode = true;
	
	this.popup_dialog.show().then(result => {
		if (result == "ok") {
			let name = this.popup_dialog.get_selected_name();
			if (name !== null) {
				this.set_shipname(name);
				this.call_onchange();
			}
		}
	});
}


// Dialog用クラス ----------------------------------------------------------------------------------
// dialog element
class DETypeGroup {
	group_name;
	// 区切り用の要素
	e_delimiter;
	// 検索時にコンテナーにする要素
	e_search_row;
	// array<DECharacter>
	de_characters;
	
	constructor(name){
		this.group_name = name || "";
		this.e_delimiter = NODE(ELEMENT("div", "", "delimiter"), [
			NODE(ELEMENT("div", "", "hr"), [ELEMENT("div")]),
			NODE(ELEMENT("div", "", "group_name"), [TEXT(this.group_name)]),
		]);
		this.e_search_row = ELEMENT("div", "", "shipgroup");
		this.de_characters = [];
	}
};

// キャラクター(行)
class DECharacter {
	// キャラ名
	base_name;
	// キャラ行ごとの表示で利用する要素
	e_character_row;
	// 艦名ごとのボタン  subは未改造
	de_main_ships; // main_shipと同等の改造度
	de_sub1_ships; // mainでなく同艦種
	de_sub2_ships; // それ以外
	// main
	main_ship;
	main_group_name;
	// 元データ(csv)の配列
	ships;
	// 未改造行のオブジェクトかどうか
	unupgraded;
	
	constructor(name){
		this.base_name = name || "";
		this.e_character_row = ELEMENT("div", "", "shipgroup");
		this.de_main_ships = [];
		this.de_sub1_ships = [];
		this.de_sub2_ships = [];
	}
	set_ships(ships, main_ship, shipcode_def){
		this.ships = ships.concat();
		this.main_ship = main_ship;
		
		// キャラクターの艦リスト
		let de_ships = ships.map(ship => {
			let d = new DEShip();
			d.set_ship(ship);
			d.add_shipcode(shipcode_def);
			return d;
		});
		de_ships.reverse();
		// groupでのメイン位置
		let main_pos = de_ships.findIndex(de => de.ship == main_ship);
		if (main_pos < 0) main_pos = 0;
		
		// 存在すればコンバート可能
		let convs = ShipSelector.name_to_converts[de_ships[main_pos].ship.name];
		let main_begin = convs ? 0 : main_pos;
		let main_length = convs ? convs.length : 1;
		
		this.main_group_name = ShipSelector.get_shipgroup_name(main_ship);
		this.de_main_ships = de_ships.splice(main_begin, main_length);
		this.de_sub1_ships = de_ships.filter(de => de.group_name == this.main_group_name);
		this.de_sub2_ships = de_ships.filter(de => de.group_name != this.main_group_name);
		
		for (let de of de_ships) {
			de.e_ship.classList.add("sub");
		}
	}
	get_group_names(){
		let out = [];
		let app = (de_ships) => {
			for (let de of de_ships) {
				if (out.indexOf(de.group_name) < 0) out.push(de.group_name);
			}
		};
		app(this.de_main_ships);
		app(this.de_sub1_ships);
		app(this.de_sub2_ships);
		return out;
	}
	get_de_ships(){
		return this.de_main_ships.concat(this.de_sub1_ships, this.de_sub2_ships);
	}
	// キャラ行として表示
	// other_type: main_shipと違う艦種を追加するか
	prepare_character_row(main, sub1, sub2, other_type){
		Util.remove_children(this.e_character_row);
		let des = this.prepare_character_ships(main, sub1, sub2, other_type);
		return NODE(this.e_character_row, des.map(de => de.e_ship));
	}
	// 行にせずDEShipの配列を返す
	prepare_character_ships(main, sub1, sub2, other_type){
		let out = [];
		let app = (de_ships) => {
			for (let de of de_ships) {
				if (!other_type && this.main_group_name != de.group_name) {
					continue;
				}
				de.e_ship.classList.remove("match");
				out.push(de);
			}
		};
		if (main) app(this.de_main_ships);
		if (sub1) app(this.de_sub1_ships);
		if (sub2) app(this.de_sub2_ships);
		return out;
	}
	search_and(regs, main, sub1, sub2, other_type){
		let out = [];
		let app = (de_ships) => {
			for (let de of de_ships) {
				if (!other_type && this.main_group_name != de.group_name) {
					continue;
				}
				if (de.match_and(regs)) {
					de.e_ship.classList.add("match");
					out.push(de);
				}
			}
		};
		if (main) app(this.de_main_ships);
		if (sub1) app(this.de_sub1_ships);
		if (sub2) app(this.de_sub2_ships);
		return out;
	}
	addEventListener(type, func){
		let de_ships = this.de_main_ships.concat(this.de_sub1_ships, this.de_sub2_ships);
		for (let des of de_ships) {
			des.addEventListener(type, func);
		}
	}
};

class DEShip {
	ship;
	e_ship;
	group_name;
	search_key;
	
	set_ship(ship){
		this.ship = ship;
		this.e_ship = NODE(ELEMENT("div", "", "ship"), [
			NODE(ELEMENT("div", "", "name"), [TEXT(ship.name)]),
			NODE(ELEMENT("div", "", "hint"), [
				NODE(ELEMENT("div", "", "firepower"), [TEXT("火力" + ship.firepowerMax)]),
				NODE(ELEMENT("div", "", "min_luck"), [TEXT("初期運" + ship.luckMin)]),
			]),
		]);
		
		this.group_name = ShipSelector.get_shipgroup_name(ship);
		let key_array = [ship.name];
		if (ship.kana) key_array = key_array.concat(ship.kana.split("|"));
		this.search_key = RomajiSearch.arrayToKey(key_array);
	}
	set_empty(){
		this.ship = null;
		this.e_ship = NODE(ELEMENT("div", "", "ship empty"), [
			NODE(ELEMENT("div", "", "name"), [TEXT("選択なし")]),
		]);
		this.group_name = "";
		this.search_key = null;
	}
	add_shipcode(shipcode_def){
		if (shipcode_def) {
			let code = shipcode_def[this.ship.shipTypeI || this.ship.shipType];
			if (!code) {
				code = ShipSelectorDialog.shipcode_other;
			}
			this.e_ship.classList.add(code);
		}
	}
	match_and(regs){
		return regs.every(reg => reg.exec(this.search_key));
	}
	addEventListener(type, func){
		this.e_ship.addEventListener(type, e => func(e, this));
	}
};


/**
 * ShipSelector の popup mode の選択ダイアログ<br>
 * public オプションを表示中に変更してはいけない
 * @extends DOMDialog
 */
class ShipSelectorDialog extends DOMDialog {
	// property
	e_class_select;
	e_query;
	e_clear_x;
	e_unupgrade;
	e_hidden_groups_label;
	e_hidden_groups;
	e_ok;
	e_list_div;
	
	de_typegroups;
	de_emptygroup;
	
	all_de_ships;
	de_emptyship;
	de_selected_ships;
	
	/**
	 * 艦種別に付与するクラス名の定義
	 * @type {?Object.<string, string>}
	 * @private
	 */
	shipcode_def = null;
	/**
	 * デフォルト非表示の艦種リスト
	 * @type {?Array.<string>}
	 * @private
	 */
	hidden_groups = null;
	/**
	 * 現在選択中の艦名
	 * null: なにも選択されていない
	 * "": "選択なし" を選択
	 * @type {?string}
	 * @private
	 */
	selected_shipname = null;
	
	/**
	 * "選択なし"を表示する
	 * @type {boolean}
	 * @public
	 */
	show_empty_button = true;
	/**
	 * 選択したら閉じるモード
	 * @type {boolean}
	 * @public
	 */
	autoclose_mode = false;
	/**
	 * 表示時に選択中の艦がある場合、その位置まで自動でスクロールする
	 * @type {boolean}
	 * @public
	 */
	autoscroll = false;
};

Object.defineProperties(ShipSelectorDialog.prototype, {
	// 共通コード
	recreate_class_select: {value: ShipSelector_recreate_class_select},
	
	create               : {value: ShipSelectorDialog_create},
	create_list          : {value: ShipSelectorDialog_create_list},
	refresh_list         : {value: ShipSelectorDialog_refresh_list},
	set_selected_name    : {value: ShipSelectorDialog_set_selected_name},
	get_selected_name    : {value: ShipSelectorDialog_get_selected_name},
	scroll_to_selected_ship: {value: ShipSelectorDialog_scroll_to_selected_ship},
	
	ev_show              : {value: ShipSelectorDialog_ev_show},
	ev_keydown_query     : {value: ShipSelectorDialog_ev_keydown_query},
	ev_document_keydown  : {value: ShipSelectorDialog_ev_document_keydown},
	ev_click_x           : {value: ShipSelectorDialog_ev_click_x},
	ev_click_ship        : {value: ShipSelectorDialog_ev_click_ship},
	ev_dblclick_ship     : {value: ShipSelectorDialog_ev_dblclick_ship},
});

Object.defineProperties(ShipSelectorDialog, {
	shipcode_other: {value: "other"},
	/**
	 * @type {Object.<string, string>}
	 * @memberof ShipSelectorDialog
	 */
	support_shipcode_def: {value: {
		"駆逐艦"          : "dd" ,
		// "陽字号駆逐艦"    : "dd" ,
		"戦艦"            : "bb" ,
		"巡洋戦艦"        : "bb" ,
		"航空戦艦"        : "bbv",
		"改装航空戦艦"    : "bbv",
		"正規空母"        : "cv" ,
		// "夜間作戦航空母艦": "cv" ,
		// "近代化航空母艦"  : "cv" ,
		"装甲空母"        : "cv" ,
		"軽空母"          : "cv" ,
		"重巡洋艦"        : "ca" ,
		"航空巡洋艦"      : "cav",
		// "改装航空巡洋艦"    : "cav",
		// "特殊改装航空巡洋艦": "cav",
	}},
	/**
	 * @type {Array.<string>}
	 * @memberof ShipSelectorDialog
	 */
	support_hidden_groups: {value: [
		"軽巡洋艦",
		"重雷装巡洋艦",
		"練習巡洋艦",
		"海防艦",
		"潜水艦",
		"水上機母艦",
		"補給艦",
		"潜水母艦",
		"揚陸艦",
		"工作艦",
		"戦車揚陸艦",
		"練習特務艦",
	]},
});


/**
 * DOMの生成
 * @param {string} [insideClassName=""] .inside に付与するクラス
 * @param {Object.<string, string>} [shipcode_def=null] 艦ボタンに付与する艦種別クラスの定義<br>
 *     艦種 -> クラス名 のmap<br>
 *     これを指定してかつ要素にない場合は"other"、nullの場合はクラスを付与しない
 * @param {Array.<string>} [hidden_groups=null] デフォルト非表示にする艦種の配列(置換後)
 * @return {ShipSelectorDialog} this
 * @method ShipSelectorDialog#create
 */
function ShipSelectorDialog_create(insideClassName = "", shipcode_def = null, hidden_groups = null){
	DOMDialog.prototype.create.call(this, "modal", "艦娘の選択", true);
	
	this.e_inside.classList.add("ship_selector");
	if (insideClassName) {
		this.e_inside.classList.add(insideClassName);
	}
	this.shipcode_def = shipcode_def;
	this.hidden_groups = hidden_groups;
	
	NODE(this.e_contents, [
		NODE(ELEMENT("div", "", "search_bar"), [
			// toolbar
			this.e_class_select = ELEMENT("select", "", "ship_class"),
			this.e_query        = ELEMENT("input", {size: 20, placeholder: "検索"}),
			this.e_clear_x      = NODE(ELEMENT("div", "", "mark_x"), [ELEMENT("div"), ELEMENT("div")]),
			NODE(ELEMENT("label", {className: "unupgrade", title: "艦種が変わるものはチェックなしでも表示"}), [
				this.e_unupgrade = ELEMENT("input", {type: "checkbox"}),
				TEXT("未改造"),
			]),
			this.e_hidden_groups_label = NODE(ELEMENT("label.hidden_groups"), [
				this.e_hidden_groups = ELEMENT("input", {type: "checkbox"}),
				TEXT("その他の艦種"),
			]),
			this.e_ok           = NODE(ELEMENT("button", "", "ok"), [TEXT("OK")]),
		]),
		
		this.e_list_div = ELEMENT("div", "", "list"),
	]);

	this.create_list();
	this.recreate_class_select();
	
	if (hidden_groups) {
		this.e_hidden_groups.addEventListener("change", e => this.refresh_list());
	} else {
		// デフォルト非表示がない場合は表示しない
		this.e_hidden_groups.parentNode.style.display = "none";
	}

	this.add_dialog_button(this.e_ok, "ok");
	this.e_class_select.addEventListener("change", e => this.refresh_list());
	this.e_query.addEventListener("input", Util.delayed_caller(() => this.refresh_list(), 200));
	this.e_query.addEventListener("keydown", e => this.ev_keydown_query(e));
	this.e_clear_x.addEventListener("click", e => this.ev_click_x(e));
	this.e_unupgrade.addEventListener("change", e => this.refresh_list());
	this.addEventListener("show", e => this.ev_show());

	return this;
}

/**
 * list のアイテムは予め作っておく
 * グループごとに表示したいので、同じ艦名のアイテムが存在
 * @method ShipSelectorDialog#create_list
 * @private
 */
function ShipSelectorDialog_create_list(){
	let onclick = (e, de_ship) => {
		this.ev_click_ship(de_ship);
	};
	let ondblclick = (e, de_ship) => {
		this.ev_dblclick_ship(de_ship);
	};
	
	// map: group_name -> {delimiter: element, items: array<element>}
	// group_name は艦種、順番は ShipSelector.shipgroup_data
	this.de_typegroups = {};
	
	{	// empty item
		let det = new DETypeGroup();
		let dec = new DECharacter();
		let des = new DEShip();
		des.set_empty();
		dec.de_main_ships.push(des);
		det.de_characters.push(dec);
		dec.addEventListener("click", onclick);
		dec.addEventListener("dblclick", ondblclick);
		this.de_emptygroup = det;
		this.de_emptyship = des;
	}
	
	let de_ship_arrays = [];
	
	// class group items
	for (let group of ShipSelector.shipgroup_data) {
		let de_group = new DETypeGroup(group.group_name);
		
		for (let cs of group.cslist) {
			let de_character = new DECharacter(cs.character.base_name);
			de_character.set_ships(cs.character.ships, cs.ship, this.shipcode_def);
			de_character.addEventListener("click", onclick);
			de_character.addEventListener("dblclick", ondblclick);
			de_group.de_characters.push(de_character);
			de_ship_arrays.push(de_character.get_de_ships());
		}
		
		this.de_typegroups[group.group_name] = de_group;
	}
	
	// 未改造で艦種が異なるもの
	for (let group of ShipSelector.shipgroup_data) {
		let de_group = this.de_typegroups[group.group_name];
		
		for (let de_chara of de_group.de_characters) {
			if (de_chara.unupgraded) continue;
			
			for (let name of de_chara.get_group_names()) {
				if (name == group.group_name) continue;
				
				let rev_ships = de_chara.ships.concat();
				rev_ships.reverse();
				let main_ship = rev_ships.find(x => ShipSelector.get_shipgroup_name(x) == name);
				if (!main_ship) { debugger; continue; }
				
				let de_character = new DECharacter(de_chara.base_name);
				de_character.set_ships(de_chara.ships, main_ship, this.shipcode_def);
				de_character.addEventListener("click", onclick);
				de_character.addEventListener("dblclick", ondblclick);
				de_character.unupgraded = true;
				
				this.de_typegroups[name].de_characters.push(de_character);
				de_ship_arrays.push(de_character.get_de_ships());
			}
		}
	}
	
	this.all_de_ships = de_ship_arrays.flat();
	this.set_selected_name(this.get_selected_name(), true);
}

/**
 * 表示を更新
 * @method ShipSelectorDialog#refresh_list
 */
function ShipSelectorDialog_refresh_list(){
	this.e_ok.classList.toggle("hide", this.autoclose_mode);
	
	Util.remove_children(this.e_list_div);
	
	if (this.show_empty_button) {
		let dec = this.de_emptygroup.de_characters[0];
		this.e_list_div.appendChild(dec.prepare_character_row(true, false, false, true));
	}
	
	let search_regs = RomajiSearch.toSearchRegArray(this.e_query.value);
	let search_mode = search_regs.length > 0;
	let show_unupgraded = this.e_unupgrade.checked;
	let limit_ship_class = this.e_class_select.value;
	//console.log("search_regs", search_regs);
	
	for (let group of ShipSelector.shipgroup_data) {
		if (limit_ship_class && group.group_name != limit_ship_class) continue;
		if (!this.e_hidden_groups?.checked && this.hidden_groups?.includes(group.group_name)) continue;
		
		let de_group = this.de_typegroups[group.group_name];
		
		if (search_mode || !show_unupgraded) {
			// 未改造非表示モードの場合は「改造済を検索した」ように扱う
			let search_matched = [];
			
			for (let de_chara of de_group.de_characters) {
				let de_matched;
				if (search_mode) {
					de_matched = de_chara.search_and(search_regs, true, show_unupgraded, false, false);
				} else {
					de_matched = de_chara.prepare_character_ships(true, show_unupgraded, false, false);
				}
				
				if (de_matched.length > 0) {
					search_matched = search_matched.concat(de_matched);
				}
			}
			
			if (search_matched.length > 0) {
				Util.remove_children(de_group.e_search_row);
				NODE(this.e_list_div, [
					de_group.e_delimiter,
					NODE(de_group.e_search_row, search_matched.map(de => de.e_ship)),
				]);
			}
			
		} else {
			this.e_list_div.appendChild(de_group.e_delimiter);
			
			for (let de_chara of de_group.de_characters) {
				this.e_list_div.appendChild(de_chara.prepare_character_row(true, show_unupgraded, false, false));
			}
		}
	}
}

function ShipSelectorDialog_set_selected_name(name, force_reset = false){
	if (force_reset || this.selected_shipname !== name) {
		if (this.de_selected_ships) {
			for (let des of this.de_selected_ships) {
				des.e_ship.classList.remove("selected");
			}
		}
		
		let de_ships = [];
		if (!name) {
			// nullは何も選択しない
			if (name === "") {
				de_ships.push(this.de_emptyship);
			}
		} else {
			for (let des of this.all_de_ships) {
				if (des.ship.name == name) de_ships.push(des);
			}
		}
		for (let des of de_ships) {
			des.e_ship.classList.add("selected");
		}
		
		this.de_selected_ships = de_ships;
		this.selected_shipname = name;
	}
}

function ShipSelectorDialog_get_selected_name(name){
	return this.selected_shipname;
}

// 選択中の艦があったら、それが見えるようにスクロールする
function ShipSelectorDialog_scroll_to_selected_ship(){
	let name = this.get_selected_name();
	if (name) {
		let de_ship = this.de_selected_ships.find(des => {
			// .list に配置されているもの
			return des.ship.name == name && des.e_ship.closest(".list") == this.e_list_div;
		});
		if (de_ship) {
			de_ship.e_ship.scrollIntoView();
			// 少し離す
			let list_rect = this.e_list_div.getBoundingClientRect();
			let ship_rect = de_ship.e_ship.getBoundingClientRect();
			let d = ship_rect.top - list_rect.top;
			if (d < 3) {
				this.e_list_div.scrollTop -= Math.ceil(3 - d);
			}
		}
	}
}

/**
 * @method ShipSelectorDialog#ev_show
 * @private
 */
function ShipSelectorDialog_ev_show(){
	this.refresh_list();
	this.move_to_center();
	if (this.autoscroll) this.scroll_to_selected_ship();
}

function ShipSelectorDialog_ev_keydown_query(e){
	if (e.key == "Escape") {
		e.preventDefault();
		if (this.e_query.value != "") {
			this.e_query.value = "";
			this.refresh_list();
		}
	}
}

/**
 * documentのkeydown
 * @param {KeyboardEvent} e
 * @method ShipSelectorDialog#ev_document_keydown
 * @protected
 */
function ShipSelectorDialog_ev_document_keydown(e){
	if (this.showing) {
		// 検索窓にフォーカスを移す
		// Ctrl+F or 入力中でないF
		if (e.key == "f" && !e.shiftKey && !e.altKey) {
			if (e.ctrlKey || (document.activeElement != this.e_query)) {
				this.e_query.select();
				e.preventDefault();
			}
		}
	}
}

function ShipSelectorDialog_ev_click_x(){
	if (this.e_query.value != "") {
		this.e_query.value = "";
		this.refresh_list();
	}
}

function ShipSelectorDialog_ev_click_ship(de_ship){
	this.set_selected_name(de_ship.ship ? de_ship.ship.name : "");
	if (this.autoclose_mode) {
		this.hide("ok");
	}
}

function ShipSelectorDialog_ev_dblclick_ship(de_ship){
	let name = de_ship.ship ? de_ship.ship.name : "";
	if (this.get_selected_name() == name) {
		this.hide("ok");
	}
}

