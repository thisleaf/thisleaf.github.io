/* 探索のデータクラスと探索関数 */

import * as Global from "./kc_support_global.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {
	OwnEquipmentData,
} from "./kc_support_equip.mjs";
import {
	SupportShip,
	SupportShipData,
} from "./kc_support_ship.mjs";
import {
	SupportFleetScore,
	SupportShipScore,
	SupportFleetScorePrior,
} from "./kc_support_score.mjs";
import {
	SupportFleetData_fill,
	SupportFleetData_random_fill,
	SupportFleetData_hill_climbling1,
	SupportFleetData_single,
	SupportFleetData_single_nosynergy,
	SupportFleetData_single_nosynergy_pre,
	SupportFleetData_single_climbling,
} from "./kc_support_fleet_data2.mjs";
import {
	SupportFleetData_annealing,
	SupportFleetData_annealing_entire,
	SupportFleetData_annealing_entire_main,
} from "./kc_support_fleet_data3.mjs";

export {
	SupportFleetData,
};


// SupportFleetData --------------------------------------------------------------------------------
Object.assign(SupportFleetData.prototype, {
	support_ships    : null, // array of SupportShip
	ssd_list         : null, // array of SupportShipData
	own_list         : null, // array of OwnEquipmentData
	own_map          : null, // map: id -> OwnEquipmentData
	
	// executable() が偽の場合の理由
	reason: "",

	set_own_data     : SupportFleetData_set_own_data,
	generate_own_map : SupportFleetData_generate_own_map,
	append_fleet     : SupportFleetData_append_fleet,
	save_to_form     : SupportFleetData_save_to_form,
	save_slots       : SupportFleetData_save_slots,
	
	clone            : SupportFleetData_clone,
	move_from        : SupportFleetData_move_from,
	get_json_MT      : SupportFleetData_get_json_MT,
	set_json_MT      : SupportFleetData_set_json_MT,
	
	verify                 : SupportFleetData_verify,
	modify_remainings      : SupportFleetData_modify_remainings,
	modify_fixed_equips_ssd: SupportFleetData_modify_fixed_equips_ssd,
	modify_fixed_equips    : SupportFleetData_modify_fixed_equips,
	countup_equipment_ssd  : SupportFleetData_countup_equipment_ssd,
	countup_equipment      : SupportFleetData_countup_equipment,
	clear_slots_ssd   : SupportFleetData_clear_slots_ssd,
	clear_slots       : SupportFleetData_clear_slots,
	calc_bonus        : SupportFleetData_calc_bonus,
	swap_slot_ptr     : SupportFleetData_swap_slot_ptr,
	check_swappable   : SupportFleetData_check_swappable,
	sort_equipment    : SupportFleetData_sort_equipment,
	allow_fixed_exslot: SupportFleetData_allow_fixed_exslot,
	priority_call     : SupportFleetData_priority_call,
	close_priority_gap: SupportFleetData_close_priority_gap,
	restore_priority  : SupportFleetData_restore_priority,
	get_priority_counts: SupportFleetData_get_priority_counts,
	
	assert_count     : SupportFleetData_assert_count,
	get_own_list_text: SupportFleetData_get_own_list_text,
	get_text_diff    : SupportFleetData_get_text_diff,
	
	search           : SupportFleetData_search,
	executable       : SupportFleetData_executable,
	
	// kancolle_support_data2.mjs
	fill             : SupportFleetData_fill,
	random_fill      : SupportFleetData_random_fill,
	hill_climbling1  : SupportFleetData_hill_climbling1,
	single           : SupportFleetData_single,
	single_nosynergy : SupportFleetData_single_nosynergy,
	single_nosynergy_pre: SupportFleetData_single_nosynergy_pre,
	single_climbling : SupportFleetData_single_climbling,
	
	// kancolle_support_data3.mjs
	annealing            : SupportFleetData_annealing,
	annealing_entire     : SupportFleetData_annealing_entire,
	annealing_entire_main: SupportFleetData_annealing_entire_main,
});


/**
 * 探索用データと探索関数のクラス
 * @constructor
 */
function SupportFleetData(){
	this.support_ships = new Array;
	this.ssd_list = new Array;
}

// 所持装備データのセット
// 所持数が0でも、入力可能な装備かどうかの判定に利用する
// 計算用変数の初期化も行う
function SupportFleetData_set_own_data(own_list){
	// 除外は除いて、入力欄がない装備と同じとする
	this.own_list = own_list.filter(own => !own.exclude);
	this.generate_own_map();
	
	own_list.forEach(own => own.init_varcounts());
}

// own_map の再生成
function SupportFleetData_generate_own_map(){
	let map = new Object;
	for (let own of this.own_list) {
		map[own.id] = own;
	}
	this.own_map = map;
}

// 艦を追加
function SupportFleetData_append_fleet(fleet){
	let good = true;
	for (let sup of fleet.support_ships) {
		if (!sup.empty()) {
			// check id
			if (!sup.object_id || this.support_ships.findIndex(c => c.object_id == sup.object_id) >= 0) {
				debugger;
			}
			this.support_ships.push(sup);
			
			let ssd = sup.get_ssd();
			if (!ssd.empty()) {
				this.ssd_list.push(ssd);
			} else {
				good = false;
			}
		}
	}
	return good;
}

// 現在の ssd_list の状態をフォームに反映
function SupportFleetData_save_to_form(){
	for (let i=0; i<this.ssd_list.length; i++) {
		let ssd = this.ssd_list[i];
		let ship = this.support_ships.find(s => s.object_id == ssd.ship_object_id);
		if (!ship) debugger;
		ship.set_ssd(ssd);
	}
}

/**
 * ssdの計算用スロットのデータを保存する
 * @method SupportFleetData#save_slots
 */
function SupportFleetData_save_slots(){
	for (let i=0; i<this.ssd_list.length; i++) {
		this.ssd_list[i].save_slots();
	}
}

// 複製
function SupportFleetData_clone(gen_map = true){
	let fleet = new SupportFleetData;
	fleet.support_ships = this.support_ships.concat();
	fleet.ssd_list = this.ssd_list.map(x => x.clone());
	fleet.own_list = this.own_list.map(x => x.clone());
	if (gen_map) fleet.generate_own_map();
	return fleet;
}

// データの移動
// src のデータは破棄されるものとする
function SupportFleetData_move_from(src){
	Object.assign(this, src);
}

// マルチスレッドのためのjson変換
function SupportFleetData_get_json_MT(json, get_dom){
	let obj = json || {};
	obj.ssd_list = this.ssd_list.map(ssd => ssd.get_json_MT());
	obj.own_list = this.own_list.map(own => own.get_json_MT());
	
	if (get_dom) {
		obj.support_ships = this.support_ships.map(sup => sup.get_ssd().get_json(true));
	}
	return obj;
}

// set_dom: support_ships もセットする(DOMが変更される)　ワーカーではDOMをさわれない
// 探索は ssd_list で足りる
function SupportFleetData_set_json_MT(json, set_dom){
	if (set_dom) {
		for (let i=0; i<json.support_ships.length; i++) {
			let ssd = new SupportShipData();
			ssd.set_json(json.support_ships[i], true);
			this.support_ships[i].set_ssd(ssd);
		}
	}
	
	this.ssd_list = json.ssd_list.map(obj => {
		let ssd = new SupportShipData();
		ssd.set_json_MT(obj);
		return ssd;
	});
	this.own_list = json.own_list.map(obj => {
		let own = new OwnEquipmentData();
		own.set_id(obj.id);
		own.set_json_MT(obj);
		return own;
	});
	this.generate_own_map();
}

// 装備数データに矛盾がないかどうか
function SupportFleetData_verify(){
	for (let own of this.own_list) {
		for (let c of own.rem_counts) {
			if (c < 0) return false;
		}
	}
	return true;
}


// 改修値に矛盾があっても、適当に修正する(rem_counts)
function SupportFleetData_modify_remainings(){
	for (let own of this.own_list) {
		if (!own.rem_counts) {
			debugger;
		}
		for (let i=0; i<own.rem_counts.length; i++) {
			let rem = own.rem_counts[i];
			if (rem >= 0) continue;
			
			// 残り数が負数のときは改修値の大きい方優先で修正をかける
			for (let j=own.rem_counts.length-1; j>=0; j--) {
				let c = own.rem_counts[j];
				
				if (c > 0) {
					// d > 0 の数だけ i -> j に移動
					let d = Math.min(c, -rem);
					own.rem_counts[j] -= d;
					rem += d;
					if (rem >= 0) break;
				}
			}
			
			own.rem_counts[i] = rem;
		}
	}
}

// 固定に矛盾があっても適当に修正する(ssdのデータ)
function SupportFleetData_modify_fixed_equips_ssd(ssd){
	for (let i=0; i<ssd.allslot_equipment.length; i++) {
		if (!ssd.allslot_fixes[i]) continue;
		
		let id = ssd.allslot_equipment[i].equipment_id;
		let star = ssd.allslot_equipment[i].improvement;
		let own = this.own_map[id];
		if (!id || !own || own.rem_counts[star] >= 0) continue;
		
		// 改修値の変更を試みる
		for (let j=own.rem_counts.length-1; j>=0; j--) {
			if (own.rem_counts[j] > 0) {
				own.rem_counts[j]--;
				own.rem_counts[star]++;
				ssd.allslot_equipment[i].improvement = j;
				
				own.fix_counts[j]++;
				own.fix_counts[star]--;
				break;
			}
		}
	}
}

// 全体版
function SupportFleetData_modify_fixed_equips(){
	for (let ssd of this.ssd_list) {
		this.modify_fixed_equips_ssd(ssd);
	}
}


// ssd の装備数をカウントして own_map に反映
// unfixed: 固定以外をカウント
// fixed  : 固定をカウント
// inc_dec: 1本あたりの変動量、省略すると1。カウントするとremainingは減少。-1を指定することで減算できる
function SupportFleetData_countup_equipment_ssd(ssd, unfixed, fixed, inc_dec = 1){
	let own_map = this.own_map;
	
	for (let i=0; i<ssd.allslot_equipment.length; i++) {
		let slot_fixed = ssd.allslot_fixes[i];
		if (slot_fixed ? fixed : unfixed) {
			let id = ssd.allslot_equipment[i].equipment_id;
			if (id) {
				let own = own_map[id];
				if (own) {
					let p = ssd.allslot_equipment[i].improvement;
					own.rem_counts[p] -= inc_dec;
					own.remaining -= inc_dec;
					if (slot_fixed) {
						own.fix_counts[p] += inc_dec;
						own.fixed += inc_dec;
					}
				}
			}
		}
	}
}

// 全体版
function SupportFleetData_countup_equipment(unfixed, fixed, inc_dec = 1){
	for (let ssd of this.ssd_list) {
		this.countup_equipment_ssd(ssd, unfixed, fixed, inc_dec);
	}
}


// スロットをクリアする　own_list への変更は行わない
// unfixed: 固定でないスロット
// fixed  : 固定スロット
// suggested    : 所持数入力を用意している
// not_suggested: 所持数入力を用意していない
function SupportFleetData_clear_slots_ssd(ssd, unfixed, fixed, suggested = true, not_suggested = true){
	for (let i=0; i<ssd.allslot_equipment.length; i++) {
		if (ssd.allslot_fixes[i] ? fixed : unfixed) {
			let slot = ssd.allslot_equipment[i];
			let own = this.own_map[slot.equipment_id];
			
			if (own ? suggested : not_suggested) {
				// 装備解除
				slot.set_equipment(0, null, 0);
			}
		}
	}
}

// 全体版
function SupportFleetData_clear_slots(unfixed, fixed, suggested = true, not_suggested = true){
	for (let ssd of this.ssd_list) {
		this.clear_slots_ssd(ssd, unfixed, fixed, suggested, not_suggested);
	}
}

/**
 * 全ての艦の装備ボーナスを計算
 * @alias SupportFleetData#calc_bonus
 */
function SupportFleetData_calc_bonus(){
	for (let ssd of this.ssd_list) {
		ssd.calc_bonus();
	}
}

// ssd1 の pos1 番目の装備と ssd2 の pos2 番目の装備を入れ替える
// 入れ替える場合はポインターのみを入れ替え
// 他と衝突しなければこっちが速い、はず
// 入れ替えができたら true を返す
function SupportFleetData_swap_slot_ptr(ssd1, pos1, ssd2, pos2){
	if (ssd1.allslot_fixes[pos1] || ssd2.allslot_fixes[pos2]) return false;
	
	// EquipmentSlot はポインターの入れ替えのみで行ける
	let id1 = ssd1.allslot_equipment[pos1].equipment_id;
	let id2 = ssd2.allslot_equipment[pos2].equipment_id;
	
	// 入れ替え可能
	if (ssd1.allslot_equipables[pos1][id2] && ssd2.allslot_equipables[pos2][id1]) {
		let slot1 = ssd1.allslot_equipment[pos1];
		ssd1.allslot_equipment[pos1] = ssd2.allslot_equipment[pos2];
		ssd2.allslot_equipment[pos2] = slot1;
		return true;
		
	} else {
		return false;
	}
}

// ssd1 の pos1 番目の装備と ssd2 の pos2 番目の装備の入れ替えが可能か
function SupportFleetData_check_swappable(ssd1, pos1, ssd2, pos2){
	if (ssd1.allslot_fixes[pos1] || ssd2.allslot_fixes[pos2]) return false;
	
	let id1 = ssd1.allslot_equipment[pos1].equipment_id;
	let id2 = ssd2.allslot_equipment[pos2].equipment_id;
	
	// 入れ替え可能条件
	return ssd1.allslot_equipables[pos1][id2] && ssd2.allslot_equipables[pos2][id1];
}

// 装備を並び替える
function SupportFleetData_sort_equipment(sort_by, use_category){
	for (let ssd of this.ssd_list) {
		ssd.sort_equipment(sort_by, use_category);
	}
}

// 増設スロットについて、固定として扱ってもよいか
// 厳密には違うのだが、それは装備が足りずに空きスロットがある場合などなので……
function SupportFleetData_allow_fixed_exslot(){
	for (let ssd of this.ssd_list) {
		let last_index = ssd.allslot_equipment.length - 1;
		
		if (ssd.exslot_available && !ssd.allslot_fixes[last_index]) {
			let slot = ssd.allslot_equipment[last_index];
			let eqab = ssd.allslot_equipables[last_index];
			let eq = slot.equipment_data;
			// からっぽ！
			if (!eq) return false;
			
			let list = this.own_list.filter(x => x.rem_counts.reduce((a, c) => a + c) > 0 && eqab[x.id]);
			for (let own of list) {
				let own_eq = EquipmentDatabase.equipment_data_map[own.id];
				if (eq.firepower < own_eq.firepower || eq.accuracy < own_eq.accuracy) {
					// 上位の装備が見つかったので失敗
					return false;
				}
			}
		}
	}
	
	return true;
}


/**
 * 優先度に従って ssd_list を分割・変更し、func を呼ぶ
 * 優先度の低い艦の装備を解除して呼び出しを行う
 * 現在の装備はなるべく維持しようとするが、個数が足りなくなったら以降の艦は全解除とする
 * @param {function} func 
 * @param {boolean} single_call 長さが1の場合は single() を呼び出す
 * @alias SupportFleetData#priority_call
 */
function SupportFleetData_priority_call(func, _single_call){
	// NOTE: single_callは現在一時停止中
	let single_call = false;
	let orig_ssds = this.ssd_list.map(x => x.clone());
	
	// 装備を全解除　元の装備情報は orig_ssds に
	this.countup_equipment(true, false, -1);
	this.clear_slots(true, false);
	
	let uneq_ssds = this.ssd_list;
	let new_ssds = new Array;
	let do_equip = true;
	
	for (let p=1; p<=12; p++) {
		let cur_ssds = new Array;
		
		for (let i=0; i<orig_ssds.length; i++) {
			if (orig_ssds[i].priority == p) {
				let ssd = uneq_ssds[i];
				
				if (do_equip) {
					// 装備可能かどうか
					this.countup_equipment_ssd(orig_ssds[i], true, false);
					
					if (this.verify()) {
						// OK
						ssd = orig_ssds[i].clone();
						
					} else {
						// 足りません
						do_equip = false;
						this.countup_equipment_ssd(orig_ssds[i], true, false, -1);
					}
				}
				cur_ssds.push(ssd);
			}
		}
		
		if (cur_ssds.length == 0) continue;
		
		if (!do_equip) {
			// 装備ができなかった場合は全解除
			for (let ssd of cur_ssds) {
				this.countup_equipment_ssd(ssd, true, false, -1);
				this.clear_slots_ssd(ssd, true, false);
			}
		}
		
		for (let ssd of cur_ssds) {
			ssd.calc_bonus();
		}
		
		// 呼び出し
		this.ssd_list = cur_ssds;
		if (single_call && cur_ssds.length == 1) {
			this.single(cur_ssds[0]);
		} else {
			func();
		}
		
		// 呼び出しによって ssd_list が書き換えられる可能性がある
		for (let i=0; i<orig_ssds.length; i++) {
			if (orig_ssds[i].priority == p) {
				new_ssds[i] = this.ssd_list.shift();
			}
		}
	}
	
	this.ssd_list = new_ssds;
}


// 優先度の間を埋め、0から始まる連続整数にする
// 戻り値: もとの優先度の配列、restore_priority() で元に戻す
function SupportFleetData_close_priority_gap(){
	let p_all = this.ssd_list.map(ssd => ssd.priority);
	p_all.sort((a, b) => a - b);
	// 変換後 -> 変換前
	let p_inv_map = p_all.filter((p, i) => p != p_all[i - 1]);
	// 変換
	let p_map = {};
	p_inv_map.forEach((p, i) => p_map[p] = i);
	
	for (let ssd of this.ssd_list) {
		ssd.priority = p_map[ssd.priority];
	}
	return p_inv_map;
}

// close_priority_gap() の変更をもとに戻す
function SupportFleetData_restore_priority(p_inv_map){
	for (let ssd of this.ssd_list) {
		ssd.priority = p_inv_map[ssd.priority];
	}
}

// array: 優先度 -> その優先度をもつssdの数
function SupportFleetData_get_priority_counts(){
	let arr = [];
	this.ssd_list.forEach(ssd => arr[ssd.priority] = (arr[ssd.priority] || 0) + 1);
	return arr;
}


// 所持数データと装備数に不一致が出ていないかを確認する
// デバッグ用
function SupportFleetData_assert_count(message = "?"){
	// 装備数(固定含む)
	let support_use = new Object;
	// 固定数
	let fixed = new Object;
	
	for (let ssd of this.ssd_list) {
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			let id = ssd.allslot_equipment[i].equipment_id;
			let star = ssd.allslot_equipment[i].improvement;
			if (id) {
				let sup = support_use[id] || (support_use[id] = new Array(11).fill(0));
				sup[star]++;
				if (ssd.allslot_fixes[i]) {
					let fix = fixed[id] || (fixed[id] = new Array(11).fill(0));
					fix[star]++;
				}
			}
		}
	}
	
	for (let own of this.own_list) {
		let sup = support_use[own.id];
		let fix = fixed[own.id];
		
		let b_rem = own.rem_counts.reduce((a, c) => a && c >= 0, true);
		let b_use = own.rem_counts.reduce((a, c, i) => {
			let r = own.total_counts[i] - own.main_counts[i] - (sup ? sup[i] : 0);
			return a && c == r;
		}, true);
		let b_fix = own.fix_counts.reduce((a, c, i) => {
			return a && c == (fix ? fix[i] : 0);
		}, true);
		
		// 不一致・矛盾
		if (!b_rem) {
			console.log(own, own.rem_counts);
			debugger;
			throw "remaining < 0 at " + message;
		} else if (!b_use) {
			console.log(own, own.total_counts, own.rem_counts, sup);
			debugger;
			throw "remaining counts mismatched at " + message;
		} else if (!b_fix) {
			console.log(own, own.fix_counts, fix);
			debugger;
			throw "fixed counts mismatched at " + message;
		}
	}
	
	console.log("assertion succeeded! at", message);
}


function SupportFleetData_get_own_list_text(){
	return this.own_list.map(own => {
		let eq = EquipmentDatabase.equipment_data_map[own.id];
		let text = "[" + eq.number + "] " + eq.name + " (" + own.remaining +", "+ own.fixed +")";
		return text;
	});
}

function SupportFleetData_get_text_diff(a, b){
	let arr = new Array;
	for (let i=0; i<a.length; i++) {
		if (a[i] != b[i]) {
			arr.push(a[i] +" -> "+ b[i]);
		}
	}
	return arr;
}


// 探索関数のまとめ
function SupportFleetData_search(search_type, param = null){
	if (search_type == "annealing") {
		// 優先度ごとに焼きなまし
		this.priority_call(() => {
			this.annealing(param?.iteration_scale || 1);
		}, true);
		
	} else if (search_type == "annealing_entire") {
		// 全体焼きなまし
		this.annealing_entire(param?.iteration_scale || 1);
		
	} else if (search_type == "fast") {
		// 高速探索
		this.priority_call(() => {
			this.fill();
			this.single_climbling(false, true);
			
			let score = new SupportFleetScore(this.ssd_list);
			for (let i=0; i<10; i++) {
				// 交互に実行していって、スコアが変わらなくなったら終了
				if (i % 2 == 0) {
					this.hill_climbling1();
				} else {
					this.single_climbling(false, true);
				}
				
				let new_score = new SupportFleetScore(this.ssd_list);
				if (new_score.compare(score) <= 0) break;
				score = new_score;
			}
		}, true);
		
	} else {
		debugger;
	}

	// 結果は計算用一時変数にあるので、それを読み込む必要がある
	for (let i=0; i<this.ssd_list.length; i++) {
		this.ssd_list[i].save_slots();
	}
}

/**
 * 探索が実行可能かどうか
 * 不可のときは this.reason に理由を格納
 * @param {string} search_type
 * @returns {boolean}
 * @alias SupportFleetData#executable
 */
function SupportFleetData_executable(search_type){
	if (search_type == "fast") {
		this.reason = "現在高速探索は利用できません";
		return false;
	}

	for (let ssd of this.ssd_list) {
		if (ssd.targeting_mode == Global.TARGETING_VENEMY) {
			if (!ssd.attack_score.good()) {
				if (ssd.attack_score.atk_formation_id == 6) {
					this.reason = "警戒陣の命中は未実装です";
				} else {
					this.reason = "敵艦のステータスに未入力があります";
				}
				this.reason += "(" + ssd.get_name() + ")";
				return false;
			}
		}
	}

	// OK
	this.reason = "";
	return true;
}

