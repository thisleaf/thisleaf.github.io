
function powerup2_rearrangement(pl, base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count){
	let has_fixed = false;
	for (let i=0; i<stacks.length; i++) {
		// ソート用
		stacks[i].card.fixed = stacks[i].allin ? 1 : 0;
		
		if (stacks[i].allin && stacks[i].count > 0) {
			has_fixed = true;
		}
	}
	
	for (let pos=0; pos<pl.list.length; pos++) {
		let once = pl.list[pos];
		
		// LvMax後の強化はスルー
		if (once.before_experience >= goal_exp) break;
		
		// もしこの回で大成功が発生した時、完全に無駄になってしまうカードがあったら除外して後ろを再配置する
		let great_end = once.before_experience + once.recalcExp(true);
		if (great_end < goal_exp) continue;
		
		// 固定を前に
		let materials = once.materials.concat();
		materials.sort(function (a, b){
			let c = b.fixed - a.fixed;
			if (c == 0) c = FKGCard.exp_less(a, b);
			return c;
		});
		
		let removable = 0;
		for (let i=1; i<materials.length; i++) {
			// 0 .. i-1 のi枚のカードで強化を考える
			let gain_exp = PowerupOnce.calcExp(materials, 0, i, true);
			if (once.before_experience + gain_exp >= goal_exp) {
				removable = materials.length - i;
				break;
			}
		}
		if (removable == 0) continue;
		
		// 再配置
		// 固定が選択される可能性があるが難解なので仕様とする
		let rearranges = materials.slice(-removable);
		rearranges.sort(FKGCard.exp_less);
		
		// 後方は無効になる
		for (let i=pos+1; i<pl.list.length; i++) {
			rearranges = rearranges.concat(pl.list[i].materials);
		}
		// onceまで除外
		while (pl.list.length > pos) {
			pl.pop_back(1);
		}
		
		// onceから除外
		once.materials = materials.slice(0, -removable);
		once.materials.sort(FKGCard.exp_less);
		//once.mat_end -= removable;
		once.gold_to_powerup = gold_table[once.before_level - 1] * once.materials.length;
		once.total_gold_to_powerup = pl.gold_to_powerup + once.gold_to_powerup;
		once.gain_experience = once.recalcExp(true);
		once.end_experience = once.before_experience + once.gain_experience;
		//once.comment_succeed = COMMENT_TO_NTH(once.number + 1);
		
		pl.push_back(once, 1);
		
		
		let last_once = once;
		let end_exp = once.before_experience + once.recalcExp(false);
		let total_gold = pl.gold_to_powerup;
		let next_number = once.number + 1;
		
		while (rearranges.length > 0) {
			let materials = new Array;
			let gain_exp = 0;
			let ilim = Math.min(rearranges.length, 10);
			
			for (let i=0; i<ilim; i++) {
				materials.push(rearranges[i]);
				
				// 最大まで強化されているなら分割する意味はないので
				if (end_exp < goal_exp) {
					let great_exp = PowerupOnce.calcExp(materials, 0, i + 1, true);
					if (end_exp + great_exp >= goal_exp) break;
				}
			}
			
			rearranges = rearranges.slice(materials.length);
			
			let once = new PowerupOnce;
			once.materials = materials;
			
			once.before_experience = end_exp;
			once.before_level = exp_to_level(end_exp, limit_level, exp_table);
			once.gold_to_powerup = gold_table[once.before_level - 1] * materials.length;
			total_gold += once.gold_to_powerup;
			once.total_gold_to_powerup = total_gold;
			once.suppose_great = false;
			
			once.gain_experience = once.recalcExp(false);
			end_exp += once.gain_experience;
			once.end_experience = end_exp;
			once.number = next_number++;
			
			pl.push_back(once, 2);
		}
		
		// コメント
		var p_comm = has_fixed ? COMMENT_POSSIBLY_COMPLETE : COMMENT_COMPLETE;
		pl.setOnceComments(1, goal_exp, null, null, p_comm, null);
		last_once.comment_succeed = COMMENT_TO_NTH(last_once.number + 1);
		pl.setOnceComments(2, goal_exp, p_comm, COMMENT_RECALC, COMMENT_COMPLETE, COMMENT_LACK);
		
		pl.use_sub = true;
		
		return true;
	}
	
	return false;
}



// 大成功なし(大成功考慮) x ゴールド優先
// まず大成功なしで計算するが、最後の方で大成功によるオーバー分があまり出ないように調整する
function calc_mingold_powerup2_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count){
	// ベース
	let pl = calc_mingold_powerup_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
	
	powerup2_rearrangement(pl, base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count);
	
	pl.comment_main = "大成功なし(大成功考慮)<br>想定最良値";
	pl.comment_sub  = "大成功なし(大成功考慮)<br>想定最悪値";
	
	return pl;
}


// 大成功なし(大成功考慮) x 経験値優先
function calc_minexp_powerup2_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count){
	// ベース
	let pl = calc_minexp_powerup_of_s(base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count, GREAT_NOTHING);
	
	powerup2_rearrangement(pl, base_exp, goal_exp, stacks, limit_level, exp_table, gold_table, once_min_count);
	
	pl.comment_main = "大成功なし(大成功考慮)<br>想定最良値";
	pl.comment_sub  = "大成功なし(大成功考慮)<br>想定最悪値";
	
	return pl;
}


