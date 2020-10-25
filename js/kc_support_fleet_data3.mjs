/* SupportFleetData の探索関数群2 */

import {
	SupportFleetScore,
	SupportShipScore,
} from "./kc_support_score.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {
	SupportShipData,
} from "./kc_support_ship.mjs";

export {
	SupportFleetData_annealing,
};


// 焼きなまし用
Object.assign(SASlotData.prototype, {
	// スロットの艦
	ssd: null,
	ssd_index: -1,
	csv_ship: null,
	group_id: 0,
	// 対象のスロット
	slot: null,
	slot_index: -1,
	
	eqab: null,
	is_exslot: false,
	is_fixed: false,
	
	// 以下はコンストラクターでセットされない
	// 装備可能なownのリスト
	eqab_owns: null, // array<OwnEquipmentData>
	upper_owns_array: null, // array<array<OwnEquipmentData> >, eqab_owns の要素に対応する上位装備
	
	// 交換可能なスロット
	swap_saslots: null, // array<SASlotData>
});

function SASlotData(ssd, ssd_index, slot_index){
	this.ssd = ssd;
	this.ssd_index = ssd_index;
	this.csv_ship = ssd.support_ship.ship_selector.get_ship();
	this.group_id = SASlotData_get_group_id(this.csv_ship.shipType);
	this.slot_index = slot_index;
	this.slot = ssd.allslot_equipment[slot_index];
	this.eqab = ssd.allslot_equipables[slot_index];
	this.is_exslot = ssd.exslot_available && slot_index == ssd.allslot_equipment.length - 1;
	this.is_fixed = ssd.allslot_fixes[slot_index];
}
// 同一グループの艦
function SASlotData_get_group_id(shipType){
	let defarray = [
		// 駆逐艦
		["駆逐艦"],
		// 軽巡・重巡・航巡
		["軽巡洋艦", "重雷装巡洋艦", "練習巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦", "兵装実験軽巡", "重巡洋艦", "航空巡洋艦"],
		// 空母
		["軽空母", "正規空母", "装甲空母", "夜間作戦航空母艦", "近代化航空母艦"],
	];
	
	for (let i=0; i<defarray.length; i++) {
		if (defarray[i].indexOf(shipType) >= 0) {
			return i + 1;
		}
	}
	return 0;
}


// 焼きなまし法による解の探索
function SupportFleetData_annealing(){
	if (this.ssd_list.length == 0) return;
	
	this.fill();
	
	let own_map = this.own_map;
	this.ssd_list.forEach(ssd => ssd.calc_bonus());
	this.own_list.forEach(own => own.generate_rem_stars());
	
	let max_fleet = this.clone();
	let max_score = new SupportFleetScore(this.ssd_list);
	
	let ssd_list = this.ssd_list;
	let own_list = this.own_list.filter(x => x.get_total_count() - x.get_main_count() > 0);
	let own_list_normal = own_list.concat();
	let own_list_cv = own_list.concat();
	// 先にソート
	own_list_normal.sort((a, b) => SupportShipData.power_compare(b.id, a.id, false));
	own_list_cv.sort((a, b) => SupportShipData.power_compare(b.id, a.id, true));
	
	// 各艦のslotと、それに付随するデータ
	// fixed は入れない
	// SASlotData の配列
	let saslots = new Array;
	let db_map = EquipmentDatabase.equipment_data_map;
	
	for (let p=0; p<ssd_list.length; p++) {
		let ssd = ssd_list[p];
		let list = ssd.cv_shelling ? own_list_cv : own_list_normal;
		
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			let sa = new SASlotData(ssd, p, i);
			
			// 固定は除外
			if (sa.is_fixed) continue;
			
			// このスロットに対応する装備
			let slot_list = list.filter(x => sa.eqab[x.id]);
			// 上位互換装備への参照
			let slot_uppers = new Array;
			
			for (let n=0; n<slot_list.length; n++) {
				let uppers = new Array;
				let n_eq = db_map[slot_list[n].id];
				
				for (let k=0; k<n; k++) {
					// [k] が [n] の上位なら追加
					let k_eq = db_map[slot_list[k].id];
					if (ssd.is_upper_equipment(k_eq, n_eq)) {
						uppers.push(slot_list[k]);
					}
				}
				slot_uppers[n] = uppers;
			}
			
			sa.eqab_owns = slot_list;
			sa.upper_owns_array = slot_uppers;
			
			saslots.push(sa);
		}
	}
	
	for (let i=0; i<saslots.length; i++) {
		let sa = saslots[i];
		sa.swap_saslots = new Array;
		
		// 交換可能なスロットをセット
		for (let j=0; j<saslots.length; j++) {
			if (j == i) continue;
			if (sa.ssd == saslots[j].ssd) continue;
			
/*
			// グループ分けモード
			// あまり成績がよくない
			if (sa.is_exslot) {
				if (saslots[j].is_exslot) {
					sa.swap_saslots.push(saslots[j]);
				}
			} else {
				if (!saslots[j].is_exslot && sa.group_id == saslots[j].group_id) {
					sa.swap_saslots.push(saslots[j]);
				}
			}
*/
			// 増設は増設同士で
			if (sa.is_exslot == saslots[j].is_exslot) {
				sa.swap_saslots.push(saslots[j]);
			}
		}
	}
	
	// 装備可能なスロットがない(全て固定されている)
	if (saslots.length == 0) return;
	
	
	// 設定など
	let swap_prob = 0.2;
	if (ssd_list.length == 1) swap_prob = 0;
	
	let retry_count = 0;
	let retry_max = 1;
	let loop_count_max = 1000000; // ストッパー
	let start_temperature = 5000;
	let end_temperature = 1;
/*
	//let phasechange_count = 500 * ssd_list.length / retry_max;
	//let coefficient = 0.75;
	let phasechange_count = 300 * ssd_list.length / retry_max;
	let coefficient = 0.85;
*/
	// 反復回数固定で設定
	let expect_loop_count = 18000 * ssd_list.length; // まだ成績が伸びる？
	let coefficient = 0.8;
	let max_step = Math.floor(Math.log(end_temperature / start_temperature) / Math.log(coefficient)) + 1;
	let phasechange_count = expect_loop_count / (max_step * retry_max);
	
	let loop_count = 0;
	let newphase_count = 0;
	let temperature = start_temperature;
	let move_count = 0;
	
	let current_score = max_score.clone();
	
	for (; loop_count<loop_count_max; loop_count++) {
		if (newphase_count >= phasechange_count) {
			temperature *= coefficient;
			if (temperature < end_temperature) {
				if (++retry_count < retry_max) {
					temperature = start_temperature;
				} else {
					break;
				}
			}
			newphase_count = 0;
		}
		
		let sa_index = Math.floor(Math.random() * saslots.length);
		let sa = saslots[sa_index];
		let slot = sa.slot;
		let eqab = sa.eqab;
		let ssd = sa.ssd;
		
		if (Math.random() < swap_prob) {
			// 他の艦との入れ替え
			let swap_saslots = sa.swap_saslots;
			
			let swap_sa = null;
			let sugg_count = 0;
			
			let slot_eqid = slot.equipment_id;
			let slot_star = slot.improvement;
			
			for (let i=0; i<swap_saslots.length; i++) {
				let sugg_sa = swap_saslots[i];
				let sugg_eqab = sugg_sa.eqab;
				let sugg_eqid = sugg_sa.slot.equipment_id;
				let sugg_star = sugg_sa.slot.improvement;
				
				// 入れ替え可能
				if ((sugg_eqid != slot_eqid || sugg_star != slot_star) && eqab[sugg_eqid] && sugg_eqab[slot_eqid]) {
					if (Math.random() * (++sugg_count) < 1) {
						swap_sa = sugg_sa;
					}
				}
			}
			
			// 入れ替え可能か？
			if (swap_sa) {
				// 装備の入れ替え
				let swap_ssd = swap_sa.ssd;
				let score = current_score.clone();
				score.sub(ssd);
				score.sub(swap_ssd);
				
				slot.swap_equipment(swap_sa.slot);
				ssd.calc_bonus();
				swap_ssd.calc_bonus();
				
				score.add(ssd);
				score.add(swap_ssd);
				
				let c = current_score.compare_annealing(score);
				let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					current_score = score;
					move_count++;
					
				} else {
					// 戻す
					slot.swap_equipment(swap_sa.slot);
					ssd.calc_bonus();
					swap_ssd.calc_bonus();
				}
			}
			
		} else {
			// 装備されていないものとの入れ替え
			let list = sa.eqab_owns;
			let swap_own = null;
			let swap_item_count = 0;
			let old_id = slot.equipment_id;
			
			let list_uppers = sa.upper_owns_array;
			
			UPPER:
			for (let i=0; i<list.length; i++) {
				let own = list[i];
				if (own.remaining <= 0 || own.id == old_id) continue;
				
				// list[i] の完全上位互換が list_uppers[i] (array)
				let uppers = list_uppers[i];
				for (let j=0; j<uppers.length; j++) {
					if (uppers[j].remaining > 0) continue UPPER;
				}
				
				// 1/n の確率で書き換えとすれば、要素数が分からなくてもランダムに抽出できる
				if (Math.random() * (++swap_item_count) < 1) {
					swap_own = own;
				}
			}
			
			if (swap_own) {
				let old_data = slot.equipment_data;
				let old_star = slot.improvement;
				
				let score = current_score.clone();
				score.sub(ssd);
				
				// 装備をownに
				let star = swap_own.rem_stars[swap_own.remaining - 1];
				slot.set_equipment(swap_own.id, swap_own.csv_data, star);
				ssd.calc_bonus();
				
				score.add(ssd);
				
				let c = current_score.compare_annealing(score);
				let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					swap_own.pop_rem_star();
					own_map[old_id].insert_rem_star(old_star);
					current_score = score;
					move_count++;
					
				} else {
					// 戻す
					slot.set_equipment(old_id, old_data, old_star);
					ssd.calc_bonus();
				}
			}
		}
		
		
		// check
		if (max_score.compare(current_score) < 0) {
			max_fleet = this.clone();
			max_score = current_score;
		}
		newphase_count++;
	}
	
	this.move_from(max_fleet);
}


