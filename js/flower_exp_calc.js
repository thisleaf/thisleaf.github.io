
// table[idx] <= base < table[idx] なる idx を返す
function index_in_ascending(base, table){
	// binary search
	var left = 0;
	var right = table.length;
	while (left + 1 < right) {
		var c = Math.floor((left + right) / 2);
		if (table[c] <= base) {
			left = c;
		} else {
			right = c;
		}
	}
	return left;
}

function get_exp_table(rarity, growth){
	// growth にはよらない
	var tables = [TOTALEXP_STAR2, TOTALEXP_STAR3, TOTALEXP_STAR4, TOTALEXP_STAR5, TOTALEXP_STAR6];
	return tables[rarity - 2];
}

function get_goldcost_table(rarity, growth){
	// rarity にはよらない
	return growth == 0 ? GOLDCOST_TABLE1 : GOLDCOST_TABLE2;
}

function exp_to_level(exp, limit_level, exp_table){
	var level = index_in_ascending(exp, exp_table) + 1;
	if (level > limit_level) level = limit_level;
	return level;
}




// materials のカードを全て使って強化する場合に
// 消費ゴールドが最小になるものを探す
// materials は並び順が変わる可能性がある
// 経験値が整数でない場合は最小が保証されないが、近似値ということで
// 戻り値: PowerupList
function calc_mingold_powerup(base_exp, goal_exp, materials, limit_level, exp_table, gold_table, once_min_count, great_mode){
	// 経験値が少ない方から使う
	// ∵もしそうでないなら入れ替えて安くなる
	// （整数でないならそうとも限らない）
	materials.sort(FKGCard.exp_less);
	
	// 0 .. i 番目まで使って強化した場合の
	// 累計expと到達レベル
	// GREAT_ALLの場合は最初から1.5倍とする
	let base_level = exp_to_level(base_exp, limit_level, exp_table);
/*
	var total_exps = new Array;
	var levels = new Array;
	
	total_exps[-1] = base_exp;
	levels[-1] = base_level;
	
	for (var i=0; i<materials.length; i++) {
		var exp = materials[i].exp_as_feed;
		if (great_mode == GREAT_ALL) exp = Math.floor(exp * 1.5);
		total_exps[i] = total_exps[i - 1] + exp;
		levels[i] = exp_to_level(total_exps[i], limit_level, exp_table);
	}
*/
	
	// 動的計画法  O(n)でハヤイ！
	// solution_array[n] = 0 .. n まで使って強化した場合の最適解
	var solution_array = new Array;
	
	for (var n=0; n<materials.length; n++) {
		// 0 .. n を使った強化
		var min_k = -1;
		var min_cost = Infinity;
		var min_prev_k = 10;
		let min_once_cost = 0;
		let min_before_level = 1;
		
		var last_loop = n == materials.length - 1;
		var last_great = great_mode == GREAT_ONLYLAST && last_loop;
		
		// 最後に k 枚使って強化する
		var k = 1;
		// 最小選択枚数(ラスト以外)
		if (!last_loop && once_min_count > 1) k = once_min_count;
		
		for (; k<=10; k++) {
			// n - k + 1 .. n までを使用
			var ibegin = n - k + 1;
			//var iend = n + 1;
			
			if (ibegin < 0) break;
			
			let prev = null;
			let prev_once = null;
			let prev_k = 10;
			let before_level = base_level;
			let est_cost = 0;
			
			if (ibegin >= 1) {
				prev = solution_array[ibegin - 1];
				if (!prev) continue;
				
				est_cost += prev.gold_to_powerup;
				
				prev_once = prev.list[prev.list.length - 1];
				prev_k = prev_once.mat_end - prev_once.mat_begin;
				before_level = prev_once.end_level;
			}
			
			//var once_cost = gold_table[levels[ibegin - 1] - 1] * k;
			let once_cost = gold_table[before_level - 1] * k;
			est_cost += once_cost;
			
			if (est_cost <= min_cost) {
				// 同値な場合に、カードを前方にまとめる
				if (est_cost == min_cost && ibegin >= 1) {
					// 前回強化の枚数が大きいものを優先
					if (prev_k < min_prev_k) continue;
				}
				
				min_k = k;
				min_cost = est_cost;
				min_prev_k = prev_k;
				min_once_cost = once_cost;
				min_before_level = before_level;
			}
		}
		
		var pl = null;
		
		if (min_k >= 1) {
			// min_k 個使ったものが最小(ない場合もある)
			var min_begin = n - min_k + 1;
			var min_end = n + 1;
			
			if (min_begin == 0) {
				pl = new PowerupList(base_exp);
			} else {
				pl = solution_array[min_begin - 1].clone();
			}
			
			var once = new PowerupOnce;
			//once.materials = materials.slice(min_begin, min_begin + min_k);
			once.mat_begin = min_begin;
			once.mat_end = min_begin + min_k;
			
			once.before_experience = pl.end_experience;
			once.before_level = min_before_level;
			once.gold_to_powerup = min_once_cost;
			once.suppose_great = great_mode == GREAT_ALL || last_great;
			
			once.gain_experience = PowerupOnce.calcExp(materials, once.mat_begin, once.mat_end, once.suppose_great);
			once.end_level = exp_to_level(pl.end_experience + once.gain_experience, limit_level, exp_table);
			
			pl.push_back(once, 1);
		}
		
		solution_array[n] = pl;
	}
	
	var solution = null;
	
	if (solution_array.length > 0) {
		// これはnullにならない・・・はず
		solution = solution_array[solution_array.length - 1];
		
		var total_gold = 0;
		var end_exp = base_exp;
		
		for (var i=0; i<solution.list.length; i++) {
			var once = solution.list[i];
			once.materials = materials.slice(once.mat_begin, once.mat_end);
			once.number = i + 1;
			
			total_gold += once.gold_to_powerup;
			once.total_gold_to_powerup = total_gold;
			
			end_exp += once.gain_experience;
			once.end_experience = end_exp;
		}
		solution.setOnceComments(1, goal_exp, COMMENT_COMPLETE, COMMENT_RECALC, null, null);
		
	} else {
		solution = new PowerupList(base_exp);
	}
	
	// completed, stacks 等はセットしない
	
	return solution;
}


// goal_exp まで強化する際に、ゴールドが最小になる組み合わせを探す
// stacks は保存
// great_mode は GREAT_NOTHING, GREAT_ALL のみ
// いくつかパターンがある
function calc_mingold_powerup_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count, great_mode){
	return calc_mingold_powerup_of_s_TS(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count, great_mode);
}


// 高速版
// 最小は保証されない　ときどき最小にならない解が出るが、それは複雑な場合だけかも
function calc_mingold_powerup_of_s_fast(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count, great_mode){
	//function _exp(e){ return great_mode == GREAT_ALL ? Math.floor(e * 1.5) : e; }
	function _exp(e){ return great_mode == GREAT_ALL ? e * 1.5 : e; }
	
	// 固定
	var fixed_stacks = new Array;
	var fixed_cards = new Array;
	var fixed_exp = 0;
	// 選択
	var unresolved_stacks = new Array;
	
	FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
	
	for (var i=0; i<fixed_stacks.length; i++) {
		for (var j=0; j<fixed_stacks[i].count; j++) {
			fixed_cards.push(fixed_stacks[i].card);
		}
		fixed_exp += _exp(fixed_stacks[i].card.exp_as_feed) * fixed_stacks[i].count;
	}
	
	// 経験値の多い方から
	unresolved_stacks.sort(function (a, b){
		var c = b.card.exp_as_feed - a.card.exp_as_feed;
		if (c == 0) c = b.card.value_as_feed - a.card.value_as_feed;
		if (c == 0) c = b.card.priority - a.card.priority;
		return c;
	});
	
	var remain_exp = goal_exp - base_exp - fixed_exp;
	var select_counts = new Array;
	
	// まずexpが大きい方から並べていく
	// 大きい方からなので、同価値は同属性が優先となる
	for (var i=0; i<unresolved_stacks.length; i++) {
		var c = Math.ceil(remain_exp / _exp(unresolved_stacks[i].card.exp_as_feed));
		if (c > unresolved_stacks[i].count) c = unresolved_stacks[i].count;
		if (c < 0) c = 0;
		
		select_counts[i] = c;
		remain_exp -= _exp(unresolved_stacks[i].card.exp_as_feed) * c;
	}
	
	var sub_select_counts = select_counts.concat();
	
	// 入れ替え計算
	var pl = _minimize(select_counts, -remain_exp);
	
	// 稀に枚数増加で小さくなるパターンがある
	var plus = false;
	var sub_remain_exp = remain_exp;
	for (var i=0; i<unresolved_stacks.length; i++) {
		if (sub_select_counts[i] < unresolved_stacks[i].count) {
			sub_select_counts[i]++;
			sub_remain_exp -= _exp(unresolved_stacks[i].card.exp_as_feed);
			plus = true;
			break;
		}
	}
	if (plus) {
		var sub_pl = _minimize(sub_select_counts, -sub_remain_exp);
		if (sub_pl.gold_to_powerup < pl.gold_to_powerup) {
			pl = sub_pl;
		}
	}
	
	// 追加情報等のセット
	pl.completed = remain_exp <= 0;
	
	var p_comm = fixed_cards.length >= 1 ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
	pl.setOnceComments(1, goal_exp, p_comm, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
	
	return pl;
	
	
	// 計算
	// けっこう雑だがまあだいたい大丈夫やろ（慢心）
	function _minimize(arg_counts, arg_overflow_exp){
		// まずは属性自由なものを計算
		var fw_counts = arg_counts.concat();
		var bk_counts = arg_counts.concat();
		var fw_over = _swap(fw_counts, arg_overflow_exp,  1, true);
		var bk_over = _swap(bk_counts, arg_overflow_exp, -1, true);
		var fw_pl = _to_list(fw_counts);
		var bk_pl = _to_list(bk_counts);
		
		var pl, direction, unfit_over;
		
		if (fw_pl.gold_to_powerup < bk_pl.gold_to_powerup) {
			pl = fw_pl;
			direction = 1;
			unfit_over = fw_over;
		} else {
			pl = bk_pl;
			direction = -1;
			unfit_over = bk_over;
		}
		
		// 他属性を同属性に置き換えられるか
		var counts = arg_counts.concat();
		var fit_over = _swap(counts, arg_overflow_exp, direction, false);
		
		if (fit_over != unfit_over) {
			var fit_pl = _to_list(counts);
			if (fit_pl.gold_to_powerup <= pl.gold_to_powerup) {
				pl = fit_pl;
			}
		}
		return pl;
	}
	
	function _swap(counts, overflow_exp, direction, use_unfit){
		// expが小さいものに交換しても条件を満たすなら交換したほうが安い
		for (var i=0; i<unresolved_stacks.length; i++) {
			var r = direction > 0 ? i : unresolved_stacks.length - 1 - i;
			
			for (var j=0; j<r; j++) {
				if (!use_unfit && unresolved_stacks[r].card.same_element === false) continue;
				
				// [j] と [r] の交換を検討
				var r_free = unresolved_stacks[r].count - counts[r];
				if (r_free <= 0) break;
				
				// 1枚交換でのexp減少量
				var d = _exp(unresolved_stacks[j].card.exp_as_feed) - _exp(unresolved_stacks[r].card.exp_as_feed);
				if (d <= 0) break;
				
				var s = Math.floor(overflow_exp / d);
				if (s > counts[j]) s = counts[j];
				if (s > r_free) s = r_free;
				
				if (s > 0) {
					counts[j] -= s;
					counts[r] += s;
					overflow_exp -= d * s;
				}
			}
		}
		return overflow_exp;
	}
	// かかるゴールドを計算
	function _to_list(counts){
		var materials = fixed_cards.concat();
		for (var i=0; i<unresolved_stacks.length; i++) {
			var r = unresolved_stacks.length - 1 - i;
			for (var j=0; j<counts[r]; j++) {
				materials.push(unresolved_stacks[r].card);
			}
		}
		return calc_mingold_powerup(base_exp, goal_exp, materials, limit_level, exp_table, gold_table, once_min_count, great_mode);
	}
}


// タブーサーチを使うバージョン
// 上の解はほとんど最適に近いが、最適とは限らないのでちょっと近傍をうろつく
function calc_mingold_powerup_of_s_TS(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count, great_mode){
	function _exp(e){ return great_mode == GREAT_ALL ? e * 1.5 : e; }
	
	// 固定
	var fixed_stacks = new Array;
	var fixed_cards = new Array;
	var fixed_exp = 0;
	// 選択
	var unresolved_stacks = new Array;
	
	FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
	
	for (var i=0; i<fixed_stacks.length; i++) {
		for (var j=0; j<fixed_stacks[i].count; j++) {
			fixed_cards.push(fixed_stacks[i].card);
		}
		fixed_exp += _exp(fixed_stacks[i].card.exp_as_feed) * fixed_stacks[i].count;
	}
	
	// 経験値の多い方から
	unresolved_stacks.sort(function (a, b){
		var c = b.card.exp_as_feed - a.card.exp_as_feed;
		if (c == 0) c = b.card.value_as_feed - a.card.value_as_feed;
		if (c == 0) c = b.card.priority - a.card.priority;
		return c;
	});
	
	var remain_exp = goal_exp - base_exp - fixed_exp;
	var unres_value = 0;
	var unres_free_item = 0;
	var select_counts = new Array;
	
	// まずexpが大きい方から並べていく
	// 大きい方からなので、同価値は同属性が優先となる
	for (var i=0; i<unresolved_stacks.length; i++) {
		var c = Math.ceil(remain_exp / _exp(unresolved_stacks[i].card.exp_as_feed));
		if (c > unresolved_stacks[i].count) c = unresolved_stacks[i].count;
		if (c < 0) c = 0;
		
		select_counts[i] = c;
		remain_exp -= _exp(unresolved_stacks[i].card.exp_as_feed) * c;
		unres_value += unresolved_stacks[i].card.value_as_feed * c;
		
		if (unresolved_stacks[i].count > 0) unres_free_item++;
	}
	
	// 入れ替え計算
	// これを初期値として使用
	var fw_counts = select_counts.concat();
	var fw_over = _swap(fw_counts, -remain_exp, 1, true);
	var fw_pl = _to_list(fw_counts);
	
	var fw_value = 0;
	for (var i=0; i<fw_pl.list.length; i++) {
		var mats = fw_pl.list[i].materials;
		for (var j=0; j<mats.length; j++) {
			fw_value += mats[j].value_as_feed;
		}
	}
	
	// タブーサーチ
	// どのくらいのサイズがいいのだろう？
	const max_generation_count = unres_free_item * 10;
	const tabu_size = unres_free_item;
	//const tabu_size = Math.floor((unres_free_item + 1) / 2);
	//const tabu_size = 5;
	
	var tabu_list = new Array;
	var cache = new Object;
	// 現在の状態
	var current = new _Gene(fw_pl, fw_counts, fw_value, fw_over);
	// 合計枚数の増加・減少を考慮するか
	// 大抵は現在の枚数で良いので、途中から解禁する
	var change_size_mode = false;
	// 最小解
	var min_gene = current;
	// debug
	var calc_count = 0;
	var cache_count = 0;
	
	for (var gen=0; gen<max_generation_count; gen++) {
		var counts = current.counts;
		var value = current.value;
		var overflow_exp = current.overflow_exp;
		
		if (!change_size_mode) {
			if (gen / 2 >= max_generation_count) {
				change_size_mode = true;
			}
		}
		
		// 近傍解の生成
		var neighbors = new Array;
		
		for (var i=0; i<counts.length; i++) {
			var card_exp = _exp(unresolved_stacks[i].card.exp_as_feed);
			var card_value = unresolved_stacks[i].card.value_as_feed;
			
			if (change_size_mode) {
				if (counts[i] > 0 && overflow_exp - card_exp >= 0) {
					// 減少させる
					if (!_is_tabu(i, -1)) {
						counts[i]--;
						neighbors.push(_calc_gene(counts, value - card_value, overflow_exp - card_exp, _path(i, -2)));
						counts[i]++;
					}
				}
				if (counts[i] < unresolved_stacks[i].count) {
					// 増加させる
					if (!_is_tabu(i, -2)) {
						counts[i]++;
						neighbors.push(_calc_gene(counts, value + card_value, overflow_exp + card_exp, _path(i, -1)));
						counts[i]--;
					}
				}
			}
			
			for (var j=i+1; j<counts.length; j++) {
				var j_card_exp = _exp(unresolved_stacks[j].card.exp_as_feed);
				var j_card_value = unresolved_stacks[j].card.value_as_feed;
				
				// i減少j増加
				if (counts[i] > 0 && counts[j] < unresolved_stacks[j].count) {
					var swap_overflow_exp = overflow_exp - card_exp + j_card_exp;
					
					if (swap_overflow_exp >= 0 && !_is_tabu(j, i)) {
						var swap_card_value = value - card_value + j_card_value;
						counts[i]--; counts[j]++;
						neighbors.push(_calc_gene(counts, swap_card_value, swap_overflow_exp, _path(i, j)));
						counts[i]++; counts[j]--;
					}
				}
				
				// i増加j減少
				if (counts[j] > 0 && counts[i] < unresolved_stacks[i].count) {
					var swap_overflow_exp = overflow_exp + card_exp - j_card_exp;
					
					if (swap_overflow_exp >= 0 && !_is_tabu(i, j)) {
						var swap_card_value = value + card_value - j_card_value;
						counts[i]++; counts[j]--;
						neighbors.push(_calc_gene(counts, swap_card_value, swap_overflow_exp, _path(j, i)));
						counts[i]--; counts[j]++;
					}
				}
			}
		}
		
		if (neighbors.length == 0) {
			if (!change_size_mode) {
				change_size_mode = true;
				continue;
			}
			break;
		}
		
		neighbors.sort(_gold_less);
		
		var next = neighbors[0];
		var renew = false;
		
		if (next.overflow_exp >= 0 && _gold_less(next, min_gene) < 0) {
			min_gene = next;
			renew = true;
		}
		
		tabu_list.unshift(next.tabu_path);
		if (tabu_list.length > tabu_size) {
			tabu_list.length = tabu_size;
		}
		current = next;
		
/*
		// trace
		var sum = 0;
		for (var i=0; i<current.counts.length; i++) sum += current.counts[i];
		
		console.log(
			neighbors.length,
			current.value, current.powerup_list.gold_to_powerup, current.counts.join(","), sum,
			current.tabu_path, renew ? "★" : "",
			current.powerup_list.gold_to_powerup == min_gene.gold_to_powerup ? "●" : ""
		);
// */
	}
	
	//console.log("TS", tabu_size, calc_count, cache_count, "gen", gen);
	
	// 解と追加情報等のセット
	var solution = min_gene.powerup_list;
	solution.completed = remain_exp <= 0;
	
	var p_comm = fixed_cards.length >= 1 ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
	solution.setOnceComments(1, goal_exp, p_comm, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
	
	return solution;
	
	
	function _path(inc_pos, dec_pos){
		var gp = inc_pos < dec_pos ? dec_pos : inc_pos;
		var lp = inc_pos < dec_pos ? inc_pos : dec_pos;
		return lp + "#" + gp;
	}
	
	function _is_tabu(ip, dp){
		var path = _path(ip, dp);
		for (var i=0; i<tabu_list.length; i++) {
			if (tabu_list[i] == path) return true;
		}
		return false;
	}
	function _calc_gene(arg_counts, value, overflow_exp, tabu_path){
		var hash = arg_counts.join(",");
		var gene;
		if (cache.hasOwnProperty(hash)) {
			gene = cache[hash];
			cache_count++;
		} else {
			var counts = arg_counts.concat();
			gene = new _Gene(_to_list(counts), counts, value, overflow_exp);
			cache[hash] = gene;
			calc_count++;
		}
		gene.tabu_path = tabu_path;
		return gene;
	}
	function _gold_less(a, b){
		var c = a.powerup_list.gold_to_powerup - b.powerup_list.gold_to_powerup;
		if (c == 0) c = a.value - b.value;
		if (c == 0) c = b.overflow_exp - a.overflow_exp;
		return c;
	}
	function _Gene(powerup_list, counts, value, overflow_exp){
		this.powerup_list = powerup_list;
		this.counts = counts;
		this.value = value;
		this.overflow_exp = overflow_exp;
		this.tabu_path = "";
	}
	function _swap(counts, overflow_exp, direction, use_unfit){
		// expが小さいものに交換しても条件を満たすなら交換したほうが安い
		for (var i=0; i<unresolved_stacks.length; i++) {
			var r = direction > 0 ? i : unresolved_stacks.length - 1 - i;
			
			for (var j=0; j<r; j++) {
				if (!use_unfit && unresolved_stacks[r].card.same_element === false) continue;
				
				// [j] と [r] の交換を検討
				var r_free = unresolved_stacks[r].count - counts[r];
				if (r_free <= 0) break;
				
				// 1枚交換でのexp減少量
				var d = _exp(unresolved_stacks[j].card.exp_as_feed) - _exp(unresolved_stacks[r].card.exp_as_feed);
				if (d <= 0) break;
				
				var s = Math.floor(overflow_exp / d);
				if (s > counts[j]) s = counts[j];
				if (s > r_free) s = r_free;
				
				if (s > 0) {
					counts[j] -= s;
					counts[r] += s;
					overflow_exp -= d * s;
				}
			}
		}
		return overflow_exp;
	}
	// かかるゴールドを計算
	function _to_list(counts){
		var materials = fixed_cards.concat();
		for (var i=0; i<unresolved_stacks.length; i++) {
			var r = unresolved_stacks.length - 1 - i;
			for (var j=0; j<counts[r]; j++) {
				materials.push(unresolved_stacks[r].card);
			}
		}
		return calc_mingold_powerup(base_exp, goal_exp, materials, limit_level, exp_table, gold_table, once_min_count, great_mode);
	}
}


// 組み合わせ列挙による全探索、そこそこ枝刈りしているが数が増えるとかなり遅い
// stacks: 保存
function calc_mingold_powerup_of_s_all(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count){
	// 固定
	var fixed_stacks = new Array;
	var fixed_cards = new Array;
	var fixed_exp = 0;
	// 選択
	var unresolved_stacks = new Array;
	
	FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
	
	for (var i=0; i<fixed_stacks.length; i++) {
		for (var j=0; j<fixed_stacks[i].count; j++) {
			fixed_cards.push(fixed_stacks[i].card);
		}
		fixed_exp += fixed_stacks[i].card.exp_as_feed * fixed_stacks[i].count;
	}
	
	// 経験値の多い方から
	unresolved_stacks.sort(function (a, b){
		var c = b.card.exp_as_feed - a.card.exp_as_feed;
		if (c == 0) c = b.card.priority - a.card.priority;
		return c;
	});
	
	// 計算のキャッシュ
	var lower_gold_cache = new Array;
	
	var calc_count = 0; // for debug
	var min_gold = Infinity;
	var min_solution = null;
	var min_value = 0;
	var materials = new Array;
	
	var total_feed_exp = 0;
	for (var i=0; i<unresolved_stacks.length; i++) {
		total_feed_exp += unresolved_stacks[i].card.exp_as_feed * unresolved_stacks[i].count;
	}
	
	_loop(0, goal_exp - base_exp - fixed_exp, total_feed_exp, 0);
	
//	console.log("calc_count:", calc_count);
	
	if (min_solution) {
		min_solution.completed = true;
		
		var p_comm = fixed_cards.length >= 1 ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
		min_solution.setOnceComments(1, goal_exp, p_comm, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
		
	} else {
		// 全部使用
		min_solution = calc_mingold_powerup_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count);
	}
	
	return min_solution;
	
	
	function _loop(current_value, remain_exp, remain_feed_exp, pos){
		// unresolved_stacks[pos] の数を決める
		var st = unresolved_stacks[pos];
		
		// remain_exp: あとどれだけ経験値が必要か
		// remain_feed_exp: 残りの餌の総経験値
		
		// これだけあれば足りる
		var count = Math.ceil(remain_exp / st.card.exp_as_feed);
		if (count > st.count) count = st.count;
		
		for (var i=0; i<count; i++) materials.push(st.card);
		
		var new_remain_feed_exp = remain_feed_exp - st.card.exp_as_feed * st.count;
		
		while (count >= 0) {
			// count個追加したものについて考える
			var new_current_value = current_value + st.card.value_as_feed * count;
			var new_remain_exp = remain_exp - st.card.exp_as_feed * count;
			
			if (new_remain_exp <= 0) {
				// 要件を満たした
				// これ以上は必要ない
				var pw = calc_mingold_powerup(base_exp, goal_exp, fixed_cards.concat(materials), limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
				calc_count++;
				
				if (pw.gold_to_powerup < min_gold || (pw.gold_to_powerup == min_gold && new_current_value < min_value)) {
					min_solution = pw;
					min_gold = pw.gold_to_powerup;
					min_value = new_current_value;
				}
			} else {
				// 再帰
				if (pos < unresolved_stacks.length - 1 && new_remain_exp <= new_remain_feed_exp) {
					// 枚数から下界をチェック
					var lower_count = materials.length + _get_lower_count(new_remain_exp, pos + 1);
					var lower_gold = _get_lower_gold_by_count(lower_count);
					
					// これ以上探索してもない
					if (lower_gold > min_gold) break;
					
					_loop(new_current_value, new_remain_exp, new_remain_feed_exp, pos + 1);
					
				} else {
					// 経験値は下がっていく方向でのループなので
					break;
				}
			}
			
			if (count > 0) materials.pop();
			count--;
		}
		
		if (count > 0) materials.length -= count;
	}
	
	// begin_pos以降でarg_remain_expを満たすのに最低限必要な枚数(fixed除く)
	function _get_lower_count(arg_remain_exp, begin_pos){
		var remain_exp = arg_remain_exp;
		var count = 0;
		for (var i=begin_pos; i<unresolved_stacks.length; i++) {
			if (remain_exp <= 0) break;
			
			var st = unresolved_stacks[i];
			var c = Math.ceil(remain_exp / st.card.exp_as_feed);
			if (c > st.count) c = st.count;
			// c枚配置
			count += c;
			remain_exp -= st.card.exp_as_feed * c;
		}
		// 不足
		if (remain_exp > 0) {
			// 上の使い方ならここにはこないはず・・・
			console.log("oh");
			count = -1;
		}
		return count;
	}
	
	// 枚数からその下界を返す
	function _get_lower_gold_by_count(count){
		if (lower_gold_cache.hasOwnProperty(count)) return lower_gold_cache[count];
		
		// 経験値が少ない方からcount枚配置したもののmingold(once_min_count=1)
		var remain_count = count;
		var materials = fixed_cards.concat();
		for (var i=unresolved_stacks.length-1; i>=0; i--) {
			if (remain_count <= 0) break;
			var c = Math.min(remain_count, unresolved_stacks[i].count);
			for (var j=0; j<c; j++) materials.push(unresolved_stacks[i].card);
			remain_count -= c;
		}
		var pw = calc_mingold_powerup(base_exp, goal_exp, materials, limit_level, exp_table, gold_table, 1, GREAT_NOTHING);
		calc_count++;
		
		lower_gold_cache[count] = pw.gold_to_powerup;
		return pw.gold_to_powerup;
	}
}



// ゴールド優先探索(最後だけ大成功)
function calc_mingold_lastgreat_of_s_simple(base_exp, goal_exp, arg_stacks, limit_level, exp_table, gold_table, once_min_count){
	// 念の為
	var stacks = FKGCardStack.duplicate(arg_stacks);
	
	// all-in の cards
	var fixed_stacks = new Array;
	var fixed_cards;
	// all-in でない
	var unresolved_stacks = new Array;
	
	FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
	fixed_cards = FKGCardStack.toCards(fixed_stacks, true);
	
	fixed_cards.sort(FKGCard.exp_less);
	unresolved_stacks.sort(FKGCardStack.exp_greater);
	
	var require_exp = goal_exp - base_exp;
	var temp_cards = new Array;
	
	// 最小を与える組み合わせ
	var min_gold = Infinity;
	var min_solution = null;
//	var min_succeed_cards = null;
//	var min_great_cards = null;
//	var min_residue_stacks = null; // 残りの unresolved_stacks
//	var min_unresolved_stacks = null;
	
	
	// 大成功に入る固定の数で場合分け
	for (var n=0; n<=10; n++) {
		if (fixed_cards.length < n) break;
		
		// 分割位置
		var spos = fixed_cards.length - n;
		// 固定n枚を大成功にする
		var succeed_exp = 0;
		var great_exp = 0;
		//for (var i=spos; i<fixed_cards.length; i++)
		for (var i=0; i<fixed_cards.length; i++)
		{
			if (i >= spos) {
				great_exp += fixed_cards[i].exp_as_feed * 1.5;
			} else {
				succeed_exp += fixed_cards[i].exp_as_feed;
			}
		}
		
		// 残りの大成功枚数(最大)
		var m = 10 - n;
		// 大きい方から追加していく
		for (var i=0; i<m; i++) {
			if (Math.ceil(succeed_exp) + Math.ceil(great_exp) >= require_exp) break;
			//if (Math.ceil(great_exp) >= require_exp) break;
			
			var card = FKGCardStack.pop(unresolved_stacks);
			if (!card) break;
			
			great_exp += card.exp_as_feed * 1.5;
			temp_cards.unshift(card);
		}
		
		// 「成功」に追加するカード
		var succeed_fixed_cards = fixed_cards.slice(0, spos);
		
		var pl;
		// 成功の部分
		//if (succeed_exp + great_exp < require_exp)
		if (Math.ceil(succeed_exp) + Math.ceil(great_exp) < require_exp)
		{
			// 足りないので、unresolved_stacks から選んで追加を検討
			var succeed_stacks = FKGCardStack.duplicate(fixed_stacks);
			FKGCardStack.fromCards(succeed_stacks, succeed_fixed_cards);
			succeed_stacks = succeed_stacks.concat(unresolved_stacks);
			// 固定はこっちでも固定
			pl = calc_mingold_powerup_of_s(base_exp, goal_exp - Math.ceil(great_exp), succeed_stacks, limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
			
		} else {
			// すでに経験値条件は満たしている
			pl = calc_mingold_powerup(base_exp, goal_exp - Math.ceil(great_exp), succeed_fixed_cards, limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
			pl.completed = true;
		}
		
		// goal_exp - great_exp まで強化できれば pl.completed が true
		
		// 大成功を付け加える
		var min_completed = min_solution && min_solution.completed;
		if (pl.completed || !min_completed) {
			// 「大成功」のカードも最適とは限らない
			// 未使用カードを計算
			var unres = FKGCardStack.duplicate(unresolved_stacks);
			FKGCardStack.fromCards(unres, temp_cards);
			for (var i=0; i<pl.list.length; i++) {
				FKGCardStack.removeCards(unres, pl.list[i].materials); // fixedは無視される
			}
			var unres_fixed = FKGCardStack.duplicate(fixed_stacks);
			FKGCardStack.fromCards(unres_fixed, fixed_cards.slice(spos));
			
			// unres, unres_fixed が残っているカード(stack)
			var pl2 = calc_mingold_powerup_of_s(pl.end_experience, goal_exp, unres.concat(unres_fixed),
				limit_level, exp_table, gold_table, 10, GREAT_ALL);
			
			if (pl2.list.length == 1) {
				var once = pl2.list[0];
				once.number = pl.list.length + 1;
				once.total_gold_to_powerup = pl.gold_to_powerup + once.gold_to_powerup;
				
				pl.push_back(once);
				
			} else {
				// 素材0枚だとここにくるかも
			}
			
			// 最小を更新したら記録
			if ( (!min_completed && (pl.completed || pl.gold_to_powerup < min_gold))
				|| (min_completed && pl.gold_to_powerup < min_gold) )
			{
				min_gold = pl.gold_to_powerup;
				min_solution = pl;
			}
		}
		
		// 戻す
		for (var i=0; i<temp_cards.length; i++) {
			FKGCardStack.push(unresolved_stacks, temp_cards[i]);
		}
		temp_cards.length = 0;
	}
	
	var solution = min_solution;
	
	if (solution) {
		// コメントの編集
		var p_compl = fixed_cards.length >= 1 ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
		solution.setOnceComments(1, goal_exp, p_compl, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
	} else {
		solution = new PowerupList(base_exp);
	}
	
	return solution;
}


// ゴールド優先探索(最後だけ大成功)
// 最後の「成功」からの続きも計算する
function calc_mingold_lastgreat_of_s(base_exp, goal_exp, arg_stacks, limit_level, exp_table, gold_table, once_min_count){
	var stacks = FKGCardStack.duplicate(arg_stacks);
	var solution = calc_mingold_lastgreat_of_s_simple(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count);
	
	if (solution && solution.list.length >= 1) {
		// 続きの計算
		var last_once = solution.list[solution.list.length - 1];
		var succeed_exp = last_once.before_experience + last_once.recalcExp(false);
		var once_count = solution.list.length;
		var total_gold = solution.gold_to_powerup;
		
		var fixed_stacks = new Array;
		var unresolved_stacks = new Array;
		FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
		// 使ったカードを除外
		// これで unresolved_stacks が残りのカード、固定はもうない
		_remove_list_cards(unresolved_stacks, solution);
		
		while (succeed_exp < goal_exp) {
			// 成功からの計算
			var pl = calc_mingold_lastgreat_of_s_simple(succeed_exp, goal_exp, unresolved_stacks, limit_level, exp_table, gold_table, once_min_count);
			
			if (!pl.completed) break;
			
			// solutionへの追加
			for (var i=0; i<pl.list.length; i++) {
				var once = pl.list[i];
				once.number = ++once_count;
				total_gold += once.gold_to_powerup;
				once.total_gold_to_powerup = total_gold;
				
				if (i == pl.list.length - 1) {
					// ラストはやっぱり成功扱いで続行
					once.suppose_great = false;
					once.gain_experience = once.recalcExp(false);
					once.end_experience = once.before_experience + once.gain_experience;
					last_once = once;
				}
				solution.push_back(once, 2);
			}
			
			// unresolved_stacks の更新
			_remove_list_cards(unresolved_stacks, pl);
			
			succeed_exp = last_once.end_experience;
		}
		
		// コメントの(追加)編集
		if (solution.sublist.length >= 1) {
			solution.setLastComment(1, COMMENT_TO_NTH(solution.list.length + 1), COMMENT_COMPLETE);
			solution.setOnceComments(2, goal_exp, COMMENT_COMPLETE, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
		}
	}
	
	return solution;
	
	
	// stackからplで使用したカードを取り除く
	function _remove_list_cards(stacks, pl){
		for (var i=0; i<pl.list.length; i++) {
			FKGCardStack.removeCards(stacks, pl.list[i].materials);
		}
	}
}


// 経験値優先で、個数だけを計算する
// stacksは保存、解なしは null
function calc_minexp_counts_of_s(require_exp, stacks, great){
	var knapsack_items = new Array;
	for (var i=0; i<stacks.length; i++) {
		var card = stacks[i].card;
		var exp = card.exp_as_feed;
		if (great) exp = exp * 1.5;
		knapsack_items[i] = new KnapsackItem(card.name, card.value_as_feed, exp, stacks[i].count, card.priority);
	}
	
	preserve_indices(knapsack_items);
	var sol = solve_conjugate_knapsack(knapsack_items, require_exp);
	
	var counts = null;
	if (sol) {
		restore_indices(knapsack_items, sol.counts);
		counts = sol.counts;
	}
	return counts;
}


// 経験値優先探索
function calc_minexp_powerup_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count){
	// 固定
	var fixed_stacks = new Array;
	var fixed_cards = new Array;
	var fixed_exp = 0;
	// 選択
	var unresolved_stacks = new Array;
	
	FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
	
	for (var i=0; i<fixed_stacks.length; i++) {
		for (var j=0; j<fixed_stacks[i].count; j++) {
			fixed_cards.push(fixed_stacks[i].card);
		}
		fixed_exp += fixed_stacks[i].card.exp_as_feed * fixed_stacks[i].count;
	}
	
	var remain_exp = goal_exp - base_exp - fixed_exp;
	var materials = fixed_cards;
	var completed = remain_exp <= 0;
	
	if (!completed) {
		var counts = calc_minexp_counts_of_s(remain_exp, unresolved_stacks, false);
		completed = counts != null;
		
		if (!completed) {
			// 足りないが全部使う
			counts = new Array;
			for (var i=0; i<unresolved_stacks.length; i++) {
				counts[i] = unresolved_stacks[i].count;
			}
		}
		
		for (var i=0; i<unresolved_stacks.length; i++) {
			for (var c=0; c<counts[i]; c++) {
				materials.push(unresolved_stacks[i].card);
			}
		}
	}
	
	// かかるゴールドを計算して返す
	var pl = calc_mingold_powerup(base_exp, goal_exp, materials, limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
	pl.completed = completed;
	
	var p_compl = fixed_exp > 0 ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
	pl.setOnceComments(1, goal_exp, p_compl, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
	
	return pl;
}


// 経験値優先探索(最後だけ大成功)
function calc_minexp_lastgreat_of_s_simple(base_exp, goal_exp, original_stacks, limit_level, exp_table, gold_table, once_min_count){
	// 必ず使う素材があると、大成功に入れるか成功に入れるかの選択があって厄介
	var stacks = FKGCardStack.duplicate(original_stacks);
	
	// all-in の cards
	var fixed_stacks = new Array;
	var fixed_cards;
	// all-in でない
	var unresolved_stacks = new Array;
	
	FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
	fixed_cards = FKGCardStack.toCards(fixed_stacks, false);
	
	fixed_cards.sort(FKGCard.exp_less);
	unresolved_stacks.sort(FKGCardStack.exp_greater);
	
	var require_exp = goal_exp - base_exp;
	var temp_cards = new Array;
	
	// 最小を与える組み合わせ
//	var min_exp = Infinity;
	var min_value = Infinity;
	var min_succeed_exp = Infinity;
	
	var min_succeed_cards = null;
	var min_great_cards = null;
	var min_residue_stacks = null; // 残りの unresolved_stacks
//	var min_solution = null;
	
	
	// 大成功に入る固定の数で場合分け
	for (var n=0; n<=10; n++) {
		if (fixed_cards.length < n) break;
		
		// 固定n枚を大成功にする
		var succeed_exp = 0;
		var great_exp = 0;
		// これを最小にするように選択していく
		var succeed_value = 0;
		var great_value = 0;
		
		var spos = fixed_cards.length - n;
		for (var i=0; i<fixed_cards.length; i++) {
			if (i >= spos) {
				great_exp = fixed_cards[i].exp_as_feed * 1.5;
				great_value += fixed_cards[i].value_as_feed;
			} else {
				succeed_exp += fixed_cards[i].exp_as_feed;
				succeed_value += fixed_cards[i].value_as_feed;
			}
		}
		
		var fixed_great_exp = great_exp;
		var fixed_great_value = great_value;
		
		// 残りの大成功枚数(最大)
		var m = 10 - n;
		// 仮大成功、大きい方から追加していく
		for (var i=0; i<m; i++) {
			if (Math.ceil(succeed_exp) + Math.ceil(great_exp) >= require_exp) break;
			
			var card = FKGCardStack.pop(unresolved_stacks);
			if (!card) break;
			
			great_exp += card.exp_as_feed * 1.5;
			great_value += card.value_as_feed;
			temp_cards.unshift(card);
		}
		
		// 「成功」に追加する枚数
		var counts = null;
		
		if (Math.ceil(succeed_exp) + Math.ceil(great_exp) < require_exp) {
			// 足りない
			counts = calc_minexp_counts_of_s(require_exp - (Math.ceil(succeed_exp) + Math.ceil(great_exp)), unresolved_stacks);
			if (counts) {
				// 十分
				for (var i=0; i<unresolved_stacks.length; i++) {
					succeed_exp += counts[i] * unresolved_stacks[i].card.exp_as_feed;
					succeed_value += counts[i] * unresolved_stacks[i].card.exp_as_feed;
				}
			}
		}
		
		// 経験値条件を満たす組み合わせ
		if (Math.ceil(succeed_exp) + Math.ceil(great_exp) >= require_exp) {
			// 大成功の部分はもっと小さくなるかもしれないので、再計算する
			
			// 未使用カード
			var unres = FKGCardStack.duplicate(unresolved_stacks);
			// 仮大成功のものを戻して
			FKGCardStack.fromCards(unres, temp_cards);
			// 成功利用分を除く
			if (counts) {
				for (var i=0; i<unres.length; i++) {
					unres[i].count -= counts[i];
				}
			}
			
			great_value = fixed_great_value;
			var require_great_exp = require_exp - fixed_great_exp - Math.ceil(succeed_exp);
			var free_count = m;
			var unres_great_cards = null;
			
			if (free_count > 0 && require_great_exp > 0) {
				// 大成功を再選択
				unres_great_cards = _get_great_n(require_great_exp, unres, free_count);
				
				for (var i=0; i<unres_great_cards.length; i++) {
					great_value += unres_great_cards[i].value_as_feed;
				}
			}
			
			var value = succeed_value + great_value;
			
			if (value < min_value || (value == min_value && succeed_exp < min_succeed_exp)) {
				min_value = value;
				min_succeed_exp = succeed_exp;
				
				var residue_stacks = FKGCardStack.duplicate(unresolved_stacks);
				// fixed_cardsを分割、counts[]枚を前方に、unres_great_cardsを後方に追加
				var succeed_cards = new Array;
				if (counts) {
					for (var i=0; i<residue_stacks.length; i++) {
						for (var j=0; j<counts[i]; j++) {
							succeed_cards.push(residue_stacks[i].card);
						}
						residue_stacks[i].count -= counts[i];
					}
				}
				succeed_cards = succeed_cards.concat(fixed_cards.slice(0, spos));
				
				var great_cards = fixed_cards.slice(spos);
				if (unres_great_cards) {
					great_cards = great_cards.concat(unres_great_cards);
				}
				
				// 計算はあとまわし
				min_succeed_cards = succeed_cards;
				min_great_cards = great_cards;
				min_residue_stacks = residue_stacks;
			}
		}
		
		// 戻す
		for (var i=0; i<temp_cards.length; i++) {
			FKGCardStack.push(unresolved_stacks, temp_cards[i]);
		}
		temp_cards.length = 0;
	}
	
	var solution = null;
	
	if (min_succeed_cards && min_succeed_cards.length == 0 && min_great_cards.length == 0) {
		// 強化の必要なし
		solution = new PowerupList(base_exp);
		
	} else if (min_succeed_cards) {
		// 強化パターンを計算する
		min_great_cards.sort(FKGCard.exp_less);
		
		solution = _mingold_lastgreat(min_succeed_cards, min_great_cards);
		solution.completed = true;
		
		// コメントの編集
		var p_compl = fixed_cards.length >= 1 ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
		solution.setOnceComments(1, goal_exp, p_compl, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
		
	} else {
		// 全部使っても目標レベルに到達しない
		fixed_cards = fixed_cards.concat(FKGCardStack.toCards(unresolved_stacks));
		fixed_cards.sort(FKGCard.exp_less);
		
		var glen = Math.min(fixed_cards.length, 10);
		var gpos = fixed_cards.length - glen;
		var succeed_cards = fixed_cards.slice(0, gpos);
		var great_cards = fixed_cards.slice(gpos);
		
		solution = _mingold_lastgreat(succeed_cards, great_cards);
		solution.setOnceComments(1, goal_exp, COMMENT_COMPLETE, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
	}
	
	return solution;
	
	
	function _mingold_lastgreat(succeed_cards, great_cards){
		// succeed_cardsで成功強化して
		var pl = calc_mingold_powerup(base_exp, goal_exp, succeed_cards, limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
		
		// 大成功の強化を付け加える
		if (great_cards && great_cards.length >= 1) {
			var pl2 = calc_mingold_powerup(pl.end_experience, goal_exp, great_cards, limit_level, exp_table, gold_table, 10, GREAT_ALL);
			var once = pl2.list[0];
			once.number = pl.list.length + 1;
			once.total_gold_to_powerup = pl.gold_to_powerup + once.gold_to_powerup;
			
			pl.push_back(once);
		}
		
		return pl;
	}
	
	// stacks から最大 n 枚選んで remain_exp 条件を満たすもののうち、価値が最小の組み合わせを探す
	// まあ10枚以下だし全探索でいってみよー
	// stacks は「経験値」が大きい方からソートされていると仮定する
	// 戻り値: cardの配列
	function _get_great_n(arg_remain_exp, arg_stacks, n){
		var cur_array = new Array;
		for (var i=0; i<arg_stacks.length; i++) {
			cur_array[i] = 0;
		}
		var min_value = Infinity;
		var min_select = null;
		if (arg_stacks.length >= 1 && n >= 1) {
			_get_great10_sub(cur_array, 0, arg_remain_exp, n, arg_stacks, 0);
		}
		
		var out = null;
		if (min_select) {
			out = new Array;
			for (var i=0; i<arg_stacks.length; i++) {
				for (var c=0; c<min_select[i]; c++) out.push(arg_stacks[i].card);
			}
		}
		return out;
		
		
		function _get_great10_sub(current, current_value, remain_exp, empty_count, stacks, pos){
			var st = stacks[pos];
			var card_exp = st.card.exp_as_feed * 1.5;
			var card_value = st.card.value_as_feed;
			
			var climit = Math.ceil(remain_exp / card_exp);
			// 簡易：もしも[pos]のカード(枚数制限なし)で残りを埋めても足りないなら、もう条件を満たすことはない
			if (empty_count < climit) return false;
			
			var cmax = climit;
			if (cmax > st.count) cmax = st.count;
			if (cmax > empty_count) cmax = empty_count;
			
			for (var c=cmax; c>=0; c--) {
				current[pos] = c;
				
				var exp = remain_exp - card_exp * c;
				var value = current_value + card_value * c;
				var count = empty_count - c;
				
				if (exp <= 0) {
					// check
					if (value < min_value) {
						min_value = value;
						min_select = current.concat();
					}
					
				} else if (pos + 1 < stacks.length) { // count > 0
					// recursive
					if (!_get_great10_sub(current, value, exp, count, stacks, pos + 1)) {
						break;
					}
					
				} else {
					// pos == stacks.length - 1 なので、これ以上は意味がない
					break;
				}
			}
			
			current[pos] = 0;
			return true;
		}
	}
}


// 続きも計算
function calc_minexp_lastgreat_of_s(base_exp, goal_exp, arg_stacks, limit_level, exp_table, gold_table, once_min_count){
	var stacks = FKGCardStack.duplicate(arg_stacks);
	var solution = calc_minexp_lastgreat_of_s_simple(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count);
	
	if (solution && solution.list.length >= 1) {
		// 続きの計算
		var last_once = solution.list[solution.list.length - 1];
		var succeed_exp = last_once.before_experience + last_once.recalcExp(false);
		var once_count = solution.list.length;
		var total_gold = solution.gold_to_powerup;
		
		var fixed_stacks = new Array;
		var unresolved_stacks = new Array;
		FKGCardStack.separateFixedStacks(fixed_stacks, unresolved_stacks, stacks);
		// 使ったカードを除外
		// これで unresolved_stacks が残りのカード、固定はもうない
		_remove_list_cards(unresolved_stacks, solution);
		
		while (succeed_exp < goal_exp) {
			// 成功からの計算
			var pl = calc_minexp_lastgreat_of_s_simple(succeed_exp, goal_exp, unresolved_stacks, limit_level, exp_table, gold_table, once_min_count);
			
			if (!pl.completed) break;
			
			// solutionへの追加
			for (var i=0; i<pl.list.length; i++) {
				var once = pl.list[i];
				once.number = ++once_count;
				total_gold += once.gold_to_powerup;
				once.total_gold_to_powerup = total_gold;
				
				if (i == pl.list.length - 1) {
					// ラストはやっぱり成功扱いで続行
					once.suppose_great = false;
					once.gain_experience = once.recalcExp(false);
					once.end_experience = once.before_experience + once.gain_experience;
					last_once = once;
				}
				solution.push_back(once, 2);
			}
			
			// unresolved_stacks の更新
			_remove_list_cards(unresolved_stacks, pl);
			
			succeed_exp = last_once.end_experience;
		}
		
		// コメントの(追加)編集
		if (solution.sublist.length >= 1) {
			solution.setLastComment(1, COMMENT_TO_NTH(solution.list.length + 1), COMMENT_COMPLETE);
			solution.setOnceComments(2, goal_exp, COMMENT_COMPLETE, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
		}
	}
	
	return solution;
	
	
	// stackからplで使用したカードを取り除く
	function _remove_list_cards(stacks, pl){
		for (var i=0; i<pl.list.length; i++) {
			FKGCardStack.removeCards(stacks, pl.list[i].materials);
		}
	}
}


