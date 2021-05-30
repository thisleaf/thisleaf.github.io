// ダイアログ

import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT} from "./utility.mjs";


export {
	DOMDialog,
};

/*
outside
inside: ここにサイズを指定
- bar
  - title: タイトル
  - cancel: ×
- contents: ここに内容を入れる
*/

// DOMDialog ---------------------------------------------------------------------------------------
Object.assign(DOMDialog, {
	// ダイアログとして利用する要素を格納する
	// 既存の要素との高さ調整(z-index)はこの要素が行う
	// だいたい body 直下でよいはず
	dialog_container: null,
	// ダイアログオブジェクト
	// DOM要素を持つもの全て
	dialogs: null, // array of DOMDialog
	
	initialized: false,
	initialize : DOMDialog_initialize,
	
	add_dialog   : DOMDialog_add_dialog,
	remove_dialog: DOMDialog_remove_dialog,
	max_z_base   : DOMDialog_max_z_base,
	
	alert: DOMDialog_alert,
});


Object.assign(DOMDialog.prototype, {
/* EventTargetを継承
	cancel: デフォルトのキャンセル動作をした(preventDefault()で動作をキャンセル可能)
		detail == "close" で×ボタンクリック
		"outside" で外側をクリック
		「キャンセルボタンを押した場合」ではない
	resize: リサイズされた(キャンセル可能)
	show  : ダイアログ表示時
	close : ダイアログ終了前(キャンセル可能)
		detail には "cancel", "ok", "hide" などなど (hide()に渡された文字列が入る)
	exit  : ダイアログ終了後(キャンセル不可)
		detail は close と同じ
*/
	
	// 外側のグレーゾーン
	// ない場合も
	e_outside: null,
	// ダイアログ本体
	// サイズはここで指定
	e_inside: null,
	// タイトルバー
	e_bar: null,
	// タイトル
	e_title: null,
	// 右上の閉じるボタン
	e_close: null,
	// ダイアログの内容
	e_contents: null,
	
	// 表示用変数
	showing: false,
	z_base: 0, // z-indexのベース値
	// 表示終了時に解決されるpromiseへの通知関数
	promise_resolver: null,
	
	// ドラッグ移動用変数
	moving: false,
	start_x: 0,
	start_y: 0,
	start_element_x: 0,
	start_element_y: 0,
	
	// closeイベントのセーフティー
	_closing: false,
	
	// ダイアログを作成
	create : DOMDialog_create,
	// ダイアログのボタンにクリックイベントを追加
	add_dialog_button: DOMDialog_add_dialog_button,
	// 廃棄
	dispose: DOMDialog_dispose,
	// ダイアログのタイトルを設定
	set_title: DOMDialog_set_title,
	
	show: DOMDialog_show,
	hide: DOMDialog_hide,
	move_to_front: DOMDialog_move_to_front,
	
	is_modal: DOMDialog_is_modal,
	
	// ダイアログのサイズを設定
	// "" や null の場合設定しない(skip)
	set_size: DOMDialog_set_size,
	get_max_x: DOMDialog_get_max_x,
	get_max_y: DOMDialog_get_max_y,
	get_x: DOMDialog_get_x,
	get_y: DOMDialog_get_y,
	set_x: DOMDialog_set_x,
	set_y: DOMDialog_set_y,
	
	move_by: DOMDialog_move_by,
	move_to: DOMDialog_move_to,
	move_to_center: DOMDialog_move_to_center,
	reset_position: DOMDialog_reset_position,
	
	// private:
	// cancelイベントを発行
	call_cancel: DOMDialog_call_cancel,
	
	// dom event
	ev_click_outside     : DOMDialog_ev_click_outside,
	ev_click_close       : DOMDialog_ev_click_close,
	ev_pointerdown_inside: DOMDialog_ev_pointerdown_inside,
	ev_pointerdown_title : DOMDialog_ev_pointerdown_title,
	ev_pointermove_title : DOMDialog_ev_pointermove_title,
	ev_pointerup_title   : DOMDialog_ev_pointerup_title,
	ev_resize_window     : DOMDialog_ev_resize_window,
	ev_document_keydown  : DOMDialog_ev_document_keydown,
});

Object.defineProperties(DOMDialog.prototype, {
	x: {get: DOMDialog_get_x, set: DOMDialog_set_x},
	y: {get: DOMDialog_get_y, set: DOMDialog_set_y},
});


// DOMDialog static ------------------------------------------------------------
function DOMDialog_initialize(container){
	if (DOMDialog.initialized) return;
	
	if (container) {
		DOMDialog.dialog_container = container;
	} else {
		let c = document.querySelector(".dialog_container");
		if (c) {
			DOMDialog.dialog_container = c;
		} else {
			debugger;
		}
	}
	
	DOMDialog.dialogs = new Array;
	window.addEventListener("resize", e => {
		// ウィンドウのリサイズ時、移動可能ダイアログがはみ出す可能性がある
		for (let d of DOMDialog.dialogs) {
			d.ev_resize_window(e);
		}
	});
	document.addEventListener("keydown", e => {
		// keydownイベント
		for (let d of DOMDialog.dialogs) {
			d.ev_document_keydown(e);
		}
	});
	
	DOMDialog.initialized = true;
}

function DOMDialog_add_dialog(dialog){
	let dialogs = DOMDialog.dialogs;
	if (dialogs.indexOf(dialog) < 0) {
		dialogs.push(dialog);
	}
}

function DOMDialog_remove_dialog(dialog){
	let dialogs = DOMDialog.dialogs;
	let idx = dialogs.indexOf(dialog);
	if (idx >= 0) {
		dialogs.splice(idx, 1);
	}
}

// 表示中のダイアログのうち、最大のz_base
function DOMDialog_max_z_base(ignore_dialog = null){
	let dialogs = DOMDialog.dialogs;
	return dialogs.reduce((acc, cur) => {
		let c = acc;
		if (cur.showing && cur != ignore_dialog) {
			if (c < cur.z_base) c = cur.z_base;
		}
		return c;
	}, 0);
}

// window.alert() の代わり
// Promiseを返し、ウィンドウが閉じられた際にイベントが発生
// 閉じた場合なども成功に移行する
function DOMDialog_alert(message, title = ""){
	let dialog = new DOMDialog();
	dialog.create("modal", "alert", true);
	dialog.e_inside.classList.add("alert");
	if (title) {
		dialog.e_title.textContent = title;
	}
	
	let ok_button = ELEMENT("button", {className: "ok", textContent: "OK"});
	
	NODE(dialog.e_contents, [
		ELEMENT("div", {className: "message", innerText: message}),
		NODE(ELEMENT("div", "", "button_div"), [
			ok_button
		]),
	]);
	
	dialog.add_dialog_button(ok_button, "ok");
	
	let promise = new Promise((resolve, reject) => {
		dialog.addEventListener("exit", e => {
			dialog.dispose();
			resolve("ok");
		});
	});
	
	dialog.show();
	return promise;
}


// DOMDialog member ------------------------------------------------------------
/**
 * @constructor
 * @todo write jsdoc
 */
function DOMDialog(){
	Util.attach_event_target(this);
}

/**
 * ダイアログを作成、まだ表示はしない<br>
 * mode: "modal" でモーダルダイアログ
 *   "modeless" でモードレスダイアログ
 * @param {("modal"|"modeless")} mode 動作モード
 * @param {string} [title=""] ダイアログのタイトル
 * @param {boolean} [movable=false] 移動可能にするかどうか
 * @return {DOMDialog} this
 * @method create
 * @memberof DOMDialog.prototype
 */
function DOMDialog_create(mode, title = "", movable = false){
	if (this.e_inside || !DOMDialog.initialized) debugger;
	
	let container = DOMDialog.dialog_container;
	
	this.e_inside   = ELEMENT("div", "", "inside hidden");
	this.e_bar      = ELEMENT("div", "", "bar noselect" );
	this.e_title    = ELEMENT("div", "", "title"   );
	this.e_close    = ELEMENT("div", "", "close"   );
	this.e_contents = ELEMENT("div", "", "contents");
	
	NODE(this.e_inside, [
		NODE(this.e_bar, [
			this.e_title,
			NODE(this.e_close, [
				NODE(ELEMENT("div", "", "mark_x"), [ELEMENT("div"), ELEMENT("div")]),
			]),
		]),
		this.e_contents,
	]);
	
	if (mode == "modeless") {
		this.e_outside = null;
		NODE(container, [this.e_inside]);
		
	} else {
		this.e_outside = ELEMENT("div", "", "outside hidden");
		NODE(container, [this.e_outside, this.e_inside]);
	}
	
	// set event
	if (this.e_outside) {
		this.e_outside.addEventListener("click", e => this.ev_click_outside(e));
	}
	this.e_inside.addEventListener("pointerdown", e => this.ev_pointerdown_inside(e));
	this.e_close.addEventListener("click", e => this.ev_click_close(e));
	
	this.e_title.addEventListener("pointerdown", e => this.ev_pointerdown_title(e));
	this.e_title.addEventListener("pointerup"  , e => this.ev_pointerup_title(e));
	this.e_title.addEventListener("pointermove", e => this.ev_pointermove_title(e));
	
	if (title) this.set_title(title);
	if (movable) this.e_inside.classList.add("movable");
	
	DOMDialog.add_dialog(this);
	return this;
}

// button をクリックしたときに、closeイベント(exitイベント)が発生するようになる
function DOMDialog_add_dialog_button(button, detail){
	button.addEventListener("click", e => this.hide(detail));
}

// ダイアログ(DOM)の解放
// オブジェクトを捨てる前には必ず
function DOMDialog_dispose(){
	if (this.showing) {
		this.hide("cancel", false);
	}
	
	if (this.e_outside) {
		DOMDialog.dialog_container.removeChild(this.e_outside);
		this.e_outside = null;
	}
	if (this.e_inside) {
		DOMDialog.dialog_container.removeChild(this.e_inside);
		this.e_inside = null;
	}
	this.e_bar = null;
	this.e_title = null;
	this.e_close = null;
	this.e_contents = null;
	this.showing = false;
	this.moving = false;
	
	DOMDialog.remove_dialog(this);
}

function DOMDialog_set_title(title){
	this.e_title.textContent = title;
}

// 表示
// Promiseを返し、そのPromiseはダイアログが閉じたときに解決される
// 既に表示されている場合は拒絶のPromise
// Promiseの性質上、"exit"イベントのあとにPromiseの解決が通知される
function DOMDialog_show(){
	if (!this.showing) {
		this.showing = true;
		if (this.e_outside) this.e_outside.classList.remove("hidden");
		this.e_inside.classList.remove("hidden");
		this.move_to_front();
		
		let p = new Promise(resolve => {
			this.promise_resolver = resolve;
		});
		this.dispatchEvent(new CustomEvent("show"));
		return p;
		
	} else {
		return Promise.reject("showing");
	}
}

// ダイアログ終了
// reason に終了理由
// close イベント中に呼び出してはならない
function DOMDialog_hide(reason = "hide", cancelable = true){
	if (this.showing) {
		let suc = true;
		
		if (cancelable) {
			if (this._closing) {
				debugger;
				return;
			}
			this._closing = true;
			suc = this.dispatchEvent(new CustomEvent("close", {detail: reason, cancelable: true}));
			this._closing = false;
		}
		
		if (suc) {
			this.showing = false;
			if (this.e_outside) this.e_outside.classList.add("hidden");
			this.e_inside.classList.add("hidden");
			this.dispatchEvent(new CustomEvent("exit", {detail: reason}));
			this.promise_resolver(reason);
			this.promise_resolver = null;
		}
	}
}

function DOMDialog_move_to_front(){
	if (this.showing) {
		this.z_base = DOMDialog.max_z_base(this) + 2;
		if (this.e_outside) {
			this.e_outside.style.zIndex = this.z_base;
		}
		this.e_inside.style.zIndex = this.z_base + 1;
	}
}

function DOMDialog_is_modal(){
	return this.e_outside != null;
}

function DOMDialog_set_size(width, height){
	if (width) this.e_inside.style.width = width;
	if (height) this.e_inside.style.height = height;
}

// ダイアログの位置変数の最大を返す
// 半分を設定すれば中央に置くことに
// 表示してからでないと正しい値が返らない
function DOMDialog_get_max_x(){
	return document.documentElement.clientWidth - this.e_inside.offsetWidth;
}
function DOMDialog_get_max_y(){
	return document.documentElement.clientHeight - this.e_inside.offsetHeight;
}

// ダイアログの現在位置
// x, y のプロパティでもアクセスできる
function DOMDialog_get_x(){
	return this.e_inside.offsetLeft;
}
function DOMDialog_get_y(){
	return this.e_inside.offsetTop;
}
function DOMDialog_set_x(x){
	this.move_to(x, this.y);
}
function DOMDialog_set_y(y){
	this.move_to(this.x, y);
}

// ダイアログの移動(相対)
// fit: 画面内に収める
// retry_scroff: スクロールバーが消えた場合にリトライ(fit:true)
function DOMDialog_move_by(dx, dy, fit = true, retry_scroff = true){
	this.move_to(dx + this.e_inside.offsetLeft, dy + this.e_inside.offsetTop, fit, retry_scroff);
}

// ダイアログの移動(絶対)
function DOMDialog_move_to(x, y, fit = true, retry_scroff = true){
	let left = x, top = y;
	let cw = document.documentElement.clientWidth;
	let ch = document.documentElement.clientHeight;
	
	if (fit) {
		let min_x = 0;
		let max_x = cw - this.e_inside.offsetWidth;
		left = Math.min(Math.max(left, min_x), max_x);
		
		let min_y = 0;
		let max_y = ch - this.e_inside.offsetHeight;
		top = Math.min(Math.max(top, min_y), max_y);
	}
	
	this.e_inside.style.left   = left + "px";
	this.e_inside.style.right  = "unset";
	this.e_inside.style.top    = top + "px";
	this.e_inside.style.bottom = "unset";
	
	if (fit && retry_scroff && (cw < document.documentElement.clientWidth || ch < document.documentElement.clientHeight)) {
		// 移動によってスクロールバーが消えた
		this.move_to(x, y, fit, false);
	}
}

// centering
// false にするとそのまま
function DOMDialog_move_to_center(move_x = true, move_y = true){
	let new_x = move_x ? this.get_max_x() / 2 : this.e_inside.offsetLeft;
	let new_y = move_y ? this.get_max_y() / 2 : this.e_inside.offsetTop;
	this.move_to(new_x, new_y);
}

function DOMDialog_reset_position(){
	this.e_inside.style.left   = "";
	this.e_inside.style.right  = "";
	this.e_inside.style.top    = "";
	this.e_inside.style.bottom = "";
}

function DOMDialog_call_cancel(detail){
	// キャンセル動作
	// どこかで preventDefault() が呼ばれると、戻り値が false になる
	if (this.dispatchEvent(new CustomEvent("cancel", {detail: detail, cancelable: true}))) {
		this.hide("cancel");
	}
}


// DOMDialog event -------------------------------------------------------------
// ダイアログの外側がクリックされた
function DOMDialog_ev_click_outside(e){
	if (e.currentTarget == this.e_outside) {
		// cancel
		this.call_cancel("outside");
	}
}

function DOMDialog_ev_click_close(e){
	this.call_cancel("close");
}

function DOMDialog_ev_pointerdown_inside(e){
	if (e.button == 0) this.move_to_front();
}

// e_inside に "movable" クラスが設定されているとき、タイトルをドラッグで移動可能にする
function DOMDialog_ev_pointerdown_title(e){
	if (e.button == 0 && this.e_inside.classList.contains("movable")) {
		// ポインターをキャプチャーすると画面外などに行っても pointermove が起こる
		this.e_title.setPointerCapture(e.pointerId);
		e.preventDefault();
		
		this.moving = true;
		this.start_x = e.x;
		this.start_y = e.y;
		this.start_element_x = this.e_inside.offsetLeft;
		this.start_element_y = this.e_inside.offsetTop;
	}
}

function DOMDialog_ev_pointermove_title(e){
	if (this.moving) {
		let dx = e.x - this.start_x;
		let dy = e.y - this.start_y;
		let left = this.start_element_x + dx;
		let top = this.start_element_y + dy;
		this.move_to(left, top, true, true);
	}
}

function DOMDialog_ev_pointerup_title(e){
	if (this.moving) {
		this.e_title.releasePointerCapture(e.pointerId);
		e.preventDefault();
		this.moving = false;
	}
}

function DOMDialog_ev_resize_window(e){
	if (this.dispatchEvent(new CustomEvent("resize", {cancelable: true}))) {
		if (this.e_inside.style.left != "") {
			this.move_by(0, 0, true, true);
		}
	}
}

/**
 * documentのkeydownイベント 必要ならばoverride
 * @param {KeyboardEvent} _e 
 * @method DOMDialog#ev_document_keydown
 * @protected
 */
function DOMDialog_ev_document_keydown(_e){
}
