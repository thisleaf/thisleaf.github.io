/* SupportFleetData の探索関数群2 */

import * as Util from "./utility.mjs";
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
	SupportFleetData_calculate_common,
	SupportFleetData_annealing,
	SupportFleetData_annealing_entire,
	SupportFleetData_annealing_entire_main,
};


// DEBUG: 初期状態をランダムにする
const SA_START_AT_RANDOM = false;
// 仕上げに山登り法を使う
const SA_HILL_CLIMBLING = true;
// 除外
const SA_LIGHT_EXCLUSION = true;
const SA_NORMAL_EXCLUSION = true;
const SA_EXACT_EXCLUSION = true;


/**
 * スロットデータ
 */
class SASlotData {
	constructor(ssd, ssd_index, slot_index) {
		// スロットの艦
		this.ssd = ssd;
		this.ssd_index = ssd_index;
		this.csv_ship = EquipmentDatabase.csv_shiplist.find(line => line.name == ssd.ship_name);
		this.priority = ssd.priority;
		// 対象のスロット
		this.slot_index = slot_index;
		this.slot = ssd.allslot_equipment[slot_index];
		this.eqab = ssd.allslot_equipables[slot_index];
		this.eqab2 = Object.assign({}, this.eqab, {"0": 1}); // "装備なし" も "装備可"
		this.is_exslot = ssd.exslot_available && slot_index == ssd.allslot_equipment.length - 1;
		this.is_fixed = ssd.allslot_fixes[slot_index];
		/**
		 * 装備可能なownのリスト
		 * @type {OwnEquipmentData[]}
		 */
		this.eqab_owns = null;
		/**
		 * eqab_owns の要素に対応する上位装備
		 * @type {OwnEquipmentData[][]}
		 */
		this.upper_owns_array = null;
		/**
		 * 交換可能なスロット
		 * @type {SASlotData[]}
		 */
		this.swap_saslots = null;
		/**
		 * このスロットには必ず装備を入れるものと仮定してよいかどうか
		 * eqab_owns で除外したものがあったり、装備可能なスロットを埋め尽くす装備があったりする場合
		 * @type {boolean}
		 */
		this.flood = false;
	}
};

/**
 * 共通部分で計算したデータ
 */
class SearchCommonData {
	/**
	 * スロットデータ
	 * @type {SASlotData[]}
	 */
	saslots;
	/**
	 * 決定済スロットデータ
	 * @type {SASlotData[]}
	 */
	saslots_resolved;
};


/**
 * 次の条件を満たす owns の部分集合 S が存在するかを調べる:
 * Sの装備可能範囲の和集合を、Sの装備で全て埋め尽くす
 * @param {OwnEquipmentData[]} owns
 * @param {Object.<number, {pos: number[], id: number, order: number}>} range_map idから装備範囲を与えるmap
 * @returns {boolean}
 */
function is_fillable_owns(owns, range_map){
	let coverings = [];
	let cov_count = 0;

	// 装備範囲が同じ装備ごとに見て除外可能
	let fillable = owns.some(u => {
		let range = range_map[u.id];
		let cov = coverings[range.order];
		if (!cov) {
			cov = {pos: range.pos, remaining: u.remaining};
			coverings[range.order] = cov;
			cov_count++;
		} else {
			cov.remaining += u.remaining;
		}
		return cov.pos.length <= cov.remaining;
	});

	// もっと精密なもの
	if (SA_EXACT_EXCLUSION && !fillable && cov_count >= 2) {
		// 間をつめる
		let count = 0;
		coverings.forEach(cov => coverings[count++] = cov);
		coverings.length = count;

		fillable = has_fillable_set(coverings);
	}

	return fillable;
}

/**
 * coverings からいくつかの元を選び、それらを全て関連する装備で埋められるかどうかを判定
 * pos が装備位置の配列(昇順にソート済)、remaining が装備の数
 * @param {Array.<{pos: number[], remaining: number}>} coverings 
 * @return {boolean}
 */
function has_fillable_set(coverings){
	let unions = [];

	for (let c=0; c<coverings.length; c++) {
		// coverings[c] を合成
		let cov = coverings[c];
		let cov_equal = false;
		let cpos = cov.pos;
		let ulen = unions.length;

		for (let k=0; k<ulen; k++) {
			let uk = unions[k];
			let kpos = uk.pos;
			// ckpos = cpos∪kpos
			let ckpos = Util.unique_merge_array(cpos, kpos);
			// cpos⊂kpos
			if (ckpos.length == kpos.length) {
				// cpos == kpos
				if (ckpos.length == cpos.length) cov_equal = true;

				uk.remaining += cov.remaining;
				if (uk.remaining >= kpos.length) {
					return true;
				}
			} else {
				// 新しく追加
				let rem = cov.remaining + uk.remaining;
				if (rem >= ckpos.length) {
					return true;
				}
				unions.push({pos: ckpos, remaining: rem});
			}
		}
		if (!cov_equal) unions.push(cov);

		// 追加ぶんの重複除去
		// 最後のループはチェック不要
		if (unions.length > ulen && c < coverings.length - 1) {
			unions.sort((a, b) => b.pos.length - a.pos.length || Util.compare_array(a.pos, b.pos));
			Util.unique_array(unions, (prev, cur) => {
				if (Util.equal_array(prev.pos, cur.pos)) {
					// 集合が同じなら remaining が大きい方を残せばよい
					if (prev.remaining < cur.remaining) prev.remaining = cur.remaining;
					return 0;
				}
				return -1;
			});
		}
	}

	return false;
}

/**
 * 探索前の共通部分
 * 交換可能スロット、装備の除外など
 * rem_stars も生成する
 * @param {string} type 
 * @returns {SearchCommonData}
 */
function SupportFleetData_calculate_common(type){
	// 設定
	// 決定可能なスロットを saslots_resolved に移動して、装備も変更する
	let separate_resolved = true;

	let common = new SearchCommonData();

	// 非固定をカウントから外す
	this.countup_equipment(true, false, -1);

	let ssd_list = this.ssd_list;
	let own_list_normal = this.own_list.filter(x => x.remaining > 0);
	let own_list_cv = own_list_normal.concat();
	// 先にソート
	// 強いものがだいたい前の方に来るように
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
	/** @type {SASlotData[]} */
	let saslots = new Array;
	const db_map = EquipmentDatabase.equipment_data_map;
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
			
			// 軽めの除外
			// 上位互換がスロットの数以上存在すれば、その装備は使用しなくて良い
			// これで除外された装備を上位互換に持つ装備も常に除外である
			if (SA_LIGHT_EXCLUSION) {
				for (let n=0; n<slot_list.length; n++) {
					let count = slot_uppers[n].reduce((a, c) => a + c.remaining, 0);
					if (count >= saslots_length) {
						slot_list[n] = null;
						slot_uppers[n] = null;
						sa.flood = true;
					}
				}
				slot_list = slot_list.filter(x => x);
				slot_uppers = slot_uppers.filter(x => x);
			}

			sa.eqab_owns = slot_list;
			sa.upper_owns_array = slot_uppers;
			
			saslots.push(sa);
		}
	}

	// 同等のスロットは除外処理の結果も同じなのでまとめる
	/** @type {SASlotData[][]} */
	let equivalents = [];
	EQSLOT:
	for (let i=0; i<saslots.length; i++) {
		let sa = saslots[i];
		for (let j=0; j<equivalents.length; j++) {
			let slots = equivalents[equivalents.length - 1 - j];
			let rep = slots[0];
			if ( Util.equal_array(rep.eqab_owns, sa.eqab_owns) &&
				Util.equal_array(rep.upper_owns_array, sa.upper_owns_array, Util.equal_array_int) )
			{
				slots.push(sa);
				continue EQSLOT;
			}
		}
		equivalents.push([sa]);
	}

	// 除外その2
	// 装備可能範囲を考慮する
	// これを上位互換にもつもののみをチェック(null:全て)
	/** @type {?Object.<number, boolean>} */
	let check_id_map = null;
	let total_removed_count = 0;
	let removed_count = 0;

	if (SA_NORMAL_EXCLUSION)
	do {
		removed_count = 0;

		/** @type {Object.<number, {pos: number[], id: number, order: number}>} */
		let range_map = {};
		/** @type {Array.<{pos: number[], id: number, order: number}>} */
		let range_arr = [];
		/** @type {Object.<number, boolean>} */
		let removed_id_map = {};

		// 装備位置リストアップ
		for (let i=0; i<saslots.length; i++) {
			let sa = saslots[i];
			let list = sa.eqab_owns;
			for (let j=0; j<list.length; j++) {
				let e = range_map[list[j].id];
				if (!e) {
					e = {pos: [i], id: list[j].id};
					range_map[list[j].id] = e;
					range_arr.push(e);
				} else {
					e.pos.push(i);
				}
			}
		}
		// 同装備範囲を持つものを結合
		// 集合は大きいものを前の方に
		range_arr.sort((a, b) => b.pos.length - a.pos.length || Util.compare_array(a.pos, b.pos));
		Util.unique_array(range_arr, (prev, cur) => {
			if (Util.equal_array(prev.pos, cur.pos)) {
				range_map[cur.id] = prev;
				return 0;
			}
			return -1;
		});
		// 順番を付与
		range_arr.forEach((x, i) => x.order = i);

		// 除外処理
		for (let i=0; i<equivalents.length; i++) {
			let equiv_saslots = equivalents[i];
			// 代表元
			let sa = equiv_saslots[0];

			for (let j=0; j<sa.eqab_owns.length; j++) {
				// sa.eqab_owns[j] が除外可能か？
				let uppers = sa.upper_owns_array[j];
				if (uppers.length == 0) continue;
				if (check_id_map && !uppers.some(u => check_id_map[u.id])) continue;

				// 何度も実行すれば数学的に除外可能な限界まで除外できるはず
				// ただし自分のスロットに装備できるもののみを利用した除外のみ
				// 自分のスロットに装備できない装備を利用した除外はあるかもしれないが難解
				if (is_fillable_owns(uppers, range_map)) {
					removed_id_map[sa.eqab_owns[j].id] = true;
					sa.eqab_owns[j] = null;
					sa.upper_owns_array[j] = null;
					sa.flood = true;
					removed_count += equiv_saslots.length;
				}
			}

			if (!sa.flood) {
				// eqab_owns が氾濫しているか(いずれかの装備を必ずセットするか)をチェック
				sa.flood = is_fillable_owns(sa.eqab_owns, range_map);
			}

			sa.eqab_owns = sa.eqab_owns.filter(x => x);
			sa.upper_owns_array = sa.upper_owns_array.filter(x => x);

			// 他の同等なスロットにも適用
			// 一応複製しておく
			for (let k=1; k<equiv_saslots.length; k++) {
				equiv_saslots[k].eqab_owns = sa.eqab_owns.concat();
				equiv_saslots[k].upper_owns_array = sa.upper_owns_array.concat();
				equiv_saslots[k].flood = sa.flood;
			}
		}

		// next
		check_id_map = removed_id_map;
		total_removed_count += removed_count;

	} while (removed_count > 0);

	// console.log(total_removed_count);

	// 決定可能なスロット
	// スロットが空の状態の解はない(積極的に探索しない)と仮定
	if (separate_resolved) {
		let saslots_resolved = [];

		RESOLVE:
		for (let i=0; i<saslots.length; i++) {
			let sa = saslots[i];

			// 装備可能な装備がない場合は空で確定
			if (sa.eqab_owns.length == 0) {
				sa.slot.set_equipment(0);
				saslots_resolved.push(sa);
				saslots[i] = null;
				continue;
			}

			// 以下は、このスロットにおいて装備を必ず使用することが分かっているもののみ判定
			if (!sa.flood) continue;

			let resolved_own = null;
			// 除外した残りが1種類かつ改修値によって変化しないなら決定可能
			// 他のスロットは改修値によって変化するかもしれないので最も小さい改修値のものを使用する
			if (sa.eqab_owns.length == 1) {
				let own = sa.eqab_owns[0];
				let constant = sa.ssd.is_upper_equipment(own.csv_data, own.csv_data, own.star_min, own.star_max);
				if (!constant) continue;
				resolved_own = own;

			} else if (sa.eqab_owns.length >= 2) {
				// 2種類以上あっても全て同値なら決定できる可能性があるが
				// それには他の任意のスロットでも同値でなければならない
				for (let k=0; k<sa.eqab_owns.length; k++) {
					let a = k == 0 ? sa.eqab_owns[sa.eqab_owns.length - 1] : sa.eqab_owns[k - 1];
					let b = sa.eqab_owns[k];
					// ステータス判定
					for (let j=0; j<ssd_list.length; j++) {
						// a >= b の判定。最初は a が一番後ろのため、だいたい偽になる
						let constant = ssd_list[j].is_upper_equipment(a.csv_data, b.csv_data, a.star_min, b.star_max);
						if (!constant) continue RESOLVE;
					}
					// 装備可能位置も同等でなければならない
					if (saslots.some(s => s && Boolean(s.eqab[a.id]) != Boolean(s.eqab[b.id]))) continue RESOLVE;
				}
				// 決定可能
				// 利用する装備は一番少ないものとする
				resolved_own = sa.eqab_owns.reduce((a, c) => a.remaining <= 0 || (c.remaining > 0 && a.remaining > c.remaining) ? c : a);
			}

			if (resolved_own) {
				// 装備変更
				// 現在、非固定で決定されていないスロットはカウント外
				// カウントしながら装備を設定する
				sa.slot.set_equipment(resolved_own.id, resolved_own.csv_data, resolved_own.shift_star());
				saslots_resolved.push(sa);
				saslots[i] = null;
			}
		}

		common.saslots_resolved = saslots_resolved;

		if (saslots_resolved.length > 0) {
			saslots = saslots.filter(x => x);

			// 残り0個の装備は除外可能
			for (let i=0; i<saslots.length; i++) {
				let sa = saslots[i];
				let removed = false;
				for (let j=0; j<sa.eqab_owns.length; j++) {
					if (sa.eqab_owns[j].remaining <= 0) {
						sa.eqab_owns[j] = null;
						sa.upper_owns_array[j] = null;
						removed = true;
					} else {
						sa.upper_owns_array[j] = sa.upper_owns_array[j].filter(u => u.remaining > 0);
					}
				}
				if (removed) {
					sa.eqab_owns = sa.eqab_owns.filter(x => x);
					sa.upper_owns_array = sa.upper_owns_array.filter(x => x);
				}
			}
		}
	}

	// eqab の再生成、eqab_owns の装備に限定する
	// キャッシュヒットを期待して同じものは共有する
	equivalents.forEach(eqs => {
		let sa = eqs[0];
		if (common.saslots_resolved?.indexOf(sa) >= 0) return;

		sa.eqab = sa.eqab_owns.reduce((a, c) => (a[c.id] = 1, a), {});
		sa.eqab2 = Object.assign({"0": 1}, sa.eqab);
		for (let i=1; i<eqs.length; i++) {
			eqs[i].eqab = sa.eqab;
			eqs[i].eqab2 = sa.eqab2;
			// check
			// eqs[i].eqab_owns.forEach(own => console.assert(eqs[i].eqab[own.id] == 1));
		}
	});

	// 非固定のカウントを戻す
	// 決定可能スロットにより、矛盾が生じているかもしれない
	for (let i=0; i<saslots.length; i++) {
		let slot = saslots[i].slot;
		let own = this.own_map[slot.equipment_id];
		if (own) {
			let p = slot.improvement;
			if (own.rem_counts[p] > 0) {
				own.rem_counts[p]--;
				own.remaining--;
			} else {
				// 決定可能スロットの装備を変更したので矛盾が生じた
				// 装備をはずすことにする
				slot.set_equipment(0);
			}
		}
	}

	// rem_stars の生成
	this.own_list.forEach(own => own.generate_rem_stars());

	// 交換可能なスロットをセット
	for (let i=0; i<saslots.length; i++) {
		let sa = saslots[i];
		sa.swap_saslots = [];

		for (let j=0; j<saslots.length; j++) {
			if (j == i) continue;
			if (sa.ssd == saslots[j].ssd) continue;
			// 同優先度のみとする場合: いまいち
			// if (sa.priority != saslots[j].priority) continue;
			// 増設は増設同士で
			if (sa.is_exslot != saslots[j].is_exslot) continue;

			// 交換できる装備があるか
			// …増設同士のみ交換を有効にするとだいたい小型電探が…
			// let swappable = sa.eqab_owns.some(own => saslots[j].eqab[own.id]) &&
			// 	saslots[j].eqab_owns.some(own => sa.eqab[own.id]);
			// if (!swappable) continue;

			// OK
			sa.swap_saslots.push(saslots[j]);
		}
	}

	this.ssd_list.forEach(ssd => ssd.calc_bonus());

	common.saslots = saslots;
	// console.log(saslots, common.saslots_resolved)
	return common;
}


/**
 * 焼きなまし法による解の探索
 * @param {number} [iteration_scale=1] 反復回数を基準の何倍にするか
 * @alias SupportFleetData#annealing
 */
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

	/** @type {SearchCommonData} */
	let common = this.calculate_common("annealing");
	let saslots = common.saslots;

	// 装備可能なスロットがない(全て固定されている)
	if (saslots.length == 0) return;

	// 設定など
	let swap_prob = 0.25;
	if (this.ssd_list.length == 1) swap_prob = 0;
	
	let retry_count = 0;
	let retry_max = 1;
	let start_temperature = 5000;
	let end_temperature = 1;
	let replace_prob = 1 - swap_prob;

	// 反復回数固定で設定
	let expect_loop_count = 18000 * this.ssd_list.length * iteration_scale;
	let coefficient = 0.9;
	let max_step = Math.floor(Math.log(end_temperature / start_temperature) / Math.log(coefficient)) + 1;
	let phasechange_count = Math.ceil(expect_loop_count / (max_step * retry_max));

	let newphase_count = 0;
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

		// 高速化のための汎用乱数
		let rand = Math.random();

		if (rand >= replace_prob) {
			// 他の艦との入れ替え
			let sa = null, swap_sa = null;

			SELECT:
			for (let t=0; t<4; t++) {
				let r = Math.random() * saslots.length;
				let k = Math.floor(r);
				sa = saslots[k];
				let a_swap = sa.swap_saslots;
				if (a_swap.length == 0) continue;
				let a_id = sa.slot.equipment_id;
				let a_star = sa.slot.improvement;

				// 乱択で何度かやってみて、だめだったら全部見る
				for (let i=0; i<4; i++) {
					r = (r - k) * a_swap.length;
					k = Math.floor(r);
					let b = a_swap[k];
					let b_id = b.slot.equipment_id;
					let b_star = b.slot.improvement;
					if ((b_id != a_id || b_star != a_star) && sa.eqab2[b_id] && b.eqab2[a_id]) {
						swap_sa = b;
						break SELECT;
					}
				}

				// 入れ替えられる要素から均等に抽出
				let sugg_count = 0;
				for (let i=0; i<a_swap.length; i++) {
					let b = a_swap[i];
					let b_id = b.slot.equipment_id;
					let b_star = b.slot.improvement;
					if ((b_id != a_id || b_star != a_star) && sa.eqab2[b_id] && b.eqab2[a_id]) {
						r = (sugg_count % 4 == 0 ? Math.random() : r - k);
						r *= ++sugg_count;
						k = Math.floor(r);
						if (k == 0) { // 1 / sugg_count の確率
							swap_sa = b;
						}
					}
				}
				if (swap_sa) break;
			}

			if (!swap_sa) continue;

			let slot = sa.slot;
			let ssd = sa.ssd;
			let swap_ssd = swap_sa.ssd;
			let score = temp_score;
			score.copy_from(current_score);
			
			score.sub(ssd);
			score.sub(swap_ssd);
			
			slot.swap_equipment(swap_sa.slot);
			let cb = ssd.calc_bonus_if(slot.equipment_id, swap_sa.slot.equipment_id);
			let scb = swap_ssd.calc_bonus_if(slot.equipment_id, swap_sa.slot.equipment_id);
			
			score.add(ssd);
			score.add(swap_ssd);
			
			let c = current_score.compare_annealing(score);
			// let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
			let move = c <= 0 || (rand - replace_prob) < Math.exp(- c / temperature) * (1 - replace_prob);
			
			if (move) {
				// 移動
				current_score.copy_from(score);
				
			} else {
				// 戻す
				slot.swap_equipment(swap_sa.slot);
				if (cb) ssd.calc_bonus();
				if (scb) swap_ssd.calc_bonus();
				continue;
			}

		} else { // rand < replace_prob
			rand = rand / replace_prob * saslots.length;
			let sa_index = Math.floor(rand);
			let sa = saslots[sa_index];
			// 念の為確認
			if (!sa) continue;

			// 装備されていないものとの入れ替え
			let swap_own = null;
			let list = sa.eqab_owns;
			let list_uppers = sa.upper_owns_array;
			let old_id = sa.slot.equipment_id;

			if (list.length == 0) continue;

			// 乱択アルゴリズム
			// 確実に得られるわけではないが、全ての要素を見るよりも高速かつ十分
			// Math.random() を呼ぶ回数もケチる
			SELECT:
			for (let i=0; i<6; i++) {
				let r = Math.random();
				let k = 0;
				for (let j=0; j<4; j++) {
					r = (r - k) * list.length;
					k = Math.floor(r);
					let own = list[k];
					// list[k] の上位互換が list_uppers[k] (array)
					if (own.remaining > 0 && own.id != old_id && !list_uppers[k].some(u => u.remaining > 0)) {
						swap_own = own;
						break SELECT;
					}
				}
			}
			if (!swap_own) {
				// 見つからなかった場合はとりあえず一番前にあるもの
				// 非常に低確率のはず
				for (let k=0; k<list.length; k++) {
					let own = list[k];
					if (own.remaining > 0 && own.id != old_id && !list_uppers[k].some(u => u.remaining > 0)) {
						swap_own = own;
						break;
					}
				}
			}

			if (!swap_own) continue;

			let slot = sa.slot;
			let ssd = sa.ssd;
			let old_data = slot.equipment_data;
			let old_star = slot.improvement;
			
			let score = temp_score;
			score.copy_from(current_score);
			
			score.sub(ssd);
			
			// 装備をownに
			let star = swap_own.rem_stars[swap_own.remaining - 1];
			slot.set_equipment(swap_own.id, swap_own.csv_data, star);
			let cb = ssd.calc_bonus_if(old_id, swap_own.id);
			
			score.add(ssd);
			
			let c = current_score.compare_annealing(score);
			// let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
			let move = c <= 0 || (rand - sa_index) < Math.exp(- c / temperature);
			// let move = c <= 0 || c <= Math.random() * temperature;
			
			if (move) {
				// 移動
				swap_own.pop_rem_star();
				if (old_id) {
					// 装備が空の場合がある
					own_map[old_id].insert_rem_star(old_star);
				}
				current_score.copy_from(score);
				
			} else {
				// 戻す
				slot.set_equipment(old_id, old_data, old_star);
				if (cb) ssd.calc_bonus();
				continue;
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

	/** @type {SearchCommonData} */
	let common = this.calculate_common("annealing_entire");
	let saslots = common.saslots;

	// 装備可能なスロットがない(全て固定されている)
	if (saslots.length == 0) return;

	// 設定など
	let swap_prob = 0.25;
	if (this.ssd_list.length == 1) swap_prob = 0;
	
	let retry_count = 0;
	let retry_max = 1;
	// let start_temperature = 5000;
	// let end_temperature = 1;
	let replace_prob = 1 - swap_prob;

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
	let expect_loop_count = 18000 * this.ssd_list.length * iteration_scale;
	let coefficient = 0.9;
	let max_step = Math.floor(Math.log(end_temperature / start_temperature) / Math.log(coefficient)) + 1;
	let phasechange_count = Math.ceil(expect_loop_count / (max_step * retry_max));
	
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

		// 高速化のための汎用乱数
		let rand = Math.random();

		if (rand >= replace_prob) {
			// 他の艦との入れ替え
			let sa = null, swap_sa = null;

			SELECT:
			for (let t=0; t<4; t++) {
				let r = Math.random() * saslots.length;
				let k = Math.floor(r);
				sa = saslots[k];
				let a_swap = sa.swap_saslots;
				if (a_swap.length == 0) continue;
				let a_id = sa.slot.equipment_id;
				let a_star = sa.slot.improvement;

				// 乱択で何度かやってみて、だめだったら全部見る
				for (let i=0; i<4; i++) {
					r = (r - k) * a_swap.length;
					k = Math.floor(r);
					let b = a_swap[k];
					let b_id = b.slot.equipment_id;
					let b_star = b.slot.improvement;
					if ((b_id != a_id || b_star != a_star) && sa.eqab2[b_id] && b.eqab2[a_id]) {
						swap_sa = b;
						break SELECT;
					}
				}

				// 入れ替えられる要素から均等に抽出
				let sugg_count = 0;
				for (let i=0; i<a_swap.length; i++) {
					let b = a_swap[i];
					let b_id = b.slot.equipment_id;
					let b_star = b.slot.improvement;
					if ((b_id != a_id || b_star != a_star) && sa.eqab2[b_id] && b.eqab2[a_id]) {
						r = (sugg_count % 4 == 0 ? Math.random() : r - k);
						r *= ++sugg_count;
						k = Math.floor(r);
						if (k == 0) { // 1 / sugg_count の確率
							swap_sa = b;
						}
					}
				}
				if (swap_sa) break;
			}

			if (!swap_sa) continue;

			let slot = sa.slot;
			let ssd = sa.ssd;
			let swap_ssd = swap_sa.ssd;
			let score = temp_score;
			
			score.sub(ssd);
			score.sub(swap_ssd);
			
			slot.swap_equipment(swap_sa.slot);
			let cb = ssd.calc_bonus_if(slot.equipment_id, swap_sa.slot.equipment_id);
			let scb = swap_ssd.calc_bonus_if(slot.equipment_id, swap_sa.slot.equipment_id);
			
			score.add(ssd);
			score.add(swap_ssd);
			
			let c = current_score.compare_annealing(score, score_length);
			// let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
			let move = c <= 0 || (rand - replace_prob) < Math.exp(- c / temperature) * (1 - replace_prob);
			
			if (move) {
				// 移動
				current_score.copy_from2(score, ssd.priority, swap_ssd.priority);
				
			} else {
				// 戻す
				score.copy_from2(current_score, ssd.priority, swap_ssd.priority);
				slot.swap_equipment(swap_sa.slot);
				if (cb) ssd.calc_bonus();
				if (scb) swap_ssd.calc_bonus();
				continue;
			}

		} else { // rand < replace_prob
			rand = rand / replace_prob * saslots.length;
			let sa_index = Math.floor(rand);
			let sa = saslots[sa_index];
			// 念の為確認
			if (!sa) continue;

			// 装備されていないものとの入れ替え
			let swap_own = null;
			let list = sa.eqab_owns;
			let list_uppers = sa.upper_owns_array;
			let old_id = sa.slot.equipment_id;

			if (list.length == 0) continue;

			// 乱択アルゴリズム
			// 確実に得られるわけではないが、全ての要素を見るよりも高速かつ十分
			// Math.random() を呼ぶ回数もケチる
			SELECT:
			for (let i=0; i<6; i++) {
				let r = Math.random();
				let k = 0;
				for (let j=0; j<4; j++) {
					r = (r - k) * list.length;
					k = Math.floor(r);
					let own = list[k];
					// list[k] の上位互換が list_uppers[k] (array)
					if (own.remaining > 0 && own.id != old_id && !list_uppers[k].some(u => u.remaining > 0)) {
						swap_own = own;
						break SELECT;
					}
				}
			}
			if (!swap_own) {
				// 見つからなかった場合はとりあえず一番前にあるもの
				// 非常に低確率のはず
				for (let k=0; k<list.length; k++) {
					let own = list[k];
					if (own.remaining > 0 && own.id != old_id && !list_uppers[k].some(u => u.remaining > 0)) {
						swap_own = own;
						break;
					}
				}
			}

			if (!swap_own) continue;

			let slot = sa.slot;
			let ssd = sa.ssd;
			let old_data = slot.equipment_data;
			let old_star = slot.improvement;
			
			let score = temp_score;
			
			score.sub(ssd);
			
			// 装備をownに
			let star = swap_own.rem_stars[swap_own.remaining - 1];
			slot.set_equipment(swap_own.id, swap_own.csv_data, star);
			let cb = ssd.calc_bonus_if(old_id, swap_own.id);
			
			score.add(ssd);
			
			let c = current_score.compare_annealing(score, score_length);
			// let move = c <= 0 || Math.random() < Math.exp(- c / temperature);
			let move = c <= 0 || (rand - sa_index) < Math.exp(- c / temperature);
			
			if (move) {
				// 移動
				swap_own.pop_rem_star();
				if (old_id) {
					// 装備が空の場合がある
					own_map[old_id].insert_rem_star(old_star);
				}
				current_score.copy_from2(score, ssd.priority);
				
			} else {
				// 戻す
				score.copy_from2(current_score, ssd.priority);
				slot.set_equipment(old_id, old_data, old_star);
				if (cb) ssd.calc_bonus();
				continue;
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


