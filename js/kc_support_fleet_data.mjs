/* 探索のデータクラスと探索関数 */

import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {SupportShip, SupportShipData} from "./kc_support_ship.mjs";
import {
	SupportFleetData_fill,
	SupportFleetData_hill_climbling1,
	SupportFleetData_single,
	SupportFleetData_single_nosynergy,
	SupportFleetData_single_climbling,
	SupportFleetData_annealing,
} from "./kc_support_fleet_data2.mjs";

export {
	SupportFleetData,
};


// SupportFleetData --------------------------------------------------------------------------------
Object.assign(SupportFleetData.prototype, {
	ssd_list         : null, // array of SupportShipData
	own_list         : null, // array of OwnEquipmentData
	
	set_own_data     : SupportFleetData_set_own_data,
	append_fleet     : SupportFleetData_append_fleet,
	save_to_form     : SupportFleetData_save_to_form,
	
	clone            : SupportFleetData_clone    ,
	move_from        : SupportFleetData_move_from,
	
	init_calcvars    : SupportFleetData_init_calcvars    ,
	countup_equipment: SupportFleetData_countup_equipment,
	clear_not_in_owns: SupportFleetData_clear_not_in_owns,
	clear_varslot    : SupportFleetData_clear_varslot    ,
	clear_varslot_all: SupportFleetData_clear_varslot_all,
	verify           : SupportFleetData_verify           ,
	get_own_map      : SupportFleetData_get_own_map      ,
	sort_equipment   : SupportFleetData_sort_equipment   ,
	allow_fixed_exslot: SupportFleetData_allow_fixed_exslot,
	priority_call    : SupportFleetData_priority_call,
	
	assert_count     : SupportFleetData_assert_count,
	get_own_list_text: SupportFleetData_get_own_list_text,
	get_text_diff    : SupportFleetData_get_text_diff,
	swap_slot        : SupportFleetData_swap_slot,
	
	// kancolle_support_data1.js
	fill             : SupportFleetData_fill,
	hill_climbling1  : SupportFleetData_hill_climbling1,
	single           : SupportFleetData_single,
	single_nosynergy : SupportFleetData_single_nosynergy,
	single_climbling : SupportFleetData_single_climbling,
	annealing        : SupportFleetData_annealing,
});


function SupportFleetData(){
	this.ssd_list = new Array;
	this.own_list = new Array;
}

function SupportFleetData_set_own_data(own_forms){
	this.own_list = own_forms.get_own_list();
	return this.own_list;
}

function SupportFleetData_append_fleet(fleet){
	// 艦情報
	let good = true;
	for (let sup of fleet.support_ships) {
		if (!sup.empty()) {
			let ssd = new SupportShipData;
			if (!sup.get_data(ssd)) {
				good = false;
				break;
			}
			this.ssd_list.push(ssd);
		}
	}
	return good;
}

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
	return fleet;
}

// データの移動
// src のデータは破棄されるものとする
function SupportFleetData_move_from(src){
	Object.assign(this, src);
}


// 計算用変数の初期化
// 現在装備されている数もカウントする
// own_list にないものは全て無視とする
function SupportFleetData_init_calcvars(){
	let own_map = new Object;
	
	for (let own of this.own_list) {
		own.remaining = own.remaining_max();
		own.fixed = 0;
		own_map[own.id] = own;
	}
	
	for (let ssd of this.ssd_list) {
		this.countup_equipment(ssd, own_map, false, 1);
	}
}


// 装備数をカウントして own_map に反映
// ignore_fixed: 固定を無視
// inc_dec: 1本あたりの変動量。remainingは減少。省略すると1。-1を指定することで減算できる
function SupportFleetData_countup_equipment(ssd, own_map, ignore_fixed, inc_dec){
	let val = inc_dec || 1;
	
	for (let i=0; i<ssd.allslot_equipment.length; i++) {
		let fixed = ssd.allslot_fixes[i];
		if (fixed && ignore_fixed) continue;
		
		let id = ssd.allslot_equipment[i].equipment_id;
		if (id) {
			let own = own_map[id];
			if (own) {
				own.remaining -= val;
				if (fixed) own.fixed += val;
			}
		}
	}
}

// own_listにない装備を全て解除する
// fixed: 固定も含め解除
function SupportFleetData_clear_not_in_owns(fixed){
	let own_map = this.get_own_map();
	
	for (let ssd of this.ssd_list) {
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			if (fixed || !ssd.allslot_fixes[i]) {
				let id = ssd.allslot_equipment[i].equipment_id;
				if (!own_map[id]) {
					ssd.allslot_equipment[i].set_equipment(0);
				}
			}
		}
	}
}

// 固定されていないスロットをクリア
// own_map(optional): map: id -> OwnEquipmentData
// own_map を指定するとそちらにも反映される
function SupportFleetData_clear_varslot(ssd, own_map){
	if (own_map) {
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			if (!ssd.allslot_fixes[i]) {
				let own = own_map[ssd.allslot_equipment[i].equipment_id];
				if (own) own.remaining++;
			}
		}
	}
	// 分割するとslotの重複に強くなる　固定との重複はないとする
	for (let i=0; i<ssd.allslot_equipment.length; i++) {
		if (!ssd.allslot_fixes[i]) {
			ssd.allslot_equipment[i].set_equipment(0);
		}
	}
}

// 全ての艦について、固定されていないスロットをクリア
function SupportFleetData_clear_varslot_all(own_map){
	for (let ssd of this.ssd_list) {
		this.clear_varslot(ssd, own_map);
	}
}


// 装備数データに矛盾がないかどうか
function SupportFleetData_verify(){
	for (let own of this.own_list) {
		if (own.remaining < 0) return false;
	}
	return true;
}

function SupportFleetData_get_own_map(){
	let map = new Object;
	for (let own of this.own_list) {
		map[own.id] = own;
	}
	return map;
}

// 装備を強い順に並び替える
function SupportFleetData_sort_equipment(){
	for (let ssd of this.ssd_list) {
		ssd.sort_equipment();
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
			
			let list = this.own_list.filter(x => x.remaining_max() > 0 && eqab[x.id]);
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
	
	// new_ssds の装備を全解除　元の装備情報は orig_ssds に
	this.clear_varslot_all(this.get_own_map());
	
	let uneq_ssds = this.ssd_list;
	let new_ssds = new Array;
	let do_equip = true;
	
	for (let p=1; p<=12; p++) {
		let own_map = this.get_own_map();
		let cur_ssds = new Array;
		
		for (let i=0; i<orig_ssds.length; i++) {
			if (orig_ssds[i].priority == p) {
				let ssd = uneq_ssds[i];
				
				if (do_equip) {
					// 装備可能かどうか
					this.countup_equipment(orig_ssds[i], own_map, true, 1);
					
					if (this.verify()) {
						// OK
						ssd = orig_ssds[i].clone();
						
					} else {
						// 足りません
						do_equip = false;
						this.countup_equipment(orig_ssds[i], own_map, true, -1);
					}
				}
				cur_ssds.push(ssd);
			}
		}
		
		if (cur_ssds.length == 0) continue;
		
		if (!do_equip) {
			// 装備ができなかった場合は全解除
			for (let ssd of cur_ssds) {
				this.clear_varslot(ssd, own_map);
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
			if (id) {
				support_use[id] = (support_use[id] || 0) + 1;
				if (ssd.allslot_fixes[i]) fixed[id] = (fixed[id] || 0) + 1;
			}
		}
	}
	
	for (let own of this.own_list) {
		let use = own.main_use + (support_use[own.id] || 0);
		let fix = fixed[own.id] || 0;
		
		// 不一致・矛盾
		if (own.remaining < 0) {
			console.log(own, own.remaining);
			throw "remaining < 0 at " + message;
		} else if (own.total != own.remaining + use) {
			console.log(own, own.total, own.remaining, use);
			throw "own.total != own.remaining + use at " + message;
		} else if (own.fixed != fix) {
			console.log(own, own.fixed, fix);
			throw "own.fixed != fix at " + message;
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


// ssd1 の pos1 番目の装備と ssd2 の pos2 番目の装備を入れ替える
// 入れ替えができたら true を返す
function SupportFleetData_swap_slot(ssd1, pos1, ssd2, pos2){
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


