// 損傷率の表を作る

import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT} from "./utility.mjs";
import * as Damage from "./kc_damage_utility.mjs";


// DamageTable -------------------------------------------------------------------------------------
Object.assign(DamageTable.prototype, {
	e_table          : null,
	e_input_tbody    : null,
	e_reference_tbody: null,
	e_tcell_power    : null,
	e_tcell_cur_hp   : null,
	e_tcell_max_hp   : null,
	e_tcell_armor    : null,
	e_cumlative      : null,
	e_scratch        : null,
	e_protect        : null,
	
	input_row        : null,
	reference_rows   : null,
	
	// 参考表示中の列番号・方向
	reference_column : 0,
	reference_dir    : -1,
	
	create_contents  : DamageTable_create_contents,
	refresh          : DamageTable_refresh,
	
	ev_change_options: DamageTable_ev_change_options,
	ev_click_triangle: DamageTable_ev_click_triangle,
});

DamageTable.reference_row_count = 20;


export function DamageTable(table){
	this.e_table = table;
}

function DamageTable_create_contents(){
	Util.remove_children(this.e_table);
	
	this.input_row = new DamageRateRow;
	this.input_row.create_input_row();
	
	this.e_reference_tbody = ELEMENT("tbody");
	this.reference_rows = new Array;
	
	for (let i=0; i<DamageTable.reference_row_count; i++) {
		let row = new DamageRateRow;
		row.create_ref_row();
		row.append_to(this.e_reference_tbody);
		this.reference_rows.push(row);
	}
	
	NODE(this.e_table, [
		NODE(ELEMENT("thead"), [
			NODE(ELEMENT("tr"), [
				ELEMENT("th", {colSpan: 4, className: "n_r left caption", textContent: "損傷率"}),
				NODE(ELEMENT("th", {colSpan: 5, className: "n_l right option"}), [
					NODE(ELEMENT("label"), [
						this.e_cumlative = ELEMENT("input", {type: "checkbox", checked: false}),
						TEXT("累計表示"),
					]),
					NODE(ELEMENT("label", {title: "チェックを外すと、装甲を貫けなかった場合のダメージを0として扱う"}), [
						this.e_scratch = ELEMENT("input", {type: "checkbox", checked: true}),
						TEXT("カスダメあり"),
					]),
					NODE(ELEMENT("label", {className: "protect", title: "撃沈ダメージを受けたときに割合ダメージに置換 (艦娘側)"}), [
						this.e_protect = ELEMENT("input", {type: "checkbox"}),
						TEXT("轟沈保護"),
					]),
				]),
			]),
			NODE(ELEMENT("tr", "", "colhead"), [
				ELEMENT("th", {textContent: "最終攻撃力", className: "power", title: "火力目標の「キャップ後」の値として利用できる"}),
				ELEMENT("th", {colSpan: 2, textContent: "耐久", className: "hp"}),
				ELEMENT("th", {textContent: "装甲", className: "armor"}),
				ELEMENT("th", {textContent: "撃沈", className: "damage_lv4"}),
				ELEMENT("th", {textContent: "大破", className: "damage_lv3"}),
				ELEMENT("th", {textContent: "中破", className: "damage_lv2"}),
				ELEMENT("th", {textContent: "小破", className: "damage_lv1"}),
				ELEMENT("th", {textContent: "表示なし", className: "damage_lv0"}),
			]),
		]),
		this.e_input_tbody = NODE(ELEMENT("tbody"), [
			this.input_row.e_tr1,
			this.input_row.e_tr2,
			NODE(ELEMENT("tr", "", "triangle"), [
				this.e_tcell_power  = NODE(ELEMENT("td", "", "power tri_down"), [ELEMENT("div")]),
				this.e_tcell_cur_hp = NODE(ELEMENT("td", "", "cur_hp tri_down"), [ELEMENT("div")]),
				this.e_tcell_max_hp = NODE(ELEMENT("td", "", "max_hp tri_down"), [ELEMENT("div")]),
				this.e_tcell_armor  = NODE(ELEMENT("td", "", "armor tri_down"), [ELEMENT("div")]),
				ELEMENT("td", "", "damage_lv4"),
				ELEMENT("td", "", "damage_lv3"),
				ELEMENT("td", "", "damage_lv2"),
				ELEMENT("td", "", "damage_lv1"),
				ELEMENT("td", "", "damage_lv0"),
			]),
		]),
		this.e_reference_tbody,
	]);
	
	// event
	let _change = e => this.ev_change_options(e);
	this.e_cumlative.addEventListener("change", _change);
	this.e_scratch.addEventListener("change", _change);
	this.e_protect.addEventListener("change", _change);
	
	this.e_tcell_power.addEventListener("click", e => this.ev_click_triangle(0, e));
	this.e_tcell_cur_hp.addEventListener("click", e => this.ev_click_triangle(1, e));
	this.e_tcell_max_hp.addEventListener("click", e => this.ev_click_triangle(2, e));
	this.e_tcell_armor.addEventListener("click", e => this.ev_click_triangle(3, e));
	
	this.input_row.onchange = e => this.refresh(true);
	
	this.refresh();
}

function DamageTable_refresh(skip_input_row = false){
	// optionを伝搬する
	let cum = this.e_cumlative.checked;
	let scr = this.e_scratch.checked;
	let pro = this.e_protect.checked;
	
	if (!skip_input_row) {
		this.input_row.set_options(cum, scr, pro);
		this.input_row.load_inputs();
		this.input_row.refresh();
	}
	
	for (let d=0; d<this.reference_rows.length; d++) {
		let row = this.reference_rows[d];
		row.set_options(cum, scr, pro);
		row.set_params(this.input_row, this.reference_column, (d + 1) * this.reference_dir);
		row.refresh();
	}
	
	// 三角形マークの更新
	let _mark = (elem, pos) => {
		let sel = this.reference_column == pos;
		let up = sel && this.reference_dir > 0;
		
		elem.classList.toggle("tri_down", !up);
		elem.classList.toggle("tri_up", up);
		elem.classList.toggle("select", sel);
	};
	
	_mark(this.e_tcell_power, 0);
	_mark(this.e_tcell_cur_hp, 1);
	_mark(this.e_tcell_max_hp, 2);
	_mark(this.e_tcell_armor, 3);
}

function DamageTable_ev_change_options(){
	this.refresh();
}

function DamageTable_ev_click_triangle(pos, e){
	if (this.reference_column != pos) {
		this.reference_column = pos;
		this.reference_dir = -1;
	} else {
		this.reference_dir = -this.reference_dir;
	}
	this.refresh();
}


// DamageRateRow -----------------------------------------------------------------------------------
Object.assign(DamageRateRow.prototype, {
	// DOM
	e_tr1             : null,
	e_tr2             : null, // bar
	// input
	e_final_power     : null,
	e_hp              : null,
	e_max_hp          : null,
	e_armor           : null,
	// cell
	e_final_power_cell: null,
	e_hp_cell         : null,
	e_armor_cell      : null,
	e_damage_cell_map : null,
	e_damage_bar_cell : null,
	// div
	e_damage_bar_divs : null, // map
	
	input_mode        : true,
	final_power       : 0,
	hp                : 0,
	max_hp            : 0,
	armor             : 0,
	
	// 表示の設定
	cumlative         : false,
	scratch_enabled   : true,
	protect_enabled   : false,
	// callback
	onchange          : null,
	
	// どっちか
	create_input_row  : DamageRateRow_create_input_row,
	create_ref_row    : DamageRateRow_create_ref_row,
	// 共通部 (private)
	create_commons    : DamageRateRow_create_commons,
	// tbodyに追加
	append_to         : DamageRateRow_append_to,
	// 表示の設定
	set_options       : DamageRateRow_set_options,
	set_params        : DamageRateRow_set_params,
	// 読み込み
	load_inputs       : DamageRateRow_load_inputs,
	input_good        : DamageRateRow_input_good,
	// 表示を更新
	refresh           : DamageRateRow_refresh,
	
	ev_change_input   : DamageRateRow_ev_change_input,
});


export function DamageRateRow(){
}

function DamageRateRow_create_input_row(){
	this.create_commons();
	
	this.e_final_power = ELEMENT("input", {type: "number", min: 1, max: 999, value: 100, className: "final_power"});
	this.e_hp          = ELEMENT("input", {type: "number", min: 1, max: 2000, value: 48, className: "cur_hp"});
	this.e_max_hp      = ELEMENT("input", {type: "number", min: 1, max: 2000, value: 48, className: "max_hp"});
	this.e_armor       = ELEMENT("input", {type: "number", min: 1, max: 999, value: 55, className: "armor"});
	
	NODE(this.e_final_power_cell, [this.e_final_power]);
	NODE(this.e_hp_cell, [this.e_hp, TEXT(" / "), this.e_max_hp]);
	NODE(this.e_armor_cell, [this.e_armor]);
	
	this.e_final_power.addEventListener("change", e => this.ev_change_input(0, e));
	this.e_hp         .addEventListener("change", e => this.ev_change_input(1, e));
	this.e_max_hp     .addEventListener("change", e => this.ev_change_input(2, e));
	this.e_armor      .addEventListener("change", e => this.ev_change_input(3, e));
	
	this.input_mode = true;
	this.load_inputs();
	this.refresh();
}

function DamageRateRow_create_ref_row(){
	this.create_commons();
	this.input_mode = false;
}

function DamageRateRow_create_commons(){
	this.e_damage_cell_map = new Object;
	this.e_damage_bar_divs = new Object;
	
	for (let i=0; i<Damage.DAMAGE_KEYS.length; i++) {
		let key = Damage.DAMAGE_KEYS[i];
		this.e_damage_cell_map[key] = ELEMENT("td", {className: "n_b percent damage_lv" + i, textContent: "-"});
		this.e_damage_bar_divs[key] = ELEMENT("div", "", "damage_lv" + i);
	}
	
	this.e_tr1 = NODE(ELEMENT("tr"), [
		this.e_final_power_cell = ELEMENT("td", {className: "final_power", rowSpan: 2}),
		this.e_hp_cell          = ELEMENT("td", {className: "hp", colSpan: 2, rowSpan: 2}),
		this.e_armor_cell       = ELEMENT("td", {className: "armor", rowSpan: 2}),
		this.e_damage_cell_map["撃沈"],
		this.e_damage_cell_map["大破"],
		this.e_damage_cell_map["中破"],
		this.e_damage_cell_map["小破"],
		this.e_damage_cell_map["表示なし"],
	]);
	this.e_tr2 = NODE(ELEMENT("tr"), [
		this.e_damage_bar_cell = NODE(ELEMENT("td", {colSpan: 5, className: "n_t damage_bar"}), [
			this.e_damage_bar_divs["撃沈"],
			this.e_damage_bar_divs["大破"],
			this.e_damage_bar_divs["中破"],
			this.e_damage_bar_divs["小破"],
			this.e_damage_bar_divs["表示なし"],
		]),
	]);
}

function DamageRateRow_append_to(tbody){
	NODE(tbody, [this.e_tr1, this.e_tr2]);
}

function DamageRateRow_set_options(cum, scr, pro){
	this.cumlative = cum;
	this.scratch_enabled = scr;
	this.protect_enabled = pro;
}

// base_rowからの差分をセット
function DamageRateRow_set_params(base_row, column, diff){
	this.final_power = base_row.final_power;
	this.hp          = base_row.hp;
	this.max_hp      = base_row.max_hp;
	this.armor       = base_row.armor;
	
	switch (column) {
	case 0: this.final_power += diff; break;
	case 1: this.hp += diff; break;
	case 2: this.hp += diff; this.max_hp += diff; break;
	case 3: this.armor += diff; break;
	default: this.final_power = -1; break;
	}
}

function DamageRateRow_load_inputs(){
	let final  = Util.formstr_to_float(this.e_final_power.value, 0, 0);
	let cur_hp = Util.formstr_to_int(this.e_hp.value, 0, 0);
	let max_hp = Util.formstr_to_int(this.e_max_hp.value, 0, 0);
	let armor  = Util.formstr_to_float(this.e_armor.value, 0, 0);
	
	this.final_power = final.value;
	this.hp = cur_hp.value;
	this.max_hp = max_hp.value;
	this.armor = armor.value;
	
	return this.input_good();
}

function DamageRateRow_input_good(){
	// あまり大きい数では時間がかかる
	return (
		0 < this.final_power && this.final_power <= 999 &&
		0 < this.hp && this.hp <= this.max_hp && this.max_hp <= 2000 &&
		0 < this.armor && this.armor <= 999
	);
}

function DamageRateRow_refresh(){
	if (this.input_good()) {
		let dist = new Damage.DamageDistribution(this.hp, this.max_hp);
		dist = dist.hit(this.final_power, 1, this.armor, this.scratch_enabled, this.protect_enabled);
		
		let probs = new Object;
		let cumls = new Object; // 累積
		dist.get_display_probs(probs, cumls);
		
		let disps = this.cumlative ? cumls : probs;
		
		for (let key of Damage.DAMAGE_KEYS) {
			this.e_damage_cell_map[key].textContent = Util.float_to_string(disps[key] * 100, 2, 0) + "%";
			this.e_damage_bar_divs[key].style.width = Util.float_to_string(probs[key] * 100, 2, 0) + "%";
		}
		
		let _hint = keys => {
			let p = 0;
			for (let key of keys) p += disps[key];
			return keys.join("+") + ": " + Util.float_to_string(p * 100, 2, 0) + "%";
		};
		
		if (this.cumlative) {
			this.e_damage_cell_map["撃沈"].title = "";
			this.e_damage_cell_map["大破"].title = "大破: " + Util.float_to_string(probs["大破"] * 100, 2, 0) + "%";
			this.e_damage_cell_map["中破"].title = "中破: " + Util.float_to_string(probs["中破"] * 100, 2, 0) + "%";
			this.e_damage_cell_map["小破"].title = "小破: " + Util.float_to_string(probs["小破"] * 100, 2, 0) + "%";
			this.e_damage_cell_map["表示なし"].title = "表示なし: " + Util.float_to_string(probs["表示なし"] * 100, 2, 0) + "%";
		} else {
			this.e_damage_cell_map["撃沈"].title = "";
			this.e_damage_cell_map["大破"].title = "撃沈+大破: " + Util.float_to_string(cumls["大破"] * 100, 2, 0) + "%";
			this.e_damage_cell_map["中破"].title = "撃沈+大破+中破: " + Util.float_to_string(cumls["中破"] * 100, 2, 0) + "%";
			this.e_damage_cell_map["小破"].title = "撃沈+大破+中破+小破: " + Util.float_to_string(cumls["小破"] * 100, 2, 0) + "%";
			this.e_damage_cell_map["表示なし"].title = "";
		}
		
		if (!this.input_mode) {
			this.e_final_power_cell.textContent = Util.float_to_string(this.final_power, 2, 0, true);
			this.e_hp_cell         .textContent = this.hp + " / " + this.max_hp;
			this.e_armor_cell      .textContent = Util.float_to_string(this.armor, 2, 0, true);
		}
		
	} else {
		for (let key of Damage.DAMAGE_KEYS) {
			this.e_damage_cell_map[key].textContent = "-";
			this.e_damage_cell_map[key].title = "";
			this.e_damage_bar_divs[key].style.width = "0%";
		}
		
		if (!this.input_mode) {
			this.e_final_power_cell.textContent = "";
			this.e_hp_cell         .textContent = "";
			this.e_armor_cell      .textContent = "";
		}
	}
}


function DamageRateRow_ev_change_input(pos, e){
	let cur_hp = Util.formstr_to_int(this.e_hp.value, 0, 0);
	let max_hp = Util.formstr_to_int(this.e_max_hp.value, 0, 0);
	
	if (pos == 1) {
		// 現在HPの変更
		// 最大HP以上になった場合、最大HPも変更
		if (cur_hp.good() && cur_hp.value >= 1) {
			if (max_hp.empty || (max_hp.good() && cur_hp.value > max_hp.value)) {
				this.e_max_hp.value = cur_hp.value;
			}
		}
	} else if (pos == 2) {
		// 最大HPの変更
		// 現在HPも同様に変動する
		if (max_hp.good() && max_hp.value >= 1) {
			let diff = max_hp.value - this.max_hp;
			
			if (cur_hp.good()) {
				this.e_hp.value = Math.max(cur_hp.value + diff, 1);
			} else if (cur_hp.empty) {
				this.e_hp.value = max_hp.value;
			}
		}
	}
	
	this.load_inputs();
	this.refresh();
	if (this.onchange) this.onchange.call(null, e);
}

