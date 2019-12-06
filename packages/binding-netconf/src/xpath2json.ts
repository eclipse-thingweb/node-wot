var util = require('util');

export function isObject(a: any) {
	return (!!a) && (a.constructor === Object);
};

export function json2xpath(json: any, index: number, str: Array<string>) {
	if (!(isObject(json))) {
		return str;
	}
	var keys = Object.keys(json);
	for (let j = 0; j < keys.length; j++) {
		let key = keys[j];
		if (key === '$') {
			var tmp = json[key].xmlns;
			var ns = tmp.split(":")[tmp.split(":").length - 1];
			str.splice(index - 3, 0, ns + ":");
			index++;
			continue;
		} else if (json[key] && !isObject(json[key])) { //if next child is not an object, final leaf with value
			var val = json[key];
			if (j == 0) {
				str.pop(); //there was an useless "/"
			}
			str.push("[");
			str.push(key);
			str.push("=");
			str.push("\"");
			str.push(val);
			str.push("\"");
			str.push("]");
			continue;
		}
		str.push(key);
		str.push('/');
		index++;
		str = json2xpath(json[key], index, str);
	}
	return str;
}


export function xpath2json(xpath: string, NSs: Array<string>) {

	let subStrings = xpath.split('/');
	let add_NSs = []; //possible namespaces to add to the root
	var obj: any = {};
	var tmp_obj: any = {};
	for (var i = subStrings.length - 1; i > -1; i--) {
		let sub = subStrings[i];
		if (sub === '') {
			continue;
		}
		var root_ns = null;
		var key = null;;
		tmp_obj = {};
		var reg = /\[(.*?)\]/g;
		if (sub.replace(reg, '').split(":").length > 1 && i == 1) { //handle the root, without focusing on leaves
			root_ns = sub.replace(reg, '').split(":")[0];
			add_NSs.push(root_ns);
			key = sub.replace(reg, '').split(":")[1]; //remove possible leaves to avoid wrong conversion
			sub = sub.replace(root_ns + ':', ''); //remove the ns
			let $: any = {}; //object for containing namespaces
			for (let j = 0; j < add_NSs.length; j++) {
				let tmp_ns = add_NSs[j];
				let ns_found = false;
				for (let t = 0; t < NSs.length; t++) {
					var ns_last = NSs[t].split(":")[NSs[t].split(":").length - 1];
					if (ns_last === tmp_ns && tmp_ns !== root_ns) {
						$['xmlns:' + tmp_ns] = NSs[t];
						ns_found = true;
					} else if (ns_last === root_ns && tmp_ns === root_ns) {
						$['xmlns'] = NSs[t];
						ns_found = true;
					}
				}
				if (!ns_found) {
					throw new Error(`Namespace for ${tmp_ns} not specified in the TD`);
				}
			}
			tmp_obj[key] = {};
			tmp_obj[key].$ = $; //attach all the required namespaces 
		}

		if (sub.match(reg)) { //handle elements with values for leaves
			var values = sub.match(reg);
			sub = sub.replace(/\[[^\]]*\]/g, '');
			if (!tmp_obj[sub]) {
				tmp_obj[sub] = {};
			}
			for (let j = 0; j < values.length; j++) {
				var val = values[j];
				val = val.replace(/[\[\]']+/g, '');
				key = val.split("=")[0];
				val = val.split("=")[1]
				val = val.replace(/['"]+/g, ''); //remove useless ""
				if (val.split("\\:").length > 1 && i > 1) {
					let ns = val.split("\\:")[0];
					if (add_NSs.indexOf(ns) < 0) {
						add_NSs.push(ns); //add to the array of NSs that will be added when parsing the root
					}
					val = val.replace(/[\\]+/g, ''); //remove escape chars
				}

				tmp_obj[sub][key] = val;
			}
		}
		if (sub.split(":").length > 1 && i > 1) { //handle all the other cases
			let ns = sub.split(":")[0];
			val = sub.split(':')[1];
			if (add_NSs.indexOf(ns) < 0) {
				add_NSs.push(ns); //add to the array of NSs that will be added when parsing the root
			}
			if (!(sub in tmp_obj)) {
				tmp_obj[sub] = {};
			}
		}


		if (!tmp_obj[sub]) {
			tmp_obj[sub] = {};
		}
		tmp_obj[sub] = Object.assign(tmp_obj[sub], obj);
		obj = tmp_obj;
	}
	return obj;
}

export function addLeaves(xpath: string, payload: any) {
	if (!(this.isObject(payload))) {
		return xpath;
	}

	let json_string = json2xpath(payload, 0, []);
	var json_xpath = json_string[0] !== '[' ? '/': ''; //let's check if the first argument is a leaf
	for(var i = 0; i < json_string.length; i++) {
		json_xpath += json_string[i];
	}

	return xpath+json_xpath;

}