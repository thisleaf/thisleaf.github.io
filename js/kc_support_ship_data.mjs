
import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import {DOM, NODE, ELEMENT, TEXT, BRTEXT, HTML} from "./utility.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import * as Damage from "./kc_damage_utility.mjs";
import {
	EnemyStatus,
	EnemyStatusData,
	EnemySelectorDialog,
} from "./kc_enemy_status.mjs";
import {AttackScoreCalc} from "./kc_attack_score.mjs";

export {
	SupportShipData,
};


// SupportShipData ---------------------------------------------------------------------------------
Object.assign(SupportShipData.prototype, {
	// SupportShip オブジェクト区別用ID
	// ポインターでは別スレッドに転送するときなどで都合が悪い
	ship_object_id: "",

	// 艦名
	ship_name     : "",
	// 艦データ
	ship: null,
	// 優先度
	priority: 0,
	// 交戦形態等の修正 (火力倍率)
	engagementform_modify: 1,
	formation_modify     : 1,
	
	// レベル・運
	// こちらは実際の計算で使用する値とする
	level: 0,
	luck : 0,

	// 目標攻撃力
	border_basic_power: 150, // 基本攻撃力
	// 素火力
	raw_firepower: 0,
	// 基礎命中
	raw_accuracy : 0,
	// 空母系(計算式)かどうか
	cv_shelling  : false,
	
	// スロット数(増設除く)
	slot_count      : 0,
	// 増設が利用可能か
	exslot_available: false,
	
	// 装備ID, 改修, 固定
	// [5]が増設であるとする
	// generate_slots(), save_slots() で計算用のデータとやりとりする
	equipment_ids  : null,
	equipment_stars: null,
	equipment_fixes: null,


	// 計算用にスロットの有効部のみを抽出
	// 増設が有効の場合は、ラストが増設であるものとする
	// 転送不可、転送すると上の変数から再生成
	allslot_equipment : null, // array of EquipmentSlot
	allslot_equipables: null, // array of map: id -> bool
	allslot_fixes     : null, // array of bool
	
	equipable_info : null, // EquipableInfo
	equipment_bonus: null, // EquipmentBonus
	attack_score   : null, // AttackScoreCalc

	// 計算用オプション
	// 他の場所では保存されない
	// 空母系で艦載機がなくても攻撃可能として攻撃力を計算するか
	cv_force_attackable: false,

	
	// 入力値、負数で初期値(入力なし)を表す
	input_level: -1,
	input_luck : -1,
	// キラ
	condition_good: true,
	// 陣形・交戦形態 (ID)
	self_formation: -1,
	enemy_formation: -1,
	engagementform: -1,
	// 探索モード
	targeting_mode: -1,
	// 攻撃力 (キャップ前/キャップ後)
	border_power: Global.SUPPORT_POWER_CAP + 1,
	// 仮想敵ID (EnemyStatus.ID_DIRECTINPUT: 直接入力)
	target_id: EnemyStatus.ID_EMPTY,
	// 仮想敵直接入力用 (-1: 入力なし)
	target_hp: -1,
	target_armor: -1,
	target_evasion: -1,
	target_luck: -1,
	// 必要ダメージ
	need_damage: 0,


	clone              : SupportShipData_clone,
	empty              : SupportShipData_empty,
	get_name           : SupportShipData_get_name,
	set_name           : SupportShipData_set_name,
	set_ship_id        : SupportShipData_set_ship_id,
	set_cachevars      : SupportShipData_set_cachevars,
	generate_slots     : SupportShipData_generate_slots,
	save_slots         : SupportShipData_save_slots,
	is_cv_shelling     : SupportShipData_is_cv_shelling,
	is_dd              : SupportShipData_is_dd,
	get_border_basic_power: SupportShipData_get_border_basic_power,

	clear_bonus        : SupportShipData_clear_bonus      ,
	calc_bonus         : SupportShipData_calc_bonus       ,
	get_display_power  : SupportShipData_get_display_power,
	get_basic_power    : SupportShipData_get_basic_power  ,
	get_final_power    : SupportShipData_get_final_power  ,
	get_bonus_firepower: SupportShipData_get_bonus_firepower,
	get_bonus_torpedo  : SupportShipData_get_bonus_torpedo,
	get_raw_accuracy   : SupportShipData_get_raw_accuracy,
	get_equipment_accuracy: SupportShipData_get_equipment_accuracy,
	get_accuracy       : SupportShipData_get_accuracy     ,
	get_equipment_priority: SupportShipData_get_equipment_priority,
	sort_equipment     : SupportShipData_sort_equipment   ,
	is_upper_equipment : SupportShipData_is_upper_equipment,
	
	// JSONとの変換
	get_json: SupportShipData_get_json,
	set_json: SupportShipData_set_json,

	get_json_deckbuilder: SupportShipData_get_json_deckbuilder,
	get_json_MT: SupportShipData_get_json_MT,
	set_json_MT: SupportShipData_set_json_MT,
	
	eqab_compare        : SupportShipData_eqab_compare,
	has_irregular_exslot: SupportShipData_has_irregular_exslot,
	power_compare       : SupportShipData_power_compare,
	accuracy_compare    : SupportShipData_accuracy_compare,
	priority_compare    : SupportShipData_priority_compare,
});

Object.assign(SupportShipData, {
	// input_level < 0 の時使用するレベル
	default_level: 99,
	// 砲撃支援時、空母系とみなす shipType のリスト
	// ちなみに速吸は空母系ではない
	cv_shelling_types: [
		"軽空母", "正規空母", "装甲空母", // "夜間作戦航空母艦", "近代化航空母艦"
	],
	dd_types: [
		"駆逐艦", // "陽字号駆逐艦"
	],

	// static function
	power_compare   : SupportShipData_static_power_compare,
	accuracy_compare: SupportShipData_accuracy_compare,
	priority_compare: SupportShipData_priority_compare,
	postcap_to_base : SupportShipData__postcap_to_base,
	precap_to_base  : SupportShipData__precap_to_base,
});

/**
 * 支援艦隊の1隻のデータクラス <br>
 * これを使って探索を行う <br>
 * SupportShip <-> SupportShipData[探索] <-> JSON[保存/転送]
 * @constructor
 */
function SupportShipData(name){
	this.equipment_ids   = [];
	this.equipment_stars = [];
	this.equipment_fixes = [];

	if (name !== undefined) this.set_name(name);
}

/**
 * 複製 <br>
 * deeply を指定すると、allslot_equipables と allslot_fixes についても配列の複製を行う
 * (通常は読み取りのみのはず)
 * @param {boolean} deeply 
 * @returns {SupportShipData}
 * @method SupportShipData#clone
 */
function SupportShipData_clone(deeply){
	let ssd = new SupportShipData();
	Object.assign(ssd, this);
	
	// 配列の複製
	ssd.equipment_ids   = this.equipment_ids  .concat();
	ssd.equipment_stars = this.equipment_stars.concat();
	ssd.equipment_fixes = this.equipment_fixes.concat();
	ssd.allslot_equipment = this.allslot_equipment?.map(slot => slot.clone());
	// AttackScoreCalcは共有できない
	ssd.attack_score = this.attack_score?.clone();
	
	if (deeply) {
		// 通常はreadonly
		ssd.allslot_equipables = this.allslot_equipables?.concat();
		ssd.allslot_fixes = this.allslot_fixes?.concat();
		// 他のobjectは set_name() のたびに作り直すので共有可能
	}
	
	return ssd;
}

/**
 * 艦が選択されていない、空であるならば true
 * @returns {boolean}
 * @method SupportShipData#empty
 */
function SupportShipData_empty(){
	return !this.ship_name;
}

/**
 * 艦名
 * @method SupportShipData#get_name
 */
function SupportShipData_get_name(){
	return this.ship_name;
}

/**
 * 艦を設定
 * 連動して各種プロパティが変更される
 * @param {string} name 
 * @method SupportShipData#set_name
 */
function SupportShipData_set_name(name){
	if (name != this.ship_name || !this.equipable_info) {
		this.ship_name = name;
		this.equipable_info = new EquipableInfo(name, true);
		this.equipable_info.generate_equipables();
		this.equipment_bonus = new EquipmentBonus(name, true);
		this.ship = this.equipable_info.ship;
		this.attack_score = new AttackScoreCalc();
	}
	this.set_cachevars();
}

/**
 * IDから艦をセット
 * @param {string} id 
 * @method SupportShipData#set_ship_id
 */
function SupportShipData_set_ship_id(id){
	let ship = EquipmentDatabase.csv_shiplist.find(d => d.shipId == id);
	this.set_name(ship?.name ?? "");
}

/**
 * 計算用変数を計算して設定
 * @method SupportShipData#set_cachevars
 */
function SupportShipData_set_cachevars(){
	this.level = this.input_level >= 0 ? this.input_level : SupportShipData.default_level;
	this.luck = this.input_luck >= 0 ? this.input_luck : +(this.ship?.luckMin ?? 0);

	this.slot_count = this.equipable_info.get_slot_count();
	this.raw_firepower = +(this.ship?.firepowerMax ?? 0);
	this.raw_accuracy = this.get_raw_accuracy();
	this.cv_shelling = this.is_cv_shelling();
	
	// FORMATION_EXCEPTION は火力にはない
	let sfm = Global.FORMATION_DEFINITION_EX.find(x => x.id == this.self_formation);
	let efm = Global.FORMATION_DEFINITION_EX.find(x => x.id == this.enemy_formation);
	let eng = Global.ENGAGEMENT_FORM_DEFINITION.find(x => x.id == this.engagementform);

	this.engagementform_modify = eng?.support ?? 1;
	this.formation_modify = (sfm && efm && !sfm.combined && !efm.combined) ? sfm.power : 1;

	let st;
	if (this.target_id == EnemyStatus.ID_DIRECTINPUT) {
		st = EnemyStatusData.createDirectInput(this.target_hp, this.target_armor, this.target_evasion, this.target_luck);
	} else {
		// emptyもOK
		st = EquipmentDatabase.enemy_status.getStatus(this.target_id);
	}
	this.attack_score.setEnemyStatus(st);

	this.attack_score.atk_condition = this.condition_good ? Global.CONDITION_GOOD : Global.CONDITION_NORMAL;
	this.attack_score.atk_formation_id = this.self_formation;
	this.attack_score.def_formation_id = this.enemy_formation;
	this.attack_score.engagementform_id = this.engagementform;
	this.attack_score.need_damage = this.need_damage;
	this.attack_score.prepare();

	this.border_basic_power = this.get_border_basic_power();

	this.generate_slots();
}

/**
 * 計算用スロットを用意、equipablesも再生成
 * slot_count, exslot_available の影響を受ける
 * @method SupportShipData#generate_slots
 */
function SupportShipData_generate_slots(){
	let slots = [];
	let eqabs = [];
	let fixes = [];
	
	for (let i=0; i<this.slot_count; i++) {
		let id = this.equipment_ids[i] ?? 0;
		let star = this.equipment_stars[i] ?? 0;
		let eqab = this.equipable_info.slot_equipables[i];

		if (!id || !eqab[id]) {
			// 装備不可
			id = 0;
			star = 0;
		}
		slots.push(new EquipmentSlot(id, null, star));
		eqabs.push(eqab);
		fixes.push(this.equipment_fixes[i] ?? false);
	}

	if (!this.empty() && this.exslot_available) {
		let i = 5;
		let id = this.equipment_ids[i] ?? 0;
		let star = this.equipment_stars[i] ?? 0;
		let eqab = this.equipable_info.exslot_equipable;

		if (!id || !eqab[id]) {
			id = 0;
			star = 0;
		}
		slots.push(new EquipmentSlot(id, null, star));
		eqabs.push(eqab);
		fixes.push(this.equipment_fixes[i] ?? false);
	}
	
	this.allslot_equipment = slots;
	this.allslot_equipables = eqabs;
	this.allslot_fixes = fixes;
}

/**
 * 計算用スロットのデータを保存する
 * @param {boolean} [load_fixes=false] 固定も読み込むか (通常は変更されない)
 * @method SupportShipData#save_slots
 */
function SupportShipData_save_slots(load_fixes = false){
	let ids = new Array(6).fill(0);
	let stars = new Array(6).fill(0);
	let fixes = new Array(6).fill(false);

	for (let i=0; i<this.slot_count; i++) {
		ids[i] = this.allslot_equipment[i].equipment_id;
		stars[i] = this.allslot_equipment[i].improvement;
		fixes[i] = this.allslot_fixes[i];
	}

	if (this.exslot_available) {
		let i = 5;
		ids[i] = this.allslot_equipment[this.slot_count].equipment_id;
		stars[i] = this.allslot_equipment[this.slot_count].improvement;
		fixes[i] = this.allslot_fixes[this.slot_count];
	}

	this.equipment_ids = ids;
	this.equipment_stars = stars;
	if (load_fixes) this.equipment_fixes = fixes;
}

/**
 * (砲撃支援で)空母系計算式かどうか
 * @returns {boolean} cv_shelling
 * @method SupportShipData#is_cv_shelling
 */
function SupportShipData_is_cv_shelling(){
	return this.ship && SupportShipData.cv_shelling_types.indexOf(this.ship.shipTypeI || this.ship.shipType) >= 0;
}

/**
 * 駆逐艦かどうか
 * @return {boolean} 駆逐ならtrue
 * @method SupportShipData#is_dd
 */
function SupportShipData_is_dd(){
	return (this.ship && SupportShipData.dd_types.indexOf(this.ship.shipTypeI || this.ship.shipType) >= 0);
}

/**
 * targeting_mode に応じて、border_basic_power を計算
 * @returns {number}
 * @method SupportShipData#get_border_basic_power
 */
function SupportShipData_get_border_basic_power(){
	let basic = this.border_power;

	if (this.targeting_mode == Global.TARGETING_VENEMY) {
		let sup = this.attack_score.power_supremum;
		if (isFinite(sup)) {
			basic = SupportShipData.postcap_to_base(this.attack_score.engagement_power, this.attack_score.formation_power, sup);
		} else { // sup == -Inf
			basic = 1;
		}
	} else if (basic > 0) {
		if (this.targeting_mode == Global.TARGETING_PRECAP) {
			basic = SupportShipData.precap_to_base(this.attack_score.engagement_power, this.attack_score.formation_power, basic);
		} else {
			basic = SupportShipData.postcap_to_base(this.attack_score.engagement_power, this.attack_score.formation_power, basic);
		}
	} else {
		// basic <= 0
		// 最低1とする (0が攻撃不可を表す。念の為)
		basic = 1;
	}
	
	return basic;
}

/**
 * 装備ボーナスのクリア
 * @method SupportShipData#clear_bonus
 */
function SupportShipData_clear_bonus(){
	for (let i=0; i<this.allslot_equipment.length; i++) {
		this.allslot_equipment[i].clear_bonus();
	}
}

/**
 * 装備ボーナスの計算
 * @method SupportShipData#calc_bonus
 */
function SupportShipData_calc_bonus(){
	this.equipment_bonus.get_bonus(this.allslot_equipment, false);
}

/**
 * 表示火力
 * 先にボーナス値を計算しておく
 * @returns {number}
 * @method SupportShipData#get_display_power
 */
function SupportShipData_get_display_power(){
	let power = this.raw_firepower;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let slot = this.allslot_equipment[i];
		if (slot.equipment_data) {
			power += slot.equipment_data.firepower + slot.bonus_firepower;
		}
	}
	return power;
}

/**
 * 基本攻撃力
 * これも先にボーナス値を計算しておく
 * 攻撃できないときは0、ただしスコア計算モードの場合は-1000される
 * @param {boolean} [score_mode=false]
 * @returns {number}
 * @method SupportShipData#get_basic_power
 */
function SupportShipData_get_basic_power(score_mode = false){
	if (this.cv_shelling) {
		let fire = this.raw_firepower;
		let torp = 0;
		let bomb = 0;
		let attackable = this.cv_force_attackable;
		
		for (let i=0; i<this.allslot_equipment.length; i++) {
			let slot = this.allslot_equipment[i];
			let data = slot.equipment_data;
			
			if (data) {
				fire += data.firepower + slot.bonus_firepower;
				torp += data.torpedo; //  + slot.bonus_torpedo; // ボーナスはないかも？
				bomb += data.bombing;
				
				if (!attackable) {
					// 艦攻・艦爆を一つは装備していないと攻撃できない
					//attackable = data.category == "艦上爆撃機" || data.category == "艦上攻撃機" || data.category == "噴式戦闘爆撃機";
					attackable = data.cv_attackable;
				}
			}
		}
		
		let power;
		if (attackable) {
			power = Math.floor((fire + torp + Math.floor(bomb * 1.3) + Global.SUPPORT_MODIFY) * 1.5) + 55;
		} else if (score_mode) {
			power = Math.floor((fire + torp + Math.floor(bomb * 1.3) + Global.SUPPORT_MODIFY) * 1.5) + 55 - 1000;
		} else {
			power = 0;
		}
		return power;
		
	} else {
		return this.get_display_power() + 5 + Global.SUPPORT_MODIFY;
	}
}

/**
 * 最終攻撃力
 * @returns {number}
 * @method SupportShipData#get_final_power
 */
function SupportShipData_get_final_power(){
	let power = this.get_basic_power();
	let precap = power * this.engagementform_modify * this.formation_modify;
	return Math.floor(Damage.sqrtcap(precap, Global.SUPPORT_POWER_CAP));
}

/**
 * ボーナス火力の合計
 * @returns {number}
 * @method SupportShipData#get_bonus_firepower
 */
function SupportShipData_get_bonus_firepower(){
	let fpw = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let slot = this.allslot_equipment[i];
		let data = slot.equipment_data;
		if (data) {
			fpw += slot.bonus_firepower;
		}
	}
	return fpw;
}

/**
 * ボーナス雷装の合計
 * @returns {number}
 * @method SupportShipData#get_bonus_torpedo
 */
function SupportShipData_get_bonus_torpedo(){
	let tor = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let slot = this.allslot_equipment[i];
		let data = slot.equipment_data;
		if (data) {
			tor += slot.bonus_torpedo;
		}
	}
	return tor;
}


/**
 * 基礎命中
 * 計算ではキャッシュのraw_accuracyを使うべき
 * @returns {number}
 * @method SupportShipData#get_raw_accuracy
 */
function SupportShipData_get_raw_accuracy(){
	return 2 * Math.sqrt(this.level) + 1.5 * Math.sqrt(this.luck);
}

/**
 * 装備命中
 * @returns {number}
 * @method SupportShipData#get_equipment_accuracy
 */
function SupportShipData_get_equipment_accuracy(){
	let acc = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let data = this.allslot_equipment[i].equipment_data;
		if (data) {
			acc += data.accuracy;
		}
	}
	return acc;
}

/**
 * 命中 = floor(基礎命中 + 装備命中)
 * @method SupportShipData#get_accuracy
 */ 
function SupportShipData_get_accuracy(){
	return Math.floor(this.raw_accuracy + this.get_equipment_accuracy());
}

/**
 * 装備優先度の合計
 * 改修値 * 0.01 も加える
 * @returns {number}
 * @method SupportShipData#get_equipment_priority
 */
function SupportShipData_get_equipment_priority(){
	let p = 0;
	let star = 0;
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let data = this.allslot_equipment[i].equipment_data;
		if (data) {
			p += data.priority;
			star += this.allslot_equipment[i].improvement;
		}
	}
	return p + star * 0.01;
}

/**
 * 装備のソート
 * @param {number} sort_by 
 * @param {boolean} use_category 
 * @method SupportShipData#sort_equipment
 */
function SupportShipData_sort_equipment(sort_by, use_category){
	// 装備の比較(a, b: slot)
	let _compare_equip = (a, b) => {
		let eq_a = a.equipment_data;
		let eq_b = b.equipment_data;
		
		// 攻撃力 (降順)
		let c_pow = b.get_power_float(this.cv_shelling, true, true) - a.get_power_float(this.cv_shelling, true, true);
		// 命中 (降順)
		let c_acc = eq_b.accuracy - eq_a.accuracy;
		// id (昇順)
		let c_id = eq_a.number - eq_b.number;
		// 改修値 (降順)
		let c_star = b.improvement - a.improvement;
		// category (定義順)
		// use_category が true の場合にのみ、sort_by より優先して使用
		let c_cat = 0;
		if (use_category) {
			c_cat = _category_index(eq_a.category) - _category_index(eq_b.category);
		}
		
		return (
			sort_by == Global.SORT_BY_POWER    ? (c_cat || c_pow || c_acc || c_id || c_star) :
			sort_by == Global.SORT_BY_ACCURACY ? (c_cat || c_acc || c_pow || c_id || c_star) :
			/* sort_by == Global.SORT_BY_ID */   (c_cat || c_id || c_star || c_pow || c_acc)
		);
	};
	let _category_index = (cat) => {
		let index = Global.SORT_CATEGORY_DEF.indexOf(cat);
		if (index < 0) index = Global.SORT_CATEGORY_DEF.length;
		return index;
	};
	
	// slot の比較(i, j: 位置)
	// 正順-1/同値0/逆順1
	// 交換不可は同値としておく
	let _compare = (i, j) => {
		let a = this.allslot_equipment[i];
		let b = this.allslot_equipment[j];
		let eq_a = a.equipment_data;
		let eq_b = b.equipment_data;
		
		// 固定
		if (this.allslot_fixes[i] || this.allslot_fixes[j]) return 0;
		// 空チェック
		if (eq_a && !eq_b) return -1;
		if (!eq_a && eq_b) return 1;
		if (!eq_a && !eq_b) return 0;
		// 交換可能かどうか
		let eqab_a = this.allslot_equipables[i];
		let eqab_b = this.allslot_equipables[j];
		if (!eqab_a[b.equipment_id] || !eqab_b[a.equipment_id]) return 0;
		
		return _compare_equip(a, b);
	};
	let _check_and_swap = (i, j) => {
		if (_compare(i, j) > 0) {
			let a = this.allslot_equipment[i];
			this.allslot_equipment[i] = this.allslot_equipment[j];
			this.allslot_equipment[j] = a;
			return true;
		}
		return false;
	};
	
	// ボーナスは装備本数によっても変わるため、単体ボーナスのみ考慮してソートすることにする
	for (let i=0; i<this.allslot_equipment.length; i++) {
		this.equipment_bonus.get_independent_bonus(this.allslot_equipment[i]);
	}
	
	LOOP:
	for (;;) {
		// 隣り合うもの
		for (let i=0; i<this.allslot_equipment.length-1; i++) {
			let j = i + 1;
			if (_check_and_swap(i, j)) continue LOOP;
		}
		// 隣り合わないもの
		for (let i=0; i<this.allslot_equipment.length; i++)
		for (let j=i+2; j<this.allslot_equipment.length; j++)
		{
			if (_check_and_swap(i, j)) continue LOOP;
		}
		break;
	}
	
	this.calc_bonus();
}

/**
 * この艦に装備する際に、常に upper >= base と考えて良いかを判定する
 * upper, base: 装備データオブジェクト(csv)
 * @param {*} upper 
 * @param {*} base 
 * @returns {boolean}
 * @method SupportShipData#is_upper_equipment
 */
function SupportShipData_is_upper_equipment(upper, base){
	let upper_fpw = upper.firepower;
	let upper_tor = upper.torpedo;
	let base_fpw = base.firepower;
	let base_tor = base.torpedo;
	
	let bonus = this.equipment_bonus;
	
	// 装備優先度
	if (upper.priority < base.priority) return false;
	
	// シナジーボーナスについて
	if (bonus.assist_exists(base.number)) {
		// 同一種類のものでないならば不明とする
		if (!bonus.same_assist(upper.number, base.number)) return false;
	}
	
	if (bonus.bonus_exists(base.number)) {
		// 自身への装備ボーナスあり
		// どのくらいのボーナスがあるか分からないので、最大値で考えることにする
		let slot = new EquipmentSlot(base.number, base, 10);
		bonus.get_max_bonus(slot);
		base_fpw += slot.bonus_firepower;
		//base_tor += slot.bonus_torpedo;
	}
	// upperは最小値
	if (bonus.bonus_independent(upper.number)) {
		let slot = new EquipmentSlot(upper.number, upper, 0);
		bonus.get_independent_bonus(slot);
		upper_fpw += slot.bonus_firepower;
		//upper_tor += slot.bonus_torpedo;
	}
	
	// ステータス比較
	if ( this.cv_shelling
		?	upper_fpw      >= base_fpw &&
			upper_tor      >= base_tor &&
			upper.bombing  >= base.bombing &&
			upper.accuracy >= base.accuracy
		:	upper_fpw      >= base_fpw &&
			upper.accuracy >= base.accuracy )
	{
		return true;
	}
	
	return false;
}


/**
 * JSON形式のデータに変換。保存や転送が可能 <br>
 * 転送モードでは識別用、オプション、装備の一時変数が残る <br>
 * 装備ボーナスは転送されない
 * @param {boolean} transfer_mode
 * @returns {*} JSON
 * @method SupportShipData#get_json
 */
function SupportShipData_get_json(transfer_mode){
	let bool = b => b ? 1 : 0;
	
	// set_name() で設定される変数は省略可能
	let json = {
		ship_id         : this.ship?.shipId ?? "0",
		priority        : this.priority,
		input_level     : this.input_level,
		input_luck      : this.input_luck,
		exslot_available: bool(this.exslot_available),
		equipment_ids   : this.equipment_ids,
		equipment_stars : this.equipment_stars,
		equipment_fixes : this.equipment_fixes.map(bool),

		condition_good : bool(this.condition_good),
		self_formation : this.self_formation,
		enemy_formation: this.enemy_formation,
		engagementform : this.engagementform,
		targeting_mode : this.targeting_mode,
		border_power   : this.border_power,
		target_id      : this.target_id,
		target_hp      : this.target_hp,
		target_armor   : this.target_armor,
		target_evasion : this.target_evasion,
		target_luck    : this.target_luck,
		need_damage    : this.need_damage,
	};

	if (transfer_mode) {
		Object.assign(json, {
			ship_object_id     : this.ship_object_id,
			cv_force_attackable: this.cv_force_attackable,
			allslot_equipment  : this.allslot_equipment?.map(s => s.get_json()),
			allslot_fixes      : this.allslot_fixes?.map(bool),
			// allslot_equipables は再生成
		});
	}

	return json;
}

/**
 * JSON形式のデータを読み込む
 * @param {*} json JSON
 * @param {boolean} transfer_mode
 * @method SupportShipData#set_json
 */
function SupportShipData_set_json(json, transfer_mode){
	let load = prop => json?.[prop] ?? SupportShipData.prototype[prop];
	let number = prop => {
		let v = +load(prop);
		if (isNaN(v)) v = SupportShipData.prototype[prop];
		return v;
	};
	let array = (prop, map = x=>x) => {
		let v = load(prop);
		return !v ? null : (v instanceof Array) ? v.map(map) : [];
	};
	let bool = prop => Boolean(load(prop));

	this.set_ship_id(load("ship_id"));
	this.priority         = number("priority");
	this.input_level      = number("input_level");
	this.input_luck       = number("input_luck");
	this.exslot_available = bool("exslot_available");
	this.equipment_ids    = array("equipment_ids", Number);
	this.equipment_stars  = array("equipment_stars", Number);
	this.equipment_fixes  = array("equipment_fixes", Boolean);

	this.condition_good   = bool("condition_good");
	this.self_formation   = number("self_formation");
	this.enemy_formation  = number("enemy_formation");
	this.engagementform   = number("engagementform");
	this.targeting_mode   = number("targeting_mode");
	this.border_power     = number("border_power");
	this.target_id        = load("target_id");
	this.target_hp        = number("target_hp");
	this.target_armor     = number("target_armor");
	this.target_evasion   = number("target_evasion");
	this.target_luck      = number("target_luck");
	this.need_damage      = number("need_damage");

	if (transfer_mode) {
		this.ship_object_id = load("ship_object_id");
		this.cv_force_attackable = bool("cv_force_attackable");
	}

	this.set_cachevars();

	if (transfer_mode) {
		this.allslot_equipment = array("allslot_equipment", json => new EquipmentSlot().set_json(json));
		this.allslot_fixes     = array("allslot_fixes", Boolean);
	}
}


/**
 * デッキビルダー形式
 * IDが定義されていない場合は"0"
 * @returns {*} JSON
 * @method SupportShipData#get_json_deckbuilder
 */
/* {
	id: '100', lv: 40, luck: -1,
	items:{ // 装備
		// id: ID, rf: 改修, mas: 熟練度
		i1:{id:1, rf: 4, mas:7},
		i2:{id:3, rf: 0},
		...,
		ix:{id:43} // 増設
	}
} */
function SupportShipData_get_json_deckbuilder(){
	let airplane_cates = [
		"艦上偵察機", "艦上攻撃機", "艦上爆撃機", "噴式戦闘爆撃機",
		"水上偵察機", "多用途水上機/水上爆撃機", "水上戦闘機",
	];
	
	let ship = EquipmentDatabase.csv_shiplist.find(d => d.name == this.ship_name);
	let json = {
		id: String(ship?.shipId || "0"),
		lv: this.level >= 0 ? this.level : 99,
		luck: this.luck >= 0 ? this.luck : -1,
		items: {},
	};
	
	for (let i=0; i<this.allslot_equipment.length; i++) {
		let item_key;
		if (this.exslot_available && i == this.allslot_equipment.length - 1) {
			// 増設
			item_key = "ix";
		} else {
			item_key = "i" + (i + 1);
		}
		
		let slot = this.allslot_equipment[i];
		if (slot.equipment_id) {
			json.items[item_key] = {
				id: slot.equipment_id,
				rf: slot.improvement,
			};
			if (airplane_cates.indexOf(slot.equipment_data.category) >= 0) {
				json.items[item_key].mas = 7;
			}
		}
	}
	
	return json;
}


// サブスレッドへの転送用
function SupportShipData_get_json_MT(){
	return this.get_json(true);
}

function SupportShipData_set_json_MT(json){
	this.set_json(json, true);
}


// 2つの装備の、この艦への装備可能条件に関する包含関係
// ただし固定されているスロットは除く
// a, b: 装備ID
// mainslot: 通常の装備スロットについて
// exslot: 増設スロットについて
function SupportShipData_eqab_compare(a, b, mainslot = true, exslot = false){
	let a_inc_b = true; // bが装備可能⇒aが装備可能、a⊃b である
	let b_inc_a = true; // b⊃a
	
	let ibegin = mainslot ? 0 : this.slot_count;
	let iend   = exslot ? this.allslot_equipment.length : this.slot_count;
	
	for (let i=ibegin; i<iend; i++) {
		if (this.allslot_fixes[i]) continue;
		let eqab = this.allslot_equipables[i];
		
		if (eqab[a] && !eqab[b]) b_inc_a = false;
		if (eqab[b] && !eqab[a]) a_inc_b = false;
	}
	
	let c = 0;
	if (a_inc_b && b_inc_a) { // 同等
	} else if (a_inc_b) {     // a⊃b
		c = 1;
	} else if (b_inc_a) {     // b⊃a
		c = -1;
	} else {
/*
		// 含むでも含まれるでもない
		// 艦これのシステムならこれはないと仮定する
		// …が、増設に見張員が積めるようになってしまったので、夕張などで発生することに
		console.log("warning: 装備可能条件が仮定を満たさない");
		debugger;
*/
	}
	return c;
}

// 装備可能条件が特殊な(非固定)増設スロットを持つか
// 特殊とは、増設に装備可能だが通常の(非固定)スロットのいずれかに装備できない装備があること
// ids: 装備IDのリスト　省略すると全ての装備
function SupportShipData_has_irregular_exslot(ids = null){
	// 増設スロット位置
	let ex_index = this.slot_count;
	if (!this.exslot_available || this.allslot_fixes[ex_index]) return false;
	
	// 比較する通常スロットの位置
	let last_index = -1;
	for (let r=0; r<ex_index; r++) {
		let i = ex_index - r - 1;
		if (!this.allslot_fixes[i]) {
			last_index = i;
			break;
		}
	}
	if (last_index < 0) return false;
	
	let last_eqab = this.allslot_equipables[last_index];
	let ex_eqab = this.allslot_equipables[ex_index];
	let keys = ids || Object.keys(ex_eqab);
	
	for (let i=0; i<keys.length; i++) {
		if (ex_eqab[keys[i]] && !last_eqab[keys[i]]) return true;
	}
	
	return false;
}

// 砲撃戦火力で比較　装備ボーナスはなし
// a, b: 装備ID
// 厳密には、整数化の都合でこの順番にならない場合がある
function SupportShipData_power_compare(a, b){
	let da = EquipmentDatabase.equipment_data_map[a];
	let db = EquipmentDatabase.equipment_data_map[b];
	
	if (this.cv_shelling) {
		let _cv_power = eq => eq.firepower + eq.torpedo + eq.bombing * 1.3;
		return _cv_power(da) - _cv_power(db);
	} else {
		return da.firepower - db.firepower;
	}
}

// 命中値で比較
function SupportShipData_accuracy_compare(a, b){
	let da = EquipmentDatabase.equipment_data_map[a];
	let db = EquipmentDatabase.equipment_data_map[b];
	return da.accuracy - db.accuracy;
}

// 装備優先度
function SupportShipData_priority_compare(a, b){
	let da = EquipmentDatabase.equipment_data_map[a];
	let db = EquipmentDatabase.equipment_data_map[b];
	return da.priority - db.priority;
}

function SupportShipData_static_power_compare(a, b, cv_shelling){
	return SupportShipData_power_compare.call({cv_shelling: cv_shelling}, a, b);
}


/**
 * sqrtcap(bp * en * fm) >= tp なる最小の整数 bp を返す <br>
 * dp = bp - (5 + Global.SUPPORT_MODIFY) が表示火力になる
 * @param {number} engagement_form 
 * @param {number} formation 
 * @param {number} target_power キャップ後攻撃力
 * @returns {number} 基本攻撃力
 * @member SupportShipData.postcap_to_base
 */
function SupportShipData__postcap_to_base(engagement_form, formation, target_power){
	// 最初の bp はだいたいあっているが、計算誤差の都合で確定ではない
	// とはいえ、修正しても実際の艦これと合っているかは微妙ではあるが
	let bpmin = Damage.inv_sqrtcap(target_power, Global.SUPPORT_POWER_CAP) / formation / engagement_form;
	let bp = Math.ceil(bpmin);
	
	let f = bp => Damage.sqrtcap(bp * engagement_form * formation, Global.SUPPORT_POWER_CAP);
	
	if (f(bp) < target_power) bp++;
	else if (f(bp - 1) >= target_power) bp--;
	
	return bp;
}

/**
 * キャップを外した bp * en * fm >= tp の version
 * @param {number} engagement_form 
 * @param {number} formation 
 * @param {number} target_power キャップ前攻撃力
 * @returns {number} 基本攻撃力
 * @member SupportShipData.precap_to_base
 */
function SupportShipData__precap_to_base(engagement_form, formation, target_power){
	let bpmin = target_power / formation / engagement_form;
	let bp = Math.ceil(bpmin);
	
	let f = bp => Damage.sqrtcap(bp * engagement_form * formation, Global.SUPPORT_POWER_CAP);
	
	if (f(bp) < target_power) bp++;
	else if (f(bp - 1) >= target_power) bp--;
	
	return bp;
}

