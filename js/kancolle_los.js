// 索敵計算機

// 艦情報 (kancolle_shiplist.csv)
let KANCOLLE_SHIPLIST = null;

// 装備情報 (kancolle_equipment.csv)
let KANCOLLE_EQUIPLIST = null;

// 除外リスト
// 基地関係
const IGNORE_CATEGORIES = [
	"陸上攻撃機",
	"陸軍戦闘機",
	"局地戦闘機",
	"陸上偵察機"
];

// 装備リストの割り振り
// 要素が列になる
const HINT_TABLE_CATEGORY_DEF = [
	[
		{category: "水上偵察機", header_bgcolor: "#cfc"},
		{category: "多用途水上機/水上爆撃機", viewname: "水上爆撃機", header_bgcolor: "#cfc"},
		{category: "水上戦闘機", header_bgcolor: "#9f9"},
		{category: "対潜哨戒機", header_bgcolor: "#eff"},
		{category: "回転翼機"  , header_bgcolor: "#eff"},
	], [
		{category: "小型電探"  , header_bgcolor: "#ffc"},
		{category: "大型電探"  , header_bgcolor: "#ffc"},
		{category: "艦上偵察機", header_bgcolor: "#ff8"},
		{category: "噴式戦闘爆撃機", header_bgcolor: "#ff8"},
		{viewname: "その他", other: true, header_bgcolor: "#ddd"},
	], [
		{category: "艦上攻撃機", header_bgcolor: "#59f"},
		{category: "艦上爆撃機", header_bgcolor: "#f66"},
		{category: "艦上戦闘機", header_bgcolor: "#7f7"},
	]
];

// 索敵の係数定義
// (装備索敵値 + sqrt(装備改修値) * impr_factor) * factor
const LOS_FACTOR_DEF = [
	{category: "水上偵察機", factor: 1.2, impr_factor: 1.2},
	{category: "多用途水上機/水上爆撃機", factor: 1.1, impr_factor: 1.15},
	{category: "艦上偵察機", factor: 1.0, impr_factor: 1.2},
	{category: "艦上攻撃機", factor: 0.8, impr_factor: 0},
	{category: "小型電探", factor: 0.6, impr_factor: 1.25},
	{category: "大型電探", factor: 0.6, impr_factor: 1.4},
];

const LOS_FACTOR_OTHER = {factor: 0.6, impr_factor: 0};

// その他の種別ID
const LOS_CATEGORY_OTHER_ID = 10000;

// 種別
const LOS_CATEGORIES_DEF = [
	{id: 1, category: "水上偵察機"},
	{id: 2, category: "多用途水上機/水上爆撃機", viewname: "水上爆撃機"},
	{id: 3, category: "水上戦闘機"},
	{id: 4, category: "対潜哨戒機"},
	{id: 5, category: "回転翼機"},
	{id: 6, category: "小型電探"},
	{id: 7, category: "大型電探"},
	{id: 8, category: "艦上偵察機"},
	{id: 9, category: "噴式戦闘爆撃機"},
	{id: 10, category: "艦上攻撃機"},
	{id: 11, category: "艦上爆撃機"},
	{id: 12, category: "艦上戦闘機"},
	{id: LOS_CATEGORY_OTHER_ID, viewname: "その他", other: true},
];


// デフォルトの数
const SHIP_COUNT_MAX = 12;
const EQUIPMENT_ROW_DEFAULT = 12;
const EQUIPMENT_ROW_MIN = 4;
const EQUIPMENT_ROW_MAX = 48;
const EQUIPMENT_ROW_EACH = 4;

const NULL_ID = 0;
const DIRECT_INPUT_ID = -1;


// 除外後装備リスト
// 索敵値も1以上のもののみとする
let kancolle_equiplist_los = new Array;

// 装備行管理オブジェクト
let equipment_rows = new Array;
let equipment_rows_show_count = 0;

// 初期化完了フラグ
let page_domloaded = false;
let page_initialized = false;

// 他のファイルのロードや初期化関数の呼び出し
let kancolle_shiplist_loader = httpload_csv_async("data/kancolle_shiplist.csv", true, function (obj){
	KANCOLLE_SHIPLIST = obj;
	kancolle_los_init();
});

let kancolle_equipment_loader = httpload_csv_async("data/kancolle_equipment.csv", true, function (obj){
	KANCOLLE_EQUIPLIST = obj;
	kancolle_los_init();
});

document.addEventListener("DOMContentLoaded", function (){
	page_domloaded = true;
	kancolle_los_init();
});



// EquipmentRow ------------------------------------------------------------------------------------
Object.assign(EquipmentRow.prototype, {
	// DOMオブジェクト
	e_tr         : null,
	e_number_cell: null,
	e_equiplist  : null,
	e_category   : null,
	e_improvement: null,
	e_los        : null,
	e_score_cell : null,
	
	// 変更があった場合に呼ばれる関数
	// DOMイベントにのみ反応、スクリプトによる変更には反応しない
	onchange     : null,
	
	// 表示する数字　ID代わりにも使用するのでユニークに
	number: -1,
	// 現在の表示制限
	restrict_data: null,
	
	// method
	create_row       : EquipmentRow_create_row,
	clear_form       : EquipmentRow_clear_form,
	set_number       : EquipmentRow_set_number,
	set_equipment_number: EquipmentRow_set_equipment_number,
	set_auto_input   : EquipmentRow_set_auto_input,
	refresh_score1   : EquipmentRow_refresh_score1,
	get_score1       : EquipmentRow_get_score1,
	empty            : EquipmentRow_empty,
	set_impr_class   : EquipmentRow_set_impr_class,
	restrict_category: EquipmentRow_restrict_category,
	call_onchange    : EquipmentRow_call_onchange,
	copy_from        : EquipmentRow_copy_from,
	swap             : EquipmentRow_swap,
	set_json_object  : EquipmentRow_set_json_object,
	get_json_object  : EquipmentRow_get_json_object,
	
	// event
	ev_change_equiplist: EquipmentRow_ev_change_equiplist,
	ev_change_category : EquipmentRow_ev_change_category,
	ev_change_impr     : EquipmentRow_ev_change_impr,
	ev_change_los      : EquipmentRow_ev_change_los,
	// D&D event
	ev_dragstart: EquipmentRow_ev_dragstart,
	ev_dragover : EquipmentRow_ev_dragover,
	ev_drop     : EquipmentRow_ev_drop,
});


function EquipmentRow(){
}

function EquipmentRow_create_row(number, create_equiplist){
	// DOMオブジェクトの作成
	this.e_number_cell = create_cell("td", "", 1, 1, "number");
	this.e_equiplist   = create_select("", "equiplist");
	this.e_category    = create_select("", "category");
	this.e_improvement = create_select("", "improvement");
	this.e_los         = create_input("number", "", "", "los");
	this.e_score_cell  = create_cell("td", "", 1, 1, "score1");
	
	let cells = [
		this.e_number_cell,
		create_cell("td"),
		create_cell("td"),
		create_cell("td"),
		create_cell("td"),
		this.e_score_cell
	];
	
	cells[1].appendChild(this.e_equiplist);
	cells[2].appendChild(this.e_category);
	cells[3].appendChild(this.e_improvement);
	cells[4].appendChild(this.e_los);
	
	this.e_tr = create_row(cells);
	
	// フォームを初期化
	
	// 種別
	this.e_category.appendChild(new Option("-", 0));
	for (let def of LOS_CATEGORIES_DEF) {
		if (def.hidden) continue;
		
		let option = new Option(def.viewname || def.category, def.id);
		this.e_category.appendChild(option);
	}
	
	// 改修
	for (let i=0; i<=10; i++) {
		this.e_improvement.appendChild(new Option("★" + i, i));
	}
	
	// 索敵
	this.e_los.min = 0;
	this.e_los.max = 99;
	
	// 装備名はこっちで生成
	// 数が多く生成に時間がかかる
	if (create_equiplist) {
		this.restrict_category(null, true, NULL_ID);
	}
	
	if (number) this.set_number(number);
	
	// event
	this.e_equiplist  .addEventListener("change", e => this.ev_change_equiplist(e));
	this.e_category   .addEventListener("change", e => this.ev_change_category(e));
	this.e_improvement.addEventListener("change", e => this.ev_change_impr(e));
	this.e_los        .addEventListener("change", e => this.ev_change_los(e));
	
	this.e_number_cell.draggable = true;
	this.e_number_cell.addEventListener("dragstart", e => this.ev_dragstart(e));
	this.e_number_cell.addEventListener("dragover" , e => this.ev_dragover(e));
	this.e_number_cell.addEventListener("drop"     , e => this.ev_drop(e));
}


function EquipmentRow_refresh_score1(){
	let score_str = "";
	let score_hint_str = "";
	
	if (!this.empty()) {
		let obj = new Object;
		let score = this.get_score1(obj);
		
		if (score >= 0) {
			// 切り捨て
			score_str = float_to_string(score, 3, -1);
			score_hint_str = "係数1スコア: " + score;
			
			let formula = obj.los;
			if (obj.impr_factor > 0) {
				formula += " + sqrt(" + obj.impr + ") * " + obj.impr_factor;
				formula = "(" + formula + ")";
			}
			formula += " * " + obj.factor;
			
			score_hint_str += "\n= " + formula;
		}
	}
	
	this.e_score_cell.textContent = score_str;
	this.e_score_cell.title = score_hint_str;
}


// 係数1スコア
// エラー時は負数
// arg_out[optional]: 追加情報を受け取るオブジェクト
// {score1, factor, impr_factor, los, impr}
function EquipmentRow_get_score1(arg_out){
	let out = arg_out || new Object;
	out.factor = 0;
	out.impr_factor = 0;
	out.score1 = -1;
	
	let cat_id = this.e_category.value;
	let impr = formstr_to_int(this.e_improvement.value, -1, -1);
	let los = formstr_to_int(this.e_los.value, 0, -1);
	if (impr.value < 0 || los.value < 0) return -1;
	
	out.impr = impr.value;
	out.los = los.value;
	
	let cat_name = "";
	for (let def of LOS_CATEGORIES_DEF) {
		if (def.id == cat_id) {
			cat_name = def.category || def.viewname;
			break;
		}
	}
	
	if (cat_name) {
		get_los_factors_by_category(out, cat_name);
		out.score1 = (los.value + Math.sqrt(impr.value) * out.impr_factor) * out.factor;
		
	} else {
		out.score1 = (cat_id == NULL_ID ? 0 : -1);
	}
	
	return out.score1;
}

// 入力がないかどうか
// get_score1()では0のときに判定できないので
function EquipmentRow_empty(){
	return (
		this.e_equiplist.value == NULL_ID &&
		this.e_category.value == NULL_ID &&
		this.e_improvement.value == 0 &&
		this.e_los.value == ""
	);
}


// 改修値の色
function EquipmentRow_set_impr_class(){
	// unknown, nothing, effective
	let className = "unknown";
	
	let cat_id = this.e_category.value;
	let cat_name = "";
	for (let def of LOS_CATEGORIES_DEF) {
		if (def.id == cat_id) {
			cat_name = def.category || def.viewname;
			break;
		}
	}
	
	if (cat_name) {
		let obj = get_los_factors_by_category({}, cat_name);
		className = obj.impr_factor > 0 ? "effective" : "nothing";
	}
	
	this.e_improvement.classList.remove("unknown");
	this.e_improvement.classList.remove("effective");
	this.e_improvement.classList.remove("nothing");
	this.e_improvement.classList.add(className);
}


// 選択できる装備を制限
function EquipmentRow_restrict_category(restrict_ids, grouping, new_value){
	let old_value = this.e_equiplist.value;
	remove_children(this.e_equiplist);
	
	this.e_equiplist.appendChild(new Option("-", NULL_ID));
	this.e_equiplist.appendChild(new Option("[直接入力]", DIRECT_INPUT_ID));
	
	// カテゴリーリスト
	let category_list = new Array;
	let category_ids = new Array;
	let category_names = new Array;
	
	for (let def of LOS_CATEGORIES_DEF) {
		category_list.push(def.category || def.viewname);
		category_ids.push(def.id);
		category_names.push(def.viewname || def.category);
	}
	
	let cated = categorize_equipment(grouping ? array_to_existmap(category_list) : null);
	
	if (grouping) {
		for (let i=0; i<category_list.length; i++) {
			// 制限あり＆リストになし
			if (restrict_ids && restrict_ids.findIndex(x => x == category_ids[i]) < 0) continue;
			
			let optgroup = document.createElement("optgroup");
			optgroup.label = category_names[i];
			
			let cat;
			if (category_ids[i] == LOS_CATEGORY_OTHER_ID) {
				// その他
				cat = cated.other_list;
			} else {
				cat = cated.data[category_list[i]];
			}
			
			for (let j=0; j<cat.length; j++) {
				let eq = cat[j];
				optgroup.appendChild(equip_to_option(eq));
			}
			this.e_equiplist.appendChild(optgroup);
		}
		
	} else {
		for (let i=0; i<cated.other_list.length; i++) {
			let eq = cated.other_list[i];
			this.e_equiplist.appendChild(equip_to_option(eq));
		}
	}
	
	this.e_equiplist.value = arguments.length <= 2 ? old_value : new_value;
	
	// コピーのためにデータを残しておく
	this.restrict_data = [restrict_ids, grouping, new_value];
}


// number(装備名の左にあるやつ)をセット
// 装備のnumberとかぶってしまったが、まあ
function EquipmentRow_set_number(number){
	this.number = number;
	this.e_number_cell.textContent = number;
}

// 装備IDを指定
function EquipmentRow_set_equipment_number(eq_number){
	if (this.restrict_data && this.restrict_data[0]) {
		// カテゴリが選択されているので解除
		this.restrict_category(null, true, NULL_ID);
	}
	
	// 装備IDが正しいか確認する
	if (KANCOLLE_EQUIPLIST.find(x => x.number == eq_number)) {
		this.e_equiplist.value = eq_number;
		this.set_auto_input();
		return true;
	}
	return false;
}

// 選択された装備から自動入力
function EquipmentRow_set_auto_input(){
	// 種別、索敵を自動セット
	let eq_number = this.e_equiplist.value;
	
	if (eq_number == NULL_ID) {
		// クリア
		this.clear_form();
		
	} else if (eq_number == DIRECT_INPUT_ID) {
		// 直接入力になった
		// 特に何もしない
		
	} else {
		// 装備が変更された
		for (let eq of kancolle_equiplist_los) {
			if (eq.number == eq_number) {
				let cat_id = 0;
				for (let cate of LOS_CATEGORIES_DEF) {
					if (cate.category == eq.category) {
						cat_id = cate.id;
						break;
					}
				}
				
				if (cat_id > 0) {
					this.e_category.value = cat_id;
				} else {
					this.e_category.value = LOS_CATEGORY_OTHER_ID;
				}
				this.e_los.value = eq.LoS;
				break;
			}
		}
	}
}

function EquipmentRow_clear_form(clear_all){
	this.e_equiplist.value = NULL_ID;
	this.e_category.value = NULL_ID;
	this.e_improvement.value = 0;
	this.e_los.value = "";
	this.restrict_category(null, true, NULL_ID);
	
	// 表示等もクリア
	if (clear_all) {
		this.refresh_score1();
		this.set_impr_class();
	}
}

// 変更があったことを通知
// この関数を呼ぶのはイベント関数からのみにする
function EquipmentRow_call_onchange(){
	if (this.onchange) {
		this.onchange.call();
	}
}

function EquipmentRow_copy_from(eq, norestrict){
	if (!norestrict) {
		if (eq.restrict_data) {
			this.restrict_category(eq.restrict_data[0], true, NULL_ID);
		} else {
			this.restrict_category(null, true, NULL_ID);
		}
	} else {
		// フォームの再生成を行わない
		this.restrict_data = eq.restrict_data;
	}
	
	this.e_equiplist.value   = eq.e_equiplist.value;
	this.e_category.value    = eq.e_category.value;
	this.e_improvement.value = eq.e_improvement.value;
	this.e_los.value         = eq.e_los.value;
}

function EquipmentRow_swap(eq){
	let temp = EquipmentRow_swap.temporary;
	if (!temp) {
		temp = new EquipmentRow;
		temp.create_row(9999, true);
		EquipmentRow_swap.temporary = temp;
	}
	
	temp.copy_from(this, true);
	this.copy_from(eq);
	eq.copy_from(temp);
}


function EquipmentRow_set_json_object(obj){
	if (obj.equipment_id == NULL_ID) {
		this.clear_form();
		
	} else {
		if (obj.equipment_id == DIRECT_INPUT_ID || !this.set_equipment_number(obj.equipment_id)) {
			this.restrict_category(null, true, DIRECT_INPUT_ID);
			this.e_category.value = obj.category;
			this.e_los.value = obj.los;
		}
		
		this.e_improvement.value = obj.improvement;
	}
	
	this.refresh_score1();
	this.set_impr_class();
}

function EquipmentRow_get_json_object(){
	return {
		equipment_id: this.e_equiplist.value,
		category    : this.e_category.value,
		improvement : this.e_improvement.value,
		los         : this.e_los.value,
	};
}


function EquipmentRow_ev_change_equiplist(){
	// 装備の変更
	this.set_auto_input();
	
	this.refresh_score1();
	this.set_impr_class();
	this.call_onchange();
}


function EquipmentRow_ev_change_category(){
	//// 装備名を直接入力へ変更
	//this.e_equiplist.value = DIRECT_INPUT_ID;
	// カテゴリーを制限する
	if (this.e_category.value != NULL_ID) {
		this.restrict_category([this.e_category.value], true, DIRECT_INPUT_ID);
	} else {
		this.restrict_category(null, true, DIRECT_INPUT_ID);
	}
	
	this.refresh_score1();
	this.set_impr_class();
	this.call_onchange();
}

function EquipmentRow_ev_change_impr(){
	this.refresh_score1();
	this.call_onchange();
}

function EquipmentRow_ev_change_los(){
	// 装備名を直接入力へ変更
	this.e_equiplist.value = DIRECT_INPUT_ID;
	this.refresh_score1();
	this.call_onchange();
}

function EquipmentRow_ev_dragstart(e){
	e.dataTransfer.setData("drag_data", "equipment:" + this.number);
}

function EquipmentRow_ev_dragover(e){
	let text = e.dataTransfer.getData("drag_data");
	
	if (/^equipment:(.+)$/.test(text)) {
		let number = RegExp.$1;
		if (this.number != number) {
			e.preventDefault();
		}
	}
}

function EquipmentRow_ev_drop(e){
	let text = e.dataTransfer.getData("drag_data");
	
	if (/^equipment:(.+)$/.test(text)) {
		let number = RegExp.$1;
		let eq = equipment_rows.find(x => x.number == number);
		
		if (this.number != number && eq) {
			if (e.ctrlKey && !e.shiftKey && !e.altKey) {
				this.copy_from(eq);
			} else {
				this.swap(eq);
			}
			
			this.refresh_score1();
			this.set_impr_class();
			eq.refresh_score1();
			eq.set_impr_class();
			this.call_onchange();
			
			e.preventDefault();
		}
	}
}


// 初期化関数 --------------------------------------------------------------------------------------
// ロード完了の可能性がある場合に何度か呼ばれる
function kancolle_los_init(){
	// ロード完了時に一度だけ実行する
	if (page_initialized) return;
	if (!KANCOLLE_SHIPLIST) return;
	if (!KANCOLLE_EQUIPLIST) return;
	if (!page_domloaded) return;
	page_initialized = true;
	
	kancolle_shiplist_loader = null;
	kancolle_equipment_loader = null;
	
	// 変数の初期化
	for (let eq of KANCOLLE_EQUIPLIST) {
		if (!eq.LoS || eq.LoS == "0") continue;
		if (IGNORE_CATEGORIES.findIndex(x => x == eq.category) >= 0) continue;
		
		kancolle_equiplist_los.push(eq);
	}
	
	// 計算結果欄
	DOM("HQ_level").addEventListener("change", ev_change_HQ_level);
	DOM("HQ_level_modify").addEventListener("change", ev_change_HQ_level_modify);
	DOM("memo").addEventListener("change", ev_change_memo);
	
	// 艦娘索敵値欄の初期化
	for (let i=0; i<SHIP_COUNT_MAX; i++) {
		let e = DOM("ship_los_" + (i + 1));
		e.addEventListener("change", ev_change_ship_los);
		e.addEventListener("keydown", ev_keydown_ship_los);
		
		let numcell = e.parentElement.previousElementSibling;
		numcell.id = "shipnum_" + (i + 1);
		numcell.draggable = true;
		numcell.addEventListener("dragstart", ev_ship_dragstart);
		numcell.addEventListener("dragover", ev_ship_dragover);
		numcell.addEventListener("drop", ev_ship_drop);
	}
	DOM("clear_ship_los").addEventListener("click", ev_click_clear_ship_los);
	
	init_assist();
	init_equip_table();
	init_hint_table();
	expand_title_newline();
	init_los_record();
	
	refresh_score();
}


// 装備入力欄の生成
function init_equip_table(){
	let table = DOM("equip_table");
	
	remove_children(table.tBodies[0]);
	
	for (let i=0; i<EQUIPMENT_ROW_MAX; i++) {
		let row = new EquipmentRow;
		row.create_row(i + 1, false);
		row.onchange = ev_change_equipment;
		equipment_rows.push(row);
	}
	
	change_equiprow_count(EQUIPMENT_ROW_DEFAULT);
	
	// 最終更新日
	let last_modified = get_csv_last_modified(KANCOLLE_EQUIPLIST);
	let th = DOM("hint_table_header");
	if (last_modified && th) {
		th.title += "\nデータの最終更新日: " + strYMD(last_modified);
	}
	
	// 増やす・減らす・クリア
	DOM("increase_rows").addEventListener("click", ev_click_increase_rows);
	DOM("decrease_rows").addEventListener("click", ev_click_decrease_rows);
	DOM("clear_equiplist").addEventListener("click", ev_click_clear_equiplist);
}


// 装備リストの生成
function init_hint_table(){
	let table = DOM("hint_table");
	
	// 表示が決まっているカテゴリ名
	let show_categories = new Object;
	
	for (let def of HINT_TABLE_CATEGORY_DEF) {
		for (let d=0; d<def.length; d++) {
			if (def[d].category) {
				show_categories[def[d].category] = true;
			}
		}
	}
	
	let cated = categorize_equipment(show_categories);
	// その他で表示する装備品
	let other_list = cated.other_list;
	// カテゴリ分けされたデータ
	let categorized_data = cated.data;
	
	// セルリストの生成
	let rows = new Array;
	
	function _append_cell(row_index, col_index, cell){
		if (!rows[row_index]) rows[row_index] = new Array;
		_append_empty_cell(rows[row_index], col_index);
		rows[row_index].push(cell);
	}
	// 空欄を空のセルで埋める
	function _append_empty_cell(row, col_end_index){
		let index = 0;
		for (let i=0; i<row.length; i++) {
			index += row[i].colSpan;
		}
		for (; index<col_end_index; index+=2) {
			row.push(create_cell("td", "", 2, 1, "empty"));
		}
	}
	
	for (let c=0; c<HINT_TABLE_CATEGORY_DEF.length; c++) {
		let def = HINT_TABLE_CATEGORY_DEF[c];
		let next_row_index = 0;
		
		for (let d=0; d<def.length; d++) {
			if (def[d].hidden) continue;
			
			// ヘッダー
			if (!def[d].noheader) {
				let th = create_cell("th", "", 2, 1, "header");
				let div = document.createElement("div");
				div.textContent = unescape_charref(def[d].viewname || def[d].category);
				th.appendChild(div);
				
				if (def[d].header_bgcolor) {
					th.style.backgroundColor = def[d].header_bgcolor;
				}
				
				let fc = get_los_factors_by_category({}, def[d].category);
				let formula = "装備索敵値";
				if (fc.impr_factor > 0) {
					formula += " + sqrt(★) * " + fc.impr_factor;
					formula = "(" + formula + ")";
				}
				formula += " * " + fc.factor;
				th.title = "係数1スコア = " + formula;
				
				_append_cell(next_row_index++, c * 2, th);
			}
			
			// 内容
			let list = null;
			if (def[d].other) {
				// その他
				list = other_list;
			} else if (def[d].category && categorized_data.hasOwnProperty(def[d].category)) {
				list = categorized_data[def[d].category];
			}
			
			if (list) {
				for (let i=0; i<list.length; i++) {
					// 索敵値があるもののみ
					if (+list[i].LoS > 0) {
						let namecell = create_cell("td", "", 1, 1, "name");
						let div = document.createElement("div");
						div.textContent = unescape_charref(list[i].name);
						namecell.appendChild(div);
						
						// 装備ID
						namecell.dataset.equipmentNumber = list[i].number;
						// ダブルクリックを可能に
						namecell.addEventListener("dblclick", ev_dblclick_hint);
						
						_append_cell(next_row_index, c * 2, namecell);
						_append_cell(next_row_index, c * 2, create_cell("td", list[i].LoS, 1, 1, "los"));
						next_row_index++;
					}
				}
			}
		}
	}
	
	// 右の方の空欄埋め
	for (let i=0; i<rows.length; i++) {
		_append_empty_cell(rows[i], HINT_TABLE_CATEGORY_DEF.length * 2);
	}
	
	// tableへ
	let tbody = table.tBodies[0];
	for (let i=0; i<rows.length; i++) {
		tbody.appendChild(create_row(rows[i]))
	}
}


// event -------------------------------------------------------------------------------------------
// 艦娘索敵値が変更された
function ev_change_ship_los(){
	refresh_score();
	refresh_savebutton_state();
	save_losdata();
}

// 艦娘索敵値でキーを押した
function ev_keydown_ship_los(e){
	if (e.key == "Enter" && /\d+/.test(e.target.id)) {
		// 次のフォームへ
		let num = +RegExp.lastMatch;
		if (e.shiftKey) num--; else num++;
		
		let next = DOM("ship_los_" + num);
		if (next) {
			next.select(); //next.focus();
			e.preventDefault();
		}
	}
}

function ev_click_clear_ship_los(){
	for (let i=1; i<=SHIP_COUNT_MAX; i++) {
		let e = DOM("ship_los_" + i);
		e.value = "";
	}
	refresh_score();
	refresh_savebutton_state();
	save_losdata();
}

// 装備が変更された
// スコア1の表示等についてはクラス内で完結しているので改めて呼び出してはならない
function ev_change_equipment(){
	refresh_score();
	refresh_savebutton_state();
	save_losdata();
}

// 司令部レベルが変更された
function ev_change_HQ_level(){
	refresh_score();
	refresh_savebutton_state();
	save_losdata();
}

// 司令部補正の計算式が変更された
function ev_change_HQ_level_modify(){
	refresh_score();
	refresh_savebutton_state();
	save_losdata();
}

// メモの変更
function ev_change_memo(){
	refresh_savebutton_state();
	save_losdata();
}


// dragdrop(艦娘索敵値)
function ev_ship_dragstart(e){
	// id: shipnum_[number]
	e.dataTransfer.setData("drag_data", "ship:" + e.target.id);
}

function ev_ship_dragover(e){
	// dragoverイベントが有効になっている場所のうち、デフォルトをキャンセルした要素がドロップ可能な場所
	let text = e.dataTransfer.getData("drag_data");
	if (/^ship:/.test(text)) {
		let drag_id = RegExp.rightContext;
		if (/^shipnum_\d+$/.test(e.target.id) && drag_id != e.target.id) {
			e.preventDefault();
		}
	}
}

function ev_ship_drop(e){
	// ドロップ
	let text = e.dataTransfer.getData("drag_data");
	
	if (/^ship:/.test(text)) {
		let drag_id = RegExp.rightContext;
		
		// Ctrlのみを押している場合はコピー
		if (e.ctrlKey && !e.shiftKey && !e.altKey) {
			copy_ship(_id_to_num(drag_id), _id_to_num(e.target.id));
		} else {
			swap_ship(_id_to_num(drag_id), _id_to_num(e.target.id));
		}
		
		e.preventDefault();
		refresh_score();
		refresh_savebutton_state();
		save_losdata();
	}
	
	function _id_to_num(id){
		return /shipnum_(\d+)/.test(id) ? RegExp.$1 : "";
	}
}


function ev_click_increase_rows(e){
	let new_count = Math.min(equipment_rows_show_count + EQUIPMENT_ROW_EACH, EQUIPMENT_ROW_MAX);
	change_equiprow_count(new_count);
	refresh_savebutton_state();
	save_losdata();
}

function ev_click_decrease_rows(e){
	let new_count = Math.max(equipment_rows_show_count - EQUIPMENT_ROW_EACH, EQUIPMENT_ROW_MIN);
	change_equiprow_count(new_count);
	refresh_savebutton_state();
	save_losdata();
}

function ev_click_clear_equiplist(e){
	for (let i=0; i<equipment_rows_show_count; i++) {
		equipment_rows[i].clear_form(true);
	}
	refresh_score();
	refresh_savebutton_state();
	save_losdata();
}


// 装備の追加
function ev_dblclick_hint(e){
	let eq_number = +e.currentTarget.dataset.equipmentNumber;
	
	if (eq_number > 0) {
		// 追加位置: 最後に入力のある行の次の行
		let insert_pos = 0;
		for (let i=0; i<equipment_rows_show_count; i++) {
			if (!equipment_rows[i].empty()) {
				insert_pos = i + 1;
			}
		}
		if (insert_pos >= equipment_rows_show_count) return;
		
		let row = equipment_rows[insert_pos];
		row.set_equipment_number(eq_number);
		row.refresh_score1();
		row.set_impr_class();
		refresh_score();
		refresh_savebutton_state();
		save_losdata();
		
		e.preventDefault();
	}
}


// DOM関数 -----------------------------------------------------------------------------------------
// 装備の表示行数の変更
// 増やす場合は EQUIPMENT_ROW_MAX 以下、減らす場合は EQUIPMENT_ROW_MIN 以上かつ空きが empty
// 変更できたら true
function change_equiprow_count(new_count){
	let tbody = DOM("equip_table").tBodies[0];
	
	if (new_count > equipment_rows_show_count) {
		// 増やす
		if (new_count > EQUIPMENT_ROW_MAX) return false;
		
		// equipment_rows_show_count .. new_count - 1 の要素を追加すれば良い
		for (let i=equipment_rows_show_count; i<new_count; i++) {
			equipment_rows[i].restrict_category(null, true, NULL_ID);
			tbody.appendChild(equipment_rows[i].e_tr);
		}
		equipment_rows_show_count = new_count;
		
	} else if (new_count < equipment_rows_show_count) {
		// 減らす
		// 非表示にするフォームが空でないといけない
		for (let i=new_count; i<equipment_rows_show_count; i++) {
			if (!equipment_rows[i].empty()) {
				return false;
			}
		}
		
		for (let i=new_count; i<equipment_rows_show_count; i++) {
			tbody.removeChild(equipment_rows[i].e_tr);
		}
		equipment_rows_show_count = new_count;
	}
	
	return true;
}


// 司令部補正
// エラー時は負数
function get_HQ_modify(){
	let e_select = DOM("HQ_level_modify");
	let hqm = e_select.value;
	let HQ_level = formstr_to_int(DOM("HQ_level").value, -100, -100);
	let HQ_modify = -1;
	
	if (hqm == "hqm035p6") {
		// Lv120で係数0.4式と同じになるように補正する
		HQ_modify = Math.ceil(0.35 * HQ_level.value) + 6;
		
	} else {
		if (hqm != "hqm040") {
			console.log("不明な司令部補正:", hqm);
		}
		HQ_modify = Math.ceil(0.4 * HQ_level.value);
		// こういう式も
		//HQ_modify = excel_roundup(0.4 * (HQ_level.value - 120) + 30) + 18;
	}
	
	return HQ_modify;
	
	function excel_roundup(x){
		return x >= 0 ? Math.ceil(x) : Math.floor(x);
	}
}


// 索敵スコアの再計算と表示
// 司令部補正も再表示
function refresh_score(){
	let ship_count = 0;
	let ship_error = 0;
	let fleet_score = 0;
	
	for (let i=0; i<SHIP_COUNT_MAX; i++) {
		let e = DOM("ship_los_" + (i + 1));
		let x = formstr_to_int(e.value, 0, -1);
		
		if (x.value > 0) {
			ship_count++;
			fleet_score += Math.sqrt(x.value);
		} else if (x.value < 0) {
			ship_error++;
		}
	}
	
	let equip_error = 0;
	let equip_score = 0;
	
	for (let i=0; i<equipment_rows.length; i++) {
		let sc = equipment_rows[i].get_score1();
		if (sc > 0) {
			equip_score += sc;
		} else if (sc < 0) {
			equip_error++;
		}
	}
	
	// 索敵スコア＝分岐点係数×(装備倍率×装備索敵値)の和＋√(各艦娘の素索敵)の和－司令部補正＋2×(6－艦数)
	// 司令部補正の部分は2パターン存在する？
	//let HQ_modify = Math.ceil(0.4 * HQ_level.value);
	let HQ_modify = get_HQ_modify();
	let ship_count_score = 2 * (6 - ship_count);
	
	// スコアは切り捨て、ポップアップで元の値を表示
	DOM("fleet_score").textContent = ship_error  == 0 ? float_to_string(fleet_score, 3, -1) : "";
	DOM("fleet_score").title       = ship_error  == 0 ? fleet_score : "";
	DOM("equip_score").textContent = equip_error == 0 ? float_to_string(equip_score, 3, -1) : "";
	DOM("equip_score").title       = equip_error == 0 ? equip_score : "";
	DOM("ship_count" ).textContent = ship_count;
	DOM("ship_count" ).title       = ship_count >= 1 ? "艦数補正:\n索敵スコア" + (ship_count_score >= 0 ? "+" :"") + ship_count_score : "";
	
	let noerror = ship_error == 0 && equip_error == 0 && HQ_modify > 0;
	noerror = noerror && ship_count >= 1;
	
	for (let c=1; c<=4; c++) {
		let score = equip_score * c + fleet_score - HQ_modify + ship_count_score;
		DOM("los_score_" + c).textContent = noerror ? float_to_string(score, 3, -1) : "";
		DOM("los_score_" + c).title       = noerror ? score : "";
	}
	
	DOM("HQ_level_modify_cell").textContent = HQ_modify > 0 ? HQ_modify : "";
}


// 艦娘索敵値
// a番をb番にコピー
function copy_ship(a, b){
	let ship_a = DOM("ship_los_" + a);
	let ship_b = DOM("ship_los_" + b);
	
	if (!ship_a || !ship_b) {
		console.log("copyできません:", a, b);
		return;
	}
	
	ship_b.value = ship_a.value;
}

// a番とb番を入れ替え
function swap_ship(a, b){
	let ship_a = DOM("ship_los_" + a);
	let ship_b = DOM("ship_los_" + b);
	
	if (!ship_a || !ship_b) {
		console.log("swapできません:", a, b);
		return;
	}
	
	let val = ship_a.value;
	ship_a.value = ship_b.value;
	ship_b.value = val;
}


function equip_to_option(eq){
	let option = new Option(unescape_charref(eq.name), eq.number);
	option.title = "索敵+" + eq.LoS;
	return option;
}



// その他 ------------------------------------------------------------------------------------------
// 装備をカテゴリー分け
// 戻り値: {data: カテゴリー分けされたデータ, other_list: その他}
function categorize_equipment(cate_obj){
	let data = new Object;
	let other_list = new Array;
	
	for (let eq of kancolle_equiplist_los) {
		if (!data.hasOwnProperty(eq.category)) {
			data[eq.category] = new Array;
		}
		data[eq.category].push(eq);
		
		if (!cate_obj || !cate_obj.hasOwnProperty(eq.category)) {
			other_list.push(eq);
		}
	}
	
	return {data: data, other_list: other_list};
}

// カテゴリー名から改修係数情報を得る
function get_los_factors_by_category(out, category){
	let obj = out || {};
	obj.factor = LOS_FACTOR_OTHER.factor;
	obj.impr_factor = LOS_FACTOR_OTHER.impr_factor;
	
	for (let def of LOS_FACTOR_DEF) {
		if (def.category == category) {
			obj.factor = def.factor;
			obj.impr_factor = def.impr_factor;
			break;
		}
	}
	
	return obj;
}

function array_to_existmap(array){
	let obj = new Object;
	if (array) {
		for (let i=0; i<array.length; i++) {
			obj[array[i]] = true;
		}
	}
	return obj;
}

