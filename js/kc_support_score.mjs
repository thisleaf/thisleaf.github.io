// 編成を点数化する

export {
	SupportFleetScore,
	SupportShipScore,
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
	// 基本攻撃力合計
	total_basic_power: 0,
	// ボーナスで増えた火力
	total_bonus_power: 0,
	
	clear    : SupportFleetScore_clear,
	add      : SupportFleetScore_add,
	add_score: SupportFleetScore_add_score,
	sub      : SupportFleetScore_sub,
	sub_score: SupportFleetScore_sub_score,
	add_array: SupportFleetScore_add_array,
	compare  : SupportFleetScore_compare,
	compare2 : SupportFleetScore_compare2,
	compare_annealing: SupportFleetScore_compare_annealing,
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
	this.total_basic_power = 0;
	this.total_bonus_power = 0;
}

// ボーナス値は自動計算しない(先に計算しておく)
function SupportFleetScore_add(ssd, border_power = ssd.border_basic_power){
	let basic = ssd.get_basic_power(true);
	let border_basic_power = border_power;
	let acc = ssd.get_accuracy();
	
	this.unreached_power   += Math.min(basic - border_basic_power, 0);
	this.total_accuracy    += acc;
	this.total_accuracy_sq += acc * acc;
	this.total_basic_power += basic;
	this.total_bonus_power += ssd.get_bonus_firepower();
}

// 他のスコアを足す
// SupportShipScore も可
function SupportFleetScore_add_score(score){
	this.unreached_power   += score.unreached_power;
	this.total_accuracy    += score.total_accuracy;
	this.total_accuracy_sq += score.total_accuracy_sq || (score.total_accuracy * score.total_accuracy);
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
	this.total_basic_power -= basic;
	this.total_bonus_power -= ssd.get_bonus_firepower();
}

function SupportFleetScore_sub_score(score){
	this.unreached_power   -= score.unreached_power;
	this.total_accuracy    -= score.total_accuracy;
	this.total_accuracy_sq -= score.total_accuracy_sq || (score.total_accuracy * score.total_accuracy);
	this.total_basic_power -= score.total_basic_power;
	this.total_bonus_power -= score.total_bonus_power;
}

function SupportFleetScore_add_array(list){
	for (let i=0; i<list.length; i++) {
		let ssd = list[i];
		this.add(ssd, ssd.border_basic_power);
	}
}

function SupportFleetScore_compare(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	if (c == 0) c = b.total_accuracy_sq - this.total_accuracy_sq;
	if (c == 0) c = this.total_basic_power - b.total_basic_power;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

// こちらの比較関数は、目標火力まで到達していれば、火力の低いほうを選ぶ
function SupportFleetScore_compare2(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	if (c == 0) c = b.total_accuracy_sq - this.total_accuracy_sq;
	if (c == 0) c = b.total_basic_power - this.total_basic_power;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

// 焼きなまし用
function SupportFleetScore_compare_annealing(b){
	let c = (this.unreached_power - b.unreached_power) * 1000;
	if (c == 0) c = (this.total_accuracy - b.total_accuracy) * 100;
	if (c == 0) c = (b.total_accuracy_sq - this.total_accuracy_sq) * 0.1;
	if (c == 0) c = (this.total_basic_power - b.total_basic_power) * 10;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
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
	total_basic_power: 0,
	total_bonus_power: 0,
	
	clear    : SupportShipScore_clear,
	add      : SupportShipScore_add,
	compare  : SupportShipScore_compare,
	compare2 : SupportShipScore_compare2,
	clone    : SupportShipScore_clone,
});

function SupportShipScore(ssd, basic_power){
	if (ssd) this.add(ssd, basic_power);
}

// newしたほうが速そう
function SupportShipScore_clear(){
	this.unreached_power   = 0;
	this.total_accuracy    = 0;
	this.total_basic_power = 0;
	this.total_bonus_power = 0;
}

function SupportShipScore_add(ssd, basic_power = ssd.border_basic_power, test){
	let basic = ssd.get_basic_power(true);
	let acc = ssd.get_accuracy();
	
	this.unreached_power   += Math.min(basic - basic_power, 0);
	this.total_accuracy    += acc;
	this.total_basic_power += basic;
	this.total_bonus_power += ssd.get_bonus_firepower();
}

function SupportShipScore_compare(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	if (c == 0) c = this.total_basic_power - b.total_basic_power;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

function SupportShipScore_compare2(b){
	let c = this.unreached_power - b.unreached_power;
	if (c == 0) c = this.total_accuracy - b.total_accuracy;
	if (c == 0) c = b.total_basic_power - this.total_basic_power;
	if (c == 0) c = this.total_bonus_power - b.total_bonus_power;
	return c;
}

function SupportShipScore_clone(){
	return Object.assign(new SupportShipScore, this);
}

