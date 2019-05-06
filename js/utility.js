// いろいろなページで使える関数のまとめ

// このファイルで使われるクラス --------------------------------------------------------------------
// フォームの文字列などの変換結果
ConvertResult.prototype = {
	value: 0,
	error: false,
	empty: false,
	message: null,
	
	good   : ConvertResult_good,
	get    : ConvertResult_get,
	valueOf: ConvertResult_valueOf
};

ConvertResult.good = ConvertResult_static_good;


function ConvertResult(){
	switch (arguments.length) {
	default:
	case 4: this.message = arguments[3];
	case 3: this.empty = arguments[2];
	case 2: this.error = arguments[1];
	case 1: this.value = arguments[0];
	case 0: break;
	}
}

function ConvertResult_good(){
	return !this.empty && !this.error;
}

function ConvertResult_get(def){
	return this.good() ? this.value : def;
}

function ConvertResult_valueOf(){
	return this.value;
}

function ConvertResult_static_good(x){
	return x && x.good();
}


// 汎用関数 ----------------------------------------------------------------------------------------
// 2小数について、近くにあるか
function is_near(x, y, d){
	return Math.abs(x - y) <= d;
}

// xor (boolean)
// まあ != なんでちけど
function xor(a, b){
	return (a ? 1 : 0) != (b ? 1 : 0);
}


// てきーとな変換関数
// xとかflenが大きくなるとうまく変換できないかも
function float_to_string(x, flen, dir){
	if (!(flen >= 0)) flen = 0;
	
	var scaler = Math.pow(10, flen);
	x *= scaler;
	x  = dir > 0 ? Math.ceil(x) : dir < 0 ? Math.floor(x) : Math.round(x);
	x /= scaler;
	var str = String(x);
	
	if (flen > 0) {
		var fill = 0;
		if (/^\-?\d+\.(\d+)$/.test(str)) {
			fill = flen - RegExp.$1.length;
			
		} else if (/^\-?\d+$/.test(str)) {
			str += ".";
			fill = flen;
		}
		for (var i=0; i<fill; i++) str += "0";
	}
	return str;
}


// 自動idの追加
// 要素を追加したときにidが変わってしまうかもしれないのは微妙かも
function add_autoid(json, begin){
	for (var i=0; i<json.length; i++) {
		if (json[i] && !json[i].hasOwnProperty("id")) {
			json[i].id = begin++;
		}
	}
	return json;
}

// id -> データ のマップを作成
// json: idをプロパティに持つオブジェクト(データ)の配列
function makemap_by_id(json){
	var map = new Object;
	for (var i=0; i<json.length; i++) {
		if (json[i] && json[i].hasOwnProperty("id")) {
			if (map.hasOwnProperty(json[i].id)) {
				// 重複の警告
				console.log("warning: idが重複しています(" + json[i].id + ")");
			}
			map[json[i].id] = json[i];
		}
	}
	return map;
}

// name版
function makemap_by_name(json){
	var map = new Object;
	for (var i=0; i<json.length; i++) {
		if (json[i] && json[i].hasOwnProperty("name")) {
			if (map.hasOwnProperty(json[i].name)) {
				// 重複の警告
				console.log("warning: nameが重複しています(" + json[i].name + ")");
			}
			map[json[i].name] = json[i];
		}
	}
	return map;
}

// idから参照
// 先頭から順に見ていくため、たくさんのデータを参照する場合は上の関数でオブジェクトを作ったほうが早い
function get_param_by_id(json, id){
	for (var i=0; i<json.length; i++) {
		if (json[i] && json[i].hasOwnProperty("id") && json[i].id == id) {
			return json[i];
		}
	}
	return null;
}

// name版
function get_param_by_name(json, name){
	for (var i=0; i<json.length; i++) {
		if (json[i] && json[i].hasOwnProperty("name") && json[i].name == name) {
			return json[i];
		}
	}
	return null;
}

// xが偽だった場合に例外を投げる
function assert(x, message){
	if (!x) {
		if (!message) message = "assertion failed!";
		throw new Error(message);
	}
	return x;
}



// DOM関係 -----------------------------------------------------------------------------------------
// jQuery には $ ってやつがあるらしいね？
function DOM(id){
	return document.getElementById(id);
}


function create_input(type, id, name, className, value){
	var e = document.createElement("input");
	switch (arguments.length) {
	default:
	case 5: e.value = value;
	case 4: e.className = className;
	case 3: e.name = name;
	case 2: e.id = id;
	case 1: e.type = type;
	case 0: break;
	}
	return e;
}


function create_select(id, className){
	var e = document.createElement("select");
	switch (arguments.length) {
	default:
	case 2: e.className = className;
	case 1: e.id = id;
	case 0: break;
	}
	return e;
}


function create_cell(tag, text, colspan, rowspan, className){
	var e = document.createElement(tag);
	switch (arguments.length) {
	default:
	case 5: e.className = className;
	case 4: e.rowSpan = rowspan;
	case 3: e.colSpan = colspan;
	case 2: e.textContent = text;
	case 1:
	case 0: break;
	}
	return e;
}

function create_html_cell(tag, html, colspan, rowspan, className){
	var e = document.createElement(tag);
	switch (arguments.length) {
	default:
	case 5: e.className = className;
	case 4: e.rowSpan = rowspan;
	case 3: e.colSpan = colspan;
	case 2: e.innerHTML = html;
	case 1:
	case 0: break;
	}
	return e;
}


function create_row(cells, className){
	var tr = document.createElement("tr");
	if (cells) {
		for (var i=0; i<cells.length; i++) {
			tr.appendChild(cells[i]);
		}
	}
	if (className) tr.className = className;
	return tr;
}


// 子ノードをすべて削除
function remove_children(elem){
	while (elem.firstChild) {
		elem.removeChild(elem.firstChild);
	}
}


// selectのクラスを選択中のoptionのクラスにする
function option_class_inheritancer(ev){
	var e = ev.srcElement;
	if (e.selectedIndex >= 0) {
		e.className = e.options[e.selectedIndex].className;
	}
}


// スタイルの動的変更
// id=style_changer のstyle要素が必要
// 古いスタイルは上書きされる
function change_style(selector, text){
	var style = document.getElementById("style_changer");
	if (!style) return;
	
	var sheet = style.sheet;
	var css = selector + "{" + text + "}";
	
	for (var i=0; i<sheet.cssRules.length; i++) {
		if (sheet.cssRules[i].selectorText == selector) {
			sheet.deleteRule(i);
			break;
		}
	}
	sheet.insertRule(css, 0);
}

// 文字列から数値への変換
// 戻り値は ConvertResult
// フォームの読み取りなどに
function formstr_to_int(value, empty_value, error_value){
	var res = new ConvertResult;
	
	if (/^[\+\-]?\d+$/.test(value)) {
		res.value =  parseInt(value, 10);
		
	} else if (value === "") {
		res.empty = true;
		if (arguments.length >= 2) res.value = empty_value;
		
	} else {
		res.error = true;
		if (arguments.length >= 3) res.value = error_value;
	}
	return res;
}

function formstr_to_float(value, empty_value, error_value){
	var res = new ConvertResult;
	
	if (/^[\+\-]?\d+(?:\.\d+)?$/.test(value)) {
		res.value = parseFloat(value);
		
	} else if (value === "") {
		res.empty = true;
		if (arguments.length >= 2) res.value = empty_value;
		
	} else {
		res.error = true;
		if (arguments.length >= 3) res.value = error_value;
	}
	return res;
}


// 文字実体参照を展開
// str: 展開する文字列
function unescape_charref(str){
	if (!unescape_charref.element) {
		unescape_charref.element = document.createElement("pre");
	}
	return str.replace(/&(?:\w+|#\d+);/g, function (x){
		unescape_charref.element.innerHTML = x;
		return unescape_charref.element.textContent;
	});
}


// checkbox, radioのみ
function get_form_checks(obj, ids){
	for (var i=0; i<ids.length; i++) {
		var e = document.getElementById(ids[i]);
		if (e) {
			obj[ids[i]] = e.checked;
		}
	}
	return obj;
}

function get_form_check(id){
	return DOM(id).checked;
}

function get_form_ints(obj, empty_value, error_value, ids){
	for (var i=0; i<ids.length; i++) {
		var e = document.getElementById(ids[i]);
		if (e) {
			obj[ids[i]] = formstr_to_int(e.value, empty_value, error_value);
		}
	}
	return obj;
}

function get_form_int(id){
	return formstr_to_int(DOM(id).value);
}

function get_form_floats(obj, empty_value, error_value, ids){
	for (var i=0; i<ids.length; i++) {
		var e = document.getElementById(ids[i]);
		if (e) {
			obj[ids[i]] = formstr_to_float(e.value, empty_value, error_value);
		}
	}
	return obj;
}

function get_form_float(id){
	return formstr_to_float(DOM(id).value);
}

function get_form_strings(obj, ids){
	for (var i=0; i<ids.length; i++) {
		var e = document.getElementById(ids[i]);
		if (e) {
			obj[ids[i]] = e.value;
		}
	}
	return obj;
}

function set_form_values(obj, ids){
	for (var i=0; i<ids.length; i++) {
		var e = document.getElementById(ids[i]);
		if (e) {
			if (e.tagName == "INPUT" && e.type == "checkbox") {
				e.checked = obj[ids[i]];
			} else {
				e.value = obj[ids[i]];
			}
		}
	}
}


function add_error_class(id){
	var e = DOM(id);
	e.classList.add(FORM_ERROR_CLASSNAME);
}

function clear_error_class(id){
	var e = DOM(id);
	e.classList.remove(FORM_ERROR_CLASSNAME);
}



