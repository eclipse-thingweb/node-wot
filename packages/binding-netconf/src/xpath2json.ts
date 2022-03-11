/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

export function isObject(a: unknown): boolean {
    return !!a && a.constructor === Object;
}

export function json2xpath(json: any, index: number, str: Array<string>): string[] {
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
            if (j === 0) {
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

export function xpath2json(xpath: string, NSs: any): any {
    const subStrings = xpath.split("/");
    let obj: any = {};
    let tmpObj: any = {};
    for (let i = subStrings.length - 1; i > -1; i--) {
        let sub = subStrings[i];
        if (sub === "") {
            continue;
        }
        let rootNs = null;
        let key = null;
        tmpObj = {};
        const reg = /\[(.*?)\]/g;
        if (sub.replace(reg, "").split(":").length > 1 && i === 1) {
            // handle the root, without focusing on leaves
            rootNs = sub.replace(reg, "").split(":")[0];
            key = sub.replace(reg, "").split(":")[1]; // remove possible leaves to avoid wrong conversion
            sub = sub.replace(rootNs + ":", ""); // remove the ns
            const $: any = {}; // object for containing namespaces
            if (!(rootNs in NSs)) {
                throw new Error(`Namespace for ${rootNs} not specified in the TD`);
            }
            $.xmlns = NSs[rootNs];
            tmpObj[key] = {};
            tmpObj[key].$ = $; // attach all the required namespaces
        }

        if (sub.match(reg)) {
            // handle elements with values for leaves
            const values = sub.match(reg);
            sub = sub.replace(/\[[^\]]*\]/g, "");
            if (!tmpObj[sub]) {
                // create the parent
                tmpObj[sub] = {};
            }
            for (let j = 0; j < values.length; j++) {
                let val = values[j];
                val = val.replace(/[[\]']+/g, "");
                key = val.split("=")[0];
                val = val.split("=")[1];
                val = val.replace(/['"]+/g, ""); // remove useless ""
                tmpObj[sub][key] = val;
                if (val.split("\\:").length > 1 && i > 1) {
                    const nsKey = val.split("\\:")[0];
                    val = val.replace(/[\\]+/g, ""); // remove escape chars
                    if (!(nsKey in NSs)) {
                        throw new Error(`Namespace for ${nsKey} not specified in the TD`);
                    }
                    const ns = NSs[nsKey];
                    const xmlnsKey = "xmlns:" + nsKey;
                    tmpObj[sub][key] = { $: { [xmlnsKey]: ns }, _: val };
                }
            }
        }
        if (sub.split(":").length > 1 && i > 1) {
            // handle all the other cases
            const nsKey = sub.split(":")[0];
            const val = sub.split(":")[1];
            if (!(sub in tmpObj)) {
                tmpObj[val] = {}; // the new key is val
            } else {
                // key already existing, let's update it with the new one
                const newObject = {};
                delete Object.assign(newObject, tmpObj, { [val]: tmpObj[sub] })[sub];
                tmpObj = newObject;
            }
            sub = val; // since xmlns is going to be add, sub is now just the value
            tmpObj[sub].$ = {};
            if (!(nsKey in NSs)) {
                throw new Error(`Namespace for ${nsKey} not specified in the TD`);
            }

            tmpObj[sub].$.xmlns = NSs[nsKey];
        }

        if (!tmpObj[sub]) {
            tmpObj[sub] = {};
        }
        tmpObj[sub] = Object.assign(tmpObj[sub], obj);
        obj = tmpObj;
    }
    return obj;
}

export function addLeaves(xpath: string, payload: any): string {
    if (!isObject(payload)) {
        return xpath;
    }

    const jsonString = json2xpath(payload, 0, []);
    const jsonXpath = jsonString.join("");
    // remove the leaf from the xpath, since it has been added by the codec again
    // remove only if it is not the only one element in the xpath
    if (xpath.split("/").length > 2) {
        // there is also the '' element in the array to consider
        const lastEl = xpath.split("/").splice(-1, 1);
        xpath = xpath.replace("/" + lastEl[0], "");
    }

    return xpath + jsonXpath;
}
