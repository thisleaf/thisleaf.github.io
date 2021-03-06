// いろいろなページで使える関数のまとめ
// 新しいバージョンはmjs版、js版は互換性のために残しておく

// このファイルで使われるクラス --------------------------------------------------------------------
// フォームの文字列などの変換結果
Object.assign(ConvResult.prototype, {
	value: 0,
	error: false,
	empty: false,
	message: null,
	
	in_range: ConvResult_in_range,
	good    : ConvResult_good,
	get     : ConvResult_get,
	valueOf : ConvResult_valueOf,
});

ConvResult.good = ConvResult_static_good;


function ConvResult(){
	switch (arguments.length) {
	default:
	case 4: this.message = arguments[3];
	case 3: this.empty = arguments[2];
	case 2: this.error = arguments[1];
	case 1: this.value = arguments[0];
	case 0: break;
	}
}

// [a, b]の区間にあるか
function ConvResult_in_range(a, b){
	return a <= this.value && this.value <= b;
}

function ConvResult_good(){
	return !this.empty && !this.error;
}

function ConvResult_get(def){
	return this.good() ? this.value : def;
}

function ConvResult_valueOf(){
	return this.value;
}

function ConvResult_static_good(x){
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

// 整数の変換関数。例によって大きい数などは考慮されていない
// n: 変換する整数
// len: 数値の(最低)文字数。不足している場合は0を補完する
// plus: 0以上の場合に+を補完する
function int_to_string(n, len, plus){
	let str = String(n < 0 ? -n : n);
	if (/^\d+$/.test(str)) {
		while (str.length < len) str = "0" + str;
	}
	if (n < 0) {
		str = "-" + str;
	} else if (plus) {
		str = "+" + str;
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

// 1度だけconsole.log
function trace_once(message, id){
	if (!trace_once.traced) trace_once.traced = new Object;
	let prop = id || "*DEFAULT*";
	if (trace_once.traced[prop]) return;
	console.log(message);
	trace_once.traced[prop] = true;
}

// 日付を文字列に
function strYMD(d){
	return d.getFullYear() + "/" + int_to_string(d.getMonth() + 1, 2) + "/" + int_to_string(d.getDate(), 2);
}

function strYMDHM(d){
	return strYMD(d) + " " + int_to_string(d.getHours(), 2) + ":" + int_to_string(d.getMinutes(), 2);
}


// 通信, csv ---------------------------------------------------------------------------------------
// csvファイルのロード。データはすべて文字列だが、改行は\nに置き換えられる
// url       : URL
// use_header: 1行目をヘッダーとみなす。各行はヘッダー行をキーとする連想配列になる (false の場合は通常の配列)
// func(obj) : 読み込み完了時に呼ばれる関数。obj には行データの配列。ただしエラーの場合は null
// func(obj) : (後方互換) 読み込み完了時に呼ばれる関数。obj には行データの配列。ただしエラーの場合は null
// 戻り値    : Promiseオブジェクト。読み込み完了時に解決される。エラー時はreject
function httpload_csv_async(url, use_header, func = null){
	let data = null;
	let xml = new XMLHttpRequest;
	
	// リクエスト成功時イベント
	xml.addEventListener("load", function (){
		data = parse_csv_text(xml.responseText, use_header);
	});
	let promise = new Promise((resolve, reject) => {
		// リクエスト終了時のイベント(loadの後。エラーでも発生)
		xml.addEventListener("loadend", function (){
			if (func) func(data);
			if (data) {
				resolve(data);
			} else {
				reject();
			}
		});
	});
	
	xml.open("GET", url);
	xml.send();
	return promise;
}


// csvのパース
// src: csvデータ
// use_header: 1行目をヘッダーとみなす
function parse_csv_text(src, use_header){
	let text = src.replace(/\r\n|\r/g, "\n");
	
	let separated = new Array;
	let line = new Array;
	
	while (text != "") {
		let str, delim;
		
		// ダブルクオーテーションの展開
		// "あ""い""う" → あ"い"う
		if (/^((?:"[^"]*")+)([,\n]|$)/.test(text)) {
			str = RegExp.$1;
			delim = RegExp.$2;
			text = RegExp.rightContext;
			
			str = str.replace(/^"|"$/g, "").replace(/""/g, "\"");
			
		} else if (/^([^,\n]*)([,\n]|$)/.test(text)) {
			str = RegExp.$1;
			delim = RegExp.$2;
			text = RegExp.rightContext;
			
		} else {
			// ここにはこないはず
			console.log("parse_csv_text(): 内部エラー");
			break;
		}
		
		line.push(str);
		
		if (delim != ",") {
			separated.push(line);
			line = new Array;
		}
	}
	
	if (line.length > 0) separated.push(line);
	
	// ヘッダー変換なしならそのまま
	if (!use_header) {
		return separated;
	}
	
	// ヘッダー変換
	let data = new Array;
	let header_line = separated[0];
	
	if (header_line) {
		for (let i=1; i<separated.length; i++) {
			let obj = new Object;
			for (let j=0; j<header_line.length; j++) {
				obj[header_line[j]] = separated[i][j] || "";
			}
			data.push(obj);
		}
	}
	
	return data;
}


// csv データの lastModified 列をチェック
// 一番新しい日付を返す
function get_csv_last_modified(csv){
	let lastmod = null;
	if (csv) {
		for (let x of csv) {
			if (x.lastModified) {
				let d = new Date(x.lastModified);
				if ( d.getTime() > 0 &&
					(!lastmod || lastmod.getTime() < d.getTime()) )
				{
					lastmod = d;
				}
			}
		}
	}
	return lastmod;
}


// DOM関係 -----------------------------------------------------------------------------------------
// jQuery には $ ってやつがあるらしいね？
function DOM(id){
	return document.getElementById(id);
}

// DOMの構成用
// parent の子要素として children (array of element) を配置する
// children の要素には null を許容 (無視)
// これで html 文章のように構造順に書けるはず
function NODE(parent, children){
	for (let child of children) {
		if (child) parent.appendChild(child);
	}
	return parent;
}

// elementの生成
// ELEMENT(tag, id, className)
// ELEMENT(tag, {id: id, className: className})
// など　後者は他のプロパティーへの代入も可能
function ELEMENT(tag, id_or_props, className){
	let e = document.createElement(tag);
	
	if (id_or_props && typeof id_or_props == "object") {
		// 第2引数はプロパティーを指定するオブジェクト
		Object.assign(e, id_or_props);
		
	} else {
		// 第2引数はID
		if (id_or_props) e.id = id_or_props;
		if (className) e.className = className;
	}
	return e;
}

// text-node の生成
function TEXT(text){
	return document.createTextNode(text);
}


// old version
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
			if (cells[i]) { // 要素にnullを許容
				tr.appendChild(cells[i]);
			}
		}
	}
	if (className) tr.className = className;
	return tr;
}


function create_br(){
	return document.createElement("br");
}


// 子ノードをすべて削除
function remove_children(elem){
	while (elem.firstChild) {
		elem.removeChild(elem.firstChild);
	}
}


// selectのクラスを選択中のoptionのクラスにする
function option_class_inheritancer(ev){
	var e = ev.currentTarget;
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
// 戻り値は ConvResult
// フォームの読み取りなどに
function formstr_to_int(value, empty_value, error_value){
	var res = new ConvResult;
	
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
	var res = new ConvResult;
	
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
				e.checked = obj[ids[i]] || false;
			} else {
				e.value = obj[ids[i]] || "";
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


// title属性の"\n"を改行に置き換える
// document中の全ての要素が対象
function expand_title_newline(){
	let elems = document.querySelectorAll("*[title]");
	
	for (let i=0; i<elems.length; i++) {
		let e = elems[i];
		let str = e.title;
		let expanded = str.replace(/\\n/g, "\n");
		
		if (str != expanded) {
			e.title = expanded;
		}
	}
}


// MessageBar --------------------------------------------------------------------------------------
// メッセージを表示する
Object.assign(MessageBar.prototype, {
	element : null,
	timer_id: null,
	
	show        : MessageBar_show,
	show_html   : MessageBar_show_html,
	clear_timer : MessageBar_clear_timer,
	start_hiding: MessageBar_start_hiding,
	hide        : MessageBar_hide,
});

function MessageBar(element){
	this.element = element;
	this.element.classList.add("message_bar");
	this.hide();
	this.element.addEventListener("transitionend", e => this.hide());
}

// メッセージを表示
// time: 何ミリ秒後に隠すか　省略すると隠さない
function MessageBar_show(message, time){
	this.element.textContent = message;
	this.element.classList.remove("hide");
	this.element.classList.remove("hide_animation");
	this.clear_timer();
	
	if (time > 0) {
		this.timer_id = setTimeout(e => this.start_hiding(true), time);
	}
}

// htmlメッセージを表示
function MessageBar_show_html(message, time){
	this.show("", time);
	this.element.innerHTML = message;
}

// 非表示開始タイマーをクリア
function MessageBar_clear_timer(){
	if (this.timer_id) {
		clearTimeout(this.timer_id);
		this.timer_id = null;
	}
}

// 呼ぶとメッセージを隠すアニメーションを開始する
// display: none; の状態からいきなりアニメーションは適用できない（たぶん）
function MessageBar_start_hiding(on_timeout){
	if (on_timeout) {
		this.timer_id = null;
	} else {
		this.clear_timer();
	}
	this.element.classList.add("hide_animation");
}

// メッセージを即時に非表示にする
function MessageBar_hide(){
	this.clear_timer();
	this.element.classList.add("hide");
	this.element.classList.remove("hide_animation");
}

