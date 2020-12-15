// 出力と出力用ダイアログ

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {NODE, ELEMENT, TEXT} from "./utility.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import {SupportShipData} from "./kc_support_ship.mjs";
import {DOMDialog} from "./dom_dialog.mjs";

export {
	OutputDeckDialog,
};


// OutputDeckDialog --------------------------------------------------------------------------------
class OutputDeckDialog extends DOMDialog {
	e_select;
	e_textarea;
	e_deckbuilder_div;
	e_deckbuilder_hint;
	e_copy_hint;
	
	fleet1;
	fleet2;
	deckbuilder_json;
	
	constructor(f1, f2){
		super();
		if (f1 || f2) this.set_fleet(f1, f2);
	}
	set_fleet(f1, f2){
		this.fleet1 = f1 || null;
		this.fleet2 = f2 || null;
	}
};

Object.defineProperties(OutputDeckDialog.prototype, {
	create        : {value: OutputDeckDialog_create},
	refresh_hint  : {value: OutputDeckDialog_refresh_hint},
	fleet_to_json_deckbuilder: {value: OutputDeckDialog_fleet_to_json_deckbuilder},
	ev_show_dialog: {value: OutputDeckDialog_ev_show_dialog},
	ev_click_copy : {value: OutputDeckDialog_ev_click_copy},
});

Object.defineProperties(OutputDeckDialog, {
	select_enum: {value: {
		"デッキビルダー": 1,
	}},
});


function OutputDeckDialog_create(){
	DOMDialog.prototype.create.call(this, "modal", "データの出力", true);
	
	this.e_inside.classList.add("convert");
	
	let copy_btn, ok_btn;
	
	NODE(this.e_contents, [
		NODE(ELEMENT("div"), [
			this.e_select = NODE(ELEMENT("select", "", "data_type"), [
				new Option("デッキビルダー", OutputDeckDialog.select_enum["デッキビルダー"]),
			]),
		]),
		
		NODE(ELEMENT("div", "", "option"), [
			this.e_textarea = ELEMENT("textarea", "", "code_area"),
		]),
		NODE(ELEMENT("div", "", "button_div copy"), [
			copy_btn = ELEMENT("button", {textContent: "コピー"}),
		]),
		
		this.e_deckbuilder_div = NODE(ELEMENT("div", "", "option"), [
			this.e_deckbuilder_hint = ELEMENT("div", "", "option_text"),
		]),
		NODE(ELEMENT("div", "", "option"), [
			this.e_copy_hint = ELEMENT("div", "", "option_text"),
		]),
		
		NODE(ELEMENT("div", "", "button_div"), [
			ok_btn = ELEMENT("button", {textContent: "OK"}),
		]),
	]);
	
	// event
	this.addEventListener("show", e => this.ev_show_dialog(e));
	copy_btn.addEventListener("click", e => this.ev_click_copy(e));
	this.add_dialog_button(ok_btn, "ok");
}


function OutputDeckDialog_refresh_hint(){
	// 内部IDが定義されていない場合警告を出す
	if (this.error_names.length > 0) {
		this.e_deckbuilder_hint.textContent = "注: " + this.error_names.join(", ") + "の内部IDが入力されていません (ID:\"0\"で出力します)";
	} else {
		this.e_deckbuilder_hint.textContent = "";
	}
}

function OutputDeckDialog_fleet_to_json_deckbuilder(fleet, error_names){
	let json = {};
	
	for (let s=0; s<fleet.support_ships.length; s++) {
		let sup = fleet.support_ships[s];
		
		if (!sup.empty()) {
			let ssd = new SupportShipData();
			if (sup.get_data(ssd)) {
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


function OutputDeckDialog_ev_show_dialog(e){
	this.error_names = [];
	
	let json = {version: 4};
	if (this.fleet1) json.f1 = this.fleet_to_json_deckbuilder(this.fleet1, this.error_names);
	if (this.fleet2) json.f2 = this.fleet_to_json_deckbuilder(this.fleet2, this.error_names);
	this.deckbuilder_json = json;
	
	this.e_textarea.value = JSON.stringify(json);
	this.refresh_hint();
	this.move_to(this.get_max_x() / 2, this.get_max_y() / 2);
}

function OutputDeckDialog_ev_click_copy(e){
	let json = this.deckbuilder_json;
	
	navigator.permissions.query({name: "clipboard-write"})
	.then(result => {
		if (result.state == "granted") {
			navigator.clipboard.writeText(JSON.stringify(json));
			this.e_copy_hint.textContent = "コピーしました！";
		} else {
			this.e_copy_hint.textContent = "コピーに失敗しました…";
		}
	}, () => {
		// firefoxなど
		this.e_textarea.select();
		document.execCommand("copy");
		this.e_copy_hint.textContent = "コピーしました";
	});
}


