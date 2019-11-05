// 支援艦隊を最適化しよう！

import * as Global from "./kc_support_global.mjs";
import {DOM, DragdataProvider, message_bar, httpload_csv_async} from "./utility.mjs";
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
import {OwnEquipmentForms, SupportFleet} from "./kc_support_fleet.mjs";
import {SupportFleetData} from "./kc_support_fleet_data.mjs";
import {SupportFleetScore, SupportShipScore} from "./kc_support_score.mjs";
import {DamageTable} from "./kc_damage_table.mjs";


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
let own_equipment_forms = null;
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
	ShipSelector.initialize(KANCOLLE_SHIPLIST);
	EquipmentDatabase.initialize(KANCOLLE_SHIPLIST, KANCOLLE_EQUIPLIST, KANCOLLE_EQUIPABLE, KANCOLLE_EQUIPBONUS);
	
	own_equipment_forms = new OwnEquipmentForms;
	support_fleet_A = new SupportFleet(DOM("support_A"), "A");
	support_fleet_B = new SupportFleet(DOM("support_B"), "B");
	damage_table = new DamageTable(DOM("damage"));
	userdata_object = new LSUserData("kancolle_support_data", Global.SUPPORT_SAVEDATA_VERSION, null);
	dragdata_provider = new DragdataProvider;
	
	// 所持装備リスト
	own_equipment_forms.create();
	own_equipment_forms.onchange = e => save_userdata();
	
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
	
	_click("clear_owns_main", ev_click_clear_owns_main);
	_click("clear_owns", ev_click_clear_owns);
	
	_click("test", ev_click_test);
	_click("test2", ev_click_test2);
	_click("test3", ev_click_test3);
	
/*
	let rec = new FormRecorder;
	rec.create(DOM("header_tool"));
*/
	
	// load localStorage
	load_userdata();
	
	// 後片付け
	kancolle_shiplist_loader   = null;
	kancolle_equipment_loader  = null;
	kancolle_equipable_loader  = null;
	kancolle_equipbonus_loader = null;
	page_initialized = true;
	
	message_bar.start_hiding();
	console.log("み");
	
	// debug用
	//for (let e of document.querySelectorAll(".debug")) e.style.display = "unset";
}



function load_form(load_owns){
	let fleet_data = new SupportFleetData;
	
	if (!fleet_data.append_fleet(support_fleet_A) || !fleet_data.append_fleet(support_fleet_B)) {
		// ここには来ないはず
		message_bar.show("不明なエラーです", 10000);
		return null;
	}
	
	if (load_owns) {
		own_equipment_forms.clear_error();
		
		if (!fleet_data.set_own_data(own_equipment_forms)) {
			message_bar.show("所持数の入力に誤りがあります", 10000);
			return null;
		}
		
		// 装備の確認
		// リストにない装備については
		//   固定→そのまま
		//   固定以外→解除
		fleet_data.clear_not_in_owns(false);
		fleet_data.init_calcvars();
		
		// 固定以外で矛盾→装備解除
		if (!fleet_data.verify()) {
			let own_map = fleet_data.get_own_map();
			fleet_data.clear_varslot_all(own_map);
			
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
	fleet_data.sort_equipment();
	fleet_data.save_to_form();
	save_userdata();
	support_fleet_A.refresh_display();
	support_fleet_B.refresh_display();
	
	//console.log("スコア", new SupportFleetScore(fleet_data.ssd_list));
}


// main の装備数をクリア
function ev_click_clear_owns_main(){
	own_equipment_forms.clear_form(true, false);
	save_userdata();
}

// 所持数をクリア
function ev_click_clear_owns(){
	own_equipment_forms.clear_form(false, true);
	save_userdata();
}

// 高速探索
function ev_click_fast_optimize(){
	let fleet_data = load_form(true);
	if (!fleet_data) return;
	
	let a = new Date;
	fleet_data.priority_call(x => {
		fleet_data.fill();
		fleet_data.single_climbling(false);
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
		fleet_data.single_climbling(false);
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
	
	fleet_data.clear_varslot_all(fleet_data.get_own_map());
	
	save_form(fleet_data);
	
	message_bar.show("固定されていない装備を解除しました", 3000);
}


function ev_click_test(){
	// シミュレーション
	let simulate_phase = 0;
	let simulate_phase_max = 100;
	let simulate_result = new Array;
	
	setTimeout(_simulate, 0);
	
	function _simulate(){
		let fleet_data = load_form(true);
		if (!fleet_data) return;
		
		fleet_data.clear_varslot_all(fleet_data.get_own_map());
		fleet_data.ssd_list.forEach(ssd => ssd.calc_bonus());
		
		let a = new Date;
		fleet_data.priority_call(x => {
			fleet_data.annealing();
			fleet_data.single_climbling(false);
		}, true);
/*
		fleet_data.annealing();
		fleet_data.single_climbling(false);
*/
		let b = new Date;
		
		let score = new SupportFleetScore(fleet_data.ssd_list);
		let res = {
			msec: b.getTime() - a.getTime(),
			accuracy: score.total_accuracy,
			score: score,
		};
		simulate_result.push(res);
		console.log(++simulate_phase, res);
		
		if (simulate_phase < simulate_phase_max) {
			setTimeout(_simulate, 0);
			
		} else {
			let msec_avg = 0;
			let min = 9999, max = 0, acc_avg = 0;
			for (let result of simulate_result) {
				let acc = result.accuracy;
				if (min > acc) min = acc;
				if (max < acc) max = acc;
				acc_avg += acc;
				msec_avg += result.msec;
			}
			acc_avg /= simulate_result.length;
			msec_avg /= simulate_result.length;
			
			console.log("count:", simulate_result.length, "avg time:", msec_avg, "scores:", min, max, acc_avg);
		}
	}
}

function ev_click_test2(){
	console.time("test2");
	console.timeEnd("test2");
}

function ev_click_test3(){
	console.time("test3");
	console.timeEnd("test3");
}


// データの保存・読込 ------------------------------------------------------------------------------
function load_userdata(){
	if (!userdata_object.load()) return;
	
	own_equipment_forms.set_json(userdata_object.data.own_forms);
	support_fleet_A.set_json(userdata_object.data.fleet_A);
	support_fleet_B.set_json(userdata_object.data.fleet_B);
}

function save_userdata(){
	if (!userdata_object.data) userdata_object.data = new Object;
	userdata_object.data.own_forms = own_equipment_forms.get_json(userdata_object.data.own_forms);
	userdata_object.data.fleet_A   = support_fleet_A.get_json();
	userdata_object.data.fleet_B   = support_fleet_B.get_json();
	
	userdata_object.save();
}



