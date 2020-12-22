
const MAX_MATERIAL_COUNT = 1000;
const SHOW_DEBUG_BUTTON = false;

// 経験値アップ期間は自動で経験値倍率をセット
// 更新がめんどうなやつ
const special_exp_factor_begin = new Date("2019/08/26");
const special_exp_factor_end = new Date("2020/12/26 14:00");
const special_exp_factor = 1.1;


// 現在表示中の計算結果
let showing_data_form = null;
let showing_data_uplist = null;


document.addEventListener("DOMContentLoaded", flower_pageinit);


// ページの初期化 ----------------------------------------------------------------------------------
function flower_pageinit(){
	function _set_change_ev(id, ev_func){
		var e = DOM(id);
		if (e) e.addEventListener("change", ev_func);
	}
	function _set_click_ev(id, ev_func){
		var e = DOM(id);
		if (e) e.addEventListener("click", ev_func);
	}
	function _set_minmax(id){
		var e = DOM(id);
		if (e) {
			e.min = 0;
			e.max = MAX_MATERIAL_COUNT;
		}
	}
	
	// レアリティ
	_set_change_ev("rarity", ev_change_rarity);
	// 進化度
	_set_change_ev("growth_immature", ev_change_growth);
	_set_change_ev("growth_upgrowth", ev_change_growth);
	_set_change_ev("growth_florescence", ev_change_growth);
	_set_change_ev("limit_level", ev_change_growth);
	// 現在Lv/次のLvまで/累計経験値
	_set_change_ev("current_level", ev_change_level);
	_set_change_ev("next_exp", ev_change_next);
	_set_change_ev("total_exp", ev_change_total);
	// 経験値クリア
	_set_click_ev("clear_exp", ev_clear_exp);
	// 素材
	var postids = [
		"m_m5", "m_m20", "m_m100",
		"o_m5", "o_m20", "o_m100",
		"o_amp"
	];
	for (var i=0; i<postids.length; i++) {
		_set_change_ev("count_" + postids[i], ev_change_materials);
		_set_change_ev("allin_" + postids[i], ev_change_materials);
		_set_minmax("count_" + postids[i]);
	}
	// 個数クリア
	_set_click_ev("clear_counts", ev_clear_counts);
	
	// オプション
	var oids = [
		"exp_factor",
		"priority_gold", "priority_exp", "priority_gold_all",
		"great_nothing", "great_onlylast", "great_nothing_modify", // "great_all",
		"once_min_count",
		"extracost_gold", "extracost_exp",
	];
	for (var i=0; i<oids.length; i++) {
		_set_change_ev(oids[i], ev_change_options);
	}
	// 追加コストクリア
	_set_click_ev("clear_extracosts", ev_clear_extracost);
	
	// フォームの初期化
	var exp_factor = DOM("exp_factor");
	
	if (exp_factor && exp_factor.value == "") { // F5のときはそのままになる
		var time = (new Date).getTime();
		if (special_exp_factor_begin.getTime() <= time && time < special_exp_factor_end.getTime()) {
			exp_factor.value = special_exp_factor;
		} else {
			exp_factor.value = "1";
		}
	}
	
	// 特殊入力欄を初期化する
	function _sp(char, idx){
		var e_rarity = DOM("special_" + char + "_rarity");
		if (e_rarity) {
			remove_children(e_rarity);
			for (var i=2; i<=6; i++) {
				e_rarity.appendChild(new Option("★" + i, i));
			}
			e_rarity.appendChild(new Option("ナーエ"    , SPCARD_NAE     ));
			e_rarity.appendChild(new Option("キャラ装花", SPCARD_SOUKA   ));
			e_rarity.appendChild(new Option("キャラ技花", SPCARD_WAZAHANA));
			e_rarity.appendChild(new Option("装花(庭園)", SPCARD_GARDEN_SOUKA   ));
			e_rarity.appendChild(new Option("技花(庭園)", SPCARD_GARDEN_WAZAHANA));
			e_rarity.selectedIndex = idx ? idx : 0;
			e_rarity.addEventListener("change", ev_change_special_rarity);
		}
		// こちらでフォームの有効無効をセット
		set_special_exp(char);
		
		_set_change_ev("special_" + char + "_level", ev_change_special_level);
		_set_change_ev("special_" + char + "_exp", ev_change_special_exp);
		_set_change_ev("count_m_sp_" + char, ev_change_materials);
		_set_change_ev("allin_m_sp_" + char, ev_change_materials);
		_set_change_ev("count_o_sp_" + char, ev_change_materials);
		_set_change_ev("allin_o_sp_" + char, ev_change_materials);
		_set_minmax("count_m_sp_" + char);
		_set_minmax("count_o_sp_" + char);
	}
	
	_sp("A", 6);
	_sp("B", 7);
	_sp("C", 3);
	_sp("D", 4);
	set_total_feed_exp();
	
	// デバッグ用ボタン等
	var btn = DOM("show_debug");
	if (btn) {
		btn.addEventListener("click", ev_show_debug);
	}
	show_debug_tools(SHOW_DEBUG_BUTTON);
	
	ev_change_rarity();
	expand_title_newline();
	
	console.log("でち！");
}



// イベント関数 ------------------------------------------------------------------------------------
// レア度が変更された
function ev_change_rarity(){
	// 進化度をチェックする
	modify_growth();
	// 現在Lv/次のLvまでをセット
	set_nextexp();
	// 最適化計算
	main_optimization();
}

// 進化度が変更された
function ev_change_growth(){
	modify_growth();
	set_nextexp();
	main_optimization();
}

// レベルが変更された
function ev_change_level(){
	// 次のLvまでの経験値もリセット
	modify_next(true);
	set_totalexp();
	main_optimization();
}

// 次のLvまでが変更された
function ev_change_next(){
	set_totalexp();
	main_optimization();
}

// 累計経験値が変更された
function ev_change_total(){
	set_nextexp();
	main_optimization();
}

// 経験値クリア
function ev_clear_exp(){
	DOM("total_exp").value = 0;
	set_nextexp();
	main_optimization();
}

// 素材のいずれかが変更された
function ev_change_materials(){
	set_total_feed_exp();
	main_optimization();
}

// 特殊素材のレア度が変更された
function ev_change_special_rarity(e){
	if (/special_([A-Z])_rarity/.test(e.target.id)) {
		set_special_exp(RegExp.$1);
		set_total_feed_exp();
		main_optimization();
	}
}

// 特殊素材のレベル
function ev_change_special_level(e){
	if (/special_([A-Z])_level/.test(e.target.id)) {
		set_special_exp(RegExp.$1);
		set_total_feed_exp();
		main_optimization();
	}
}

// 素材の個数をクリア
function ev_clear_counts(){
	var postids = [
		"m_m5", "m_m20", "m_m100",
		"o_m5", "o_m20", "o_m100",
		"o_amp",
		"m_sp_A", "o_sp_A",
		"m_sp_B", "o_sp_B",
		"m_sp_C", "o_sp_C",
		"m_sp_D", "o_sp_D",
	];
	for (var i=0; i<postids.length; i++) {
		DOM("count_" + postids[i]).value = 0;
	}
	set_total_feed_exp();
	main_optimization();
}

// オプションのいずれかが変更された
function ev_change_options(){
	main_optimization();
}

// 特殊の経験値が変更された
function ev_change_special_exp(e){
	set_fit_exp(e.target);
	set_total_feed_exp();
	main_optimization();
}

// 追加コストクリア
function ev_clear_extracost(){
	DOM("extracost_gold").value = 0;
	DOM("extracost_exp").value = 0;
	main_optimization();
}

// デバッグ用の表示切り替え
function ev_show_debug(){
	var input = DOM("priority_gold_all");
	show_debug_tools(input.disabled);
}


// ここから再計算をクリック
function ev_click_recalc(e){
	if (!showing_data_form || !showing_data_uplist) return;
	
	let is_main = +e.target.dataset.main;
	let index = +e.target.dataset.index;
	let great = +e.target.dataset.great;
	
	let stacks = FKGCardStack.duplicate(showing_data_form.stacks);
	
	let list = showing_data_uplist.list;
	let sublist = showing_data_uplist.sublist;
	let last_once = is_main ? list[index] : sublist[index];
	
	// 累計経験値
	let last_exp = last_once.before_experience + last_once.recalcExp(great);
	
	DOM("total_exp").value = last_exp;
	set_nextexp();
	
	// 使用したカードを除外
	let main_limit = is_main ? Math.min(list.length, index + 1) : list.length;
	let sub_limit = is_main ? 0 : Math.min(sublist.length, index + 1);
	
	let used = new Array;
	for (let i=0; i<main_limit; i++) {
		used = used.concat(list[i].materials);
	}
	for (let i=0; i<sub_limit; i++) {
		used = used.concat(sublist[i].materials);
	}
	FKGCardStack.removeCards(stacks, used);
	
	for (let i=0; i<stacks.length; i++) {
		DOM(stacks[i].form_count_id).value = stacks[i].count;
	}
	
	// 追加コスト
	let value_exp = 0;
	for (let c of used) {
		value_exp += FKGCard.calcFeedExp(c.basic_exp_as_feed, c.same_element || c.same_element === false, 1);
	}
	
	DOM("extracost_gold").value = formstr_to_int(DOM("extracost_gold").value, 0, 0).value + last_once.total_gold_to_powerup;
	DOM("extracost_exp").value = formstr_to_int(DOM("extracost_exp").value, 0, 0).value + value_exp;
	
	// 再計算
	main_optimization();
}


// DOM操作と各種計算 -------------------------------------------------------------------------------
function get_growth(){
	var growth = DOM("growth_immature").checked ? 0 : DOM("growth_upgrowth").checked ? 1 : 2;
	return growth;
}

function get_max_level(rarity, growth){
	var max_level = 0;
	
	if (rarity == 6 && growth == 2) {
		// 上限突破
		// 5刻みだが、ひとまずフォームのレベルを使用する(80-110)
		max_level = formstr_to_int(DOM("limit_level").value).value;
		max_level = Math.min(Math.max(max_level, 80), 110);
		
	} else {
		max_level = MAX_LEVELS[rarity - 2][growth];
	}
	
	return max_level;
}

// 進化度のチェックと修正
// レア度変更などで齟齬が出る可能性がある
// ついでに最大Lvも修正
function modify_growth(){
	var rarity = formstr_to_int(DOM("rarity").value).value;
	//var immature = DOM("growth_immature");
	var upgrowth = DOM("growth_upgrowth");
	var florescence = DOM("growth_florescence");
	var limit = DOM("limit_level");
	var lv = DOM("current_level");
	
	if (rarity == 6) {
		// 上限の設定
		_state(florescence, false, false);
		_state(limit, false, false);
		limit.min = 80;
		limit.max = 110;
		
	} else if (rarity == 5) {
		// 上限突破なし(readonly)
		_state(florescence, false, false);
		_state(limit, false, true);
		// 開花後をチェックしている場合のみ修正
		// そのかわり進化度が変更された場合にもこの関数を呼び出す
		if (florescence.checked && limit.value != "80") limit.value = 80;
		
	} else {
		// 上限突破、開花なし
		_state(florescence, true, false);
		_state(limit, true, false);
		if (florescence.checked) upgrowth.checked = true;
	}
	
	// 最大Lv
	var growth = get_growth();
	var max = get_max_level(rarity, growth);
	lv.max = max;
	
	var lv_value = formstr_to_int(DOM("current_level").value);
	if (lv_value.good() && lv_value > max) {
		lv.value = max;
	}
	
	function _state(input, disabled, readonly){
		input.disabled = disabled;
		input.readOnly = readonly;
		// parent は label
		var parent = input.parentElement;
		if (disabled) {
			parent.classList.add("disabled");
		} else {
			parent.classList.remove("disabled");
		}
	}
}

// 現在Lvから、次のLvまでを修正
function modify_next(reset){
	var next_exp = DOM("next_exp");
	var lv = formstr_to_int(DOM("current_level").value);
	
	if (!lv.good()) return;
	
	var rarity = formstr_to_int(DOM("rarity").value).value;
	var growth = get_growth();
	var max_level = get_max_level(rarity, growth);
	
	if (lv.value > max_level || lv.value <= 0) return;
	
	if (lv.value == max_level) {
		// 最大Lv
		next_exp.max = 0;
		next_exp.value = 0;
		
	} else {
		var exp_table = get_exp_table(rarity, growth);
		var next_max = exp_table[lv.value] - exp_table[lv.value - 1];
		var next = formstr_to_int(next_exp.value);
		
		next_exp.max = next_max;
		
		if (!next.good() || next.value > next_max || reset) {
			next_exp.value = next_max;
		}
	}
}


// 累計経験値→現在Lv/次のLvまで
function set_nextexp(){
	var rarity = formstr_to_int(DOM("rarity").value).value;
	var growth = get_growth();
	var max_level = get_max_level(rarity, growth);
	
	if (max_level <= 0) return;
	
	var total_exp = formstr_to_int(DOM("total_exp").value);
	if (!total_exp.good() || total_exp.value < 0) return;
	
	var exp_table = get_exp_table(rarity, growth);
	
	var lv = index_in_ascending(total_exp.value, exp_table) + 1;
	if (lv > max_level) lv = max_level;
	
	var next = 0;
	if (lv < max_level) next = exp_table[lv] - total_exp.value;
	
	DOM("current_level").value = lv;
	modify_next(false); // maxをセットする
	DOM("next_exp").value = next;
}


// 現在Lv/次のLvまで→累計経験値
function set_totalexp(){
	var lv = formstr_to_int(DOM("current_level").value);
	var next = formstr_to_int(DOM("next_exp").value);
	
	if (!lv.good() || !next.good() || lv.value <= 0 || next.value < 0) return;
	
	var rarity = formstr_to_int(DOM("rarity").value).value;
	var growth = get_growth();
	var max_level = get_max_level(rarity, growth);
	
	if (lv.value > max_level) return;
	
	var exp_table = get_exp_table(rarity, growth);
	var total;
	if (lv.value < max_level) {
		total = exp_table[lv.value] - next.value;
	} else {
		total = exp_table[lv.value - 1];
	}
	
	DOM("total_exp").value = total;
}


// レア度・レベルから経験値をセット
// ついでにフォームの調整も行う
function set_special_exp(char){
	var e_rarity = DOM("special_" + char + "_rarity");
	var e_level  = DOM("special_" + char + "_level");
	var e_exp    = DOM("special_" + char + "_exp");
	
	var rarity = formstr_to_int(e_rarity.value).value;
	
	if (rarity == SPCARD_NAE) {
		// ナーエ
		e_level.value = 1; // とりあえず
		e_level.disabled = true;
		e_level.parentElement.classList.add("disabled");
		e_exp.readOnly = false;
		
	} else if ( rarity == SPCARD_SOUKA || rarity == SPCARD_WAZAHANA ||
		rarity == SPCARD_GARDEN_SOUKA || rarity == SPCARD_GARDEN_WAZAHANA )
	{
		// 装花・技花
		var exp = (
			rarity == SPCARD_SOUKA        ? 1800     :
			rarity == SPCARD_WAZAHANA     ? 720      :
			rarity == SPCARD_GARDEN_SOUKA ? 1800 / 4 : 720 / 4
		);
		
		e_level.value = 1;
		e_level.disabled = true;
		e_level.parentElement.classList.add("disabled");
		e_exp.value = exp;
		e_exp.readOnly = true;
		
	} else if (2 <= rarity && rarity <= 6) {
		// 通常
		// レベル上限のセット　全部60でも問題なさそうだが…
		var level_raw = formstr_to_int(e_level.value, 1, 1);
		var max   = MAX_LEVELS[rarity - 2][0];
		var level = Math.min(Math.max(level_raw.value, 1), max);
		var exp   = get_exp_as_feed(rarity, level);
		
		e_level.max = max;
		if (!level_raw.good() || level != level_raw.value) {
			e_level.value = level;
		}
		e_level.disabled = false;
		e_level.parentElement.classList.remove("disabled");
		e_exp.value = exp;
		e_exp.readOnly = true;
		
	} else {
		console.log("カードの種類が不明です");
		return;
	}
	
	set_fit_exp(e_exp);
}


function set_fit_exp(e_input){
	var exp = formstr_to_int(e_input.value);
	
	if (exp.good()) {
		var e = DOM(e_input.id + "_same");
		//if (e) e.textContent = Math.floor(exp.value * 1.5) + " exp";
		if (e) {
			e.textContent = (exp.value * 1.5) + " exp";
		}
	}
}


function set_total_feed_exp(){
	var e_cell = DOM("total_feed_exp");
	if (!e_cell) return;
	
	var form = load_from_document();
	var sum = 0;
	var fit_sum = 0;
	
	for (var i=0; i<form.stacks.length; i++) {
		var c = form.stacks[i].count;
		
		if (c > 0) {
			var card = form.stacks[i].card;
			sum += card.exp_as_feed * c;
			
			if (card.same_element === false) {
				// 属性一致にして計算
				card.same_element = true;
				card.setFeedExp();
				fit_sum += card.exp_as_feed * c;
			} else {
				fit_sum += card.exp_as_feed * c;
			}
		}
	}
	
	var text = sum + " exp";
	if (sum != fit_sum) {
		text += " (属性一致 "+ fit_sum +" exp)";
	}
	e_cell.textContent = text;
}


// デバッグ用の表示
// 一応 nothrow に
function show_debug_tools(show){
	var input = DOM("priority_gold_all");
	var button = DOM("show_debug");
	
	if (input && button) {
		if (show) {
			input.disabled = false;
			input.parentElement.style.display = "inline";
			button.textContent = "デバッグ用を隠す";
			
		} else {
			if (input.checked) {
				var gold = DOM("priority_gold");
				if (gold) {
					gold.checked = true;
					main_optimization();
				}
			}
			input.disabled = true;
			input.parentElement.style.display = "none";
			button.textContent = "デバッグ用を表示";
		}
	}
}


// フォームのデータを読み込む
function load_from_document(){
	var out = new FlowerFormData;
	
	function _load(e, noerror, func){
		if (e) {
			var a = func(e.value);
			if (a.good()) return a.value;
		}
		if (!noerror) out.error = true;
		return 0;
	}
	function _int  (e, noerror){ return _load(e, noerror, formstr_to_int  ); }
	function _float(e, noerror){ return _load(e, noerror, formstr_to_float); }
	
	// 基本
	out.rarity    = _int(DOM("rarity"));
	out.growth    = get_growth();
	out.level     = _int(DOM("current_level"));
	out.max_level = get_max_level(out.rarity, out.growth);
	out.next_exp  = _int(DOM("next_exp"));
	out.total_exp = _int(DOM("total_exp"));
	
	// オプション
	out.exp_factor      = _float(DOM("exp_factor"));
	out.search_priority = DOM("priority_gold").checked ? PRIORITY_GOLD : DOM("priority_exp").checked ? PRIORITY_EXP : PRIORITY_GOLD_ALL;
	out.search_great    =
		DOM("great_nothing" ).checked ? GREAT_NOTHING  :
		DOM("great_onlylast").checked ? GREAT_ONLYLAST :
		DOM("great_nothing_modify").checked ? GREAT_NOTHING_MODIFY :
			GREAT_ALL;
	out.once_min_count  = _int(DOM("once_min_count"));
	
	// 追加コスト
	out.extracost_gold = _int(DOM("extracost_gold"));
	out.extracost_exp = _int(DOM("extracost_exp"));
	
	// 素材
	var safety_limit = MAX_MATERIAL_COUNT; // 最大数・超過はエラー
	function _stack(card, count_id, allin_id){
		var count = _int(DOM(count_id));
		if (count > safety_limit) {
			out.error = true;
			count = safety_limit;
		}
		return new FKGCardStack(card, count, DOM(allin_id).checked, count_id, allin_id);
	}
	
	var c = 0;
	out.stacks[c++] = _stack(new FKGCard("マニュ5才"  , true ,  50, 720 ), "count_m_m5"  , "allin_m_m5"  );
	out.stacks[c++] = _stack(new FKGCard("マニュ20才" , true ,  60, 1800), "count_m_m20" , "allin_m_m20" );
	out.stacks[c++] = _stack(new FKGCard("マニュ100才", true ,  70, 4800), "count_m_m100", "allin_m_m100");
	out.stacks[c++] = _stack(new FKGCard("アンプルゥ" , null , 200, 1080), "count_o_amp" , "allin_o_amp" );
	out.stacks[c++] = _stack(new FKGCard("マニュ5才"  , false,  10, 720 ), "count_o_m5"  , "allin_o_m5"  );
	out.stacks[c++] = _stack(new FKGCard("マニュ20才" , false,  20, 1800), "count_o_m20" , "allin_o_m20" );
	out.stacks[c++] = _stack(new FKGCard("マニュ100才", false,  30, 4800), "count_o_m100", "allin_o_m100");
	// 特殊
	var chars = "A,B,C,D".split(",");
	var nae_count = 0;
	out.special_names = new Array;
	
	for (var i=0; i<chars.length; i++) {
		var r = _int(DOM("special_" + chars[i] +"_rarity"));
		var sp_name = "";
		
		if (r == SPCARD_NAE) {
			sp_name = "ナーエ";
			if (nae_count++ >= 1) {
				// 区別したい
				sp_name += "ABCD".charAt(i);
			}
		} else if (r == SPCARD_SOUKA) {
			sp_name = "キャラ装花";
		} else if (r == SPCARD_WAZAHANA) {
			sp_name = "キャラ技花";
		} else if (r == SPCARD_GARDEN_SOUKA) {
			sp_name = "装花(庭園)";
		} else if (r == SPCARD_GARDEN_WAZAHANA) {
			sp_name = "技花(庭園)";
		} else if (2 <= r && r <= 6) {
			sp_name = "★" + r;
			sp_name += "(Lv" + _int(DOM("special_" + chars[i] +"_level")) + ")";
		}
		out.special_names.push(sp_name);
		
		var sp_exp = _int(DOM("special_" + chars[i] + "_exp"));
		if (sp_exp > 0) {
			var card1 = new FKGCard("特殊" + chars[i], true , i * 10 + 100, sp_exp);
			card1.viewname = sp_name;
			out.stacks[c++] = _stack(card1, "count_m_sp_" + chars[i], "allin_m_sp_" + chars[i]);
			
			var card2 = new FKGCard("特殊" + chars[i], false, i * 10 + 15 , sp_exp);
			card2.viewname = sp_name;
			out.stacks[c++] = _stack(card2, "count_o_sp_" + chars[i], "allin_o_sp_" + chars[i]);
		}
	}
	
	// つかってないかも
	out.cards = new Array;
	for (var i=0; i<c; i++) {
		out.cards.push(out.stacks[i].card);
	}
	
	// フォームのデータから計算
	if (!out.error) {
		out.exp_table  = get_exp_table(out.rarity, out.growth);
		out.gold_table = get_goldcost_table(out.rarity, out.growth);
		out.goal_exp   = out.exp_table[out.max_level - 1];
		
		out.level2    = exp_to_level(out.total_exp, out.max_level, out.exp_table);
		out.next_exp2 = out.level2 == out.max_level ? 0 : out.exp_table[out.level2] - out.total_exp;
	}
	
	return out;
}


// フォームから読み取って最適化、結果を表示する
function main_optimization(){
	var form = load_from_document();
	
	if (!form.error) {
		var upl = calc_optimized(form);
		
		if (upl) {
			set_result(form, upl);
		} else {
			clear_result();
		}
	} else {
		clear_result();
	}
}


// 最適なものを探索する
// 戻り値: PowerupList
function calc_optimized(form){
	var uplist = null;
	
	// 経験値アップを適用
	var stacks = FKGCardStack.duplicate(form.stacks);
	
	if (form.exp_factor > 1) {
		// 計算誤差回避
		// 入力は1%刻みとする
//		let factor100 = Math.round(form.exp_factor * 100);
		
		for (var i=0; i<stacks.length; i++) {
			var card = stacks[i].card;
			card.exp_factor = form.exp_factor;
//			card.basic_exp_as_feed = card.basic_exp_as_feed * factor100 / 100;
			card.setFeedExp();
		}
	}
	
	// 大成功は各素材ごとに経験値1.5倍切り捨てで暫定対応
	// 1回の経験値合計に1.5倍もありえるさん？
	
	if (form.search_great == GREAT_NOTHING) {
		// 大成功なし
		if (form.search_priority == PRIORITY_GOLD) {  // ゴールド優先
			uplist = calc_mingold_powerup_of_s(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
		} else if (form.search_priority == PRIORITY_EXP) {  // 経験値優先
			uplist = calc_minexp_powerup_of_s(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
		} else if (form.search_priority == PRIORITY_GOLD_ALL) {  // ゴールド優先(全探索)
			var begin = new Date;
			uplist = calc_mingold_powerup_of_s_all(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
			var end = new Date;
			
			if (1) {
				// debug用　高速な方と解が変わらないかをチェック
				var fast_uplist = calc_mingold_powerup_of_s_fast(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
				var ts_uplist = calc_mingold_powerup_of_s_TS(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
				
				if (fast_uplist.gold_to_powerup != uplist.gold_to_powerup || ts_uplist.gold_to_powerup != uplist.gold_to_powerup) {
					console.log( "ゴールド消費量が違うっぽい！",
						"高速:", fast_uplist.gold_to_powerup,
						"/ 全探:", uplist.gold_to_powerup,
						"/ TS:", ts_uplist.gold_to_powerup
					);
				}
				
				if (0) {
					// 時間も計測
					var lc = 10;
					var t1 = new Date;
					for (var i=0; i<lc; i++) {
						calc_mingold_powerup_of_s_fast(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
					}
					var t2 = new Date;
					for (var i=0; i<lc; i++) {
						calc_mingold_powerup_of_s_TS(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
					}
					var t3 = new Date;
					// fast, ts, all
					console.log("time(x"+ lc +"):", t2.getTime() - t1.getTime(), t3.getTime() - t2.getTime(), (end.getTime() - begin.getTime()) * lc);
				}
			}
		}
		
		if (uplist) {
			uplist.comment_main = "大成功なし";
		}
		
	} else if (form.search_great == GREAT_ONLYLAST) {
		// ラストのみ大成功
		if (form.search_priority == PRIORITY_GOLD) {
			uplist = calc_mingold_lastgreat_of_s(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
		} else if (form.search_priority == PRIORITY_EXP) {
			uplist = calc_minexp_lastgreat_of_s(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
		}
		
		if (uplist) {
			uplist.use_sub = true;
			uplist.comment_main = "最後だけ大成功<br>想定最良値";
			uplist.comment_sub  = "最後だけ大成功<br>想定最悪値";
		}
		
	} else if (form.search_great == GREAT_NOTHING_MODIFY) {
		// 大成功なし(大成功考慮)
		if (form.search_priority == PRIORITY_GOLD) {
			uplist = calc_mingold_powerup2_of_s(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
		} else if (form.search_priority == PRIORITY_EXP) {
			uplist = calc_minexp_powerup2_of_s(form.total_exp, form.goal_exp, stacks, form.max_level, form.exp_table, form.gold_table, form.once_min_count);
		}
		
	} else if (form.search_great == GREAT_ALL) {
		// すべて大成功
		// 実装しなくていいよね…
	}
	
	if (!uplist) {
		console.log("探索方法が不明なのです"); // もしくは素材なし等?
	}
	
	return uplist;
}


function set_outline(form, uplist){
	var table = DOM("outline_table");
	
	while (table.tBodies.length > 0) {
		table.removeChild(table.tBodies[0]);
	}
	
	table.appendChild(_list_to_tbody(uplist.list, uplist.comment_main));
	
	if (uplist.use_sub) {
		var ls = uplist.list.concat(uplist.sublist);
		if (ls.length >= 1) {
			// 最後のものは成功で計算したい
			var last = ls[ls.length - 1] = ls[ls.length - 1].clone();
			last.suppose_great = false;
			last.gain_experience = last.recalcExp(false);
			last.end_experience = last.before_experience + last.gain_experience;
		}
		table.appendChild(_list_to_tbody(ls, uplist.comment_sub));
	}
	
	return;
	
	
	function _list_to_tbody(list, comment){
		var tbody = document.createElement("tbody");
		
		var last_once  = list.length >= 1 ? list[list.length - 1] : null;
		var est_exp    = last_once ? last_once.end_experience : form.total_exp;
		var est_level  = exp_to_level(est_exp, form.max_level, form.exp_table);
		var est_next   = est_level == form.max_level ? 0 : form.exp_table[est_level] - est_exp;
		var exceed_exp = est_exp - form.exp_table[form.max_level - 1];
		
		var info_obj = new Object;
		function _infokey(name, elem){
			return name + "\t" + (elem === true ? "1" : elem === false ? "0" : "-1");
		}
		function _add_info(name, elem){
			var key = _infokey(name, elem);
			info_obj[key] = _cards_info(list, name, elem);
		}
		function _get_info(name, elem){
			return info_obj[_infokey(name, elem)];
		}
		_add_info("マニュ5才", true);
		_add_info("マニュ20才", true);
		_add_info("マニュ100才", true);
		_add_info("マニュ5才", false);
		_add_info("マニュ20才", false);
		_add_info("マニュ100才", false);
		_add_info("アンプルゥ", null);
		_add_info("特殊A", true);
		_add_info("特殊B", true);
		_add_info("特殊C", true);
		_add_info("特殊D", true);
		_add_info("特殊A", false);
		_add_info("特殊B", false);
		_add_info("特殊C", false);
		_add_info("特殊D", false);
		
		var total_exp = 0;
		var total_fit_exp = 0;
		for (var i in info_obj) {
			total_exp += info_obj[i].exp;
			total_fit_exp += info_obj[i].fit_exp;
		}
		// 追加コスト
		total_exp += form.extracost_exp;
		total_fit_exp += form.extracost_exp;
		// 誤差があると文字列が長くなってしまうので
		const sc = 100;
		total_exp = Math.round(total_exp * sc) / sc;
		total_fit_exp = Math.round(total_fit_exp * sc) / sc;
		
		var total_exp_text = total_exp;
		if (total_fit_exp != total_exp) total_exp_text += "<br>(" + total_fit_exp + ")";
		
		let total_gold = last_once ? last_once.total_gold_to_powerup : 0;
		total_gold += form.extracost_gold;
		
		function _numcell(cell, number, numtext){
			if (numtext) {
				cell.innerHTML = numtext;
			} else {
				cell.textContent = number;
			}
			
			cell.classList.add("number");
			if (number < 0) cell.classList.add("minus");
			else if (number == 0) cell.classList.add("zero");
			else if (number > 0) cell.classList.add("plus");
			return cell;
		}
		
		
		var comment_span = 3;
		
		tbody.appendChild(create_row([
			create_html_cell("th", comment, comment_span, 2, "comment"),
			create_cell("th", "Lv"),
			create_cell("th", "次のLvまで"),
			create_cell("th", "累計経験値"),
			create_cell("th", "余剰経験値"),
			create_cell("th", "合成費用"),
			create_cell("th", "素材合計")
		], "header"));
		
		tbody.appendChild(create_row([
			create_cell("td", est_level),
			create_cell("td", est_next),
			create_cell("td", est_exp),
			_numcell(create_cell("td", "", 1, 1, "exceed"), exceed_exp),
			_numcell(create_cell("td"), total_gold),
			_numcell(create_cell("td"), total_exp, total_exp_text)
		]));
		
		tbody.appendChild(create_row([
			create_cell("th", "使用素材"),
			create_cell("th", "マニュ5才"),
			create_cell("th", "マニュ20才"),
			create_cell("th", "マニュ100才"),
			create_cell("th", "アンプルゥ"),
			create_cell("th", form.special_names[0]), // "特殊A"
			create_cell("th", form.special_names[1]), // "特殊B"
			create_cell("th", form.special_names[2]), // "特殊C"
			create_cell("th", form.special_names[3]), // "特殊D"
		], "width_set material_header"));
		
		tbody.appendChild(create_row([
			create_cell("th", "同属性", 1, 1, "material_header"),
			_numcell(create_cell("td"), _get_info("マニュ5才", true).count),
			_numcell(create_cell("td"), _get_info("マニュ20才", true).count),
			_numcell(create_cell("td"), _get_info("マニュ100才", true).count),
			create_cell("td", "－", 1, 1, "empty"),
			_numcell(create_cell("td"), _get_info("特殊A", true).count),
			_numcell(create_cell("td"), _get_info("特殊B", true).count),
			_numcell(create_cell("td"), _get_info("特殊C", true).count),
			_numcell(create_cell("td"), _get_info("特殊D", true).count)
		]));
		
		tbody.appendChild(create_row([
			create_cell("th", "別属性", 1, 1, "material_header"),
			_numcell(create_cell("td"), _get_info("マニュ5才", false).count),
			_numcell(create_cell("td"), _get_info("マニュ20才", false).count),
			_numcell(create_cell("td"), _get_info("マニュ100才", false).count),
			_numcell(create_cell("td"), _get_info("アンプルゥ", null).count),
			_numcell(create_cell("td"), _get_info("特殊A", false).count),
			_numcell(create_cell("td"), _get_info("特殊B", false).count),
			_numcell(create_cell("td"), _get_info("特殊C", false).count),
			_numcell(create_cell("td"), _get_info("特殊D", false).count),
		]));
		
		return tbody;
	}
	
	function _cards_info(list, subname, same_element){ // list: onceの配列
		var info = {count: 0, exp: 0, fit_exp: 0};
		for (var i=0; i<list.length; i++) {
			var arr = list[i].materials;
			for (var j=0; j<arr.length; j++) {
				if (arr[j].name.indexOf(subname) >= 0 && arr[j].same_element === same_element) {
					info.count++;
					
					// キャンペーン倍率のない値
					let exp = FKGCard.calcFeedExp(arr[j].basic_exp_as_feed, arr[j].same_element, 1);
					info.exp += exp;
					
					if (arr[j].same_element === false) {
						exp = FKGCard.calcFeedExp(arr[j].basic_exp_as_feed, true, 1);
					}
					info.fit_exp += exp;
				}
			}
		}
		return info;
	}
}


function clear_result(){
	var table = DOM("process_table");
	if (table.tHead) table.removeChild(table.tHead);
	while (table.tBodies.length > 0) {
		table.removeChild(table.tBodies[0]);
	}
	
	var table = DOM("outline_table");
	while (table.tBodies.length > 0) {
		table.removeChild(table.tBodies[0]);
	}
	
	showing_data_form = null;
	showing_data_uplist = null;
}

// uplist: PowerupList
function set_result(form, uplist){
	clear_result();
	
	// 合成過程
	var table = DOM("process_table");
	var show_limit = 50;
	var show_count = 0;
	
	table.appendChild(make_once_thead(form));
	
	for (var i=0; i<uplist.list.length; i++) {
		if (show_count >= show_limit) break;
		table.appendChild(make_once_tbody(uplist.list[i], form.max_level, form.exp_table, form.extracost_gold, false, true, i));
		show_count++;
	}
	
	for (var i=0; i<uplist.sublist.length; i++) {
		if (show_count >= show_limit) break;
		table.appendChild(make_once_tbody(uplist.sublist[i], form.max_level, form.exp_table, form.extracost_gold, true, false, i));
		show_count++;
	}
	
	var total = uplist.list.length + uplist.sublist.length;
	if (show_count >= show_limit && show_count < total) {
		var text = "多すぎるので以下は省略されました……(全" + uplist.list.length + "回";
		if (uplist.sublist.length >= 1) {
			text += "+" + uplist.sublist.length + "回";
		}
		text += ")";
		
		var tbody = document.createElement("tbody");
		tbody.appendChild(create_row([create_cell("td", text, 5+4+4)], "omit"));
		table.appendChild(tbody);
	}
	
	set_outline(form, uplist);
	
	showing_data_form = form;
	showing_data_uplist = uplist;
}


function make_once_thead(form){
	var text = "";
	text += "★" + form.rarity + "(";
	text += form.growth == 0 ? "未進化" : form.growth == 1 ? "進化済み" : "開花";
	text += ") Lv" + form.level2;
	if (form.next_exp2 > 0) {
		text += "/Next" + form.next_exp2;
	} else if (form.next_exp2 == 0) {
		text += "(MAX)";
	}
	text += " からの強化";
	
	// 上限突破の警告
	if (form.growth == 2 && form.max_level > 80 && form.max_level - form.level2 > 5) {
		text += "<br>注意：上限突破はLv80到達後、5Lvごとに行えます。計算結果は正しくないかも……";
	}
	
	var thead = document.createElement("thead");
	thead.appendChild(create_row([create_html_cell("th", text, 5+4+4)]));
	return thead;
}

// once: PowerupOnce
function make_once_tbody(once, limit_level, exp_table, extragold, extra_row, is_main, index){
	var base_exp = once.before_experience;
	
	var tbody = document.createElement("tbody");
	
	// header
	tbody.appendChild( create_row([
		create_cell("th", "["+ once.number +"]", 5, 1, "number" + (extra_row ? " extra" : "")),
		create_cell("th", "成功", 4, 1, "succeed"),
		create_cell("th", "大成功", 4, 1, "great")
	], "header") );
	
	var h2cells = [
		create_cell("td", "Lv"),
		create_cell("td", "次のLvまで"),
		create_cell("td", "累計経験値"),
		create_cell("td", "", 1, 2, "empty"),
		create_cell("td", "合成費用"),
		create_cell("td", "Lv"),
		create_cell("td", "次のLvまで"),
		create_cell("td", "累計経験値"),
		create_cell("td", "最大Lvまで"),
		create_cell("td", "Lv"),
		create_cell("td", "次のLvまで"),
		create_cell("td", "累計経験値"),
		create_cell("td", "最大Lvまで")
	];
	
	for (var i=0; i<h2cells.length; i++) {
		if (h2cells[i].textContent != "") {
			h2cells[i].classList.add("header2");
		}
		if (5 <= i && i <= 8) {
			h2cells[i].classList.add("succeed");
		} else if (i >= 9) {
			h2cells[i].classList.add("great");
		}
	}
	
	tbody.appendChild(create_row(h2cells, "width_set"));
	
	var base_level = exp_to_level(base_exp, limit_level, exp_table);
	var base_next = base_level == limit_level ? 0 : exp_table[base_level] - base_exp;
	
	var limit_exp = exp_table[limit_level - 1];
	
	let gold_cell = create_cell("td", once.gold_to_powerup, 1, 1, "hint_text");
	gold_cell.title = (once.gold_to_powerup / once.materials.length) + " x" + once.materials.length;
	
	var cells_1 = [
		create_cell("td", base_level),
		create_cell("td", base_next),
		create_cell("td", base_exp),
		gold_cell
	];
	var cells_2 = [];
	var cells_3 = [];
	
	once.materials.sort(function (a, b){
		var c = a.exp_as_feed - b.exp_as_feed;
		if (c == 0) c = b.priority - a.priority;
		return c;
	});
	
	function _material_cell(once, pos){
		var td = create_cell("td");
		td.classList.add("material");
		if (pos < once.materials.length) {
			td.innerHTML = once.materials[pos].toString();
			td.classList.add(
				once.materials[pos].same_element ? "fit" :
				once.materials[pos].same_element === null ? "noelement" :
				"different"
			);
		} else {
			td.classList.add("empty");
		}
		return td;
	}
	
	for (var i=0; i<5; i++) {
		var p2 = i % 5;
		var p3 = p2 + 5;
		cells_2.push(_material_cell(once, p2));
		cells_3.push(_material_cell(once, p3));
	}
	
	for (var i=0; i<2; i++) {
		var great = i == 1;
		
		var gain_exp = once.recalcExp(great);
		var est_exp = base_exp + gain_exp;
		var est_level = exp_to_level(est_exp, limit_level, exp_table);
		var est_next = est_level == limit_level ? 0 : exp_table[est_level] - est_exp;
		
		var remain_exp = limit_exp - est_exp;
		
		var next_text = "";
		if (!great && once.comment_succeed != "") {
			next_text = once.comment_succeed;
		} else if (great && once.comment_great != "") {
			next_text = once.comment_great;
		}
		
		// next
		let next_element = create_html_cell("td", next_text, 2, 2);
		if (next_text == COMMENT_RECALC) {
			// 再計算の場合、ここから再計算ボタンを表示
			let button = document.createElement("button");
			button.textContent = "ここから再計算";
			button.dataset.main = is_main ? 1 : 0;
			button.dataset.index = index;
			button.dataset.great = great ? 1 : 0;
			button.addEventListener("click", ev_click_recalc);
			
			next_element.appendChild(document.createElement("br"));
			next_element.appendChild(button);
		}
		
		cells_1.push(create_cell("td", est_level));
		cells_1.push(create_cell("td", est_next));
		cells_1.push(create_cell("td", est_exp));
		cells_1.push(create_cell("td", remain_exp, 1, 1, remain_exp < 0 ? "overexp" : remain_exp == 0 ? "justexp" : ""));
		
		var class2 = (great ? "great" : "succeed") + " header2";
		cells_2.push(create_cell("td", "獲得経験値", 1, 1, class2));
		cells_2.push(create_cell("td", "累計費用", 1, 1, class2));
		cells_2.push(next_element);
		
		cells_3.push(create_cell("td", "+" + gain_exp));
		cells_3.push(create_cell("td", once.total_gold_to_powerup + extragold));
	}
	
	tbody.appendChild(create_row(cells_1));
	tbody.appendChild(create_row(cells_2));
	tbody.appendChild(create_row(cells_3));
	
	return tbody;
}


