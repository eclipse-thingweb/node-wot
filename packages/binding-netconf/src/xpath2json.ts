var util = require('util');

export function isObject(a: any) {
	return (!!a) && (a.constructor === Object);
};

export function json2xpath(json: any, index: number, str: Array<string>) {
	if (!(this.isObject(json))) {
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
		} else if (json[key] && !this.isObject(json[key])) { //if next child is not an object, final leaf with value
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
		str = this.json2xpath(json[key], index, str);
	}
	return str;
}


export function xpath2json(xpath: string, NSs: Array<string>) {

	let subStrings = xpath.split('/');
	var obj: any = {};
	var tmp_obj: any = {};
	for (var i = subStrings.length - 1; i > -1; i--) {
		let sub = subStrings[i];
		if (sub === '') {
			continue;
		}
		var ns = null;
		var key = null;;
		tmp_obj = {};
		if (sub.split(":").length > 1) {
			ns = sub.split(":")[0];
			key = sub.split(":")[1];
			for (let j = 0; j < NSs.length; j++) {
				var ns_last = NSs[j].split(":")[NSs[j].split(":").length - 1];
				if (ns_last === ns) {
					ns = NSs[j];
				}
			}
			sub = key;
			tmp_obj[sub] = {};
			tmp_obj[sub].$ = { xmlns: ns };
		}
		var reg = /\[(.*?)\]/g;
		if (sub.match(reg)) {
			var values = sub.match(reg);
			sub = sub.replace(/\[[^\]]*\]/g, '')
			if (!tmp_obj[sub]) {
				tmp_obj[sub] = {};
			}
			for (let j = 0; j < values.length; j++) {
				var val = values[j];
				val = val.replace(/[\[\]']+/g, '');
				key = val.split("=")[0];
				val = val.split("=")[1]

				tmp_obj[sub][key] = val.replace(/['"]+/g, '');
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

	if (xpath[xpath.length - 1] === '/') { //we are going to add some leaves, remove the last /
		xpath.substring(0, xpath.length - 1);

	}
	var keys = Object.keys(payload);
	for (let j = 0; j < keys.length; j++) {
		let key = keys[j];
		let val = payload[key];
		xpath += '[' + key + '=' + val + "]";
	}
	return xpath;

}