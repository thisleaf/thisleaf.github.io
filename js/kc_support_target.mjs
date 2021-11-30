/* 目標設定 */

import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {NODE, ELEMENT, EL, TEXT, _T, BRTEXT, _BT} from "./utility.mjs";
import {DOMDialog} from "./dom_dialog.mjs";
import {RomajiSearch} from "./romaji_search.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import * as Damage from "./kc_damage_utility.mjs";
import {
	EnemyStatus,
	EnemyStatusData,
	EnemySelectorDialog,
} from "./kc_enemy_status.mjs";
import { SupportShipData } from "./kc_support_ship_data.mjs";
import { AttackScoreCalc } from "./kc_attack_score.mjs";

export {
	SearchTargetDialog,
};


class SearchTargetRow {
	static enemy_selector_dialog;

	// 強調表示されているか
	highlighted = false;

	constructor(number){
		Util.attach_event_target(this);

		this.e_row = EL("div.shiprow.row", [
			EL("div.number", [_T(number)]),
			this.e_name = EL("div.name"),
			EL("div.priority", [
				this.e_priority = EL("select")
			]),
			EL("div.modgroup.column", [
				EL("div.mods.row", [
					EL("div.kira", [
						this.e_kira = EL("input", {type: "checkbox"})
					]),
					EL("div.selffm", [
						this.e_selffm = EL("select")
					]),
					EL("div.enemyfm", [
						this.e_enemyfm = EL("select")
					]),
					EL("div.engagement", [
						this.e_engagement = EL("select")
					]),
				]),
				this.e_modinfo = EL("div.modinfo.guide.row"),
			]),
			EL("div.targetselect", [
				this.e_targetselect = EL("select", [
					new Option("キャップ前", Global.TARGETING_PRECAP),
					new Option("キャップ後", Global.TARGETING_POSTCAP),
					new Option("仮想敵", Global.TARGETING_VENEMY),
				])
			]),
			EL("div.target", [
				this.e_border_power_div = EL("div.border_power", [
					_T("攻撃力"),
					this.e_border_power = EL("input.firepower", {type: "number", min:0, max: 300}),
					_T("以上の命中"),
					EL("br"),
					this.e_border_power_hint = EL("span"),
				]),
				this.e_venemy_div = EL("div.venemy.hidden", [
					this.e_venemy_name = EL("div.venemyname"),
					_T("ダメージ"),
					this.e_venemy_damage = EL("input.damage", {type: "number", min: 0, max: 9999}),
					_T("以上の確率"),
					this.e_venemy_damage_lv4 = EL("span.damage_lv4"),
					this.e_venemy_damage_lv3 = EL("span.damage_lv3"),
					this.e_venemy_damage_lv2 = EL("span.damage_lv2"),
				])
			]),
		]);

		for (let i=1; i<=12; i++) {
			let name = i == 1 ? i + " (高)" : i == 12 ? i + " (低)" : i;
			this.e_priority.appendChild(new Option(name, i))
		}
		for (let d of Global.FORMATION_DEFINITION_EX) {
			if (d.atk) {
				let op = new Option(d.name, d.id);
				op.className = d.className;
				this.e_selffm.appendChild(op);
			}
			if (d.def) {
				let op = new Option(d.name, d.id);
				op.className = d.className;
				this.e_enemyfm.appendChild(op);
			}
		}
		for (let d of Global.ENGAGEMENT_FORM_DEFINITION) {
			let op = new Option(d.name, d.id);
			op.className = d.className;
			this.e_engagement.appendChild(op);
		}
		this.e_targetselect.value = Global.TARGETING_POSTCAP;

		// event
		let forms_on_change = [
			this.e_kira,
			this.e_priority,
			this.e_selffm,
			this.e_enemyfm,
			this.e_engagement,
			this.e_targetselect,
		];
		let forms_on_input = [
			this.e_border_power,
			this.e_venemy_damage,
		];
		let refresh = () => {
			if (this.ssd) {
				this.formToSsd();
				this.refreshInfo();
			}
		};

		for (let form of forms_on_change) form.addEventListener("change", refresh);
		for (let form of forms_on_input) form.addEventListener("input", refresh);

		this.e_venemy_name.addEventListener("click", () => this.ev_click_venemyname());

		this.e_venemy_damage_lv4.addEventListener("click", () => this.ev_click_damage_lv(4));
		this.e_venemy_damage_lv3.addEventListener("click", () => this.ev_click_damage_lv(3));
		this.e_venemy_damage_lv2.addEventListener("click", () => this.ev_click_damage_lv(2));
	}

	/**
	 * 情報の表示を更新　情報はssdから得る
	 */
	refreshInfo(){
		// クラスの引き継ぎ (option -> select)
		let sels = [
			this.e_priority,
			this.e_selffm,
			this.e_enemyfm,
			this.e_engagement,
			this.e_targetselect,
		];
		for (let s of sels) Util.inherit_option_class(s);

		// 火力、命中、回避の補正
		let asc = this.ssd.attack_score;
		this.e_modinfo.textContent =
			"火力" + Util.float_to_string(asc.power_modify, 2)
			+ " 命中" + Util.float_to_string(asc.accuracy_modify, 2)
			+ " 回避" + Util.float_to_string(asc.evasion_modify, 2);

		let mode = this.ssd.targeting_mode;
		let venemy = mode == Global.TARGETING_VENEMY;
		this.e_border_power_div.classList.toggle("hidden", venemy);
		this.e_venemy_div.classList.toggle("hidden", !venemy);

		if (venemy) {
			// 仮想敵モード
			let name = "";
			let st = null;

			if (this.ssd.target_id == EnemyStatus.ID_EMPTY) {
				name = "[選択してください]";
			} else if (this.ssd.target_id == EnemyStatus.ID_DIRECTINPUT) {
				name = "直接入力";
				st = EnemyStatusData.createDirectInput(this.ssd.target_hp, this.ssd.target_armor, this.ssd.target_evasion, this.ssd.target_luck);
			} else {
				name = this.ssd.target_id + ": ";
				st = EquipmentDatabase.enemy_status.getStatus(this.ssd.target_id);
				name += st.csv_exists ? st.csv.name : "?";
			}
			if (st) {
				st.default_value = "??";
				name += " (HP" + st.HP + "/装甲" + st.armor + "/回避" + st.evasion + "/運" + st.luck + ")";
			}

			this.e_venemy_name.textContent = name;
			
			let hp_exists = st && st.HP >= 1;
			let borders = hp_exists ? this.ssd.attack_score.getNeedBorders() : null;
			let damage_names = ["撃沈", "大破", "中破"];
			let spans = [this.e_venemy_damage_lv4, this.e_venemy_damage_lv3, this.e_venemy_damage_lv2];

			for (let i=0; i<spans.length; i++) {
				spans[i].textContent = damage_names[i] + (borders?.[i] || "");
				spans[i].classList.toggle("hidden", !hp_exists);
			}

		} else {
			// 火力目標モード
			let border = +this.e_border_power.value;
			let fm = this.ssd.attack_score.formation_power;
			let en = this.ssd.attack_score.engagement_power;
			let bp = mode == Global.TARGETING_POSTCAP ?
				SupportShipData.postcap_to_base(en, fm, border) :
				SupportShipData.precap_to_base(en, fm, border);
			let dp = bp - (5 + Global.SUPPORT_MODIFY);
			
			Util.remove_children(this.e_border_power_hint);
			if (bp > 0) {
				NODE(this.e_border_power_hint, [
					_T("基本攻撃力"),
					EL("span.basic_power", [_T(bp)]),
				]);
				if (!this.ssd.empty() && !this.ssd.cv_shelling && dp > 0) {
					NODE(this.e_border_power_hint, [
						_T(" (表示火力"),
						EL("span.display_power", [_T(dp)]),
						_T(")"),
					]);
				}
			} else {
				NODE(this.e_border_power_hint, [_T("火力条件なし")]);
			}
		}
	}

	/**
	 * 関係するssdを設定
	 * ここで設定されたssdはこのクラスで利用され、フォームの変更に同期する
	 * @param {SupportShipData} ssd
	 */
	setData(ssd){
		this.ssd = ssd;
		this.ssdToForm();
	}
	getData(){
		return this.ssd;
	}

	/**
	 * 関連するDOMのフォームがあるデータのやり取り
	 */
	ssdToForm(){
		let ssd = this.ssd;
		let setsel = (select, value, def_value) => {
			select.value = value;
			if (select.selectedIndex < 0) select.value = def_value;
		};
		let name = ssd.get_name();
		this.e_name.textContent = name || "(empty)";
		this.e_name.classList.toggle("empty", name == "");
		this.e_kira.checked = ssd.condition_good;
		setsel(this.e_priority, ssd.priority, 1);
		setsel(this.e_selffm, ssd.self_formation, 1);
		setsel(this.e_enemyfm, ssd.enemy_formation, 1);
		setsel(this.e_engagement, ssd.engagementform, 1);
		setsel(this.e_targetselect, ssd.targeting_mode, Global.TARGETING_POSTCAP);
		this.e_border_power.value = ssd.border_power;
		this.e_venemy_damage.value = ssd.need_damage;

		this.refreshInfo();
	}

	formToSsd(){
		this.ssd.condition_good = this.e_kira.checked;
		this.ssd.priority = +this.e_priority.value;
		this.ssd.self_formation = +this.e_selffm.value;
		this.ssd.enemy_formation = +this.e_enemyfm.value;
		this.ssd.engagementform = +this.e_engagement.value;
		this.ssd.targeting_mode = +this.e_targetselect.value;
		this.ssd.border_power = +this.e_border_power.value;
		this.ssd.need_damage = +this.e_venemy_damage.value;
		this.ssd.set_cachevars();
	}

	highlight(){
		this.e_row.classList.add("highlight");
		this.highlighted = true;
	}
	removeHighlight(){
		this.e_row.classList.remove("highlight");
		this.highlighted = false;
	}

	ev_click_venemyname(){
		let es = EquipmentDatabase.enemy_status;
		let dialog = SearchTargetRow.getEnemySelectorDialog();

		// 直接入力のデータ
		let st = es.getStatus(EnemyStatus.ID_DIRECTINPUT);
		st.HP = this.ssd.target_hp;
		st.armor = this.ssd.target_armor;
		st.evasion = this.ssd.target_evasion;
		st.luck = this.ssd.target_luck;
		es.setUserStatus(st);
		dialog.refreshDirectInputItem();
		// 現在選択中の敵艦
		dialog.setCurrentId(this.ssd.target_id);

		dialog.show().then(result => {
			if (result == "ok") {
				let old_id = this.ssd.target_id;
				this.ssd.target_id = dialog.getCurrentId();
				// 直接入力なので未入力は-1になる
				let st = es.getStatus(EnemyStatus.ID_DIRECTINPUT);
				this.ssd.target_hp = st.HP;
				this.ssd.target_armor = st.armor;
				this.ssd.target_evasion = st.evasion;
				this.ssd.target_luck = st.luck;
				if (this.ssd.target_id != old_id) {
					// 敵艦が変更された場合、need_damageを撃沈に
					let en = es.getStatus(this.ssd.target_id);
					if (en.HP >= 1) {
						this.e_venemy_damage.value = this.ssd.need_damage = en.HP;
					}
				}
				this.ssd.set_cachevars();
			}
			// ダイアログでOKが押されなくても、ステータスが変更されているかもしれない
			// したがって enddialog イベントを発行する
			this.refreshInfo();
			this.dispatchEvent(new CustomEvent("enddialog", {detail: {src: this}}));
		});
	}

	ev_click_damage_lv(lv){
		if (this.ssd.targeting_mode != Global.TARGETING_VENEMY) return;

		let hp;
		if (this.ssd.target_id == EnemyStatus.ID_EMPTY) {
			hp = 0;
		} else if (this.ssd.target_id == EnemyStatus.ID_DIRECTINPUT) {
			hp = this.ssd.target_hp;
		} else {
			let st = EquipmentDatabase.enemy_status.getStatus(this.ssd.target_id);
			hp = st.HP;
		}

		let borders = SearchTargetRow.getNeedBorders(hp);
		if (borders[4 - lv] >= 0) {
			this.e_venemy_damage.value = borders[4 - lv];
			this.formToSsd();
		}
	}


	/**
	 * 撃沈、大破、中破、小破に必要なダメージ
	 * @param {number} hp
	 * @returns {number[]}
	 */
	static getNeedBorders(hp){
		if (hp >= 1) {
			return [
				hp,
				Math.ceil(hp * 0.75),
				Math.ceil(hp * 0.5),
				Math.ceil(hp * 0.25),
				0,
			];
		} else {
			return new Array(5).fill(-1);
		}
	}
	/**
	 * ヘッダーの作成
	 * @param {string} letter 
	 * @returns {HTMLDivElement}
	 */
	static createHeader(fleet_name, letter){
		return EL("div.header.row.header_" + letter, [
			EL("div.numname", [_T(fleet_name)]),
			EL("div.priority", [_T("優先度")]),
			EL("div.modgroup.column", [
				EL("div.mods.row", [
					EL("div.kira", [_T("キラ")]),
					EL("div.selffm", [_T("自陣形")]),
					EL("div.enemyfm", [_T("敵陣形")]),
					EL("div.engagement", [_T("交戦形態")]),
				]),
				EL("div.modinfo.row"),
			]),
			EL("div.targetselect", [_T("モード")]),
			EL("div.target", [_T("最大化目標")]),
		]);
	}
	/**
	 * 敵選択で使用するダイアログ
	 * @returns {EnemySelectorDialog}
	 */
	static getEnemySelectorDialog(){
		if (!this.enemy_selector_dialog) {
			let es = EquipmentDatabase.enemy_status;
			let dialog = new EnemySelectorDialog(es);
			// dialog.show_empty = false;
			dialog.create();
			this.enemy_selector_dialog = dialog;
		}
		return this.enemy_selector_dialog;
	}
};


/**
 * 探索目標の設定ダイアログ
 */
class SearchTargetDialog extends DOMDialog {
	/** @type {SupportFleet[]} */
	fleets;
	/** @type {SearchTargetRow[][]} */
	rows_array;
	/** @type {HTMLDivElement} */
	e_table;

	constructor(){
		super();
	}

	create(){
		super.create("modal", "探索目標の設定", true);
		this.e_inside.classList.add("search_target");

		NODE(this.e_contents, [
			// 設定テーブル
			this.e_table = EL("div.targettable"),
			// 注意書き
			EL("div.comment", [
				_BT("* 仮想敵モードはβ版です。命中回避の検証は難しいので参考程度にお願いします。(特に警戒陣は未実装です)"),
			]),
			// OK/cancel
			EL("div.toolbar", [
				this.e_ok = EL("button.ok", [_T("OK")]),
				this.e_cancel = EL("button.cancel", [_T("キャンセル")]),
			]),
		]);

		this.addEventListener("show", () => this.ev_show());
		this.add_dialog_button(this.e_ok, "ok");
		this.add_dialog_button(this.e_cancel, "cancel");
		this.e_contents.addEventListener("mousedown", () => this.removeHighlight());
		return this;
	}

	/**
	 * @param {SupportFleet[]} fleets 
	 */
	setFleets(fleets){
		this.fleets = fleets;

		let divs = [];
		let rows_array = [];
		for (let fl of fleets) {
			let rows = fl.support_ships.map((ss, i) => {
				// データはあとで
				let target_row = new SearchTargetRow(i + 1);
				target_row.addEventListener("enddialog", e => this.ev_enddialog(e));
				return target_row;
			});
			let e_fleet = EL("div.fleet", [
				SearchTargetRow.createHeader(fl.get_fleet_name(), fl.name),
				...rows.map(row => row.e_row),
			]);
			divs.push(e_fleet);
			rows_array.push(rows);
		}
		NODE(Util.remove_children(this.e_table), divs);
		this.rows_array = rows_array;

		this.ships = this.fleets.flatMap(fl => fl.support_ships);
		this.rows = this.rows_array.flat();

		// データをダイアログに設定
		this.fleetsToDialog();
	}

	fleetsToDialog(){
		for (let i=0; i<this.fleets.length; i++) {
			let ships = this.fleets[i].support_ships;
			let rows = this.rows_array[i];
			for (let j=0; j<ships.length; j++) {
				rows[j].setData(ships[j].get_ssd());
			}
		}
	}
	
	dialogToFleets(){
		for (let i=0; i<this.fleets.length; i++) {
			let ships = this.fleets[i].support_ships;
			let rows = this.rows_array[i];
			for (let j=0; j<ships.length; j++) {
				ships[j].set_ssd(rows[j].getData());
			}
		}
	}

	/**
	 * 艦を強調表示
	 * @param {SupportShip} ship 
	 */
	highlightShip(ship){
		let idx = this.ships.findIndex(ss => ss == ship);
		if (idx >= 0) this.rows[idx].highlight();
	}
	/**
	 * 全ての強調表示を削除
	 */
	removeHighlight(){
		for (let row of this.rows) row.removeHighlight();
	}

	/**
	 * 表示直前のイベント
	 */
	ev_show(){
		if (!this.fleets) debugger;
		this.move_to_center();
		// 強調表示
		let hrow = this.rows.find(row => row.highlighted);
		if (hrow) {
			hrow.e_row.closest("div.fleet")?.scrollIntoView({block: "nearest"});
		}
	}
	/**
	 * 敵艦選択ダイアログを閉じたときのイベント
	 * @param e 
	 * @protected
	 */
	ev_enddialog(e){
		for (let row of this.rows) {
			if (row != e.detail.src) row.refreshInfo();
		}
	}
};
