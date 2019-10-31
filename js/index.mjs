// トップページ用

document.addEventListener("DOMContentLoaded", init_index);

function init_index(){
	let dl = document.querySelector("#history_list");
	let details = document.querySelectorAll("#history_list span");
	
	for (let i=0; i<details.length; i++) {
		let button = document.createElement("a");
		button.className = "button";
		button.textContent = "[詳細]";
		button.addEventListener("click", ev_click_detail);
		
		let span = details[i];
		span.classList.add("hide");
		span.parentElement.insertBefore(button, span.nextSibling);
	}
}

function ev_click_detail(e){
	let src = e.currentTarget;
	let span = src.previousElementSibling;
	
	span.classList.toggle("hide");
	src.textContent = span.classList.contains("hide") ? "[詳細]" : "[隠す]";
}

