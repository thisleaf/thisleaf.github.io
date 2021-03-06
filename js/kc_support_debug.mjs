// デバッグ用のコード
// こちらのファイルに分離しておく

// TODO: DEBUG_MODE release時にはfalseに
const DEBUG_MODE = false;


import * as Global from "./kc_support_global.mjs";
import {DOM, NODE, TEXT, ELEMENT, DragdataProvider, message_bar, httpload_csv_async} from "./utility.mjs";
import * as Util from "./utility.mjs";
import {LSUserData} from "./utility_io.mjs";
import {
	ShipSelector,
	ShipSelectorDialog,
} from "./kc_ship_selector.mjs";
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
import {
	SupportFleetScore,
	SupportShipScore,
	SupportFleetScorePrior,
} from "./kc_support_score.mjs";
import {DamageTable} from "./kc_damage_table.mjs";
import {DOMDialog} from "./dom_dialog.mjs";

import {
	OwnEquipmentForm,
	OwnResetDialog,
	OwnConvertDialog,
} from "./kc_support_equip.mjs";
import {
	OutputDeckDialog,
} from "./kc_support_output.mjs";
import {
	worker_get,
	worker_release,
	MultiThreadSearcher,
} from "./kc_support_mt.mjs";
import {BonusViewer} from "./kc_bonus_viewer.mjs";
import {RomajiSearch} from "./romaji_search.mjs";


export {
	DEBUG_MODE,
	init,
};

// kc_support.mjs から渡されるオブジェクト
// データを渡す役目
let debug_object = null;


// Debug -------------------------------------------------------------------------------------------
// デバッグモードならばボタンを表示したりする
function init(obj){
	if (!DEBUG_MODE) return;

	debug_object = obj;
	
	let _click = (id, func) => {
		let e = DOM(id);
		if (e) e.addEventListener("click", func);
	};
	
	_click("test", ev_click_test);
	_click("test2", ev_click_test2);
	_click("test3", ev_click_test3);
	for (let e of document.querySelectorAll(".debug")) e.style.display = "unset";
	
	DOM("header_tab").children[2].click();
	
	console.log("debug mode");
}



// event -------------------------------------------------------------------------------------------
function ev_click_test(){
}

function ev_click_test2(){
	if (0) {
		for (let d of own_equipment_form.data_array) {
			d.total_counts[0] = 1;
			d.total_counts[5] = 0;
			d.total_counts[10] = 1;
		}
		own_equipment_form.refresh_tab();
		return;
	}
}

function ev_click_test3(){
	performance_check(f => {
		//f.annealing_entire(1);
		f.annealing(1);
/*
		f.priority_call(x => {
			f.annealing(1);
		}, true);
*/
	}, "annealing beta", 100);
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
		
		let score = new SupportFleetScorePrior(fleet_data.ssd_list);
		let res = {
			msec    : b.getTime() - a.getTime(),
			accuracy: score.total_score.total_accuracy,
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
		let acc_counts = [];
		let sim_count = simulate_result.length;
		let max_score = null;
		let max_count = 0;
		
		for (let result of simulate_result) {
			let c = -1;
			let c1 = -1;
			if (max_score) {
				c1 = max_score.compare_s1(result.score);
				c = c1 || max_score.compare_s2(result.score) || max_score.compare_s3(result.score);
			}
			if (c < 0) {
				max_score = result.score;
			}
			if (c1 < 0) {
				max_count = 1;
			} else if (c1 == 0) {
				max_count++;
			}
			
			let acc = result.accuracy;
			if (acc_min > acc) acc_min = acc;
			if (acc_max < acc) acc_max = acc;
			acc_sum += acc;
			acc_sqsum += acc * acc;
			
			acc_counts[acc] = (acc_counts[acc] || 0) + 1;
			
			msec_sum += result.msec;
		}
		
		let count_1 = acc_counts[acc_max];
		let count_12 = count_1 + (acc_counts[acc_max - 1] || 0);
		let count_123 = count_12 + (acc_counts[acc_max - 2] || 0);
		
		let acc_avg = acc_sum / sim_count;
		let avg_time = msec_sum / sim_count;
		let acc_sd = acc_sqsum / sim_count - acc_avg * acc_avg;
		let perf_score    = 1 - Math.pow(1 - count_1   / sim_count, base_time / avg_time);
		let perf_score12  = 1 - Math.pow(1 - count_12  / sim_count, base_time / avg_time);
		let perf_score123 = 1 - Math.pow(1 - count_123 / sim_count, base_time / avg_time);
		
		console.log("simulate end. (", name, ",", simulate_result.length, ")");
		console.log("avg time:", avg_time, ", max:", max_count, "/", sim_count, "=", max_count / sim_count, ", max acc:", max_score?.total_score?.total_accuracy);
		console.log("accuracy: [", acc_min ,"..", acc_max, "], avg", acc_avg, "sd", acc_sd);
		console.log("1st score:", acc_max, ",", count_1, ",", perf_score);
		console.log("2nd score: >=", acc_max-1, ",", count_12, ",", perf_score12);
		console.log("3rd score: >=", acc_max-2, ",", count_123, ",", perf_score123);
	}
}

