/* SupportFleetData の探索関数群2 */

import {
	SupportFleetScore,
	SupportShipScore,
	SupportFleetScorePrior,
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
	SupportFleetData_annealing_entire,
	SupportFleetData_annealing_entire_main,
};


// DEBUG: 初期状態をランダムにする
const SA_START_AT_RANDOM = false;
// 仕上げに山登り法を使う
const SA_HILL_CLIMBLING = true;


// 焼きなまし用
Object.assign(SASlotData.prototype, {
	// スロットの艦
	ssd: null,
	ssd_index: -1,
	csv_ship: null,
	group_id: 0,
	priority: 0,
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
	this.csv_ship = EquipmentDatabase.csv_shiplist.find(line => line.name == ssd.ship_name);
	this.group_id = SASlotData_get_group_id(this.csv_ship.shipTypeI || this.csv_ship.shipType);
	this.priority = ssd.priority;
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
		["軽巡洋艦", "重雷装巡洋艦", "練習巡洋艦", "軽(航空)巡洋艦", "防空巡洋艦", "兵装実験軽巡", "重改装軽巡洋艦", "重巡洋艦", "航空巡洋艦", "改装航空巡洋艦", "特殊改装航空巡洋艦"],
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
// iteration_scale: 反復回数を基準の何倍にするか
function SupportFleetData_annealing(iteration_scale = 1){
	if (this.ssd_list.length == 0) return;
	
	// 装備のリセット
	if (SA_START_AT_RANDOM) {
		this.countup_equipment(true, false, -1);
		this.clear_slots(true, false);
		this.random_fill();
	} else {
		this.fill();
	}

	this.ssd_list.forEach(ssd => ssd.calc_bonus());
	this.own_list.forEach(own => own.generate_rem_stars());
	
	// 非固定をカウントから外す
	// rem_stars は変わらないので、後で再びカウントする
	this.countup_equipment(true, false, -1);

	let ssd_list = this.ssd_list;
	let own_list = this.own_list.filter(x => x.get_total_count() - x.get_main_count() > 0);
	let own_list_normal = own_list.concat();
	let own_list_cv = own_list.concat();
	// 先にソート
	own_list_normal.sort((a, b) =>
		SupportShipData.power_compare(b.id, a.id, false) ||
		SupportShipData.accuracy_compare(b.id, a.id) ||
		SupportShipData.priority_compare(b.id, a.id) ||
		b.remaining - a.remaining
	);
	own_list_cv.sort((a, b) =>
		SupportShipData.power_compare(b.id, a.id, true) ||
		SupportShipData.accuracy_compare(b.id, a.id) ||
		SupportShipData.priority_compare(b.id, a.id) ||
		b.remaining - a.remaining
	);
	
	// 各艦のslotと、それに付随するデータ
	// fixed は入れない
	// SASlotData の配列
	let saslots = new Array;
	let db_map = EquipmentDatabase.equipment_data_map;
	let saslots_length = ssd_list.reduce((a, c) => a + c.allslot_fixes.reduce((a, c) => a + (c ? 0 : 1), 0), 0);
	
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
					if (ssd.is_upper_equipment(k_eq, n_eq, slot_list[k].star_min, slot_list[n].star_max)) {
						uppers.push(slot_list[k]);
					}
				}
				// 後方の場合、同値は含まないものとする
				for (let k=n+1; k<slot_list.length; k++) {
					let k_eq = db_map[slot_list[k].id];
					if ( ssd.is_upper_equipment(k_eq, n_eq, slot_list[k].star_min, slot_list[n].star_max)
						&& !ssd.is_upper_equipment(n_eq, k_eq, slot_list[n].star_min, slot_list[k].star_max) )
					{
						uppers.push(slot_list[k]);
					}
				}

				slot_uppers[n] = uppers;
			}
			
			// 上位互換がスロットの数以上存在すれば、その装備は使用しなくて良い
			// これで除外された装備を上位互換に持つ装備も常に除外である
			for (let n=0; n<slot_list.length; n++) {
				let count = slot_uppers[n].reduce((a, c) => a + c.remaining, 0);
				if (count >= saslots_length) {
					slot_list[n] = null;
					slot_uppers[n] = null;
				}
			}
			slot_list = slot_list.filter(x => x);
			slot_uppers = slot_uppers.filter(x => x);

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
			// 交換できる装備があるか
			let swappable = false;
			for (let k=0; k<sa.eqab_owns.length; k++) {
				if (saslots[j].eqab[sa.eqab_owns[k].id]) {
					swappable = true;
					break;
				}
			}
			if (!swappable) continue;

			// 増設は増設同士で
			if (sa.is_exslot == saslots[j].is_exslot) {
				sa.swap_saslots.push(saslots[j]);
			}
		}
	}

	// 戻す
	this.countup_equipment(true, false, 1);

	// 装備可能なスロットがない(全て固定されている)
	if (saslots.length == 0) return;
	
	
	// 設定など
	let swap_prob = 0.3;
	if (ssd_list.length == 1) swap_prob = 0;
	
	let retry_count = 0;
	let retry_max = 1;
	let start_temperature = 5000;
	let end_temperature = 1;

	// 反復回数固定で設定
	let expect_loop_count = 18000 * ssd_list.length * iteration_scale;
	let coefficient = 0.9;
	let max_step = Math.floor(Math.log(end_temperature / start_temperature) / Math.log(coefficient)) + 1;
	let phasechange_count = expect_loop_count / (max_step * retry_max);
	
	let newphase_count = 0;
	let move_count = 0;
	let temperature = start_temperature;
	
	let own_map = this.own_map;
	
	// スコアは使い回して、メモリ割り当てを少なくする
	let max_fleet = this.clone(false);
	const max_score = new SupportFleetScore(this.ssd_list, SupportFleetScore.MODE_VENEMY_DAMAGE);
	const current_score = max_score.clone();
	const temp_score = current_score.clone();
	
	for ( ; ; newphase_count++) {
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
				let score = temp_score;
				score.copy_from(current_score);
				
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
					current_score.copy_from(score);
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
				
				let score = temp_score;
				score.copy_from(current_score);
				
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
					if (old_id) {
						// 装備が空の場合がある
						own_map[old_id].insert_rem_star(old_star);
					}
					current_score.copy_from(score);
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
			max_fleet = this.clone(false);
			max_score.copy_from(current_score);
		}
	}
	
	max_fleet.generate_own_map();
	this.move_from(max_fleet);

	// 仕上げ
	if (SA_HILL_CLIMBLING) this.hill_climbling1("rigidly");

	// console.log(move_count * 100 / expect_loop_count, this.ssd_list[0].allslot_equipment.map(slot => slot?.equipment_data?.name ?? null))
}


// 優先度を考慮しつつ焼きなます
// iteration_scale: 反復回数を基準の何倍にするか
function SupportFleetData_annealing_entire(iteration_scale = 1){
	let priority_data = this.close_priority_gap();
	this.annealing_entire_main(iteration_scale, priority_data);
	this.restore_priority(priority_data);
}

// annealing_entire() の実体
// 優先度は連続であることを仮定する (close_priority_gap()/restore_priority()を使用)
// 再帰で実装したらなんか引っかかって遅くなるので呼び出し側で呼んでおくことにする
// ザ・ワールド！
function SupportFleetData_annealing_entire_main(iteration_scale, priority_data){
	if (this.ssd_list.length == 0) return;
	
	// 装備のリセット
	if (SA_START_AT_RANDOM) {
		this.countup_equipment(true, false, -1);
		this.clear_slots(true, false);
		this.random_fill();
	} else {
		this.fill();
	}

	this.ssd_list.forEach(ssd => ssd.calc_bonus());
	this.own_list.forEach(own => own.generate_rem_stars());
	
	this.countup_equipment(true, false, -1);

	let ssd_list = this.ssd_list;
	let own_list = this.own_list.filter(x => x.get_total_count() - x.get_main_count() > 0);
	let own_list_normal = own_list.concat();
	let own_list_cv = own_list.concat();
	// 先にソート
	own_list_normal.sort((a, b) =>
		SupportShipData.power_compare(b.id, a.id, false) ||
		SupportShipData.accuracy_compare(b.id, a.id) ||
		SupportShipData.priority_compare(b.id, a.id) ||
		b.remaining - a.remaining
	);
	own_list_cv.sort((a, b) =>
		SupportShipData.power_compare(b.id, a.id, true) ||
		SupportShipData.accuracy_compare(b.id, a.id) ||
		SupportShipData.priority_compare(b.id, a.id) ||
		b.remaining - a.remaining
	);
	
	// 各艦のslotと、それに付随するデータ
	// fixed は入れない
	// SASlotData の配列
	let saslots = new Array;
	let db_map = EquipmentDatabase.equipment_data_map;
	let saslots_length = ssd_list.reduce((a, c) => a + c.allslot_fixes.reduce((a, c) => a + (c ? 0 : 1), 0), 0);
	
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
					if (ssd.is_upper_equipment(k_eq, n_eq, slot_list[k].star_min, slot_list[n].star_max)) {
						uppers.push(slot_list[k]);
					}
				}
				// 後方の場合、同値は含まないものとする
				for (let k=n+1; k<slot_list.length; k++) {
					let k_eq = db_map[slot_list[k].id];
					if ( ssd.is_upper_equipment(k_eq, n_eq, slot_list[k].star_min, slot_list[n].star_max)
						&& !ssd.is_upper_equipment(n_eq, k_eq, slot_list[n].star_min, slot_list[k].star_max) )
					{
						uppers.push(slot_list[k]);
					}
				}

				slot_uppers[n] = uppers;
			}
			
			for (let n=0; n<slot_list.length; n++) {
				let count = slot_uppers[n].reduce((a, c) => a + c.remaining, 0);
				if (count >= saslots_length) {
					slot_list[n] = null;
					slot_uppers[n] = null;
				}
			}
			slot_list = slot_list.filter(x => x);
			slot_uppers = slot_uppers.filter(x => x);

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
			// 同優先度のみとする場合: いまいち
			// if (sa.priority != saslots[j].priority) continue;

			// 交換できる装備があるか
			let swappable = false;
			for (let k=0; k<sa.eqab_owns.length; k++) {
				if (saslots[j].eqab[sa.eqab_owns[k].id]) {
					swappable = true;
					break;
				}
			}
			if (!swappable) continue;

			// 増設は増設同士で
			if (sa.is_exslot == saslots[j].is_exslot) {
				sa.swap_saslots.push(saslots[j]);
			}
		}
	}

	// 戻す
	this.countup_equipment(true, false, 1);

	// 装備可能なスロットがない(全て固定されている)
	if (saslots.length == 0) return;
	
	
	// 設定など
	let swap_prob = 0.3;
	if (ssd_list.length == 1) swap_prob = 0;
	
	let retry_count = 0;
	let retry_max = 1;
	// let start_temperature = 5000;
	// let end_temperature = 1;

	let priority_counts = this.get_priority_counts();
	let score_length = priority_counts.length;
	let start_temperature = SupportFleetScorePrior.get_start_temperature(score_length);
	let end_temperature = SupportFleetScorePrior.get_end_temperature(score_length);

/* 
	// 重み (旧仕様)
	let weight = null;
	// weight = SupportFleetScorePrior.get_exp_weight_c(2, priority_counts);
	// weight = SupportFleetScorePrior.get_linear_weight_c(priority_counts);
	weight = SupportFleetScorePrior.get_linear_weight(priority_counts.length);
	
	if (weight) end_temperature *= weight[weight.length - 1];
 */
	
	// 反復回数固定で設定
	let expect_loop_count = 18000 * ssd_list.length * iteration_scale;
	let coefficient = 0.9;
	let max_step = Math.floor(Math.log(end_temperature / start_temperature) / Math.log(coefficient)) + 1;
	let phasechange_count = expect_loop_count / (max_step * retry_max);
	
	let newphase_count = 0;
	let move_count = 0;
	let temperature = start_temperature;
	
	let own_map = this.own_map;
	
	// スコアは使い回して、メモリ割り当てを少なくする
	// current_score と temp_score はループのはじめでは同じであるとする
	let max_fleet = this.clone(false);
	const max_score = new SupportFleetScorePrior(this.ssd_list, priority_data.length, SupportFleetScore.MODE_VENEMY_DAMAGE);
	const current_score = max_score.clone();
	const temp_score = current_score.clone();
	
	for ( ; ; newphase_count++) {
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
				let score = temp_score;
				
				score.sub(ssd);
				score.sub(swap_ssd);
				
				slot.swap_equipment(swap_sa.slot);
				ssd.calc_bonus();
				swap_ssd.calc_bonus();
				
				score.add(ssd);
				score.add(swap_ssd);
				
				let c = current_score.compare_annealing(score, score_length);
				let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					current_score.copy_from2(score, ssd.priority, swap_ssd.priority);
					move_count++;
					
				} else {
					// 戻す
					score.copy_from2(current_score, ssd.priority, swap_ssd.priority);
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
				
				let score = temp_score;
				
				score.sub(ssd);
				
				// 装備をownに
				let star = swap_own.rem_stars[swap_own.remaining - 1];
				slot.set_equipment(swap_own.id, swap_own.csv_data, star);
				ssd.calc_bonus();
				
				score.add(ssd);
				
				let c = current_score.compare_annealing(score, score_length);
				let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					swap_own.pop_rem_star();
					if (old_id) {
						// 装備が空の場合がある
						own_map[old_id].insert_rem_star(old_star);
					}
					current_score.copy_from2(score, ssd.priority);
					move_count++;
					
				} else {
					// 戻す
					score.copy_from2(current_score, ssd.priority);
					slot.set_equipment(old_id, old_data, old_star);
					ssd.calc_bonus();
				}
			}
		}
		
		
		// check
		let c = max_score.compare_s1s2s3(current_score);
		if (c < 0) {
			max_fleet = this.clone(false);
			max_score.copy_from(current_score);
		}
	}
	
	max_fleet.generate_own_map();
	this.move_from(max_fleet);

	// 仕上げ
	if (SA_HILL_CLIMBLING) this.hill_climbling1("entire");

	// console.log(move_count * 100 / expect_loop_count, weight, start_temperature, end_temperature);
}


