// マルチスレッドのためのクラス

import * as Util from "./utility.mjs";
import * as Global from "./kc_support_global.mjs";
import {EquipmentDatabase} from "./kc_equipment.mjs";
import {
	SupportFleetScore,
	SupportShipScore,
	SupportFleetScorePrior,
} from "./kc_support_score.mjs";

export {
	worker_get,
	worker_release,
	MultiThreadSearcher,
};


// 待機中ワーカー
let worker_pool = new Array();
// 最終実行時間
let worker_pool_lastmod = null;
// 実行した数(累計)
let worker_run_count = 0;
// ワーカーの解放用タイマーID
let worker_timer = null;


// ワーカー ----------------------------------------------------------------------------------------
// 時間が経ったワーカーを終了してメモリを解放する
function worker_terminator(){
	if (!worker_pool_lastmod) return;
	
	let elapsed = new Date().getTime() - worker_pool_lastmod.getTime();
	if (!Global.Settings.ThreadKeepAlive || elapsed > Global.Settings.ThreadKeepTime) {
		for (let w of worker_pool) {
			w.terminate();
		}
		worker_pool.length = 0;
		worker_pool_lastmod = null;
		
		if (worker_timer) {
			clearInterval(worker_timer);
			worker_timer = null;
		}
	}
}

// ワーカーを用意する
// poolにあればそれを利用する
function worker_get(){
	if (worker_pool.length > 0) {
		let w = worker_pool.pop();
		// 一応設定を送っておく
		w.postMessage({
			type: "settings",
			settings: Global.Settings,
		});
		return w;
	}
	
	// Workerのパスの起点はhtmlファイルっぽいので、絶対URLで指定することにする
	let url = new URL("./kc_support_worker.mjs", import.meta.url);
	let worker = new Worker(url.href, {type: "module", name: "thread " + (++worker_run_count)});
	// 初期化
	worker.postMessage({
		type: "initialize",
		data: EquipmentDatabase.get_data(),
		settings: Global.Settings,
	});
	
	return worker;
}

// ワーカーを使い終わった
// 時間経過で解放する
// event listener は外しておくこと
function worker_release(worker){
	if (!Global.Settings.ThreadKeepAlive || Global.Settings.ThreadKeepTime == 0) {
		worker.terminate();
		return;
	}
	
	worker_pool.push(worker);
	worker_pool_lastmod = new Date();
	
	if (!worker_timer) {
		// 実行していないワーカーを処理するタイマー
		worker_timer = setInterval(worker_terminator, Global.Settings.ThreadDestroyInterval);
	}
}


// MultiThreadSearcher -----------------------------------------------------------------------------
Object.assign(MultiThreadSearcher.prototype, {
	/* EventTarget を継承
		start  : 探索開始時
		receive: 一つの結果を受信したとき
		finish : 探索終了時
		error  : エラー時
	*/
	
	// プロパティはクラスの外では読み取り専用とする
	
	// スレッド数
	thread_count: navigator.hardwareConcurrency || 1,
	// 初期データ
	search_data: null,
	// 連続実行するか
	continuous : false,
	// 連続実行中
	continuous_running: false,
	// 連続実行モードで送られるデータ
	continuous_data: null,
	// 実行中のワーカー
	workers: null,
	// 探索するSupportFleetData
	fleet: null,
	
	// 現在探索中
	running: false,
	// 探索開始時のもの
	begin_result: null,
	begin_score : null,
	begin_date  : null,
	// 探索結果
	max_result: null, // 最大のときの message
	max_score : null,
	receive_count: 0,
	max_found_at : 0, // maxが見つかったときのreceive_count
	end_date  : null,
	
	set_thread_count: MultiThreadSearcher_set_thread_count,
	set_thread_count_by_Global: MultiThreadSearcher_set_thread_count_by_Global,
	set_search_data : MultiThreadSearcher_set_search_data,
	
	// 実行
	run : MultiThreadSearcher_run,
	// 停止(リクエスト)
	stop: MultiThreadSearcher_stop,
	// 強制停止
	terminate: MultiThreadSearcher_terminate,
	// かかった時間 (msec)
	get_elapsed_time: MultiThreadSearcher_get_elapsed_time,
	// 解の情報
	get_solution_info: MultiThreadSearcher_get_solution_info,
	
	// 結果の受信
	receive_message: MultiThreadSearcher_receive_message,
	// スコアの比較関数
	compare_score: MultiThreadSearcher_compare_score,
});

Object.assign(MultiThreadSearcher, {
	compare_score : MultiThreadSearcher_static_compare_score,
	get_score_diff: MultiThreadSearcher_static_get_score_diff,
});


function MultiThreadSearcher(){
	Util.attach_event_target(this);
}

// 探索の設定
// search_data は必ず設定する
function MultiThreadSearcher_set_thread_count(count){
	this.thread_count = count;
}

function MultiThreadSearcher_set_thread_count_by_Global(){
	let count = 1;
	
	if (Global.Settings.ThreadCountMode == "auto") {
		count = navigator.hardwareConcurrency || 1;
	} else if (Global.Settings.ThreadCountMode == "custom") {
		count = Global.Settings.CustomThreadCount;
	}
	
	this.thread_count = count;
	return count;
}

// search_data.data はこの関数でセットされるので、探索の設定のみで良い
function MultiThreadSearcher_set_search_data(fleet, search_data, continuous = false){
	this.fleet = fleet;
	this.search_data = search_data;
	this.continuous = continuous;
	
	this.search_data.data = fleet.get_json_MT(null, true);
	
	if (continuous) {
		let cont = Object.assign(new Object, search_data);
		cont.inherit_data = true;
		delete cont.data;
		this.continuous_data = cont;
	}
}

// 探索の実行
// Promiseを返し、探索終了時に通知される
function MultiThreadSearcher_run(){
	if (this.workers && this.workers.length > 0) debugger;
	if (!this.search_data) debugger;
	
	// 探索用変数の初期化
	let begin_result = Object.assign(new Object, this.search_data);
	begin_result.score = new SupportFleetScorePrior(this.fleet.ssd_list);
	
	this.running = true;
	this.continuous_running = this.continuous;
	this.begin_result = begin_result;
	this.begin_score = begin_result.score;
	this.max_result = begin_result;
	this.max_score = begin_result.score;
	this.receive_count = 0;
	this.workers = new Array();
	
	// Promise
	let resolve, reject;
	let safe_resolve = result => {
		if (resolve) {
			resolve(result);
			resolve = null;
			reject = null;
		}
	};
	let safe_reject = result => {
		if (reject) {
			reject(result);
			resolve = null;
			reject = null;
		}
	};
	let task = new Promise((rs, rj) => {
		resolve = rs;
		reject = rj;
	});
	
	// ワーカーは再利用するので、終了時にイベントは取り除く
	let remove = worker => {
		worker.removeEventListener("error", onerror);
		worker.removeEventListener("message", onmessage);
		this.workers.splice(this.workers.indexOf(worker), 1);
	};
	
	let onerror = e => {
		remove(e.currentTarget);
		safe_reject(e);
	};
	
	let onmessage = e => {
		let message = e.data;
		let worker = e.currentTarget;
		
		// 正常終了
		if (message.type == "solution") {
			// 連続実行モードの場合、もう一度
			if (this.continuous_running) {
				worker.postMessage(this.continuous_data);
				this.receive_message(message);
				
			} else {
				remove(worker);
				worker_release(worker);
				this.receive_message(message);
				
				// すべてのスレッドが終了したら通知
				if (this.workers.length == 0) safe_resolve();
			}
		}
	};
	
	// 強制終了
	this.terminate = () => {
		let wks = this.workers.concat();
		
		for (let i=0; i<wks.length; i++) {
			remove(wks[i]);
			wks[i].terminate();
		}
		safe_resolve();
	};
	
	for (let i=0; i<this.thread_count; i++) {
		let worker = worker_get();
		this.workers.push(worker);
		
		worker.addEventListener("error", onerror);
		worker.addEventListener("message", onmessage);
		
		// 探索開始メッセージの送信
		worker.postMessage(this.search_data);
	}
	
	this.begin_date = new Date();
	this.dispatchEvent(new CustomEvent("start"));
	
	return task.then(() => {
		this.dispatchEvent(new CustomEvent("finish"));
		return this.max_result;
	}).catch(e => {
		this.dispatchEvent(new CustomEvent("error"));
		throw e;
	}).finally(() => {
		this.running = false;
		this.end_date = new Date();
		delete this.terminate;
	});
}

// 探索の終了リクエスト
// 継続実行の場合のみ
function MultiThreadSearcher_stop(){
	this.continuous_running = false;
}

// 強制停止
// run() によって上書き定義される
function MultiThreadSearcher_terminate(){
}

// かかった時間
// 終了していない場合は現在時刻までの時間
function MultiThreadSearcher_get_elapsed_time(){
	let begin = this.begin_date;
	let end = this.end_date || new Date();
	if (!begin) return -1;
	return end.getTime() - begin.getTime();
}

// 新規解の情報文字列
// nullstr: 新しい解がないときも出力
function MultiThreadSearcher_get_solution_info(nullstr = false, use_found_at = true){
	return MultiThreadSearcher.get_score_diff(this.begin_score, this.max_score, this.search_data.search_type, nullstr, use_found_at ? this.max_found_at : -1);
}

// 探索結果を受信
function MultiThreadSearcher_receive_message(message){
	this.receive_count++;
	
	let score = new SupportFleetScorePrior().set_json(message.score_data);
	
	if (!this.max_score || this.compare_score(this.max_score, score) < 0) {
		this.max_result = message;
		this.max_score = score;
		this.max_result.score = score;
		this.max_found_at = this.receive_count;
	}
	
	// 受信時にイベントを発生させる
	this.dispatchEvent(new CustomEvent("receive"));
}

// スコアの比較
// 探索方法で比較関数が異なる
function MultiThreadSearcher_compare_score(a, b){
	return MultiThreadSearcher.compare_score(a, b, this.search_data.search_type);
}


// static版
function MultiThreadSearcher_static_compare_score(a, b, search_type = ""){
	let c = 0;
	if (search_type == "annealing_entire") {
		c = a.compare_s1(b) || a.compare_s2(b) || a.compare_s3(b);
	} else {
		c = a.compare_rigidly(b);
	}
	return c;
}


function MultiThreadSearcher_static_get_score_diff(begin_score, end_score, search_type = "", nullstr = false, found_at = -1){
	let text = "";
	
	if (end_score && MultiThreadSearcher.compare_score(begin_score, end_score, search_type) < 0) {
		let c1 = begin_score.compare_s1(end_score);
		
		if (c1 < 0) {
			text = "改良解発見";
		} else if (c1 == 0) {
			text = "同値解発見";
		} else {
			text = "別解発見";
		}
		text += "(";
		if (found_at >= 0) text += found_at + "/";
		text += "命中" + end_score.total_score.total_accuracy + ")";
		
	} else if (nullstr) {
		text = "新規解なし";
		text += "(命中" + begin_score.total_score.total_accuracy + ")";
	}
	
	return text;
}

