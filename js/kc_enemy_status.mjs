/* 敵艦のデータ、選択ダイアログ */

import * as Util from "./utility.mjs";
import {NODE, ELEMENT, EL, TEXT, BRTEXT} from "./utility.mjs";
import {DOMDialog} from "./dom_dialog.mjs";
import {RomajiSearch} from "./romaji_search.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import * as Damage from "./kc_damage_utility.mjs";

export {
	EnemySelectorDialog,
	EnemyStatusData,
	EnemyStatus,
};


/**
 * 敵艦の選択とステータス入力
 * 直接入力についても艦があるのと同様に扱うため、外部で取り扱うときは注意する
 */
class EnemySelectorDialog extends DOMDialog {
	static FORMATION_DEF = [
		{name: "単縦陣", evasion: 1.0},
		{name: "複縦陣", evasion: 1.0},
		{name: "輪形陣", evasion: 1.2},
		{name: "単横陣", evasion: 1.3},
		{name: "梯形陣", evasion: 1.4},
	];
	static DAMAGE_DEF = [
		{name: "撃沈", ratio: 0   , cname: "sunk"},
		{name: "大破", ratio: 0.25, cname: "hdamage"},
		{name: "中破", ratio: 0.5 , cname: "mdamage"},
	];
	
	enemy_status = null;
	current_status = null;
	show_submarine = false;
	show_empty = true;


	/**
	 * @param {EnemyStatus} enemy_status
	 */
	constructor(enemy_status){
		super();
		if (!enemy_status) debugger;
		this.enemy_status = enemy_status;
	}

	create(){
		super.create("modal", "深海棲艦の選択", true);

		this.e_inside.classList.add("enemy_selector");
		this.e_contents.classList.add("column");

		NODE(this.e_contents, [
			// toolbar
			EL("div.row", [
				EL("div.search_bar", [
					this.e_query   = ELEMENT("input", {size: 20, placeholder: "検索"}),
					this.e_clear_x = EL("div.mark_x", [ELEMENT("div"), ELEMENT("div")]),
					EL("label.normal", [
						this.e_normal = ELEMENT("input", {type: "checkbox", checked: true}),
						TEXT("通常"),
					]),
					EL("label.boss", [
						this.e_boss = ELEMENT("input", {type: "checkbox"}),
						TEXT("ボス"),
					]),
				]),
			]),
			
			EL("div.row", [
				// list
				this.e_list = EL("div.list.column", [
					this.e_list_header = EL("div.listheader.row", [
						EL("div.id", [TEXT("ID")]),
						EL("div.name", [TEXT("")]),
						EL("div.HP", [TEXT("HP")]),
						EL("div.armor", [TEXT("装甲")]),
						EL("div.evasion", [TEXT("回避")]),
						EL("div.luck", [TEXT("運")]),
						EL("div.basic_evasion", {textContent: "基本回避", title: "素回避 + 装備回避 + sqrt(2 * 運)"}),
						EL("div.evasion_part", {textContent: "回避項", title: "回避項 (陣形補正1.0)"}),
					]),
				]),
				// current
				this.e_current = EL("div.current.column", [
					EL("div.nameline.row", [
						this.e_id = EL("div.id", [TEXT("")]),
						this.e_name = EL("div.name", [TEXT("")]),
						ELEMENT("div.grow"),
						this.e_shiptype = EL("div.shiptype", [TEXT("")]),
					]),
					EL("div.statusline.row", [
						this.e_lv = EL("div.lv", [TEXT("")]),
						this.e_firepower = EL("div.firepower", [TEXT("")]),
						this.e_torpedo = EL("div.torpedo", [TEXT("")]),
						this.e_antiair = EL("div.antiair", [TEXT("")]),
						EL("div.text", [TEXT("[装備込]")]),
					]),
					EL("div.row", [
						EL("div.caption", [TEXT("HP")]),
						this.e_hp = EL("div.defparam", [TEXT("")]),
						this.e_hp_input = ELEMENT("input", {type: "number", min: 1, max: 9999}),
					]),
					EL("div.row", [
						EL("div.caption", [TEXT("装甲")]),
						this.e_armor = EL("div.defparam", [TEXT("")]),
						this.e_armor_input = ELEMENT("input", {type: "number", min: 1, max: 999}),
					]),
					EL("div.row", [
						EL("div.caption", [TEXT("回避")]),
						this.e_evasion = EL("div.defparam", [TEXT("")]),
						this.e_evasion_input = ELEMENT("input", {type: "number", min: 0, max: 999}),
					]),
					EL("div.row", [
						EL("div.caption", [TEXT("運")]),
						this.e_luck = EL("div.defparam", [TEXT("")]),
						this.e_luck_input = ELEMENT("input", {type: "number", min: 0, max: 999}),
					]),
					EL("div.row", [
						EL("div.caption", [TEXT("基本回避")]),
						this.e_basic_evasion = EL("div.basic_evasion", [TEXT("")]),
						EL("div.bevtext", [TEXT("= 素回避+装備回避+sqrt(2*運)")]),
					]),
					this.e_evasionpart_row = ELEMENT("div.evasionpart.row"),
					this.e_damageborder_row = EL("div.damageborder.row", []),

					EL("div.row", [
						this.e_ok = EL("button.ok", [TEXT("OK")]),
						this.e_apply = EL("button.apply", [TEXT("適用")]),
						EL("div.grow"),
						this.e_cancel = EL("button.cancel", [TEXT("キャンセル")]),
					]),
					EL("div.comment.row", [
						BRTEXT(
							"右側の欄に入力すると、サイトに登録されている値を上書きして計算します。装備込みの値を入力してください。\n" +
							"データが足りない場合、計算できません。"
						),
					]),
				]),
			]),
		]);

		this.e_evasion_parts = [];
		this.e_evasionpart_row.appendChild(
			EL("div.column", [
				EL("div", [TEXT("敵陣形")]),
				EL("div", [TEXT("陣形補正")]),
				EL("div", [TEXT("回避項")]),
			]),
		);
		let def = EnemySelectorDialog.FORMATION_DEF;
		for (let i=0; i<def.length; i++) {
			this.e_evasionpart_row.appendChild(
				EL("div.column", [
					EL("div", [TEXT(def[i].name)]),
					EL("div", [TEXT(Util.float_to_string(def[i].evasion, 1))]),
					this.e_evasion_parts[i] = EL("div", [TEXT("?")]),
				]),
			);
		}

		this.e_damageborders = [];
		this.e_damageborder_row.appendChild(
			EL("div.header.column", [
				BRTEXT("確定に必要な攻撃力\n(キャップ後)"),
			]),
		);
		let dmgdef = EnemySelectorDialog.DAMAGE_DEF;
		for (let i=0; i<dmgdef.length; i++) {
			this.e_damageborder_row.appendChild(
				EL("div.column", [
					NODE(ELEMENT("div." + dmgdef[i].cname), [TEXT(dmgdef[i].name)]),
					this.e_damageborders[i] = EL("div", [TEXT("?")]),
				]),
			);
		}

		// events
		this.e_query.addEventListener("input", Util.delayed_caller(() => this.refreshList(), 200));
		this.e_query.addEventListener("keydown", e => this.ev_keydown_query(e));
		this.e_clear_x.addEventListener("click", () => this.clearSearchText());
		this.e_normal.addEventListener("change", () => {
			if (!this.e_normal.checked && !this.e_boss.checked) this.e_boss.checked = true;
			this.refreshList();
		});
		this.e_boss.addEventListener("change", () => {
			if (!this.e_normal.checked && !this.e_boss.checked) this.e_normal.checked = true;
			this.refreshList();
		});
		this.e_list.addEventListener("scroll", () => this.refreshListHeader());
		let inputs = [this.e_hp_input, this.e_armor_input, this.e_evasion_input, this.e_luck_input];
		for (let e of inputs) {
			e.addEventListener("input", () => this.refreshCurrent(true));
		}
		this.e_ok.addEventListener("click", () => {
			this.applyUserInput();
			this.hide("ok");
		});
		this.e_apply.addEventListener("click", () => this.applyUserInput());
		this.e_cancel.addEventListener("click", () => this.hide("cancel"));

		this.createList();
		this.setCurrentId(EnemyStatus.ID_EMPTY);

		this.addEventListener("show", () => this.move_to_center());

		return this;
	}

	clearSearchText(){
		if (this.e_query.value != "") {
			this.e_query.value = "";
			this.refreshList();
		}
	}

	createList(){
		Util.remove_children(this.e_list);

		this.e_list.appendChild(this.e_list_header);
		this.e_list_array = [];
		this.e_list_map = {};

		let createItems = () => ({
			id: ELEMENT("div.id"),
			name: ELEMENT("div.name"),
			HP: ELEMENT("div.HP"),
			armor: ELEMENT("div.armor"),
			evasion: ELEMENT("div.evasion"),
			luck: ELEMENT("div.luck"),
			basic_evasion: ELEMENT("div.basic_evasion"),
			evasion_part: ELEMENT("div.evasion_part"),
		});
		let toLi = (items, click_arg) => {
			let e = EL("div.listitem.row", [
				items.id,
				items.name,
				items.HP,
				items.armor,
				items.evasion,
				items.luck,
				items.basic_evasion,
				items.evasion_part,
			]);
			e.addEventListener("click", () => this.setCurrentId(click_arg));
			e.addEventListener("dblclick", () => {
				this.applyUserInput();
				this.hide("ok");
			});
			return e;
		};
		let toData = (id, csv) => {
			let items = createItems();
			let key = "";
			if (csv) {
				let key_array = [csv.id, csv.name];
				if (csv.kana) key_array = key_array.concat(csv.kana.split("|"));
				key = RomajiSearch.arrayToKey(key_array);
			}
			
			return {
				id: id,
				li: toLi(items, id),
				csv: csv,
				key: key,
				items: items,
			};
		};

		let empty_data = toData(EnemyStatus.ID_EMPTY, null);
		this.e_list_array.push(empty_data);
		this.e_list_map[empty_data.id] = empty_data;
		this.refreshListItem(empty_data.id, true);

		let direct_data = toData(EnemyStatus.ID_DIRECTINPUT, null);
		this.e_list_array.push(direct_data);
		this.e_list_map[direct_data.id] = direct_data;
		this.refreshListItem(direct_data.id, true);

		for (let en of EquipmentDatabase.csv_enemies) {
			let data = toData(en.id, en);
			this.e_list_array.push(data);
			this.e_list_map[en.id] = data;
			this.refreshListItem(en.id, true);
		}

		this.refreshList();
	}
	refreshListHeader(){
		this.e_list_header.style.top = this.e_list.scrollTop + "px";
	}
	/**
	 * 検索等で表示を制限
	 */
	refreshList(){
		let scr = this.e_list.scrollTop;
		Util.remove_children(this.e_list);
		this.e_list.appendChild(this.e_list_header);

		let search_regs = RomajiSearch.toSearchRegArray(this.e_query.value);
		let search_mode = search_regs.length > 0;
		let normal = this.e_normal.checked;
		let boss = this.e_boss.checked;

		for (let i=0; i<this.e_list_array.length; i++) {
			let x = this.e_list_array[i];
			if (x.id == EnemyStatus.ID_EMPTY) {
				// empty
				if (this.show_empty) {
					this.e_list.appendChild(x.li);
				}

			} else if (x.id == EnemyStatus.ID_DIRECTINPUT) {
				// 直接入力
				this.e_list.appendChild(x.li);

			} else if (x.csv) {
				if (search_mode) {
					if (!search_regs.every(reg => reg.exec(x.key))) continue;
				}
				// 潜水艦は通常非表示
				if (!this.show_submarine && x.csv.shipType == "潜水艦") continue;

				let bossflag = Boolean(+x.csv.boss);
				if ((normal && !bossflag) || (boss && bossflag)) {
					this.e_list.appendChild(x.li);
				}
			}
		}

		this.e_list.scrollTop = scr;
		this.refreshListHeader();
	}
	refreshListItem(id, refresh_idname){
		let items = this.e_list_map[id]?.items;
		let st = this.enemy_status.getStatus(id);
		if (!items) return;

		const bk = str => "(" + str + ")";
		const set = (e, csv, arg_user) => {
			let user = csv != arg_user ? arg_user : "";
			e.textContent = user ? bk(user) : csv;
			e.classList.toggle("bk", user != "");
			e.classList.toggle("ow", user != "" && csv != "");
			return user != "";
		};
		
		if (refresh_idname) {
			if (id == EnemyStatus.ID_EMPTY) {
				items.id.textContent = "";
				items.name.textContent = "(empty)";
			} else if (id == EnemyStatus.ID_DIRECTINPUT) {
				items.id.textContent = "";
				items.name.textContent = "[直接入力]";
			} else {
				items.id.textContent = st.id;

				let m = /^(.+)(elite|flagship)$/.exec(st.csv.name);
				items.name.textContent = m ? m[1] : st.csv.name;
				if (m) {
					NODE(items.name, [
						NODE(ELEMENT("span." + m[2]), [TEXT(m[2])]),
					]);
				}
			}
		}

		set(items.HP, st.csv.HP, st.user.HP);
		set(items.armor, st.csv.armor, st.user.armor);
		let a1 = set(items.evasion, st.csv.evasion, st.user.evasion);
		let a2 = set(items.luck, st.csv.luck, st.user.luck);

		// 素回避値 + 装備回避値 + √(2 * 運)
		let basic_ev = -1;
		if (st.evasion >= 0 && st.luck >= 0) {
			basic_ev = st.evasion + Math.sqrt(2 * st.luck);
		}
		let bevstr = basic_ev >= 0 ? Util.float_to_string(basic_ev, 1, -1) : "";
		let c_bk = (a1 || a2) && bevstr != "";
		let c_ow = c_bk && st.csv.evasion != "" && st.csv.luck != "";
		if (c_bk) bevstr = bk(bevstr);
		items.basic_evasion.textContent = bevstr;
		items.basic_evasion.classList.toggle("bk", c_bk);
		items.basic_evasion.classList.toggle("ow", c_ow);
		// 回避項 (陣形補正1.0)
		let evpstr = basic_ev >= 0 ? Util.float_to_string(Damage.evadecap(basic_ev), 0, -1) : "";
		if (c_bk) evpstr = bk(evpstr);
		items.evasion_part.textContent = evpstr;
		items.evasion_part.classList.toggle("bk", c_bk);
		items.evasion_part.classList.toggle("ow", c_ow);
	}
	/**
	 * 直接入力を外部で変更した場合などに表示を更新する
	 */
	refreshDirectInputItem(){
		this.refreshListItem(EnemyStatus.ID_DIRECTINPUT, false);
	}

	/**
	 * 選択中の敵艦ID
	 * @returns {string}
	 */
	getCurrentId(){
		return this.current_status?.id ?? EnemyStatus.ID_EMPTY;
	}

	/**
	 * currentを設定
	 * @param {string} id 
	 */
	setCurrentId(id){
		let st = this.enemy_status.getStatus(id);

		if (st.csv_exists) {
			this.e_id.textContent = "ID:" + id;
		} else {
			this.e_id.textContent = "";
		}

		if (id == EnemyStatus.ID_EMPTY) {
			this.e_name.textContent = "(empty)";
		} else if (id == EnemyStatus.ID_DIRECTINPUT) {
			this.e_name.textContent = "[直接入力]";
		} else {
			let m = /^(.+)(elite|flagship)$/.exec(st.csv.name);
			this.e_name.textContent = m ? m[1] : st.csv.name;
			if (m) {
				NODE(this.e_name, [
					NODE(ELEMENT("span." + m[2]), [TEXT(m[2])]),
				]);
			}
		}
		this.e_shiptype.textContent = st.csv.shipType;

		let q = id == EnemyStatus.ID_EMPTY ? "-" : "?";

		this.e_lv.textContent = "Lv" + (st.csv.lv || q);
		this.e_firepower.textContent = "火力" + (st.csv.firepower || q);
		this.e_torpedo.textContent = "雷装" + (st.csv.torpedo || q);
		this.e_antiair.textContent = "対空" + (st.csv.antiair || q);

		this.e_hp_input.value = st.user.HP;
		this.e_armor_input.value = st.user.armor;
		this.e_evasion_input.value = st.user.evasion;
		this.e_luck_input.value = st.user.luck;

		let inputs = [this.e_hp_input, this.e_armor_input, this.e_evasion_input, this.e_luck_input];
		if (id == EnemyStatus.ID_EMPTY) {
			// emptyの場合は入力欄を使用不能にする
			inputs.forEach(input => input.disabled = true);
		} else {
			inputs.forEach(input => input.disabled = false);
		}

		if (this.current_status) {
			let old_id = this.current_status.id;
			let old_data = this.e_list_map[old_id];
			if (old_data) {
				old_data.li.classList.remove("selected");
			}
		}
		
		this.current_status = st;

		let data = this.e_list_map[id];
		if (data) {
			data.li.classList.add("selected");
		}

		this.refreshCurrent(false);
	}

	refreshCurrent(load_input){
		let st = this.current_status;
		if (load_input) {
			st.user.HP = this.e_hp_input.value;
			st.user.armor = this.e_armor_input.value;
			st.user.evasion = this.e_evasion_input.value;
			st.user.luck = this.e_luck_input.value;
		}
		
		let q = st.id == EnemyStatus.ID_EMPTY ? "-" : "?";
		const set_param = (e, csv, user) => {
			e.textContent = csv || q;
			e.classList.toggle("question", !csv);
			e.classList.toggle("user", !!user);
		};
		set_param(this.e_hp, st.csv.HP, st.user.HP);
		set_param(this.e_armor, st.csv.armor, st.user.armor);
		set_param(this.e_evasion, st.csv.evasion, st.user.evasion);
		set_param(this.e_luck, st.csv.luck, st.user.luck);

		let basic_ev = -1;
		if (st.evasion >= 0 && st.luck >= 0) {
			basic_ev = st.evasion + Math.sqrt(2 * st.luck);
		}

		this.e_basic_evasion.textContent = basic_ev >= 0 ? Util.float_to_string(basic_ev, 1, -1) : q;
		this.e_basic_evasion.classList.toggle("question", basic_ev < 0);

		let fdef = EnemySelectorDialog.FORMATION_DEF;
		for (let i=0; i<fdef.length; i++) {
			let ev = basic_ev >= 0 ? Damage.evadecap(fdef[i].evasion * basic_ev) : q;
			this.e_evasion_parts[i].textContent = ev;
			this.e_evasion_parts[i].classList.toggle("question", ev == q);
		}

		// HP, armorが必要
		let hp = st.HP, armor = st.armor;
		let max_r = Math.floor(armor) - 1;
		let max_def = armor * 0.7 + max_r * 0.6; // 最も大きい防御力
		/*
		 * dmg = [power - def] >= x
		 * power - def >= ceil(x)
		 * power >= ceil(x) + def
		 */
		let ddef = EnemySelectorDialog.DAMAGE_DEF;
		for (let i=0; i<ddef.length; i++) {
			let str = q;
			if (hp >= 1 && armor >= 1) {
				let hp_border = Math.floor(hp * ddef[i].ratio);
				let require_damage = hp - hp_border;
				let require_power = Math.ceil(require_damage + max_def);
				str = require_power;
			}
			this.e_damageborders[i].textContent = str;
			this.e_damageborders[i].classList.toggle("question", str == q)
		}
	}

	applyUserInput(){
		if (!this.current_status || this.current_status.id == EnemyStatus.ID_EMPTY) return;
		this.enemy_status.setUserStatus(this.current_status);
		this.refreshListItem(this.current_status.id, false);
	}

	ev_keydown_query(e){
		if (e.key == "Escape") {
			e.preventDefault();
			this.clearSearchText();
		}
	}
};


/**
 * 敵艦のステータス
 * id, name, shipType, lv, firepower, torpedo, antiair,
 * HP, armor, evasion, luck
 */
class EnemyStatusData {
	id;
	csv;
	csv_exists;
	user;
	default_value = -1;

	static csv_empty_line = {
		id: 0,
		name: "", shipType: "", lv: "", firepower: "", torpedo: "", antiair: "",
		HP: "", armor: "", evasion: "", luck: ""
	};

	// ユーザー定義値を優先
	// どちらにもデータがない場合は負数を返すとする
	get HP(){
		return this.toNumber(this.csv.HP, this.user.HP);
	}
	get armor(){
		return this.toNumber(this.csv.armor, this.user.armor);
	}
	get evasion(){
		return this.toNumber(this.csv.evasion, this.user.evasion);
	}
	get luck(){
		return this.toNumber(this.csv.luck, this.user.luck);
	}
	// setterはユーザー定義値の設定となる
	// ただし無効な値は空とみなす
	set HP(v){
		this.user.HP = +v >= 1 ? v : "";
	}
	set armor(v){
		this.user.armor = +v >= 1 ? v : "";
	}
	set evasion(v){
		this.user.evasion = +v >= 0 ? v : "";
	}
	set luck(v){
		this.user.luck = +v >= 0 ? v : "";
	}

	constructor(id, user_data = null){
		let en = EquipmentDatabase.csv_enemies.find(en => en.id == id);
		this.id = id;
		this.csv = en || EnemyStatusData.csv_empty_line;
		this.csv_exists = en != null;
		this.setUserdata(user_data);
	}

	toNumber(csv_value, user_value){
		let str = user_value || csv_value;
		let v = str === "" ? this.default_value : +str;
		return isFinite(v) ? v : this.default_value;
	}
	getUserdata(){
		let user = this.user;
		let data = {id: this.id};
		if (user.HP) data.HP = user.HP;
		if (user.armor) data.armor = user.armor;
		if (user.evasion) data.evasion = user.evasion;
		if (user.luck) data.luck = user.luck;
		return data;
	}
	setUserdata(data){
		this.user = {};
		this.HP = data?.HP || "";
		this.armor = data?.armor || "";
		this.evasion = data?.evasion || "";
		this.luck = data?.luck || "";
	}

	static createDirectInput(HP, armor, evasion, luck){
		return new EnemyStatusData(EnemyStatus.ID_DIRECTINPUT, {
			HP: HP, armor: armor, evasion: evasion, luck: luck
		});
	}
};


/**
 * 敵艦のデータを管理
 */
class EnemyStatus {
	/**
	 * @type {string}
	 * @static
	 */
	static ID_EMPTY = "0";
	/**
	 * @type {string}
	 * @static
	 */
	static ID_DIRECTINPUT = "-1";
	
	user_data = [];

	/**
	 * 敵艦IDからステータスを取得
	 * @param {string} id enemy id
	 * @returns {EnemyStatusData}
	 */
	getStatus(id){
		let ud = this.user_data.find(d => d.id == id);
		return new EnemyStatusData(id, ud);
	}
	/**
	 * 敵艦のユーザーデータを保存
	 * @param {EnemyStatusData} data 
	 */
	setUserStatus(data){
		let ud = data.getUserdata();

		if (ud.id == EnemyStatus.ID_EMPTY) return;
		
		let index = this.user_data.findIndex(d => d.id == ud.id);
		if (index >= 0) {
			this.user_data[index] = ud;
		} else {
			this.user_data.push(ud);
		}
	}

	/**
	 * 直接入力値の保存
	 * @returns {*} JSON
	 */
	getDirectInputJson(){
		let st = this.getStatus(EnemyStatus.ID_DIRECTINPUT);
		return st.getUserdata();
	}
	/**
	 * @param {*} json JSON
	 */
	setDirectInputJson(json){
		let st = this.getStatus(EnemyStatus.ID_DIRECTINPUT);
		st.setUserdata(json);
		this.setUserStatus(st);
	}
	/**
	 * 入力データのJSON
	 * 直接入力は保存されない
	 * @returns {*} JSON
	 */
	getJson(){
		return this.user_data.filter(d => d.id != EnemyStatus.ID_DIRECTINPUT && (d.HP || d.armor || d.evasion || d.luck));
	}
	/**
	 * JSONのデータを設定
	 * @param {*} json JSON
	 */
	setJson(json){
		if (json) {
			if (json instanceof Array) {
				this.user_data = json;
			} else {
				debugger;
				this.user_data = [];
			}
		} else {
			this.user_data = [];
		}
	}
};

