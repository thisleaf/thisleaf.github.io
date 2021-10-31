// 出力と出力用ダイアログ

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT, EL, _T} from "./utility.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import {SupportShipData} from "./kc_support_ship.mjs";
import {DOMDialog} from "./dom_dialog.mjs";

export {
	OutputDeckDialog,
};


// OutputDeckDialog --------------------------------------------------------------------------------
class OutputDeckDialog extends DOMDialog {
	// DOM
	e_select;
	selects;
	e_support_copy;
	e_textarea_A;
	e_main_paste;
	e_textarea_B;
	e_merge;
	e_merged_copy;
	e_textarea_merged;
	e_log_clear;
	e_textarea_log;
	e_close;
	
	// データ
	fleets;
	error_names;
	
	constructor(fleets){
		super();
		this.fleets = fleets;
	}
};

Object.defineProperties(OutputDeckDialog.prototype, {
	create                   : {value: OutputDeckDialog_create},
	fleet_to_json_deckbuilder: {value: OutputDeckDialog_fleet_to_json_deckbuilder},
	
	output_support           : {value: OutputDeckDialog_output_support},
	log                      : {value: OutputDeckDialog_log},
	clear_log                : {value: OutputDeckDialog_clear_log},
	merge_deckbuilder_text   : {value: OutputDeckDialog_merge_deckbuilder_text},
	
	ev_show_dialog           : {value: OutputDeckDialog_ev_show_dialog},
	ev_click_support_copy    : {value: OutputDeckDialog_ev_click_support_copy},
	ev_click_main_paste      : {value: OutputDeckDialog_ev_click_main_paste},
	ev_click_merge           : {value: OutputDeckDialog_ev_click_merge},
	ev_click_merged_copy     : {value: OutputDeckDialog_ev_click_merged_copy},
	ev_click_log_clear       : {value: OutputDeckDialog_ev_click_log_clear},
});

Object.defineProperties(OutputDeckDialog, {
	select_enum: {value: {
		"デッキビルダー": 1,
	}},
	outfleet_select_enum: {value: {
		"/1 /2": 12,
		"/2 /3": 23,
		"/3 /4": 34,
		"/2 /4": 24,
		"カスタムデータ": 1,
	}},
});


function OutputDeckDialog_create(){
	DOMDialog.prototype.create.call(this, "modal", "データの出力", true);
	
	this.e_inside.classList.add("convert");
	this.e_inside.classList.add("output");
	
	NODE(this.e_contents, [
		NODE(ELEMENT("div"), [
			this.e_select = NODE(ELEMENT("select", "", "data_type"), [
				new Option("デッキビルダー", OutputDeckDialog.select_enum["デッキビルダー"]),
			]),
		]),
		
		this.e_outfleet_div = EL("div"),

		NODE(ELEMENT("div"), [
			NODE(ELEMENT("div", "", "column_div"), [
				NODE(ELEMENT("div", "", "tool_div"), [
					NODE(ELEMENT("div", "", "f_left"), [
						TEXT("A: 支援艦隊"),
					]),
					NODE(ELEMENT("div", "", "f_right"), [
						this.e_support_copy = ELEMENT("button", {textContent: "コピー"}),
					]),
				]),
				this.e_textarea_A = ELEMENT("textarea", {className: "code_area", placeholder: "デッキビルダー形式のデータを入力"}),
			]),
			
			NODE(ELEMENT("div", "", "column_div"), [
				NODE(ELEMENT("div", "", "tool_div"), [
					NODE(ELEMENT("div", "", "f_left"), [
						TEXT("B: 本隊"),
					]),
					NODE(ELEMENT("div", "", "f_right"), [
						this.e_main_paste = ELEMENT("button", {textContent: "貼り付け"}),
					]),
				]),
				this.e_textarea_B = ELEMENT("textarea", {className: "code_area", placeholder: "デッキビルダー形式のデータを入力"}),
			]),
		]),
		
		NODE(ELEMENT("div"), [
			NODE(ELEMENT("div", "", "column_div"), [
				NODE(ELEMENT("div", "", "tool_div"), [
					NODE(ELEMENT("div", "", "f_left"), [
						this.e_merge = ELEMENT("button", {textContent: "AとBをマージ"}),
					]),
					NODE(ELEMENT("div", "", "f_right"), [
						this.e_merged_copy = ELEMENT("button", {textContent: "コピー"}),
					]),
				]),
				this.e_textarea_merged = ELEMENT("textarea", "", "code_area"),
			]),
			
			NODE(ELEMENT("div", "", "column_div"), [
				NODE(ELEMENT("div", "", "tool_div"), [
					NODE(ELEMENT("div", "", "f_left"), [
						TEXT("ログ"),
					]),
					NODE(ELEMENT("div", "", "f_right"), [
						this.e_log_clear = ELEMENT("button", {textContent: "クリア"}),
					]),
				]),
				this.e_textarea_log = ELEMENT("textarea", "", "code_area"),
			]),
		]),
		
		NODE(ELEMENT("div", "", "button_div"), [
			this.e_close = ELEMENT("button", {textContent: "閉じる"}),
		]),
	]);

	let selects = [];
	NODE(this.e_outfleet_div, [_T("出力する艦隊")]);
	for (let i=0; i<4; i++) {
		NODE(this.e_outfleet_div, [
			EL("span.fleetnumber", [_T("/" + (i + 1))]),
			selects[i] = EL("select.fleetname"),
		]);
		selects[i].appendChild(new Option("-", -1));
		for (let j=0; j<this.fleets.length; j++) {
			selects[i].appendChild(new Option(this.fleets[j].get_fleet_name(), j));
		}
	}
	NODE(this.e_outfleet_div, [
		this.e_output = EL("button.out", [_T("出力")])
	]);
	selects[0].selectedIndex = 1;
	if (this.fleets.length >= 2) selects[1].selectedIndex = 2;
	this.selects = selects;

	// event
	for (let sel of this.selects) sel.addEventListener("change", e => this.output_support());
	this.e_output.addEventListener("click", e => this.output_support());
	this.addEventListener("show", e => this.ev_show_dialog(e));
	this.e_support_copy.addEventListener("click", e => this.ev_click_support_copy());
	this.e_main_paste.addEventListener("click", e => this.ev_click_main_paste());
	this.e_merge.addEventListener("click", e => this.ev_click_merge());
	this.e_merged_copy.addEventListener("click", e => this.ev_click_merged_copy());
	this.e_log_clear.addEventListener("click", e => this.ev_click_log_clear());
	this.add_dialog_button(this.e_close, "ok");
}


function OutputDeckDialog_fleet_to_json_deckbuilder(fleet, error_names){
	let json = {};
	// json.name = fleet.get_fleet_name(true);
	
	for (let s=0; s<fleet.support_ships.length; s++) {
		let sup = fleet.support_ships[s];
		
		if (!sup.empty()) {
			let ssd = sup.get_ssd();
			if (!ssd.empty()) {
				let ssd_json = ssd.get_json_deckbuilder();
				json["s" + (s + 1)] = ssd_json;
				
				if (error_names && ssd_json.id == "0") {
					// 内部IDが未定義だった
					error_names.push(ssd.ship_name);
				}
			}
		}
	}
	return json;
}


// ログを出力
function OutputDeckDialog_log(log){
	this.e_textarea_log.value += log + "\n";
}
// クリア
function OutputDeckDialog_clear_log(){
	this.e_textarea_log.value = "";
}

// 左上を出力
function OutputDeckDialog_output_support(){
	this.error_names = [];

	let json = {version: 4};
	let fnames = [];
	for (let i=0; i<this.selects.length; i++) {
		let index = +this.selects[i].value;
		if (index >= 0) {
			json["f" + (i + 1)] = this.fleet_to_json_deckbuilder(this.fleets[index], this.error_names);
			fnames.push("/" + (i + 1) + ":" + this.fleets[index].get_fleet_name());
		}
	}
	this.e_textarea_A.value = JSON.stringify(json);

	this.log("Aに支援艦隊データを出力しました (" + fnames.join(" ") + ")");
	if (this.error_names.length > 0) {
		this.log("注意: " + this.error_names.join(", ") + "の内部IDが入力されていません (ID:\"0\"で出力します)");
	}
}


function OutputDeckDialog_merge_deckbuilder_text(text_A, text_B){
	let json_A = null, json_B = null;
	try {
		json_A = JSON.parse(text_A);
		json_B = JSON.parse(text_B);
	} catch (e) {
		this.log((json_A ? "B" : "A") + "の読み込みに失敗しました");
		return null;
	}
	
	let key_text = key => {
		let m = key.match(/^f([1-4])$/);
		if (m) return "第" + m[1] + "艦隊";
		m = key.match(/^a([1-3])$/);
		if (m) return "第" + m[1] + "基地";
		return '"' + key + '"';
	};
	let empty_object = x => {
		return x === null || ((x instanceof Object) && Object.keys(x).length == 0);
	};
	
	// Bのデータが優先
	let out = Object.assign({}, json_B);
	for (let key of Object.keys(json_A)) {
		if (out.hasOwnProperty(key) && !empty_object(out[key])) {
			if (out[key] !== json_A[key]) {
				this.log("Aの" + key_text(key) + "は無視されます");
			}
		} else {
			out[key] = json_A[key];
		}
	}
	return JSON.stringify(out);
}


function OutputDeckDialog_ev_show_dialog(e){
	this.output_support();
	this.move_to(this.get_max_x() / 2, this.get_max_y() / 2);
}

function OutputDeckDialog_ev_click_support_copy(){
	if (this.e_textarea_A.value == "") {
		this.log("データが空です");
		
	} else {
		Util.copy_form_text(this.e_textarea_A, true, true)
		.then(result => {
			if (result.state == "granted") {
				this.log("Aのデータをコピーしました");
			} else {
				this.log("コピーに失敗しました...");
			}
		});
	}
}

function OutputDeckDialog_ev_click_main_paste(){
	Util.paste_form_text(this.e_textarea_B, true, true)
	.then(result => {
		if (result.state == "granted") {
			this.log("Bにデータを貼り付けました");
		} else {
			let mes = "貼り付けに失敗しました...";
			if (/\bFirefox\b/i.test(navigator.userAgent)) {
				mes += "(Firefoxは無理かも)";
			}
			this.log(mes);
		}
	});
}

function OutputDeckDialog_ev_click_merge(){
	if (this.e_textarea_A.value == "") {
		this.log("Aが空です");
		
	} else if (this.e_textarea_B.value == "") {
		this.log("Bが空です");
		
	} else {
		let text = this.merge_deckbuilder_text(this.e_textarea_A.value, this.e_textarea_B.value);
		if (text) {
			this.e_textarea_merged.value = text;
			this.log("マージしました");
		}
	}
}

function OutputDeckDialog_ev_click_merged_copy(){
	if (this.e_textarea_merged.value == "") {
		this.log("データが空です");
		
	} else {
		Util.copy_form_text(this.e_textarea_merged, true, true)
		.then(result => {
			if (result.state == "granted") {
				this.log("マージデータをコピーしました");
			} else {
				this.log("コピーに失敗しました...");
			}
		});
	}
}

function OutputDeckDialog_ev_click_log_clear(){
	this.clear_log();
}

