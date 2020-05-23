// 遠征ステータス計算機

import * as Util from "./utility.mjs";

import {
	DOM,
	ELEMENT,
	NODE,
	TEXT,
	formstr_to_int,
	formstr_to_float,
	float_to_string,
	message_bar,
} from "./utility.mjs";


// 定数・変数 --------------------------------------------------------------------------------------
const IMPR_FACTORS = [
	1.0, 0.95, 0.5, 0.3, 0.15
];
const IMPR_FUNCNAMES = [
	"sqrt", "sqrt", "sqrt", "linear", "linear"
];


// table_data[i][j] でヘッダーを除いた位置のデータ (PowerData)
// つまり i: 火力～索敵, j: 艦番号
let table_data = null;

// 現在選択中のセルとデータ
let current_select_cell = null;
let current_select_data = null;


document.addEventListener("DOMContentLoaded", expd_st_init);


// -------------------------------------------------------------------------------------------------
function get_func_string(factor, star, name){
	let factor_str = "";
	let star_str = "";
	
	switch (name) {
	case "linear":
		factor_str = float_to_string(factor, 2) + "*";
		star_str = star;
		break;
	case "sqrt":
		factor_str = float_to_string(factor, 2);
		star_str = "&radic;" + star;
		break;
	}
	
	return (factor != 1 ? factor_str : "") + star_str;
}

function get_func_power(factor, star, name){
	switch (name) {
	case "linear": return factor * star;
	case "sqrt":   return factor * Math.sqrt(star);
	}
	return 0;
}


// PowerData ---------------------------------------------------------------------------------------
Object.assign(PowerData.prototype, {
	int_value: 0,
	impr_data: null,
	level_cell: false,
	
	clear     : PowerData_clear,
	add_int   : PowerData_add_int,
	add_impr  : PowerData_add_impr,
	get_string: PowerData_get_string,
	get_power : PowerData_get_power,
});


function PowerData(){
	this.impr_data = new Array;
}

function PowerData_clear(){
	this.int_value = 0;
	this.impr_data = new Array;
}

function PowerData_add_int(power){
	this.int_value += power;
}

function PowerData_add_impr(factor, star, name){
	if (!this.level_cell && this.impr_data.length < 6) {
		this.impr_data.push({
			factor: factor,
			star: star,
			name: name,
		});
	}
}

// 文字列
function PowerData_get_string(){
	let arr = new Array;
	if (this.int_value) arr.push(this.int_value);
	
	for (let impr of this.impr_data) {
		arr.push(get_func_string(impr.factor, impr.star, impr.name));
	}
	
	if (this.impr_data.length > 0) {
		let impr_begin = "<span class=\"impr_value\">";
		let impr_end   = "</span>";
		
		if (this.int_value) {
			arr[0] += impr_begin;
		} else {
			arr[0] = impr_begin + arr[0];
		}
		arr[arr.length - 1] += impr_end;
	}
	
	return arr.join("<wbr>+");
}

// 数値
function PowerData_get_power(){
	let power = this.int_value;
	for (let impr of this.impr_data) {
		power += get_func_power(impr.factor, impr.star, impr.name);
	}
	return power;
}


// -------------------------------------------------------------------------------------------------
function expd_st_init(){
	table_data = new Array;
	for (let i=0; i<5; i++) {
		table_data[i] = new Array;
		for (let j=0; j<6; j++) {
			table_data[i][j] = new PowerData();
			if (i == 4) {
				table_data[i][j].level_cell = true;
			}
		}
	}
	
	let button_div = DOM("buttons");
	let int_div = ELEMENT("div", "int_buttons");
	let sqrt_div = ELEMENT("div", "sqrt_buttons");
	let cell_clear = NODE(ELEMENT("button"), [TEXT("選択セルをクリア")]);
	let all_clear = NODE(ELEMENT("button"), [TEXT("すべてのセルをクリア")]);
	let width_select = ELEMENT("select");
	
	let wlist = [10, 20, 30, 50];
	for (let i=0; i<wlist.length; i++) {
		width_select.appendChild(new Option("行の折り返し: " + wlist[i], wlist[i]));
	}
	
	cell_clear.addEventListener("click", ev_click_clear_cell);
	all_clear.addEventListener("click", ev_click_clear_all);
	width_select.addEventListener("change", ev_change_width);
	
	NODE(button_div, [
		NODE(ELEMENT("div"), [
			cell_clear,
			TEXT(" "),
			all_clear,
			TEXT(" "),
			width_select,
			NODE(ELEMENT("label"), [
				ELEMENT("input", {id: "auto_move", type: "checkbox"}),
				TEXT("入力後移動"),
			]),
		]),
		int_div,
		sqrt_div,
	]);
	
	
	let bars = new Array;
	for (let i=0; i<10; i++) bars.push(ELEMENT("div", "", "bar"));
	for (let i=0; i<100; i++) {
		let btn = NODE(ELEMENT("button", "", "int"), [TEXT(i + 1)]);
		btn.dataset.power = i + 1;
		
		btn.addEventListener("click", ev_click_power);
		
		bars[Math.floor(i / 10)].appendChild(btn);
	}
	NODE(int_div, bars);
	
	for (let p=0; p<IMPR_FACTORS.length; p++) {
		for (let i=1; i<=10; i++) {
			let btn = ELEMENT("button", "", "sqrt");
			btn.innerHTML = get_func_string(IMPR_FACTORS[p], i, IMPR_FUNCNAMES[p]);
			btn.title = get_func_power(IMPR_FACTORS[p], i, IMPR_FUNCNAMES[p]);
			btn.dataset.factorIndex = p;
			btn.dataset.star = i;
			btn.addEventListener("click", ev_click_sqrt);
			
			sqrt_div.appendChild(btn);
		}
		sqrt_div.appendChild(ELEMENT("br"));
	}
	
	let table = DOM("ship_status");
	table.addEventListener("click", ev_click_ship_status);
	select_cell(get_cell_at(0, 0));
	refresh_all();
	
	document.addEventListener("keydown", ev_keydown);
	
	message_bar.start_hiding();
}

function get_cell_at(i, j, allow_total = false){
	let good = 0 <= i && i < table_data.length && 0 <= j && j < table_data[i].length + (allow_total ? 1 : 0);
	return good ? DOM("ship_status").tBodies[0].rows[i].cells[j + 1] : null;
}

function get_cell_index(cell){
	if (!cell || !cell.parentElement) debugger;
	let i = cell.parentElement.sectionRowIndex;
	let j = cell.cellIndex - 1;
	let good = 0 <= i && i < table_data.length && 0 <= j && j < table_data[i].length;
	return {i: i, j: j, good: good};
}

function select_cell(cell){
	if (current_select_cell) {
		current_select_cell.classList.toggle("next_input", false);
	}
	
	if (cell) {
		cell.classList.toggle("next_input", true);
		let index = get_cell_index(cell);
		
		current_select_cell = cell;
		current_select_data = table_data[index.i][index.j];
		
	} else {
		current_select_cell = null;
		current_select_data = null;
	}
}

function refresh_current_cell(){
	if (!current_select_cell) return;
	
	current_select_cell.innerHTML = current_select_data.get_string();
}

function refresh_total(){
	for (let i=0; i<table_data.length; i++) {
		let power = 0;
		for (let j=0; j<table_data[i].length; j++) {
			power += table_data[i][j].get_power();
		}
		let cell = get_cell_at(i, 6, true);
		if (i == 4) {
			// lv
			cell.textContent = power;
		} else {
			cell.textContent = float_to_string(power, 2, -1);
			cell.title = power;
		}
	}
}

function refresh_all(){
	for (let i=0; i<table_data.length; i++) {
		for (let j=0; j<table_data[i].length; j++) {
			get_cell_at(i, j).textContent = table_data[i][j].get_string();
		}
	}
	refresh_total();
}


// event -------------------------------------------------------------------------------------------
// 数値をクリック
function ev_click_power(e){
	if (!current_select_cell) return;
	
	let power = +e.currentTarget.dataset.power;
	current_select_data.add_int(power);
	refresh_current_cell();
	refresh_total();
	
	// 次のセル(右)に移動する
	if (DOM("auto_move").checked && !e.shiftKey) {
		let p = get_cell_index(current_select_cell);
		if (++p.j >= 6) {
			if (++p.i >= 5) return;
			p.j = 0;
		}
		select_cell(get_cell_at(p.i, p.j));
	}
}

// factor * sqrt(star) をクリック
function ev_click_sqrt(e){
	if (!current_select_cell) return;
	
	let factor_index = +e.currentTarget.dataset.factorIndex;
	let factor = IMPR_FACTORS[factor_index];
	let star = +e.currentTarget.dataset.star;
	let name = IMPR_FUNCNAMES[factor_index];
	
	current_select_data.add_impr(factor, star, name);
	refresh_current_cell();
	refresh_total();
}

// セルをクリック
function ev_click_cell(e){
	select_cell(e.currentTarget);
}

function ev_click_clear_cell(e){
	if (!current_select_cell) return;
	
	current_select_data.clear();
	refresh_current_cell();
	refresh_total();
}

function ev_click_clear_all(e){
	for (let arr of table_data) {
		for (let data of arr) {
			data.clear();
		}
	}
	refresh_all();
}

function ev_change_width(e){
	let sel = e.currentTarget;
	let new_size = +sel.options[sel.selectedIndex].value;
	
	// .bar のサイズは40*10
	// 若干余裕をみる
	let new_width = Math.floor(405 * new_size / 10);
	DOM("int_buttons").style.maxWidth = new_width + "px";
}

function ev_click_ship_status(e){
	let td = e.target.closest("td");
	if (td) {
		let index = get_cell_index(td);
		
		if (index.good) {
			select_cell(td);
		}
	}
}

function ev_keydown(e){
	if (!current_select_cell) return;
	let index = get_cell_index(current_select_cell);
	
	switch (e.key) {
	case "ArrowUp": index.i--; break;
	case "ArrowRight": index.j++; break;
	case "ArrowDown": index.i++; break;
	case "ArrowLeft": index.j--; break;
	default: return;
	}
	
	let cell = get_cell_at(index.i, index.j);
	if (cell) {
		select_cell(cell);
	}
	e.preventDefault();
}

