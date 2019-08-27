// 家具コイン

const FURNITURE_COIN_S = 200;
const FURNITURE_COIN_M = 400;
const FURNITURE_COIN_L = 700;

// 家具コイン上限
const FURNITURE_COIN_CAP = 200000;


document.addEventListener("DOMContentLoaded", kancolle_fcoin_init);


// -------------------------------------------------------------------------------------------------
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


