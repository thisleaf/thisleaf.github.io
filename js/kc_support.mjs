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
import {EnemyStatus, EnemySelectorDialog} from "./kc_enemy_status.mjs";
import {SearchTargetDialog} from "./kc_support_target.mjs";
import {SupportShip} from "./kc_support_ship.mjs";
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
import * as Debug from "./kc_support_debug.mjs";
import { SupportShipData } from "./kc_support_ship_data.mjs";


// 動的に読み込まれるデータ
// 艦情報 (kancolle_shiplist.csv)
let KANCOLLE_SHIPLIST = null;
// 装備情報 (kancolle_equipment.csv)
let KANCOLLE_EQUIPLIST = null;
// 装備可能 (kancolle_equipable.csv)
let KANCOLLE_EQUIPABLE = null;
// 装備ボーナス (kancolle_equipbonus.csv)
let KANCOLLE_EQUIPBONUS = null;
// 敵艦データ
let KANCOLLE_ENEMIES = null;

// 装備フォーム
let own_equipment_form = null;
// 支援艦隊フォーム
let support_fleet_A = null;
let support_fleet_B = null;
// ボーナスビューワー
let bonus_viewer = null;
// 損傷率
let damage_table = null;
// データの保存
let userdata_object = null;
// ドラッグドロップ情報の仲介
let dragdata_provider = null;
// マルチスレッド探索
let mt_searcher = null;


// 他のファイルのロードや初期化関数の呼び出し
Promise.all([
	httpload_csv_async("data/kancolle_shiplist.csv", true).then(obj => KANCOLLE_SHIPLIST = obj),
	httpload_csv_async("data/kancolle_equipment.csv", true).then(obj => KANCOLLE_EQUIPLIST = obj),
	httpload_csv_async("data/kancolle_equipable.csv", true).then(obj => KANCOLLE_EQUIPABLE = obj),
	httpload_csv_async("data/kancolle_equipbonus.csv", true).then(obj => KANCOLLE_EQUIPBONUS = obj),
	httpload_csv_async("data/kancolle_enemies.csv", true).then(obj => KANCOLLE_ENEMIES = obj),
	new Promise( resolve => document.addEventListener("DOMContentLoaded", () => resolve()) ),
	// ここで一度読み込むことで、スーパーリロードが効くことを期待する
	fetch(new URL("./kc_support_worker.mjs", import.meta.url).href),
])
.then(kancolle_support_init)
.catch(result => {
	message_bar.show("読み込みエラーっぽい？");
	console.error(result);
});


// 初期化 ------------------------------------------------------------------------------------------
function kancolle_support_init(){
	// module初期化
	DOMDialog.initialize();
	ShipSelector.initialize(KANCOLLE_SHIPLIST);
	EquipmentDatabase.initialize(KANCOLLE_SHIPLIST, KANCOLLE_EQUIPLIST, KANCOLLE_EQUIPABLE, KANCOLLE_EQUIPBONUS, KANCOLLE_ENEMIES);
	EquipmentDatabase.add_equipment_property("priority", Global.EQUIP_PRIORITY_DEF);
	
	own_equipment_form = new OwnEquipmentForm();
	support_fleet_A = new SupportFleet(DOM("support_A"), "A");
	support_fleet_B = new SupportFleet(DOM("support_B"), "B");
	bonus_viewer = new BonusViewer(DOM("bonus_viewer"));
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
	support_fleet_A.addEventListener("click_target", e => ev_click_target(e));
	support_fleet_A.set_draggable(dragdata_provider);
	support_fleet_B.create("支援艦隊B", 9);
	support_fleet_B.onchange = e => save_userdata();
	support_fleet_B.addEventListener("click_target", e => ev_click_target(e));
	support_fleet_B.set_draggable(dragdata_provider);
	
	// オプション
	settings_initialize_form();
	
	// 損傷率
	damage_table.create_contents();
	
	// 探索ボタンなど
	let _click = (id, func) => {
		let e = DOM(id);
		if (e) e.addEventListener("click", func);
	};
	let _change = (id, func) => {
		let e = DOM(id);
		if (e) e.addEventListener("change", func);
	};
	_click("fast_optimize", ev_click_fast_optimize);
	_click("random_optimize", ev_click_random_optimize);
	_click("clear_equipment", ev_click_clear_equipment);
	_click("random_optimize_cont", ev_click_random_optimize_cont);
	
	_click("reset_dialog", ev_click_reset_dialog);
	_click("convert_dialog", ev_click_convert_dialog);
	_click("output_deck_dialog", ev_click_output_deck_dialog);
	
	_click("header_tab", ev_click_header_tab);
	
	_change("iteration_select", ev_change_settings);
	_change("use_mt", ev_change_settings);
	_change("thread_auto", ev_change_settings);
	_change("thread_custom", ev_change_settings);
	_change("thread_input", ev_change_settings);
	_change("thread_keep_alive", ev_change_settings);
	_change("priority_option", ev_change_settings);
	
	// load localStorage
	load_userdata();
	
	// 装備欄更新
	own_equipment_form.refresh_tab();
	
	// オプションデータをGlobalからformへ
	settings_global_to_form();
	refresh_search_tools();

	// トップにデータの更新日時を表示
	let lastmod_text = [
		["艦娘データ", KANCOLLE_SHIPLIST],
		["装備データ", KANCOLLE_EQUIPLIST],
		["装備ボーナス", KANCOLLE_EQUIPBONUS],
	].reduce((a, [cap, data]) => {
		let date = Util.get_csv_last_modified(data);
		if (date) {
			a.push(cap + " " + date.toLocaleDateString([], {dateStyle: "short"}));
		}
		return a;
	}, []).join("\n");
	let e_csv = DOM("csv_update");
	if (e_csv && lastmod_text) e_csv.innerText = lastmod_text;
	
	// URLのhashを適用
	select_header_tab_by_hash(location.hash);
	// あとでhashが変わった場合にも反応するように
	window.addEventListener("hashchange", () => select_header_tab_by_hash(location.hash));

	message_bar.start_hiding();
	console.log("み");
	// start_kome_console();
	
	Debug.init({
		load_form: load_form,
	});
}


async function start_kome_console(){
	let normal = "もがみん棒";
	let result = "";
	let random_timer = (min, max) => {
		let time = Math.floor(min + Math.random() * (max - min + 1));
		return new Promise(resolve => setTimeout(resolve, time));
	};

	for (let i=0; i<normal.length; i++) {
		await random_timer(200, 1000);
		let idx = Math.random() < 0.5 ? result.length : Math.floor(Math.random() * normal.length);
		let sp = (i % 2) ? " " : "";
		console.log(normal[idx] + sp);
		result += normal[idx];
	}

	await random_timer(200, 1000);
	console.log("完成");

	await random_timer(1000, 2000);
	let same = result.split("").reduce((a, c, i) => a + (c == normal[i] ? 1 : 0), 0);
	if (same == 5) {
		console.log("美しい");
	} else if (same >= 1) {
		console.log("きれい");
	} else {
		console.log("うーんこの");
	}
}


// DOM の関数とイベント ----------------------------------------------------------------------------
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
		// 本隊装備数と所持数の矛盾
		if (!fleet_data.verify()) {
			set_search_comment("所持数と本隊装備数に矛盾があります");
			return null;
		}
		
		// 固定をカウント
		fleet_data.countup_equipment(false, true);
		
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
			
			// 固定でも矛盾→修正を試みる
			if (!fleet_data.verify()) {
				console.log("固定に矛盾あり、修正を試みます");
				fleet_data.modify_fixed_equips();
				
				// 修正不可→エラー
				if (!fleet_data.verify()) {
					set_search_comment("所持数と装備の固定数に矛盾があります");
					return null;
				}
			}
		}
	}
	
	fleet_data.calc_bonus();
	return fleet_data;
}


function save_form(fleet_data){
	fleet_data.sort_equipment(Global.SORT_BY_ID, true);
	fleet_data.save_slots();
	fleet_data.save_to_form();
	save_userdata();
	support_fleet_A.refresh_display();
	support_fleet_B.refresh_display();
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
		
		// 切替時のイベントがあれば
		
	}
}

/**
 * hashからタブを切り替え
 * @param {string} hash_string 先頭の#はあってもなくてもよい
 */
function select_header_tab_by_hash(hash_string){
	let hash = String(hash_string).replace(/^#/, "");
	if (hash) {
		for (let tab of DOM("header_tab").children) {
			if (tab.dataset.relateHash == hash) {
				select_header_tab(tab);
				break;
			}
		}
	}
}


// 設定formの初期化
function settings_initialize_form(){
	let e_iter = DOM("iteration_select");
	Util.remove_children(e_iter);
	
	let percents = [
		10, 25, 50, 75, 100, 150, 200, 300, 500, 1000,
	];
	let sel_index = 0;
	for (let i=0; i<percents.length; i++) {
		let opt = new Option(percents[i] + "%", percents[i]);
		e_iter.appendChild(opt);
		if (percents[i] == 100) {
			sel_index = i;
			opt.defaultSelected = true;
		}
	}
	e_iter.selectedIndex = sel_index;
	
	let tc = navigator.hardwareConcurrency || 1;
	DOM("thread_autodisp").textContent = `(${tc})`;
	let e_input = DOM("thread_input");
	e_input.value = tc;
	e_input.min = 1;
	e_input.max = Global.Settings.ThreadMax;
}

// formとGlobalの変換
function settings_form_to_global(){
	let tc = Util.formstr_to_int(DOM("thread_input").value, 0, 0).value;
	tc = Util.limit(tc, 1, Global.Settings.ThreadMax);
	
	let iter = Util.formstr_to_int(DOM("iteration_select").value, 100, 100).value;
	iter = Util.limit(iter, Global.Settings.AnnealingIterationMin100, Global.Settings.AnnealingIterationMax100);
	
	Global.Settings.MultiThreading        = DOM("use_mt").checked;
	Global.Settings.ThreadCountMode       = DOM("thread_auto").checked ? "auto" : "custom";
	Global.Settings.CustomThreadCount     = tc;
	Global.Settings.ThreadKeepAlive       = DOM("thread_keep_alive").checked;
	Global.Settings.PriorityOption        = DOM("priority_option").value;
	Global.Settings.AnnealingIteration100 = iter;
}

function settings_global_to_form(){
	let th_id = Global.Settings.ThreadCountMode == "auto" ? "thread_auto" : "thread_custom";
	let e_pri = DOM("priority_option");
	let e_iter = DOM("iteration_select");
	
	DOM("use_mt").checked = Global.Settings.MultiThreading;
	DOM(th_id).checked = true;
	DOM("thread_input").value = Global.Settings.CustomThreadCount;
	DOM("thread_keep_alive").checked = Global.Settings.ThreadKeepAlive;
	e_pri.value = Global.Settings.PriorityOption;
	e_iter.value = Global.Settings.AnnealingIteration100;
	
	Util.select_default_if_empty([e_pri, e_iter]);
}

// 探索のボタン等を設定や実行中かどうかなどで更新
function refresh_search_tools(){
	// MT探索中
	let running = Boolean(mt_searcher?.running);
	// 継続探索中
	let cont_running = running && mt_searcher?.continuous;
	
	DOM("fast_optimize").disabled   = running;
	DOM("random_optimize").disabled = running;
	DOM("clear_equipment").disabled = running;
	
	let e_mt = DOM("random_optimize_cont");
	
	if (cont_running) {
		// 継続探索中は終了ボタン
		let waiting_stop = !mt_searcher?.continuous_running;
		e_mt.style.display = "inline-block";
		e_mt.disabled = false;
		e_mt.textContent = waiting_stop ? "探索終了待機中" : "探索終了";
		
	} else if (running) {
		// 他の探索中はdisabled
		e_mt.style.display = "inline-block";
		e_mt.disabled = true;
		e_mt.textContent = "ランダム探索(継続)";
		
	} else if (Global.Settings.MultiThreading) {
		// 探索していない＆マルチスレッド有効
		e_mt.style.display = "inline-block";
		e_mt.disabled = false;
		e_mt.textContent = "ランダム探索(継続)";
		
	} else {
		// マルチスレッド無効
		e_mt.style.display = "none";
	}
}

function set_search_comment(text){
	DOM("optimize_comment").textContent = text;
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

	if (!fleet_data.executable("fast")) {
		set_search_comment("探索不可: " + fleet_data.reason);
		return;
	}
	
	if (Global.Settings.MultiThreading) {
		// マルチスレッド単発
		if (mt_searcher?.running) return;
		
		mt_searcher = new MultiThreadSearcher();
		mt_searcher.set_thread_count(1);
		mt_searcher.set_search_data(fleet_data, {
			type: "search",
			search_type: "fast",
		}, false);
		
		mt_searcher.addEventListener("error", ev_error_mt);
		
		mt_searcher.run().then(res => {
			fleet_data.set_json_MT(res.data, true);
			save_form(fleet_data);
			set_search_comment("高速探索終了　" + mt_searcher.get_solution_info(true, false) + "　" + mt_searcher.get_elapsed_time() + "ms");
		}).catch(res => {
		}).finally(() => {
			mt_searcher = null;
			refresh_search_tools();
		});
		set_search_comment("高速探索中...");
		refresh_search_tools();
		
	} else {
		let a = new Date;
		let a_score = new SupportFleetScorePrior(fleet_data.ssd_list, 0, SupportFleetScore.MODE_VENEMY_DAMAGE);
		fleet_data.search("fast");
		let b_score = new SupportFleetScorePrior(fleet_data.ssd_list, 0, SupportFleetScore.MODE_VENEMY_DAMAGE);
		let b = new Date;
		
		let c = MultiThreadSearcher.compare_score(a_score, b_score, "fast");
		if (c <= 0) {
			save_form(fleet_data);
		} else { // 多分こちらは来ないが念の為
			b_score = a_score;
		}
		
		let msec = b.getTime() - a.getTime();
		let diff = MultiThreadSearcher.get_score_diff(a_score, b_score, "fast", true);
		set_search_comment("高速探索終了　" + diff + "　" + msec + "ms");
	}
}

// ランダム探索
function ev_click_random_optimize(){
	let fleet_data = load_form(true);
	if (!fleet_data) return;

	let search_type = Global.Settings.PriorityOption == "entire" ? "annealing_entire" : "annealing";
	
	if (!fleet_data.executable(search_type)) {
		set_search_comment("探索不可: " + fleet_data.reason);
		return;
	}
	
	if (Global.Settings.MultiThreading) {
		// マルチスレッド単発
		if (mt_searcher?.running) return;
		
		mt_searcher = new MultiThreadSearcher();
		mt_searcher.set_thread_count_by_Global();
		mt_searcher.set_search_data(fleet_data, {
			type: "search",
			search_type: search_type,
			iteration_scale: Global.Settings.AnnealingIteration100 / 100,
		}, false);
		
		mt_searcher.addEventListener("error", ev_error_mt);
		
		mt_searcher.run().then(res => {
			fleet_data.set_json_MT(res.data, true);
			save_form(fleet_data);
			set_search_comment("ランダム探索終了　" + mt_searcher.get_solution_info(true, false) + "　" + mt_searcher.get_elapsed_time() + "ms");
		}).catch(res => {
		}).finally(() => {
			mt_searcher = null;
			refresh_search_tools();
		});
		set_search_comment("ランダム探索中...");
		refresh_search_tools();
		
	} else {
		// シングルスレッド
		let a = new Date;
		let a_score = new SupportFleetScorePrior(fleet_data.ssd_list, 0, SupportFleetScore.MODE_VENEMY_DAMAGE);
		fleet_data.search(search_type, {
			iteration_scale: Global.Settings.AnnealingIteration100 / 100,
		});
		let b_score = new SupportFleetScorePrior(fleet_data.ssd_list, 0, SupportFleetScore.MODE_VENEMY_DAMAGE);
		let b = new Date;
		
		let c = MultiThreadSearcher.compare_score(a_score, b_score, search_type);
		if (c < 0) { // 同値解なら入力値を優先
			save_form(fleet_data);
		} else {
			b_score = a_score;
		}
		
		let msec = b.getTime() - a.getTime();
		let diff = MultiThreadSearcher.get_score_diff(a_score, b_score, search_type, true);
		set_search_comment("ランダム探索終了　" + diff + "　" + msec + "ms");
	}
}

// ランダム探索(継続)
function ev_click_random_optimize_cont(){
	let search_type = Global.Settings.PriorityOption == "entire" ? "annealing_entire" : "annealing";
	
	if (mt_searcher?.running) {
		// 停止リクエスト
		mt_searcher.stop();
		refresh_search_tools();
		
	} else {
		// 開始
		let fleet_data = load_form(true);
		if (!fleet_data) return;
		
		if (!fleet_data.executable(search_type)) {
			set_search_comment("探索不可: " + fleet_data.reason);
			return;
		}
		
		mt_searcher = new MultiThreadSearcher();
		mt_searcher.set_thread_count_by_Global();
		mt_searcher.set_search_data(fleet_data, {
			type: "search",
			search_type: search_type,
			iteration_scale: Global.Settings.AnnealingIteration100 / 100,
		}, true);
		
		let update = (cap, is_end) => {
			let diff_text = mt_searcher.get_solution_info(is_end);
			let text = cap + "(" + mt_searcher.receive_count + ")";
			if (diff_text) text += "　" + diff_text;
			if (is_end) text += "　" + mt_searcher.get_elapsed_time() + "ms";
			set_search_comment(text);
		};
		
		mt_searcher.addEventListener("start", e => update("探索中...", false));
		mt_searcher.addEventListener("receive", e => update("探索中...", false));
		mt_searcher.addEventListener("finish", e => update("探索終了", true));
		mt_searcher.addEventListener("error", ev_error_mt);
		
		mt_searcher.run().then(res => {
			fleet_data.set_json_MT(res.data, true);
			save_form(fleet_data);
		}).catch(res => {
		}).finally(() => {
			mt_searcher = null;
			refresh_search_tools();
		});
		
		refresh_search_tools();
	}
}

// 装備解除(固定を除く)
function ev_click_clear_equipment(){
	let fleet_data = load_form(false);
	if (!fleet_data) return;
	
	fleet_data.clear_slots(true, false);
	fleet_data.save_slots();
	fleet_data.save_to_form();
	save_form(fleet_data);
	
	set_search_comment("固定されていない装備を解除しました");
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

// データ変換(装備のインポート)
function ev_click_convert_dialog(){
	let dialog = new OwnConvertDialog(own_equipment_form);
	dialog.create();
	dialog.addEventListener("exit", e => {
		if (e.detail == "ok") save_userdata();
		dialog.dispose();
	});
	dialog.show();
}

// データ変換(支援艦隊出力)
function ev_click_output_deck_dialog(){
	let dialog = new OutputDeckDialog(support_fleet_A, support_fleet_B);
	dialog.create();
	dialog.addEventListener("exit", e => dialog.dispose());
	dialog.show();
}

// 設定変更
function ev_change_settings(){
	settings_form_to_global();
	refresh_search_tools();
	save_userdata();
}

// マルチスレッド探索エラー
function ev_error_mt(){
	let text = "探索エラー";
	if (/\bFirefox\b/i.test(navigator.userAgent)) {
		text += " (Firefoxでは動かないかも、シングルスレッド版をご利用ください)";
	}
	set_search_comment(text);
}

/**
 * 目標設定ダイアログの呼び出し
 * @param {CustomEvent} e 
 */
function ev_click_target(e){
	let target_dialog = new SearchTargetDialog().create();
	target_dialog.setFleets(support_fleet_A, support_fleet_B);
	target_dialog.highlightShip(e.detail.src);
	target_dialog.show().then(result => {
		if (result == "ok") {
			target_dialog.dialogToFleets();
			save_userdata();
		}
		// 敵艦ステータスが更新される場合がある
		support_fleet_A.refresh_target();
		support_fleet_B.refresh_target();
		target_dialog.dispose();
	});
}


// データの保存・読込 ------------------------------------------------------------------------------
function load_userdata(){
	if (!userdata_object.load()) {
		support_fleet_A.clear();
		support_fleet_B.clear();
		return;
	}
	
	EquipmentDatabase.enemy_status.setJson(userdata_object.data.enemy_data);
	own_equipment_form.set_json(userdata_object.data.own_data);
	support_fleet_A.set_json(userdata_object.data.fleet_A);
	support_fleet_B.set_json(userdata_object.data.fleet_B);
	settings_set_json(userdata_object.data.settings);
}

function save_userdata(){
	if (!userdata_object.data) userdata_object.data = new Object;
	
	userdata_object.data.enemy_data = EquipmentDatabase.enemy_status.getJson();
	userdata_object.data.own_data = own_equipment_form.get_json(userdata_object.data.own_data);
	userdata_object.data.fleet_A  = support_fleet_A.get_json();
	userdata_object.data.fleet_B  = support_fleet_B.get_json();
	userdata_object.data.settings = settings_get_json();
	
	userdata_object.save();
}


/**
 * データの更新
 * @param {*} data データを格納するオブジェクト
 * @param {number} data_version dataのバージョン番号
 * @param {number} newdata_version アップデート後、このバージョン番号になるようにする
 * @returns {*} data
 */
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

	if (version == 2) {
		for (let fleet of [data.fleet_A, data.fleet_B]) {
			for (let i=0; i<fleet?.ships?.length; i++) {
				if (fleet.ships?.[i]) {
					fleet.ships[i] = SupportShip.ss_to_ssd_json(fleet.ships[i]);
				}
			}
		}
		version = 3;
	}

	if (version != newdata_version) debugger;
	
	data.version = version;
	return data;
}


// 設定についての読み書き
// GlobalとJSONの変換
function settings_get_json(){
	return {
		MultiThreading       : Global.Settings.MultiThreading,
		ThreadCountMode      : Global.Settings.ThreadCountMode,
		CustomThreadCount    : Global.Settings.CustomThreadCount,
		ThreadKeepAlive      : Global.Settings.ThreadKeepAlive,
		PriorityOption       : Global.Settings.PriorityOption,
		AnnealingIteration100: Global.Settings.AnnealingIteration100,
	};
}

function settings_set_json(json){
	if (json) {
		Global.Settings.MultiThreading        = json.MultiThreading;
		Global.Settings.ThreadCountMode       = json.ThreadCountMode;
		Global.Settings.CustomThreadCount     = Util.safe_limit(json.CustomThreadCount, 1, Global.Settings.ThreadMax);
		Global.Settings.ThreadKeepAlive       = json.ThreadKeepAlive;
		Global.Settings.PriorityOption        = json.PriorityOption || Global.Settings.PriorityOption;
		Global.Settings.AnnealingIteration100 = Util.safe_limit( json.AnnealingIteration100,
			Global.Settings.AnnealingIterationMin100, Global.Settings.AnnealingIterationMax100, Global.DefaultSettings.AnnealingIteration100 );
	}
}


