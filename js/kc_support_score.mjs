// 編成を点数化する

export {
	SupportFleetScore,
	SupportShipScore,
	SupportFleetScorePrior,
};


// SupportFleetScore -------------------------------------------------------------------------------
Object.assign(SupportFleetScore.prototype, {
	// 上から重要な要素
	
	// 攻撃力条件を満たした艦数
	//power_satisfied: 0,
	// Math.min(攻撃力 - 目標攻撃力, 0) の合計
	unreached_power: 0,
	// 命中合計
	total_accuracy: 0,
	// 最終攻撃力合計
	//total_final_power: 0,
	// 命中二乗和(艦ごと)
	total_accuracy_sq: 0,
	// 装備優先度
	total_priority: 0,
	// 基本攻撃力合計
	total_basic_power: 0,
	// ボーナスで増えた火力
	total_bonus_power: 0,
	
	clear    : SupportFleetScore_clear,
	copy_from: SupportFleetScore_copy_from,
	add      : SupportFleetScore_add,
	add_score: SupportFleetScore_add_score,
	sub      : SupportFleetScore_sub,
	sub_score: SupportFleetScore_sub_score,
	add_array: SupportFleetScore_add_array,
	compare  : SupportFleetScore_compare,
	compare_s1 : SupportFleetScore_compare_s1,
	compare_s2 : SupportFleetScore_compare_s2,
	compare_s3 : SupportFleetScore_compare_s3,
	compare_annealing : SupportFleetScore_compare_annealing,
	clone    : SupportFleetScore_clone,
});


// ssd_list は SupportShipData の配列
function SupportFleetScore(ssd_list){
	if (ssd_list) this.add_array(ssd_list);
}

function SupportFleetScore_clear(){
	this.unreached_power   = 0;
	this.total_accuracy    = 0;
	this.total_accuracy_sq = 0;
	this.total_priority    = 0;
	this.total_basic_power = 0;
	this.total_bonus_power = 0;
}

function SupportFleetScore_copy_from(src){
	this.unreached_power   = src.unreached_power  ;
	this.total_accuracy    = src.total_accuracy   ;
	this.total_accuracy_sq = src.total_accuracy_sq;
	this.total_priority    = src.total_priority   ;
	this.total_basic_power = src.total_basic_power;
	this.total_bonus_power = src.total_bonus_power;
}

// ボーナス値は自動計算しない(先に計算しておく)
function SupportFleetScore_add(ssd, border_power = ssd.border_basic_power){
	let basic = ssd.get_basic_power(true);
	let border_basic_power = border_power;
	let acc = ssd.get_accuracy();
	
	this.unreached_power   += Math.min(basic - border_basic_power, 0);
	this.total_accuracy    += acc;
	this.total_accuracy_sq += acc * acc;
	this.total_priority    += ssd.get_equipment_priority();
	this.total_basic_power += basic;
	this.total_bonus_power += ssd.get_bonus_firepower();
}

// 他のスコアを足す
// SupportShipScore も可
function SupportFleetScore_add_score(score){
	this.unreached_power   += score.unreached_power;
	this.total_accuracy    += score.total_accuracy;
	this.total_accuracy_sq += score.total_accuracy_sq || (score.total_accuracy * score.total_accuracy);
	this.total_priority    += score.total_priority;
	this.total_basic_power += score.total_basic_power;
	this.total_bonus_power += score.total_bonus_power;
}

function SupportFleetScore_sub(ssd, border_power = ssd.border_basic_power){
	let basic = ssd.get_basic_power(true);
	let border_basic_power = border_power;
	let acc = ssd.get_accuracy();
	
	this.unreached_power   -= Math.min(basic - border_basic_power, 0);
	this.total_accuracy    -= acc;
	this.total_accuracy_sq -= acc * acc;
	this.total_priority    -= ssd.get_equipment_priority();
	this.total_basic_power -= basic;
	this.total_bonus_power -= ssd.get_bonus_firepower();
}

function SupportFleetScore_sub_score(score){
	this.unreached_power   -= score.unreached_power;
	this.total_accuracy    -= score.total_accuracy;
	this.total_accuracy_sq -= score.total_accuracy_sq || (score.total_accuracy * score.total_accuracy);
	this.total_priority    -= score.total_priority;
	this.total_basic_power -= score.total_basic_power;
	this.total_bonus_power -= score.total_bonus_power;
}

function SupportFleetScore_add_array(list){
	for (let i=0; i<list.length; i++) {
		let ssd = list[i];
		this.add(ssd, ssd.border_basic_power);
	}
}

// 通常の比較関数
function SupportFleetScore_compare(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	if (c == 0) c = b.total_accuracy_sq - this.total_accuracy_sq;
	if (c == 0) c = this.total_priority - b.total_priority;
	if (c == 0) c = this.total_basic_power - b.total_basic_power;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

// 優先度の都合で、比較する要素を分けたい場合がある
// stage1: 基本
function SupportFleetScore_compare_s1(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	return c;
}
// stage2: やや品質に影響する
function SupportFleetScore_compare_s2(b){
	let c = b.total_accuracy_sq - this.total_accuracy_sq;
	if (c == 0) c = this.total_basic_power - b.total_basic_power;
	return c;
}
// stage3: ほか
function SupportFleetScore_compare_s3(b){
	let c = this.total_priority - b.total_priority;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

// 焼きなまし用
function SupportFleetScore_compare_annealing(b){
	let c = (this.unreached_power - b.unreached_power) * 1000;
	if (c == 0) c = (this.total_accuracy - b.total_accuracy) * 50;
	if (c == 0) c = (b.total_accuracy_sq - this.total_accuracy_sq) * 0.01;
	if (c == 0) c = (this.total_priority - b.total_priority);
	if (c == 0) c = (this.total_basic_power - b.total_basic_power) * 0.1;
	if (c == 0) c = (this.total_bonus_power - b.total_bonus_power) * 0.1;
	return c;
}

function SupportFleetScore_clone(){
	return Object.assign(new SupportFleetScore, this);
}


// SupportShipScore --------------------------------------------------------------------------------
// SupportFleetScore の単艦版
Object.assign(SupportShipScore.prototype, {
	unreached_power  : 0,
	total_accuracy   : 0,
	total_accuracy_sq: 0, // total_accuracy の2乗になるだけなので、高速化のため常に0とする
	total_priority   : 0,
	total_basic_power: 0,
	total_bonus_power: 0,
	
	clear    : SupportShipScore_clear,
	copy_from: SupportShipScore_copy_from,
	add      : SupportShipScore_add,
	compare  : SupportShipScore_compare,
	clone    : SupportShipScore_clone,
});

function SupportShipScore(ssd, basic_power){
	if (ssd) this.add(ssd, basic_power);
}

// newしたほうが速そう
function SupportShipScore_clear(){
	this.unreached_power   = 0;
	this.total_accuracy    = 0;
	this.total_priority    = 0;
	this.total_basic_power = 0;
	this.total_bonus_power = 0;
}

function SupportShipScore_copy_from(src){
	this.unreached_power   = src.unreached_power  ;
	this.total_accuracy    = src.total_accuracy   ;
	this.total_priority    = src.total_priority   ;
	this.total_basic_power = src.total_basic_power;
	this.total_bonus_power = src.total_bonus_power;
}

function SupportShipScore_add(ssd, basic_power = ssd.border_basic_power, test){
	let basic = ssd.get_basic_power(true);
	let acc = ssd.get_accuracy();
	
	this.unreached_power   += Math.min(basic - basic_power, 0);
	this.total_accuracy    += acc;
	this.total_priority    += ssd.get_equipment_priority();
	this.total_basic_power += basic;
	this.total_bonus_power += ssd.get_bonus_firepower();
}

function SupportShipScore_compare(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	if (c == 0) c = this.total_priority - b.total_priority;
	if (c == 0) c = this.total_basic_power - b.total_basic_power;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

function SupportShipScore_clone(){
	return Object.assign(new SupportShipScore, this);
}


// SupportFleetScorePrior --------------------------------------------------------------------------
// 優先度も考慮してのスコア
Object.defineProperties(SupportFleetScorePrior.prototype, {
	scores     : {value: null, writable: true}, // map: priority -> SupportFleetScore
	total_score: {get: SupportFleetScorePrior_get_total_score}, // 全合計
	
	clone            : {value: SupportFleetScorePrior_clone},
	copy_from        : {value: SupportFleetScorePrior_copy_from},
	copy_from2       : {value: SupportFleetScorePrior_copy_from2},
	add              : {value: SupportFleetScorePrior_add},
	add_array        : {value: SupportFleetScorePrior_add_array},
	sub              : {value: SupportFleetScorePrior_sub},
	sub_array        : {value: SupportFleetScorePrior_sub_array},
	compare_rigidly  : {value: SupportFleetScorePrior_compare_rigidly},
	compare_s1       : {value: SupportFleetScorePrior_compare_s1},
	compare_s2       : {value: SupportFleetScorePrior_compare_s2},
	compare_s3       : {value: SupportFleetScorePrior_compare_s3},
	compare_s1s2s3   : {value: SupportFleetScorePrior_compare_s1s2s3},
	compare_annealing: {value: SupportFleetScorePrior_compare_annealing},
	compare_accuracy : {value: SupportFleetScorePrior_compare_accuracy},
	get_total_score  : {value: SupportFleetScorePrior_get_total_score},
	set_json         : {value: SupportFleetScorePrior_set_json},
});

Object.defineProperties(SupportFleetScorePrior, {
	get_exp_weight      : {value: SupportFleetScorePrior_get_exp_weight},
	get_linear_weight   : {value: SupportFleetScorePrior_get_linear_weight},
	get_reci_weight     : {value: SupportFleetScorePrior_get_reci_weight},
	get_quadratic_weight: {value: SupportFleetScorePrior_get_quadratic_weight},
	get_identity_weight : {value: SupportFleetScorePrior_get_identity_weight},
	normalize_weight    : {value: SupportFleetScorePrior_normalize_weight},
	get_exp_weight_c    : {value: SupportFleetScorePrior_get_exp_weight_c},
	get_linear_weight_c : {value: SupportFleetScorePrior_get_linear_weight_c},
});


// 優先度の付け替えをしていたら priority_limit に length を指定
function SupportFleetScorePrior(ssd_list, priority_limit = 13){
	this.scores = new Array(priority_limit);
	if (ssd_list) this.add_array(ssd_list);
}

function SupportFleetScorePrior_clone(){
	let c = new SupportFleetScorePrior();
	c.scores = this.scores.map(x => x.clone());
	return c;
}

function SupportFleetScorePrior_copy_from(src){
	this.scores.length = src.scores.length;
	
	for (let i=0; i<src.scores.length; i++) {
		if (src.scores[i]) {
			if (!this.scores[i]) this.scores[i] = new SupportFleetScore();
			this.scores[i].copy_from(src.scores[i]);
		} else {
			delete this.scores[i];
		}
	}
}

function SupportFleetScorePrior_copy_from2(src, p1, p2){
	this.scores[p1].copy_from(src.scores[p1]);
	if (p2 >= 0 && p1 != p2) {
		this.scores[p2].copy_from(src.scores[p2]);
	}
}

function SupportFleetScorePrior_add(ssd, border_power = ssd.border_basic_power){
	let score = this.scores[ssd.priority];
	if (!score) {
		score = new SupportFleetScore();
		this.scores[ssd.priority] = score;
	}
	score.add(ssd, border_power);
}

function SupportFleetScorePrior_add_array(ssd_list){
	for (let i=0; i<ssd_list.length; i++) {
		let ssd = ssd_list[i];
		this.add(ssd, ssd.border_basic_power);
	}
}

function SupportFleetScorePrior_sub(ssd, border_power = ssd.border_basic_power){
	let score = this.scores[ssd.priority];
	if (!score) {
		score = new SupportFleetScore();
		this.scores[ssd.priority] = score;
	}
	score.sub(ssd, border_power);
}

function SupportFleetScorePrior_sub_array(ssd_list){
	for (let i=0; i<ssd_list.length; i++) {
		let ssd = ssd_list[i];
		this.sub(ssd, ssd.border_basic_power);
	}
}

// スコアオブジェクトの位置(優先度)が同じかどうかの確認用
// 他の比較関数はこれが0を仮定する
function SupportFleetScorePrior_compare_exists(b){
	for (let i=0; i<this.scores.length; i++) {
		let c = (this.scores[i] ? 1 : 0) - (b.scores[i] ? 1 : 0);
		if (c != 0) return c;
	}
	return 0;
}


// SupportFleetScore.compare() を使った比較
// 優先度が高い方を完璧にするが、それによって低い方の命中を損する場合がある
function SupportFleetScorePrior_compare_rigidly(b){
	for (let i=0; i<this.scores.length; i++) {
		if (this.scores[i]) {
			let c = this.scores[i].compare(b.scores[i]);
			if (c != 0) return c;
		}
	}
	return 0;
}

function SupportFleetScorePrior_compare_s1(b){
	for (let i=0; i<this.scores.length; i++) {
		if (this.scores[i]) {
			let c = this.scores[i].compare_s1(b.scores[i]);
			if (c != 0) return c;
		}
	}
	return 0;
}
function SupportFleetScorePrior_compare_s2(b){
	for (let i=0; i<this.scores.length; i++) {
		if (this.scores[i]) {
			let c = this.scores[i].compare_s2(b.scores[i]);
			if (c != 0) return c;
		}
	}
	return 0;
}
function SupportFleetScorePrior_compare_s3(b){
	for (let i=0; i<this.scores.length; i++) {
		if (this.scores[i]) {
			let c = this.scores[i].compare_s3(b.scores[i]);
			if (c != 0) return c;
		}
	}
	return 0;
}
function SupportFleetScorePrior_compare_s1s2s3(b){
	return this.compare_s1(b) || this.compare_s2(b) || this.compare_s3(b);
}

function SupportFleetScorePrior_compare_annealing(b, weight = null){
	if (1) {
		// 重みつきの和をとるパターン
		// こちらのほうが安定している？
		let c1_sum = 0;
		let c2_sum = 0;
		let c3_sum = 0;
		
		for (let i=0; i<this.scores.length; i++) {
			let a_score = this.scores[i];
			let b_score = b.scores[i];
			
			if (a_score) {
				let w = weight?.[i] || (this.scores.length - i) / this.scores.length;
				
				// stage1
				let c1 = 0;
				let und = (a_score.unreached_power - b_score.unreached_power) * 1000;
				// 流石に大きいのでちょっと細工してみる
				if (c1_sum == 0) { c1 += und; } else { c1 += und * 0.05; }
				c1 += (a_score.total_accuracy - b_score.total_accuracy) * 50;
				c1 *= w;
				c1_sum += c1;
				
				// stage2
				let c2 = (b_score.total_accuracy_sq - a_score.total_accuracy_sq) * 0.01;
				c2 += (a_score.total_basic_power - b_score.total_basic_power);
				c2 *= w;
				c2_sum += c2;
				
				// stage3
				let c3 = (a_score.total_priority - b_score.total_priority) * 0.1;
				c3 += (a_score.total_bonus_power - b_score.total_bonus_power) * 0.1;
				c3 *= w;
				c3_sum += c3;
			}
		}
		
		return c1_sum + c2_sum + c3_sum;
		
	} else if (0) {
		// 優先順位が高い方から比較するが、少しなめらかになるようにする
		let involve = (arg_x, arg_y) => {
			if (arg_x == 0) return arg_y;
			let z = arg_x;
			let m = Math.abs(arg_y) - 100 * Math.abs(arg_x);
			if (m > 0) z += arg_y > 0 ? m : - m;
			return z;
		};
		
		let c1 = 0;
		let c2 = 0;
		let c3 = 0;
		
		for (let i=0; i<this.scores.length; i++) {
			let a_score = this.scores[i];
			let b_score = b.scores[i];
			
			if (a_score) {
				let w = weight?.[i] || (this.scores.length - i) / this.scores.length;
				
				// stage1
				c1 = involve(c1, (a_score.unreached_power - b_score.unreached_power) * 1000 * w);
				c1 = involve(c1, (a_score.total_accuracy - b_score.total_accuracy) * 50 * w);
				// stage2
				c2 = involve(c2, (b_score.total_accuracy_sq - a_score.total_accuracy_sq) * 0.01 * w);
				c2 = involve(c2, (a_score.total_basic_power - b_score.total_basic_power) * w);
				// stage3
				c3 = involve(c3, (a_score.total_priority - b_score.total_priority) * 0.1 * w);
				c3 = involve(c3, (a_score.total_bonus_power - b_score.total_bonus_power) * 0.1 * w);
			}
		}
		
		return involve(involve(c1, c2), c3);
		
	} else {
		// 和ではなく優先順位が高い方から比較していくパターン
		let c2 = 0;
		let c3 = 0;
		
		for (let i=0; i<this.scores.length; i++) {
			let a_score = this.scores[i];
			let b_score = b.scores[i];
			
			if (a_score) {
				let w = weight?.[i] || (this.scores.length - i) / this.scores.length;
				
				// stage1
				let c1 = (a_score.unreached_power - b_score.unreached_power) * 1000;
				if (c1 == 0) c1 = (a_score.total_accuracy - b_score.total_accuracy) * 50;
				c1 *= w;
				if (c1 != 0) return c1;
				
				if (c2 != 0) continue;
				// stage2
				c2 = (b_score.total_accuracy_sq - a_score.total_accuracy_sq) * 0.1;
				if (c2 == 0) c2 = (a_score.total_basic_power - b_score.total_basic_power);
				c2 *= w;
				
				if (c2 != 0 || c3 != 0) continue;
				// stage3
				c3 = (a_score.total_priority - b_score.total_priority) * 0.1;
				if (c3 == 0) c3 = (a_score.total_bonus_power - b_score.total_bonus_power) * 0.1;
				c3 *= w;
			}
		}
		
		return c2 || c3;
	}
}

function SupportFleetScorePrior_compare_accuracy(b){
	for (let i=0; i<this.scores.length; i++) {
		let c = (this.scores[i] ? 1 : 0) - (b.scores[i] ? 1 : 0);
		if (c == 0 && this.scores[i]) {
			c = this.scores[i].total_accuracy - b.scores[i].total_accuracy;
		}
		if (c != 0) return c;
	}
	return 0;
}

function SupportFleetScorePrior_get_total_score(){
	let score = new SupportFleetScore();
	for (let i=0; i<this.scores.length; i++) {
		if (this.scores[i]) {
			score.add_score(this.scores[i]);
		}
	}
	return score;
}

// getのほうはそのままstringifyでよい
function SupportFleetScorePrior_set_json(json){
	for (let i=0; i<this.scores.length; i++) {
		if (json.scores[i]) {
			this.scores[i] = Object.assign(new SupportFleetScore(), json.scores[i]);
		} else {
			delete this.scores[i];
		}
	}
	return this;
}


// 重さ生成関数
// 1 / (base ** (n-1)) : 1, 1/2, 1/4, 1/8, ...
function SupportFleetScorePrior_get_exp_weight(base, length){
	let weight = [];
	for (let i=0; i<length; i++) weight[i] = 1 / (base ** i);
	return weight;
}
// (length - (n - 1)) / length : 1, 3/4, 2/4, 1/4 (length == 4)
function SupportFleetScorePrior_get_linear_weight(length){
	let weight = [];
	for (let i=0; i<length; i++) weight[i] = (length - i) / length;
	return weight;
}
// 1 / n : 1, 1/2, 1/3, 1/4, ...
function SupportFleetScorePrior_get_reci_weight(length){
	let weight = [];
	for (let i=0; i<length; i++) weight[i] = 1 / (i + 1);
	return weight;
}
// linearの2乗
function SupportFleetScorePrior_get_quadratic_weight(length){
	return SupportFleetScorePrior.get_linear_weight(length).map(x => x * x);
}
// 全て1
function SupportFleetScorePrior_get_identity_weight(length){
	return new Array(length).fill(1);
}

// やはり同一優先度の数も考慮に入れたほうがいい
// 艦の数を考慮して真ん中の点をとる

// 最初の要素に合わせる
function SupportFleetScorePrior_normalize_weight(weight){
	let w = weight[0];
	for (let i=0; i<weight.length; i++) weight[i] /= w;
	return weight;
}

function SupportFleetScorePrior_get_exp_weight_c(base, priority_counts){
	let weight = [];
	let pl = 0;
	for (let i=0; i<priority_counts.length; i++) {
		let pr = pl + priority_counts[i] - 1;
		let p = (pl + pr) / 2;
		weight[i] = 1 / (base ** p);
		pl += priority_counts[i];
	}
	return SupportFleetScorePrior.normalize_weight(weight);
}

function SupportFleetScorePrior_get_linear_weight_c(priority_counts){
	let weight = [];
	let sum = priority_counts.reduce((a, c) => a + c);
	let pl = 0;
	for (let i=0; i<priority_counts.length; i++) {
		let pr = pl + priority_counts[i] - 1;
		let p = (pl + pr) / 2;
		weight[i] = (sum - p) / sum;
		pl += priority_counts[i];
	}
	return SupportFleetScorePrior.normalize_weight(weight);
}

