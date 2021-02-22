/**
 * @fileoverview ダメージ等の計算関係
 * @module Damage
 */

// 順番も利用する
export const DAMAGE_KEYS = [
	"表示なし",
	"小破",
	"中破",
	"大破",
	"撃沈",
];


// IntegerDistribution -----------------------------------------------------------------------------
// begin <= x <= last の整数範囲の分布
// this[x] で値を扱う　undefinedは0とみなす
Object.assign(IntegerDistribution.prototype, {
	begin: 0,
	last : -1,
	
	set_range      : IntegerDistribution_set_range,
	adjust_range   : IntegerDistribution_adjust_range,
	clear          : IntegerDistribution_clear,
	size           : IntegerDistribution_size,
	clone          : IntegerDistribution_clone,
	clone_range    : IntegerDistribution_clone_range,
	// 自身を変更
	fill           : IntegerDistribution_fill,
	fill_range     : IntegerDistribution_fill_range,
	emptyfill_range: IntegerDistribution_emptyfill_range,
	scale          : IntegerDistribution_scale,
	normalize      : IntegerDistribution_normalize,
	add            : IntegerDistribution_add,
	sub            : IntegerDistribution_sub,
	add_scaling_of : IntegerDistribution_add_scaling_of,
	cum_extend     : IntegerDistribution_cum_extend,
	// 計算したものを返す
	sum            : IntegerDistribution_sum,
	cumulate       : IntegerDistribution_cumulate,
	convolve       : IntegerDistribution_convolve,
});


export function IntegerDistribution(begin, last){
	if (arguments.length >= 2) {
		this.set_range(begin, last);
	}
}

function IntegerDistribution_set_range(begin, last){
	this.begin = begin;
	this.last = last;
	return this;
}

// 0でない値がある部分のみの範囲に合わせる
function IntegerDistribution_adjust_range(){
	while (!this[this.begin] && this.begin <= this.last) this.begin++;
	while (!this[this.last] && this.begin <= this.last) this.last--;
	return this;
}

// 値のクリア
function IntegerDistribution_clear(){
	for (let i=this.begin; i<=this.last; i++) {
		if (this[i]) this[i] = 0;
	}
}

function IntegerDistribution_size(){
	return Math.max(this.last - this.begin + 1, 0);
}

// 複製
// 注意して実装すれば派生クラスでも利用可能
function IntegerDistribution_clone(){
	let dist = new this.constructor();
	dist.set_range(this.begin, this.last);
	for (let i=this.begin; i<=this.last; i++) {
		if (this[i]) dist[i] = this[i];
	}
	return dist;
}

// 範囲を指定してclone()
function IntegerDistribution_clone_range(begin, last){
	let dist = new this.constructor();
	dist.set_range(begin, last);
	for (let i=begin; i<=last; i++) {
		if (this[i]) dist[i] = this[i];
	}
	return dist;
}

function IntegerDistribution_fill(v){
	for (let i=this.begin; i<=this.last; i++) this[i] = v;
	return this;
}

// 範囲を埋める
// this.begin, this.last には干渉しない
function IntegerDistribution_fill_range(begin, last, v){
	for (let i=begin; i<=last; i++) this[i] = v;
	return this;
}

// undefinedの部分を0で埋める
function IntegerDistribution_emptyfill_range(begin, last){
	for (let i=begin; i<=last; i++) {
		if (this[i] === undefined) this[i] = 0;
	}
	return this;
}

// 全ての値を a 倍する
function IntegerDistribution_scale(a){
	for (let i=this.begin; i<=this.last; i++) {
		if (this[i]) this[i] *= a;
	}
	return this;
}

// 値の和が arg_total になるように定数倍
function IntegerDistribution_normalize(arg_total){
	let total = arg_total || 1;
	let sum = this.sum();
	if (sum != 0) this.scale(total / sum);
	return this;
}

// 加算
function IntegerDistribution_add(dist){
	for (let i=dist.begin; i<=dist.last; i++) {
		if (dist[i]) {
			this[i] = (this[i] || 0) + dist[i];
		}
	}
	if (this.begin > this.last) {
		this.begin = dist.begin;
		this.last = dist.last;
	} else {
		if (this.begin > dist.begin) this.begin = dist.begin;
		if (this.last < dist.last) this.last = dist.last;
	}
	return this;
}

// 減算
function IntegerDistribution_sub(dist){
	for (let i=dist.begin; i<=dist.last; i++) {
		if (dist[i]) {
			this[i] = (this[i] || 0) - dist[i];
		}
	}
	if (this.begin > this.last) {
		this.begin = dist.begin;
		this.last = dist.last;
	} else {
		if (this.begin > dist.begin) this.begin = dist.begin;
		if (this.last < dist.last) this.last = dist.last;
	}
	return this;
}

// distの定数倍をposの位置に加算
function IntegerDistribution_add_scaling_of(dist, scaling, pos){
	for (let i=dist.begin; i<=dist.last; i++) {
		if (dist[i]) {
			this[i + pos] = (this[i + pos] || 0) + dist[i] * scaling;
		}
	}
	let begin = dist.begin + pos;
	let last = dist.last + pos;
	if (this.begin > this.last) {
		this.begin = begin;
		this.last = last;
	} else {
		if (this.begin > begin) this.begin = begin;
		if (this.last < last) this.last = last;
	}
	return this;
}

// rangeの変更(累積分布用)
function IntegerDistribution_cum_extend(new_begin, new_last){
	if (new_begin < this.begin) {
		for (let i=new_begin-1; i<this.begin; i++) {
			this[i] = 0;
		}
		this.begin = new_begin;
	}
	if (new_last > this.last) {
		for (let i=this.last+1; i<=new_last; i++) {
			this[i] = this[this.last];
		}
		this.last = new_last;
	}
	return this;
}

// 全確率を再計算して返す
function IntegerDistribution_sum(){
	let sum = 0;
	for (let i=this.begin; i<=this.last; i++) {
		if (this[i]) sum += this[i];
	}
	return sum;
}

// 累積分布を返す
function IntegerDistribution_cumulate(){
	let dist = new this.constructor();
	dist.set_range(this.begin, this.last);
	dist[this.begin - 1] = 0;
	
	let sum = 0;
	for (let i=this.begin; i<=this.last; i++) {
		sum += this[i] || 0;
		dist[i] = sum;
	}
	return dist;
}

// 畳み込み演算
function IntegerDistribution_convolve(b){
	let dist = new this.constructor();
	dist.set_range(this.begin + b.begin, this.last + b.last);
	
	for (let i=this.begin; i<=this.last; i++) {
		if (!this[i]) continue;
		for (let j=b.begin; j<=b.last; j++) {
			if (!b[j]) continue;
			dist[i + j] = (dist[i + j] || 0) + this[i] * b[j];
		}
	}
	return dist;
}


// DamageDistribution ------------------------------------------------------------------------------
// 損傷率の計算をする
// IntegerDistribution を継承
DamageDistribution.prototype = Object.assign(Object.create(IntegerDistribution.prototype), {
	// this.last が max_hp を表す
	set_hp           : DamageDistribution_set_hp,
	
	// 各種計算は計算後の値を返し、自身は変更しない
	// 継承したメソッドは別
	percentage_damage: DamageDistribution_percentage_damage,
	scratch          : DamageDistribution_scratch,
	protect          : DamageDistribution_protect,
	hit              : DamageDistribution_hit,
	
	get_display_probs: DamageDistribution_get_display_probs,
	
	constructor      : DamageDistribution,
});


// cur_hp < 0 の場合は全ての値が 0 となるものとする
export function DamageDistribution(cur_hp, max_hp){
	if (arguments.length >= 2) {
		this.set_hp(cur_hp, max_hp);
	}
}

function DamageDistribution_set_hp(cur_hp, max_hp){
	this.clear();
	this.set_range(0, max_hp);
	if (cur_hp >= 0) this[cur_hp] = 1;
	return this;
}

// 割合ダメージ
// damage = HP * a + rand(HP) * b の形で与えられるダメージを考える
function DamageDistribution_percentage_damage(a, b){
	let dist = new DamageDistribution(-1, this.last);
	
	if (this[0]) dist[0] = this[0];
	for (let h=1; h<=this.last; h++) {
		if (!this[h]) continue;
		
		// rand(h) は h パターンある
		let p = this[h] / h;
		
		for (let r=0; r<h; r++) {
			let dmg = Math.floor(h * a + r * b);
			let new_hp = Math.max(h - dmg, 0); // 念の為
			dist[new_hp] = (dist[new_hp] || 0) + p;
		}
	}
	return dist;
}

// カスダメ
function DamageDistribution_scratch(){
	return this.percentage_damage(0.06, 0.08);
}

// 轟沈保護
function DamageDistribution_protect(){
	return this.percentage_damage(0.5, 0.3);
}

// 被弾
function DamageDistribution_hit(power, ammo, arg_armor, scratch = true, protect = false){
	let dist = new DamageDistribution(-1, this.last);
	
	// 装甲は1未満にならない
	let armor = arg_armor >= 1 ? arg_armor : 1;
	let ammo_modify = Math.min(Math.floor(ammo * 100) / 50, 1);
	
	// 装甲乱数は rand(int(armor))
	let rlim = Math.floor(armor);
	
	if (this[0]) dist[0] = this[0];
	
	for (let h=1; h<=this.last; h++) {
		if (!this[h]) continue;
		
		let rprob = this[h] / rlim;
		
		// 現在のHPから割合ダメージが発生した回数
		let protect_count = 0;
		let scratch_count = 0;
		
		for (let r=0; r<rlim; r++) {
			let def = armor * 0.7 + r * 0.6;
			let dmg = Math.max(Math.floor((power - def) * ammo_modify), 0);
			let new_hp = Math.max(h - dmg, 0);
			
			if (new_hp <= 0 && protect) {
				// 轟沈保護
				protect_count++;
			} else if (dmg == 0 && scratch) {
				// カスダメ
				scratch_count++;
			} else {
				// 通常
				dist[new_hp] = (dist[new_hp] || 0) + rprob;
			}
		}
		
		if (protect_count > 0) {
			dist.add( (new DamageDistribution(h, this.last)).scale(this[h] * protect_count / rlim).protect() );
		}
		if (scratch_count > 0) {
			dist.add( (new DamageDistribution(h, this.last)).scale(this[h] * scratch_count / rlim).scratch() );
		}
	}
	
	return dist;
}


// 各表示ごとの確率を求める
// データはmap: damage-str -> prob、引数で指定したオブジェクトへ　省略も可
// 戻り値は probs
// cumlative: 累積
function DamageDistribution_get_display_probs(probs = new Object, cumlative = null){
	for (let div=0; div<5; div++) {
		// a < x <= b の範囲が DAMAGE_KEYS[div]
		let a = Math.floor(this.last * (3 - div) / 4);
		let b = Math.floor(this.last * (4 - div) / 4);
		
		let psum = 0;
		for (let i=a+1; i<=b; i++) {
			if (this[i]) psum += this[i];
		}
		probs[DAMAGE_KEYS[div]] = psum;
	}
	
	if (cumlative) {
		cumlative["撃沈"] = probs["撃沈"];
		cumlative["大破"] = probs["撃沈"] + probs["大破"];
		cumlative["中破"] = probs["撃沈"] + probs["大破"] + probs["中破"];
		cumlative["小破"] = probs["撃沈"] + probs["大破"] + probs["中破"] + probs["小破"];
		cumlative["表示なし"] = 1;
	}
	
	return probs;
}


// キャップ ----------------------------------------------------------------------------------------
/**
 * 攻撃力キャップをかける　整数化はしない
 * @param {number} x キャップ前値
 * @param {number} cap キャップ
 */
export function sqrtcap(x, cap){
	return x > cap ? cap + Math.sqrt(x - cap) : x;
}
/**
 * sqrtcap() の逆関数
 * @param {number} y キャップ後値
 * @param {number} cap キャップ
 */
export function inv_sqrtcap(y, cap){
	return y > cap ? (y - cap) * (y - cap) + cap : y;
}
/**
 * 回避キャップをかける<br>
 * キャップ前値 = 陣形補正 * {素回避値 + 装備回避値 + sqrt(2 * 運)}
 * @param {number} x キャップ前値(整数でなくてもよい)
 * @return {number} 整数
 */
export function evadecap(x){
	return Math.floor(evadecap_raw(x));
}
/**
 * 回避キャップをかけるが整数化しない
 * @param {number} x キャップ前値(整数でなくてもよい)
 * @return {number}
 */
export function evadecap_raw(x){
	let e = Math.floor(x);
	return e >= 65 ? 55 + 2 * Math.sqrt(e - 65) : e >= 40 ? 40 + 3 * Math.sqrt(e - 40) : x;
}
