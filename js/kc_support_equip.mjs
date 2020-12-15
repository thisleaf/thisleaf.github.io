/* 所持装備・本隊装備の入力と管理 */

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT, HTML} from "./utility.mjs";
import {DOMDialog} from "./dom_dialog.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";

export {
	OwnEquipmentData,
	OwnEquipmentRow,
	OwnEquipmentDialog,
	OwnEquipmentForm,
	OwnResetDialog,
	OwnConvertDialog,
};


// OwnEquipmentData --------------------------------------------------------------------------------
// 装備数と所持数のデータ
Object.assign(OwnEquipmentData.prototype, {
	// 装備IDとデータ
	id: 0,
	csv_data: null,
	
	// 個数を表す長さ11の配列
	// key は改修値
	// 入力データなので矛盾があるかもしれない
	// ただし負数は不可
	main_counts : null, // array
	total_counts: null, // array
	// 探索除外
	exclude: false,
	
	set_id          : OwnEquipmentData_set_id,
	reset           : OwnEquipmentData_reset,
	is_valid        : OwnEquipmentData_is_valid,
	get_main_count  : OwnEquipmentData_get_main_count,
	get_total_count : OwnEquipmentData_get_total_count,
	get_comment_text: OwnEquipmentData_get_comment_text,
	increment_main  : OwnEquipmentData_increment_main,
	decrement_main  : OwnEquipmentData_decrement_main,
	clone           : OwnEquipmentData_clone,
	move_from       : OwnEquipmentData_move_from,
	
	get_json  : OwnEquipmentData_get_json,
	set_json  : OwnEquipmentData_set_json,
	empty_json: OwnEquipmentData_empty_json,
	get_json_MT: OwnEquipmentData_get_json_MT,
	set_json_MT: OwnEquipmentData_set_json_MT,
	
	// 計算用
	rem_counts: null, // array, 残り数
	fix_counts: null, // array, 固定数
	// 上の配列の和
	remaining: 0,
	fixed    : 0,
	
	// 残っている装備の改修値(昇順)
	// 利用するときのみ作り直す
	// 高速化のため、0 .. remaining - 1 の範囲のみ有効とし、後ろは無視とする
	rem_stars: null,
	
	init_varcounts    : OwnEquipmentData_init_varcounts,
	generate_rem_stars: OwnEquipmentData_generate_rem_stars,
	insert_rem_star   : OwnEquipmentData_insert_rem_star,
	remove_rem_star   : OwnEquipmentData_remove_rem_star,
	pop_rem_star      : OwnEquipmentData_pop_rem_star,
	insert_star   : OwnEquipmentData_insert_star,
	remove_star   : OwnEquipmentData_remove_star,
	pop_star      : OwnEquipmentData_pop_star,
});


function OwnEquipmentData(data){
	if (data) {
		this.id = data.number;
		this.csv_data = data;
	}
	this.main_counts  = new Array(11).fill(0);
	this.total_counts = new Array(11).fill(0);
}


function OwnEquipmentData_set_id(id, data = null){
	this.id = id;
	this.data = data || EquipmentDatabase.equipment_data_map[id];
}

// ID関連以外をクリア
function OwnEquipmentData_reset(){
	this.main_counts.fill(0);
	this.total_counts.fill(0);
	this.exclude = false;
}

// 入力に矛盾がないか
function OwnEquipmentData_is_valid(){
	for (let i=0; i<this.main_counts.length; i++) {
		let assert = 0 <= this.main_counts[i] && this.main_counts[i] <= this.total_counts[i];
		if (!assert) return false;
	}
	return true;
}

function OwnEquipmentData_get_main_count(){
	return this.main_counts.reduce((acc, cur) => acc + cur);
}

function OwnEquipmentData_get_total_count(){
	return this.total_counts.reduce((acc, cur) => acc + cur);
}

function OwnEquipmentData_get_comment_text(){
	let arr = new Array;
	for (let s=0; s<=10; s++) {
		let m = this.main_counts[s];
		let t = this.total_counts[s];
		if (m > 0 || t > 0) {
			let x = m > 0 ? m + "/" + t : t;
			arr.push("★" + s + "(" + x + ")");
		}
	}
	return arr.join(" ");
}

// mainの装備数を増加させる
// ★の大きいものから利用
function OwnEquipmentData_increment_main(){
	let m = this.get_main_count();
	let t = this.get_total_count();
	if (m >= t) return false;
	
	for (let i=10; i>=0; i--) {
		if (this.main_counts[i] < this.total_counts[i]) {
			this.main_counts[i]++;
			return true;
		}
	}
}

// 減少
function OwnEquipmentData_decrement_main(){
	for (let i=0; i<=10; i++) {
		// なんか矛盾しているやつから減らす
		if (this.main_counts[i] > this.total_counts[i]) {
			this.main_counts[i]--;
			return true;
		}
	}
	for (let i=0; i<=10; i++) {
		if (this.main_counts[i] > 0) {
			this.main_counts[i]--;
			return true;
		}
	}
	return false;
}

// 複製
function OwnEquipmentData_clone(){
	let out = new OwnEquipmentData(this.csv_data);
	out.id = this.id; // csv_data は null かも
	
	for (let i=0; i<=10; i++) {
		out.main_counts[i]  = this.main_counts[i];
		out.total_counts[i] = this.total_counts[i];
	}
	out.exclude = this.exclude;
	
	if (this.rem_counts) out.rem_counts = this.rem_counts.concat();
	if (this.fix_counts) out.fix_counts = this.fix_counts.concat();
	out.remaining = this.remaining;
	out.fixed = this.fixed;
	if (this.rem_stars) out.rem_stars = this.rem_stars.slice(0, this.remaining);
	
	return out;
}

// データを移動
function OwnEquipmentData_move_from(src){
	this.exclude = false;
	Object.assign(this, src);
}

// json形式との変換
function OwnEquipmentData_get_json(){
	let json = {
		id: this.id,
	};
	let main = null;
	let own = null;
	
	for (let i=0; i<=10; i++) {
		if (this.main_counts[i] > 0) {
			if (!main) main = new Object;
			main[i] = this.main_counts[i];
		}
		if (this.total_counts[i] > 0) {
			if (!own) own = new Object;
			own[i] = this.total_counts[i];
		}
	}
	// 空っぽのものは省略する
	if (main) json.main = main;
	if (own) json.own = own;
	if (this.exclude) json.exclude = true;
	return json;
}

// IDが一致している必要がある
function OwnEquipmentData_set_json(json){
	if (this.id != json.id) {
		debugger;
	}
	
	for (let i=0; i<=10; i++) {
		let m = Math.floor((json.main && json.main[i]) || 0);
		let t = Math.floor((json.own  && json.own [i]) || 0);
		this.main_counts [i] = m > 0 ? m : 0;
		this.total_counts[i] = t > 0 ? t : 0;
	}
	
	this.exclude = json.exclude || false;
}

// データが空っぽかどうか
// jsonデータとして保存しなくてもよいなら true
function OwnEquipmentData_empty_json(){
	return this.get_main_count() == 0 && this.get_total_count() == 0 && !this.exclude;
}

// マルチスレッド用json  postMessage() でコピーされるはず
// 計算用データも複製する
function OwnEquipmentData_get_json_MT(){
	let json = this.get_json();
	json.rem_counts = this.rem_counts;
	json.fix_counts = this.fix_counts;
	json.remaining = this.remaining;
	json.fixed = this.fixed;
	json.rem_stars = this.rem_stars;
	return json;
}

function OwnEquipmentData_set_json_MT(json){
	this.set_json(json);
	this.rem_counts = json.rem_counts;
	this.fix_counts = json.fix_counts;
	this.remaining = json.remaining;
	this.fixed = json.fixed;
	this.rem_stars = json.rem_stars;
}


// 計算用関数
// 計算用変数の初期化
function OwnEquipmentData_init_varcounts(){
	let size = this.total_counts.length;
	this.rem_counts = new Array(size);
	this.fix_counts = new Array(size).fill(0);
	
	let sum = 0;
	for (let i=0; i<size; i++) {
		let rem = this.total_counts[i] - this.main_counts[i];
		this.rem_counts[i] = rem;
		sum += rem;
	}
	this.remaining = sum;
	this.fixed = 0;
}

function OwnEquipmentData_generate_rem_stars(){
	this.rem_stars = this.rem_counts.reduce((a, count, star) => {
		for (let p=0; p<count; p++) a.push(star);
		return a;
	}, []);
}

// rem_stars に要素を一つだけ追加する
// insertion sort
// rem_counts, remaining も変更する
function OwnEquipmentData_insert_rem_star(star){
	let arr = this.rem_stars;
	// starの挿入位置
	let p = this.remaining;
	for (; p > 0 && arr[p-1] > star; p--) {
		arr[p] = arr[p-1];
	}
	arr[p] = star;
	
	this.rem_counts[star]++;
	this.remaining++;
}

// 要素の削除
function OwnEquipmentData_remove_rem_star(star){
	let arr = this.rem_stars;
	// 削除要素
	let p = this.remaining - 1;
	while (p >= 0 && arr[p] != star) p--;
	if (p < 0) {
		debugger;
		return;
	}
	arr.splice(p, 1);
	
	this.rem_counts[star]--;
	this.remaining--;
}

// 最も大きいものを削除して返す
function OwnEquipmentData_pop_rem_star(){
	if (this.remaining <= 0) {
		debugger;
		return -1;
	}
	let star = this.rem_stars[--this.remaining];
	this.rem_counts[star]--;
	return star;
}

// rem_starsを利用しないver
function OwnEquipmentData_insert_star(star){
	this.rem_counts[star]++;
	this.remaining++;
}

function OwnEquipmentData_remove_star(star){
	this.rem_counts[star]--;
	this.remaining--;
}

function OwnEquipmentData_pop_star(){
	if (this.remaining <= 0) {
		debugger;
		return -1;
	}
	let star = 10;
	for (; star>0; star--) {
		if (this.rem_counts[star] > 0) break;
	}
	this.rem_counts[star]--;
	this.remaining--;
	return star;
}


// OwnEquipmentRow ------------------------------------------------------------------------------------
// DOMの装備行とイベント
Object.assign(OwnEquipmentRow.prototype, {
	// 装備に関連するデータ
	data: null, // OwnEquipmentData
	
	e_row          : null,
	e_name         : null,
	e_firepower    : null,
	e_torpedo      : null,
	e_bombing      : null,
	e_accuracy     : null,
	e_main         : null,
	e_main_left    : null,
	e_main_count   : null,
	e_main_right   : null,
	e_total        : null,
	e_exclude      : null,
	e_exclude_check: null,
	e_comment      : null,
	
	// データが変更された場合に呼ばれる
	ondatachange: null,
	call_datachange: OwnEquipmentRow_call_datachange,
	
	// data からデータを取得して反映
	// 基本的に data のものを実データとして扱い、行へのアクションは即反映するものとする
	refresh: OwnEquipmentRow_refresh,
	
	// イベント
	ev_click_name    : OwnEquipmentRow_ev_click_name,
	ev_click_left    : OwnEquipmentRow_ev_click_left,
	ev_click_right   : OwnEquipmentRow_ev_click_right,
	ev_change_exclude: OwnEquipmentRow_ev_change_exclude,
});


Object.assign(OwnEquipmentRow, {
	// ヘッダー行
	e_header_row: null,
	
	// 行を作成(ヘッダー行/通常行共通)
	// 引数にオブジェクト
	create_row: OwnEquipmentRow_static_create_row,
	// ヘッダー行を取得(なければ作る)
	get_header_row: OwnEquipmentRow_static_get_header_row,
});


// DOMの作成
// 構造を作るが内容はセットしない
function OwnEquipmentRow_static_create_row(out, is_header = false){
	out.e_row = NODE(ELEMENT("div", "", "eq_row"), [
		out.e_name      = ELEMENT("div", "", "eq_name"),
		out.e_firepower = ELEMENT("div", "", "eq_firepower"),
		out.e_torpedo   = ELEMENT("div", "", "eq_torpedo"),
		out.e_bombing   = ELEMENT("div", "", "eq_bombing"),
		out.e_accuracy  = ELEMENT("div", "", "eq_accuracy"),
		out.e_main      = ELEMENT("div", "", "eq_main"),
		out.e_total     = ELEMENT("div", "", "eq_total"),
		out.e_exclude   = ELEMENT("div", "", "eq_exclude"),
		out.e_comment   = ELEMENT("div", "", "eq_comment"),
	]);
	
	if (is_header) {
		out.e_row.classList.add("eq_rowheader");
		
	} else {
		out.e_main.classList.add("arrow_input");
		NODE(out.e_main, [
			out.e_main_left  = ELEMENT("span", "", "left_arrow"),
			out.e_main_count = ELEMENT("span", "", "input_number"),
			out.e_main_right = ELEMENT("span", "", "right_arrow"),
		]);
		
		NODE(out.e_exclude, [
			out.e_exclude_check = ELEMENT("input", {type: "checkbox"}),
		]);
	}
	
	return out;
}

function OwnEquipmentRow_static_get_header_row(){
	let row = OwnEquipmentRow.e_header_row;
	if (!row) {
		let obj = OwnEquipmentRow.create_row(new Object, true);
		
		// text
		obj.e_name     .textContent = "名前";
		obj.e_firepower.textContent = "火力";
		obj.e_torpedo  .textContent = "雷装";
		obj.e_bombing  .textContent = "爆装";
		obj.e_accuracy .textContent = "命中";
		obj.e_main     .textContent = "本隊";
		obj.e_total    .textContent = "所持";
		obj.e_exclude  .textContent = "除外";
		
		OwnEquipmentRow.e_header_row = obj.e_row;
		row = obj.e_row;
	}
	return row;
}


function OwnEquipmentRow(data){
	this.data = data;
	OwnEquipmentRow.create_row(this, false);
	
	// event
	this.e_name.addEventListener("click", e => this.ev_click_name(e));
	this.e_main_left.addEventListener("click", e => this.ev_click_left(e));
	this.e_main_right.addEventListener("click", e => this.ev_click_right(e));
	this.e_exclude_check.addEventListener("change", e => this.ev_change_exclude(e));
}

function OwnEquipmentRow_refresh(){
	let data = this.data;
	let eq = data.csv_data;
	let mc = data.get_main_count();
	let tc = data.get_total_count();
	let good = data.is_valid();
	
	this.e_name         .textContent = Util.unescape_charref(eq.name);
	this.e_firepower    .textContent = eq.firepower;
	this.e_torpedo      .textContent = eq.torpedo;
	this.e_bombing      .textContent = eq.bombing;
	this.e_accuracy     .textContent = eq.accuracy;
	this.e_main_count   .textContent = data.get_main_count();
	this.e_total        .textContent = data.get_total_count();
	this.e_exclude_check.checked     = data.exclude;
	this.e_comment      .textContent = data.get_comment_text();
	
	this.e_main      .classList.toggle("error", !good);
	this.e_main_left .classList.toggle("disabled", mc <= 0);
	this.e_main_right.classList.toggle("disabled", mc >= tc);
}

function OwnEquipmentRow_call_datachange(){
	if (this.ondatachange) this.ondatachange.call(null);
}


function OwnEquipmentRow_ev_click_name(e){
	// ダイアログ呼び出し
	let dialog = OwnEquipmentDialog.get_dialog();
	dialog.set_pointer(this.data);
	dialog.show();
	dialog.init_position(e.y);
	
	dialog.addEventListener("exit", e => {
		if (e.detail == "ok") {
			this.refresh();
			this.call_datachange();
		}
	});
}

function OwnEquipmentRow_ev_click_left(e){
	this.data.decrement_main();
	this.refresh();
	this.call_datachange();
}

function OwnEquipmentRow_ev_click_right(e){
	this.data.increment_main();
	this.refresh();
	this.call_datachange();
}

function OwnEquipmentRow_ev_change_exclude(e){
	this.data.exclude = this.e_exclude_check.checked;
	this.call_datachange();
}


// OwnEquipmentDialog ------------------------------------------------------------------------------
// 装備の入力を行うダイアログ
// モジュールの初期化は先にやっておく

Object.assign(OwnEquipmentDialog.prototype = Object.create(DOMDialog.prototype), {
	// OwnEquipmentRow
	// current_data は一時的な入力データ、更新時 data へ上書きを行う
	data        : null,
	current_data: null,
	// dragdrop
	drag_data   : null,
	
	e_name          : null,
	e_category      : null,
	e_params        : null,
	e_option_exclude: null,
	e_total         : null,
	e_main          : null,
	e_main_left     : null,
	e_main_right    : null,
	e_total_stars   : null, // array
	e_total_inputs  : null, // array
	e_main_stars    : null, // array
	e_main_inputs   : null, // array
	
	create         : OwnEquipmentDialog_create,
	init_position  : OwnEquipmentDialog_init_position,
	set_pointer    : OwnEquipmentDialog_set_pointer,
	current_to_form: OwnEquipmentDialog_current_to_form,
	check_form     : OwnEquipmentDialog_check_form,
	
	ev_change_forms: OwnEquipmentDialog_ev_change_forms,
	ev_click_left  : OwnEquipmentDialog_ev_click_left,
	ev_click_right : OwnEquipmentDialog_ev_click_right,
	ev_click_ok    : OwnEquipmentDialog_ev_click_ok,
	ev_click_cancel: OwnEquipmentDialog_ev_click_cancel,
	ev_dragstart   : OwnEquipmentDialog_ev_dragstart,
	ev_dragend     : OwnEquipmentDialog_ev_dragend,
	ev_dragover    : OwnEquipmentDialog_ev_dragover,
	ev_drop        : OwnEquipmentDialog_ev_drop,
});

Object.assign(OwnEquipmentDialog, {
	// singleton
	dialog: null,
	get_dialog: OwnEquipmentDialog_get_dialog,
});


function OwnEquipmentDialog(){
	DOMDialog.call(this);
}

function OwnEquipmentDialog_create(){
	DOMDialog.prototype.create.call(this, "modal", "所持数と装備数の入力", true);
	
	this.e_inside.classList.add("eq_dialog_inside");
	
	let _create_inputdiv = (stars_key, inputs_key) => {
		let div = ELEMENT("div", "", "eq_inputs");
		let stars = new Array;
		let inputs = new Array;
		
		for (let i=0; i<=10; i++) {
			let si_div = ELEMENT("div");
			let star = NODE(ELEMENT("div", "", "eq_star"), [TEXT("★" + i)]);
			let input = ELEMENT("input", {type: "number", className: "eq_countbox", value: 0, min: 0, max: 99});
			
			si_div.dataset.star = i;
			si_div.dataset.key = stars_key;
			star.dataset.star = i;
			star.dataset.key = stars_key;
			star.draggable = true;
			
			stars.push(star);
			inputs.push(input);
			
			NODE(div, [
				NODE(si_div, [
					star,
					input,
				]),
			]);
		}
		
		this[stars_key] = stars;
		this[inputs_key] = inputs;
		return div;
	};
	
	NODE(this.e_contents, [
		NODE(ELEMENT("div", "", "eq_detail"), [
			this.e_name = ELEMENT("div", "", "eq_detailname"),
			NODE(ELEMENT("div", "", "eq_status"), [
				this.e_category = ELEMENT("div", "", "eq_category"),
				this.e_params = ELEMENT("div", "", "eq_params"),
			]),
		]),
		
		NODE(ELEMENT("div", "", "eq_options"), [
			NODE(ELEMENT("label"), [
				this.e_option_exclude = ELEMENT("input", {type: "checkbox"}),
				TEXT("探索では使用しない"),
			]),
		]),
		
		NODE(ELEMENT("h4"), [TEXT("所持数")]),
		NODE(_create_inputdiv("e_total_stars", "e_total_inputs"), [
			NODE(ELEMENT("div", "", "item_total"), [
				NODE(ELEMENT("div", "", "eq_total"), [TEXT("合計")]),
				this.e_total = ELEMENT("div", "", "eq_totalinput"),
			]),
		]),
		
		NODE(ELEMENT("h4"), [TEXT("本隊装備数")]),
		NODE(_create_inputdiv("e_main_stars", "e_main_inputs"), [
			NODE(ELEMENT("div", "", "item_total"), [
				NODE(ELEMENT("div", "", "eq_total"), [TEXT("合計")]),
				NODE(ELEMENT("div", "", "eq_totalinput arrow_input"), [
					this.e_main_left = ELEMENT("span", "", "left_arrow"),
					this.e_main = ELEMENT("span", "", "input_number"),
					this.e_main_right = ELEMENT("span", "", "right_arrow"),
				]),
			]),
		]),
		
		NODE(ELEMENT("div", "", "dialog_okcancel"), [
			this.e_ok = NODE(ELEMENT("button", "", "ok"), [TEXT("更新")]),
			this.e_cancel = NODE(ELEMENT("button", "", "cancel"), [TEXT("キャンセル")]),
		]),
	]);
	
	this.e_name.textContent = "装備名";
	this.e_total.textContent = "0";
	this.e_main.textContent = "0";
	
	// event
	// change form
	let _change = e => this.ev_change_forms(e);
	this.e_option_exclude.addEventListener("change", _change);
	this.e_total_inputs.forEach(el => el.addEventListener("input", _change));
	this.e_main_inputs.forEach(el => el.addEventListener("input", _change));
	// click triangle
	this.e_main_left.addEventListener("click", e => this.ev_click_left(e));
	this.e_main_right.addEventListener("click", e => this.ev_click_right(e));
	// dragdrop
	this.drag_data = new Util.DragdataProvider();
	let _set_dd = el => {
		el.addEventListener("dragstart", e => this.ev_dragstart(e));
		el.addEventListener("dragend"  , e => this.ev_dragend  (e));
		// dropは親divに
		el.parentElement.addEventListener("dragover", e => this.ev_dragover(e));
		el.parentElement.addEventListener("drop", e => this.ev_drop(e));
	};
	this.e_total_stars.forEach(_set_dd);
	this.e_main_stars.forEach(_set_dd);
	
	// ok/cancel
	this.e_ok.addEventListener("click", e => this.ev_click_ok(e));
	this.e_cancel.addEventListener("click", e => this.ev_click_cancel(e));
	this.addEventListener("cancel", e => this.ev_click_cancel());
}

function OwnEquipmentDialog_init_position(click_y){
	let mx = this.get_max_x();
	let my = this.get_max_y();
	let x = mx / 2;
	//let y = Math.min(Math.max(click_y - this.e_inside.offsetHeight / 2, 0), my);
	let y = my / 2;
	this.move_to(x, y);
}

function OwnEquipmentDialog_set_pointer(data){
	this.data = data;
	this.current_data = data.clone();
	
	this.current_to_form(true);
	this.check_form();
}

// current_data からフォームへ
function OwnEquipmentDialog_current_to_form(set_detail = false){
	if (set_detail) {
		let eq = this.current_data.csv_data;
		this.e_name.textContent = Util.unescape_charref(eq.name);
		this.e_category.textContent = eq.category;
		
		Util.remove_children(this.e_params);
		
		for (let def of Global.SUPPORT_EQUIPDETAIL_PARAMS) {
			let param = eq[def.key];
			if (param == 0 && !def.show_zero) continue;
			
			let text = def.viewname + (param >= 0 ? "+" : "") + param;
			NODE(this.e_params, [
				NODE(ELEMENT("div"), [TEXT(text)]),
			]);
		}
	}
	
	this.e_option_exclude.checked = this.current_data.exclude;
	
	for (let i=0; i<=10; i++) {
		this.e_main_inputs[i].value = this.current_data.main_counts[i];
		this.e_total_inputs[i].value = this.current_data.total_counts[i];
	}
}

// フォームのデータをチェック、クラスの設定やcurrent_dataに格納
// 入力数が矛盾していても、読み取りができればtrue
function OwnEquipmentDialog_check_form(){
	let cur = this.current_data;
	let res = true;
	let tcv_sum = 0;
	let mcv_sum = 0;
	
	for (let i=0; i<=10; i++) {
		let tc = Util.formstr_to_int(this.e_total_inputs[i].value, 0, 0);
		let mc = Util.formstr_to_int(this.e_main_inputs[i].value, 0, 0);
		let tc_good = tc.good() && tc.value >= 0;
		let mc_good = mc.good() && mc.value >= 0;
		let tcv = Math.max(tc.value, 0);
		let mcv = Math.max(mc.value, 0);
		let v_good = mcv <= tcv;
		
		tcv_sum += tcv;
		mcv_sum += mcv;
		
		if (cur) {
			cur.total_counts[i] = tcv;
			cur.main_counts[i] = mcv;
		}
		
		this.e_total_stars[i] .classList.toggle("error", !tc_good || !v_good);
		this.e_total_inputs[i].classList.toggle("error", !tc_good);
		this.e_total_inputs[i].classList.toggle("zero" , tcv == 0);
		this.e_main_stars[i]  .classList.toggle("error", !mc_good || !v_good);
		this.e_main_inputs[i] .classList.toggle("error", !mc_good);
		this.e_main_inputs[i] .classList.toggle("zero" , mcv == 0);
		
		if (!tc_good || !mc_good) res = false;
	}
	
	if (cur) {
		cur.exclude = this.e_option_exclude.checked;
	}
	this.e_total.textContent = tcv_sum;
	this.e_main.textContent = mcv_sum;
	this.e_main_left.classList.toggle("disabled", mcv_sum <= 0);
	this.e_main_right.classList.toggle("disabled", mcv_sum >= tcv_sum);
	
	return res;
}


function OwnEquipmentDialog_ev_change_forms(e){
	this.check_form();
}

function OwnEquipmentDialog_ev_click_left(e){
	if (this.current_data.decrement_main()) {
		this.current_to_form();
		this.check_form();
	}
}

function OwnEquipmentDialog_ev_click_right(e){
	if (this.current_data.increment_main()) {
		this.current_to_form();
		this.check_form();
	}
}

function OwnEquipmentDialog_ev_click_ok(e){
	if (this.check_form()) {
		this.data.move_from(this.current_data);
		this.current_data = null;
		this.hide("ok");
	}
}

function OwnEquipmentDialog_ev_click_cancel(){
	this.hide("cancel");
}

function OwnEquipmentDialog_ev_dragstart(e){
	let src = e.currentTarget;
	let star = src.dataset.star;
	let key = src.dataset.key;
	let counts = key == "e_main_stars" ? this.current_data.main_counts : this.current_data.total_counts;
	
	if (counts[star] <= 0) {
		e.preventDefault();
		return;
	}
	
	e.dataTransfer.setData("drag_data", "star");
	e.dataTransfer.effectAllowed = "move";
	
	this.drag_data.set_data({
		type: "equip_star",
		src : src,
		star: star,
		key : key,
		counts: counts,
	});
}

function OwnEquipmentDialog_ev_dragend(e){
	this.drag_data.clear();
}

function OwnEquipmentDialog_ev_dragover(e){
	let drag = this.drag_data.get_data();
	let src = e.currentTarget;
	if ( drag &&
		drag.type == "equip_star" &&
		src.dataset.key == drag.key &&
		src.dataset.star != drag.star )
	{
		e.dataTransfer.dropEffect = "move";
		e.preventDefault();
	}
}

function OwnEquipmentDialog_ev_drop(e){
	let drag = this.drag_data.get_data();
	let src = e.currentTarget;
	if ( drag &&
		drag.type == "equip_star" &&
		src.dataset.key == drag.key &&
		src.dataset.star != drag.star )
	{
		let dec_star = drag.star;
		let inc_star = src.dataset.star;
		
		// 念の為
		if (drag.counts[dec_star] <= 0) return;
		
		drag.counts[dec_star]--;
		drag.counts[inc_star]++;
		this.current_to_form();
		this.check_form();
		e.preventDefault();
	}
}


// static
function OwnEquipmentDialog_get_dialog(){
	let dialog = OwnEquipmentDialog.dialog;
	if (!dialog) {
		dialog = new OwnEquipmentDialog();
		dialog.create();
		OwnEquipmentDialog.dialog = dialog;
	}
	return dialog;
}


// OwnEquipmentForm --------------------------------------------------------------------------------
// OwnEquipmentRow を生成してDOMに配置・管理する
// EventTarget を継承
Object.assign(OwnEquipmentForm.prototype, {
	// クリアボタン
	e_clear_main : null,
	e_clear_total: null,
	// オプション
	e_option_main     : null,
	e_option_own      : null,
	e_option_noexclude: null,
	e_option_error    : null,
	// エラーカウント
	e_error_count : null,
	// 変換
	e_convert     : null,
	
	// カテゴリー名のリスト
	e_category_tab: null,
	// 装備の表示領域
	e_container   : null,
	
	// 確認用ダイアログ
//	clear_dialog: null,
	
	// データ
	data_array  : null, // array of OwnEquipmentData
	all_rows    : null, // array of OwnEquipmentRow
	// タブ管理
	tabs        : null, // array of Object
	tab_selected: null,
	
	create      : OwnEquipmentForm_create,
	select_tab  : OwnEquipmentForm_select_tab,
	refresh_tab : OwnEquipmentForm_refresh_tab,
	refresh_error_count: OwnEquipmentForm_refresh_error_count,
	refresh_header_pos : OwnEquipmentForm_refresh_header_pos,
	
	reset_totals: OwnEquipmentForm_reset_totals,
	reset_mains : OwnEquipmentForm_reset_mains,
	
	get_json    : OwnEquipmentForm_get_json,
	set_json    : OwnEquipmentForm_set_json,
	get_calc_data: OwnEquipmentForm_get_calc_data,
	import_data : OwnEquipmentForm_import_data,
	
	ev_click_tab: OwnEquipmentForm_ev_click_tab,
	ev_rowdata_change: OwnEquipmentForm_ev_rowdata_change,
});


function OwnEquipmentForm(){
	this.e_clear_main       = DOM("clear_main");
	this.e_clear_total      = DOM("clear_total");
	this.e_option_main      = DOM("eqop_main");
	this.e_option_own       = DOM("eqop_own");
	this.e_option_noexclude = DOM("eqop_noexclude");
	this.e_option_error     = DOM("eqop_error");
	this.e_convert          = DOM("eq_convert");
	this.e_category_tab     = DOM("eq_category_tab");
	this.e_container        = DOM("eq_inputarea");
	
	Util.attach_event_target(this);
}

// リスト用のDOMを生成
// データ配列もここで生成する
function OwnEquipmentForm_create(){
	let csv_equiplist = EquipmentDatabase.csv_equiplist;
	let eq_map = EquipmentDatabase.equipment_data_map;
	
	let data_array = new Array;
	let all_rows = new Array;
	let tabs = new Array;
	
	let _ondatachange = e => this.ev_rowdata_change(e);
	
	Util.remove_children(this.e_category_tab); // 念の為
	
	for (let def of Global.SUPPORT_EQUIPLIST_DEF) {
		let tab_name = def.viewname || def.category;
		let cates = new Array;
		if (def.category) cates.push(def.category);
		if (def.cates) cates = cates.concat(def.cates);
		
		// タブの作成
		let tab_div = NODE(ELEMENT("div"), [TEXT(tab_name)]);
		this.e_category_tab.appendChild(tab_div);
		
		// 行の作成
		let rows = new Array;
		
		// カテゴリー名 cate の装備を追加
		for (let cate of cates) {
			for (let d of csv_equiplist) {
				if (d.category != cate) continue;
				
				if (def.ignore_zero_param) {
					// 火力か命中がついているもののみ
					if (d.firepower == 0 && d.accuracy == 0) continue;
				}
				
				let own = new OwnEquipmentData(d);
				let row = new OwnEquipmentRow(own);
				row.ondatachange = _ondatachange;
				rows.push(row);
				data_array.push(own);
			}
		}
		
		// ID指定
		if (def.ids) {
			for (let id of def.ids) {
				let eq = eq_map[id];
				if (!eq) {
					debugger;
					continue;
				}
				
				let own = new OwnEquipmentData(eq);
				let row = new OwnEquipmentRow(own);
				row.ondatachange = _ondatachange;
				rows.push(row);
				data_array.push(own);
			}
		}
		
		tabs.push({
			e_tab: tab_div,
			rows: rows,
			airplane: Boolean(def.airplane),
		});
		all_rows = all_rows.concat(rows);
	}
	
	// 「すべて」タブ
	let all_tab_div = NODE(ELEMENT("div"), [TEXT("すべて")]);
	this.e_category_tab.insertBefore(all_tab_div, this.e_category_tab.firstChild);
	tabs.unshift({
		e_tab: all_tab_div,
		rows: all_rows,
		airplane: true,
	});
	
	this.data_array = data_array;
	this.all_rows = all_rows;
	this.tabs = tabs;
	
	// 念の為に重複をチェックする
	let id_array = data_array.map(d => d.id);
	id_array.sort();
	for (let i=1; i<id_array.length; i++) {
		if (id_array[i-1] == id_array[i]) debugger;
	}
	
	// エラーカウント表示用
	NODE(this.e_option_error.parentElement, [
		this.e_error_count = ELEMENT("span", "", "error_count"),
	]);
	
	// イベントの設定
	let _change = e => {
		this.refresh_tab();
		this.dispatchEvent(new CustomEvent("change"));
	};
	this.e_option_main     .addEventListener("change", _change);
	this.e_option_own      .addEventListener("change", _change);
	this.e_option_noexclude.addEventListener("change", _change);
	this.e_option_error    .addEventListener("change", _change);
	this.e_category_tab    .addEventListener("pointerdown", e => this.ev_click_tab(e));
	this.e_container.addEventListener("scroll", e => this.refresh_header_pos());
	
	this.refresh_error_count();
}


// タブを選択
function OwnEquipmentForm_select_tab(index){
	let tab = this.tabs[index];
	if (!tab) debugger;
	
	if (tab != this.tab_selected) {
		tab.e_tab.classList.add("selected");
		if (this.tab_selected) {
			this.tab_selected.e_tab.classList.remove("selected");
		}
		this.tab_selected = tab;
		this.e_container.scrollTop = 0;
		this.refresh_tab();
	}
}


// 行を再表示
function OwnEquipmentForm_refresh_tab(){
	let tab = this.tab_selected;
	let rows = tab ? tab.rows : [];
	let airplane = tab ? tab.airplane : false;
	
	// オプションに従ってフィルター
	if (this.e_option_main.checked) rows = rows.filter(row => row.data.get_main_count() > 0);
	if (this.e_option_own.checked) rows = rows.filter(row => row.data.get_total_count() > 0);
	if (this.e_option_noexclude.checked) rows = rows.filter(row => !row.data.exclude);
	if (this.e_option_error.checked) rows = rows.filter(row => !row.data.is_valid());
	
	rows.forEach(row => row.refresh());
	
	// スクロール位置をリセットして要素を配置
	// 下のほうだと要素を減らしたときにたくさんイベントが…
	let top = this.e_container.scrollTop;
	this.e_container.scrollTop = 0;
	
	Util.remove_children(this.e_container);
	NODE(this.e_container, [OwnEquipmentRow.get_header_row()]);
	NODE(this.e_container, rows.map(row => row.e_row));
	
	// 雷装・爆装の表示
	let style = DOM("style_changer");
	let text = airplane ? "" : "display: none;";
	Util.change_style(style, ".eq_row > div.eq_torpedo", text);
	Util.change_style(style, ".eq_row > div.eq_bombing", text);
	
	this.e_container.scrollTop = top;
	this.refresh_header_pos();
}

function OwnEquipmentForm_refresh_error_count(){
	let count = 0;
	for (let d of this.data_array) {
		if (!d.is_valid()) count++;
	}
	this.e_error_count.textContent = "(" + count + ")";
}

// ヘッダー行をスクロールに合わせる
function OwnEquipmentForm_refresh_header_pos(){
	let h = OwnEquipmentRow.get_header_row();
	h.style.top = this.e_container.scrollTop + "px";
}

// 所持数のリセット
function OwnEquipmentForm_reset_totals(){
	for (let d of this.data_array) {
		d.total_counts.fill(0);
	}
}

// 装備数のリセット
function OwnEquipmentForm_reset_mains(){
	for (let d of this.data_array) {
		d.main_counts.fill(0);
	}
}

// 表示オプションも保存
function OwnEquipmentForm_get_json(old_json = null){
	let data = new Array;
	let id_map = new Object;
	
	for (let i=0; i<this.data_array.length; i++) {
		let d = this.data_array[i];
		if (!d.empty_json()) data.push(d.get_json());
		id_map[d.id] = true;
	}
	
	// なるべくデータを引き継ぐ
	if (old_json && old_json.data) {
		for (let i=0; i<old_json.data.length; i++) {
			if (!id_map[old_json.data[i].id]) {
				data.push(old_json.data[i]);
				id_map[old_json.data[i].id] = true;
			}
		}
	}
	
	let json = {
		op_main     : this.e_option_main.checked,
		op_own      : this.e_option_own.checked,
		op_noexclude: this.e_option_noexclude.checked,
		op_error    : this.e_option_error.checked,
		data        : data,
	};
	
	return json;
}

// 行は自動更新されない
// reset_nodata: jsonにないデータは0クリア
function OwnEquipmentForm_set_json(json, reset_nodata = true){
	let data_map = new Object;
	
	for (let i=0; i<this.data_array.length; i++) {
		let data = this.data_array[i];
		data_map[data.id] = data;
		if (reset_nodata) data.reset();
	}
	
	if (json) {
		this.e_option_main     .checked = Boolean(json.op_main);
		this.e_option_own      .checked = Boolean(json.op_own);
		this.e_option_noexclude.checked = Boolean(json.op_noexclude);
		this.e_option_error    .checked = Boolean(json.op_error);
		
		if (json.data) {
			for (let i=0; i<json.data.length; i++) {
				let data = data_map[json.data[i].id];
				if (data) data.set_json(json.data[i]);
			}
		}
	}
}

// 計算用データの取得 (array of OwnEquipmentData)
// data_array をそのまま使っても問題ないはずだが、念の為cloneしたものを返す
function OwnEquipmentForm_get_calc_data(){
	return this.data_array.map(src => src.clone());
}

// データのインポート
// data: array<OwnEquipmentData>
// main: dataのmain_countsをセットする
// total: dataのtotal_countsをセットする
// reset_other: dataにない装備のデータを0クリアする
function OwnEquipmentForm_import_data(data, main, total, reset_other){
	if (reset_other) {
		for (let form_own of this.data_array) {
			if (main) form_own.main_counts.fill(0);
			if (total) form_own.total_counts.fill(0);
		}
	}
	
	for (let own of data) {
		let form_own = this.data_array.find(d => d.id == own.id);
		if (!form_own) continue;
		
		if (main) form_own.main_counts = own.main_counts.concat();
		if (total) form_own.total_counts = own.total_counts.concat();
	}
}


function OwnEquipmentForm_ev_click_tab(e){
	for (let i=0; i<this.tabs.length; i++) {
		if (this.tabs[i].e_tab == e.target) {
			this.select_tab(i);
			break;
		}
	}
}

function OwnEquipmentForm_ev_rowdata_change(){
	this.refresh_error_count();
	this.dispatchEvent(new CustomEvent("change"));
}


// OwnResetDialog ----------------------------------------------------------------------------------
// 装備の一括クリアダイアログ
Object.assign(OwnResetDialog.prototype = Object.create(DOMDialog.prototype), {
	e_reset_own        : null,
	e_reset_own_confirm: null,
	e_reset_main       : null,
	
	// OwnEquipmentForm
	own_form: null,
	
	create  : OwnResetDialog_create,
});


function OwnResetDialog(form_object){
	DOMDialog.call(this);
	this.own_form = form_object;
}

function OwnResetDialog_create(){
	DOMDialog.prototype.create.call(this, "modal", "一括クリア", true);
	
	this.e_inside.classList.add("reset");
	//this.e_inside.classList.add("vcenter");
	
	let ok_btn = ELEMENT("button", {textContent: "実行"});
	let cancel_btn = ELEMENT("button", {textContent: "キャンセル"});
	
	NODE(this.e_contents, [
		ELEMENT("h4", {textContent: "所持数"}),
		NODE(ELEMENT("div"), [
			NODE(ELEMENT("label"), [
				this.e_reset_own = ELEMENT("input", {type: "checkbox"}),
				TEXT("所持数をリセット"),
			]),
			NODE(ELEMENT("label"), [
				this.e_reset_own_confirm = ELEMENT("input", {type: "checkbox"}),
				TEXT("確認"),
			]),
		]),
		ELEMENT("h4", {textContent: "本隊装備数"}),
		NODE(ELEMENT("div"), [
			NODE(ELEMENT("label"), [
				this.e_reset_main = ELEMENT("input", {type: "checkbox"}),
				TEXT("本隊装備数をリセット"),
			]),
		]),
		NODE(ELEMENT("div", "", "button_div"), [
			ok_btn,
			cancel_btn,
		]),
	]);
	
	
	this.add_dialog_button(ok_btn, "ok");
	this.add_dialog_button(cancel_btn, "cancel");
	
	this.addEventListener("show", e => {
		// 中央に置く(この位置でないとサイズがうまく計算できない)
		this.move_to(this.get_max_x() / 2, this.get_max_y() / 2);
	});
	this.addEventListener("cancel", e => {
		if (e.detail == "outside") e.preventDefault();
	});
	this.addEventListener("close", e => {
		if (e.detail == "ok") {
			// 実行を押した
			let reset_own = this.e_reset_own.checked;
			let reset_own2 = this.e_reset_own_confirm.checked;
			let reset_main = this.e_reset_main.checked;
			
			if (reset_own != reset_own2) {
				e.preventDefault();
				DOMDialog.alert("所持数をリセットする場合、両方にチェックを入れてください", "リセット確認");
				return;
			}
			
			if (reset_own)  this.own_form.reset_totals();
			if (reset_main) this.own_form.reset_mains();
			this.own_form.refresh_tab();
			this.own_form.refresh_error_count();
		}
	});
}


// OwnConvertDialog --------------------------------------------------------------------------------
// データ読み込みダイアログ
Object.assign(OwnConvertDialog.prototype = Object.create(DOMDialog.prototype), {
	e_select  : null,
	e_textarea: null,
	e_confirm : null,
	
	// 艦隊分析用
	e_fleetanalysis_div : null,
	e_apiextract_div    : null,
	
	// デッキビルダー用
	e_deckbuilder_div   : null,
	e_deckbuilder_fleets: null, // 0から始まるarray
	
	// OwnEquipmentForm
	own_form: null,
	
	create                  : OwnConvertDialog_create,
	refresh_hint            : OwnConvertDialog_refresh_hint,
	reset_confirmation      : OwnConvertDialog_reset_confirmation,
	
	// データの変換
	// OwnEquipmentData の配列を返す
	parse_fleetanalysis_text: OwnConvertDialog_parse_fleetanalysis_text,
	parse_apiextract_text   : OwnConvertDialog_parse_apiextract_text,
	parse_deckbuilder_text  : OwnConvertDialog_parse_deckbuilder_text,
	
	ev_close: OwnConvertDialog_ev_close,
});

Object.assign(OwnConvertDialog, {
	select_enum: {
		"艦隊分析": 1,
		"デッキビルダー": 2,
		"API抽出": 3,
	},
});


function OwnConvertDialog(form_object){
	DOMDialog.call(this);
	this.own_form = form_object;
}

function OwnConvertDialog_create(){
	DOMDialog.prototype.create.call(this, "modal", "データの読み込み", true);
	
	this.e_inside.classList.add("convert");
	
	let ok_btn, cancel_btn;
	this.e_deckbuilder_fleets = new Array;
	
	NODE(this.e_contents, [
		NODE(ELEMENT("div"), [
			this.e_select = NODE(ELEMENT("select", "", "data_type"), [
				new Option("艦隊分析 (装備＞JSON)", OwnConvertDialog.select_enum["艦隊分析"]),
				new Option("艦隊分析 (装備＞装備反映)", OwnConvertDialog.select_enum["API抽出"]),
				new Option("デッキビルダー", OwnConvertDialog.select_enum["デッキビルダー"]),
			]),
		]),
		
		NODE(ELEMENT("div", "", "option"), [
			this.e_textarea = ELEMENT("textarea", "", "code_area"),
		]),
		
		this.e_fleetanalysis_div = NODE(ELEMENT("div", "", "option"), [
			NODE(ELEMENT("div", "", "option_text"), [
				HTML(
					'<a href="https://kancolle-fleetanalysis.firebaseapp.com/#/" target="_blank">艦隊分析</a>'
					+ " さんの形式のデータを、<b>所持装備データ</b>として読み込みます<br>"
					+ "装備＞JSONにある、装備情報jsonのデータを入力してください<br>"
					+ "既にある所持装備データは破棄(リセット)されます<br>"
					+ "注：艦隊分析さんが更新されていない場合、新装備のデータはありません"
				),
			]),
		]),
		
		this.e_apiextract_div = NODE(ELEMENT("div", "", "option"), [
			NODE(ELEMENT("div", "", "option_text"), [
				HTML(
					'<a href="https://kancolle-fleetanalysis.firebaseapp.com/#/" target="_blank">艦隊分析</a>'
					+ " さんに取り込む際のJSONデータを、<b>所持装備データ</b>として読み込みます<br>"
					+ "装備＞装備反映にある手順で取得したデータを入力してください<br>"
					+ "既にある所持装備データは破棄(リセット)されます"
				),
			]),
		]),
		
		this.e_deckbuilder_div = NODE(ELEMENT("div", "", "option"), [
			NODE(ELEMENT("label"), [
				this.e_deckbuilder_fleets[0] = ELEMENT("input", {type: "checkbox", checked: true}),
				TEXT("第1"),
			]),
			NODE(ELEMENT("label"), [
				this.e_deckbuilder_fleets[1] = ELEMENT("input", {type: "checkbox", checked: true}),
				TEXT("第2"),
			]),
			NODE(ELEMENT("label"), [
				this.e_deckbuilder_fleets[2] = ELEMENT("input", {type: "checkbox"}),
				TEXT("第3"),
			]),
			NODE(ELEMENT("label"), [
				this.e_deckbuilder_fleets[3] = ELEMENT("input", {type: "checkbox"}),
				TEXT("第4"),
			]),
			NODE(ELEMENT("div", "", "option_text"), [
				HTML(
					'<a href="http://kancolle-calc.net/deckbuilder.html" target="_blank">艦隊シミュレーター＆デッキビルダー</a>'
					+ " さんの形式のデータを、<b>本隊装備データ</b>として読み込みます<br>"
					+ "既にある本隊装備データは破棄(リセット)されます"
				),
			]),
		]),
		
		NODE(ELEMENT("div", "", "option"), [
			NODE(ELEMENT("label"), [
				this.e_confirm = ELEMENT("input", {type: "checkbox"}),
				TEXT("確認"),
			]),
		]),
		NODE(ELEMENT("div", "", "button_div"), [
			ok_btn = ELEMENT("button", {textContent: "読み込む"}),
			cancel_btn = ELEMENT("button", {textContent: "キャンセル"}),
		]),
	]);
	
	this.e_select.value = OwnConvertDialog.select_enum["デッキビルダー"];
	this.refresh_hint();
	
	// event
	this.addEventListener("show", e => {
		this.move_to(this.get_max_x() / 2, this.get_max_y() / 2);
	});
	this.e_select.addEventListener("change", e => {
		this.refresh_hint();
		this.reset_confirmation();
	});
	this.e_textarea.addEventListener("input", e => this.reset_confirmation());
	for (let f of this.e_deckbuilder_fleets) {
		f.addEventListener("change", e => this.reset_confirmation());
	}
	
	this.add_dialog_button(ok_btn, "ok");
	this.add_dialog_button(cancel_btn, "cancel");
	
	this.addEventListener("cancel", e => {
		if (e.detail == "outside") e.preventDefault();
	});
	this.addEventListener("close", e => this.ev_close(e));
}

function OwnConvertDialog_refresh_hint(){
	let _disp = (elem, b) => {
		elem.style.display = b ? "block" : "none";
	};
	let opt = this.e_select.options[this.e_select.selectedIndex];
	
	_disp(this.e_fleetanalysis_div, opt.value == OwnConvertDialog.select_enum["艦隊分析"]);
	_disp(this.e_apiextract_div   , opt.value == OwnConvertDialog.select_enum["API抽出"]);
	_disp(this.e_deckbuilder_div  , opt.value == OwnConvertDialog.select_enum["デッキビルダー"]);
}

// 「確認」のチェックをはずす
// 確認後にデータが操作されては意味がないので
function OwnConvertDialog_reset_confirmation(){
	this.e_confirm.checked = false;
}

/* 艦隊分析形式
[
	{"id":"9","pos":{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":5,"10":0}},
	...
]
*/
function OwnConvertDialog_parse_fleetanalysis_text(text){
	let data = new Array;
	
	// 空データ
	if (/^\s*$/.test(text)) return data;
	
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (err) {
		return null;
	}
	
	// 配列、もしくは配列風ではないデータはNGとする
	// 別形式のデータと間違う可能性があるため
	if (!("length" in json)) return null;
	
	for (let i=0; i<json.length; i++) {
		if (!json[i]) continue;
		
		let id = +json[i].id;
		let pos = json[i].pos;
		
		if (!id || !pos) continue;
		// IDの重複は不可とする
		if (data.findIndex(d => d.id == id) >= 0) {
			return null;
		}
		
		let own = new OwnEquipmentData();
		own.id = id;
		
		for (let s=0; s<=10; s++) {
			let c = +pos[s];
			if (!isFinite(c)) c = 0;
			own.total_counts[s] = Util.limit(c, 0, 99);
		}
		
		data.push(own);
	}
	
	return data;
}

/* 内部データ抽出形式
[
	{"api_slotitem_id":378,"api_level":0},
	...
]
*/
function OwnConvertDialog_parse_apiextract_text(text){
	let data = new Array;
	
	// 空データ
	if (/^\s*$/.test(text)) return data;
	
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (err) {
		return null;
	}
	
	// 配列、もしくは配列風ではないデータはNGとする
	// 別形式のデータと間違う可能性があるため
	if (!("length" in json)) return null;
	
	for (let i=0; i<json.length; i++) {
		if (!json[i]) continue;
		
		let id = +json[i].api_slotitem_id;
		let star = +json[i].api_level;
		
		// ここがおかしいのは不可とする
		if (!id || !(0 <= star && star <= 10)) return null;
		
		let own = data.find(d => d.id == id);
		if (!own) {
			own = new OwnEquipmentData();
			own.id = id;
			data.push(own);
		}
		
		own.total_counts[star]++;
	}
	
	return data;
}

/* デッキビルダー形式
{
	version: 4,
	f1: {
		s1: {
			id: '100', lv: 40, luck: -1,
			items:{ // 装備
				// id: ID, rf: 改修, mas: 熟練度
				i1:{id:1, rf: 4, mas:7},
				i2:{id:3, rf: 0},
				...,
				ix:{id:43} // 増設
			}
		},
		s2:{...}, ...
	}, ...
}

load_fleets: int -> bool, どの艦隊を読み込むか(0: 第1, 1: 第2, ...)
*/
function OwnConvertDialog_parse_deckbuilder_text(text, load_fleets){
	let data = new Array;
	let data_map = new Object;
	
	// 空データ
	if (/^\s*$/.test(text)) return data;
	
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (err) {
		return null;
	}
	
	// version: 4 がついている形式のみ
	if (json.version != 4) return null;
	
	for (let f=1; f<=4; f++) {
		let fleet = json["f" + f];
		if (!load_fleets[f - 1] || !fleet) continue;
		
		for (let s=1; s<=7; s++) {
			let ship = fleet["s" + s];
			if (!ship || !ship.items) continue;
			
			for (let i of [1, 2, 3, 4, 5, 6, "x"]) {
				let item = ship.items["i" + i];
				if (!item) continue;
				
				let id = +item.id;
				let star = +item.rf || 0;
				
				if (!id) continue;
				// 改修値がおかしいのはNG
				if (!(0 <= star && star <= 10)) return null;
				
				let own = data_map[id];
				if (!own) {
					own = new OwnEquipmentData();
					own.id = id;
					data.push(own);
					data_map[id] = own;
				}
				
				own.main_counts[star] = Math.min(own.main_counts[star] + 1, 99);
			}
		}
	}
	
	return data;
}


function OwnConvertDialog_ev_close(e){
	if (e.detail == "ok") {
		if (!this.e_confirm.checked) {
			e.preventDefault();
			DOMDialog.alert("確認にチェックを入れてください", "確認");
			return;
		}
		
		let text = this.e_textarea.value;
		let opt = this.e_select.options[this.e_select.selectedIndex];
		
		if (opt.value == OwnConvertDialog.select_enum["艦隊分析"]) {
			let data = this.parse_fleetanalysis_text(text);
			
			if (!data) {
				e.preventDefault();
				DOMDialog.alert("データの読み込みに失敗しました", "読み込み(艦隊分析)");
				return;
			}
			
			// 空データを除く
			data = data.filter(own => own.get_total_count() > 0);
			if (data.length == 0) {
				e.preventDefault();
				DOMDialog.alert("データが空です", "読み込み(艦隊分析)");
				return;
			}
			
			// totalをセット
			this.own_form.import_data(data, false, true, true);
			
		} else if (opt.value == OwnConvertDialog.select_enum["デッキビルダー"]) {
			let fleets = this.e_deckbuilder_fleets.map(e => e.checked);
			
			if (!fleets.some(f => f)) {
				e.preventDefault();
				DOMDialog.alert("読み込む艦隊がありません", "読み込み(デッキビルダー)");
				return;
			}
			
			let data = this.parse_deckbuilder_text(text, fleets);
			
			if (!data) {
				e.preventDefault();
				DOMDialog.alert("データの読み込みに失敗しました", "読み込み(デッキビルダー)");
				return;
			}
			
			// 空データを除く
			data = data.filter(own => own.get_main_count() > 0);
			if (data.length == 0) {
				e.preventDefault();
				DOMDialog.alert("データが空です", "読み込み(デッキビルダー)");
				return;
			}
			
			// mainをセット
			this.own_form.import_data(data, true, false, true);
			
		} else if (opt.value == OwnConvertDialog.select_enum["API抽出"]) {
			let data = this.parse_apiextract_text(text);
			
			if (!data) {
				e.preventDefault();
				DOMDialog.alert("データの読み込みに失敗しました", "読み込み");
				return;
			}
			
			// 空データを除く
			data = data.filter(own => own.get_total_count() > 0);
			if (data.length == 0) {
				e.preventDefault();
				DOMDialog.alert("データが空です", "読み込み");
				return;
			}
			
			// totalをセット
			this.own_form.import_data(data, false, true, true);
			
		} else {
			// ん？
		}
		
		this.own_form.refresh_tab();
		this.own_form.refresh_error_count();
	}
}

