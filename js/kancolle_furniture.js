// その他の計算機

document.addEventListener("DOMContentLoaded", () => {
	kancolle_fcoin_init();
	kc_base_status_init();
});


// 家具コイン --------------------------------------------------------------------------------------
const FURNITURE_COIN_S = 200;
const FURNITURE_COIN_M = 400;
const FURNITURE_COIN_L = 700;

// 家具コイン上限
const FURNITURE_COIN_CAP = 200000;


function kancolle_fcoin_init(){
	// イベントのセット
	let ids = ["fbox_S", "fbox_M", "fbox_L", "furniture_coin"];
	
	for (let i=0; i<ids.length; i++) {
		let e = DOM(ids[i]);
		if (e) e.addEventListener("change", ev_change_boxcoin);
	}
	
	let click_ids = [
		"fbox_open_all_S" , "fbox_open_all_M" , "fbox_open_all_L" ,
		"fbox_open_half_S", "fbox_open_half_M", "fbox_open_half_L",
		"fbox_open_10_S"  , "fbox_open_10_M"  , "fbox_open_10_L"  ,
	];
	for (let i=0; i<click_ids.length; i++) {
		let e = DOM(click_ids[i]);
		if (e) e.addEventListener("dblclick", ev_dblclick_cell);
	}
	
	fcoin_refresh();
}


function ev_change_boxcoin(){
	fcoin_refresh();
}

function ev_dblclick_cell(e){
	if (!/fbox_open_(\w+)_([SML])/.test(e.currentTarget.id)) return;
	
	let count_type = RegExp.$1;
	let box = RegExp.$2;
	let form = fcoin_loadform();
	
	if (!form.good) return;
	
	let count = form[box + "_count"];
	let open_count = 0;
	
	if (count_type == "all") {
		open_count = count.value;
		
	} else if (count_type == "half") {
		open_count = Math.floor(count.value / 2);
		
	} else if (count_type == "10") {
		open_count = count.value >= 10 ? 10 : 0;
	}
	
	if (open_count == 0) return;
	
	let unit = box == "S" ? FURNITURE_COIN_S : box == "M" ? FURNITURE_COIN_M : FURNITURE_COIN_L;
	let e_box = form["e_" + box];
	
	// open_count個開ける
	form.e_coin.value = Math.min(form.coin.value + unit * open_count, FURNITURE_COIN_CAP);
	e_box.value = count.value - open_count;
	
	fcoin_refresh();
	e.preventDefault(); // いらない気はする
}


function fcoin_loadform(){
	let form = new Object;
	
	form.e_S = DOM("fbox_S");
	form.e_M = DOM("fbox_M");
	form.e_L = DOM("fbox_L");
	form.e_coin = DOM("furniture_coin");
	
	form.S_count = formstr_to_int(form.e_S.value, 0, -1);
	form.M_count = formstr_to_int(form.e_M.value, 0, -1);
	form.L_count = formstr_to_int(form.e_L.value, 0, -1);
	form.coin = formstr_to_int(form.e_coin.value, 0, -1);
	
	form.good = form.S_count.value >= 0 && form.M_count.value >= 0 && form.L_count.value >= 0 && form.coin.in_range(0, 200000);
	
	return form;
}


// コイン枚数等のセット
function fcoin_refresh(){
	let form = fcoin_loadform();
	
	// clear
	let clear_ids = [
		"fbox_coin_S"     , "fbox_coin_M"     , "fbox_coin_L"     ,
		"fbox_open_all_S" , "fbox_open_all_M" , "fbox_open_all_L" ,
		"fbox_open_half_S", "fbox_open_half_M", "fbox_open_half_L",
		"fbox_open_10_S"  , "fbox_open_10_M"  , "fbox_open_10_L"  ,
		"fcoin_total"
	];
	for (let i=0; i<clear_ids.length; i++) {
		let e = DOM(clear_ids[i]);
		e.textContent = "";
		e.className = "";
		e.title = "";
	}
	
	if (form.good) {
		// 読み込みOK
		_set_boxopen("S", FURNITURE_COIN_S, form.S_count.value, form.coin.value);
		_set_boxopen("M", FURNITURE_COIN_M, form.M_count.value, form.coin.value);
		_set_boxopen("L", FURNITURE_COIN_L, form.L_count.value, form.coin.value);
		
		// 総コイン枚数
		let c = form.coin.value;
		c += FURNITURE_COIN_S * form.S_count.value;
		c += FURNITURE_COIN_M * form.M_count.value;
		c += FURNITURE_COIN_L * form.L_count.value;
		DOM("fcoin_total").textContent = c;
	}
	
	
	function _set_boxopen(pf, unit, count, c_coin){
		// コイン枚数
		DOM("fbox_coin_" + pf).textContent = unit * count;
		// 全部開ける
		_set_open(DOM("fbox_open_all_" + pf), unit, count, c_coin);
		// 半分開ける
		_set_open(DOM("fbox_open_half_" + pf), unit, Math.floor(count / 2), c_coin);
		// 10個開ける
		_set_open(DOM("fbox_open_10_" + pf), unit, count >= 10 ? 10 : 0, c_coin);
	}
	
	function _set_open(elem, unit, count, c_coin){
		if (count <= 0) {
			elem.classList.add("fopen");
			elem.classList.add("null");
			elem.innerHTML = "<br>－<br>&nbsp;";
			return;
		}
		
		let gain = unit * count;
		let coin = gain + c_coin;
		let capped_coin = Math.min(coin, FURNITURE_COIN_CAP);
		let text = capped_coin + "<br>(+" + (capped_coin - c_coin) +")<br>";
		text += coin != capped_coin ? "! OVER !" : "OK";
		
		let tip = count + "個開けます\n";
		if (coin != capped_coin) tip += (coin - capped_coin) + "枚のコインが失われます\n";
		
		elem.classList.add("fopen");
		if (coin != capped_coin) elem.classList.add("over");
		elem.innerHTML = text;
		elem.title = tip;
	}
}


// 艦娘基礎ステータス逆算 --------------------------------------------------------------------------
function kc_base_status_init(){
	NODE(DOM("basestatus_div"), [
		kc_base_status_create_table(6, 100),
		kc_base_status_create_table(6, 200),
		kc_base_status_create_table(6, 300),
	]);
}

function kc_base_status_create_table(row_length, begin_tab_index){
	let _input = (index) => {
		let e = ELEMENT("input");
		e.type = "number";
		e.min = 0;
		e.max = 300;
		if (index >= 0) e.tabIndex = index;
		return e;
	};
	
	let tbody = ELEMENT("tbody");
	let e_in_levels = [];
	let e_in_values = [];
	let e_out_level = _input(begin_tab_index + row_length * 2);
	let e_out_cells = [];
	let e_clear_button = NODE(ELEMENT("button"), [TEXT("clear")]);
	e_clear_button.tabIndex = begin_tab_index + row_length * 2 + 1;
	
	let e_out_level_nodes = [
		[TEXT("Lv0")],
		[TEXT("Lv99")],
		[TEXT("Lv "), e_out_level],
	];
	
	for (let i=0; i<row_length; i++) {
		NODE(tbody, [
			NODE(ELEMENT("tr"), [
				NODE(ELEMENT("td", "", "inlevel"), [TEXT("Lv "), e_in_levels[i] = _input(begin_tab_index + i * 2)]),
				NODE(ELEMENT("td", "", "invalue"), [e_in_values[i] = _input(begin_tab_index + i * 2 + 1)]),
				i == 0 ? NODE(ELEMENT("td", {rowSpan: row_length, className: "rightarrowcell"}), [TEXT("⇒")]) : null,
				NODE(ELEMENT("td", "", "outlevel"), e_out_level_nodes[i] || []),
				e_out_cells[i] = ELEMENT("td", "", "outvalue"),
			]),
		]);
	}
	e_out_cells[row_length - 1].appendChild(e_clear_button);
	
	// inputから整数を得る
	// -1: エラー or 空
	let _getint = (input) => {
		let cr = formstr_to_int(input.value, -1, -1);
		input.classList.toggle("reject", cr.error);
		return cr.value;
	};
	
	let _getlvval = (i1, i2) => {
		let level = _getint(i1);
		let value = _getint(i2);
		
		let accept = level >= 0 && value >= 0;
		i1.classList.toggle("accept", accept);
		i2.classList.toggle("accept", accept);
		return {lv: level, value: value, accept: accept};
	};
	
	let _range_str = (begin, end) => {
		let text = String(begin);
		if (begin != end - 1) text += "~" + (end - 1);
		return text;
	};
	
	let _refresh = () => {
		let points = [];
		for (let i=0; i<row_length; i++) {
			let p = _getlvval(e_in_levels[i], e_in_values[i]);
			if (p.accept) points.push(p);
		}
		let out_lv = _getint(e_out_level);
		e_out_level.classList.toggle("accept", out_lv >= 0);
		
		let base = get_base_status(points);
		if (base.solved) {
			e_out_cells[0].textContent = _range_str(base.lv0_begin, base.lv0_end);
			e_out_cells[1].textContent = _range_str(base.lv99_begin, base.lv99_end);
			
			if (out_lv >= 0) {
				let range = base.at_level(out_lv);
				e_out_cells[2].textContent = _range_str(range.begin, range.end);
				
			} else {
				e_out_cells[2].textContent = "";
			}
			e_out_cells[3].textContent = base.mismatch ? "(逆算エラー)" : "";
			
		} else {
			e_out_cells[0].textContent = points.length > 0 ? "解なし" : "";
			e_out_cells[1].textContent = "";
			e_out_cells[2].textContent = "";
			e_out_cells[3].textContent = "";
		}
	};
	
	let _clear = () => {
		e_in_levels.forEach(e => e.value = "");
		e_in_values.forEach(e => e.value = "");
		e_out_level.value = "";
		_refresh();
	};
	
	e_in_levels.forEach(e => e.addEventListener("input", _refresh));
	e_in_values.forEach(e => e.addEventListener("input", _refresh));
	e_out_level.addEventListener("input", _refresh);
	e_clear_button.addEventListener("click", _clear);
	
	return NODE(ELEMENT("table", "", "black_border basestatus"), [tbody]);
}


/*
Lv0とLv99の逆算
points: {lv, value}の配列
戻り値: {
	solved: 解の範囲があるかどうか,
	unique: 解が一意か,
	mismatch: 逆算失敗の内部エラー,
	lv0_unique,
	lv99_unique,
	lv0_begin: number,
	lv0_end: number,
	lv99_begin: number,
	lv99_end: number,
	pairs: [
		{lv0, lv99_begin, lv99_end}, ...
	],
	at_level: function, // lvから範囲を返す
}, begin <= status < end
*/
function get_base_status(points){
	/*
		仮定: 0 <= Lv0 <= Lv99 < 1000
		s(Lv) := Math.floor((Lv99 - Lv0) * Lv / 99) + Lv0
		
		s(Lv) - s(0) = [(s(99) - s(0)) * Lv / 99]
		s(Lv) - s(0) <= (s(99) - s(0)) * Lv / 99 < s(Lv) - s(0) + 1
		
		s(Lv) - s(0) <= (s(99) - s(0)) * Lv / 99
		(s(Lv) - s(0)) * 99 <= (s(99) - s(0)) * Lv : ☆
		(s(Lv) - s(0)) * 99 / Lv <= s(99) - s(0)
		ceil((s(Lv) - s(0)) * 99 / Lv) <= s(99) - s(0)
		
		☆の両辺が整数、Lvもそれほど大きくないのでこれは同値変形　同様に
		
		s(99) - s(0) < ceil((s(Lv) - s(0) + 1) * 99 / Lv)
		
		Lv, s(Lv), s(0) を仮定すると s(99) の範囲が求まる
	*/
	
	if (points.length == 0) {
		return {solved: false};
	}
	
	let mismatch = false;
	let min_value = points.reduce((a, c) => Math.min(a, c.value), 1000);
	let pairs = [];
	
	// そんなにパターンはないので少しゴリ押し
	for (let b=0; b<=min_value; b++) {
		// Lv0 == b と仮定して、全ての点に一致するかを試す
		let lv99_begin = 0;
		let lv99_end = 1000;
		
		for (let i=0; i<points.length; i++) {
			if (points[i].lv == 0) {
				if (points[i].value != b) {
					// 矛盾
					lv99_end = 0;
					break;
				} else {
					if (lv99_begin < points[i].value) lv99_begin = points[i].value;
				}
				
			} else {
				// 整数に注意して逆算すると、計算誤差は大丈夫
				let lv99_i_begin = Math.ceil((points[i].value - b) * 99 / points[i].lv) + b;
				let lv99_i_end = Math.ceil((points[i].value - b + 1) * 99 / points[i].lv) + b;
				
				// 共通部分をとっていく
				if (lv99_begin < lv99_i_begin) lv99_begin = lv99_i_begin;
				if (lv99_end   > lv99_i_end  ) lv99_end   = lv99_i_end;
				
				if (lv99_begin >= lv99_end) break;
			}
		}
		
		// [lv99_begin, lv99_end - 1] がLv99の値の範囲
		if (lv99_begin < lv99_end) {
			// 解あり
			pairs.push({
				lv0: b,
				lv99_begin: lv99_begin,
				lv99_end: lv99_end,
			});
		}
		
		
		// 念の為の確認用コード
		// ・・・こっちだけでも良かったのでは
		
		if (!mismatch) {
			for (let v=b; v<1000; v++) {
				let c_high = 0;
				let c_just = 0;
				
				for (let i=0; i<points.length; i++) {
					let st = Math.floor((v - b) * points[i].lv / 99) + b;
					
					if (st > points[i].value) {
						c_high++;
					} else if (st == points[i].value) {
						c_just++;
					}
				}
				
				let in_range = lv99_begin <= v && v < lv99_end;
				let possible = c_just == points.length;
				
				if (in_range != possible) {
					mismatch = true;
					break;
				}
				if (c_high == points.length) break;
			}
			
			if (mismatch) {
				console.error("2つの逆算結果が一致しません");
			}
		}
	}
	
	let out = {
		solved  : pairs.length > 0,
		mismatch: mismatch,
		pairs   : pairs,
		// level を指定したときの範囲を求める
		// 範囲内のすべての整数に可能性があるわけではない
		at_level: function (level){
			let begin = 1000;
			let end = 0;
			for (let p of this.pairs) {
				let st_begin = Math.floor((p.lv99_begin - p.lv0) * level / 99) + p.lv0;
				let st_end = Math.floor((p.lv99_end - 1 - p.lv0) * level / 99) + p.lv0 + 1;
				// or
				if (begin > st_begin) begin = st_begin;
				if (end   < st_end  ) end   = st_end;
			}
			return {begin: begin, end: end};
		},
	};
	
	if (out.solved) {
		// 解のデータをまとめる
		out.lv0_begin   = pairs.reduce((a, c) => Math.min(a, c.lv0), 1000);
		out.lv0_end     = pairs.reduce((a, c) => Math.max(a, c.lv0 + 1), 0);
		out.lv99_begin  = pairs.reduce((a, c) => Math.min(a, c.lv99_begin), 1000);
		out.lv99_end    = pairs.reduce((a, c) => Math.max(a, c.lv99_end), 0);
		out.lv0_unique  = out.lv0_begin  == out.lv0_end - 1;
		out.lv99_unique = out.lv99_begin == out.lv99_end - 1;
		out.unique      = out.lv0_unique && out.lv99_unique;
	}
	
	return out;
}


