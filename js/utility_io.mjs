import {NODE, ELEMENT, TEXT} from "./utility.mjs";

export {
	LSUserData,
	FormRecorder,
};


// LSUserData --------------------------------------------------------------------------------------
// LocalStorage にデータを保存
Object.assign(LSUserData.prototype, {
	// LocalStorage に保存する際の key
	key : "",
	// 保存するデータ (object)
	data: null,
	// バージョン番号。指定するなら1以上。data.version に自動で格納される。[optional]
	version: 0,
	// バージョンアップで呼び出される関数 [optional]
	// updator(data, old_version_number, new_version_number)
	// 戻り値でバージョンアップ後のデータを返す
	updator: null,
	
	load  : LSUserData_load,
	save  : LSUserData_save,
	remove: LSUserData_remove,
});


function LSUserData(key, version, updator){
	if (!key) {
		console.log("keyを指定してください");
		debugger;
	}
	
	this.key = key;
	this.version = version || 0;
	this.updator = updator || null;
}

// データのロード
// 存在しなかったりすると null とかが返る
function LSUserData_load(){
	this.data = null;
	
	try {
		// なくても null が返るだけだが、一応 try 内においておく
		let json_text = localStorage.getItem(this.key);
		if (!json_text) return null;
		
		this.data = JSON.parse(json_text);
		
	} catch (err) {
		return null;
	}
	
	if (this.data && this.data.version != this.version) {
		if (this.updator) {
			this.data = this.updator.call(null, this.data, this.data.version, this.version);
		}
		//this.data.version = this.version;
	}
	
	return this.data;
}

// データを保存する
// data が null の場合は失敗(false)
function LSUserData_save(){
	if (!this.data) return false;
	
	if (this.version) {
		this.data.version = this.version;
	}
	
	try {
		localStorage.setItem(this.key, JSON.stringify(this.data));
	} catch (err) {
		return false;
	}
	
	return true;
}

function LSUserData_remove(){
	try {
	 localStorage.removeItem(this.key);
	} catch (err) {
	}
}


// FormRecorder ------------------------------------------------------------------------------------
// 編成の保存・呼び出しなどのバーを作成する
Object.assign(FormRecorder.prototype, {
	e_toolbar      : null, // これらを囲むdiv
	e_record_list  : null, // 保存名のリスト
	e_load_button  : null, // 読込
	e_delete_button: null, // 削除
	e_record_name  : null, // 保存名
	e_save_button  : null, // 保存
	e_clear_button : null, // 編成クリア
	e_display_check: null, // 削除・クリアボタンの表示切り替え
	
	use_hidden_checkbox: false,
	
	create: FormRecorder_create,
	ev_change_hidden: FormRecorder_ev_change_hidden,
});


function FormRecorder(use_hidden_checkbox){
	this.use_hidden_checkbox = use_hidden_checkbox || false;
}

function FormRecorder_create(parent){
	let hidden_class = this.use_hidden_checkbox ? "hidden" : "";
	
	this.e_toolbar = NODE(ELEMENT("div", "", "toolbar"), [
		NODE(ELEMENT("div"), [
			TEXT("リスト: "),
			this.e_record_list   = ELEMENT("select", "", "record_list"),
			this.e_load_button   = NODE(ELEMENT("button"), [TEXT("読込")]),
			this.e_delete_button = NODE(ELEMENT("button", "", hidden_class), [TEXT("削除")]),
		]),
		NODE(ELEMENT("div"), [
			TEXT("編成名"),
			this.e_record_name   = ELEMENT("input", {type: "text", className: "record_name"}),
			this.e_save_button   = NODE(ELEMENT("button", {className: "save_button", disabled: true}), [TEXT("保存")]),
			this.e_clear_button  = NODE(ELEMENT("button", "", hidden_class), [TEXT("編成クリア")]),
		]),
	]);
	
	if (this.use_hidden_checkbox) {
		NODE(this.e_toolbar, [
			NODE(ELEMENT("div"), [
				NODE(ELEMENT("label"), [
					this.e_display_check = ELEMENT("input", {type: "checkbox"}),
					TEXT("他のボタン"),
				]),
			]),
		]);
		
		this.e_display_check.addEventListener("change", e => this.ev_change_hidden());
	} else {
		this.e_display_check = null;
	}
	
	// parent を指定していたらその直下に置く
	if (parent) {
		parent.appendChild(this.e_toolbar);
	}
	
	return this.e_toolbar;
}

function FormRecorder_ev_change_hidden(){
	let chk = this.e_display_check.checked;
	this.e_delete_button.classList.toggle("hidden", !chk);
	this.e_clear_button.classList.toggle("hidden", !chk);
}

