
import * as Global from "./kc_support_global.mjs";
import * as Util from "./utility.mjs";
import * as Damage from "./kc_damage_utility.mjs";

export {
	AttackScoreCalc,
};


/**
 * 仮想敵を設定して確率計算を行う
 * 現在は全て支援艦隊用
 */
class AttackScoreCalc {
	// 敵データ
	hp = -1;
	armor = -1; // >= 1
	evasion = -1;
	luck = -1;

	atk_condition = Global.CONDITION_NORMAL;
	atk_formation_id = 1;
	def_formation_id = 1;
	engagementform_id = 1; // このクラスの計算には不要だがついでに
	need_damage = 0; // 0の場合は命中率最適化となる

	// 上のデータから計算されるデータ
	// prepare() でセットされる
	// 命中の修正
	atk_condition_modify = 1;
	atk_formation_modify = 1;
	// def_condition_modify;
	def_formation_modify = 1;
	basic_evasion = 0;
	evasion_part = 0;
	// 火力の修正
	// キャップ前 = 基本攻撃力 * 交戦形態 * 陣形 (* 損傷)
	formation_power = 1;
	engagement_power = 1;
	// 火力ボーダー (最終攻撃力)
	power_supremum = 0;
	power_infimum = 0;
	// 命中ボーダー
	accuracy_supremum = 0;
	accuracy_infimum = 0;
	// 定義object
	atk_formation_def = null;
	def_formation_def = null;
	exc_formation_def = null;
	engagementform_def = null;

	// 命中定数
	hit_constant = Global.SUPPORT_HIT_CONSTANT;

	// 直前に計算したスコア
	score = 0;
	score_c = 0;

	// 各種修正
	get power_modify(){
		return this.formation_power * this.engagement_power;
	}
	get accuracy_modify(){
		return this.atk_formation_modify * this.atk_condition_modify;
	}
	get evasion_modify(){
		return this.def_formation_modify;
	}


	/**
	 * 敵データを EnemyStatusData から設定
	 * emptyでもよい
	 * @param {EnemyStatusData} st
	 */
	setEnemyStatus(st){
		this.hp = st.HP;
		this.armor = st.armor;
		this.evasion = st.evasion;
		this.luck = st.luck;
	}
	/**
	 * 複製
	 * @returns {AttackScoreCalc}
	 */
	clone(){
		let asc = new AttackScoreCalc();
		Object.assign(asc, this);
		return asc;
	}
	/**
	 * 計算可能であるかどうか (各パラメータが設定されている)
	 * @returns {boolean}
	 */
	good(){
		return (
			// NOTE: 警戒陣は現在利用不可とする
			this.atk_formation_id != 6 &&
			this.hp >= 1 &&
			this.armor >= 1 &&
			this.evasion >= 0 &&
			this.luck >= 0
		);
	}
	/**
	 * 各種パラメータを設定したあと、計算前に呼ぶ
	 */
	prepare(){
		let find = (def, func, dfunc = (x, i) => i == 0) => def.find(func) || (dfunc ? def.find(dfunc) : null);

		let cond = find(Global.CONDITION_MODIFY          , x => x.id == this.atk_condition);
		let af   = find(Global.FORMATION_DEFINITION_EX   , x => x.atk && x.id == this.atk_formation_id);
		let df   = find(Global.FORMATION_DEFINITION_EX   , x => x.def && x.id == this.def_formation_id);
		let exc  = find(Global.FORMATION_EXCEPTION       , x => x.atk_id == this.atk_formation_id && x.def_id == this.def_formation_id, null);
		let eng  = find(Global.ENGAGEMENT_FORM_DEFINITION, x => x.id == this.engagementform_id);

		this.atk_formation_def = af;
		this.def_formation_def = df;
		this.exc_formation_def = exc;
		this.engagementform_def = eng;

		// 命中: キラ補正
		this.atk_condition_modify = cond?.accuracy ?? 1.0;
		// 命中: 陣形補正
		// 攻撃側陣形と防御側陣形の2変数関数と考える？
		this.atk_formation_modify = exc ? exc.accuracy : (!af || af?.combined || df?.combined) ? 1.0 : af.accuracy;
		// 回避: 陣形補正
		// 防御側陣形(と艦の位置)の関数
		this.def_formation_modify = df?.evasion ?? 1.0;
		// 基本回避
		this.basic_evasion = this.evasion >= 0 && this.luck >= 0 ? this.evasion + Math.sqrt(2 * this.luck) : 0;
		// 回避項 = evadecap(陣形補正 * {素回避 + 装備回避 + sqrt(2 * 運)})
		this.evasion_part = Damage.evadecap(this.def_formation_modify * this.basic_evasion);

		// 攻撃力修正
		this.formation_power = (af.combined || df.combined) ? 1.0 : af.power;
		this.engagement_power = eng.support;
		// (最終)攻撃力の上限・下限
		// x >= power_supremum の攻撃力に対して、命中時の結果が全て同じとなる
		// x <= power_infimum の攻撃力に対して、命中時の結果が全て同じとなる
		/*
		 * [A - D] >= need for all D となる最小のAが上限
		 * A >= need + D (∀D)
		 * supremum = ceil(need + maxD)
		 * maxD = armor * 0.7 + (floor(armor) - 1) * 0.6
		 * 
		 * [B - D] < need for all D
		 * B - D < need
		 * B < need + D
		 * B < ceil(need + D)
		 * infimum = ceil(need + minD) - 1
		 */
		if (this.need_damage > 0) {
			let max_def = this.armor * 0.7 + (Math.floor(this.armor) - 1) * 0.6;
			let min_def = this.armor * 0.7;
			this.power_supremum = Math.ceil(this.need_damage + max_def);
			this.power_infimum = Math.ceil(this.need_damage + min_def) - 1;
		} else {
			this.power_supremum = -Infinity;
			this.power_infimum = Infinity;
		}
		/* 命中率の上限・下限
		 * a_part - evp = M
		 * [[hit_constant + accuracy] * atk_formation_modify * atk_condition_modify] = M + evp
		 * M + evp <= [hit_constant + accuracy] * atk_formation_modify * atk_condition_modify < M + evp + 1
		 * (M + evp) / mod <= [hit_constant + accuracy] < (M + evp + 1) / mod
		 * ceil((M + evp) / mod) <= hit_constant + accuracy < ceil((M + evp + 1) / mod)
		 * ceil((M + evp) / mod) - hit_constant <= accuracy < ceil((M + evp + 1) / mod) - hit_constant
		 */
		// 大体の値 (計算誤差を含むはず)
		let sup = Math.ceil((96 + this.evasion_part) / this.atk_condition_modify / this.atk_formation_modify) - this.hit_constant;
		let inf = Math.ceil((10 + this.evasion_part + 1) / this.atk_condition_modify / this.atk_formation_modify) - this.hit_constant - 1;
		
		let prob = acc => Math.floor(Math.floor(this.hit_constant + acc) * this.atk_formation_modify * this.atk_condition_modify) - this.evasion_part;
		if (prob(sup) < 96) sup++; else if (prob(sup - 1) >= 96) sup--;
		if (prob(inf) > 10) inf--; else if (prob(inf + 1) < 10) inf++;

		this.accuracy_supremum = sup;
		this.accuracy_infimum = inf;
	}

	/**
	 * 撃沈、大破、中破、小破に必要なダメージ
	 * @returns {number[]}
	 */
	getNeedBorders(){
		return [
			this.hp,
			Math.ceil(this.hp * 0.75),
			Math.ceil(this.hp * 0.5),
			Math.ceil(this.hp * 0.25),
			0,
		];
	}

	/**
	 * 命中率*100を返す
	 * この値にはクリティカル率が含まれる
	 * @param {number} accuracy 2 * sqrt(lv) + 1.5 * sqrt(luck) + 装備命中
	 * @returns {number}
	 */
	getHitProb100(accuracy){
		// 命中項
		let a_part = Math.floor(Math.floor(this.hit_constant + accuracy) * this.atk_formation_modify * this.atk_condition_modify);
		// 回避項 = this.evasion_part
		// 命中値
		let p0 = Math.min(Math.max(a_part - this.evasion_part, 10), 96);
		// 命中率 *100 (クリティカルを含む)
		return p0 + 1;
	}
	/**
	 * CL2の確率*100を返す
	 * @param {number} hit_prob 命中率*100
	 * @returns {number}
	 */
	toCL2Prob100(hit_prob){
		return Math.floor(Math.sqrt(hit_prob)) + 1;
	}

	/**
	 * スコアの計算
	 * this.score, this.score_c にも格納される
	 * @param {number} cl1_power CL1攻撃力
	 * @param {number} accuracy 2 * sqrt(lv) + 1.5 * sqrt(luck) + 装備命中
	 * @returns {number} this.score_c
	 */
	getScoreC(cl1_power, accuracy){
		// 命中率 *100 (クリティカルを含む)
		let p = this.getHitProb100(accuracy);
		// クリティカル率 *100
		// 探索のために、切り捨てずなめらかにする
		let p_cl2_c = Math.sqrt(p) + 1;
		let p_cl2 = Math.floor(p_cl2_c);
		// CL1 *100
		let p_cl1_c = p - p_cl2_c;
		let p_cl1 = p - p_cl2;

		// 命中時のスコア
		let cl1_score_onhit = this.getScoreOnHit(cl1_power);
		let cl2_score_onhit = this.getScoreOnHit(Math.floor(cl1_power * 1.5));
		// 合計スコア
		this.score = (p_cl1 * cl1_score_onhit + p_cl2 * cl2_score_onhit) * 0.01;
		this.score_c = (p_cl1_c * cl1_score_onhit + p_cl2_c * cl2_score_onhit) * 0.01;
		return this.score_c;
	}
	/**
	 * 命中時、カスダメを除く this.need_damage 以上のダメージが出る確率を計算
	 * @param {number} power 最終攻撃力
	 * @returns {number} prob
	 */
	getScoreOnHit(power){
		// 0は攻撃不可を表す
		if (power <= 0) return 0;
		// 命中率計算モード
		if (this.need_damage <= 0) return 1;
		/*
		 * [A - D] >= need
		 * A - D >= need
		 * A - need >= D = a * 0.7 + r * 0.6
		 * r * 0.6 <= A - need - a * 0.7
		 * r <= (A - need - a * 0.7) / 0.6
		 * 計算誤差に注意
		 */
		let rmax = Math.floor(this.armor) - 1;
		// パターン数
		let r = Math.floor((power - this.need_damage - this.armor * 0.7) / 0.6);
		r = Math.min(Math.max(r, -1), rmax);
		if (r < rmax && power - (this.armor * 0.7 + (r + 1) * 0.6) >= this.need_damage) {
			r++;
		}
		return (r + 1) / (rmax + 1);
	}
	/**
	 * 数え上げで実装、確認用
	 * @param {number} power 最終攻撃力
	 * @returns {number} prob
	 */
	getScoreOnHit2(power){
		if (this.need_damage <= 0) return 1;
		let rlim = Math.floor(this.armor);
		let c = 0;
		for (let r=0; r<rlim; r++) {
			if (power - (this.armor * 0.7 + r * 0.6) >= this.need_damage) {
				c++;
			}
		}
		return c / rlim;
	}

	/**
	 * 攻撃後の撃沈、大破、中破、小破、表示なし確率を返す
	 * @param {number} cl1_power CL1攻撃力
	 * @param {number} accuracy 命中、整数でなくてもよい
	 * @return {number[]} number[5]
	 */
	getProbs(cl1_power, accuracy){
		let p = this.getHitProb100(accuracy);
		let p_cl2 = this.toCL2Prob100(p);
		let p_cl1 = p - p_cl2;

		let cl1_onhit = this.getProbsOnHit(cl1_power);
		let cl2_onhit = this.getProbsOnHit(Math.floor(cl1_power * 1.5));

		let probs = [];
		for (let i=0; i<cl1_onhit.length; i++) {
			probs[i] = (p_cl1 * cl1_onhit[i] + p_cl2 * cl2_onhit[i]) * 0.01;
		}
		return probs;
	}

	/**
	 * 攻撃命中時の撃沈、大破、中破、小破、表示なし確率を返す
	 * @param {number} power 最終攻撃力
	 * @return {number[]} number[5]
	 */
	getProbsOnHit(power){
		if (this.need_damage <= 0) return [0, 0, 0, 0, 1];

		let rlim = Math.floor(this.armor);
		let hp = this.hp;
		let counts = [0, 0, 0, 0, 0];
		for (let r=0; r<rlim; r++) {
			let dmg = Math.floor(power - (this.armor * 0.7 + r * 0.6));
			let idx = Math.ceil((hp - dmg) * 4 / hp);
			if (idx < 0) idx = 0;
			else if (idx > 4) idx = 4;
			counts[idx]++;
		}
		for (let i=0; i<counts.length; i++) counts[i] /= rlim;
		return counts;
	}
};

