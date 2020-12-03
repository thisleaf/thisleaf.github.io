/* SupportFleetData の探索関数群 */

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
import {/*OwnEquipmentData*/} from "./kc_support_fleet.mjs";
import {
	SupportShipData,
} from "./kc_support_ship.mjs";

export {
	SupportFleetData_fill,
	SupportFleetData_hill_climbling1,
	SupportFleetData_single,
	SupportFleetData_single_nosynergy,
	SupportFleetData_single_nosynergy_pre,
	SupportFleetData_single_climbling,
	SupportFleetData_annealing_old,
};


// 空きスロットを適当な装備で埋める
// とりあえず貪欲に
function SupportFleetData_fill(){
	let ssds = this.ssd_list.concat();
	let owns = this.own_list.filter(x => x.remaining > 0);
	ssds.forEach(ssd => ssd.calc_bonus());
	owns.forEach(own => own.generate_rem_stars());
	
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
				
				slot.set_equipment(own.id, null, own.rem_stars[own.remaining - 1]);
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
				let star = max_own.rem_stars[max_own.remaining - 1];
				slot.set_equipment(max_own.id, null, star);
				max_own.rem_counts[star]--;
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
	this.own_list.forEach(x => x.generate_rem_stars());
	
	let max_fleet = this.clone();
	let max_score = new SupportFleetScore(this.ssd_list);
	
	for (;;) {
		let ssds = this.ssd_list;
		let owns = this.own_list.filter(x => x.remaining > 0);
		
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
						
						if (this.check_swappable(ssd1, i, ssd2, j)) {
							slot1.swap_equipment(slot2);
							
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
							
							slot1.swap_equipment(slot2);
						}
					}
				}
				
				// bonus値はいじったので、add前に再計算しなければならない
				ssd2.calc_bonus();
				current_score.add(ssd2);
			}
			
			
			// ssd1 の装備と owns の装備を一つ交換したものを検討
			for (let i=0; i<ssd1.allslot_equipment.length; i++) {
				if (ssd1.allslot_fixes[i]) continue;
				
				let slot = ssd1.allslot_equipment[i];
				let eqab = ssd1.allslot_equipables[i];
				let old_id = slot.equipment_id;
				let old_data = slot.equipment_data;
				let old_star = slot.improvement;
				
				for (let own of owns) {
					if (!eqab[own.id]) continue;
					
					let star = own.rem_stars[own.remaining - 1];
					// 同一装備の場合は星が大きいものを採用
					if (own.id == old_id && star <= old_star) continue;
					
					slot.set_equipment(own.id, null, star);
					ssd1.calc_bonus();
					
					check_count++;
					let score = current_score.clone();
					score.add(ssd1);
					
					if (max_score.compare(score) < 0) { // max_score < score
						let exc = old_id && this.own_map[old_id];
						
						// 個数
						own.remove_rem_star(star);
						if (exc) exc.insert_rem_star(old_star);
						
						max_fleet = this.clone();
						max_score = score;
						found = true;
						
						// 戻す
						own.insert_rem_star(star);
						if (exc) exc.remove_rem_star(old_star);
					}
				}
				
				// restore
				slot.set_equipment(old_id, old_data, old_star);
			}
			
			ssd1.calc_bonus();
			current_score.add(ssd1);
		}
		
		if (!found) break;
		
		this.move_from(max_fleet);
	}
}


// 1隻のみの場合の最適化をする
// ssd 以外の艦はそのまま
function SupportFleetData_single(ssd){
	this.countup_equipment_ssd(ssd, true, false, -1);
	this.clear_slots_ssd(ssd, true, false);
	
	let eqbonus = ssd.equipment_bonus;
	
	// 装備ボーナス(シナジー)が存在する装備
	// 装備シナジーとは、値が他スロットの装備によって変動するボーナスのこと
	// 個数によって変動するものも広義のシナジー装備とみなす
	// また、負の値となるシナジーはないものと仮定する(相殺で負数を定義してあるのはよい)
	let owns_synergy = this.own_list.filter(x => x.remaining > 0 && eqbonus.bonus_concerns(x.id) && !eqbonus.bonus_independent(x.id));
	owns_synergy.sort((a, b) =>
		ssd.eqab_compare(b.id, a.id, true, false) ||
		ssd.power_compare(b.id, a.id) ||
		ssd.accuracy_compare(b.id, a.id) ||
		ssd.priority_compare(b.id, a.id)
	);
	
	// mainにあってもsubの役割をする場合もある
	let owns_synergy_main = owns_synergy.filter(x => eqbonus.bonus_synergy_main(x.id));
	let owns_synergy_sub  = owns_synergy.filter(x => !eqbonus.bonus_synergy_main(x.id));
	
	// 空のスロットの情報を抽出 (いま固定以外を外しているので固定でないスロット)
	let empty_ex = ssd.exslot_available && !ssd.allslot_fixes[ssd.allslot_fixes.length - 1];
	let empty_slot_eqabs = ssd.allslot_equipables.filter((x, i) => !ssd.allslot_fixes[i]);
	
	let empty_slot_count = empty_slot_eqabs.length;
	let fixed_slot_count = ssd.allslot_fixes.length - empty_slot_count;
	
	//console.log("synergy", owns_synergy_main, owns_synergy_sub);
	
	/*
		シナジーのある装備について、利用する装備と数を仮定して
		残りはシナジーなしでの最大で埋める
		すべて列挙すればシナジーありでの最大が見つかる
	*/
	
	let fixed_slots = ssd.allslot_equipment.filter((s, i) => ssd.allslot_fixes[i]).map(s => s.clone());
	let select_slots = new Array;
	
	ssd.calc_bonus();
	let max_score = new SupportShipScore(ssd);
	let max_synfpw = ssd.allslot_equipment.reduce((a, c) => a + c.bonus_firepower, 0);
	let max_allslot_equipment = ssd.allslot_equipment.map(s => s.clone());
	
	let _calc_synfpw;
	let _main, _sub, _place_check, _ns_check;
	let ns_count = 0;
	
	// シナジー火力の計算　単体ボーナスは含まない
	// 固定されている装備は常に計算に入る
	_calc_synfpw = (slots) => {
		let all_slots = fixed_slots.length ? fixed_slots.concat(slots) : slots;
		eqbonus.get_bonus(all_slots, true);
		return all_slots.reduce((a, c) => a + c.bonus_firepower, 0);
	};
	
	// main の装備について、一つ以上追加したものを探索
	// 種類はそんなにないはずなので全列挙で対応
	// owns_synergy_main の [p] 以降
	// cur_synfpw: 現在のシナジーボーナス火力
	_main = (p, cur_synfpw) => {
		if (select_slots.length >= empty_slot_count) return;
		
		for (let i=p; i<owns_synergy_main.length; i++) {
			let own = owns_synergy_main[i];
			if (own.remaining <= 0) continue;
			
			let star = own.pop_star();
			select_slots.push(new EquipmentSlot(own.id, own.csv_data, star));
			
			if (_place_check()) {
				// mainのみでもシナジーボーナスが得られる場合がある
				let synfpw = _calc_synfpw(select_slots);
				// ボーナス値が増えたら確認
				if (synfpw > cur_synfpw) _ns_check(synfpw);
				
				if (select_slots.length < empty_slot_count) {
					// main装備を更に追加したもの
					_main(i, synfpw);
					// sub装備を追加したもの
					_sub(0, synfpw);
				}
			}
			
			select_slots.pop();
			own.insert_star(star);
		}
	};
	
	// sub を一つ以上追加したものを探索
	_sub = (p, cur_synfpw) => {
		if (select_slots.length >= empty_slot_count) return;
		
		let checked_slots = [];
		
		for (let i=p; i<owns_synergy_sub.length; i++) {
			let own = owns_synergy_sub[i];
			if (own.remaining <= 0) continue;
			
			let star = own.pop_star();
			let slot = new EquipmentSlot(own.id, own.csv_data, star);
			select_slots.push(slot);
			
			// own の上位互換が探索されていたらスキップできる
			// よって火力は降順で並び替えておくと高速
			// 上位互換 ⇔ 同一シナジーを与える(same_assist) && 装備可能スロットが上位(広い) && 素火力で上位互換
			// 装備範囲が違うのに同一シナジーとなるものはまずこないと思われるのでスキップ
			let upper_exists = false;
			
			for (let k=0; k<checked_slots.length; k++) {
				if ( eqbonus.same_assist(checked_slots[k].equipment_id, own.id) &&
					checked_slots[k].is_upper_or_equal_raw(slot, ssd.cv_shelling) )
				{
					upper_exists = true;
					break;
				}
			}
			
			if (!upper_exists && _place_check()) {
				let synfpw = _calc_synfpw(select_slots);
				let recursive = false;
				
				// ボーナス値が増えたら確認
				// 増えていない場合、3点シナジーに関する装備でなければならない
				if (synfpw > cur_synfpw) {
					_ns_check(synfpw);
					recursive = true;
				} else if (eqbonus.assist_3p_exists(own.id)) {
					recursive = true;
				}
				
				if (recursive && select_slots.length < empty_slot_count) {
					// sub装備を追加したもの
					_sub(i, synfpw);
				}
			}
			
			select_slots.pop();
			if (!upper_exists) checked_slots.push(slot);
			own.insert_star(star);
		}
	};
	
	// 現在選ばれている装備が ssd に配置可能かどうか
	_place_check = () => {
		let slots = select_slots.concat();
		// 昇順ソート
		// 後ろのほうが装備範囲が広いので、空きに順番に詰められれば配置可能
		slots.sort((a, b) => ssd.eqab_compare(a.equipment_id, b.equipment_id, true, false));
		
		let retval = false;
		let empty_normal = empty_slot_eqabs.length + (empty_ex ? -1 : 0);
		
		// まずないと思うが、増設を考慮
		// …と思ったら秋雲にC砲D砲と見張員のシナジーがが
		for (let i=0; i<slots.length+1; i++) {
			// 通常のスロットへの配置数
			let place_normal = slots.length + (i > 0 ? -1 : 0);
			if (place_normal > empty_normal) {
				if (i > 0) break;
				continue;
			}
			
			// slots[i-1]を増設へ　i == 0 のときは増設に入れない
			if (i > 0) {
				if (!empty_ex) break;
				let ex_eqab = empty_slot_eqabs[empty_slot_eqabs.length - 1];
				if (!ex_eqab[slots[i-1].equipment_id]) continue;
			}
			
			let placable = true;
			let s = 0;
			let e = 0;
			// slots[s] が配置できるかを確認
			for (; s<slots.length; s++) {
				if (s == i - 1) continue;
				
				if (!empty_slot_eqabs[e][slots[s].equipment_id]) {
					placable = false;
					break;
				}
				e++;
			}
			
			if (placable) {
				retval = true;
				break;
			}
		}
		return retval;
	};
	
	// 現在選ばれている装備を ssd に配置して残りをシナジーなしの最大で埋め、最大かチェック
	// _place_check() は通っているものとする
	_ns_check = (synfpw) => {
		let slots = select_slots.concat();
		// 昇順ソート
		slots.sort((a, b) => ssd.eqab_compare(a.equipment_id, b.equipment_id, true, false));
		
		let ex_pos = empty_ex ? ssd.allslot_equipment.length - 1 : -1;
		let last_pos = ssd.allslot_equipment.length - 1 + (ssd.exslot_available ? -1 : 0);
		let empty_normal = empty_slot_eqabs.length + (empty_ex ? -1 : 0);
		
		for (let i=0; i<slots.length+1; i++) {
			// 通常のスロットへの配置数
			let place_normal = slots.length + (i > 0 ? -1 : 0);
			if (place_normal > empty_normal) {
				if (i > 0) break;
				continue;
			}
			
			// 装備をセットした数
			let set_count = 0;
			
			// slots[i-1]を増設へ　i == 0 のときは増設に入れない
			if (i > 0) {
				if (!empty_ex) break;
				let ex_eqab = ssd.allslot_equipables[ex_pos];
				if (!ex_eqab[slots[i - 1].equipment_id]) continue;
				
				ssd.allslot_equipment[ex_pos].set_equipment_from(slots[i - 1]);
				set_count++;
			}
			
			// 配置チェックとは逆で、できる限り下のスロットに詰める
			// 任意の装備が上にスライド可能であることから、下に詰めればそれで全てのパターンを調べたことになる
			
			let s = slots.length - 1;
			let t = last_pos;
			
			for (; s>=0; s--) {
				// slots[s]を詰める
				if (s == i - 1) continue;
				
				while (t >= 0) {
					if ( ssd.allslot_equipment[t].equipment_id == 0 &&
						ssd.allslot_equipables[t][slots[s].equipment_id] )
					{
						ssd.allslot_equipment[t].set_equipment_from(slots[s]);
						set_count++;
						t--;
						break;
					} else {
						t--;
					}
				}
			}
			
			if (set_count == slots.length) {
				// しっかり装備をセットすることができた
				// シナジーなしをチェックする
				// 装備はslotsに追加された時点でカウントされている
				
				// 空の場所を記憶しておく
				let empty_positions = ssd.allslot_equipment.map(s => s.equipment_id == 0);
				// 現在の状態を固定
				let fixes = ssd.allslot_fixes;
				ssd.allslot_fixes = ssd.allslot_fixes.map((f, i) => f || !empty_positions[i]);
				
				ns_count++;
				this.single_nosynergy(ssd, false);
				ssd.calc_bonus();
				
				// 固定解除
				ssd.allslot_fixes = fixes;
				
				// 最大チェック
				// スコアが同じときはシナジーが大きい方を取る
				let score = new SupportShipScore(ssd);
				let c = max_score.compare(score);
				if (c == 0) c = max_synfpw - synfpw;
				
				if (c < 0) {
					max_score = score;
					max_synfpw = synfpw;
					max_allslot_equipment = ssd.allslot_equipment.map(s => s.clone());
				}
				
				// 装備解除
				// nosynergyで追加されたものだけ、select_slotsにあるものをカウントしてはいけない
				for (let pos=0; pos<empty_positions.length; pos++) {
					let slot = ssd.allslot_equipment[pos];
					if (empty_positions[pos] && slot.equipment_id != 0) {
						let own = this.own_map[slot.equipment_id];
						own.insert_star(slot.improvement);
						slot.set_equipment(0);
					}
				}
			}
			
			// 固定以外の装備は解除しておかなければならない
			this.clear_slots_ssd(ssd, true, false);
		}
	};
	
	
	// 探索
	let orig_synfpw = _calc_synfpw(select_slots);
	// シナジーなし(固定のみ)
	_ns_check(orig_synfpw);
	// 固定とのシナジー
	if (fixed_slot_count > 0) _sub(0, orig_synfpw);
	// mainとのシナジー
	_main(0, orig_synfpw);
	
	// 以上のいずれかで最大が見つかる
	
	// 解をセット　calc_bonus() は不要
	ssd.allslot_equipment = max_allslot_equipment;
	this.countup_equipment_ssd(ssd, true, false);
	
	// debug
	//console.log("nosynergy call:", ns_count);
	//this.assert_count("single check");
}



// 1隻のみの場合の最適化だが、装備シナジーは固定以外考慮しない
// 単純な装備ボーナス(累積可能)は考慮される
// allow_shared: スロットのオブジェクトを共有してもよい
function SupportFleetData_single_nosynergy(ssd, allow_shared = false){
	this.countup_equipment_ssd(ssd, true, false, -1);
	this.clear_slots_ssd(ssd, true, false);
	
	// 先に装備を決定してもよいスロットがあれば決定
	// そのスロットはこの関数中で固定として扱う
	this.single_nosynergy_pre(ssd);
	
	let orig_fixes = ssd.allslot_fixes;
	ssd.allslot_fixes = orig_fixes.concat();
	for (let i=0; i<ssd.allslot_fixes.length; i++) {
		if (!ssd.allslot_fixes[i] && ssd.allslot_equipment[i].equipment_id != 0) {
			ssd.allslot_fixes[i] = true;
		}
	}
	
	// 固定についてはボーナスが反映可能
	ssd.calc_bonus();
	
	let eqbonus = ssd.equipment_bonus;
	let owns = this.own_list.filter(own => {
		if (own.remaining <= 0) return false;
		
		// どれか一つに装備可能
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			if (ssd.allslot_fixes[i]) continue;
			
			let eqab = ssd.allslot_equipables[i];
			if (eqab[own.id]) return true;
		}
		return false;
	});
	
	if (owns.length == 0) return;
	
	owns.forEach(own => own.generate_rem_stars());
	
	// 特殊な増設スロット(非固定)を持つか
	// 増設があって、増設に入るが通常スロに入らない装備がある場合 true
	let irregular_exslot = ssd.has_irregular_exslot(owns.map(own => own.id));
	
	// owns のソート
	// 装備可能条件(装備可能なスロット)がだんだん狭くなっていくことを仮定する
	// ただし特殊な増設は除く
	owns.sort((a, b) =>
		ssd.eqab_compare(b.id, a.id, true, !irregular_exslot) ||
		ssd.power_compare(b.id, a.id) ||
		ssd.accuracy_compare(b.id, a.id) ||
		ssd.priority_compare(b.id, a.id)
	);
	
	// 空き数
	let empty_slot_count = ssd.allslot_fixes.reduce((acc, cur) => cur ? acc : acc + 1, 0);
	
	// スロット数
	// ただし、増設がメインに移動できるときは移動する
	let main_slot_count = ssd.slot_count;
	let ex_slot_count = ssd.exslot_available ? 1 : 0;
	
	if (ssd.exslot_available && !irregular_exslot) {
		// 通常の増設スロットは、通常スロットの一番下に追加したものとみなせる
		main_slot_count++;
		ex_slot_count--;
	}
	
	// 非固定のうち、最後のスロット
	let main_last_pos = main_slot_count - 1;
	for (; main_last_pos>=0; main_last_pos--) {
		if (!ssd.allslot_fixes[main_last_pos]) break;
	}
	
	// owns にある装備をスロット化する
	// こうすることで先にボーナスを計算しておいたりできる
	let nsslots = new Array;
	
	for (let index=0; index<owns.length; index++) {
		let own = owns[index];
		let prev_slot = null;
		
		for (let r=0; r<own.remaining; r++) {
			let star = own.rem_stars[own.remaining - 1 - r];
			let own_slot;
			
			if (prev_slot && prev_slot.improvement == star) {
				// 直前のものと同じ
				own_slot = prev_slot;
				
			} else {
				own_slot = new EquipmentSlot(own.id, own.csv_data, star);
				// 単体ボーナスのみ
				eqbonus.get_independent_bonus(own_slot);
			}
			
			// 上位互換の数
			let upper_count = 0;
			for (let s=0; s<nsslots.length; s++) {
				let slot = nsslots[s];
				
				// ステータス
				if (slot.is_upper_or_equal(own_slot, ssd.cv_shelling)) {
					// かつ、装備可能条件も上位互換でなければならない
					let upper_equip = true;
					
					// 特殊増設なしの場合は上位互換でソート済
					// 特殊増設持ちでも通常スロットについては上位互換でソートされている
					if (irregular_exslot) {
						let eqab = ssd.allslot_equipables[ssd.slot_count];
						if (eqab[own.id] && !eqab[slot.equipment_id]) {
							upper_equip = false;
						}
					}
/*
					for (let i=0; i<ssd.allslot_equipment.length; i++) {
						if (ssd.allslot_fixes[i]) continue;
						
						let eqab = ssd.allslot_equipables[i];
						if (eqab[own.id] && !eqab[slot.equipment_id]) {
							upper_equip = false;
							break;
						}
					}
*/
					if (upper_equip) {
						if (++upper_count >= empty_slot_count) break;
					}
				}
			}
			
			// 上位互換が空きの数だけあれば、この装備は追加しなくて良い
			if (upper_count < empty_slot_count) {
				nsslots.push(own_slot);
				prev_slot = own_slot;
			} else {
				break;
			}
		}
	}
	
	// nsslotsは後ろから検査されるので、後ろに強いものや艦載機などをおいておく
	nsslots.sort((a, b) => {
		let aid = a.equipment_id;
		let bid = b.equipment_id;
		let adata = a.equipment_data;
		let bdata = b.equipment_data;
		
		let c = ssd.eqab_compare(bid, aid, true, !irregular_exslot);
		if (c == 0 && ssd.cv_shelling) c = (adata.cv_attackable ? 1 : 0) - (bdata.cv_attackable ? 1 : 0);
		if (c == 0) c = ssd.power_compare(aid, bid);
		if (c == 0) c = ssd.accuracy_compare(aid, bid);
		if (c == 0) c = ssd.priority_compare(aid, bid);
		return c;
	});
	
	// 艦載機は全て nsslots の最後にあるか
	// よほど変な装備可能条件でないかぎり、空母系は大丈夫……だと思いたい
	let right_airplane = false;
	if (ssd.cv_shelling) {
		right_airplane = true
		for (let i=1; i<nsslots.length; i++) {
			if (nsslots[i-1].equipment_data.cv_attackable && !nsslots[i].equipment_data.cv_attackable) {
				right_airplane = false;
				break;
			}
		}
	}
	
	// 動的計画法で最適解を探索
	// シナジーがないならこれで行ける
	
	// 計算用のssd
	let temp_ssd = ssd.clone();
	
	// 無装備の場合のスロット・スコア
	// ボーダー火力がそれぞれの場所によって変わる
	let blank_data_slots = ssd.allslot_equipment.map(slot => slot.clone());
	temp_ssd.cv_force_attackable = false;
	let blank_data_score = new SupportShipScore(temp_ssd, ssd.border_basic_power);
	temp_ssd.cv_force_attackable = true;
	let blank_data_score_cva = new SupportShipScore(temp_ssd, ssd.border_basic_power);
	
	// nsslots の装備を一つだけ追加した場合のスコア
	// ただしボーダーは ssd.border_basic_power
	let single_scores = new Array;
	let single_scores_cva = new Array;
	let eqlen = ssd.allslot_equipment.length;
	for (let i=0; i<nsslots.length; i++) {
		temp_ssd.allslot_equipment[eqlen] = nsslots[i];
		temp_ssd.cv_force_attackable = false;
		single_scores[i] = new SupportShipScore(temp_ssd, ssd.border_basic_power);
		temp_ssd.cv_force_attackable = true;
		single_scores_cva[i] = new SupportShipScore(temp_ssd, ssd.border_basic_power);
	}
	
	// nsslots[0 .. klim - 1] の装備のうち
	// 後ろからxスロット(固定含む)装備する場合の最大
	// n: 通常スロット(固定含む)
	// n_ex: 増設スロット(固定含む)
	// cva: 空母はこれ以上艦載機を積まなくても攻撃可能
	let normal_check = 0;
	let ex_check = 0;
	let nosynergy_memo = new Object;
	
	// メモ化再帰する
	let _ns_max = (n, n_ex, cva, arg_border_power, klim) => {
		let border_power = arg_border_power > 0 ? arg_border_power : 0;
		// 数値かはあまり関係なさそう
		let key_base0 = n + "|" + n_ex + "|" + (+cva) + "|";
		let key = key_base0 + border_power + "|" + klim;
		if (nosynergy_memo[key]) return nosynergy_memo[key];
		
		// n や n_ex の位置に固定がある
		let n_pos = main_slot_count - n;
		if (n > 0 && ssd.allslot_fixes[n_pos]) {
			return _ns_max(n - 1, n_ex, cva, border_power, klim);
		}
		if (n_ex > 0 && ssd.allslot_fixes[main_slot_count]) {
			return _ns_max(n, 0, cva, border_power, klim);
		}
		
		
		// 最大のデータ
		// 初期値は無装備
		// border_diff >= 0 のぶんだけずれている、ただし0が最大
		let border_diff = ssd.border_basic_power - border_power;
		let max_score = (cva ? blank_data_score_cva : blank_data_score).clone();
		max_score.unreached_power = Math.min(max_score.unreached_power + border_diff, 0);
		
		let max_slots = blank_data_slots;
		let max_k = -1;
		let max_power = 0;
		
/*
		// check
		temp_ssd.allslot_equipment = blank_data_slots;
		temp_ssd.cv_force_attackable = cva;
		let comp = max_score.compare(new SupportShipScore(temp_ssd, border_power));
		if (comp != 0) debugger;
*/
		
		let lastone = (n_pos == main_last_pos && n_ex == 0) || (n + n_ex == 1);
		if (lastone) {
			// 残りスロットが1つだけ
			let pos = main_slot_count - n;
			let eqab = ssd.allslot_equipables[pos];
			let scores = cva ? single_scores_cva : single_scores;
			
			for (let k=klim-1; k>=0; k--) {
				if (!eqab[nsslots[k].equipment_id]) continue;
				
				// スコアは修正が必要
				let score = scores[k].clone();
				let upw = score.unreached_power;
				score.unreached_power = Math.min(score.unreached_power + border_diff, 0);
				
				let c = max_score.compare(score);
				if (c <= 0) {
					let slots = blank_data_slots.concat();
					slots[pos] = nsslots[k];
					
					max_slots = slots;
					max_score = score;
					max_k = k;
					max_power = upw + ssd.border_basic_power; // とみなしてよいはず
				}
			}
			
		} else {
			// 通常スロットへの装備を検討
			if (n > 0) {
				// 装備位置
				let pos = main_slot_count - n;
				let eqab = ssd.allslot_equipables[pos];
				
				// nを変数とする再帰で実装
				// [k]を装備し、k+1以降は装備しない場合を考える
				// スロットごとに装備条件が違うのに気をつける
				let prev = null;
				for (let k=klim-1; k>=0; k--) {
					let k_slot = nsslots[k];
					// 直前のものと同じならスキップできる(直前で装備した場合で探索済み)
					if (!eqab[k_slot.equipment_id] || k_slot == prev) continue;
					
					let k_cva = cva || k_slot.equipment_data.cv_attackable;
					// cva が false になるのは一番上を決めるときのみと仮定する
					// これは艦載機がすべて右にあるときのみ可能
					if (right_airplane && !cva && !k_cva) continue;
					
					// 空母の場合は伸びる火力に幅がある
					let k_power_l = k_slot.get_power_min(temp_ssd.cv_shelling);
					let k_power_h = k_slot.get_power_max(temp_ssd.cv_shelling);
					
					// 火力条件がゆるい方(再帰で得た解の火力が低い方)から
					for (let p=k_power_h; p>=k_power_l; p--) {
						let deg = _ns_max(n - 1, n_ex, k_cva, border_power - p, k);
						// 解を直接いじる：ポインターなのでもとに戻すまで注意
						let bak = deg[pos];
						deg[pos] = k_slot;
						temp_ssd.allslot_equipment = deg;
						temp_ssd.cv_force_attackable = k_cva;
						
						let score = new SupportShipScore(temp_ssd, border_power);
						let c = max_score.compare(score);
						if (c <= 0) { // max_k はなるべく小さい方がよい
							max_slots = deg.concat();
							max_score = score;
							max_k = k;
							max_power = temp_ssd.get_basic_power(true);
						}
						// 解の復元
						deg[pos] = bak;
						
						// 火力条件がゆるくても達成できたのなら十分
						if (score.unreached_power == 0) break;
					}
					prev = k_slot;
				}
				normal_check++;
			}
			
			// 増設への装備を検討
			if (n_ex > 0 && (!right_airplane || cva)) { // right_airplane のときは cva を要求する
				let pos = main_slot_count;
				let eqab = ssd.allslot_equipables[pos];
				
				// 通常スロットと同様
				let prev = null;
				for (let k=klim-1; k>=0; k--) {
					let k_slot = nsslots[k];
					if (!eqab[k_slot.equipment_id] || k_slot == prev) continue;
					
					let k_cva = cva || k_slot.equipment_data.cv_attackable;
					// 空母の場合は伸びる火力に幅がある
					// 増設の場合も同様(火力1.5倍)
					let k_power_l = k_slot.get_power_min(temp_ssd.cv_shelling);
					let k_power_h = k_slot.get_power_max(temp_ssd.cv_shelling);
					
					for (let p=k_power_h; p>=k_power_l; p--) {
						let deg = _ns_max(n, 0, k_cva, border_power - p, k);
						let bak = deg[pos];
						deg[pos] = k_slot;
						temp_ssd.allslot_equipment = deg;
						temp_ssd.cv_force_attackable = k_cva;
						
						let score = new SupportShipScore(temp_ssd, border_power);
						let c = max_score.compare(score);
						if (c <= 0) {
							max_slots = deg.concat();
							max_score = score;
							max_k = k;
							max_power = temp_ssd.get_basic_power(true);
						}
						deg[pos] = bak;
						if (score.unreached_power == 0) break;
					}
					prev = k_slot;
				}
				ex_check++;
			}
		}
		
		
		let range = Math.max(max_power - border_power, 0);
		
		// border_power: [border_power .. border_power + range] まで同じ
		for (let r=0; r<=range; r++) {
			let bp = border_power + r;
			// nsslots[max_k] を装備、その右は装備しないものが最大
			// この辺も解は同じなのでメモしておく
			for (let k=max_k+1; k<=klim; k++) {
				nosynergy_memo[key_base0 + bp + "|" + k] = max_slots;
			}
		}
		
		return max_slots;
	}
	
	if (nsslots.length > 65535) debugger;
	let border_power = Math.min(ssd.border_basic_power, 65535);
	let cv_attackable = ssd.cv_shelling && ssd.allslot_equipment.reduce((a, c) => a || (Boolean(c.equipment_data) && c.equipment_data.cv_attackable), false);
	
	let nsmax = _ns_max(main_slot_count, ex_slot_count, cv_attackable, border_power, nsslots.length);
	
	// slotは高速化のために同オブジェクトが存在するので、通常はclone()が必要
	if (allow_shared) {
		ssd.allslot_equipment = nsmax;
	} else {
		ssd.allslot_equipment = nsmax.map(slot => slot.clone());
	}
	
	//console.log(normal_check, ex_check, nsslots.length);
	this.countup_equipment_ssd(ssd, true, false);
	ssd.allslot_fixes = orig_fixes;
	// rem_stars は放置
	// calc_bonus() で結果が変わる可能性もある(シナジー装備)
}


// あらかじめ固定して探索しても大丈夫なものを決める (single_nosynergy用)
function SupportFleetData_single_nosynergy_pre(ssd){
	// 装備が決定できる条件：装備をAとするとき
	// 1. そのスロットに装備できる装備のうち、Aが最大であること
	// 2. 他の空きスロットのうち、Aが装備できるスロットに対して
	//    Aの上位互換が他の空きスロット数以上あること
	//    (Aが装備可能な他の空きスロット数ではだめ)
	
	let eqbonus = ssd.equipment_bonus;
	let owns = this.own_list.filter(own => {
		if (own.remaining <= 0) return false;
		
		// どれか一つに装備可能
		for (let i=0; i<ssd.allslot_equipment.length; i++) {
			if (ssd.allslot_fixes[i]) continue;
			
			let eqab = ssd.allslot_equipables[i];
			if (eqab[own.id]) return true;
		}
		return false;
	});
	if (owns.length == 0) return;
	
	owns.forEach(own => own.generate_rem_stars());
	// 降順
	owns.sort((a, b) =>
		ssd.power_compare(b.id, a.id) ||
		ssd.accuracy_compare(b.id, a.id) ||
		ssd.priority_compare(b.id, a.id)
	);
	
	let slot_count = ssd.allslot_equipment.length;
	for (let pos=slot_count-1; pos>=0; pos--) {
		if (ssd.allslot_fixes[pos] || ssd.allslot_equipment[pos].equipment_id != 0) {
			continue;
		}
		
		// pos番目のスロットについて
		let slot = ssd.allslot_equipment[pos];
		let eqab = ssd.allslot_equipables[pos];
		let pos_owns = owns.filter(own => eqab[own.id] && own.remaining > 0);
		if (pos_owns.length == 0) continue;
		
		// 最大が存在するか
		// 最大と同値なものが存在しても、片方のみが決定可能であるパターンはないと仮定する
		let pos_max_slot = new EquipmentSlot(pos_owns[0].id, null, pos_owns[0].rem_stars[pos_owns[0].remaining - 1]);
		eqbonus.get_independent_bonus(pos_max_slot);
		
		for (let i=1; i<pos_owns.length; i++) {
			let own = pos_owns[i];
			let own_slot = new EquipmentSlot(own.id, null, own.rem_stars[own.remaining - 1]);
			eqbonus.get_independent_bonus(own_slot);
			
			if (pos_max_slot.is_upper_or_equal(own_slot, ssd.cv_shelling)) {
				// pos_max_slot >= own_slot
				// 次
			} else if (own_slot.is_upper_or_equal(pos_max_slot, ssd.cv_shelling)) {
				// own_slot >= pos_max_slot
				pos_max_slot = own_slot;
				
			} else {
				// どちらでもない -> 最大は存在しない
				pos_max_slot = null;
				break;
			}
		}
		// 最大がなかった
		if (!pos_max_slot) continue;
		
		let border_count = ssd.allslot_equipment.reduce((a, c, i) => {
			// 空のスロット
			// 「pos_max_slotが装備可能」をつけると、上位互換にも制約がついてしまう
			//return (c.equipment_id == 0 && ssd.allslot_equipables[i][pos_max_slot.equipment_id]) ? a + 1 : a;
			return (c.equipment_id == 0) ? a + 1 : a;
		}, -1);
		
		let good = true;
		for (let i=0; i<slot_count; i++) {
			let i_eqab = ssd.allslot_equipables[i];
			// pos_max_slot の上位互換はいくつ装備できるか
			// border_count個以上装備できればOK
			let i_owns = owns.filter(own => i_eqab[own.id] && own.remaining > 0);
			
			let upper_count = 0;
			let temp_slot = new EquipmentSlot();
			for (let k=0; k<i_owns.length; k++) {
				let own = i_owns[k];
				let rem = own.remaining;
				if (own.id == pos_max_slot.equipment_id) rem--;
				
				for (; rem>0; rem--) {
					let star = own.rem_stars[rem];
					temp_slot.set_equipment(own.id, own.csv_data, star);
					eqbonus.get_independent_bonus(temp_slot);
					
					if (temp_slot.is_upper_or_equal(pos_max_slot)) upper_count++;
				}
				if (upper_count >= border_count) break;
			}
			
			if (upper_count < border_count) {
				good = false;
				break;
			}
		}
		
		if (good) {
			// この装備をスロットに入れてもよい
			ssd.allslot_equipment[pos] = pos_max_slot;
			// カウント
			let own = this.own_map[pos_max_slot.equipment_id];
			let p = pos_max_slot.improvement;
			own.rem_counts[p]--;
			own.remaining--;
			
			pos = slot_count;
		}
	}
}


// single() を使って山登りする
// seq: 上から順番に
// light_mode: 解が改善された場合でも最初からやりなおさない
function SupportFleetData_single_climbling(seq = false, light_mode = false){
	// 上から順番に
	if (seq) {
		let stable_count = 0;
		
		for (let i=0; i<100; i++) {
			let ssd = this.ssd_list[i % this.ssd_list.length];
			
			let before_score = new SupportShipScore(ssd);
			this.single(ssd);
			let after_score = new SupportShipScore(ssd);
			
			if (before_score.compare(after_score) < 0 && !light_mode) {
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
			
			if (updated && !light_mode) {
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



// 焼きなまし法による解の探索 (旧式)
function SupportFleetData_annealing_old(){
	if (this.ssd_list.length == 0) return;
	
	this.fill();
	
	let own_map = this.own_map;
	this.ssd_list.forEach(ssd => ssd.calc_bonus());
	this.own_list.forEach(own => own.generate_rem_stars());
	
	let max_fleet = this.clone();
	let max_score = new SupportFleetScore(this.ssd_list);
	
	let allow_fixed_exslot = this.allow_fixed_exslot();
	
	//console.log("begin", max_score);
	
	let ssd_list = this.ssd_list;
	//let own_list = this.own_list.filter(x => x.remaining_max() > 0);
	let own_list = this.own_list.filter(x => x.get_total_count() - x.get_main_count() > 0);
	let own_list_normal = own_list.concat();
	let own_list_cv = own_list.concat();
	// 先にソート
	//own_list_normal.sort((a, b) => OwnEquipmentData.power_greater(a, b, false));
	//own_list_cv.sort((a, b) => OwnEquipmentData.power_greater(a, b, true));
	own_list_normal.sort((a, b) => SupportShipData.power_compare(b.id, a.id, false));
	own_list_cv.sort((a, b) => SupportShipData.power_compare(b.id, a.id, true));
	
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
	let move_count = 0;
	
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
				let old_star = slot.improvement;
				
				let score = current_score.clone();
				score.sub(ssd);
				
				// 装備をownに
				let star = swap_own.pop_rem_star();
				slot.set_equipment(swap_own.id, swap_own.csv_data, star);
				ssd.calc_bonus();
				
				score.add(ssd);
				
				let c = current_score.compare_annealing(score);
				let move = c < 0 || Math.random() < Math.exp(- c / temperature);
				
				if (move) {
					// 移動
					own_map[old_id].insert_rem_star(old_star);
					//own_map[old_id].remaining++;
					//swap_own.remaining--;
					current_score = score;
					move_count++;
					
				} else {
					// 戻す
					swap_own.insert_rem_star(star);
					slot.set_equipment(old_id, old_data, old_star);
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
	
	//console.log("end", max_score, /*renew_count_array,*/ loop_count, move_count);
	
	this.move_from(max_fleet);
}


