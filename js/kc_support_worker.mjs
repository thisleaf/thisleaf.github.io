// マルチスレッドのためのワーカーで読み込まれるファイル

import * as Global from "./kc_support_global.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import {SupportFleetData} from "./kc_support_fleet_data.mjs";
import {SupportFleetScorePrior} from "./kc_support_score.mjs";

// 前回実行時のデータ
// 引き継いで実行することができる
let previous_fleet   = null;
let previous_json_MT = null;


self.addEventListener("message", worker_ev_message);


/*  メッセージメモ
	type: メッセージのタイプ
	id  : メッセージを区別するためのid、送ったときの値が返信で返ってくる(省略可)
*/
function worker_ev_message(e){
	let message = e.data;
	
	if (message.type == "initialize") {
		// データの初期化
		if (EquipmentDatabase.initialized) {
			debugger;
		} else {
			EquipmentDatabase.set_data(message.data);
		}
		
	} else if (message.type == "search") {
		let fleet;
		let json_MT;
		
		// message.inherit_data が true のときは、前回のデータを引き継ぐ
		// message.data は空で良い
		if (message.inherit_data) {
			fleet = previous_fleet;
			json_MT = previous_json_MT;
		} else {
			fleet = new SupportFleetData();
			fleet.set_json_MT(message.data, false);
			json_MT = message.data;
		}
		
		// message.search_type に探索方法
		if (message.search_type == "annealing") {
			// 焼きなまし
			let iteration_scale = message.iteration_scale || 1;
			fleet.priority_call(x => {
				fleet.annealing(iteration_scale);
			}, true);
			
		} else if (message.search_type == "fast") {
			// 高速探索
			fleet.priority_call(x => {
				fleet.fill();
				fleet.hill_climbling1();
				fleet.single_climbling(false);
				fleet.hill_climbling1();
			}, true);
		}
		
		previous_fleet = fleet;
		previous_json_MT = json_MT;
		
		self.postMessage({
			type       : "solution",
			search_type: message.search_type,
			id         : message.id || null,
			data       : fleet.get_json_MT(json_MT, false),
			score_data : new SupportFleetScorePrior(fleet.ssd_list),
		});
		
	} else if (message.type == "close") {
		self.close();
		
	} else if (message.type == "test") {
		self.postMessage(message);
	}
}

