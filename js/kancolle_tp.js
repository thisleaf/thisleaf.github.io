
// データ
// constは気分
const SHIPTYPE_TP_DEFINITION = [
	{id: 0 , name: "なし"      , tp_s: 0, viewname: "-"},
	
	{id: 1 , name: "駆逐艦"    , tp_s: 5},
	{id: 2 , name: "軽巡洋艦"  , tp_s: 2},
	{id: 11, name: "鬼怒改二"  , tp_s: 10, viewname: "軽巡洋艦 (鬼怒改二)"},
	{id: 3 , name: "水上機母艦", tp_s: 9},
	{id: 4 , name: "航空巡洋艦", tp_s: 4},
	{id: 5 , name: "航空戦艦"  , tp_s: 7},
	{id: 6 , name: "練習巡洋艦", tp_s: 6},
	{id: 7 , name: "補給艦"    , tp_s: 15},
	{id: 8 , name: "揚陸艦"    , tp_s: 12},
	{id: 9 , name: "潜水空母"  , tp_s: 1},
	{id: 10, name: "潜水母艦"  , tp_s: 7},
	
	// 以下はTP0
	{id: 101, name: "戦艦"        , tp_s: 0},
	{id: 102, name: "正規空母"    , tp_s: 0},
	{id: 103, name: "軽空母"      , tp_s: 0},
	{id: 104, name: "重巡洋艦"    , tp_s: 0},
	{id: 105, name: "重雷装巡洋艦", tp_s: 0},
	{id: 106, name: "海防艦"      , tp_s: 0},
];

const EQUIPMENT_TP_DEFINITION = [
	{id: 1, name: "ドラム缶"    , tp_s: 5},
	{id: 2, name: "大発動艇"    , tp_s: 8},
	{id: 3, name: "特二式内火艇", tp_s: 2},
	{id: 4, name: "戦闘糧食"    , tp_s: 1},
];

const SHIP_MAX_COUNT = 12;
const KANCOLLE_TP_STORAGEKEY = "kancolle_tp_formdata";


document.addEventListener("DOMContentLoaded", kancolle_tp_init);


// -------------------------------------------------------------------------------------------------
function kancolle_tp_init(){
	// 初期化とイベントの設定
	function _set_change_ev(id, ev){
		let elem = DOM(id);
		if (elem) {
			elem.addEventListener("change", ev);
		} else {
			console.log("id: " + id + " が見つかりません");
		}
	}
	
	let usertps = ["user_1_S", "user_2_S", "user_3_S"];
	let counts = [
		"drum", "daihatsu", "naikatei", "onigiri",
		"user_1_count", "user_2_count", "user_3_count"
	];
	
	for (let i=1; i<=SHIP_MAX_COUNT; i++) {
		let sel = DOM("ship_" + i);
		if (sel) init_shiplist(sel);
	}
	for (let i=0; i<usertps.length; i++) {
		_set_change_ev(usertps[i], ev_change_usertp);
	}
	for (let i=0; i<counts.length; i++) {
		_set_change_ev(counts[i], ev_change_count);
	}
	_set_change_ev("remaining_tp", ev_change_remaining_tp);
	_set_change_ev("record_data", ev_change_record_data);
	_set_change_ev("use_noerror", ev_change_use_noerror);
	DOM("clear_button").addEventListener("click", ev_click_clear_button);
	
	// D&Dで入れ替え可能にする
	init_dragdrop();
	
	// データの読み込み
	load_formdata();
	
	// セル表示と太字
	refresh_table();
	
	// 計算
	calc_tp();
	
	// ヒント
	init_hint_table();
	
	console.log("も");
}


function init_shiplist(select){
	remove_children(select);
	
	var group_t = document.createElement("optgroup");
	group_t.label = "TPあり";
	var group_tp0 = document.createElement("optgroup");
	group_tp0.label = "TPなし";
	
	for (let i=0; i<SHIPTYPE_TP_DEFINITION.length; i++) {
		let d = SHIPTYPE_TP_DEFINITION[i];
		let opt = new Option(d.viewname || d.name, d.id);
		
		// グループ化する
		if (d.tp_s > 0) {
			group_t.appendChild(opt);
		} else if (d.id > 0) {
			group_tp0.appendChild(opt);
		} else {
			select.appendChild(opt);
		}
	}
	
	select.appendChild(group_t);
	select.appendChild(group_tp0);
	
	select.addEventListener("change", ev_change_ship);
}


function init_dragdrop(){
	let table = DOM("input_table");
	let tbody = table.tBodies[0];
	
	for (let i=0; i<tbody.rows.length; i++) {
		let td = tbody.rows[i].cells[0];
		td.draggable = true;
		
		td.addEventListener("dragstart", ev_dragstart);
		td.addEventListener("dragover", ev_dragover);
		td.addEventListener("drop", ev_drop);
	}
}


function init_hint_table(){
	let table = DOM("hint_table");
	remove_children(table);
	
	let cap = document.createElement("caption");
	cap.textContent = "艦種TPの一覧";
	table.appendChild(cap);
	
	let tbody = document.createElement("tbody");
	let show_arr = new Array;
	let tp0_names = new Array;
	
	for (let i=0; i<SHIPTYPE_TP_DEFINITION.length; i++) {
		let d = SHIPTYPE_TP_DEFINITION[i];
		
		if (d.tp_s > 0) {
			show_arr.push(d);
		} else if (d.id > 0) {
			tp0_names.push(d.viewname || d.name);
		}
	}
	
	let row_length = Math.ceil(show_arr.length / 2);
	
	// 艦種,S勝利,A勝利 を2つ並べる
	tbody.appendChild( create_row([
		create_cell("th"),
		create_cell("th", "S勝利"),
		create_cell("th", "A勝利"),
		create_cell("th"),
		create_cell("th", "S勝利"),
		create_cell("th", "A勝利"),
	]) );
	
	for (let i=0; i<row_length; i++) {
		let tr = create_row();
		_append_cells(tr, show_arr[i]);
		_append_cells(tr, show_arr[row_length + i]);
		tbody.appendChild(tr);
	}
	
	// TP0のリスト
	let tp0_text = "※ " + tp0_names.join("、") + "のTPは0です";
	tbody.appendChild(create_cell("td", tp0_text, 6, 1, "comment"));
	
	table.appendChild(tbody);
	
	function _append_cells(tr, d){
		let name = "", tp_s = "", tp_a = "";
		if (d) {
			name = d.viewname || d.name;
			tp_s = d.tp_s;
			tp_a = float_to_string(tp_s * 7 / 10, 1, -1);
		}
		tr.appendChild(create_cell("td", name, 1, 1, "name"));
		tr.appendChild(create_cell("td", tp_s, 1, 1, "tp_s"));
		tr.appendChild(create_cell("td", tp_a, 1, 1, "tp_a"));
	}
}


// event -------------------------------------------------------------------------------------------
function ev_change_ship(e){
	if (/ship_(\d+)/.test(e.target.id)) {
		set_shipTP_SA(RegExp.$1);
		calc_tp();
		record_formdata();
	}
}

function ev_change_usertp(e){
	if (/user_(\d+)_S/.test(e.target.id)) {
		set_input_bold(e.target);
		set_userTP_A(RegExp.$1);
		calc_tp();
		record_formdata();
	}
}

function ev_change_count(e){
	set_input_bold(e.target);
	calc_tp();
	record_formdata();
}

function ev_change_remaining_tp(e){
	set_input_bold(e.target);
	calc_tp();
	record_formdata();
}

function ev_change_record_data(){
	record_formdata();
}

function ev_change_use_noerror(){
	calc_tp();
	record_formdata();
}

function ev_click_clear_button(){
	clear_form();
	// 誤クリアのときはリロードするとキャンセル
	// ただしブラウザにデータを保存している場合のみ
	// という多分使われない機能
	//record_formdata(); 
	calc_tp();
}

// dragdrop
function ev_dragstart(e){
	// dataTransferの利用によってドラッグ可能になる
	e.dataTransfer.setData("drag_id", e.target.id);
}

function ev_dragover(e){
	// デフォルトをキャンセルした要素がドロップ可能な場所
	let drag_id = e.dataTransfer.getData("drag_id");
	if (drag_id != e.target.id) {
		e.preventDefault();
	}
}

function ev_drop(e){
	// ドロップ
	e.preventDefault();
	let drag_id = e.dataTransfer.getData("drag_id");
	
	// Ctrlのみを押している場合はコピー
	if (e.ctrlKey && !e.shiftKey && !e.altKey) {
		copy_ship(_id_to_num(drag_id), _id_to_num(e.target.id));
	} else {
		swap_ship(_id_to_num(drag_id), _id_to_num(e.target.id));
	}
	
	calc_tp();
	record_formdata();
	
	function _id_to_num(id){
		return /td_(\d+)/.test(id) ? RegExp.$1 : "";
	}
}


function set_shipTP_SA(number){
	let input = DOM("ship_" + number);
	let cell_s = DOM("shiptp_S_" + number);
	let cell_a = DOM("shiptp_A_" + number);
	
	if (input && cell_s && cell_a) {
		let val = parseInt(input.value, 10);
		let param = get_param_by_id(SHIPTYPE_TP_DEFINITION, val);
		
		// A勝利は誤差なしを表示
		cell_s.textContent = (val > 0 && param) ? param.tp_s : "";
		cell_a.textContent = (val > 0 && param) ? float_to_string(param.tp_s * 7 / 10, 1) : "";
	}
}


function set_userTP_A(number){
	let tp_s = DOM("user_" + number + "_S");
	let cell_a = DOM("user_" + number + "_A");
	
	if (tp_s && cell_a) {
		let val = formstr_to_float(tp_s.value, 0, 0);
		// A勝利は誤差なしを表示
		cell_a.textContent = float_to_string(val.value * 7 / 10, 1, -1);
	}
}

// inputの太字を設定
function set_input_bold(input){
	let val = parseFloat(input.value, 10);
	if (val > 0) input.classList.add("bold");
	else input.classList.remove("bold");
}


// 全ての表示について再設定
function refresh_table(){
	let counts = [
		"drum", "daihatsu", "naikatei", "onigiri",
		"user_1_count", "user_2_count", "user_3_count"
	];
	
	for (let i=1; i<=SHIP_MAX_COUNT; i++) set_shipTP_SA(i);
	for (let i=1; i<=3; i++) {
		set_input_bold(DOM("user_" + i + "_S"));
		set_userTP_A(i);
	}
	for (let i=0; i<counts.length; i++) {
		set_input_bold(DOM(counts[i]));
	}
	set_input_bold(DOM("remaining_tp"));
}


// a番とb番の艦を入れ替え
function swap_ship(a, b){
	let ship_a = DOM("ship_" + a);
	let ship_b = DOM("ship_" + b);
	
	if (!ship_a || !ship_b) {
		console.log("swapできません:", a, b);
		return;
	}
	
	let val = ship_a.value;
	ship_a.value = ship_b.value;
	ship_b.value = val;
	
	set_shipTP_SA(a);
	set_shipTP_SA(b);
}


// a番をb番にコピー
function copy_ship(a, b){
	let ship_a = DOM("ship_" + a);
	let ship_b = DOM("ship_" + b);
	
	if (!ship_a || !ship_b) {
		console.log("swapできません:", a, b);
		return;
	}
	
	ship_b.value = ship_a.value;
	
	set_shipTP_SA(b);
}


// フォームとlocalStorage --------------------------------------------------------------------------
// フォームのデータ保存関係
// 文字列をそのまま保存するものとする

function get_value_ids(){
	// value を保存するもの
	let value_ids = new Array;
	
	for (let i=1; i<=SHIP_MAX_COUNT; i++) {
		value_ids.push("ship_" + i);
	}
	for (let i=1; i<=3; i++) {
		value_ids.push("user_" + i + "_S");
		value_ids.push("user_" + i + "_count");
	}
	value_ids = value_ids.concat(["drum", "daihatsu", "naikatei", "onigiri", "remaining_tp"]);
	
	return value_ids;
}

function get_checked_ids(){
	return ["record_data", "use_noerror"];
}


function save_formdata(){
	// checked を保存するもの
	let value_ids = get_value_ids();
	let checked_ids = get_checked_ids();
	
	let obj = new Object;
	get_element_values(obj, value_ids);
	get_element_checks(obj, checked_ids);
	
	let json_text = JSON.stringify(obj);
	localStorage.setItem(KANCOLLE_TP_STORAGEKEY, json_text);
}

function load_formdata(){
	let value_ids = get_value_ids();
	let checked_ids = get_checked_ids();
	let data;
	let json_text = localStorage.getItem(KANCOLLE_TP_STORAGEKEY);
	
	if (json_text) {
		try {
			data = JSON.parse(json_text);
		} catch (err) {
			data = new Object;
		}
	}
	
	set_element_values(data, value_ids, true);
	set_element_checks(data, checked_ids, true);
}

function remove_formdata(){
	localStorage.removeItem(KANCOLLE_TP_STORAGEKEY);
}


// 設定に基づいて記録や削除を行う
function record_formdata(){
	let savemode = DOM("record_data").checked;
	
	if (savemode) {
		save_formdata();
	} else {
		remove_formdata();
	}
}


// フォームをクリア
// オプションは残す
function clear_form(){
	let value_ids = get_value_ids();
	
	for (let i=0; i<value_ids.length; i++) {
		let elem = DOM(value_ids[i]);
		
		if (elem.tagName == "SELECT") {
			elem.selectedIndex = 0;
		} else if (elem.type == "number") {
			elem.value = "0";
		}
	}
	
	refresh_table();
}



// 汎用
function get_element_values(out, ids){
	for (let i=0; i<ids.length; i++) {
		let e = DOM(ids[i]);
		out[ids[i]] = e ? e.value : null;
		if (!e) {
			console.log("element not found, id:", ids[i]);
		}
	}
	return out;
}

function get_element_checks(out, ids){
	for (let i=0; i<ids.length; i++) {
		let e = DOM(ids[i]);
		out[ids[i]] = e ? e.checked : null;
		if (!e) {
			console.log("element not found, id:", ids[i]);
		}
	}
	return out;
}

function set_element_values(data, ids, ignore_nodata){
	for (let i=0; i<ids.length; i++) {
		let e = DOM(ids[i]);
		if (e) {
			if (data && data.hasOwnProperty(ids[i])) {
				e.value = data[ids[i]];
			} else if (!ignore_nodata) {
				e.value = "";
			}
		} else {
			console.log("element not found, id:", ids[i]);
		}
	}
}

function set_element_checks(data, ids, ignore_nodata){
	for (let i=0; i<ids.length; i++) {
		let e = DOM(ids[i]);
		if (e) {
			if (data && data.hasOwnProperty(ids[i])) {
				e.checked = data[ids[i]];
			} else if (!ignore_nodata) {
				e.checked = "";
			}
		} else {
			console.log("element not found, id:", ids[i]);
		}
	}
}


// calc --------------------------------------------------------------------------------------------
// 合計のTP等を計算して表示
function calc_tp(){
	// formから読み取る
	let totaltp_s = 0;
	let remaining_tp = 0;
	let noerror_mode = DOM("use_noerror").checked;
	let form_error = false;
	
	// 艦種
	for (let i=1; i<=SHIP_MAX_COUNT; i++) {
		let input = DOM("ship_" + i);
		let id = formstr_to_int(input.value);
		
		if (id.value > 0) {
			let param = get_param_by_id(SHIPTYPE_TP_DEFINITION, id.value);
			
			if (!param) {
				console.log("艦種のTPが定義にないでち", id.value);
				continue;
			}
			totaltp_s += param.tp_s;
		}
	}
	// 装備
	_add_equip_tp("ドラム缶"    , "drum"    );
	_add_equip_tp("大発動艇"    , "daihatsu");
	_add_equip_tp("特二式内火艇", "naikatei");
	_add_equip_tp("戦闘糧食"    , "onigiri" );
	// 直接入力
	for (let i=1; i<=3; i++) _add_user_tp(i);
	// 残りTP
	let rem = formstr_to_int(DOM("remaining_tp").value);
	if (!rem.good() || rem.value < 0) {
		form_error = true;
	} else {
		remaining_tp = rem.value;
	}
	
	// 小数入力暫定対応
	// まあ使わないか
	totaltp_s = Math.floor(totaltp_s);
	
	
	// 上で使う関数
	function _add_equip_tp(name, input_id){
		let elem = DOM(input_id);
		let param = get_param_by_name(EQUIPMENT_TP_DEFINITION, name);
		if (!param) {
			console.log("装備のTPが定義にないでち", name);
			return;
		}
		let val = formstr_to_int(elem.value);
		if (!val.good() || val.value < 0) {
			form_error = true;
			return;
		}
		totaltp_s += param.tp_s * val.value;
	}
	function _add_user_tp(number){
		let tp_elem = DOM("user_" + number + "_S");
		let count_elem = DOM("user_" + number + "_count");
		let tp = formstr_to_float(tp_elem.value);
		let count = formstr_to_int(count_elem.value);
		
		if (!tp.good() || tp.value < 0 || !count.good() || count.value < 0) {
			form_error = true;
			return;
		}
		totaltp_s += tp.value * count.value;
	}
	
	// 読み込みここまで
	
	
	let s_text = "";
	let a_text = "";
	let s_count_text = "";
	let a_count_text = "";
	let comment = "";
	
	if (!form_error) {
		// 読み込みOK
		
		// 0.7倍してから切り捨てなので、計算誤差が発生する場合がある
		// JavaScriptと同じかは不明
		let totaltp_a_raw = Math.floor(totaltp_s * 0.7);
		let totaltp_a_noerror = Math.floor(totaltp_s * 7 / 10);
		
		let totaltp_a = noerror_mode ? totaltp_a_noerror : totaltp_a_raw;
		
		s_text = totaltp_s;
		a_text = totaltp_a;
		
		if (remaining_tp > 0 && totaltp_s > 0) {
			s_count_text = float_to_string(remaining_tp / totaltp_s, 2, 1);
			a_count_text = totaltp_a > 0 ? float_to_string(remaining_tp / totaltp_a, 2, 1) : "-";
			
			// 必要回数
			let req = Math.ceil(remaining_tp / totaltp_s);
			let over = totaltp_s * req - remaining_tp;
			
			let a_req = Math.min(Math.floor(over / (totaltp_s - totaltp_a)), req);
			let s_req = req - a_req;
			
			let arr = [];
			if (s_req > 0) arr.push("S勝利" + s_req + "回");
			if (a_req > 0) arr.push("A勝利" + a_req + "回");
			
			comment = arr.join("と") + "で達成できます。<br>";
			
		} else {
			s_count_text = "-";
			a_count_text = "-";
		}
		
		// 誤差の警告
		if (totaltp_a_raw != totaltp_a_noerror) {
			a_text += "*";
			comment += "A勝利時、計算誤差が発生する可能性があります。<br>誤差なしA勝利TP: " + totaltp_a_noerror;
		}
	}
	
	DOM("totaltp_s").textContent = s_text;
	DOM("totaltp_a").textContent = a_text;
	DOM("totaltp_s_count").textContent = s_count_text;
	DOM("totaltp_a_count").textContent = a_count_text;
	DOM("totaltp_comment").innerHTML = comment;
}


