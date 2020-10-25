/* 探索のデータクラスと探索関数 */

import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {
	SupportShip,
	SupportShipData,
} from "./kc_support_ship.mjs";
import {
	SupportFleetData_fill,
	SupportFleetData_hill_climbling1,
	SupportFleetData_single,
	SupportFleetData_single_nosynergy,
	SupportFleetData_single_nosynergy_pre,
	SupportFleetData_single_climbling,
	SupportFleetData_annealing_old,
} from "./kc_support_fleet_data2.mjs";
import {
	SupportFleetData_annealing,
} from "./kc_support_fleet_data3.mjs";

export {
	SupportFleetData,
};


// SupportFleetData --------------------------------------------------------------------------------
Object.assign(SupportFleetData.prototype, {
	ssd_list         : null, // array of SupportShipData
	own_list         : null, // array of OwnEquipmentData
	own_map          : null, // map: id -> OwnEquipmentData
	
	set_own_data     : SupportFleetData_set_own_data,
	append_fleet     : SupportFleetData_append_fleet,
	save_to_form     : SupportFleetData_save_to_form,
	
	clone            : SupportFleetData_clone,
	move_from        : SupportFleetData_move_from,
	
	verify            : SupportFleetData_verify,
	modify_remainings    : SupportFleetData_modify_remainings,
	countup_equipment_ssd: SupportFleetData_countup_equipment_ssd,
	countup_equipment    : SupportFleetData_countup_equipment,
	clear_slots_ssd   : SupportFleetData_clear_slots_ssd,
	clear_slots       : SupportFleetData_clear_slots,
	swap_slot_ptr     : SupportFleetData_swap_slot_ptr,
	check_swappable   : SupportFleetData_check_swappable,
	sort_equipment    : SupportFleetData_sort_equipment,
	allow_fixed_exslot: SupportFleetData_allow_fixed_exslot,
	priority_call     : SupportFleetData_priority_call,
	
	assert_count     : SupportFleetData_assert_count,
	get_own_list_text: SupportFleetData_get_own_list_text,
	get_text_diff    : SupportFleetData_get_text_diff,
	
	
	// kancolle_support_data2.mjs
	fill             : SupportFleetData_fill,
	hill_climbling1  : SupportFleetData_hill_climbling1,
	single           : SupportFleetData_single,
	single_nosynergy : SupportFleetData_single_nosynergy,
	single_nosynergy_pre: SupportFleetData_single_nosynergy_pre,
	single_climbling : SupportFleetData_single_climbling,
	annealing_old    : SupportFleetData_annealing_old,
	
	// kancolle_support_data3.mjs
	annealing        : SupportFleetData_annealing,
});


function SupportFleetData(){
	this.ssd_list = new Array;
}

// 所持装備データのセット
// 所持数が0でも、入力可能な装備かどうかの判定に利用する
// 計算用変数の初期化も行う
function SupportFleetData_set_own_data(own_list){
	// 除外は除いて、入力欄がない装備と同じとする
	this.own_list = own_list.filter(own => !own.exclude);
	
	let map = new Object;
	for (let own of own_list) {
		map[own.id] = own;
	}
	this.own_map = map;
	
	own_list.forEach(own => own.init_varcounts());
}

// 艦を追加
function SupportFleetData_append_fleet(fleet){
	let good = true;
	for (let sup of fleet.support_ships) {
		if (!sup.empty()) {
			let ssd = new SupportShipData;
			if (sup.get_data(ssd)) {
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
		ssd.support_ship.set_data(ssd);
	}
}


// 複製
function SupportFleetData_clone(){
	let fleet = new SupportFleetData;
	fleet.ssd_list = this.ssd_list.map(x => x.clone());
	fleet.own_list = this.own_list.map(x => x.clone());
	let map = new Object;
	for (let own of fleet.own_list) map[own.id] = own;
	fleet.own_map = map;
	return fleet;
}

// データの移動
// src のデータは破棄されるものとする
function SupportFleetData_move_from(src){
	Object.assign(this, src);
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


// 優先度に従って ssd_list を分割・変更し、func を呼ぶ
// single_call: 長さが1の場合は single() を呼び出す
// 優先度の低い艦の装備を解除して呼び出しを行う
// 現在の装備はなるべく維持しようとするが、個数が足りなくなったら以降の艦は全解除とする
function SupportFleetData_priority_call(func, single_call){
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



