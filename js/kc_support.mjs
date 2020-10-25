// 支援艦隊を最適化しよう！

import * as Global from "./kc_support_global.mjs";
import {DOM, NODE, TEXT, ELEMENT, DragdataProvider, message_bar, httpload_csv_async} from "./utility.mjs";
import * as Util from "./utility.mjs";
import {LSUserData} from "./utility_io.mjs";
import {ShipSelector} from "./kc_ship_selector.mjs";
import {
	EquipmentDatabase,
	EquipableInfo,
	EquipmentSelect,
	EquipmentSlot,
	EquipmentBonusData,
	EquipmentBonus,
} from "./kc_equipment.mjs";
import {SupportFleet} from "./kc_support_fleet.mjs";
import {SupportFleetData} from "./kc_support_fleet_data.mjs";
import {SupportFleetScore, SupportShipScore} from "./kc_support_score.mjs";
import {DamageTable} from "./kc_damage_table.mjs";
import {DOMDialog} from "./dom_dialog.mjs";

import {
	OwnEquipmentForm,
	OwnResetDialog,
	OwnConvertDialog,
} from "./kc_support_equip.mjs";

// 動的に読み込まれるデータ
// 艦情報 (kancolle_shiplist.csv)
let KANCOLLE_SHIPLIST = null;
// 装備情報 (kancolle_equipment.csv)
let KANCOLLE_EQUIPLIST = null;
// 装備可能 (kancolle_equipable.csv)
let KANCOLLE_EQUIPABLE = null;
// 装備ボーナス (kancolle_equipbonus.csv)
let KANCOLLE_EQUIPBONUS = null;

// 装備フォーム
let own_equipment_form = null;
// 支援艦隊フォーム
let support_fleet_A = null;
let support_fleet_B = null;
// 損傷率
let damage_table = null;
// データの保存
let userdata_object = null;
// ドラッグドロップ情報の仲介
let dragdata_provider = null;

// 初期化完了フラグ
let page_domloaded = false;
let page_initialized = false;

// 他のファイルのロードや初期化関数の呼び出し
let kancolle_shiplist_loader = httpload_csv_async("data/kancolle_shiplist.csv", true, function (obj){
	KANCOLLE_SHIPLIST = obj;
	kancolle_support_init(obj);
});

let kancolle_equipment_loader = httpload_csv_async("data/kancolle_equipment.csv", true, function (obj){
	KANCOLLE_EQUIPLIST = obj;
	kancolle_support_init(obj);
});

let kancolle_equipable_loader = httpload_csv_async("data/kancolle_equipable.csv", true, function (obj){
	KANCOLLE_EQUIPABLE = obj;
	kancolle_support_init(obj);
});

let kancolle_equipbonus_loader = httpload_csv_async("data/kancolle_equipbonus.csv", true, function (obj){
	KANCOLLE_EQUIPBONUS = obj;
	kancolle_support_init(obj);
});

document.addEventListener("DOMContentLoaded", function (){
	page_domloaded = true;
	kancolle_support_init(true);
});


// 初期化 ------------------------------------------------------------------------------------------
// 何度か呼び出される
// result: 読み込み成功フラグ。何かに失敗していると偽
function kancolle_support_init(result){
	if (!result) {
		message_bar.show("読み込みエラーっぽい？");
		return;
	}
	
	if ( page_initialized  ||
		!KANCOLLE_SHIPLIST   ||
		!KANCOLLE_EQUIPLIST  ||
		!KANCOLLE_EQUIPABLE  ||
		!KANCOLLE_EQUIPBONUS ||
		!page_domloaded )
	{
		return;
	}
	
	// module初期化
	DOMDialog.initialize();
	ShipSelector.initialize(KANCOLLE_SHIPLIST);
	EquipmentDatabase.initialize(KANCOLLE_SHIPLIST, KANCOLLE_EQUIPLIST, KANCOLLE_EQUIPABLE, KANCOLLE_EQUIPBONUS);
	
	own_equipment_form = new OwnEquipmentForm();
	support_fleet_A = new SupportFleet(DOM("support_A"), "A");
	support_fleet_B = new SupportFleet(DOM("support_B"), "B");
	damage_table = new DamageTable(DOM("damage"));
	userdata_object = new LSUserData("kancolle_support_data", Global.SUPPORT_SAVEDATA_VERSION, update_userdata);
	dragdata_provider = new DragdataProvider();
	
	// 所持装備リスト
	own_equipment_form.create();
	own_equipment_form.select_tab(0);
	own_equipment_form.addEventListener("change", e => save_userdata());
	
	// 艦隊
	support_fleet_A.create("支援艦隊A", 3);
	support_fleet_A.onchange = e => save_userdata();
	support_fleet_A.set_draggable(dragdata_provider);
	support_fleet_B.create("支援艦隊B", 9);
	support_fleet_B.onchange = e => save_userdata();
	support_fleet_B.set_draggable(dragdata_provider);
	
	// 損傷率
	damage_table.create_contents();
	
	// 探索ボタン
	function _click(id, func){
		let e = DOM(id);
		if (e) e.addEventListener("click", func);
	}
	_click("fast_optimize", ev_click_fast_optimize);
	_click("random_optimize", ev_click_random_optimize);
	_click("clear_equipment", ev_click_clear_equipment);
	
	_click("reset_dialog", ev_click_reset_dialog);
	_click("convert_dialog", ev_click_convert_dialog);
	
	_click("header_tab", ev_click_header_tab);
	
	// load localStorage
	load_userdata();
	
	// 装備欄更新
	own_equipment_form.refresh_tab();
	
	// 後片付け
	kancolle_shiplist_loader   = null;
	kancolle_equipment_loader  = null;
	kancolle_equipable_loader  = null;
	kancolle_equipbonus_loader = null;
	page_initialized = true;
	
	message_bar.start_hiding();
	console.log("み");
	
/*  debug用
	//let header = DOM("header_tab");
	//select_header_tab(header.children[1]);
	_click("test", ev_click_test);
	_click("test2", ev_click_test2);
	_click("test3", ev_click_test3);
	for (let e of document.querySelectorAll(".debug")) e.style.display = "unset";
// */
}


function load_form(prepare){
	let fleet_data = new SupportFleetData();
	fleet_data.set_own_data(own_equipment_form.get_calc_data());
	
	if (!fleet_data.append_fleet(support_fleet_A) || !fleet_data.append_fleet(support_fleet_B)) {
		// ここには来ないはず
		debugger;
		message_bar.show("不明なエラーです", 10000);
		return null;
	}
	
	if (prepare) {
		// 本隊装備数のエラーは大目に見る
		fleet_data.modify_remainings();
		// 固定をカウント
		fleet_data.countup_equipment(false, true);
		
		// 固定については厳しく見る
		if (!fleet_data.verify()) {
			message_bar.show("エラー", 10000);
			return null;
		}
		
		// 装備の確認
		// 数を入力できない装備/除外装備について
		//   固定→そのまま
		//   固定以外→解除
		fleet_data.clear_slots(true, false, false, true);
		// 非固定をカウント
		fleet_data.countup_equipment(true, false);
		
		// 固定以外で矛盾→装備解除
		if (!fleet_data.verify()) {
			console.log("装備に矛盾あり、非固定全解除");
			fleet_data.countup_equipment(true, false, -1);
			fleet_data.clear_slots(true, false);
			
			// 固定でも矛盾→エラー
			if (!fleet_data.verify()) {
				message_bar.show("所持数と装備の固定数に矛盾があります", 10000);
				return null;
			}
		}
	}
	
	fleet_data.ssd_list.forEach(ssd => ssd.calc_bonus());
	return fleet_data;
}


function save_form(fleet_data){
	fleet_data.sort_equipment(Global.SORT_BY_ID, true);
	fleet_data.save_to_form();
	save_userdata();
	support_fleet_A.refresh_display();
	support_fleet_B.refresh_display();
	
	//console.log("スコア", new SupportFleetScore(fleet_data.ssd_list));
}


// タブの切り替え
function select_header_tab(tab){
	let header = DOM("header_tab");
	
	// data-relate-id に仕込んでおく
	let show_id = tab.dataset.relateId;
	let show_elem = show_id && DOM(show_id);
	
	if (show_elem) {
		for (let child of header.children) {
			if (child != tab) {
				child.classList.remove("selected");
				
				let hide_id = child.dataset.relateId;
				let hide_elem = hide_id && DOM(hide_id);
				if (hide_elem) {
					hide_elem.style.display = "none";
				}
			}
		}
		
		tab.classList.add("selected");
		
		if (show_elem) {
			show_elem.style.display = "block";
		}
	}
}

// タブの切り替え
function ev_click_header_tab(e){
	// data-relate-id に仕込んでおく
	let show_id = e.target.dataset.relateId;
	let show_elem = show_id && DOM(show_id);
	
	if (show_elem) {
		select_header_tab(e.target);
	}
}

// 高速探索
function ev_click_fast_optimize(){
	let fleet_data = load_form(true);
	if (!fleet_data) return;
	
	let a = new Date;
	fleet_data.priority_call(x => {
		fleet_data.fill();
		fleet_data.hill_climbling1();
		fleet_data.single_climbling(false);
		fleet_data.hill_climbling1();
	}, true);
	let b = new Date;
	
	save_form(fleet_data);
	
	let msec = b.getTime() - a.getTime();
	message_bar.show("高速探索完了！ (" + msec + "ms)", 3000);
}

// ランダム探索
function ev_click_random_optimize(){
	let fleet_data = load_form(true);
	if (!fleet_data) return;
	
	let a = new Date;
	fleet_data.priority_call(x => {
		fleet_data.annealing();
		//fleet_data.single_climbling(false);
	}, true);
	let b = new Date;
	
	save_form(fleet_data);
	
	let msec = b.getTime() - a.getTime();
	message_bar.show("ランダム探索完了！ (" + msec + "ms)", 3000);
}

// 装備解除(固定を除く)
function ev_click_clear_equipment(){
	let fleet_data = load_form(false);
	if (!fleet_data) return;
	
	fleet_data.clear_slots(true, false);
	
	save_form(fleet_data);
	
	message_bar.show("固定されていない装備を解除しました", 3000);
}

// 装備数・所持数のリセット
function ev_click_reset_dialog(){
	let dialog = new OwnResetDialog(own_equipment_form);
	dialog.create();
	dialog.addEventListener("exit", e => {
		if (e.detail == "ok") save_userdata();
		dialog.dispose();
	});
	dialog.show();
}

// データ変換
function ev_click_convert_dialog(){
	let dialog = new OwnConvertDialog(own_equipment_form);
	dialog.create();
	dialog.addEventListener("exit", e => {
		if (e.detail == "ok") save_userdata();
		dialog.dispose();
	});
	dialog.show();
}


// test --------------------------------------------------------------------------------------------
function ev_click_test(){
	let a = new Promise((res, rej) => {
		setTimeout(() => {
			console.log("end a");
			res(10);
		}, 1000);
	});
	let b = new Promise((res, rej) => {
		setTimeout(() => {
			console.log("end b");
			res(20);
		}, 1500);
	});
	
	a.then(e => console.log("a.then"));
	b.then(e => console.log("b.then"));
	
	Promise.all([a, b]).then(e => console.log("all end", e));
	
}

function ev_click_test2(){
	if (1) {
		for (let d of own_equipment_form.data_array) {
			d.total_counts[0] = 1;
			d.total_counts[5] = 0;
			d.total_counts[10] = 1;
		}
		own_equipment_form.refresh_tab();
		return;
	}
	
	if (0) {
		console.time("test2");
		
		let fleet_data = load_form(true);
		if (!fleet_data) return;
		
		fleet_data.assert_count("before check");
		fleet_data.fill();
		fleet_data.assert_count("after check");
		
		save_form(fleet_data);
		
		console.timeEnd("test2");
	}
	
	if (0) {
		performance_check(f => {
			let ssds = f.ssd_list;
			f.ssd_list = ssds.slice(6, 12);
			f.fill();
			f.annealing();
			f.ssd_list = ssds.slice(0, 6).concat(f.ssd_list);
		}, "annealing half", 100);
	}
}

function ev_click_test3(){
	if (0) {
		console.time("test3");
		
		let fleet_data = load_form(true);
		if (!fleet_data) return;
		
		fleet_data.assert_count("before check");
		let a = new Date;
		fleet_data.priority_call(x => {
			fleet_data.fill();
			fleet_data.hill_climbling1();
		}, true);
		let b = new Date;
		
		let msec = b.getTime() - a.getTime();
		message_bar.show("test3探索完了！ (" + msec + "ms)", 3000);
		
		fleet_data.assert_count("after check");
		
		console.timeEnd("test3");
		save_form(fleet_data);
	}
	
	performance_check(f => {
		f.fill();
		f.annealing();
	}, "annealing beta", 100);
}


// データの保存・読込 ------------------------------------------------------------------------------
function load_userdata(){
	if (!userdata_object.load()) return;
	
	own_equipment_form.set_json(userdata_object.data.own_data);
	support_fleet_A.set_json(userdata_object.data.fleet_A);
	support_fleet_B.set_json(userdata_object.data.fleet_B);
}

function save_userdata(){
	if (!userdata_object.data) userdata_object.data = new Object;
	
	userdata_object.data.own_data = own_equipment_form.get_json(userdata_object.data.own_data);
	userdata_object.data.fleet_A  = support_fleet_A.get_json();
	userdata_object.data.fleet_B  = support_fleet_B.get_json();
	
	userdata_object.save();
}


// データの更新
function update_userdata(data, data_version, newdata_version){
	let version = data_version;
	
	if (version == 1) {
		// フォームのjson変更(★に対応など)
		let eq_array = new Array;
		data.own_data = {data: eq_array};
		
		if (data.own_forms && data.own_forms.own_list) {
			let list = data.own_forms.own_list;
			for (let i=0; i<list.length; i++) {
				let d = list[i];
				let js = {
					id  : d.id,
					main: {0: +d.main_use},
					own : {0: +d.total},
				};
				if (js.main[0] != 0 || js.own[0] != 0) {
					eq_array.push(js);
				}
			}
			delete data.own_forms;
		}
		
		version = 2;
	}
	
	data.version = version;
	return data;
}


// シミュレーション --------------------------------------------------------------------------------
// 探索関数の性能を測る非同期関数
// func(fleet_data): 呼び出す関数
// loop_count: ループ回数
// base_time
function performance_check(func, name, loop_count, base_time = 1000){
	// シミュレーション
	let simulate_phase = 0;
	let simulate_phase_max = loop_count;
	let simulate_result = new Array;
	
	// precall
	{
		let fleet_data = load_form(true);
		if (!fleet_data) return;
		
		fleet_data.countup_equipment(true, false, -1);
		fleet_data.clear_slots(true, false);
		fleet_data.ssd_list.forEach(ssd => ssd.calc_bonus());
		
		func(fleet_data);
	}
	
	console.log("simulate start. (", name, ",", loop_count, ")");
	setTimeout(_simulate, 0);
	
	function _simulate(){
		let fleet_data = load_form(true);
		if (!fleet_data) return;
		
		fleet_data.countup_equipment(true, false, -1);
		fleet_data.clear_slots(true, false);
		fleet_data.ssd_list.forEach(ssd => ssd.calc_bonus());
		
		let a = new Date;
		func(fleet_data);
		let b = new Date;
		
		let score = new SupportFleetScore(fleet_data.ssd_list);
		let res = {
			msec    : b.getTime() - a.getTime(),
			accuracy: score.total_accuracy,
			score   : score,
		};
		simulate_result.push(res);
		console.log(++simulate_phase, res);
		
		if (simulate_phase < simulate_phase_max) {
			setTimeout(_simulate, 0);
			
		} else {
			_evaluate();
		}
	}
	
	function _evaluate(){
		let msec_sum = 0;
		let acc_min = 9999, acc_max = 0, acc_sum = 0, acc_sqsum = 0;
		//let max_score = null;
		let acc_counts = [];
		let sim_count = simulate_result.length;
		
		for (let result of simulate_result) {
/*
			let c = max_score ? max_score.compare(result.score) : -1;
			if (c < 0) {
				max_score = result.score;
			}
*/
			
			let acc = result.accuracy;
			if (acc_min > acc) acc_min = acc;
			if (acc_max < acc) acc_max = acc;
			acc_sum += acc;
			acc_sqsum += acc * acc;
			
			acc_counts[acc] = (acc_counts[acc] || 0) + 1;
			
			msec_sum += result.msec;
		}
		
		let max_count = acc_counts[acc_max];
		let count_12 = max_count + (acc_counts[acc_max - 1] || 0);
		let count_123 = count_12 + (acc_counts[acc_max - 2] || 0);
		
		let acc_avg = acc_sum / sim_count;
		let avg_time = msec_sum / sim_count;
		let acc_sd = acc_sqsum / sim_count - acc_avg * acc_avg;
		let perf_score    = 1 - Math.pow(1 - max_count / sim_count, base_time / avg_time);
		let perf_score12  = 1 - Math.pow(1 - count_12  / sim_count, base_time / avg_time);
		let perf_score123 = 1 - Math.pow(1 - count_123 / sim_count, base_time / avg_time);
		
		console.log("simulate end. (", name, ",", simulate_result.length, ")");
		console.log("avg time:", avg_time, ", max:", max_count, "/", sim_count, "=", max_count / sim_count);
		console.log("accuracy: [", acc_min ,"..", acc_max, "], avg", acc_avg, "sd", acc_sd);
		console.log("performance score:", acc_max, ",", max_count, ",", perf_score);
		console.log("2nd score: >=", acc_max-1, ",", count_12, ",", perf_score12);
		console.log("3rd score: >=", acc_max-2, ",", count_123, ",", perf_score123);
	}
}


