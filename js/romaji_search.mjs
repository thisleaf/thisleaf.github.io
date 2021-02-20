/**
 * @fileoverview 主にひらがなをキーとして関連付けられたデータを、ローマ字入力から探索する
 */

export {
	RomajiSearch,
};


/**
 * 簡単な探索データ管理クラス<br>
 * どちらかというとサンプル
 * @memberof RomajiSearch
 */
class Dictionary {
	/** @private */
	list = [];
	
	/**
	 * データのクリア
	 */
	clear(){
		list = [];
	}
	/**
	 * データの追加
	 * @param {string} key RomajiSearch.toKey()などで生成したkey
	 * @param {*} data 格納するデータ
	 */
	add(key, data){
		list.push({key: key, data: data});
	}
	/**
	 * begin の位置から最初に見つかったものを返す
	 * @param {RegExp} reg RomajiSearch.toSearchReg()などで生成したRegExp
	 * @param {number} [begin=0] 開始位置
	 */
	find(reg, begin = 0){
		for (let i=begin; i<this.list.length; i++) {
			if (reg.test(this.list[i].key)) return this.list[i].data;
		}
		return null;
	}
	/**
	 * マッチするもののdataをすべて返す
	 * @param {RegExp} reg
	 * @return {Array.<*>}
	 */
	findAll(reg){
		let out = [];
		for (let i=0; i<this.list.length; i++) {
			if (reg.test(this.list[i].key)) out.push(this.list[i].data);
		}
		return out;
	}
	/**
	 * マッチするものを引数にコールバック関数を呼ぶ
	 * @param {RegExp} reg 
	 * @param {Function} callback function(data, key, index)
	 */
	findForEach(reg, callback){
		for (let i=0; i<this.list.length; i++) {
			if (reg.test(this.list[i].key)) {
				callback(this.list[i].data, this.list[i].key, i);
			}
		}
	}
};


/** @namespace */
const RomajiSearch = {
	normalize       : normalize,
	toHiragana      : toHiragana,
	toKey           : toKey,
	arrayToKey      : arrayToKey,
	toSearchReg     : toSearchReg,
	toSearchRegArray: toSearchRegArray,

	Dictionary      : Dictionary,
};


// 定数
// 母音
const romaji_vowels = "aiueo";
const hira_vowels = "あいうえお";
// 子音と続くひらがな
// ただし"ん"はない
const romaji_def = {
	"k": "かきくけこ",
	"s": "さしすせそ",
	"t": "たちつてと",
	"n": "なにぬねの",
	"h": "はひふへほ",
	"m": "まみむめも",
	"y": ["や", null, "ゆ", "いぇ", "よ"],
	"r": "らりるれろ",
	"w": ["わ", "うぃ", "う", "うぇ", "を"],
	
	"c": "かしくせこ",
	"g": "がぎぐげご",
	"z": "ざじずぜぞ",
	"d": "だぢづでど",
	"b": "ばびぶべぼ",
	"p": "ぱぴぷぺぽ",
	"f": ["ふぁ", "ふぃ", "ふ", "ふぇ", "ふぉ"],
	"j": ["じゃ", "じ", "じゅ", "じぇ", "じょ"],
	"q": ["くぁ", "くぃ", "く", "くぇ", "くぉ"],
	"v": ["ゔぁ", "ゔぃ", "ゔ", "ゔぇ", "ゔぉ"],
	"x": "ぁぃぅぇぉ",
	"l": "ぁぃぅぇぉ",
	
	"ky": ["きゃ", "きぃ", "きゅ", "きぇ", "きょ"],
	"sy": ["しゃ", "しぃ", "しゅ", "しぇ", "しょ"],
	"ty": ["ちゃ", "ちぃ", "ちゅ", "ちぇ", "ちょ"],
	"ny": ["にゃ", "にぃ", "にゅ", "にぇ", "にょ"],
	"hy": ["ひゃ", "ひぃ", "ひゅ", "ひぇ", "ひょ"],
	"my": ["みゃ", "みぃ", "みゅ", "みぇ", "みょ"],
	"ry": ["りゃ", "りぃ", "りゅ", "りぇ", "りょ"],
	"wy": [null  , "ゐ"  , null  , "ゑ"  , null  ],
	
	"cy": ["ちゃ", "ちぃ", "ちゅ", "ちぇ", "ちょ"],
	"gy": ["ぎゃ", "ぎぃ", "ぎゅ", "ぎぇ", "ぎょ"],
	"zy": ["じゃ", "じぃ", "じゅ", "じぇ", "じょ"],
	"dy": ["ぢゃ", "ぢぃ", "ぢゅ", "ぢぇ", "ぢょ"],
	"by": ["びゃ", "びぃ", "びゅ", "びぇ", "びょ"],
	"py": ["ぴゃ", "ぴぃ", "ぴゅ", "ぴぇ", "ぴょ"],
	"fy": ["ふゃ", null  , "ふゅ", null  , "ふょ"],
	"jy": ["じゃ", "じぃ", "じゅ", "じぇ", "じょ"],
	"vy": ["ゔゃ", "ゔぃ", "ゔゅ", "ゔぇ", "ゔょ"],
	"xy": "ゃぃゅぇょ",
	"ly": "ゃぃゅぇょ",
	
	"sh": ["しゃ", "し"  , "しゅ", "しぇ", "しょ"],
	"th": ["てゃ", "てぃ", "てゅ", "てぇ", "てょ"],
	"wh": ["うぁ", "うぃ", "う"  , "うぇ", "うぉ"],
	"ch": ["ちゃ", "ち"  , "ちゅ", "ちぇ", "ちょ"],
	"dh": ["でゃ", "でぃ", "でゅ", "でぇ", "でょ"],
	
	"ts": ["つぁ", "つぃ", "つ"  , "つぇ", "つぉ"],
	
	"kw": ["くぁ", "くぃ", "くぅ", "くぇ", "くぉ"],
	"sw": ["すぁ", "すぃ", "すぅ", "すぇ", "すぉ"],
	"tw": ["とぁ", "とぃ", "とぅ", "とぇ", "とぉ"],
	"hw": ["ふぁ", "ふぃ", null  , "ふぇ", "ふぉ"],
	"gw": ["ぐぁ", "ぐぃ", "ぐぅ", "ぐぇ", "ぐぉ"],
	"zw": ["ずぁ", "ずぃ", "ずぅ", "ずぇ", "ずぉ"],
	"dw": ["どぁ", "どぃ", "どぅ", "どぇ", "どぉ"],
	
	"xk": ["ゕ"  , null  , null  , "ゖ"  , null  ],
	"lk": ["ゕ"  , null  , null  , "ゖ"  , null  ],
	"xw": ["ゎ"  , null  , null  , null  , null  ],
	"lw": ["ゎ"  , null  , null  , null  , null  ],
};
// 子音 → マッチする文字列
// 動的に初期化
const consonant_regexp_texts = {};

initialize();


/**
 * 初期化
 * @private
 */
function initialize(){
	// romaji_def から consonant_regexp_texts を作る
	
	// 子音 -> 続くひらがなのリスト
	let cons_arrays = {};
	
	for (let key of Object.keys(romaji_def)) {
		if (key.length == 1) {
			let arr = cons_arrays[key] || [];
			for (let ch of romaji_def[key]) {
				if (ch) arr.push(ch);
			}
			cons_arrays[key] = arr;
			
		} else { // key.length == 2
			let c = key[0];
			
			let arr1 = cons_arrays[c] || [];
			let arr2 = cons_arrays[key] || [];
			for (let ch of romaji_def[key]) {
				if (ch) {
					arr1.push(ch);
					arr2.push(ch);
				}
			}
			cons_arrays[c] = arr1;
			cons_arrays[key] = arr2;
		}
	}
	
	// "ん" だけない
	cons_arrays["n"].push("ん");
	
	for (let key of Object.keys(cons_arrays)) {
		let arr = cons_arrays[key];
		// uniqueに
		arr.sort();
		arr = arr.filter((_v, i, a) => i == 0 || a[i-1] != a[i]);
		arr.unshift(key);
		
		consonant_regexp_texts[key] = arr.join("|");
	}
}


/**
 * 探索のために文字列を標準化 基本的に外部で呼ぶ必要はない<br>
 * カタカナはひらがなに、全角英数などは半角に、大文字は小文字に、スペース等は半角スペースに<br>
 * 半角カナ未対応
 * @param {string} str normalizeする文字列
 * @return {string}
 * @memberof RomajiSearch
 */
function normalize(str){
	if (typeof str != "string") return "";
	
	// カタカナ -> ひらがな
	// 0x3041:"ぁ" から 0x3096:"ゖ" がひらがなで連続している
	// 0x30a1:"ァ" から 0x30f6:"ヶ" が対応するカタカナ　この後ろにも一応4文字ある "ヷヸヹヺ"
	str = str.replace(/[\u30a1-\u30f6]/g, c => String.fromCodePoint(c.codePointAt(0) + (0x3041 - 0x30A1)));
	
	// 全角英数 -> 半角英数
	// 0xff01:"！", 0xff5e:"～" が連続
	// 0x21:"!", 0x7e: "~"
	str = str.replace(/[\uff01-\uff5e]/g, c => String.fromCodePoint(c.codePointAt(0) + (0x21 - 0xff01)));
	
	// 引用符の変換
	str = str.replace(/[“”]/g, "\"");
	str = str.replace(/[‘’]/g, "'");
	
	// 大文字 -> 小文字
	str = str.toLowerCase();
	
	// 全角スペースなど
	str = str.replace(/[\s　]/g, " ");
	
	return str;
}

/**
 * ローマ字からひらがなへの変換<br>
 * ただしnormalize()されたものと仮定する
 * @param {string} input 入力文字列
 * @param {boolean} [keep_last_n=false] 最後がn, nyで終わっている場合、nを"ん"に変換せず残すかどうか trueでそのまま残す
 * @return {string}
 * @memberof RomajiSearch
 */
function toHiragana(input, keep_last_n = false){
	let str = String(input);
	
	// ん
	// 先に変換しないと nna などでミスる
	str = str.replace(/nn/g, "ん");
	
	// 通常変換
	str = str.replace(/([kstnhmyrwcgzdbpfjqvxl])(\1*)([yhsw]?)([aiueo])/g, (str, c, cc, yhsw, v) => {
		let vi = romaji_vowels.indexOf(v);
		let st = romaji_def[c + yhsw]?.[vi];
		if (st) {
			// 変換成功
			// cc があれば "っ" に変換
			if (cc) st = "っ".repeat(cc.length) + st;
		} else {
			st = str;
		}
		return st;
	});
	
	// aiueo
	str = str.replace(/([aiueo])/g, (_str, v) => hira_vowels[romaji_vowels.indexOf(v)]);
	
	// -, ~
	str = str.replace(/[\-~]/g, "ー");
	
	// 単体 n
	// 最後の n は入力中かもしれない
	// ny のパターンもある
	let last_offset = str.length - 1;
	str = str.replace(/n(?!y$)'?/g, (str, offset) => {
		return keep_last_n && offset == last_offset ? str : "ん";
	});
	
	return str;
}

/**
 * キー文字列から探索keyに変換<br>
 * このkeyをtoSearchReg()で作成したRegExpで探索する<br>
 * 生成される文字列はタブ区切りだが、入力のタブ文字はnormalize()によって半角スペースに変換される
 * @param {string} key_str キー文字列
 * @return {string} 探索key
 * @memberof RomajiSearch
 */
function toKey(key_str){
	let key = null;
	let str = normalize(key_str);
	if (str) {
		key = str;
		let hira = toHiragana(str, true);
		if (hira != str) key += "\t" + hira;
	}
	return key;
}

/**
 * 複数のキー文字列を一度に探索keyにする<br>
 * 空の配列を渡すと null
 * @param {Array.<string>} key_str_array キー文字列の配列
 * @return {?string} 探索key
 * @memberof RomajiSearch
 */
function arrayToKey(key_str_array){
	let key = null;
	for (let i=0; i<key_str_array.length; i++) {
		let str = normalize(key_str_array[i]);
		if (str) {
			key = key ? key + "\t" + str : str;
			let hira = toHiragana(str, true);
			if (hira != str) key += "\t" + hira;
		}
	}
	return key;
}


/**
 * 探索用のRegExpを作成して返す
 * @param {string} search_str 探索文字列
 * @param {boolean} [begin_match=false] 先頭一致かどうか
 * @return {RegExp}
 * @memberof RomajiSearch
 */
function toSearchReg(search_str, begin_match = false){
	let text = normalize(search_str);
	let hira = toHiragana(text, true);
	let hira_regtext = "";
	
	// 末尾の子音は残っているはず
	let mcap = hira.match(/([kstnhmyrwcgzdbpfjqvxl])(\1*)([yhsw]?)$/);
	if (mcap) {
		let c = mcap[1] + mcap[3];
		let ctext = consonant_regexp_texts[c];
		let cc = mcap[2];
		let cc0 = ""; // 変換しないもの
		
		if (!ctext && mcap[3]) {
			c = mcap[3];
			ctext = consonant_regexp_texts[c];
			cc = "";
			cc0 = mcap[1] + mcap[2];
		}
		
		if (ctext) {
			hira_regtext = escapePlaintext(hira.slice(0, -mcap[0].length)) + cc0;
			if (cc.length > 0) {
				let ccrep = "{" + cc.length + "}";
				hira_regtext += "(?:っ" + ccrep + "|" + mcap[1] + ccrep + ")";
			}
			if (c.length == 1) hira_regtext += "っ*";
			hira_regtext += "(?:" + ctext + ")";
		}
	}
	
	if (!hira_regtext) hira_regtext = escapePlaintext(hira);
	
	let regtext;
	if (text != hira) {
		regtext = escapePlaintext(text) + "|" + hira_regtext;
	} else {
		regtext = hira_regtext;
	}
	if (begin_match) {
		regtext = "(?:^|\t)(?:" + tegtext + ")";
	}
	return new RegExp(regtext);
}

/**
 * 探索文字列をスペースで分割し、それぞれtoSearchReg()で変換した配列を返す<br>
 * 先頭一致ではない
 * @param {string} search_str 探索文字列
 * @return {Array.<RegExp>}
 * @memberof RomajiSearch
 */
function toSearchRegArray(search_str){
	return normalize(search_str).split(/ +/).filter(t => t).map(t => toSearchReg(t));
}


/**
 * RegExpでの特殊文字をエスケープ
 * @param {string} str
 * @return {string}
 * @private
 */
function escapePlaintext(str){
	// .+?*^$|\()[]{}
	return str.replace(/[\.\+\?\*\^\$\|\\\(\)\[\]\{\}]/g, "\\$&");
}

