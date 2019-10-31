/* SupportFleetData の探索関数群 */

import {SupportFleetScore, SupportShipScore} from "./kc_support_score.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {OwnEquipmentData} from "./kc_support_fleet.mjs";

export {
	SupportFleetData_fill,
	SupportFleetData_hill_climbling1,
	SupportFleetData_single,
	SupportFleetData_single_nosynergy,
	SupportFleetData_single_climbling,
	SupportFleetData_annealing,
};


// 空きスロットを適当な装備で埋める
// とりあえず貪欲に
function SupportFleetData_fill(){
	let ssds = this.ssd_list.concat();
	let owns = this.own_list.filter(x => x.remaining > 0);
	ssds.forEach(ssd => ssd.calc_bonus());
	
	for (let safety=0; safety<1000; safety++) {
		if (ssds.length == 0) break;
		
		// 次に装備を追加したい艦
		// スコアが最も低いものとする
		let min_ssd = ssds[0];
		let min_ssd_index = 0;
		let min_score = new SupportShipScore(ssds[0]);
		
		for (let i=1; i<ssds.length; i++) {
			let score = new SupportShipScore(ssds[i]);
			if (min_score.compare(score) > 0) {
				min_ssd = ssds[i];
				min_ssd_index = i;
				min_score = score;
			}
		}
		
		// 装備の追加
		let appended = false;
		
		for (let i=0; i<min_ssd.allslot_equipment.length; i++) {
			// 増設優先
			let p = i;
			if (min_ssd.exslot_available) {
				p--;
				if (p < 0) p += min_ssd.allslot_equipment.length;
			}
			if (min_ssd.allslot_fixes[p] || min_ssd.allslot_equipment[p].equipment_data) continue;
			
			// 追加するスロットと装備可能情報
			let slot = min_ssd.allslot_equipment[p];
			let eqab = min_ssd.allslot_equipables[p];
			
			// スコアが最も上がるものを選ぶ
			let max_own = null;
			let max_own_score = min_score;
			
			for (let own of owns) {
				if (own.remaining <= 0 || !eqab[own.id]) continue;
				
				slot.set_equipment(own.id);
				min_ssd.calc_bonus();
				
				let score = new SupportShipScore(min_ssd);
				if (max_own_score.compare(score) < 0) {
					max_own = own;
					max_own_score = score;
				}
			}
			slot.set_equipment(0);
			min_ssd.calc_bonus();
			
			// 追加
			if (max_own) {
				slot.set_equipment(max_own.id);
				max_own.remaining--;
				min_ssd.calc_bonus();
				
				// 1つ追加したらもう一度艦を選び直す
				appended = true;
				break;
			}
		}
		
		if (!appended) {
			// 装備可能なものがない
			// min_ssd を ssds からはずす
			ssds.splice(min_ssd_index, 1);
		}
	}
}

// 山登り法
// 近傍は入れ換え1回
function SupportFleetData_hill_climbling1(){
	this.fill();
	this.ssd_list.forEach(x => x.calc_bonus());
	
	let max_fleet = this.clone();
	let max_score = new SupportFleetScore(this.ssd_list);
	
	for (;;) {
		let ssds = this.ssd_list;
		let owns = this.own_list.filter(x => x.remaining > 0);
		let own_map = this.get_own_map();
		
		let found = false;
		let check_count = 0;
		let current_score = max_score.clone();
		
		for (let s1=0; s1<ssds.length; s1++) {
			let ssd1 = ssds[s1];
			current_score.sub(ssd1);
			
			for (let s2=s1+1; s2<ssds.length; s2++) {
				let ssd2 = ssds[s2];
				current_score.sub(ssd2);
				
				// ssd1 の装備と ssd2 の装備を一つ交換したものを検討
				// 合計命中値は変わらないため、ボーナス値が関係するもののみでよいはず
				for (let i=0; i<ssd1.allslot_equipment.length; i++) {
					let slot1 = ssd1.allslot_equipment[i];
					let concern1 = ssd2.equipment_bonus.bonus_concerns(slot1.equipment_id);
					
					for (let j=0; j<ssd2.allslot_equipment.length; j++) {
						let slot2 = ssd2.allslot_equipment[j];
						if (!concern1 && !ssd1.equipment_bonus.bonus_concerns(slot2.equipment_id)) continue;
						
						if (this.swap_slot(ssd1, i, ssd2, j)) {
							ssd1.calc_bonus();
							ssd2.calc_bonus();
							
							check_count++;
							let score = current_score.clone();
							score.add(ssd1);
							score.add(ssd2);
							
							if (max_score.compare(score) < 0) { // max_score < score
								max_fleet = this.clone();
								max_score = score;
								found = true;
							}
							this.swap_slot(ssd1, i, ssd2, j);
						}
					}
				}
				
				current_score.add(ssd2);
			}
			
			// ssd1 の装備と owns の装備を一つ交換したものを検討
			for (let i=0; i<ssd1.allslot_equipment.length; i++) {
				if (ssd1.allslot_fixes[i]) continue;
				
				let slot = ssd1.allslot_equipment[i];
				let eqab = ssd1.allslot_equipables[i];
				let old_id = slot.equipment_id;
				let old_data = slot.equipment_data;
				
				for (let own of owns) {
					if (!eqab[own.id]) continue;
					
					slot.set_equipment(own.id);
					ssd1.calc_bonus();
					
					check_count++;
					let score = current_score.clone();
					score.add(ssd1);
					
					if (max_score.compare(score) < 0) { // max_score < score
						// 個数
						own.remaining--;
						let exc = own_map[old_id];
						if (exc) exc.remaining++;
						
						max_fleet = this.clone();
						max_score = score;
						found = true;
						
						// 戻す
						own.remaining++;
						if (exc) exc.remaining--;
					}
				}
				
				// restore
				slot.set_equipment(old_id, old_data);
			}
			
			current_score.add(ssd1);
		}
		
		if (!found) break;
		
		this.move_from(max_fleet);
	}
}


// 1隻のみの場合の最適化をする
function SupportFleetData_single(ssd){
	let own_map = this.get_own_map();
	this.clear_varslot(ssd, own_map);
	
	// 装備ボーナス(シナジー)が存在
	let eqbonus = ssd.equipment_bonus;
	let owns_synergy = this.own_list.filter(x => x.remaining > 0 && !(!eqbonus.bonus_concerns(x.id) || eqbonus.bonus_independent(x.id)));
	owns_synergy.sort((a, b) => OwnEquipmentData.inc_greater(a, b, ssd) || OwnEquipmentData.power_greater(a, b, ssd.cv_shelling));
	
	let owns_synergy_main = owns_synergy.filter(x => eqbonus.bonus_synergy_main(x.id));
	let owns_synergy_sub  = owns_synergy.filter(x => !eqbonus.bonus_synergy_main(x.id));
	
	let empty_slot_count = ssd.allslot_fixes.reduce((acc, cur) => cur ? acc : acc + 1, 0);
	// 増設にシナジーはないと仮定する(速力はあるけど)
	if (ssd.exslot_available && !ssd.allslot_fixes[ssd.allslot_fixes.length - 1]) {
		empty_slot_count--;
	}
	
	let slots = new Array;
	let max_ssd = ssd.clone();
	let max_score = new SupportShipScore(ssd);
	let check_count = 0;
	let skip_count = 0;
	
	// mainについては全列挙
	let _main = (p) => {
		// mainを追加しないもの
		_sub(0, null);
		// p以降を一つ追加するもの
		let empty_count = empty_slot_count - slots.length;
		if (empty_count > 0) {
			for (let i=p; i<owns_synergy_main.length; i++) {
				let own = owns_synergy_main[i];
				if (own.remaining <= 0) continue;
				
				slots.push(new EquipmentSlot(own.id));
				own.remaining--;
				_main(p);
				slots.pop();
				own.remaining++;
			}
		}
	};
	
	// こちらも全列挙が基本だが
	// 完全上位互換があるならスキップできるはず
	// (=ボーナス値・sub素パラメータがどちらも上位)
	/* {
		bonus_firepower,
		bonus_torpedo,
		sub_firepower,
		sub_accuracy,
	} */
	let _sub = (p, arg_prev_data) => {
		let checked_data = new Array;
		let empty_count = empty_slot_count - slots.length;
		
		let prev_data = arg_prev_data;
		// subを追加しないもの
		if (!prev_data) {
			if (!_check(checked_data, null, 0, 0)) return;
			prev_data = checked_data.pop();
		}
		
		if (empty_count > 0) {
			// subを一つ追加したものを検討
			for (let i=p; i<owns_synergy_sub.length; i++) {
				let own = owns_synergy_sub[i];
				if (own.remaining <= 0) continue;
				
				let sl = new EquipmentSlot(own.id);
				let eq = sl.equipment_data;
				slots.push(sl);
				own.remaining--;
				
				let chk = _check(checked_data, prev_data, eq.firepower, eq.accuracy);
				if (!chk) skip_count++;
				if (chk && empty_count >= 2) _sub(p, checked_data[checked_data.length - 1]);
				
				slots.pop();
				own.remaining++;
			}
		}
	};
	
	let _check = (checked_data, prev_data, sub_firepower, sub_accuracy) => {
		// checked_dataに上位互換があれば検討せず false を返す
		// また、配置不可も false
		
		// slots は inc_greater
		let temp_ssd = ssd.clone(true);
		
		for (let r=0; r<slots.length; r++) {
			let slot = slots[slots.length - 1 - r];
			let equipped = false;
			
			for (let s=0; s<temp_ssd.allslot_equipment.length; s++) {
				let pos = temp_ssd.allslot_equipment.length - 1 - s;
				// 既に装備されている
				if (temp_ssd.allslot_fixes[pos]) continue;
				// pos の位置に装備できるか
				if (!temp_ssd.allslot_equipables[pos][slot.equipment_id]) continue;
				// OK
				temp_ssd.allslot_equipment[pos] = slot;
				temp_ssd.allslot_fixes[pos] = true;
				equipped = true;
				break;
			}
			
			if (!equipped) {
				return false;
			}
		}
		
		// 配置完了
		temp_ssd.calc_bonus();
		
		let bonus_fpw = temp_ssd.get_bonus_firepower();
		let bonus_tor = temp_ssd.get_bonus_torpedo();
		
		// prev_data から更にボーナスが増えていなければならない
		if ( prev_data &&
			prev_data.bonus_firepower >= bonus_fpw &&
			prev_data.bonus_torpedo >= bonus_tor )
		{
			return false;
		}
		
		// 完全上位互換があるか？
		for (let i=0; i<checked_data.length; i++) {
			if ( checked_data[i].bonus_firepower >= bonus_fpw &&
				checked_data[i].bonus_torpedo >= bonus_tor &&
				checked_data[i].sub_firepower >= sub_firepower &&
				checked_data[i].sub_accuracy  >= sub_accuracy )
			{
				return false;
			}
		}
		
		checked_data.push({
			bonus_firepower: bonus_fpw,
			bonus_torpedo  : bonus_tor,
			sub_firepower  : sub_firepower,
			sub_accuracy   : sub_accuracy,
		});
		
		// シナジーなしを検討
		this.single_nosynergy(temp_ssd, true);
		check_count++;
		
		let score = new SupportShipScore(temp_ssd);
		
		if (max_score.compare(score) < 0) {
			max_ssd = temp_ssd.clone();
			max_score = score;
		}
		
		this.clear_varslot(temp_ssd, own_map);
		return true;
	};
	
	_main(0);
	
	// 解をセット
	ssd.allslot_equipment = max_ssd.allslot_equipment;
	this.countup_equipment(ssd, own_map, true, 1);
}


// 1隻のみの場合の最適化だが、装備シナジーは固定以外考慮しない
// 装備ボーナス(累積可能)は考慮される
// allow_shared: スロットのオブジェクトを共有してもよい
function SupportFleetData_single_nosynergy(ssd, allow_shared){
	// 装備シナジーがなければ動的計画法でいける
	
	let own_map = this.get_own_map();
	this.clear_varslot(ssd, own_map);
	
	// 固定についてはボーナスが反映可能
	ssd.calc_bonus();
	
	let eqbonus = ssd.equipment_bonus;
	let owns = this.own_list.filter(x => x.remaining > 0);
	
	// owns のソート
	// 装備可能条件がだんだん狭くなっていくことを仮定する
	
	owns.sort((a, b) => OwnEquipmentData.inc_greater(a, b, ssd) || OwnEquipmentData.power_greater(a, b, ssd.cv_shelling));
	
	
	// owns をスロット化する
	let empty_slot_count = ssd.allslot_fixes.reduce((acc, cur) => cur ? acc : acc + 1, 0);
	let nsslots = new Array;
	
	for (let own of owns) {
		// 装備可能条件
		let equipable = false;
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			if (ssd.allslot_fixes[i]) continue;
			
			let eqab = ssd.allslot_equipables[i];
			if (eqab[own.id]) {
				equipable = true;
				break;
			}
		}
		if (!equipable) continue;
		
		let own_slot = new EquipmentSlot(own.id);
		let own_eq = own_slot.equipment_data;
		eqbonus.get_independent_bonus(own_slot);
		
		let own_eq_fpw = own_eq.firepower + own_slot.bonus_firepower;
		let own_eq_tor = own_eq.torpedo   + own_slot.bonus_torpedo;
		
		
		// 上位互換の数
		let upper_count = 0;
		for (let slot of nsslots) {
			let eq = slot.equipment_data;
			let eq_fpw = eq.firepower + slot.bonus_firepower;
			let eq_tor = eq.torpedo   + slot.bonus_torpedo;
			
			// ステータス
			if ( ( ssd.cv_shelling &&
				eq_fpw       >= own_eq_fpw &&
				eq_tor       >= own_eq_tor &&
				eq.bombing   >= own_eq.bombing &&
				eq.accuracy  >= own_eq.accuracy ) ||
				( !ssd.cv_shelling &&
				eq_fpw       >= own_eq_fpw &&
				eq.accuracy  >= own_eq.accuracy ) )
			{
				// かつ、装備可能条件も上位互換でなければならない
				let upper_equip = true;
				
				for (let i=0; i<ssd.allslot_equipment.length; i++) {
					if (ssd.allslot_fixes[i]) continue;
					
					let eqab = ssd.allslot_equipables[i];
					if (eqab[own.id] && !eqab[slot.equipment_id]) {
						upper_equip = false;
						break;
					}
				}
				
				if (upper_equip) upper_count++;
			}
		}
		
		let add_count = Math.min(own.remaining, empty_slot_count - upper_count);
		for (let i=0; i<add_count; i++) {
			nsslots.push(own_slot);
		}
	}
	
	let temp_ssd = ssd.clone();
	let blank_max = {
		slots: ssd.allslot_equipment.map(slot => slot.clone()),
		score: new SupportShipScore(temp_ssd, ssd.border_basic_power),
	};
	let nosynergy_memo = new Object;
	
	// nsslots[0 .. klim - 1] の装備のうち
	// 後ろからnスロット(固定含む)装備する場合の最大
	function _nosynergy_max(n, border_power, klim){
		let key = n + "|" + border_power + "|" + klim;
		
		if (nosynergy_memo.hasOwnProperty(key)) {
			return nosynergy_memo[key];
		}
		
		let max_data = {slots: blank_max.slots.concat(), score: blank_max.score};
		let max_k = -1;
		
		if (klim <= 0 || n <= 0) {
			//max_data = blank_max;
			//console.log("ん？");
			
		} else {
			// 装備位置
			let pos = ssd.allslot_equipment.length - n;
			let eqab = ssd.allslot_equipables[pos];
			
			if (ssd.allslot_fixes[pos]) {
				// 固定されている
				max_data = _nosynergy_max(n - 1, border_power, klim);
				
			} else if (n == 1) {
				let local_ssd = temp_ssd;
				local_ssd.allslot_equipment = blank_max.slots.concat();
				//max_data.slots = blank_max.slots.concat();
				
				let prev = null;
				for (let k=klim-1; k>=0; k--) {
					let k_slot = nsslots[k];
					if (!eqab[k_slot.equipment_id] || k_slot == prev) continue;
					
					local_ssd.allslot_equipment[pos] = k_slot;
					
					let score = new SupportShipScore(local_ssd, border_power);
					let c = max_data.score.compare(score);
					if (c <= 0) {
						max_data.slots[pos] = k_slot;
						max_data.score = score;
						max_k = k;
					}
					prev = k_slot;
				}
				
			} else {
				//let local_ssd = temp_ssd;
				
				// n >= 2 は再帰で実装
				// [k]を装備し、k+1以降は装備しない場合を考える
				// スロットごとに装備条件が違うのに気をつける
				let prev = null;
				for (let k=klim-1; k>=0; k--) {
					let k_slot = nsslots[k];
					if (!eqab[k_slot.equipment_id] || k_slot == prev) continue;
					
					let k_power_l = k_slot.get_power_min(temp_ssd.cv_shelling);
					let k_power_h = k_slot.get_power_max(temp_ssd.cv_shelling);
					
					for (let p=k_power_l; p<=k_power_h; p++) {
						let deg = _nosynergy_max(n - 1, border_power - p, k);
						let bak = deg.slots[pos];
						deg.slots[pos] = k_slot;
						temp_ssd.allslot_equipment = deg.slots;
						
						let score = new SupportShipScore(temp_ssd, border_power);
						let c = max_data.score.compare(score);
						if (c <= 0) {
							max_data.slots = deg.slots.concat();
							max_data.score = score;
							max_k = k;
						}
						deg.slots[pos] = bak;
					}
					prev = k_slot;
				}
			}
		}
		
		if (max_k >= 0) {
			let key_base = n + "|" + border_power + "|";
			for (let k=max_k+1; k<klim; k++) {
				//if (nsslots[k] != nsslots[k+1]) // ←微妙
				nosynergy_memo[key_base + k] = max_data;
			}
		}
		
		nosynergy_memo[key] = max_data;
		return max_data;
	}
	
	
	let nsmax = _nosynergy_max(ssd.allslot_equipment.length, ssd.border_basic_power, nsslots.length);
	
	// slotは高速化のために同オブジェクトが存在するので、通常はclone()が必要
	if (allow_shared) {
		ssd.allslot_equipment = nsmax.slots;
	} else {
		ssd.allslot_equipment = nsmax.slots.map(slot => slot.clone());
	}
	
	this.countup_equipment(ssd, own_map, true, 1);
}


// single() を使って山登りする
function SupportFleetData_single_climbling(seq = false){
	// 上から順番に
	if (seq) {
		let stable_count = 0;
		
		for (let i=0; i<100; i++) {
			let ssd = this.ssd_list[i % this.ssd_list.length];
			
			let before_score = new SupportShipScore(ssd);
			this.single(ssd);
			let after_score = new SupportShipScore(ssd);
			
			if (before_score.compare(after_score) < 0) {
				// 解が改善された
				stable_count = 0;
			} else {
				// 変わらなかった
				if (++stable_count >= this.ssd_list.length) break;
			}
		}
		
	} else {
		// 最もスコアが低いものから順番に
		let _score_less = (a, b) => {
			let ascore = new SupportShipScore(a);
			let bscore = new SupportShipScore(b);
			return ascore.compare(bscore);
		};
		
		let ssds = this.ssd_list.concat();
		ssds.sort(_score_less);
		
		let last_updated_ssd = null;
		let i = 0;
		
		while (i < ssds.length) {
			let updated = false;
			
			if (ssds[i] != last_updated_ssd) {
				let before_score = new SupportShipScore(ssds[i]);
				this.single(ssds[i]);
				let after_score = new SupportShipScore(ssds[i]);
				
				updated = before_score.compare(after_score) < 0;
			}
			
			if (updated) {
				// 解が改善されたのでやり直し
				last_updated_ssd = ssds[i];
				ssds.sort(_score_less);
				i = 0;
			} else {
				// 変わらなかった
				i++;
			}
		}
	}
}


// 焼きなまし法による解の探索
function SupportFleetData_annealing(){
	if (this.ssd_list.length == 0) return;
	
	this.fill();
	
	let own_map = this.get_own_map();
	this.ssd_list.forEach(ssd => ssd.calc_bonus());
	
	let max_fleet = this.clone();
	let max_score = new SupportFleetScore(this.ssd_list);
	
	let allow_fixed_exslot = this.allow_fixed_exslot();
	
	//console.log("begin", max_score);
	
	let ssd_list = this.ssd_list;
	let own_list = this.own_list.filter(x => x.remaining_max() > 0);
	let own_list_normal = own_list.concat();
	let own_list_cv = own_list.concat();
	// 先にソート
	own_list_normal.sort((a, b) => OwnEquipmentData.power_greater(a, b, false));
	own_list_cv.sort((a, b) => OwnEquipmentData.power_greater(a, b, true));
	
	// 各艦のslotを並べたもの
	// fixed は入れない
	let fleet_slots = new Array;
	let fleet_equipables = new Array;
	let fleet_ssds = new Array; // スロットに対応するssd
	let fleet_ssd_indices = new Array;
	let fleet_slot_own_lists = new Array;
	let fleet_slot_uppers = new Array;
	// [ssd_index] に、swap時に選択可能なスロット(他艦スロット)
	let fleet_swap_slots = new Array;
	let fleet_swap_equipables = new Array;
	let fleet_swap_ssds = new Array;
	let fleet_swap_ssd_indices = new Array;
	
	let db_map = EquipmentDatabase.equipment_data_map;
	
	for (let p=0; p<ssd_list.length; p++) {
		{
			let ssd = ssd_list[p];
			let list = ssd.cv_shelling ? own_list_cv : own_list_normal;
			
			for (let i=0; i<ssd.allslot_equipment.length; i++) {
				// 増設
				if (ssd.exslot_available && i == ssd.allslot_equipment.length - 1) {
					if (allow_fixed_exslot) continue;
				}
				
				if (!ssd.allslot_fixes[i]) {
					fleet_slots.push(ssd.allslot_equipment[i]);
					fleet_equipables.push(ssd.allslot_equipables[i]);
					fleet_ssds.push(ssd);
					fleet_ssd_indices.push(p);
					
					let eqab = ssd.allslot_equipables[i];
					// このスロットに対応する装備
					let slot_list = list.filter(x => eqab[x.id]);
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
					
					fleet_slot_own_lists.push(slot_list);
					fleet_slot_uppers.push(slot_uppers);
				}
			}
		}
		
		// ssd 以外のスロット
		let slots = new Array;
		let equipables = new Array;
		let ssds = new Array;
		let ssd_indices = new Array;
		
		for (let q=0; q<ssd_list.length; q++) {
			if (p == q) continue;
			
			let ssd2 = ssd_list[q];
			
			for (let i=0; i<ssd2.allslot_equipment.length; i++) {
				if (ssd2.exslot_available && i == ssd2.allslot_equipment.length - 1) {
					if (allow_fixed_exslot) continue;
				}
				
				if (!ssd2.allslot_fixes[i]) {
					slots.push(ssd2.allslot_equipment[i]);
					equipables.push(ssd2.allslot_equipables[i]);
					ssds.push(ssd2);
					ssd_indices.push(q);
				}
			}
		}
		
		fleet_swap_slots[p]       = slots;
		fleet_swap_equipables[p]  = equipables;
		fleet_swap_ssds[p]        = ssds;
		fleet_swap_ssd_indices[p] = ssd_indices;
	}
	
	// 装備可能なスロットがない(全て固定されている)
	if (fleet_slots.length == 0) return;
	
	
	// 設定など
	let swap_prob = 0.25;
	if (ssd_list.length == 1) swap_prob = 0;
	
	let retry_count = 0;
	let retry_max = 1;
	let loop_count_max = 1000000;
	let start_temperature = 5000;
	let end_temperature = 20;
	let phasechange_count = 400 * ssd_list.length / retry_max;
	let coefficient = 0.75;
	
	let loop_count = 0;
	let stag_count = 0;
	let newphase_count = 0;
	let temperature = start_temperature;
	
	let current_score = max_score.clone();
	//let renew_count_array = new Array;
	
	for (; loop_count<loop_count_max; loop_count++) {
		if (stag_count >= 0 && newphase_count >= phasechange_count) {
			temperature *= coefficient;
			if (temperature < end_temperature) {
				if (++retry_count < retry_max) {
					temperature = start_temperature;
				} else {
					break;
				}
			}
			stag_count = 0;
			newphase_count = 0;
		}
		
		let slot_index = Math.floor(Math.random() * fleet_slots.length);
		let slot = fleet_slots[slot_index];
		let eqab = fleet_equipables[slot_index];
		let ssd = fleet_ssds[slot_index];
		let ssd_index = fleet_ssd_indices[slot_index];
		
		if (Math.random() < swap_prob) {
			// 他の艦との入れ替え
			let swap_slots = fleet_swap_slots[ssd_index];
			let swap_eqabs = fleet_swap_equipables[ssd_index];
			let swap_ssds = fleet_swap_ssds[ssd_index];
			
			let swap_index = -1;
			let swap_slot = null;
			let sugg_count = 0;
			let swap_index2 = -1;
			let swap_slot2 = null;
			let sugg_count2 = 0;
			
			let ssd_bonus = ssd.equipment_bonus;
			let slot_eqid = slot.equipment_id;
			
			for (let i=0; i<swap_slots.length; i++) {
				let sugg_slot = swap_slots[i];
				let sugg_eqab = swap_eqabs[i];
				let sugg_eqid = sugg_slot.equipment_id;
				
				// 入れ替え可能
				if (sugg_eqid != slot_eqid && eqab[sugg_eqid] && sugg_eqab[slot_eqid]) {
					// さらにボーナスに関係のある装備だけでやってみる
					let swap_ssd_bonus = swap_ssds[i].equipment_bonus;
					if (ssd_bonus.bonus_concerns(sugg_eqid) || swap_ssd_bonus.bonus_concerns(slot_eqid)) {
						if (Math.random() * (++sugg_count) < 1) {
							swap_index = i;
							swap_slot = sugg_slot;
						}
					} else if (!swap_slot) {
						// ボーナスに関係のないスロットへの対応
						if (Math.random() * (++sugg_count2) < 1) {
							swap_index2 = i;
							swap_slot2 = sugg_slot;
						}
					}
				}
			}
			
			if (!swap_slot) {
				swap_index = swap_index2;
				swap_slot = swap_slot2;
			}
			
/*
			// 旧版　一様乱数
			swap_index = Math.floor(Math.random() * swap_slots.length);
			swap_slot = swap_slots[swap_index];
			let swap_eqab = fleet_swap_equipables[ssd_index][swap_index];
			if (!(eqab[swap_slot.equipment_id] && swap_eqab[slot.equipment_id] && swap_slot.equipment_id != slot.equipment_id)) {
				swap_slot = null;
			}
*/
			
			// 入れ替え可能か？
			if (swap_slot) {
				// 装備の入れ替え
				let swap_ssd = swap_ssds[swap_index];
				let score = current_score.clone();
				score.sub(ssd);
				score.sub(swap_ssd);
				
				slot.swap_equipment(swap_slot);
				ssd.calc_bonus();
				swap_ssd.calc_bonus();
				
				score.add(ssd);
				score.add(swap_ssd);
				
				let c = current_score.compare_annealing(score);
				let move = c < 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					current_score = score;
					
				} else {
					// 戻す
					slot.swap_equipment(swap_slot);
					ssd.calc_bonus();
					swap_ssd.calc_bonus();
				}
			}
			
		} else {
			// 装備されていないものとの入れ替え
			let list = fleet_slot_own_lists[slot_index];
			let swap_own = null;
			let swap_item_count = 0;
			let old_id = slot.equipment_id;
			
			let list_uppers = fleet_slot_uppers[slot_index];
			
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
				
				let score = current_score.clone();
				score.sub(ssd);
				
				// 装備をownに
				slot.set_equipment(swap_own.id);
				ssd.calc_bonus();
				
				score.add(ssd);
				
				let c = current_score.compare_annealing(score);
				let move = c < 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					own_map[old_id].remaining++;
					swap_own.remaining--;
					current_score = score;
					
				} else {
					// 戻す
					slot.set_equipment(old_id, old_data);
					ssd.calc_bonus();
				}
			}
		}
		
		
		// check
		if (max_score.compare(current_score) < 0) {
			max_fleet = this.clone();
			max_score = current_score;
			//renew_count_array.push(loop_count);
			stag_count = 0;
		} else {
			stag_count++;
		}
		newphase_count++;
	}
	
	//console.log("end", max_score, renew_count_array, loop_count);
	
	this.move_from(max_fleet);
}


