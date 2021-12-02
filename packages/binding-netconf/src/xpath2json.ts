/********************************************************************************
 * Copyright (c) 2019 - 2021 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

export function isObject(a: any) {
    return !!a && a.constructor === Object;
}

export function json2xpath(json: any, index: number, str: Array<string>) {
    if (!isObject(json)) {
        return str;
    }
    const keys = Object.keys(json);
    for (let j = 0; j < keys.length; j++) {
        const key = keys[j];
        if (key === "$") {
            const tmp = json[key].xmlns;
            const ns = tmp.split(":")[tmp.split(":").length - 1];
            str.splice(index - 3, 0, ns + ":");
            index++;
            continue;
        } else if (json[key] && !isObject(json[key])) {
            // if next child is not an object, final leaf with value
            const val = json[key];
            if (j == 0) {
                str.pop(); // there was an useless "/"
            }
            str.push("[");
            str.push(key);
            str.push("=");
            str.push('"');
            str.push(val);
            str.push('"');
            str.push("]");
            continue;
        }
        str.push(key);
        str.push("/"); // FIXME does not take into account possible siblings -> it makes them all children
        index++;
        str = json2xpath(json[key], index, str);
    }
    return str;
}

export function xpath2json(xpath: string, NSs: any) {
    const subStrings = xpath.split("/");
    let obj: any = {};
    let tmp_obj: any = {};
    for (let i = subStrings.length - 1; i > -1; i--) {
        let sub = subStrings[i];
        if (sub === "") {
            continue;
        }
        let root_ns = null;
        let key = null;
        tmp_obj = {};
        const reg = /\[(.*?)\]/g;
        if (sub.replace(reg, "").split(":").length > 1 && i == 1) {
            // handle the root, without focusing on leaves
            root_ns = sub.replace(reg, "").split(":")[0];
            key = sub.replace(reg, "").split(":")[1]; // remove possible leaves to avoid wrong conversion
            sub = sub.replace(root_ns + ":", ""); // remove the ns
            const $: any = {}; // object for containing namespaces
            if (!(root_ns in NSs)) {
                throw new Error(`Namespace for ${root_ns} not specified in the TD`);
            }
            $.xmlns = NSs[root_ns];
            tmp_obj[key] = {};
            tmp_obj[key].$ = $; // attach all the required namespaces
        }

        if (sub.match(reg)) {
            // handle elements with values for leaves
            const values = sub.match(reg);
            sub = sub.replace(/\[[^\]]*\]/g, "");
            if (!tmp_obj[sub]) {
                // create the parent
                tmp_obj[sub] = {};
            }
            for (let j = 0; j < values.length; j++) {
                var val = values[j];
                val = val.replace(/[\[\]']+/g, "");
                key = val.split("=")[0];
                val = val.split("=")[1];
                val = val.replace(/['"]+/g, ""); // remove useless ""
                tmp_obj[sub][key] = val;
                if (val.split("\\:").length > 1 && i > 1) {
                    const ns_key = val.split("\\:")[0];
                    val = val.replace(/[\\]+/g, ""); // remove escape chars
                    if (!(ns_key in NSs)) {
                        throw new Error(`Namespace for ${ns_key} not specified in the TD`);
                    }
                    const ns = NSs[ns_key];
                    const xmlns_key = "xmlns:" + ns_key;
                    tmp_obj[sub][key] = { $: { [xmlns_key]: ns }, _: val };
                }
            }
        }
        if (sub.split(":").length > 1 && i > 1) {
            // handle all the other cases
            const ns_key = sub.split(":")[0];
            val = sub.split(":")[1];
            if (!(sub in tmp_obj)) {
                tmp_obj[val] = {}; // the new key is val
            } else {
                // key already existing, let's update it with the new one
                const newObject = {};
                delete Object.assign(newObject, tmp_obj, { [val]: tmp_obj[sub] })[sub];
                tmp_obj = newObject;
            }
            sub = val; // since xmlns is going to be add, sub is now just the value
            tmp_obj[sub].$ = {};
            if (!(ns_key in NSs)) {
                throw new Error(`Namespace for ${ns_key} not specified in the TD`);
            }

            tmp_obj[sub].$.xmlns = NSs[ns_key];
        }

        if (!tmp_obj[sub]) {
            tmp_obj[sub] = {};
        }
        tmp_obj[sub] = Object.assign(tmp_obj[sub], obj);
        obj = tmp_obj;
    }
    return obj;
}

export function addLeaves(this: any, xpath: string, payload: any) {
    if (!this.isObject(payload)) {
        return xpath;
    }

    const json_string = json2xpath(payload, 0, []);
    const json_xpath = json_string.join("");
    // remove the leaf from the xpath, since it has been added by the codec again
    // remove only if it is not the only one element in the xpath
    if (xpath.split("/").length > 2) {
        // there is also the '' element in the array to consider
        const last_el = xpath.split("/").splice(-1, 1);
        xpath = xpath.replace("/" + last_el[0], "");
    }

    return xpath + json_xpath;
}
